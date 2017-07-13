# Copyright 2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import logging
import functools

from botocore import waiter, xform_name
from botocore.auth import AUTH_TYPE_MAPS
from botocore.awsrequest import prepare_request_dict
from botocore.docs.docstring import ClientMethodDocstring
from botocore.docs.docstring import PaginatorDocstring
from botocore.exceptions import ClientError, DataNotFoundError
from botocore.exceptions import OperationNotPageableError
from botocore.exceptions import UnknownSignatureVersionError
from botocore.hooks import first_non_none_response
from botocore.model import ServiceModel
from botocore.paginate import Paginator
from botocore.utils import CachedProperty
from botocore.utils import get_service_module_name
from botocore.utils import switch_host_s3_accelerate
from botocore.utils import S3RegionRedirector
from botocore.utils import fix_s3_host
from botocore.utils import switch_to_virtual_host_style
from botocore.utils import S3_ACCELERATE_WHITELIST
from botocore.args import ClientArgsCreator
from botocore.compat import urlsplit
from botocore import UNSIGNED
# Keep this imported.  There's pre-existing code that uses
# "from botocore.client import Config".
from botocore.config import Config


logger = logging.getLogger(__name__)


class ClientCreator(object):
    """Creates client objects for a service."""
    def __init__(self, loader, endpoint_resolver, user_agent, event_emitter,
                 retry_handler_factory, retry_config_translator,
                 response_parser_factory=None, exceptions_factory=None):
        self._loader = loader
        self._endpoint_resolver = endpoint_resolver
        self._user_agent = user_agent
        self._event_emitter = event_emitter
        self._retry_handler_factory = retry_handler_factory
        self._retry_config_translator = retry_config_translator
        self._response_parser_factory = response_parser_factory
        self._exceptions_factory = exceptions_factory

    def create_client(self, service_name, region_name, is_secure=True,
                      endpoint_url=None, verify=None,
                      credentials=None, scoped_config=None,
                      api_version=None,
                      client_config=None):
        service_model = self._load_service_model(service_name, api_version)
        cls = self._create_client_class(service_name, service_model)
        endpoint_bridge = ClientEndpointBridge(
            self._endpoint_resolver, scoped_config, client_config,
            service_signing_name=service_model.metadata.get('signingName'))
        client_args = self._get_client_args(
            service_model, region_name, is_secure, endpoint_url,
            verify, credentials, scoped_config, client_config, endpoint_bridge)
        service_client = cls(**client_args)
        self._register_s3_events(
            service_client, endpoint_bridge, endpoint_url, client_config,
            scoped_config)
        return service_client

    def create_client_class(self, service_name, api_version=None):
        service_model = self._load_service_model(service_name, api_version)
        return self._create_client_class(service_name, service_model)

    def _create_client_class(self, service_name, service_model):
        class_attributes = self._create_methods(service_model)
        py_name_to_operation_name = self._create_name_mapping(service_model)
        class_attributes['_PY_TO_OP_NAME'] = py_name_to_operation_name
        bases = [BaseClient]
        self._event_emitter.emit('creating-client-class.%s' % service_name,
                                 class_attributes=class_attributes,
                                 base_classes=bases)
        class_name = get_service_module_name(service_model)
        cls = type(str(class_name), tuple(bases), class_attributes)
        return cls

    def _load_service_model(self, service_name, api_version=None):
        json_model = self._loader.load_service_model(service_name, 'service-2',
                                                     api_version=api_version)
        service_model = ServiceModel(json_model, service_name=service_name)
        self._register_retries(service_model)
        return service_model

    def _register_retries(self, service_model):
        endpoint_prefix = service_model.endpoint_prefix

        # First, we load the entire retry config for all services,
        # then pull out just the information we need.
        original_config = self._loader.load_data('_retry')
        if not original_config:
            return

        retry_config = self._retry_config_translator.build_retry_config(
            endpoint_prefix, original_config.get('retry', {}),
            original_config.get('definitions', {}))

        logger.debug("Registering retry handlers for service: %s",
                     service_model.service_name)
        handler = self._retry_handler_factory.create_retry_handler(
            retry_config, endpoint_prefix)
        unique_id = 'retry-config-%s' % endpoint_prefix
        self._event_emitter.register('needs-retry.%s' % endpoint_prefix,
                                     handler, unique_id=unique_id)

    def _register_s3_events(self, client, endpoint_bridge, endpoint_url,
                            client_config, scoped_config):
        if client.meta.service_model.service_name != 's3':
            return
        S3RegionRedirector(endpoint_bridge, client).register()
        self._set_s3_addressing_style(
            endpoint_url, client.meta.config.s3, client.meta.events)
        # Enable accelerate if the configuration is set to to true or the
        # endpoint being used matches one of the accelerate endpoints.
        if self._is_s3_accelerate(endpoint_url, client.meta.config.s3):
            # Also make sure that the hostname gets switched to
            # s3-accelerate.amazonaws.com
            client.meta.events.register_first(
                'request-created.s3', switch_host_s3_accelerate)

        self._set_s3_presign_signature_version(
            client.meta, client_config, scoped_config)

    def _set_s3_addressing_style(self, endpoint_url, s3_config, event_emitter):
        if s3_config is None:
            s3_config = {}

        addressing_style = self._get_s3_addressing_style(
            endpoint_url, s3_config)
        handler = self._get_s3_addressing_handler(
            endpoint_url, s3_config, addressing_style)
        if handler is not None:
            event_emitter.register('before-sign.s3', handler)

    def _get_s3_addressing_style(self, endpoint_url, s3_config):
        # Use virtual host style addressing if accelerate is enabled or if
        # the given endpoint url is an accelerate endpoint.
        accelerate = s3_config.get('use_accelerate_endpoint', False)
        if accelerate or self._is_s3_accelerate(endpoint_url, s3_config):
            return 'virtual'

        # If a particular addressing style is configured, use it.
        configured_addressing_style = s3_config.get('addressing_style')
        if configured_addressing_style:
            return configured_addressing_style

    def _get_s3_addressing_handler(self, endpoint_url, s3_config,
                                   addressing_style):
        # If virtual host style was configured, use it regardless of whether
        # or not the bucket looks dns compatible.
        if addressing_style == 'virtual':
            logger.debug("Using S3 virtual host style addressing.")
            return switch_to_virtual_host_style

        # If path style is configured, no additional steps are needed. If
        # endpoint_url was specified, don't default to virtual. We could
        # potentially default provided endpoint urls to virtual hosted
        # style, but for now it is avoided.
        if addressing_style == 'path' or endpoint_url is not None:
            logger.debug("Using S3 path style addressing.")
            return None

        logger.debug("Defaulting to S3 virtual host style addressing with "
                     "path style addressing fallback.")

        # For dual stack mode, we need to clear the default endpoint url in
        # order to use the existing netloc if the bucket is dns compatible.
        if s3_config.get('use_dualstack_endpoint', False):
            return functools.partial(
                fix_s3_host, default_endpoint_url=None)

        # By default, try to use virtual style with path fallback.
        return fix_s3_host

    def _is_s3_accelerate(self, endpoint_url, s3_config):
        # Accelerate has been explicitly configured.
        if s3_config is not None and s3_config.get('use_accelerate_endpoint'):
            return True

        # Accelerate mode is turned on automatically if an endpoint url is
        # provided that matches the accelerate scheme.
        if endpoint_url is None:
            return False

        # Accelerate is only valid for Amazon endpoints.
        netloc = urlsplit(endpoint_url).netloc
        if not netloc.endswith('amazonaws.com'):
            return False

        # The first part of the url should always be s3-accelerate.
        parts = netloc.split('.')
        if parts[0] != 's3-accelerate':
            return False

        # Url parts between 's3-accelerate' and 'amazonaws.com' which
        # represent different url features.
        feature_parts = parts[1:-2]

        # There should be no duplicate url parts.
        if len(feature_parts) != len(set(feature_parts)):
            return False

        # Remaining parts must all be in the whitelist.
        return all(p in S3_ACCELERATE_WHITELIST for p in feature_parts)

    def _set_s3_presign_signature_version(self, client_meta,
                                          client_config, scoped_config):
        # This will return the manually configured signature version, or None
        # if none was manually set. If a customer manually sets the signature
        # version, we always want to use what they set.
        provided_signature_version = _get_configured_signature_version(
            's3', client_config, scoped_config)
        if provided_signature_version is not None:
            return

        # Check to see if the region is a region that we know about. If we
        # don't know about a region, then we can safely assume it's a new
        # region that is sigv4 only, since all new S3 regions only allow sigv4.
        regions = self._endpoint_resolver.get_available_endpoints(
            's3', client_meta.partition)
        if client_meta.region_name not in regions:
            return

        # If it is a region we know about, we want to default to sigv2, so here
        # we check to see if it is available.
        endpoint = self._endpoint_resolver.construct_endpoint(
            's3', client_meta.region_name)
        signature_versions = endpoint['signatureVersions']
        if 's3' not in signature_versions:
            return

        # We now know that we're in a known region that supports sigv2 and
        # the customer hasn't set a signature version so we default the
        # signature version to sigv2.
        client_meta.events.register(
            'choose-signer.s3', self._default_s3_presign_to_sigv2)

    def _default_s3_presign_to_sigv2(self, signature_version, **kwargs):
        """
        Returns the 's3' (sigv2) signer if presigning an s3 request. This is
        intended to be used to set the default signature version for the signer
        to sigv2.

        :type signature_version: str
        :param signature_version: The current client signature version.

        :type signing_name: str
        :param signing_name: The signing name of the service.

        :return: 's3' if the request is an s3 presign request, None otherwise
        """
        for suffix in ['-query', '-presign-post']:
            if signature_version.endswith(suffix):
                return 's3' + suffix

    def _get_client_args(self, service_model, region_name, is_secure,
                         endpoint_url, verify, credentials,
                         scoped_config, client_config, endpoint_bridge):
        args_creator = ClientArgsCreator(
            self._event_emitter, self._user_agent,
            self._response_parser_factory, self._loader,
            self._exceptions_factory)
        return args_creator.get_client_args(
            service_model, region_name, is_secure, endpoint_url,
            verify, credentials, scoped_config, client_config, endpoint_bridge)

    def _create_methods(self, service_model):
        op_dict = {}
        for operation_name in service_model.operation_names:
            py_operation_name = xform_name(operation_name)
            op_dict[py_operation_name] = self._create_api_method(
                py_operation_name, operation_name, service_model)
        return op_dict

    def _create_name_mapping(self, service_model):
        # py_name -> OperationName, for every operation available
        # for a service.
        mapping = {}
        for operation_name in service_model.operation_names:
            py_operation_name = xform_name(operation_name)
            mapping[py_operation_name] = operation_name
        return mapping

    def _create_api_method(self, py_operation_name, operation_name,
                           service_model):
        def _api_call(self, *args, **kwargs):
            # We're accepting *args so that we can give a more helpful
            # error message than TypeError: _api_call takes exactly
            # 1 argument.
            if args:
                raise TypeError(
                    "%s() only accepts keyword arguments." % py_operation_name)
            # The "self" in this scope is referring to the BaseClient.
            return self._make_api_call(operation_name, kwargs)

        _api_call.__name__ = str(py_operation_name)

        # Add the docstring to the client method
        operation_model = service_model.operation_model(operation_name)
        docstring = ClientMethodDocstring(
            operation_model=operation_model,
            method_name=operation_name,
            event_emitter=self._event_emitter,
            method_description=operation_model.documentation,
            example_prefix='response = client.%s' % py_operation_name,
            include_signature=False
        )
        _api_call.__doc__ = docstring
        return _api_call


