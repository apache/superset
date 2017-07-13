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

"""Builtin event handlers.

This module contains builtin handlers for events emitted by botocore.
"""

import base64
import logging
import xml.etree.cElementTree
import copy
import re
import warnings
import uuid

from botocore.compat import unquote, json, six, unquote_str, \
    ensure_bytes, get_md5, MD5_AVAILABLE
from botocore.docs.utils import AutoPopulatedParam
from botocore.docs.utils import HideParamFromOperations
from botocore.docs.utils import AppendParamDocumentation
from botocore.signers import add_generate_presigned_url
from botocore.signers import add_generate_presigned_post
from botocore.signers import add_generate_db_auth_token
from botocore.exceptions import ParamValidationError
from botocore.exceptions import AliasConflictParameterError
from botocore.exceptions import UnsupportedTLSVersionWarning
from botocore.utils import percent_encode, SAFE_CHARS
from botocore.utils import switch_host_with_param

from botocore import retryhandler
from botocore import utils
from botocore import translate
import botocore
import botocore.auth


logger = logging.getLogger(__name__)

REGISTER_FIRST = object()
REGISTER_LAST = object()
# From the S3 docs:
# The rules for bucket names in the US Standard region allow bucket names
# to be as long as 255 characters, and bucket names can contain any
# combination of uppercase letters, lowercase letters, numbers, periods
# (.), hyphens (-), and underscores (_).
VALID_BUCKET = re.compile('^[a-zA-Z0-9.\-_]{1,255}$')
VERSION_ID_SUFFIX = re.compile(r'\?versionId=[^\s]+$')


def check_for_200_error(response, **kwargs):
    # From: http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectCOPY.html
    # There are two opportunities for a copy request to return an error. One
    # can occur when Amazon S3 receives the copy request and the other can
    # occur while Amazon S3 is copying the files. If the error occurs before
    # the copy operation starts, you receive a standard Amazon S3 error. If the
    # error occurs during the copy operation, the error response is embedded in
    # the 200 OK response. This means that a 200 OK response can contain either
    # a success or an error. Make sure to design your application to parse the
    # contents of the response and handle it appropriately.
    #
    # So this handler checks for this case.  Even though the server sends a
    # 200 response, conceptually this should be handled exactly like a
    # 500 response (with respect to raising exceptions, retries, etc.)
    # We're connected *before* all the other retry logic handlers, so as long
    # as we switch the error code to 500, we'll retry the error as expected.
    if response is None:
        # A None response can happen if an exception is raised while
        # trying to retrieve the response.  See Endpoint._get_response().
        return
    http_response, parsed = response
    if _looks_like_special_case_error(http_response):
        logger.debug("Error found for response with 200 status code, "
                     "errors: %s, changing status code to "
                     "500.", parsed)
        http_response.status_code = 500


def _looks_like_special_case_error(http_response):
    if http_response.status_code == 200:
        parser = xml.etree.cElementTree.XMLParser(
            target=xml.etree.cElementTree.TreeBuilder(),
            encoding='utf-8')
        parser.feed(http_response.content)
        root = parser.close()
        if root.tag == 'Error':
            return True
    return False


def set_operation_specific_signer(context, signing_name, **kwargs):
    """ Choose the operation-specific signer.

    Individual operations may have a different auth type than the service as a
    whole. This will most often manifest as operations that should not be
    authenticated at all, but can include other auth modes such as sigv4
    without body signing.
    """
    auth_type = context.get('auth_type')

    # Auth type will be None if the operation doesn't have a configured auth
    # type.
    if not auth_type:
        return

    # Auth type will be the string value 'none' if the operation should not
    # be signed at all.
    if auth_type == 'none':
        return botocore.UNSIGNED

    if auth_type.startswith('v4'):
        signature_version = 'v4'
        if signing_name == 's3':
            signature_version = 's3v4'

        # If the operation needs an unsigned body, we set additional context
        # allowing the signer to be aware of this.
        if auth_type == 'v4-unsigned-body':
            context['payload_signing_enabled'] = False

        return signature_version


def decode_console_output(parsed, **kwargs):
    if 'Output' in parsed:
        try:
            # We're using 'replace' for errors because it is
            # possible that console output contains non string
            # chars we can't utf-8 decode.
            value = base64.b64decode(six.b(parsed['Output'])).decode(
                'utf-8', 'replace')
            parsed['Output'] = value
        except (ValueError, TypeError, AttributeError):
            logger.debug('Error decoding base64', exc_info=True)


def generate_idempotent_uuid(params, model, **kwargs):
    for name in model.idempotent_members:
        if name not in params:
            params[name] = str(uuid.uuid4())
            logger.debug("injecting idempotency token (%s) into param '%s'." %
                         (params[name], name))


