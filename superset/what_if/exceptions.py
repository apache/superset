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
"""What-If Analysis exceptions."""

from superset.exceptions import SupersetException


class WhatIfException(SupersetException):
    """Base exception for What-If Analysis errors."""


class OpenRouterConfigError(WhatIfException):
    """Raised when OpenRouter API is not configured."""

    status = 500
    message = "OpenRouter API is not configured"


class OpenRouterAPIError(WhatIfException):
    """Raised when there is an error communicating with OpenRouter API."""

    status = 502
    message = "Error communicating with OpenRouter API"
