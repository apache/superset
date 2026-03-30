# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from superset.exceptions import SupersetException


class NotificationError(SupersetException):
    """
    Generic unknown exception - only used when
    bubbling up unknown exceptions from lower levels
    """


class SlackV1NotificationError(SupersetException):
    """
    Report should not be run with the slack v1 api
    """

    message = """Report should not be run with the Slack V1 api.
    Attempting to run with V2 if required Slack scopes are available"""

    status = 422


class NotificationParamException(SupersetException):
    status = 422


class NotificationAuthorizationException(SupersetException):
    status = 401


class NotificationUnprocessableException(SupersetException):
    """
    When a third party client service is down.
    The request should be retried. There is no further
    action required on our part or the user's other than to retry
    """

    status = 400


class NotificationMalformedException(SupersetException):
    status = 400
