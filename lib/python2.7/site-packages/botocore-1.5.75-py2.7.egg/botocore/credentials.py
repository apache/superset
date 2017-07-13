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
import time
import datetime
import logging
import os
import getpass
import threading
from collections import namedtuple

from dateutil.parser import parse
from dateutil.tz import tzlocal

import botocore.configloader
import botocore.compat
from botocore.compat import total_seconds
from botocore.exceptions import UnknownCredentialError
from botocore.exceptions import PartialCredentialsError
from botocore.exceptions import ConfigNotFound
from botocore.exceptions import InvalidConfigError
from botocore.exceptions import RefreshWithMFAUnsupportedError
from botocore.exceptions import MetadataRetrievalError
from botocore.exceptions import CredentialRetrievalError
from botocore.utils import InstanceMetadataFetcher, parse_key_val_file
from botocore.utils import ContainerMetadataFetcher


logger = logging.getLogger(__name__)
ReadOnlyCredentials = namedtuple('ReadOnlyCredentials',
                                 ['access_key', 'secret_key', 'token'])


def create_credential_resolver(session):
    """Create a default credential resolver.

    This creates a pre-configured credential resolver
    that includes the default lookup chain for
    credentials.

    """
    profile_name = session.get_config_variable('profile') or 'default'
    credential_file = session.get_config_variable('credentials_file')
    config_file = session.get_config_variable('config_file')
    metadata_timeout = session.get_config_variable('metadata_service_timeout')
    num_attempts = session.get_config_variable('metadata_service_num_attempts')

    env_provider = EnvProvider()
    providers = [
        env_provider,
        AssumeRoleProvider(
            load_config=lambda: session.full_config,
            client_creator=session.create_client,
            cache={},
            profile_name=profile_name,
        ),
        SharedCredentialProvider(
            creds_filename=credential_file,
            profile_name=profile_name
        ),
        # The new config file has precedence over the legacy
        # config file.
        ConfigProvider(config_filename=config_file, profile_name=profile_name),
        OriginalEC2Provider(),
        BotoProvider(),
        ContainerProvider(),
        InstanceMetadataProvider(
            iam_role_fetcher=InstanceMetadataFetcher(
                timeout=metadata_timeout,
                num_attempts=num_attempts)
        )
    ]

    explicit_profile = session.get_config_variable('profile',
                                                   methods=('instance',))
    if explicit_profile is not None:
        # An explicitly provided profile will negate an EnvProvider.
        # We will defer to providers that understand the "profile"
        # concept to retrieve credentials.
        # The one edge case if is all three values are provided via
        # env vars:
        # export AWS_ACCESS_KEY_ID=foo
        # export AWS_SECRET_ACCESS_KEY=bar
        # export AWS_PROFILE=baz
        # Then, just like our client() calls, the explicit credentials
        # will take precedence.
        #
        # This precedence is enforced by leaving the EnvProvider in the chain.
        # This means that the only way a "profile" would win is if the
        # EnvProvider does not return credentials, which is what we want
        # in this scenario.
        providers.remove(env_provider)
        logger.debug('Skipping environment variable credential check'
                     ' because profile name was explicitly set.')

    resolver = CredentialResolver(providers=providers)
    return resolver


def get_credentials(session):
    resolver = create_credential_resolver(session)
    return resolver.load_credentials()


def _local_now():
    return datetime.datetime.now(tzlocal())


def _parse_if_needed(value):
    if isinstance(value, datetime.datetime):
        return value
    return parse(value)


def _serialize_if_needed(value):
    if isinstance(value, datetime.datetime):
        return value.strftime('%Y-%m-%dT%H:%M:%S%Z')
    return value


def create_assume_role_refresher(client, params):
    def refresh():
        response = client.assume_role(**params)
        credentials = response['Credentials']
        # We need to normalize the credential names to
        # the values expected by the refresh creds.
        return {
            'access_key': credentials['AccessKeyId'],
            'secret_key': credentials['SecretAccessKey'],
            'token': credentials['SessionToken'],
            'expiry_time': _serialize_if_needed(credentials['Expiration']),
        }
    return refresh


def create_mfa_serial_refresher():
    def _refresher():
        # We can explore an option in the future to support
        # reprompting for MFA, but for now we just error out
        # when the temp creds expire.
        raise RefreshWithMFAUnsupportedError()
    return _refresher


