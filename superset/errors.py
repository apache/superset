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
# pylint: disable=too-few-public-methods,invalid-name
from enum import Enum
from typing import Any, Dict, Optional

from dataclasses import dataclass
from flask_babel import gettext as _


class SupersetErrorType(str, Enum):
    """
    Types of errors that can exist within Superset.

    Keep in sync with superset-frontend/src/components/ErrorMessage/types.ts
    """

    # Frontend errors
    FRONTEND_CSRF_ERROR = "FRONTEND_CSRF_ERROR"
    FRONTEND_NETWORK_ERROR = "FRONTEND_NETWORK_ERROR"
    FRONTEND_TIMEOUT_ERROR = "FRONTEND_TIMEOUT_ERROR"

    # DB Engine errors
    GENERIC_DB_ENGINE_ERROR = "GENERIC_DB_ENGINE_ERROR"

    # Viz errors
    VIZ_GET_DF_ERROR = "VIZ_GET_DF_ERROR"
    UNKNOWN_DATASOURCE_TYPE_ERROR = "UNKNOWN_DATASOURCE_TYPE_ERROR"
    FAILED_FETCHING_DATASOURCE_INFO_ERROR = "FAILED_FETCHING_DATASOURCE_INFO_ERROR"

    # Security access errors
    TABLE_SECURITY_ACCESS_ERROR = "TABLE_SECURITY_ACCESS_ERROR"
    DATASOURCE_SECURITY_ACCESS_ERROR = "DATASOURCE_SECURITY_ACCESS_ERROR"
    MISSING_OWNERSHIP_ERROR = "MISSING_OWNERSHIP_ERROR"

    # Other errors
    BACKEND_TIMEOUT_ERROR = "BACKEND_TIMEOUT_ERROR"


ERROR_TYPES_TO_ISSUE_CODES_MAPPING = {
    SupersetErrorType.BACKEND_TIMEOUT_ERROR: [
        {
            "code": 1000,
            "message": _("Issue 1000 - The datasource is too large to query."),
        },
        {
            "code": 1001,
            "message": _("Issue 1001 - The database is under an unusual load."),
        },
    ]
}


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

    def __post_init__(self) -> None:
        """
        Mutates the extra params with user facing error codes that map to backend
        errors.
        """
        issue_codes = ERROR_TYPES_TO_ISSUE_CODES_MAPPING.get(self.error_type)
        if issue_codes:
            self.extra = self.extra or {}
            self.extra.update({"issue_codes": issue_codes})