def decode_quoted_jsondoc(value):
    try:
        value = json.loads(unquote(value))
    except (ValueError, TypeError):
        logger.debug('Error loading quoted JSON', exc_info=True)
    return value


def json_decode_template_body(parsed, **kwargs):
    if 'TemplateBody' in parsed:
        try:
            value = json.loads(parsed['TemplateBody'])
            parsed['TemplateBody'] = value
        except (ValueError, TypeError):
            logger.debug('error loading JSON', exc_info=True)


def calculate_md5(params, **kwargs):
    request_dict = params
    if request_dict['body'] and 'Content-MD5' not in params['headers']:
        body = request_dict['body']
        if isinstance(body, (bytes, bytearray)):
            binary_md5 = _calculate_md5_from_bytes(body)
        else:
            binary_md5 = _calculate_md5_from_file(body)
        base64_md5 = base64.b64encode(binary_md5).decode('ascii')
        params['headers']['Content-MD5'] = base64_md5


def _calculate_md5_from_bytes(body_bytes):
    md5 = get_md5(body_bytes)
    return md5.digest()


def _calculate_md5_from_file(fileobj):
    start_position = fileobj.tell()
    md5 = get_md5()
    for chunk in iter(lambda: fileobj.read(1024 * 1024), b''):
        md5.update(chunk)
    fileobj.seek(start_position)
    return md5.digest()


def conditionally_calculate_md5(params, context, request_signer, **kwargs):
    """Only add a Content-MD5 if the system supports it."""
    if MD5_AVAILABLE:
        calculate_md5(params, **kwargs)


def validate_bucket_name(params, **kwargs):
    if 'Bucket' not in params:
        return
    bucket = params['Bucket']
    if VALID_BUCKET.search(bucket) is None:
        error_msg = (
            'Invalid bucket name "%s": Bucket name must match '
            'the regex "%s"' % (bucket, VALID_BUCKET.pattern))
        raise ParamValidationError(report=error_msg)


def sse_md5(params, **kwargs):
    """
    S3 server-side encryption requires the encryption key to be sent to the
    server base64 encoded, as well as a base64-encoded MD5 hash of the
    encryption key. This handler does both if the MD5 has not been set by
    the caller.
    """
    _sse_md5(params, 'SSECustomer')


def copy_source_sse_md5(params, **kwargs):
    """
    S3 server-side encryption requires the encryption key to be sent to the
    server base64 encoded, as well as a base64-encoded MD5 hash of the
    encryption key. This handler does both if the MD5 has not been set by
    the caller specifically if the parameter is for the copy-source sse-c key.
    """
    _sse_md5(params, 'CopySourceSSECustomer')


def _sse_md5(params, sse_member_prefix='SSECustomer'):
    if not _needs_s3_sse_customization(params, sse_member_prefix):
        return

    sse_key_member = sse_member_prefix + 'Key'
    sse_md5_member = sse_member_prefix + 'KeyMD5'
    key_as_bytes = params[sse_key_member]
    if isinstance(key_as_bytes, six.text_type):
        key_as_bytes = key_as_bytes.encode('utf-8')
    key_md5_str = base64.b64encode(
        get_md5(key_as_bytes).digest()).decode('utf-8')
    key_b64_encoded = base64.b64encode(key_as_bytes).decode('utf-8')
    params[sse_key_member] = key_b64_encoded
    params[sse_md5_member] = key_md5_str


def _needs_s3_sse_customization(params, sse_member_prefix):
    return (params.get(sse_member_prefix + 'Key') is not None and
            sse_member_prefix + 'KeyMD5' not in params)


def register_retries_for_service(service_data, session,
                                 service_name, **kwargs):
    loader = session.get_component('data_loader')
    endpoint_prefix = service_data.get('metadata', {}).get('endpointPrefix')
    if endpoint_prefix is None:
        logger.debug("Not registering retry handlers, could not endpoint "
                     "prefix from model for service %s", service_name)
        return
    config = _load_retry_config(loader, endpoint_prefix)
    if not config:
        return
    logger.debug("Registering retry handlers for service: %s", service_name)
    handler = retryhandler.create_retry_handler(
        config, endpoint_prefix)
    unique_id = 'retry-config-%s' % endpoint_prefix
    session.register('needs-retry.%s' % endpoint_prefix,
                     handler, unique_id=unique_id)
    _register_for_operations(config, session,
                             service_name=endpoint_prefix)


def _load_retry_config(loader, endpoint_prefix):
    original_config = loader.load_data('_retry')
    retry_config = translate.build_retry_config(
        endpoint_prefix, original_config['retry'],
        original_config.get('definitions', {}))
    return retry_config


