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
import datetime
import weakref
import json
import base64

import botocore
import botocore.auth
from botocore.compat import six, OrderedDict
from botocore.awsrequest import create_request_object, prepare_request_dict
from botocore.exceptions import UnknownSignatureVersionError
from botocore.exceptions import UnknownClientMethodError
from botocore.exceptions import UnsupportedSignatureVersionError
from botocore.utils import fix_s3_host, datetime2timestamp


class RequestSigner(object):
    """
    An object to sign requests before they go out over the wire using
    one of the authentication mechanisms defined in ``auth.py``. This
    class fires two events scoped to a service and operation name:

    * choose-signer: Allows overriding the auth signer name.
    * before-sign: Allows mutating the request before signing.

    Together these events allow for customization of the request
    signing pipeline, including overrides, request path manipulation,
    and disabling signing per operation.

    :type service_name: string
    :param service_name: Name of the service, e.g. ``S3``

    :type region_name: string
    :param region_name: Name of the service region, e.g. ``us-east-1``

    :type signing_name: string
    :param signing_name: Service signing name. This is usually the
                         same as the service name, but can differ. E.g.
                         ``emr`` vs. ``elasticmapreduce``.

    :type signature_version: string
    :param signature_version: Signature name like ``v4``.

    :type credentials: :py:class:`~botocore.credentials.Credentials`
    :param credentials: User credentials with which to sign requests.

    :type event_emitter: :py:class:`~botocore.hooks.BaseEventHooks`
    :param event_emitter: Extension mechanism to fire events.

    """
    def __init__(self, service_name, region_name, signing_name,
                 signature_version, credentials, event_emitter):
        self._service_name = service_name
        self._region_name = region_name
        self._signing_name = signing_name
        self._signature_version = signature_version
        self._credentials = credentials

        # We need weakref to prevent leaking memory in Python 2.6 on Linux 2.6
        self._event_emitter = weakref.proxy(event_emitter)

    @property
    def region_name(self):
        return self._region_name

    @property
    def signature_version(self):
        return self._signature_version

    @property
    def signing_name(self):
        return self._signing_name

    def handler(self, operation_name=None, request=None, **kwargs):
        # This is typically hooked up to the "request-created" event
        # from a client's event emitter.  When a new request is created
        # this method is invoked to sign the request.
        # Don't call this method directly.
        return self.sign(operation_name, request)

    def sign(self, operation_name, request, region_name=None,
             signing_type='standard', expires_in=None, signing_name=None):
        """Sign a request before it goes out over the wire.

        :type operation_name: string
        :param operation_name: The name of the current operation, e.g.
                               ``ListBuckets``.
        :type request: AWSRequest
        :param request: The request object to be sent over the wire.

        :type region_name: str
        :param region_name: The region to sign the request for.

        :type signing_type: str
        :param signing_type: The type of signing to perform. This can be one of
            three possible values:

            * 'standard'     - This should be used for most requests.
            * 'presign-url'  - This should be used when pre-signing a request.
            * 'presign-post' - This should be used when pre-signing an S3 post.

        :type expires_in: int
        :param expires_in: The number of seconds the presigned url is valid
            for. This parameter is only valid for signing type 'presign-url'.

        :type signing_name: str
        :param signing_name: The name to use for the service when signing.
        """
        if region_name is None:
            region_name = self._region_name

        if signing_name is None:
            signing_name = self._signing_name

        signature_version = self._choose_signer(
            operation_name, signing_type, request.context)

        # Allow mutating request before signing
        self._event_emitter.emit(
            'before-sign.{0}.{1}'.format(self._service_name, operation_name),
            request=request, signing_name=signing_name,
            region_name=self._region_name,
            signature_version=signature_version, request_signer=self)

        if signature_version != botocore.UNSIGNED:
            kwargs = {
                'signing_name': signing_name,
                'region_name': region_name,
                'signature_version': signature_version
            }
            if expires_in is not None:
                kwargs['expires'] = expires_in

            try:
                auth = self.get_auth_instance(**kwargs)
            except UnknownSignatureVersionError as e:
                if signing_type != 'standard':
                    raise UnsupportedSignatureVersionError(
                        signature_version=signature_version)
                else:
                    raise e

            auth.add_auth(request)

    def _choose_signer(self, operation_name, signing_type, context):
        """
        Allow setting the signature version via the choose-signer event.
        A value of `botocore.UNSIGNED` means no signing will be performed.

        :param operation_name: The operation to sign.
        :param signing_type: The type of signing that the signer is to be used
            for.
        :return: The signature version to sign with.
        """
        signing_type_suffix_map = {
            'presign-post': '-presign-post',
            'presign-url': '-query'
        }
        suffix = signing_type_suffix_map.get(signing_type, '')

        signature_version = self._signature_version
        if signature_version is not botocore.UNSIGNED and not \
                signature_version.endswith(suffix):
            signature_version += suffix

        handler, response = self._event_emitter.emit_until_response(
            'choose-signer.{0}.{1}'.format(self._service_name, operation_name),
            signing_name=self._signing_name, region_name=self._region_name,
            signature_version=signature_version, context=context)

        if response is not None:
            signature_version = response
            # The suffix needs to be checked again in case we get an improper
            # signature version from choose-signer.
            if signature_version is not botocore.UNSIGNED and not \
                    signature_version.endswith(suffix):
                signature_version += suffix

        return signature_version

    def get_auth_instance(self, signing_name, region_name,
                          signature_version=None, **kwargs):
        """
        Get an auth instance which can be used to sign a request
        using the given signature version.

        :type signing_name: string
        :param signing_name: Service signing name. This is usually the
                             same as the service name, but can differ. E.g.
                             ``emr`` vs. ``elasticmapreduce``.

        :type region_name: string
        :param region_name: Name of the service region, e.g. ``us-east-1``

        :type signature_version: string
        :param signature_version: Signature name like ``v4``.

        :rtype: :py:class:`~botocore.auth.BaseSigner`
        :return: Auth instance to sign a request.
        """
        if signature_version is None:
            signature_version = self._signature_version

        cls = botocore.auth.AUTH_TYPE_MAPS.get(signature_version)
        if cls is None:
            raise UnknownSignatureVersionError(
                signature_version=signature_version)
        # If there's no credentials provided (i.e credentials is None),
        # then we'll pass a value of "None" over to the auth classes,
        # which already handle the cases where no credentials have
        # been provided.
        frozen_credentials = None
        if self._credentials is not None:
            frozen_credentials = self._credentials.get_frozen_credentials()
        kwargs['credentials'] = frozen_credentials
        if cls.REQUIRES_REGION:
            if self._region_name is None:
                raise botocore.exceptions.NoRegionError()
            kwargs['region_name'] = region_name
            kwargs['service_name'] = signing_name
        auth = cls(**kwargs)
        return auth

    # Alias get_auth for backwards compatibility.
    get_auth = get_auth_instance

    def generate_presigned_url(self, request_dict, operation_name,
                               expires_in=3600, region_name=None,
                               signing_name=None):
        """Generates a presigned url

        :type request_dict: dict
        :param request_dict: The prepared request dictionary returned by
            ``botocore.awsrequest.prepare_request_dict()``

        :type operation_name: str
        :param operation_name: The operation being signed.

        :type expires_in: int
        :param expires_in: The number of seconds the presigned url is valid
            for. By default it expires in an hour (3600 seconds)

        :type region_name: string
        :param region_name: The region name to sign the presigned url.

        :type signing_name: str
        :param signing_name: The name to use for the service when signing.

        :returns: The presigned url
        """
        request = create_request_object(request_dict)
        self.sign(operation_name, request, region_name,
                  'presign-url', expires_in, signing_name)

        request.prepare()
        return request.url