class Credentials(object):
    """
    Holds the credentials needed to authenticate requests.

    :ivar access_key: The access key part of the credentials.
    :ivar secret_key: The secret key part of the credentials.
    :ivar token: The security token, valid only for session credentials.
    :ivar method: A string which identifies where the credentials
        were found.
    """

    def __init__(self, access_key, secret_key, token=None,
                 method=None):
        self.access_key = access_key
        self.secret_key = secret_key
        self.token = token

        if method is None:
            method = 'explicit'
        self.method = method

        self._normalize()

    def _normalize(self):
        # Keys would sometimes (accidentally) contain non-ascii characters.
        # It would cause a confusing UnicodeDecodeError in Python 2.
        # We explicitly convert them into unicode to avoid such error.
        #
        # Eventually the service will decide whether to accept the credential.
        # This also complies with the behavior in Python 3.
        self.access_key = botocore.compat.ensure_unicode(self.access_key)
        self.secret_key = botocore.compat.ensure_unicode(self.secret_key)

    def get_frozen_credentials(self):
        return ReadOnlyCredentials(self.access_key,
                                   self.secret_key,
                                   self.token)


class RefreshableCredentials(Credentials):
    """
    Holds the credentials needed to authenticate requests. In addition, it
    knows how to refresh itself.

    :ivar refresh_timeout: How long a given set of credentials are valid for.
        Useful for credentials fetched over the network.
    :ivar access_key: The access key part of the credentials.
    :ivar secret_key: The secret key part of the credentials.
    :ivar token: The security token, valid only for session credentials.
    :ivar method: A string which identifies where the credentials
        were found.
    """
    # The time at which we'll attempt to refresh, but not
    # block if someone else is refreshing.
    _advisory_refresh_timeout = 15 * 60
    # The time at which all threads will block waiting for
    # refreshed credentials.
    _mandatory_refresh_timeout = 10 * 60

    def __init__(self, access_key, secret_key, token,
                 expiry_time, refresh_using, method,
                 time_fetcher=_local_now):
        self._refresh_using = refresh_using
        self._access_key = access_key
        self._secret_key = secret_key
        self._token = token
        self._expiry_time = expiry_time
        self._time_fetcher = time_fetcher
        self._refresh_lock = threading.Lock()
        self.method = method
        self._frozen_credentials = ReadOnlyCredentials(
            access_key, secret_key, token)
        self._normalize()

    def _normalize(self):
        self._access_key = botocore.compat.ensure_unicode(self._access_key)
        self._secret_key = botocore.compat.ensure_unicode(self._secret_key)

    @classmethod
    def create_from_metadata(cls, metadata, refresh_using, method):
        instance = cls(
            access_key=metadata['access_key'],
            secret_key=metadata['secret_key'],
            token=metadata['token'],
            expiry_time=cls._expiry_datetime(metadata['expiry_time']),
            method=method,
            refresh_using=refresh_using
        )
        return instance

    @property
    def access_key(self):
        """Warning: Using this property can lead to race conditions if you
        access another property subsequently along the refresh boundary.
        Please use get_frozen_credentials instead.
        """
        self._refresh()
        return self._access_key

    @access_key.setter
    def access_key(self, value):
        self._access_key = value

    @property
    def secret_key(self):
        """Warning: Using this property can lead to race conditions if you
        access another property subsequently along the refresh boundary.
        Please use get_frozen_credentials instead.
        """
        self._refresh()
        return self._secret_key

    @secret_key.setter
    def secret_key(self, value):
        self._secret_key = value

    @property
    def token(self):
        """Warning: Using this property can lead to race conditions if you
        access another property subsequently along the refresh boundary.
        Please use get_frozen_credentials instead.
        """
        self._refresh()
        return self._token

    @token.setter
    def token(self, value):
        self._token = value

    def _seconds_remaining(self):
        delta = self._expiry_time - self._time_fetcher()
        return total_seconds(delta)

    def refresh_needed(self, refresh_in=None):
        """Check if a refresh is needed.

        A refresh is needed if the expiry time associated
        with the temporary credentials is less than the
        provided ``refresh_in``.  If ``time_delta`` is not
        provided, ``self.advisory_refresh_needed`` will be used.

        For example, if your temporary credentials expire
        in 10 minutes and the provided ``refresh_in`` is
        ``15 * 60``, then this function will return ``True``.

        :type refresh_in: int
        :param refresh_in: The number of seconds before the
            credentials expire in which refresh attempts should
            be made.

        :return: True if refresh neeeded, False otherwise.

        """
        if self._expiry_time is None:
            # No expiration, so assume we don't need to refresh.
            return False

        if refresh_in is None:
            refresh_in = self._advisory_refresh_timeout
        # The credentials should be refreshed if they're going to expire
        # in less than 5 minutes.
        if self._seconds_remaining() >= refresh_in:
            # There's enough time left. Don't refresh.
            return False
        logger.debug("Credentials need to be refreshed.")
        return True

    def _is_expired(self):
        # Checks if the current credentials are expired.
        return self.refresh_needed(refresh_in=0)

    def _refresh(self):
        # In the common case where we don't need a refresh, we
        # can immediately exit and not require acquiring the
        # refresh lock.
        if not self.refresh_needed(self._advisory_refresh_timeout):
            return

        # acquire() doesn't accept kwargs, but False is indicating
        # that we should not block if we can't acquire the lock.
        # If we aren't able to acquire the lock, we'll trigger
        # the else clause.
        if self._refresh_lock.acquire(False):
            try:
                if not self.refresh_needed(self._advisory_refresh_timeout):
                    return
                is_mandatory_refresh = self.refresh_needed(
                    self._mandatory_refresh_timeout)
                self._protected_refresh(is_mandatory=is_mandatory_refresh)
                return
            finally:
                self._refresh_lock.release()
        elif self.refresh_needed(self._mandatory_refresh_timeout):
            # If we're within the mandatory refresh window,
            # we must block until we get refreshed credentials.
            with self._refresh_lock:
                if not self.refresh_needed(self._mandatory_refresh_timeout):
                    return
                self._protected_refresh(is_mandatory=True)

    def _protected_refresh(self, is_mandatory):
        # precondition: this method should only be called if you've acquired
        # the self._refresh_lock.
        try:
            metadata = self._refresh_using()
        except Exception as e:
            period_name = 'mandatory' if is_mandatory else 'advisory'
            logger.warning("Refreshing temporary credentials failed "
                           "during %s refresh period.",
                           period_name, exc_info=True)
            if is_mandatory:
                # If this is a mandatory refresh, then
                # all errors that occur when we attempt to refresh
                # credentials are propagated back to the user.
                raise
            # Otherwise we'll just return.
            # The end result will be that we'll use the current
            # set of temporary credentials we have.
            return
        self._set_from_data(metadata)
        if self._is_expired():
            # We successfully refreshed credentials but for whatever
            # reason, our refreshing function returned credentials
            # that are still expired.  In this scenario, the only
            # thing we can do is let the user know and raise
            # an exception.
            msg = ("Credentials were refreshed, but the "
                   "refreshed credentials are still expired.")
            logger.warning(msg)
            raise RuntimeError(msg)
        self._frozen_credentials = ReadOnlyCredentials(
            self._access_key, self._secret_key, self._token)

    @staticmethod
    def _expiry_datetime(time_str):
        return parse(time_str)

    def _set_from_data(self, data):
        self.access_key = data['access_key']
        self.secret_key = data['secret_key']
        self.token = data['token']
        self._expiry_time = parse(data['expiry_time'])
        logger.debug("Retrieved credentials will expire at: %s",
                     self._expiry_time)
        self._normalize()

    def get_frozen_credentials(self):
        """Return immutable credentials.

        The ``access_key``, ``secret_key``, and ``token`` properties
        on this class will always check and refresh credentials if
        needed before returning the particular credentials.

        This has an edge case where you can get inconsistent
        credentials.  Imagine this:

            # Current creds are "t1"
            tmp.access_key  ---> expired? no, so return t1.access_key
            # ---- time is now expired, creds need refreshing to "t2" ----
            tmp.secret_key  ---> expired? yes, refresh and return t2.secret_key

        This means we're using the access key from t1 with the secret key
        from t2.  To fix this issue, you can request a frozen credential object
        which is guaranteed not to change.

        The frozen credentials returned from this method should be used
        immediately and then discarded.  The typical usage pattern would
        be::

            creds = RefreshableCredentials(...)
            some_code = SomeSignerObject()
            # I'm about to sign the request.
            # The frozen credentials are only used for the
            # duration of generate_presigned_url and will be
            # immediately thrown away.
            request = some_code.sign_some_request(
                with_credentials=creds.get_frozen_credentials())
            print("Signed request:", request)

        """
        self._refresh()
        return self._frozen_credentials