def _register_for_operations(config, session, service_name):
    # There's certainly a tradeoff for registering the retry config
    # for the operations when the service is created.  In practice,
    # there aren't a whole lot of per operation retry configs so
    # this is ok for now.
    for key in config:
        if key == '__default__':
            continue
        handler = retryhandler.create_retry_handler(config, key)
        unique_id = 'retry-config-%s-%s' % (service_name, key)
        session.register('needs-retry.%s.%s' % (service_name, key),
                         handler, unique_id=unique_id)


def disable_signing(**kwargs):
    """
    This handler disables request signing by setting the signer
    name to a special sentinel value.
    """
    return botocore.UNSIGNED


def add_expect_header(model, params, **kwargs):
    if model.http.get('method', '') not in ['PUT', 'POST']:
        return
    if 'body' in params:
        body = params['body']
        if hasattr(body, 'read'):
            # Any file like object will use an expect 100-continue
            # header regardless of size.
            logger.debug("Adding expect 100 continue header to request.")
            params['headers']['Expect'] = '100-continue'


def document_copy_source_form(section, event_name, **kwargs):
    if 'request-example' in event_name:
        parent = section.get_section('structure-value')
        param_line = parent.get_section('CopySource')
        value_portion = param_line.get_section('member-value')
        value_portion.clear_text()
        value_portion.write("'string' or {'Bucket': 'string', "
                            "'Key': 'string', 'VersionId': 'string'}")
    elif 'request-params' in event_name:
        param_section = section.get_section('CopySource')
        type_section = param_section.get_section('param-type')
        type_section.clear_text()
        type_section.write(':type CopySource: str or dict')
        doc_section = param_section.get_section('param-documentation')
        doc_section.clear_text()
        doc_section.write(
            "The name of the source bucket, key name of the source object, "
            "and optional version ID of the source object.  You can either "
            "provide this value as a string or a dictionary.  The "
            "string form is {bucket}/{key} or "
            "{bucket}/{key}?versionId={versionId} if you want to copy a "
            "specific version.  You can also provide this value as a "
            "dictionary.  The dictionary format is recommended over "
            "the string format because it is more explicit.  The dictionary "
            "format is: {'Bucket': 'bucket', 'Key': 'key', 'VersionId': 'id'}."
            "  Note that the VersionId key is optional and may be omitted."
        )


def handle_copy_source_param(params, **kwargs):
    """Convert CopySource param for CopyObject/UploadPartCopy.

    This handler will deal with two cases:

        * CopySource provided as a string.  We'll make a best effort
          to URL encode the key name as required.  This will require
          parsing the bucket and version id from the CopySource value
          and only encoding the key.
        * CopySource provided as a dict.  In this case we're
          explicitly given the Bucket, Key, and VersionId so we're
          able to encode the key and ensure this value is serialized
          and correctly sent to S3.

    """
    source = params.get('CopySource')
    if source is None:
        # The call will eventually fail but we'll let the
        # param validator take care of this.  It will
        # give a better error message.
        return
    if isinstance(source, six.string_types):
        params['CopySource'] = _quote_source_header(source)
    elif isinstance(source, dict):
        params['CopySource'] = _quote_source_header_from_dict(source)


def _quote_source_header_from_dict(source_dict):
    try:
        bucket = source_dict['Bucket']
        key = percent_encode(source_dict['Key'], safe=SAFE_CHARS + '/')
        version_id = source_dict.get('VersionId')
    except KeyError as e:
        raise ParamValidationError(
            report='Missing required parameter: %s' % str(e))
    final = '%s/%s' % (bucket, key)
    if version_id is not None:
        final += '?versionId=%s' % version_id
    return final


def _quote_source_header(value):
    result = VERSION_ID_SUFFIX.search(value)
    if result is None:
        return percent_encode(value, safe=SAFE_CHARS + '/')
    else:
        first, version_id = value[:result.start()], value[result.start():]
        return percent_encode(first, safe=SAFE_CHARS + '/') + version_id


def _get_cross_region_presigned_url(request_signer, request_dict, model,
                                    source_region, destination_region):
    # The better way to do this is to actually get the
    # endpoint_resolver and get the endpoint_url given the
    # source region.  In this specific case, we know that
    # we can safely replace the dest region with the source
    # region because of the supported EC2 regions, but in
    # general this is not a safe assumption to make.
    # I think eventually we should try to plumb through something
    # that allows us to resolve endpoints from regions.
    request_dict_copy = copy.deepcopy(request_dict)
    request_dict_copy['body']['DestinationRegion'] = destination_region
    request_dict_copy['url'] = request_dict['url'].replace(
        destination_region, source_region)
    request_dict_copy['method'] = 'GET'
    request_dict_copy['headers'] = {}
    return request_signer.generate_presigned_url(
        request_dict_copy, region_name=source_region,
        operation_name=model.name)


