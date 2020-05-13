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
# pylint: disable=too-few-public-methods
from enum import Enum
from typing import Any, Dict, Optional

from dataclasses import dataclass


class SupersetErrorType(str, Enum):
    """
    Types of errors that can exist within Superset.

    Keep in sync with superset-frontend/src/components/ErrorMessage/types.ts
    """

    FRONTEND_CSRF_ERROR = "FRONTEND_CSRF_ERROR"
    FRONTEND_NETWORK_ERROR = "FRONTEND_NETWORK_ERROR"
    FRONTEND_TIMEOUT_ERROR = "FRONTEND_TIMEOUT_ERROR"

    GENERIC_DB_ENGINE_ERROR = "GENERIC_DB_ENGINE_ERROR"

    VIZ_GET_DF_ERROR = "VIZ_GET_DF_ERROR"


class ErrorLevel(str, Enum):
    """
    Levels of errors that can exist within Superset.

    Keep in sync with superset-frontend/src/components/ErrorMessage/types.ts
    """

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class SupersetError:
    """
    An error that is returned to a client.
    """

    message: str
    error_type: SupersetErrorType
    level: ErrorLevel
    extra: Optional[Dict[str, Any]] = None