class ClientEndpointBridge(object):
    """Bridges endpoint data and client creation

    This class handles taking out the relevant arguments from the endpoint
    resolver and determining which values to use, taking into account any
    client configuration options and scope configuration options.

    This class also handles determining what, if any, region to use if no
    explicit region setting is provided. For example, Amazon S3 client will
    utilize "us-east-1" by default if no region can be resolved."""

    DEFAULT_ENDPOINT = '{service}.{region}.amazonaws.com'

    def __init__(self, endpoint_resolver, scoped_config=None,
                 client_config=None, default_endpoint=None,
                 service_signing_name=None):
        self.service_signing_name = service_signing_name
        self.endpoint_resolver = endpoint_resolver
        self.scoped_config = scoped_config
        self.client_config = client_config
        self.default_endpoint = default_endpoint or self.DEFAULT_ENDPOINT

    def resolve(self, service_name, region_name=None, endpoint_url=None,
                is_secure=True):
        region_name = self._check_default_region(service_name, region_name)
        resolved = self.endpoint_resolver.construct_endpoint(
            service_name, region_name)
        if resolved:
            return self._create_endpoint(
                resolved, service_name, region_name, endpoint_url, is_secure)
        else:
            return self._assume_endpoint(service_name, region_name,
                                         endpoint_url, is_secure)

    def _check_default_region(self, service_name, region_name):
        if region_name is not None:
            return region_name
        # Use the client_config region if no explicit region was provided.
        if self.client_config and self.client_config.region_name is not None:
            return self.client_config.region_name

    def _create_endpoint(self, resolved, service_name, region_name,
                         endpoint_url, is_secure):
        region_name, signing_region = self._pick_region_values(
            resolved, region_name, endpoint_url)
        if endpoint_url is None:
            if self._is_s3_dualstack_mode(service_name):
                endpoint_url = self._create_dualstack_endpoint(
                    service_name, region_name,
                    resolved['dnsSuffix'], is_secure)
            else:
                # Use the sslCommonName over the hostname for Python 2.6 compat.
                hostname = resolved.get('sslCommonName', resolved.get('hostname'))
                endpoint_url = self._make_url(hostname, is_secure,
                                            resolved.get('protocols', []))
        signature_version = self._resolve_signature_version(
            service_name, resolved)
        signing_name = self._resolve_signing_name(service_name, resolved)
        return self._create_result(
            service_name=service_name, region_name=region_name,
            signing_region=signing_region, signing_name=signing_name,
            endpoint_url=endpoint_url, metadata=resolved,
            signature_version=signature_version)

    def _is_s3_dualstack_mode(self, service_name):
        if service_name != 's3':
            return False
        # TODO: This normalization logic is duplicated from the
        # ClientArgsCreator class.  Consolidate everything to
        # ClientArgsCreator.  _resolve_signature_version also has similarly
        # duplicated logic.
        client_config = self.client_config
        if client_config is not None and client_config.s3 is not None and \
                'use_dualstack_endpoint' in client_config.s3:
            # Client config trumps scoped config.
            return client_config.s3['use_dualstack_endpoint']
        if self.scoped_config is None:
            return False
        enabled = self.scoped_config.get('s3', {}).get(
            'use_dualstack_endpoint', False)
        if enabled in [True, 'True', 'true']:
            return True
        return False

    def _create_dualstack_endpoint(self, service_name, region_name,
                                   dns_suffix, is_secure):
        hostname = '{service}.dualstack.{region}.{dns_suffix}'.format(
            service=service_name, region=region_name,
            dns_suffix=dns_suffix)
        # Dualstack supports http and https so were hardcoding this value for
        # now.  This can potentially move into the endpoints.json file.
        return self._make_url(hostname, is_secure, ['http', 'https'])

    def _assume_endpoint(self, service_name, region_name, endpoint_url,
                         is_secure):
        if endpoint_url is None:
            # Expand the default hostname URI template.
            hostname = self.default_endpoint.format(
                service=service_name, region=region_name)
            endpoint_url = self._make_url(hostname, is_secure,
                                          ['http', 'https'])
        logger.debug('Assuming an endpoint for %s, %s: %s',
                     service_name, region_name, endpoint_url)
        # We still want to allow the user to provide an explicit version.
        signature_version = self._resolve_signature_version(
            service_name, {'signatureVersions': ['v4']})
        signing_name = self._resolve_signing_name(service_name, resolved={})
        return self._create_result(
            service_name=service_name, region_name=region_name,
            signing_region=region_name, signing_name=signing_name,
            signature_version=signature_version, endpoint_url=endpoint_url,
            metadata={})

    def _create_result(self, service_name, region_name, signing_region,
                       signing_name, endpoint_url, signature_version,
                       metadata):
        return {
            'service_name': service_name,
            'region_name': region_name,
            'signing_region': signing_region,
            'signing_name': signing_name,
            'endpoint_url': endpoint_url,
            'signature_version': signature_version,
            'metadata': metadata
        }

    def _make_url(self, hostname, is_secure, supported_protocols):
        if is_secure and 'https' in supported_protocols:
            scheme = 'https'
        else:
            scheme = 'http'
        return '%s://%s' % (scheme, hostname)

    def _resolve_signing_name(self, service_name, resolved):
        # CredentialScope overrides everything else.
        if 'credentialScope' in resolved \
                and 'service' in resolved['credentialScope']:
            return resolved['credentialScope']['service']
        # Use the signingName from the model if present.
        if self.service_signing_name:
            return self.service_signing_name
        # Just assume is the same as the service name.
        return service_name

    def _pick_region_values(self, resolved, region_name, endpoint_url):
        signing_region = region_name
        if endpoint_url is None:
            # Do not use the region name or signing name from the resolved
            # endpoint if the user explicitly provides an endpoint_url. This
            # would happen if we resolve to an endpoint where the service has
            # a "defaults" section that overrides all endpoint with a single
            # hostname and credentialScope. This has been the case historically
            # for how STS has worked. The only way to resolve an STS endpoint
            # was to provide a region_name and an endpoint_url. In that case,
            # we would still resolve an endpoint, but we would not use the
            # resolved endpointName or signingRegion because we want to allow
            # custom endpoints.
            region_name = resolved['endpointName']
            signing_region = region_name
            if 'credentialScope' in resolved \
                    and 'region' in resolved['credentialScope']:
                signing_region = resolved['credentialScope']['region']
        return region_name, signing_region

    def _resolve_signature_version(self, service_name, resolved):
        configured_version = _get_configured_signature_version(
            service_name, self.client_config, self.scoped_config)
        if configured_version is not None:
            return configured_version

        # Pick a signature version from the endpoint metadata if present.
        if 'signatureVersions' in resolved:
            potential_versions = resolved['signatureVersions']
            if service_name == 's3':
                return 's3v4'
            if 'v4' in potential_versions:
                return 'v4'
            # Now just iterate over the signature versions in order until we
            # find the first one that is known to Botocore.
            for known in AUTH_TYPE_MAPS:
                if known in potential_versions:
                    return known
        raise UnknownSignatureVersionError(
            signature_version=resolved.get('signatureVersions'))