class CredentialProvider(object):

    # Implementations must provide a method.
    METHOD = None

    def __init__(self, session=None):
        self.session = session

    def load(self):
        """
        Loads the credentials from their source & sets them on the object.

        Subclasses should implement this method (by reading from disk, the
        environment, the network or wherever), returning ``True`` if they were
        found & loaded.

        If not found, this method should return ``False``, indictating that the
        ``CredentialResolver`` should fall back to the next available method.

        The default implementation does nothing, assuming the user has set the
        ``access_key/secret_key/token`` themselves.

        :returns: Whether credentials were found & set
        :rtype: boolean
        """
        return True

    def _extract_creds_from_mapping(self, mapping, *key_names):
        found = []
        for key_name in key_names:
            try:
                found.append(mapping[key_name])
            except KeyError:
                raise PartialCredentialsError(provider=self.METHOD,
                                              cred_var=key_name)
        return found


class InstanceMetadataProvider(CredentialProvider):
    METHOD = 'iam-role'

    def __init__(self, iam_role_fetcher):
        self._role_fetcher = iam_role_fetcher

    def load(self):
        fetcher = self._role_fetcher
        # We do the first request, to see if we get useful data back.
        # If not, we'll pass & move on to whatever's next in the credential
        # chain.
        metadata = fetcher.retrieve_iam_role_credentials()
        if not metadata:
            return None
        logger.debug('Found credentials from IAM Role: %s',
                    metadata['role_name'])
        # We manually set the data here, since we already made the request &
        # have it. When the expiry is hit, the credentials will auto-refresh
        # themselves.
        creds = RefreshableCredentials.create_from_metadata(
            metadata,
            method=self.METHOD,
            refresh_using=fetcher.retrieve_iam_role_credentials,
        )
        return creds


