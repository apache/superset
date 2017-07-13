# Copyright (c) 2012-2013 Mitch Garnaat http://garnaat.org/
# Copyright 2012-2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
# http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.

import os
import logging
import time
import threading

from botocore.vendored.requests.adapters import HTTPAdapter
from botocore.vendored.requests.sessions import Session
from botocore.vendored.requests.utils import get_environ_proxies
from botocore.vendored.requests.exceptions import ConnectionError
from botocore.vendored import six

from botocore.awsrequest import create_request_object
from botocore.exceptions import UnknownEndpointError
from botocore.exceptions import EndpointConnectionError
from botocore.exceptions import ConnectionClosedError
from botocore.compat import filter_ssl_warnings
from botocore.utils import is_valid_endpoint_url
from botocore.hooks import first_non_none_response
from botocore.response import StreamingBody
from botocore import parsers


logger = logging.getLogger(__name__)
DEFAULT_TIMEOUT = 60
MAX_POOL_CONNECTIONS = 10
filter_ssl_warnings()

try:
    from botocore.vendored.requests.packages.urllib3.contrib import pyopenssl
    pyopenssl.extract_from_urllib3()
except ImportError:
    pass


def convert_to_response_dict(http_response, operation_model):
    """Convert an HTTP response object to a request dict.

    This converts the requests library's HTTP response object to
    a dictionary.

    :type http_response: botocore.vendored.requests.model.Response
    :param http_response: The HTTP response from an AWS service request.

    :rtype: dict
    :return: A response dictionary which will contain the following keys:
        * headers (dict)
        * status_code (int)
        * body (string or file-like object)

    """
    response_dict = {
        'headers': http_response.headers,
        'status_code': http_response.status_code,
    }
    if response_dict['status_code'] >= 300:
        response_dict['body'] = http_response.content
    elif operation_model.has_streaming_output:
        response_dict['body'] = StreamingBody(
            http_response.raw, response_dict['headers'].get('content-length'))
    else:
        response_dict['body'] = http_response.content
    return response_dict


class BotocoreHTTPSession(Session):
    """Internal session class used to workaround requests behavior.

    This class is intended to be used only by the Endpoint class.

    """
    def __init__(self, max_pool_connections=MAX_POOL_CONNECTIONS,
                 http_adapter_cls=HTTPAdapter):
        super(BotocoreHTTPSession, self).__init__()
        # In order to support a user provided "max_pool_connections", we need
        # to recreate the HTTPAdapter and pass in our max_pool_connections
        # value.
        adapter = http_adapter_cls(pool_maxsize=max_pool_connections)
        # requests uses an HTTPAdapter for mounting both http:// and https://
        self.mount('https://', adapter)
        self.mount('http://', adapter)

    def rebuild_auth(self, prepared_request, response):
        # Keep the existing auth information from the original prepared request.
        # Normally this method would be where auth is regenerated as needed.
        # By making this a noop, we're keeping the existing auth info.
        pass