def _get_presigned_url_source_and_destination_regions(request_signer, params):
    # Gets the source and destination regions to be used
    destination_region = request_signer._region_name
    source_region = params.get('SourceRegion')
    return source_region, destination_region


def inject_presigned_url_ec2(params, request_signer, model, **kwargs):
    # The customer can still provide this, so we should pass if they do.
    if 'PresignedUrl' in params['body']:
        return
    src, dest = _get_presigned_url_source_and_destination_regions(
        request_signer, params['body'])
    url = _get_cross_region_presigned_url(
        request_signer, params, model, src, dest)
    params['body']['PresignedUrl'] = url
    # EC2 Requires that the destination region be sent over the wire in
    # addition to the source region.
    params['body']['DestinationRegion'] = dest


def inject_presigned_url_rds(params, request_signer, model, **kwargs):
    # SourceRegion is not required for RDS operations, so it's possible that
    # it isn't set. In that case it's probably a local copy so we don't need
    # to do anything else.
    if 'SourceRegion' not in params['body']:
        return

    src, dest = _get_presigned_url_source_and_destination_regions(
        request_signer, params['body'])

    # Since SourceRegion isn't actually modeled for RDS, it needs to be
    # removed from the request params before we send the actual request.
    del params['body']['SourceRegion']

    if 'PreSignedUrl' in params['body']:
        return

    url = _get_cross_region_presigned_url(
        request_signer, params, model, src, dest)
    params['body']['PreSignedUrl'] = url


def json_decode_policies(parsed, model, **kwargs):
    # Any time an IAM operation returns a policy document
    # it is a string that is json that has been urlencoded,
    # i.e urlencode(json.dumps(policy_document)).
    # To give users something more useful, we will urldecode
    # this value and json.loads() the result so that they have
    # the policy document as a dictionary.
    output_shape = model.output_shape
    if output_shape is not None:
        _decode_policy_types(parsed, model.output_shape)


def _decode_policy_types(parsed, shape):
    # IAM consistently uses the policyDocumentType shape to indicate
    # strings that have policy documents.
    shape_name = 'policyDocumentType'
    if shape.type_name == 'structure':
        for member_name, member_shape in shape.members.items():
            if member_shape.type_name == 'string' and \
                    member_shape.name == shape_name and \
                    member_name in parsed:
                parsed[member_name] = decode_quoted_jsondoc(
                    parsed[member_name])
            elif member_name in parsed:
                _decode_policy_types(parsed[member_name], member_shape)
    if shape.type_name == 'list':
        shape_member = shape.member
        for item in parsed:
            _decode_policy_types(item, shape_member)


def parse_get_bucket_location(parsed, http_response, **kwargs):
    # s3.GetBucketLocation cannot be modeled properly.  To
    # account for this we just manually parse the XML document.
    # The "parsed" passed in only has the ResponseMetadata
    # filled out.  This handler will fill in the LocationConstraint
    # value.
    if 'LocationConstraint' in parsed:
        # Response already set - a stub?
        return
    response_body = http_response.content
    parser = xml.etree.cElementTree.XMLParser(
        target=xml.etree.cElementTree.TreeBuilder(),
        encoding='utf-8')
    parser.feed(response_body)
    root = parser.close()
    region = root.text
    parsed['LocationConstraint'] = region


def base64_encode_user_data(params, **kwargs):
    if 'UserData' in params:
        if isinstance(params['UserData'], six.text_type):
            # Encode it to bytes if it is text.
            params['UserData'] = params['UserData'].encode('utf-8')
        params['UserData'] = base64.b64encode(
            params['UserData']).decode('utf-8')


def document_base64_encoding(param):
    description = ('**This value will be base64 encoded automatically. Do '
                   'not base64 encode this value prior to performing the '
                   'operation.**')
    append = AppendParamDocumentation(param, description)
    return append.append_documentation


def validate_ascii_metadata(params, **kwargs):
    """Verify S3 Metadata only contains ascii characters.

    From: http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html

    "Amazon S3 stores user-defined metadata in lowercase. Each name, value pair
    must conform to US-ASCII when using REST and UTF-8 when using SOAP or
    browser-based uploads via POST."

    """
    metadata = params.get('Metadata')
    if not metadata or not isinstance(metadata, dict):
        # We have to at least type check the metadata as a dict type
        # because this handler is called before param validation.
        # We'll go ahead and return because the param validator will
        # give a descriptive error message for us.
        # We might need a post-param validation event.
        return
    for key, value in metadata.items():
        try:
            key.encode('ascii')
            value.encode('ascii')
        except UnicodeEncodeError as e:
            error_msg = (
                'Non ascii characters found in S3 metadata '
                'for key "%s", value: "%s".  \nS3 metadata can only '
                'contain ASCII characters. ' % (key, value)
            )
            raise ParamValidationError(
                report=error_msg)


