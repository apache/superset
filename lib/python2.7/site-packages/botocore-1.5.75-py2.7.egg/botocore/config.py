# Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import copy
from botocore.compat import OrderedDict

from botocore.endpoint import DEFAULT_TIMEOUT, MAX_POOL_CONNECTIONS
from botocore.exceptions import InvalidS3AddressingStyleError


class Config(object):
    """Advanced configuration for Botocore clients.

    :type region_name: str
    :param region_name: The region to use in instantiating the client

    :type signature_version: str
    :param signature_version: The signature version when signing requests.

    :type user_agent: str
    :param user_agent: The value to use in the User-Agent header.

    :type user_agent_extra: str
    :param user_agent_extra: The value to append to the current User-Agent
        header value.

    :type connect_timeout: int
    :param connect_timeout: The time in seconds till a timeout exception is
        thrown when attempting to make a connection. The default is 60
        seconds.

    :type read_timeout: int
    :param read_timeout: The time in seconds till a timeout exception is
        thrown when attempting to read from a connection. The default is
        60 seconds.

    :type parameter_validation: bool
    :param parameter_validation: Whether parameter validation should occur
        when serializing requests. The default is True.  You can disable
        parameter validation for performance reasons.  Otherwise, it's
        recommended to leave parameter validation enabled.

    :type max_pool_connections: int
    :param max_pool_connections: The maximum number of connections to
        keep in a connection pool.  If this value is not set, the default
        value of 10 is used.

    :type s3: dict
    :param s3: A dictionary of s3 specific configurations.
        Valid keys are:

        * 'use_accelerate_endpoint' -- Refers to whether to use the S3
          Accelerate endpoint. The value must be a boolean. If True, the
          client will use the S3 Accelerate endpoint. If the S3 Accelerate
          endpoint is being used then the addressing style will always
          be virtual.

        * 'payload_signing_enabled' -- Refers to whether or not to SHA256
          sign sigv4 payloads. By default, this is disabled for streaming
          uploads (UploadPart and PutObject).

        * 'addressing_style' -- Refers to the style in which to address
          s3 endpoints. Values must be a string that equals:

          * auto -- Addressing style is chosen for user. Depending
            on the configuration of client, the endpoint may be addressed in
            the virtual or the path style. Note that this is the default
            behavior if no style is specified.

          * virtual -- Addressing style is always virtual. The name of the
            bucket must be DNS compatible or an exception will be thrown.
            Endpoints will be addressed as such: mybucket.s3.amazonaws.com

          * path -- Addressing style is always by path. Endpoints will be
            addressed as such: s3.amazonaws.com/mybucket
    """
    OPTION_DEFAULTS = OrderedDict([
        ('region_name', None),
        ('signature_version', None),
        ('user_agent', None),
        ('user_agent_extra', None),
        ('connect_timeout', DEFAULT_TIMEOUT),
        ('read_timeout', DEFAULT_TIMEOUT),
        ('parameter_validation', True),
        ('max_pool_connections', MAX_POOL_CONNECTIONS),
        ('s3', None)
    ])

    def __init__(self, *args, **kwargs):
        self._user_provided_options = self._record_user_provided_options(
            args, kwargs)

        # Merge the user_provided options onto the default options
        config_vars = copy.copy(self.OPTION_DEFAULTS)
        config_vars.update(self._user_provided_options)

        # Set the attributes based on the config_vars
        for key, value in config_vars.items():
            setattr(self, key, value)

        # Validate the s3 options
        self._validate_s3_configuration(self.s3)

    def _record_user_provided_options(self, args, kwargs):
        option_order = list(self.OPTION_DEFAULTS)
        user_provided_options = {}

        # Iterate through the kwargs passed through to the constructor and
        # map valid keys to the dictionary
        for key, value in kwargs.items():
            if key in self.OPTION_DEFAULTS:
                user_provided_options[key] = value
            # The key must exist in the available options
            else:
                raise TypeError(
                    'Got unexpected keyword argument \'%s\'' % key)

        # The number of args should not be longer than the allowed
        # options
        if len(args) > len(option_order):
            raise TypeError(
                'Takes at most %s arguments (%s given)' % (
                    len(option_order), len(args)))

        # Iterate through the args passed through to the constructor and map
        # them to appropriate keys.
        for i, arg in enumerate(args):
            # If it a kwarg was specified for the arg, then error out
            if option_order[i] in user_provided_options:
                raise TypeError(
                    'Got multiple values for keyword argument \'%s\'' % (
                        option_order[i]))
            user_provided_options[option_order[i]] = arg

        return user_provided_options

    def _validate_s3_configuration(self, s3):
        if s3 is not None:
            addressing_style = s3.get('addressing_style')
            if addressing_style not in ['virtual', 'auto', 'path', None]:
                raise InvalidS3AddressingStyleError(
                    s3_addressing_style=addressing_style)

    def merge(self, other_config):
        """Merges the config object with another config object

        This will merge in all non-default values from the provided config
        and return a new config object

        :type other_config: botocore.config.Config
        :param other config: Another config object to merge with. The values
            in the provided config object will take precedence in the merging

        :returns: A config object built from the merged values of both
            config objects.
        """
        # Make a copy of the current attributes in the config object.
        config_options = copy.copy(self._user_provided_options)

        # Merge in the user provided options from the other config
        config_options.update(other_config._user_provided_options)

        # Return a new config object with the merged properties.
        return Config(**config_options)