class Endpoint(object):
    """
    Represents an endpoint for a particular service in a specific
    region.  Only an endpoint can make requests.

    :ivar service: The Service object that describes this endpoints
        service.
    :ivar host: The fully qualified endpoint hostname.
    :ivar session: The session object.
    """

    def __init__(self, host, endpoint_prefix,
                 event_emitter, proxies=None, verify=True,
                 timeout=DEFAULT_TIMEOUT, response_parser_factory=None,
                 max_pool_connections=MAX_POOL_CONNECTIONS):
        self._endpoint_prefix = endpoint_prefix
        self._event_emitter = event_emitter
        self.host = host
        self.verify = verify
        if proxies is None:
            proxies = {}
        self.proxies = proxies
        self.http_session = BotocoreHTTPSession(
            max_pool_connections=max_pool_connections)
        self.timeout = timeout
        self.max_pool_connections = max_pool_connections
        logger.debug('Setting %s timeout as %s', endpoint_prefix, self.timeout)
        self._lock = threading.Lock()
        if response_parser_factory is None:
            response_parser_factory = parsers.ResponseParserFactory()
        self._response_parser_factory = response_parser_factory

    def __repr__(self):
        return '%s(%s)' % (self._endpoint_prefix, self.host)

    def make_request(self, operation_model, request_dict):
        logger.debug("Making request for %s (verify_ssl=%s) with params: %s",
                     operation_model, self.verify, request_dict)
        return self._send_request(request_dict, operation_model)

    def create_request(self, params, operation_model=None):
        request = create_request_object(params)
        if operation_model:
            event_name = 'request-created.{endpoint_prefix}.{op_name}'.format(
                endpoint_prefix=self._endpoint_prefix,
                op_name=operation_model.name)
            self._event_emitter.emit(event_name, request=request,
                                     operation_name=operation_model.name)
        prepared_request = self.prepare_request(request)
        return prepared_request

    def _encode_headers(self, headers):
        # In place encoding of headers to utf-8 if they are unicode.
        for key, value in headers.items():
            if isinstance(value, six.text_type):
                headers[key] = value.encode('utf-8')

    def prepare_request(self, request):
        self._encode_headers(request.headers)
        return request.prepare()

    def _send_request(self, request_dict, operation_model):
        attempts = 1
        request = self.create_request(request_dict, operation_model)
        success_response, exception = self._get_response(
            request, operation_model, attempts)
        while self._needs_retry(attempts, operation_model, request_dict,
                                success_response, exception):
            attempts += 1
            # If there is a stream associated with the request, we need
            # to reset it before attempting to send the request again.
            # This will ensure that we resend the entire contents of the
            # body.
            request.reset_stream()
            # Create a new request when retried (including a new signature).
            request = self.create_request(
                request_dict, operation_model)
            success_response, exception = self._get_response(
                request, operation_model, attempts)
        if success_response is not None and \
                'ResponseMetadata' in success_response[1]:
            # We want to share num retries, not num attempts.
            total_retries = attempts - 1
            success_response[1]['ResponseMetadata']['RetryAttempts'] = \
                    total_retries
        if exception is not None:
            raise exception
        else:
            return success_response

    def _get_response(self, request, operation_model, attempts):
        # This will return a tuple of (success_response, exception)
        # and success_response is itself a tuple of
        # (http_response, parsed_dict).
        # If an exception occurs then the success_response is None.
        # If no exception occurs then exception is None.
        try:
            logger.debug("Sending http request: %s", request)
            http_response = self.http_session.send(
                request, verify=self.verify,
                stream=operation_model.has_streaming_output,
                proxies=self.proxies, timeout=self.timeout)
        except ConnectionError as e:
            # For a connection error, if it looks like it's a DNS
            # lookup issue, 99% of the time this is due to a misconfigured
            # region/endpoint so we'll raise a more specific error message
            # to help users.
            logger.debug("ConnectionError received when sending HTTP request.",
                         exc_info=True)
            if self._looks_like_dns_error(e):
                endpoint_url = e.request.url
                better_exception = EndpointConnectionError(
                    endpoint_url=endpoint_url, error=e)
                return (None, better_exception)
            elif self._looks_like_bad_status_line(e):
                better_exception = ConnectionClosedError(
                    endpoint_url=e.request.url, request=e.request)
                return (None, better_exception)
            else:
                return (None, e)
        except Exception as e:
            logger.debug("Exception received when sending HTTP request.",
                         exc_info=True)
            return (None, e)
        # This returns the http_response and the parsed_data.
        response_dict = convert_to_response_dict(http_response,
                                                 operation_model)
        parser = self._response_parser_factory.create_parser(
            operation_model.metadata['protocol'])
        parsed_response = parser.parse(
            response_dict, operation_model.output_shape)
        return (http_response, parsed_response), None

    def _looks_like_dns_error(self, e):
        return 'gaierror' in str(e) and e.request is not None

    def _looks_like_bad_status_line(self, e):
        return 'BadStatusLine' in str(e) and e.request is not None

    def _needs_retry(self, attempts, operation_model, request_dict,
                     response=None, caught_exception=None):
        event_name = 'needs-retry.%s.%s' % (self._endpoint_prefix,
                                            operation_model.name)
        responses = self._event_emitter.emit(
            event_name, response=response, endpoint=self,
            operation=operation_model, attempts=attempts,
            caught_exception=caught_exception, request_dict=request_dict)
        handler_response = first_non_none_response(responses)
        if handler_response is None:
            return False
        else:
            # Request needs to be retried, and we need to sleep
            # for the specified number of times.
            logger.debug("Response received to retry, sleeping for "
                         "%s seconds", handler_response)
            time.sleep(handler_response)
            return True


class EndpointCreator(object):
    def __init__(self, event_emitter):
        self._event_emitter = event_emitter

    def create_endpoint(self, service_model, region_name, endpoint_url,
                        verify=None, response_parser_factory=None,
                        timeout=DEFAULT_TIMEOUT,
                        max_pool_connections=MAX_POOL_CONNECTIONS):
        if not is_valid_endpoint_url(endpoint_url):

            raise ValueError("Invalid endpoint: %s" % endpoint_url)
        return Endpoint(
            endpoint_url,
            endpoint_prefix=service_model.endpoint_prefix,
            event_emitter=self._event_emitter,
            proxies=self._get_proxies(endpoint_url),
            verify=self._get_verify_value(verify),
            timeout=timeout,
            max_pool_connections=max_pool_connections,
            response_parser_factory=response_parser_factory)

    def _get_proxies(self, url):
        # We could also support getting proxies from a config file,
        # but for now proxy support is taken from the environment.
        return get_environ_proxies(url)

    def _get_verify_value(self, verify):
        # This is to account for:
        # https://github.com/kennethreitz/requests/issues/1436
        # where we need to honor REQUESTS_CA_BUNDLE because we're creating our
        # own request objects.
        # First, if verify is not None, then the user explicitly specified
        # a value so this automatically wins.
        if verify is not None:
            return verify
        # Otherwise use the value from REQUESTS_CA_BUNDLE, or default to
        # True if the env var does not exist.
        return os.environ.get('REQUESTS_CA_BUNDLE', True)