def fix_route53_ids(params, model, **kwargs):
    """
    Check for and split apart Route53 resource IDs, setting
    only the last piece. This allows the output of one operation
    (e.g. ``'foo/1234'``) to be used as input in another
    operation (e.g. it expects just ``'1234'``).
    """
    input_shape = model.input_shape
    if not input_shape or not hasattr(input_shape, 'members'):
        return

    members = [name for (name, shape) in input_shape.members.items()
               if shape.name in ['ResourceId', 'DelegationSetId']]

    for name in members:
        if name in params:
            orig_value = params[name]
            params[name] = orig_value.split('/')[-1]
            logger.debug('%s %s -> %s', name, orig_value, params[name])


def inject_account_id(params, **kwargs):
    if params.get('accountId') is None:
        # Glacier requires accountId, but allows you
        # to specify '-' for the current owners account.
        # We add this default value if the user does not
        # provide the accountId as a convenience.
        params['accountId'] = '-'


def add_glacier_version(model, params, **kwargs):
    request_dict = params
    request_dict['headers']['x-amz-glacier-version'] = model.metadata[
        'apiVersion']


def add_accept_header(model, params, **kwargs):
    if params['headers'].get('Accept', None) is None:
        request_dict = params
        request_dict['headers']['Accept'] = 'application/json'


def add_glacier_checksums(params, **kwargs):
    """Add glacier checksums to the http request.

    This will add two headers to the http request:

        * x-amz-content-sha256
        * x-amz-sha256-tree-hash

    These values will only be added if they are not present
    in the HTTP request.

    """
    request_dict = params
    headers = request_dict['headers']
    body = request_dict['body']
    if isinstance(body, six.binary_type):
        # If the user provided a bytes type instead of a file
        # like object, we're temporarily create a BytesIO object
        # so we can use the util functions to calculate the
        # checksums which assume file like objects.  Note that
        # we're not actually changing the body in the request_dict.
        body = six.BytesIO(body)
    starting_position = body.tell()
    if 'x-amz-content-sha256' not in headers:
        headers['x-amz-content-sha256'] = utils.calculate_sha256(
            body, as_hex=True)
    body.seek(starting_position)
    if 'x-amz-sha256-tree-hash' not in headers:
        headers['x-amz-sha256-tree-hash'] = utils.calculate_tree_hash(body)
    body.seek(starting_position)


def document_glacier_tree_hash_checksum():
    doc = '''
        This is a required field.

        Ideally you will want to compute this value with checksums from
        previous uploaded parts, using the algorithm described in
        `Glacier documentation <http://docs.aws.amazon.com/amazonglacier/latest/dev/checksum-calculations.html>`_.

        But if you prefer, you can also use botocore.utils.calculate_tree_hash()
        to compute it from raw file by::

            checksum = calculate_tree_hash(open('your_file.txt', 'rb'))

        '''
    return AppendParamDocumentation('checksum', doc).append_documentation


def document_cloudformation_get_template_return_type(section, event_name, **kwargs):
    if 'response-params' in event_name:
        template_body_section = section.get_section('TemplateBody')
        type_section = template_body_section.get_section('param-type')
        type_section.clear_text()
        type_section.write('(*dict*) --')
    elif 'response-example' in event_name:
        parent = section.get_section('structure-value')
        param_line = parent.get_section('TemplateBody')
        value_portion = param_line.get_section('member-value')
        value_portion.clear_text()
        value_portion.write('{}')


def switch_host_machinelearning(request, **kwargs):
    switch_host_with_param(request, 'PredictEndpoint')


def check_openssl_supports_tls_version_1_2(**kwargs):
    import ssl
    try:
        openssl_version_tuple = ssl.OPENSSL_VERSION_INFO
        if openssl_version_tuple[0] < 1 or openssl_version_tuple[2] < 1:
            warnings.warn(
                'Currently installed openssl version: %s does not '
                'support TLS 1.2, which is required for use of iot-data. '
                'Please use python installed with openssl version 1.0.1 or '
                'higher.' % (ssl.OPENSSL_VERSION),
                UnsupportedTLSVersionWarning
            )
    # We cannot check the openssl version on python2.6, so we should just
    # pass on this conveniency check.
    except AttributeError:
        pass


def change_get_to_post(request, **kwargs):
    # This is useful when we need to change a potentially large GET request
    # into a POST with x-www-form-urlencoded encoding.
    if request.method == 'GET' and '?' in request.url:
        request.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        request.method = 'POST'
        request.url, request.data = request.url.split('?', 1)