class CloudFrontSigner(object):
    '''A signer to create a signed CloudFront URL.

    First you create a cloudfront signer based on a normalized RSA signer::

        import rsa
        def rsa_signer(message):
            private_key = open('private_key.pem', 'r').read()
            return rsa.sign(
                message,
                rsa.PrivateKey.load_pkcs1(private_key.encode('utf8')),
                'SHA-1')  # CloudFront requires SHA-1 hash
        cf_signer = CloudFrontSigner(key_id, rsa_signer)

    To sign with a canned policy::

        signed_url = cf_signer.generate_signed_url(
            url, date_less_than=datetime(2015, 12, 1))

    To sign with a custom policy::

        signed_url = cf_signer.generate_signed_url(url, policy=my_policy)
    '''

    def __init__(self, key_id, rsa_signer):
        """Create a CloudFrontSigner.

        :type key_id: str
        :param key_id: The CloudFront Key Pair ID

        :type rsa_signer: callable
        :param rsa_signer: An RSA signer.
               Its only input parameter will be the message to be signed,
               and its output will be the signed content as a binary string.
               The hash algorithm needed by CloudFront is SHA-1.
        """
        self.key_id = key_id
        self.rsa_signer = rsa_signer

    def generate_presigned_url(self, url, date_less_than=None, policy=None):
        """Creates a signed CloudFront URL based on given parameters.

        :type url: str
        :param url: The URL of the protected object

        :type date_less_than: datetime
        :param date_less_than: The URL will expire after that date and time

        :type policy: str
        :param policy: The custom policy, possibly built by self.build_policy()

        :rtype: str
        :return: The signed URL.
        """
        if (date_less_than is not None and policy is not None or
                date_less_than is None and policy is None):
            e = 'Need to provide either date_less_than or policy, but not both'
            raise ValueError(e)
        if date_less_than is not None:
            # We still need to build a canned policy for signing purpose
            policy = self.build_policy(url, date_less_than)
        if isinstance(policy, six.text_type):
            policy = policy.encode('utf8')
        if date_less_than is not None:
            params = ['Expires=%s' % int(datetime2timestamp(date_less_than))]
        else:
            params = ['Policy=%s' % self._url_b64encode(policy).decode('utf8')]
        signature = self.rsa_signer(policy)
        params.extend([
            'Signature=%s' % self._url_b64encode(signature).decode('utf8'),
            'Key-Pair-Id=%s' % self.key_id,
            ])
        return self._build_url(url, params)

    def _build_url(self, base_url, extra_params):
        separator = '&' if '?' in base_url else '?'
        return base_url + separator + '&'.join(extra_params)

    def build_policy(self, resource, date_less_than,
                     date_greater_than=None, ip_address=None):
        """A helper to build policy.

        :type resource: str
        :param resource: The URL or the stream filename of the protected object

        :type date_less_than: datetime
        :param date_less_than: The URL will expire after the time has passed

        :type date_greater_than: datetime
        :param date_greater_than: The URL will not be valid until this time

        :type ip_address: str
        :param ip_address: Use 'x.x.x.x' for an IP, or 'x.x.x.x/x' for a subnet

        :rtype: str
        :return: The policy in a compact string.
        """
        # Note:
        # 1. Order in canned policy is significant. Special care has been taken
        #    to ensure the output will match the order defined by the document.
        #    There is also a test case to ensure that order.
        #    SEE: http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html#private-content-canned-policy-creating-policy-statement
        # 2. Albeit the order in custom policy is not required by CloudFront,
        #    we still use OrderedDict internally to ensure the result is stable
        #    and also matches canned policy requirement.
        #    SEE: http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-custom-policy.html
        moment = int(datetime2timestamp(date_less_than))
        condition = OrderedDict({"DateLessThan": {"AWS:EpochTime": moment}})
        if ip_address:
            if '/' not in ip_address:
                ip_address += '/32'
            condition["IpAddress"] = {"AWS:SourceIp": ip_address}
        if date_greater_than:
            moment = int(datetime2timestamp(date_greater_than))
            condition["DateGreaterThan"] = {"AWS:EpochTime": moment}
        ordered_payload = [('Resource', resource), ('Condition', condition)]
        custom_policy = {"Statement": [OrderedDict(ordered_payload)]}
        return json.dumps(custom_policy, separators=(',', ':'))

    def _url_b64encode(self, data):
        # Required by CloudFront. See also:
        # http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-linux-openssl.html
        return base64.b64encode(
            data).replace(b'+', b'-').replace(b'=', b'_').replace(b'/', b'~')