class EnvProvider(CredentialProvider):
    METHOD = 'env'
    ACCESS_KEY = 'AWS_ACCESS_KEY_ID'
    SECRET_KEY = 'AWS_SECRET_ACCESS_KEY'
    # The token can come from either of these env var.
    # AWS_SESSION_TOKEN is what other AWS SDKs have standardized on.
    TOKENS = ['AWS_SECURITY_TOKEN', 'AWS_SESSION_TOKEN']
    EXPIRY_TIME = 'AWS_CREDENTIAL_EXPIRATION'

    def __init__(self, environ=None, mapping=None):
        """

        :param environ: The environment variables (defaults to
            ``os.environ`` if no value is provided).
        :param mapping: An optional mapping of variable names to
            environment variable names.  Use this if you want to
            change the mapping of access_key->AWS_ACCESS_KEY_ID, etc.
            The dict can have up to 3 keys: ``access_key``, ``secret_key``,
            ``session_token``.
        """
        if environ is None:
            environ = os.environ
        self.environ = environ
        self._mapping = self._build_mapping(mapping)

    def _build_mapping(self, mapping):
        # Mapping of variable name to env var name.
        var_mapping = {}
        if mapping is None:
            # Use the class var default.
            var_mapping['access_key'] = self.ACCESS_KEY
            var_mapping['secret_key'] = self.SECRET_KEY
            var_mapping['token'] = self.TOKENS
            var_mapping['expiry_time'] = self.EXPIRY_TIME
        else:
            var_mapping['access_key'] = mapping.get(
                'access_key', self.ACCESS_KEY)
            var_mapping['secret_key'] = mapping.get(
                'secret_key', self.SECRET_KEY)
            var_mapping['token'] = mapping.get(
                'token', self.TOKENS)
            if not isinstance(var_mapping['token'], list):
                var_mapping['token'] = [var_mapping['token']]
            var_mapping['expiry_time'] = mapping.get(
                'expiry_time', self.EXPIRY_TIME)
        return var_mapping

    def load(self):
        """
        Search for credentials in explicit environment variables.
        """
        if self._mapping['access_key'] in self.environ:
            logger.info('Found credentials in environment variables.')
            fetcher = self._create_credentials_fetcher()
            credentials = fetcher(require_expiry=False)

            expiry_time = credentials['expiry_time']
            if expiry_time is not None:
                expiry_time = parse(expiry_time)
                return RefreshableCredentials(
                    credentials['access_key'], credentials['secret_key'],
                    credentials['token'], expiry_time,
                    refresh_using=fetcher, method=self.METHOD
                )

            return Credentials(
                credentials['access_key'], credentials['secret_key'],
                credentials['token'], method=self.METHOD
            )
        else:
            return None

    def _create_credentials_fetcher(self):
        mapping = self._mapping
        method = self.METHOD
        environ = self.environ

        def fetch_credentials(require_expiry=True):
            credentials = {}

            access_key = environ.get(mapping['access_key'])
            if access_key is None:
                raise PartialCredentialsError(
                    provider=method, cred_var=mapping['access_key'])
            credentials['access_key'] = access_key

            secret_key = environ.get(mapping['secret_key'])
            if secret_key is None:
                raise PartialCredentialsError(
                    provider=method, cred_var=mapping['secret_key'])
            credentials['secret_key'] = secret_key

            token = None
            for token_env_var in mapping['token']:
                if token_env_var in environ:
                    token = environ[token_env_var]
                    break
            credentials['token'] = token

            expiry_time = environ.get(mapping['expiry_time'])
            if require_expiry and expiry_time is None:
                raise PartialCredentialsError(
                    provider=method, cred_var=mapping['expiry_time'])
            credentials['expiry_time'] = expiry_time

            return credentials

        return fetch_credentials