class BaseClient(object):

    # This is actually reassigned with the py->op_name mapping
    # when the client creator creates the subclass.  This value is used
    # because calls such as client.get_paginator('list_objects') use the
    # snake_case name, but we need to know the ListObjects form.
    # xform_name() does the ListObjects->list_objects conversion, but
    # we need the reverse mapping here.
    _PY_TO_OP_NAME = {}

    def __init__(self, serializer, endpoint, response_parser,
                 event_emitter, request_signer, service_model, loader,
                 client_config, partition, exceptions_factory):
        self._serializer = serializer
        self._endpoint = endpoint
        self._response_parser = response_parser
        self._request_signer = request_signer
        self._cache = {}
        self._loader = loader
        self._client_config = client_config
        self.meta = ClientMeta(event_emitter, self._client_config,
                               endpoint.host, service_model,
                               self._PY_TO_OP_NAME, partition)
        self._exceptions_factory = exceptions_factory
        self._exceptions = None
        self._register_handlers()

    def __getattr__(self, item):
        event_name = 'getattr.%s.%s' % (self._service_model.service_name, item)
        handler, event_response = self.meta.events.emit_until_response(
            event_name, client=self)

        if event_response is not None:
            return event_response

        raise AttributeError(
            "'%s' object has no attribute '%s'" % (
                self.__class__.__name__, item)
        )

    def _register_handlers(self):
        # Register the handler required to sign requests.
        self.meta.events.register('request-created.%s' %
                                  self.meta.service_model.endpoint_prefix,
                                  self._request_signer.handler)

    @property
    def _service_model(self):
        return self.meta.service_model

    def _make_api_call(self, operation_name, api_params):
        operation_model = self._service_model.operation_model(operation_name)
        request_context = {
            'client_region': self.meta.region_name,
            'client_config': self.meta.config,
            'has_streaming_input': operation_model.has_streaming_input,
            'auth_type': operation_model.auth_type,
        }
        request_dict = self._convert_to_request_dict(
            api_params, operation_model, context=request_context)

        handler, event_response = self.meta.events.emit_until_response(
            'before-call.{endpoint_prefix}.{operation_name}'.format(
                endpoint_prefix=self._service_model.endpoint_prefix,
                operation_name=operation_name),
            model=operation_model, params=request_dict,
            request_signer=self._request_signer, context=request_context)

        if event_response is not None:
            http, parsed_response = event_response
        else:
            http, parsed_response = self._endpoint.make_request(
                operation_model, request_dict)

        self.meta.events.emit(
            'after-call.{endpoint_prefix}.{operation_name}'.format(
                endpoint_prefix=self._service_model.endpoint_prefix,
                operation_name=operation_name),
            http_response=http, parsed=parsed_response,
            model=operation_model, context=request_context
        )

        if http.status_code >= 300:
            error_code = parsed_response.get("Error", {}).get("Code")
            error_class = self.exceptions.from_code(error_code)
            raise error_class(parsed_response, operation_name)
        else:
            return parsed_response

    def _convert_to_request_dict(self, api_params, operation_model,
                                 context=None):
        # Given the API params provided by the user and the operation_model
        # we can serialize the request to a request_dict.
        operation_name = operation_model.name

        # Emit an event that allows users to modify the parameters at the
        # beginning of the method. It allows handlers to modify existing
        # parameters or return a new set of parameters to use.
        responses = self.meta.events.emit(
            'provide-client-params.{endpoint_prefix}.{operation_name}'.format(
                endpoint_prefix=self._service_model.endpoint_prefix,
                operation_name=operation_name),
            params=api_params, model=operation_model, context=context)
        api_params = first_non_none_response(responses, default=api_params)

        event_name = (
            'before-parameter-build.{endpoint_prefix}.{operation_name}')
        self.meta.events.emit(
            event_name.format(
                endpoint_prefix=self._service_model.endpoint_prefix,
                operation_name=operation_name),
            params=api_params, model=operation_model, context=context)

        request_dict = self._serializer.serialize_to_request(
            api_params, operation_model)
        prepare_request_dict(request_dict, endpoint_url=self._endpoint.host,
                             user_agent=self._client_config.user_agent,
                             context=context)
        return request_dict

    def get_paginator(self, operation_name):
        """Create a paginator for an operation.

        :type operation_name: string
        :param operation_name: The operation name.  This is the same name
            as the method name on the client.  For example, if the
            method name is ``create_foo``, and you'd normally invoke the
            operation as ``client.create_foo(**kwargs)``, if the
            ``create_foo`` operation can be paginated, you can use the
            call ``client.get_paginator("create_foo")``.

        :raise OperationNotPageableError: Raised if the operation is not
            pageable.  You can use the ``client.can_paginate`` method to
            check if an operation is pageable.

        :rtype: L{botocore.paginate.Paginator}
        :return: A paginator object.

        """
        if not self.can_paginate(operation_name):
            raise OperationNotPageableError(operation_name=operation_name)
        else:
            actual_operation_name = self._PY_TO_OP_NAME[operation_name]

            # Create a new paginate method that will serve as a proxy to
            # the underlying Paginator.paginate method. This is needed to
            # attach a docstring to the method.
            def paginate(self, **kwargs):
                return Paginator.paginate(self, **kwargs)

            paginator_config = self._cache['page_config'][
                actual_operation_name]
            # Add the docstring for the paginate method.
            paginate.__doc__ = PaginatorDocstring(
                paginator_name=actual_operation_name,
                event_emitter=self.meta.events,
                service_model=self.meta.service_model,
                paginator_config=paginator_config,
                include_signature=False
            )

            # Rename the paginator class based on the type of paginator.
            paginator_class_name = str('%s.Paginator.%s' % (
                get_service_module_name(self.meta.service_model),
                actual_operation_name))

            # Create the new paginator class
            documented_paginator_cls = type(
                paginator_class_name, (Paginator,), {'paginate': paginate})

            paginator = documented_paginator_cls(
                getattr(self, operation_name),
                paginator_config)
            return paginator

    def can_paginate(self, operation_name):
        """Check if an operation can be paginated.

        :type operation_name: string
        :param operation_name: The operation name.  This is the same name
            as the method name on the client.  For example, if the
            method name is ``create_foo``, and you'd normally invoke the
            operation as ``client.create_foo(**kwargs)``, if the
            ``create_foo`` operation can be paginated, you can use the
            call ``client.get_paginator("create_foo")``.

        :return: ``True`` if the operation can be paginated,
            ``False`` otherwise.

        """
        if 'page_config' not in self._cache:
            try:
                page_config = self._loader.load_service_model(
                    self._service_model.service_name,
                    'paginators-1',
                    self._service_model.api_version)['pagination']
                self._cache['page_config'] = page_config
            except DataNotFoundError:
                self._cache['page_config'] = {}
        actual_operation_name = self._PY_TO_OP_NAME[operation_name]
        return actual_operation_name in self._cache['page_config']

    def _get_waiter_config(self):
        if 'waiter_config' not in self._cache:
            try:
                waiter_config = self._loader.load_service_model(
                    self._service_model.service_name,
                    'waiters-2',
                    self._service_model.api_version)
                self._cache['waiter_config'] = waiter_config
            except DataNotFoundError:
                self._cache['waiter_config'] = {}
        return self._cache['waiter_config']

    def get_waiter(self, waiter_name):
        config = self._get_waiter_config()
        if not config:
            raise ValueError("Waiter does not exist: %s" % waiter_name)
        model = waiter.WaiterModel(config)
        mapping = {}
        for name in model.waiter_names:
            mapping[xform_name(name)] = name
        if waiter_name not in mapping:
            raise ValueError("Waiter does not exist: %s" % waiter_name)

        return waiter.create_waiter_with_client(
            mapping[waiter_name], model, self)

    @CachedProperty
    def waiter_names(self):
        """Returns a list of all available waiters."""
        config = self._get_waiter_config()
        if not config:
            return []
        model = waiter.WaiterModel(config)
        # Waiter configs is a dict, we just want the waiter names
        # which are the keys in the dict.
        return [xform_name(name) for name in model.waiter_names]

    @property
    def exceptions(self):
        if self._exceptions is None:
            self._exceptions = self._load_exceptions()
        return self._exceptions

    def _load_exceptions(self):
        return self._exceptions_factory.create_client_exceptions(
            self._service_model)