def set_list_objects_encoding_type_url(params, context, **kwargs):
    if 'EncodingType' not in params:
        # We set this context so that we know it wasn't the customer that
        # requested the encoding.
        context['encoding_type_auto_set'] = True
        params['EncodingType'] = 'url'


def decode_list_object(parsed, context, **kwargs):
    # This is needed because we are passing url as the encoding type. Since the
    # paginator is based on the key, we need to handle it before it can be
    # round tripped.
    #
    # From the documentation: If you specify encoding-type request parameter,
    # Amazon S3 includes this element in the response, and returns encoded key
    # name values in the following response elements:
    # Delimiter, Marker, Prefix, NextMarker, Key.
    if parsed.get('EncodingType') == 'url' and \
                    context.get('encoding_type_auto_set'):
        # URL decode top-level keys in the response if present.
        top_level_keys = ['Delimiter', 'Marker', 'NextMarker']
        for key in top_level_keys:
            if key in parsed:
                parsed[key] = unquote_str(parsed[key])
        # URL decode nested keys from the response if present.
        nested_keys = [('Contents', 'Key'), ('CommonPrefixes', 'Prefix')]
        for (top_key, child_key) in nested_keys:
            if top_key in parsed:
                for member in parsed[top_key]:
                    member[child_key] = unquote_str(member[child_key])


def convert_body_to_file_like_object(params, **kwargs):
    if 'Body' in params:
        if isinstance(params['Body'], six.string_types):
            params['Body'] = six.BytesIO(ensure_bytes(params['Body']))
        elif isinstance(params['Body'], six.binary_type):
            params['Body'] = six.BytesIO(params['Body'])


def _add_parameter_aliases(handler_list):
    # Mapping of original parameter to parameter alias.
    # The key is <service>.<operation>.parameter
    # The first part of the key is used for event registration.
    # The last part is the original parameter name and the value is the
    # alias to expose in documentation.
    aliases = {
        'ec2.*.Filter': 'Filters',
        'logs.CreateExportTask.from': 'fromTime',
        'cloudsearchdomain.Search.return': 'returnFields'
    }

    for original, new_name in aliases.items():
        event_portion, original_name = original.rsplit('.', 1)
        parameter_alias = ParameterAlias(original_name, new_name)

        # Add the handlers to the list of handlers.
        # One handler is to handle when users provide the alias.
        # The other handler is to update the documentation to show only
        # the alias.
        parameter_build_event_handler_tuple = (
            'before-parameter-build.' + event_portion,
            parameter_alias.alias_parameter_in_call,
            REGISTER_FIRST
        )
        docs_event_handler_tuple = (
            'docs.*.' + event_portion + '.complete-section',
            parameter_alias.alias_parameter_in_documentation)
        handler_list.append(parameter_build_event_handler_tuple)
        handler_list.append(docs_event_handler_tuple)


class ParameterAlias(object):
    def __init__(self, original_name, alias_name):
        self._original_name = original_name
        self._alias_name = alias_name

    def alias_parameter_in_call(self, params, model, **kwargs):
        if model.input_shape:
            # Only consider accepting the alias if it is modeled in the
            # input shape.
            if self._original_name in model.input_shape.members:
                if self._alias_name in params:
                    if self._original_name in params:
                        raise AliasConflictParameterError(
                            original=self._original_name,
                            alias=self._alias_name,
                            operation=model.name
                        )
                    # Remove the alias parameter value and use the old name
                    # instead.
                    params[self._original_name] = params.pop(self._alias_name)

    def alias_parameter_in_documentation(self, event_name, section, **kwargs):
        if event_name.startswith('docs.request-params'):
            if self._original_name not in section.available_sections:
                return
            # Replace the name for parameter type
            param_section = section.get_section(self._original_name)
            param_type_section = param_section.get_section('param-type')
            self._replace_content(param_type_section)

            # Replace the name for the parameter description
            param_name_section = param_section.get_section('param-name')
            self._replace_content(param_name_section)
        elif event_name.startswith('docs.request-example'):
            section = section.get_section('structure-value')
            if self._original_name not in section.available_sections:
                return
            # Replace the name for the example
            param_section = section.get_section(self._original_name)
            self._replace_content(param_section)

    def _replace_content(self, section):
        content = section.getvalue().decode('utf-8')
        updated_content = content.replace(
            self._original_name, self._alias_name)
        section.clear_text()
        section.write(updated_content)


class ClientMethodAlias(object):
    def __init__(self, actual_name):
        """ Aliases a non-extant method to an existing method.

        :param actual_name: The name of the method that actually exists on
            the client.
        """
        self._actual = actual_name

    def __call__(self, client, **kwargs):
        return getattr(client, self._actual)