class OriginalEC2Provider(CredentialProvider):
    METHOD = 'ec2-credentials-file'

    CRED_FILE_ENV = 'AWS_CREDENTIAL_FILE'
    ACCESS_KEY = 'AWSAccessKeyId'
    SECRET_KEY = 'AWSSecretKey'

    def __init__(self, environ=None, parser=None):
        if environ is None:
            environ = os.environ
        if parser is None:
            parser = parse_key_val_file
        self._environ = environ
        self._parser = parser

    def load(self):
        """
        Search for a credential file used by original EC2 CLI tools.
        """
        if 'AWS_CREDENTIAL_FILE' in self._environ:
            full_path = os.path.expanduser(self._environ['AWS_CREDENTIAL_FILE'])
            creds = self._parser(full_path)
            if self.ACCESS_KEY in creds:
                logger.info('Found credentials in AWS_CREDENTIAL_FILE.')
                access_key = creds[self.ACCESS_KEY]
                secret_key = creds[self.SECRET_KEY]
                # EC2 creds file doesn't support session tokens.
                return Credentials(access_key, secret_key, method=self.METHOD)
        else:
            return None


class SharedCredentialProvider(CredentialProvider):
    METHOD = 'shared-credentials-file'

    ACCESS_KEY = 'aws_access_key_id'
    SECRET_KEY = 'aws_secret_access_key'
    # Same deal as the EnvProvider above.  Botocore originally supported
    # aws_security_token, but the SDKs are standardizing on aws_session_token
    # so we support both.
    TOKENS = ['aws_security_token', 'aws_session_token']

    def __init__(self, creds_filename, profile_name=None, ini_parser=None):
        self._creds_filename = creds_filename
        if profile_name is None:
            profile_name = 'default'
        self._profile_name = profile_name
        if ini_parser is None:
            ini_parser = botocore.configloader.raw_config_parse
        self._ini_parser = ini_parser

    def load(self):
        try:
            available_creds = self._ini_parser(self._creds_filename)
        except ConfigNotFound:
            return None
        if self._profile_name in available_creds:
            config = available_creds[self._profile_name]
            if self.ACCESS_KEY in config:
                logger.info("Found credentials in shared credentials file: %s",
                            self._creds_filename)
                access_key, secret_key = self._extract_creds_from_mapping(
                    config, self.ACCESS_KEY, self.SECRET_KEY)
                token = self._get_session_token(config)
                return Credentials(access_key, secret_key, token,
                                   method=self.METHOD)

    def _get_session_token(self, config):
        for token_envvar in self.TOKENS:
            if token_envvar in config:
                return config[token_envvar]


class ConfigProvider(CredentialProvider):
    """INI based config provider with profile sections."""
    METHOD = 'config-file'

    ACCESS_KEY = 'aws_access_key_id'
    SECRET_KEY = 'aws_secret_access_key'
    # Same deal as the EnvProvider above.  Botocore originally supported
    # aws_security_token, but the SDKs are standardizing on aws_session_token
    # so we support both.
    TOKENS = ['aws_security_token', 'aws_session_token']

    def __init__(self, config_filename, profile_name, config_parser=None):
        """

        :param config_filename: The session configuration scoped to the current
            profile.  This is available via ``session.config``.
        :param profile_name: The name of the current profile.
        :param config_parser: A config parser callable.

        """
        self._config_filename = config_filename
        self._profile_name = profile_name
        if config_parser is None:
            config_parser = botocore.configloader.load_config
        self._config_parser = config_parser

    def load(self):
        """
        If there is are credentials in the configuration associated with
        the session, use those.
        """
        try:
            full_config = self._config_parser(self._config_filename)
        except ConfigNotFound:
            return None
        if self._profile_name in full_config['profiles']:
            profile_config = full_config['profiles'][self._profile_name]
            if self.ACCESS_KEY in profile_config:
                logger.info("Credentials found in config file: %s",
                            self._config_filename)
                access_key, secret_key = self._extract_creds_from_mapping(
                    profile_config, self.ACCESS_KEY, self.SECRET_KEY)
                token = self._get_session_token(profile_config)
                return Credentials(access_key, secret_key, token,
                                   method=self.METHOD)
        else:
            return None

    def _get_session_token(self, profile_config):
        for token_name in self.TOKENS:
            if token_name in profile_config:
                return profile_config[token_name]


