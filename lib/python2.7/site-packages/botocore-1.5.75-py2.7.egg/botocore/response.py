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

import sys
import xml.etree.cElementTree
import logging

from botocore import ScalarTypes
from botocore.hooks import first_non_none_response
from botocore.compat import json, set_socket_timeout, XMLParseError
from botocore.exceptions import IncompleteReadError
from botocore import parsers


logger = logging.getLogger(__name__)


class StreamingBody(object):
    """Wrapper class for an http response body.

    This provides a few additional conveniences that do not exist
    in the urllib3 model:

        * Set the timeout on the socket (i.e read() timeouts)
        * Auto validation of content length, if the amount of bytes
          we read does not match the content length, an exception
          is raised.

    """
    def __init__(self, raw_stream, content_length):
        self._raw_stream = raw_stream
        self._content_length = content_length
        self._amount_read = 0

    def set_socket_timeout(self, timeout):
        """Set the timeout seconds on the socket."""
        # The problem we're trying to solve is to prevent .read() calls from
        # hanging.  This can happen in rare cases.  What we'd like to ideally
        # do is set a timeout on the .read() call so that callers can retry
        # the request.
        # Unfortunately, this isn't currently possible in requests.
        # See: https://github.com/kennethreitz/requests/issues/1803
        # So what we're going to do is reach into the guts of the stream and
        # grab the socket object, which we can set the timeout on.  We're
        # putting in a check here so in case this interface goes away, we'll
        # know.
        try:
            # To further complicate things, the way to grab the
            # underlying socket object from an HTTPResponse is different
            # in py2 and py3.  So this code has been pushed to botocore.compat.
            set_socket_timeout(self._raw_stream, timeout)
        except AttributeError:
            logger.error("Cannot access the socket object of "
                         "a streaming response.  It's possible "
                         "the interface has changed.", exc_info=True)
            raise

    def read(self, amt=None):
        """Read at most amt bytes from the stream.

        If the amt argument is omitted, read all data.
        """
        chunk = self._raw_stream.read(amt)
        self._amount_read += len(chunk)
        if not chunk or amt is None:
            # If the server sends empty contents or
            # we ask to read all of the contents, then we know
            # we need to verify the content length.
            self._verify_content_length()
        return chunk

    def _verify_content_length(self):
        # See: https://github.com/kennethreitz/requests/issues/1855
        # Basically, our http library doesn't do this for us, so we have
        # to do this ourself.
        if self._content_length is not None and \
                self._amount_read != int(self._content_length):
            raise IncompleteReadError(
                actual_bytes=self._amount_read,
                expected_bytes=int(self._content_length))

    def close(self):
        """Close the underlying http response stream."""
        self._raw_stream.close()


def get_response(operation_model, http_response):
    protocol = operation_model.metadata['protocol']
    response_dict = {
        'headers': http_response.headers,
        'status_code': http_response.status_code,
    }
    # TODO: Unfortunately, we have to have error logic here.
    # If it looks like an error, in the streaming response case we
    # need to actually grab the contents.
    if response_dict['status_code'] >= 300:
        response_dict['body'] = http_response.content
    elif operation_model.has_streaming_output:
        response_dict['body'] = StreamingBody(
            http_response.raw, response_dict['headers'].get('content-length'))
    else:
        response_dict['body'] = http_response.content

    parser = parsers.create_parser(protocol)
    return http_response, parser.parse(response_dict,
                                       operation_model.output_shape)