# This is a list of (event_name, handler).
# When a Session is created, everything in this list will be
# automatically registered with that Session.

BUILTIN_HANDLERS = [
    ('getattr.mturk.list_hi_ts_for_qualification_type',
     ClientMethodAlias('list_hits_for_qualification_type')),
    ('before-parameter-build.s3.UploadPart',
     convert_body_to_file_like_object, REGISTER_LAST),
    ('before-parameter-build.s3.PutObject',
     convert_body_to_file_like_object, REGISTER_LAST),
    ('creating-client-class', add_generate_presigned_url),
    ('creating-client-class.s3', add_generate_presigned_post),
    ('creating-client-class.rds', add_generate_db_auth_token),
    ('creating-client-class.iot-data', check_openssl_supports_tls_version_1_2),
    ('after-call.iam', json_decode_policies),

    ('after-call.ec2.GetConsoleOutput', decode_console_output),
    ('after-call.cloudformation.GetTemplate', json_decode_template_body),
    ('after-call.s3.GetBucketLocation', parse_get_bucket_location),

    ('before-parameter-build', generate_idempotent_uuid),

    ('before-parameter-build.s3', validate_bucket_name),

    ('before-parameter-build.s3.ListObjects',
     set_list_objects_encoding_type_url),
    ('before-call.s3.PutBucketTagging', calculate_md5),
    ('before-call.s3.PutBucketLifecycle', calculate_md5),
    ('before-call.s3.PutBucketLifecycleConfiguration', calculate_md5),
    ('before-call.s3.PutBucketCors', calculate_md5),
    ('before-call.s3.DeleteObjects', calculate_md5),
    ('before-call.s3.PutBucketReplication', calculate_md5),
    ('before-call.s3.PutObject', conditionally_calculate_md5),
    ('before-call.s3.UploadPart', conditionally_calculate_md5),
    ('before-call.s3.PutBucketAcl', conditionally_calculate_md5),
    ('before-call.s3.PutBucketLogging', conditionally_calculate_md5),
    ('before-call.s3.PutBucketNotification', conditionally_calculate_md5),
    ('before-call.s3.PutBucketPolicy', conditionally_calculate_md5),
    ('before-call.s3.PutBucketRequestPayment', conditionally_calculate_md5),
    ('before-call.s3.PutBucketVersioning', conditionally_calculate_md5),
    ('before-call.s3.PutBucketWebsite', conditionally_calculate_md5),
    ('before-call.s3.PutObjectAcl', conditionally_calculate_md5),

    ('before-parameter-build.s3.CopyObject',
     handle_copy_source_param),
    ('before-parameter-build.s3.UploadPartCopy',
     handle_copy_source_param),
    ('before-parameter-build.s3.CopyObject', validate_ascii_metadata),
    ('before-parameter-build.s3.PutObject', validate_ascii_metadata),
    ('before-parameter-build.s3.CreateMultipartUpload',
     validate_ascii_metadata),
    ('docs.*.s3.CopyObject.complete-section', document_copy_source_form),
    ('docs.*.s3.UploadPartCopy.complete-section', document_copy_source_form),

    ('before-call.s3', add_expect_header),
    ('before-call.glacier', add_glacier_version),
    ('before-call.apigateway', add_accept_header),
    ('before-call.glacier.UploadArchive', add_glacier_checksums),
    ('before-call.glacier.UploadMultipartPart', add_glacier_checksums),
    ('before-call.ec2.CopySnapshot', inject_presigned_url_ec2),
    ('before-call.rds.CopyDBClusterSnapshot',
     inject_presigned_url_rds),
    ('before-call.rds.CreateDBCluster',
     inject_presigned_url_rds),
    ('before-call.rds.CopyDBSnapshot',
     inject_presigned_url_rds),
    ('before-call.rds.CreateDBInstanceReadReplica',
     inject_presigned_url_rds),
    ('request-created.machinelearning.Predict', switch_host_machinelearning),
    ('needs-retry.s3.UploadPartCopy', check_for_200_error, REGISTER_FIRST),
    ('needs-retry.s3.CopyObject', check_for_200_error, REGISTER_FIRST),
    ('needs-retry.s3.CompleteMultipartUpload', check_for_200_error,
     REGISTER_FIRST),
    ('service-data-loaded', register_retries_for_service),
    ('choose-signer.cognito-identity.GetId', disable_signing),
    ('choose-signer.cognito-identity.GetOpenIdToken', disable_signing),
    ('choose-signer.cognito-identity.UnlinkIdentity', disable_signing),
    ('choose-signer.cognito-identity.GetCredentialsForIdentity',
        disable_signing),
    ('choose-signer.sts.AssumeRoleWithSAML', disable_signing),
    ('choose-signer.sts.AssumeRoleWithWebIdentity', disable_signing),
    ('choose-signer', set_operation_specific_signer),
    ('before-parameter-build.s3.HeadObject', sse_md5),
    ('before-parameter-build.s3.GetObject', sse_md5),
    ('before-parameter-build.s3.PutObject', sse_md5),
    ('before-parameter-build.s3.CopyObject', sse_md5),
    ('before-parameter-build.s3.CopyObject', copy_source_sse_md5),
    ('before-parameter-build.s3.CreateMultipartUpload', sse_md5),
    ('before-parameter-build.s3.UploadPart', sse_md5),
    ('before-parameter-build.s3.UploadPartCopy', sse_md5),
    ('before-parameter-build.s3.UploadPartCopy', copy_source_sse_md5),
    ('before-parameter-build.ec2.RunInstances', base64_encode_user_data),
    ('before-parameter-build.autoscaling.CreateLaunchConfiguration',
     base64_encode_user_data),
    ('before-parameter-build.route53', fix_route53_ids),
    ('before-parameter-build.glacier', inject_account_id),
    ('after-call.s3.ListObjects', decode_list_object),

    # Cloudsearchdomain search operation will be sent by HTTP POST
    ('request-created.cloudsearchdomain.Search',
     change_get_to_post),
    # Glacier documentation customizations
    ('docs.*.glacier.*.complete-section',
     AutoPopulatedParam('accountId', 'Note: this parameter is set to "-" by'
                        'default if no value is not specified.')
     .document_auto_populated_param),
    ('docs.*.glacier.UploadArchive.complete-section',
     AutoPopulatedParam('checksum').document_auto_populated_param),
    ('docs.*.glacier.UploadMultipartPart.complete-section',
     AutoPopulatedParam('checksum').document_auto_populated_param),
    ('docs.request-params.glacier.CompleteMultipartUpload.complete-section',
     document_glacier_tree_hash_checksum()),
    # Cloudformation documentation customizations
    ('docs.*.cloudformation.GetTemplate.complete-section',
     document_cloudformation_get_template_return_type),

    # UserData base64 encoding documentation customizations
    ('docs.*.ec2.RunInstances.complete-section',
     document_base64_encoding('UserData')),
    ('docs.*.autoscaling.CreateLaunchConfiguration.complete-section',
     document_base64_encoding('UserData')),

    # RDS PresignedUrl documentation customizations
    ('docs.*.rds.CopyDBClusterSnapshot.complete-section',
     AutoPopulatedParam('PreSignedUrl').document_auto_populated_param),
    ('docs.*.rds.CreateDBCluster.complete-section',
     AutoPopulatedParam('PreSignedUrl').document_auto_populated_param),
    ('docs.*.rds.CopyDBSnapshot.complete-section',
     AutoPopulatedParam('PreSignedUrl').document_auto_populated_param),
    ('docs.*.rds.CreateDBInstanceReadReplica.complete-section',
     AutoPopulatedParam('PreSignedUrl').document_auto_populated_param),

    # EC2 CopySnapshot documentation customizations
    ('docs.*.ec2.CopySnapshot.complete-section',
     AutoPopulatedParam('PresignedUrl').document_auto_populated_param),
    ('docs.*.ec2.CopySnapshot.complete-section',
     AutoPopulatedParam('DestinationRegion').document_auto_populated_param),
    # S3 SSE documentation modifications
    ('docs.*.s3.*.complete-section',
     AutoPopulatedParam('SSECustomerKeyMD5').document_auto_populated_param),
    # S3 SSE Copy Source documentation modifications
    ('docs.*.s3.*.complete-section',
     AutoPopulatedParam(
        'CopySourceSSECustomerKeyMD5').document_auto_populated_param),
    # Add base64 information to Lambda
    ('docs.*.lambda.UpdateFunctionCode.complete-section',
     document_base64_encoding('ZipFile')),
    # The following S3 operations cannot actually accept a ContentMD5
    ('docs.*.s3.*.complete-section',
     HideParamFromOperations(
         's3', 'ContentMD5',
         ['DeleteObjects', 'PutBucketAcl', 'PutBucketCors',
          'PutBucketLifecycle', 'PutBucketLogging', 'PutBucketNotification',
          'PutBucketPolicy', 'PutBucketReplication', 'PutBucketRequestPayment',
          'PutBucketTagging', 'PutBucketVersioning', 'PutBucketWebsite',
          'PutObjectAcl']).hide_param)
]
_add_parameter_aliases(BUILTIN_HANDLERS)