def add_generate_db_auth_token(class_attributes, **kwargs):
    class_attributes['generate_db_auth_token'] = generate_db_auth_token


def generate_db_auth_token(self, DBHostname, Port, DBUsername, Region=None):
    """Generates an auth token used to connect to a db with IAM credentials.

    :type DBHostname: str
    :param DBHostname: The hostname of the database to connect to.

    :type Port: int
    :param Port: The port number the database is listening on.

    :type DBUsername: str
    :param DBUsername: The username to log in as.

    :type Region: str
    :param Region: The region the database is in. If None, the client
        region will be used.

    :return: A presigned url which can be used as an auth token.
    """
    region = Region
    if region is None:
        region = self.meta.region_name

    params = {
        'Action': 'connect',
        'DBUser': DBUsername,
    }

    request_dict = {
        'url_path': '/',
        'query_string': '',
        'headers': {},
        'body': params,
        'method': 'GET'
    }

    # RDS requires that the scheme not be set when sent over. This can cause
    # issues when signing because the Python url parsing libraries follow
    # RFC 1808 closely, which states that a netloc must be introduced by `//`.
    # Otherwise the url is presumed to be relative, and thus the whole
    # netloc would be treated as a path component. To work around this we
    # introduce https here and remove it once we're done processing it.
    scheme = 'https://'
    endpoint_url = '%s%s:%s' % (scheme, DBHostname, Port)
    prepare_request_dict(request_dict, endpoint_url)
    presigned_url = self._request_signer.generate_presigned_url(
        operation_name='connect', request_dict=request_dict,
        region_name=region, expires_in=900, signing_name='rds-db'
    )
    return presigned_url[len(scheme):]