class BotoProvider(CredentialProvider):
    METHOD = 'boto-config'

    BOTO_CONFIG_ENV = 'BOTO_CONFIG'
    DEFAULT_CONFIG_FILENAMES = ['/etc/boto.cfg', '~/.boto']
    ACCESS_KEY = 'aws_access_key_id'
    SECRET_KEY = 'aws_secret_access_key'

    def __init__(self, environ=None, ini_parser=None):
        if environ is None:
            environ = os.environ
        if ini_parser is None:
            ini_parser = botocore.configloader.raw_config_parse
        self._environ = environ
        self._ini_parser = ini_parser

    def load(self):
        """
        Look for credentials in boto config file.
        """
        if self.BOTO_CONFIG_ENV in self._environ:
            potential_locations = [self._environ[self.BOTO_CONFIG_ENV]]
        else:
            potential_locations = self.DEFAULT_CONFIG_FILENAMES
        for filename in potential_locations:
            try:
                config = self._ini_parser(filename)
            except ConfigNotFound:
                # Move on to the next potential config file name.
                continue
            if 'Credentials' in config:
                credentials = config['Credentials']
                if self.ACCESS_KEY in credentials:
                    logger.info("Found credentials in boto config file: %s",
                                filename)
                    access_key, secret_key = self._extract_creds_from_mapping(
                        credentials, self.ACCESS_KEY, self.SECRET_KEY)
                    return Credentials(access_key, secret_key,
                                       method=self.METHOD)


