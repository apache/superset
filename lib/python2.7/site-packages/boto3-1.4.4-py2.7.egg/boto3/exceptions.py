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

# All exceptions in this class should subclass from Boto3Error.
import botocore.exceptions


# All exceptions should subclass from Boto3Error in this module.
class Boto3Error(Exception):
    """Base class for all Boto3 errors."""


class ResourceLoadException(Boto3Error):
    pass


# NOTE: This doesn't appear to be used anywhere.
# It's probably safe to remove this.
class NoVersionFound(Boto3Error):
    pass


# We're subclassing from botocore.exceptions.DataNotFoundError
# to keep backwards compatibility with anyone that was catching
# this low level Botocore error before this exception was
# introduced in boto3.
# Same thing for ResourceNotExistsError below.
class UnknownAPIVersionError(Boto3Error,
                             botocore.exceptions.DataNotFoundError):
    def __init__(self, service_name, bad_api_version,
                 available_api_versions):
        msg = (
            "The '%s' resource does not an API version of: %s\n"
            "Valid API versions are: %s"
            % (service_name, bad_api_version, available_api_versions)
        )
        # Not using super because we don't want the DataNotFoundError
        # to be called, it has a different __init__ signature.
        Boto3Error.__init__(self, msg)


class ResourceNotExistsError(Boto3Error,
                             botocore.exceptions.DataNotFoundError):
    """Raised when you attempt to create a resource that does not exist."""
    def __init__(self, service_name, available_services, has_low_level_client):
        msg = (
            "The '%s' resource does not exist.\n"
            "The available resources are:\n"
            "   - %s\n" % (service_name, '\n   - '.join(available_services))
        )
        if has_low_level_client:
            msg += (
                "\nConsider using a boto3.client('%s') instead "
                "of a resource for '%s'" % (service_name, service_name))
        # Not using super because we don't want the DataNotFoundError
        # to be called, it has a different __init__ signature.
        Boto3Error.__init__(self, msg)


class RetriesExceededError(Boto3Error):
    def __init__(self, last_exception, msg='Max Retries Exceeded'):
        super(RetriesExceededError, self).__init__(msg)
        self.last_exception = last_exception


class S3TransferFailedError(Boto3Error):
    pass


class S3UploadFailedError(Boto3Error):
    pass


class DynamoDBOperationNotSupportedError(Boto3Error):
    """Raised for operantions that are not supported for an operand"""
    def __init__(self, operation, value):
        msg = (
            '%s operation cannot be applied to value %s of type %s directly. '
            'Must use AttributeBase object methods (i.e. Attr().eq()). to '
            'generate ConditionBase instances first.' %
            (operation, value, type(value)))
        Exception.__init__(self, msg)

# FIXME: Backward compatibility
DynanmoDBOperationNotSupportedError = DynamoDBOperationNotSupportedError


class DynamoDBNeedsConditionError(Boto3Error):
    """Raised when input is not a condition"""
    def __init__(self, value):
        msg = (
            'Expecting a ConditionBase object. Got %s of type %s. '
            'Use AttributeBase object methods (i.e. Attr().eq()). to '
            'generate ConditionBase instances.' % (value, type(value)))
        Exception.__init__(self, msg)


class DynamoDBNeedsKeyConditionError(Boto3Error):
    pass