class S3PostPresigner(object):
    def __init__(self, request_signer):
        self._request_signer = request_signer

    def generate_presigned_post(self, request_dict, fields=None,
                                conditions=None, expires_in=3600,
                                region_name=None):
        """Generates the url and the form fields used for a presigned s3 post

        :type request_dict: dict
        :param request_dict: The prepared request dictionary returned by
            ``botocore.awsrequest.prepare_request_dict()``

        :type fields: dict
        :param fields: A dictionary of prefilled form fields to build on top
            of.

        :type conditions: list
        :param conditions: A list of conditions to include in the policy. Each
            element can be either a list or a structure. For example:
            [
             {"acl": "public-read"},
             {"bucket": "mybucket"},
             ["starts-with", "$key", "mykey"]
            ]

        :type expires_in: int
        :param expires_in: The number of seconds the presigned post is valid
            for.

        :type region_name: string
        :param region_name: The region name to sign the presigned post to.

        :rtype: dict
        :returns: A dictionary with two elements: ``url`` and ``fields``.
            Url is the url to post to. Fields is a dictionary filled with
            the form fields and respective values to use when submitting the
            post. For example:

            {'url': 'https://mybucket.s3.amazonaws.com
             'fields': {'acl': 'public-read',
                        'key': 'mykey',
                        'signature': 'mysignature',
                        'policy': 'mybase64 encoded policy'}
            }
        """
        if fields is None:
            fields = {}

        if conditions is None:
            conditions = []

        # Create the policy for the post.
        policy = {}

        # Create an expiration date for the policy
        datetime_now = datetime.datetime.utcnow()
        expire_date = datetime_now + datetime.timedelta(seconds=expires_in)
        policy['expiration'] = expire_date.strftime(botocore.auth.ISO8601)

        # Append all of the conditions that the user supplied.
        policy['conditions'] = []
        for condition in conditions:
            policy['conditions'].append(condition)

        # Store the policy and the fields in the request for signing
        request = create_request_object(request_dict)
        request.context['s3-presign-post-fields'] = fields
        request.context['s3-presign-post-policy'] = policy

        self._request_signer.sign(
            'PutObject', request, region_name, 'presign-post')
        # Return the url and the fields for th form to post.
        return {'url': request.url, 'fields': fields}


def add_generate_presigned_url(class_attributes, **kwargs):
    class_attributes['generate_presigned_url'] = generate_presigned_url


def generate_presigned_url(self, ClientMethod, Params=None, ExpiresIn=3600,
                           HttpMethod=None):
    """Generate a presigned url given a client, its method, and arguments

    :type ClientMethod: string
    :param ClientMethod: The client method to presign for

    :type Params: dict
    :param Params: The parameters normally passed to
        ``ClientMethod``.

    :type ExpiresIn: int
    :param ExpiresIn: The number of seconds the presigned url is valid
        for. By default it expires in an hour (3600 seconds)

    :type HttpMethod: string
    :param HttpMethod: The http method to use on the generated url. By
        default, the http method is whatever is used in the method's model.

    :returns: The presigned url
    """
    client_method = ClientMethod
    params = Params
    expires_in = ExpiresIn
    http_method = HttpMethod

    request_signer = self._request_signer
    serializer = self._serializer

    try:
        operation_name = self._PY_TO_OP_NAME[client_method]
    except KeyError:
        raise UnknownClientMethodError(method_name=client_method)

    operation_model = self.meta.service_model.operation_model(
        operation_name)

    # Create a request dict based on the params to serialize.
    request_dict = serializer.serialize_to_request(
        params, operation_model)

    # Switch out the http method if user specified it.
    if http_method is not None:
        request_dict['method'] = http_method

    # Prepare the request dict by including the client's endpoint url.
    prepare_request_dict(
        request_dict, endpoint_url=self.meta.endpoint_url)

    # Generate the presigned url.
    return request_signer.generate_presigned_url(
        request_dict=request_dict, expires_in=expires_in,
        operation_name=operation_name)