class AssumeRoleProvider(CredentialProvider):

    METHOD = 'assume-role'
    ROLE_CONFIG_VAR = 'role_arn'
    # Credentials are considered expired (and will be refreshed) once the total
    # remaining time left until the credentials expires is less than the
    # EXPIRY_WINDOW.
    EXPIRY_WINDOW_SECONDS = 60 * 15

    def __init__(self, load_config, client_creator, cache, profile_name,
                 prompter=getpass.getpass):
        """

        :type load_config: callable
        :param load_config: A function that accepts no arguments, and
            when called, will return the full configuration dictionary
            for the session (``session.full_config``).

        :type client_creator: callable
        :param client_creator: A factory function that will create
            a client when called.  Has the same interface as
            ``botocore.session.Session.create_client``.

        :type cache: JSONFileCache
        :param cache: An object that supports ``__getitem__``,
            ``__setitem__``, and ``__contains__``.  An example
            of this is the ``JSONFileCache`` class.

        :type profile_name: str
        :param profile_name: The name of the profile.

        :type prompter: callable
        :param prompter: A callable that returns input provided
            by the user (i.e raw_input, getpass.getpass, etc.).

        """
        #: The cache used to first check for assumed credentials.
        #: This is checked before making the AssumeRole API
        #: calls and can be useful if you have short lived
        #: scripts and you'd like to avoid calling AssumeRole
        #: until the credentials are expired.
        self.cache = cache
        self._load_config = load_config
        # client_creator is a callable that creates function.
        # It's basically session.create_client
        self._client_creator = client_creator
        self._profile_name = profile_name
        self._prompter = prompter
        # The _loaded_config attribute will be populated from the
        # load_config() function once the configuration is actually
        # loaded.  The reason we go through all this instead of just
        # requiring that the loaded_config be passed to us is to that
        # we can defer configuration loaded until we actually try
        # to load credentials (as opposed to when the object is
        # instantiated).
        self._loaded_config = {}

    def load(self):
        self._loaded_config = self._load_config()
        if self._has_assume_role_config_vars():
            return self._load_creds_via_assume_role()

    def _has_assume_role_config_vars(self):
        profiles = self._loaded_config.get('profiles', {})
        return self.ROLE_CONFIG_VAR in profiles.get(self._profile_name, {})

    def _load_creds_via_assume_role(self):
        # We can get creds in one of two ways:
        # * It can either be cached on disk from an pre-existing session
        # * Cache doesn't have the creds (or is expired) so we need to make
        #   an assume role call to get temporary creds, which we then cache
        #   for subsequent requests.
        creds = self._load_creds_from_cache()
        if creds is not None:
            logger.debug("Credentials for role retrieved from cache.")
            return creds
        else:
            # We get the Credential used by botocore as well
            # as the original parsed response from the server.
            creds, response = self._retrieve_temp_credentials()
            cache_key = self._create_cache_key()
            self._write_cached_credentials(response, cache_key)
            return creds

    def _load_creds_from_cache(self):
        cache_key = self._create_cache_key()
        try:
            from_cache = self.cache[cache_key]
            if self._is_expired(from_cache):
                # Don't need to delete the cache entry,
                # when we refresh via AssumeRole, we'll
                # update the cache with the new entry.
                logger.debug(
                    "Credentials were found in cache, but they are expired.")
                return None
            else:
                return self._create_creds_from_response(from_cache)
        except KeyError:
            return None

    def _is_expired(self, credentials):
        end_time = _parse_if_needed(credentials['Credentials']['Expiration'])
        now = datetime.datetime.now(tzlocal())
        seconds = total_seconds(end_time - now)
        return seconds < self.EXPIRY_WINDOW_SECONDS

    def _create_cache_key(self):
        role_config = self._get_role_config_values()
        # On windows, ':' is not allowed in filenames, so we'll
        # replace them with '_' instead.
        role_arn = role_config['role_arn'].replace(':', '_')
        role_session_name = role_config.get('role_session_name')
        if role_session_name:
            cache_key = '%s--%s--%s' % (self._profile_name, role_arn,
                                        role_session_name)
        else:
            cache_key = '%s--%s' % (self._profile_name, role_arn)

        return cache_key.replace('/', '-')

    def _write_cached_credentials(self, creds, cache_key):
        self.cache[cache_key] = creds

    def _get_role_config_values(self):
        # This returns the role related configuration.
        profiles = self._loaded_config.get('profiles', {})
        try:
            source_profile = profiles[self._profile_name]['source_profile']
            role_arn = profiles[self._profile_name]['role_arn']
            mfa_serial = profiles[self._profile_name].get('mfa_serial')
        except KeyError as e:
            raise PartialCredentialsError(provider=self.METHOD,
                                          cred_var=str(e))
        external_id = profiles[self._profile_name].get('external_id')
        role_session_name = \
            profiles[self._profile_name].get('role_session_name')
        if source_profile not in profiles:
            raise InvalidConfigError(
                error_msg=(
                    'The source_profile "%s" referenced in '
                    'the profile "%s" does not exist.' % (
                        source_profile, self._profile_name)))
        source_cred_values = profiles[source_profile]
        return {
            'role_arn': role_arn,
            'external_id': external_id,
            'source_profile': source_profile,
            'mfa_serial': mfa_serial,
            'source_cred_values': source_cred_values,
            'role_session_name': role_session_name
        }

    def _create_creds_from_response(self, response):
        config = self._get_role_config_values()
        if config.get('mfa_serial') is not None:
            # MFA would require getting a new TokenCode which would require
            # prompting the user for a new token, so we use a different
            # refresh_func.
            refresh_func = create_mfa_serial_refresher()
        else:
            refresh_func = create_assume_role_refresher(
                self._create_client_from_config(config),
                self._assume_role_base_kwargs(config))
        return RefreshableCredentials(
            access_key=response['Credentials']['AccessKeyId'],
            secret_key=response['Credentials']['SecretAccessKey'],
            token=response['Credentials']['SessionToken'],
            method=self.METHOD,
            expiry_time=_parse_if_needed(
                response['Credentials']['Expiration']),
            refresh_using=refresh_func)

    def _create_client_from_config(self, config):
        source_cred_values = config['source_cred_values']
        client = self._client_creator(
            'sts', aws_access_key_id=source_cred_values['aws_access_key_id'],
            aws_secret_access_key=source_cred_values['aws_secret_access_key'],
            aws_session_token=source_cred_values.get('aws_session_token'),
        )
        return client

    def _retrieve_temp_credentials(self):
        logger.debug("Retrieving credentials via AssumeRole.")
        config = self._get_role_config_values()
        client = self._create_client_from_config(config)

        assume_role_kwargs = self._assume_role_base_kwargs(config)

        response = client.assume_role(**assume_role_kwargs)
        creds = self._create_creds_from_response(response)
        return creds, response

    def _assume_role_base_kwargs(self, config):
        assume_role_kwargs = {'RoleArn': config['role_arn']}
        if config['external_id'] is not None:
            assume_role_kwargs['ExternalId'] = config['external_id']
        if config['mfa_serial'] is not None:
            token_code = self._prompter("Enter MFA code: ")
            assume_role_kwargs['SerialNumber'] = config['mfa_serial']
            assume_role_kwargs['TokenCode'] = token_code
        if config['role_session_name'] is not None:
            assume_role_kwargs['RoleSessionName'] = config['role_session_name']
        else:
            role_session_name = 'AWS-CLI-session-%s' % (int(time.time()))
            assume_role_kwargs['RoleSessionName'] = role_session_name
        return assume_role_kwargs


