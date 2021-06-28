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
from dataclasses import dataclass  # pylint: disable=wrong-import-order
from enum import Enum
from typing import Any, Dict, Optional

from flask_babel import gettext as _


class SupersetErrorType(str, Enum):
    """
    Types of errors that can exist within Superset.

    Keep in sync with superset-frontend/src/components/ErrorMessage/types.ts
    and docs/src/pages/docs/Miscellaneous/issue_codes.mdx
    """

    # Frontend errors
    FRONTEND_CSRF_ERROR = "FRONTEND_CSRF_ERROR"
    FRONTEND_NETWORK_ERROR = "FRONTEND_NETWORK_ERROR"
    FRONTEND_TIMEOUT_ERROR = "FRONTEND_TIMEOUT_ERROR"

    # DB Engine errors
    GENERIC_DB_ENGINE_ERROR = "GENERIC_DB_ENGINE_ERROR"
    COLUMN_DOES_NOT_EXIST_ERROR = "COLUMN_DOES_NOT_EXIST_ERROR"
    TABLE_DOES_NOT_EXIST_ERROR = "TABLE_DOES_NOT_EXIST_ERROR"
    SCHEMA_DOES_NOT_EXIST_ERROR = "SCHEMA_DOES_NOT_EXIST_ERROR"
    CONNECTION_INVALID_USERNAME_ERROR = "CONNECTION_INVALID_USERNAME_ERROR"
    CONNECTION_INVALID_PASSWORD_ERROR = "CONNECTION_INVALID_PASSWORD_ERROR"
    CONNECTION_INVALID_HOSTNAME_ERROR = "CONNECTION_INVALID_HOSTNAME_ERROR"
    CONNECTION_PORT_CLOSED_ERROR = "CONNECTION_PORT_CLOSED_ERROR"
    CONNECTION_HOST_DOWN_ERROR = "CONNECTION_HOST_DOWN_ERROR"
    CONNECTION_ACCESS_DENIED_ERROR = "CONNECTION_ACCESS_DENIED_ERROR"
    CONNECTION_UNKNOWN_DATABASE_ERROR = "CONNECTION_UNKNOWN_DATABASE_ERROR"
    CONNECTION_DATABASE_PERMISSIONS_ERROR = "CONNECTION_DATABASE_PERMISSIONS_ERROR"
    CONNECTION_MISSING_PARAMETERS_ERROR = "CONNECTION_MISSING_PARAMETERS_ERROR"

    # Viz errors
    VIZ_GET_DF_ERROR = "VIZ_GET_DF_ERROR"
    UNKNOWN_DATASOURCE_TYPE_ERROR = "UNKNOWN_DATASOURCE_TYPE_ERROR"
    FAILED_FETCHING_DATASOURCE_INFO_ERROR = "FAILED_FETCHING_DATASOURCE_INFO_ERROR"

    # Security access errors
    TABLE_SECURITY_ACCESS_ERROR = "TABLE_SECURITY_ACCESS_ERROR"
    DATASOURCE_SECURITY_ACCESS_ERROR = "DATASOURCE_SECURITY_ACCESS_ERROR"
    DATABASE_SECURITY_ACCESS_ERROR = "DATABASE_SECURITY_ACCESS_ERROR"
    MISSING_OWNERSHIP_ERROR = "MISSING_OWNERSHIP_ERROR"

    # Other errors
    BACKEND_TIMEOUT_ERROR = "BACKEND_TIMEOUT_ERROR"

    # Sql Lab errors
    MISSING_TEMPLATE_PARAMS_ERROR = "MISSING_TEMPLATE_PARAMS_ERROR"
    INVALID_TEMPLATE_PARAMS_ERROR = "INVALID_TEMPLATE_PARAMS_ERROR"
    RESULTS_BACKEND_NOT_CONFIGURED_ERROR = "RESULTS_BACKEND_NOT_CONFIGURED_ERROR"
    DML_NOT_ALLOWED_ERROR = "DML_NOT_ALLOWED_ERROR"
    INVALID_CTAS_QUERY_ERROR = "INVALID_CTAS_QUERY_ERROR"
    INVALID_CVAS_QUERY_ERROR = "INVALID_CVAS_QUERY_ERROR"
    SQLLAB_TIMEOUT_ERROR = "SQLLAB_TIMEOUT_ERROR"

    # Generic errors
    GENERIC_COMMAND_ERROR = "GENERIC_COMMAND_ERROR"
    GENERIC_BACKEND_ERROR = "GENERIC_BACKEND_ERROR"

    # API errors
    INVALID_PAYLOAD_FORMAT_ERROR = "INVALID_PAYLOAD_FORMAT_ERROR"
    INVALID_PAYLOAD_SCHEMA_ERROR = "INVALID_PAYLOAD_SCHEMA_ERROR"


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
    ],
    SupersetErrorType.GENERIC_DB_ENGINE_ERROR: [
        {
            "code": 1002,
            "message": _("Issue 1002 - The database returned an unexpected error."),
        }
    ],
    SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR: [
        {
            "code": 1003,
            "message": _(
                "Issue 1003 - There is a syntax error in the SQL query. "
                "Perhaps there was a misspelling or a typo."
            ),
        },
        {
            "code": 1004,
            "message": _(
                "Issue 1004 - The column was deleted or renamed in the database."
            ),
        },
    ],
    SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR: [
        {
            "code": 1003,
            "message": _(
                "Issue 1003 - There is a syntax error in the SQL query. "
                "Perhaps there was a misspelling or a typo."
            ),
        },
        {
            "code": 1005,
            "message": _(
                "Issue 1005 - The table was deleted or renamed in the database."
            ),
        },
    ],
    SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR: [
        {
            "code": 1003,
            "message": _(
                "Issue 1003 - There is a syntax error in the SQL query. "
                "Perhaps there was a misspelling or a typo."
            ),
        },
        {
            "code": 1016,
            "message": _(
                "Issue 1005 - The schema was deleted or renamed in the database."
            ),
        },
    ],
    SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR: [
        {
            "code": 1006,
            "message": _(
                "Issue 1006 - One or more parameters specified in the query are "
                "missing."
            ),
        },
    ],
    SupersetErrorType.INVALID_TEMPLATE_PARAMS_ERROR: [
        {
            "code": 1028,
            "message": _(
                "Issue 1028 - One or more parameters specified in the query are "
                "malformatted."
            ),
        },
    ],
    SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR: [
        {
            "code": 1021,
            "message": _(
                "Issue 1021 - Results backend needed for asynchronous queries "
                "is not configured."
            ),
        },
    ],
    SupersetErrorType.DML_NOT_ALLOWED_ERROR: [
        {
            "code": 1022,
            "message": _("Issue 1022 - Database does not allow data manipulation."),
        },
    ],
    SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR: [
        {
            "code": 1007,
            "message": _("Issue 1007 - The hostname provided can't be resolved."),
        },
    ],
    SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR: [
        {"code": 1008, "message": _("Issue 1008 - The port is closed.")},
    ],
    SupersetErrorType.CONNECTION_HOST_DOWN_ERROR: [
        {
            "code": 1009,
            "message": _(
                "Issue 1009 - The host might be down, and can't be reached on the "
                "provided port."
            ),
        },
    ],
    SupersetErrorType.GENERIC_COMMAND_ERROR: [
        {
            "code": 1010,
            "message": _(
                "Issue 1010 - Superset encountered an error while running a command."
            ),
        },
    ],
    SupersetErrorType.GENERIC_BACKEND_ERROR: [
        {
            "code": 1011,
            "message": _("Issue 1011 - Superset encountered an unexpected error."),
        },
    ],
    SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR: [
        {
            "code": 1012,
            "message": _(
                "Issue 1012 - The username provided when "
                "connecting to a database is not valid."
            ),
        },
    ],
    SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR: [
        {
            "code": 1013,
            "message": _(
                "Issue 1013 - The password provided when "
                "connecting to a database is not valid."
            ),
        },
    ],
    SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR: [
        {
            "code": 1014,
            "message": _("Issue 1014 - Either the username or the password is wrong."),
        },
        {
            "code": 1015,
            "message": _(
                "Issue 1015 - Either the database is "
                "spelled incorrectly or does not exist."
            ),
        },
    ],
    SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR: [
        {
            "code": 1015,
            "message": _(
                "Issue 1015 - Either the database is "
                "spelled incorrectly or does not exist."
            ),
        }
    ],
    SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR: [
        {
            "code": 1017,
            "message": _("Issue 1017 - User doesn't have the proper permissions."),
        },
    ],
    SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR: [
        {
            "code": 1018,
            "message": _(
                "Issue 1018 - One or more parameters needed to configure a "
                "database are missing."
            ),
        },
    ],
    SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR: [
        {
            "code": 1019,
            "message": _(
                "Issue 1019 - The submitted payload has the incorrect format."
            ),
        }
    ],
    SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR: [
        {
            "code": 1020,
            "message": _(
                "Issue 1020 - The submitted payload has the incorrect schema."
            ),
        }
    ],
    SupersetErrorType.INVALID_CTAS_QUERY_ERROR: [
        {
            "code": 1023,
            "message": _(
                "Issue 1023 - The CTAS (create table as select) doesn't have a "
                "SELECT statement at the end. Please make sure your query has a "
                "SELECT as its last statement. Then, try running your query again."
            ),
        },
    ],
    SupersetErrorType.INVALID_CVAS_QUERY_ERROR: [
        {
            "code": 1024,
            "message": _(
                "Issue 1024 - CVAS (create view as select) query has more than "
                "one statement."
            ),
        },
        {
            "code": 1025,
            "message": _(
                "Issue 1025 - CVAS (create view as select) query is not a "
                "SELECT statement."
            ),
        },
    ],
    SupersetErrorType.SQLLAB_TIMEOUT_ERROR: [
        {
            "code": 1026,
            "message": _(
                "Issue 1026 - Query is too complex and takes too long to run."
            ),
        },
        {
            "code": 1027,
            "message": _(
                "Issue 1027 - The database is currently running too many queries."
            ),
        },
    ],
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
