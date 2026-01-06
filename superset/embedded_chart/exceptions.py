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


class EmbeddedChartPermalinkNotFoundError(SupersetException):
    """Raised when an embedded chart permalink is not found or has expired."""

    message = "The embedded chart permalink could not be found or has expired."


class EmbeddedChartAccessDeniedError(SupersetException):
    """Raised when access to an embedded chart is denied."""

    message = "Access to this embedded chart is denied."


class EmbeddedChartFeatureDisabledError(SupersetException):
    """Raised when the embeddable charts feature is disabled."""

    message = "The embeddable charts feature is not enabled."