class ContainerProvider(CredentialProvider):

    METHOD = 'container-role'
    ENV_VAR = 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI'
    ENV_VAR_FULL = 'AWS_CONTAINER_CREDENTIALS_FULL_URI'
    ENV_VAR_AUTH_TOKEN = 'AWS_CONTAINER_AUTHORIZATION_TOKEN'

    def __init__(self, environ=None, fetcher=None):
        if environ is None:
            environ = os.environ
        if fetcher is None:
            fetcher = ContainerMetadataFetcher()
        self._environ = environ
        self._fetcher = fetcher

    def load(self):
        # This cred provider is only triggered if the self.ENV_VAR is set,
        # which only happens if you opt into this feature.
        if self.ENV_VAR in self._environ or self.ENV_VAR_FULL in self._environ:
            return self._retrieve_or_fail()

    def _retrieve_or_fail(self):
        if self._provided_relative_uri():
            full_uri = self._fetcher.full_url(self._environ[self.ENV_VAR])
        else:
            full_uri = self._environ[self.ENV_VAR_FULL]
        headers = self._build_headers()
        fetcher = self._create_fetcher(full_uri, headers)
        creds = fetcher()
        return RefreshableCredentials(
            access_key=creds['access_key'],
            secret_key=creds['secret_key'],
            token=creds['token'],
            method=self.METHOD,
            expiry_time=_parse_if_needed(creds['expiry_time']),
            refresh_using=fetcher,
        )

    def _build_headers(self):
        headers = {}
        auth_token = self._environ.get(self.ENV_VAR_AUTH_TOKEN)
        if auth_token is not None:
            return {
                'Authorization': auth_token
            }

    def _create_fetcher(self, full_uri, headers):
        def fetch_creds():
            try:
                response = self._fetcher.retrieve_full_uri(
                    full_uri, headers=headers)
            except MetadataRetrievalError as e:
                logger.debug("Error retrieving container metadata: %s", e,
                             exc_info=True)
                raise CredentialRetrievalError(provider=self.METHOD,
                                               error_msg=str(e))
            return {
                'access_key': response['AccessKeyId'],
                'secret_key': response['SecretAccessKey'],
                'token': response['Token'],
                'expiry_time': response['Expiration'],
            }
        return fetch_creds

    def _provided_relative_uri(self):
        return self.ENV_VAR in self._environ


class CredentialResolver(object):

    def __init__(self, providers):
        """

        :param providers: A list of ``CredentialProvider`` instances.

        """
        self.providers = providers

    def insert_before(self, name, credential_provider):
        """
        Inserts a new instance of ``CredentialProvider`` into the chain that
        will be tried before an existing one.

        :param name: The short name of the credentials you'd like to insert the
            new credentials before. (ex. ``env`` or ``config``). Existing names
            & ordering can be discovered via ``self.available_methods``.
        :type name: string

        :param cred_instance: An instance of the new ``Credentials`` object
            you'd like to add to the chain.
        :type cred_instance: A subclass of ``Credentials``
        """
        try:
            offset = [p.METHOD for p in self.providers].index(name)
        except ValueError:
            raise UnknownCredentialError(name=name)
        self.providers.insert(offset, credential_provider)

    def insert_after(self, name, credential_provider):
        """
        Inserts a new type of ``Credentials`` instance into the chain that will
        be tried after an existing one.

        :param name: The short name of the credentials you'd like to insert the
            new credentials after. (ex. ``env`` or ``config``). Existing names
            & ordering can be discovered via ``self.available_methods``.
        :type name: string

        :param cred_instance: An instance of the new ``Credentials`` object
            you'd like to add to the chain.
        :type cred_instance: A subclass of ``Credentials``
        """
        offset = self._get_provider_offset(name)
        self.providers.insert(offset + 1, credential_provider)

    def remove(self, name):
        """
        Removes a given ``Credentials`` instance from the chain.

        :param name: The short name of the credentials instance to remove.
        :type name: string
        """
        available_methods = [p.METHOD for p in self.providers]
        if name not in available_methods:
            # It's not present. Fail silently.
            return

        offset = available_methods.index(name)
        self.providers.pop(offset)

    def get_provider(self, name):
        """Return a credential provider by name.

        :type name: str
        :param name: The name of the provider.

        :raises UnknownCredentialError: Raised if no
            credential provider by the provided name
            is found.
        """
        return self.providers[self._get_provider_offset(name)]

    def _get_provider_offset(self, name):
        try:
            return [p.METHOD for p in self.providers].index(name)
        except ValueError:
            raise UnknownCredentialError(name=name)

    def load_credentials(self):
        """
        Goes through the credentials chain, returning the first ``Credentials``
        that could be loaded.
        """
        # First provider to return a non-None response wins.
        for provider in self.providers:
            logger.debug("Looking for credentials via: %s", provider.METHOD)
            creds = provider.load()
            if creds is not None:
                return creds

        # If we got here, no credentials could be found.
        # This feels like it should be an exception, but historically, ``None``
        # is returned.
        #
        # +1
        # -js
        return None