def add_generate_presigned_post(class_attributes, **kwargs):
    class_attributes['generate_presigned_post'] = generate_presigned_post


def generate_presigned_post(self, Bucket, Key, Fields=None, Conditions=None,
                            ExpiresIn=3600):
    """Builds the url and the form fields used for a presigned s3 post

    :type Bucket: string
    :param Bucket: The name of the bucket to presign the post to. Note that
        bucket related conditions should not be included in the
        ``conditions`` parameter.

    :type Key: string
    :param Key: Key name, optionally add ${filename} to the end to
        attach the submitted filename. Note that key related conditions and
        fields are filled out for you and should not be included in the
        ``Fields`` or ``Conditions`` parameter.

    :type Fields: dict
    :param Fields: A dictionary of prefilled form fields to build on top
        of. Elements that may be included are acl, Cache-Control,
        Content-Type, Content-Disposition, Content-Encoding, Expires,
        success_action_redirect, redirect, success_action_status,
        and x-amz-meta-.

        Note that if a particular element is included in the fields
        dictionary it will not be automatically added to the conditions
        list. You must specify a condition for the element as well.

    :type Conditions: list
    :param Conditions: A list of conditions to include in the policy. Each
        element can be either a list or a structure. For example:

        [
         {"acl": "public-read"},
         ["content-length-range", 2, 5],
         ["starts-with", "$success_action_redirect", ""]
        ]

        Conditions that are included may pertain to acl,
        content-length-range, Cache-Control, Content-Type,
        Content-Disposition, Content-Encoding, Expires,
        success_action_redirect, redirect, success_action_status,
        and/or x-amz-meta-.

        Note that if you include a condition, you must specify
        the a valid value in the fields dictionary as well. A value will
        not be added automatically to the fields dictionary based on the
        conditions.

    :type ExpiresIn: int
    :param ExpiresIn: The number of seconds the presigned post
        is valid for.

    :rtype: dict
    :returns: A dictionary with two elements: ``url`` and ``fields``.
        Url is the url to post to. Fields is a dictionary filled with
        the form fields and respective values to use when submitting the
        post. For example:

        {'url': 'https://mybucket.s3.amazonaws.com
         'fields': {'acl': 'public-read',
                    'key': 'mykey',
                    'signature': 'mysignature',
                    'policy': 'mybase64 encoded policy'}
        }
    """
    bucket = Bucket
    key = Key
    fields = Fields
    conditions = Conditions
    expires_in = ExpiresIn

    if fields is None:
        fields = {}

    if conditions is None:
        conditions = []

    post_presigner = S3PostPresigner(self._request_signer)
    serializer = self._serializer

    # We choose the CreateBucket operation model because its url gets
    # serialized to what a presign post requires.
    operation_model = self.meta.service_model.operation_model(
        'CreateBucket')

    # Create a request dict based on the params to serialize.
    request_dict = serializer.serialize_to_request(
        {'Bucket': bucket}, operation_model)

    # Prepare the request dict by including the client's endpoint url.
    prepare_request_dict(
        request_dict, endpoint_url=self.meta.endpoint_url)

    # Append that the bucket name to the list of conditions.
    conditions.append({'bucket': bucket})

    # If the key ends with filename, the only constraint that can be
    # imposed is if it starts with the specified prefix.
    if key.endswith('${filename}'):
        conditions.append(["starts-with", '$key', key[:-len('${filename}')]])
    else:
        conditions.append({'key': key})

    # Add the key to the fields.
    fields['key'] = key

    return post_presigner.generate_presigned_post(
        request_dict=request_dict, fields=fields, conditions=conditions,
        expires_in=expires_in)