class ClientMeta(object):
    """Holds additional client methods.

    This class holds additional information for clients.  It exists for
    two reasons:

        * To give advanced functionality to clients
        * To namespace additional client attributes from the operation
          names which are mapped to methods at runtime.  This avoids
          ever running into collisions with operation names.

    """

    def __init__(self, events, client_config, endpoint_url, service_model,
                 method_to_api_mapping, partition):
        self.events = events
        self._client_config = client_config
        self._endpoint_url = endpoint_url
        self._service_model = service_model
        self._method_to_api_mapping = method_to_api_mapping
        self._partition = partition

    @property
    def service_model(self):
        return self._service_model

    @property
    def region_name(self):
        return self._client_config.region_name

    @property
    def endpoint_url(self):
        return self._endpoint_url

    @property
    def config(self):
        return self._client_config

    @property
    def method_to_api_mapping(self):
        return self._method_to_api_mapping

    @property
    def partition(self):
        return self._partition


def _get_configured_signature_version(service_name, client_config,
                                      scoped_config):
    """
    Gets the manually configured signature version.

    :returns: the customer configured signature version, or None if no
        signature version was configured.
    """
    # Client config overrides everything.
    if client_config and client_config.signature_version is not None:
        return client_config.signature_version

    # Scoped config overrides picking from the endpoint metadata.
    if scoped_config is not None:
        # A given service may have service specific configuration in the
        # config file, so we need to check there as well.
        service_config = scoped_config.get(service_name)
        if service_config is not None and isinstance(service_config, dict):
            version = service_config.get('signature_version')
            if version:
                logger.debug(
                    "Switching signature version for service %s "
                    "to version %s based on config file override.",
                    service_name, version)
                return version
    return None
