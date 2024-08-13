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
import re
from typing import Any, Optional

from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.errors import SupersetErrorType


# Internal class for defining error message patterns (for translation)
class _ErrorPatterns:

    CONNECTION_INVALID_USERNAME_PASSWORD_REGEX = re.compile(
        "The username or password is incorrect"
    )
    CONNECTION_INVALID_PASSWORD_NEEDED_REGEX = re.compile(
        "no password supplied"
    )
    CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
        "could not translate host name \"(?P<hostname>.*?)\" to address: "
    )
    CONNECTION_PORT_CLOSED_REGEX = re.compile(
        "Is the server running on that host and accepting"
    )
    CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile(
        "Database '(?P<database>.*?)' not found"
    )
    CONNECTION_FORBIDDEN_DATABASE_REGEX = re.compile(
        "Insufficient privileges to connect to the database '(?P<database>.*?)'"
    )
    QUERY_SYNTAX_ERROR_REGEX = re.compile(
        "Exception parsing query near '(?P<err>.*?)'"
    )
    QUERY_COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
        "Field not found '(?P<column>.*?)' in view '(?P<view>.*?)'"
    )
    QUERY_GROUP_BY_GENERIC_ERROR_REGEX = re.compile(
        "Error computing capabilities of GROUP BY view"
    )
    QUERY_GROUP_BY_CANNOT_PROJECT_REGEX = re.compile(
        "Invalid GROUP BY expression. '(?P<exp>.*?)' cannot be projected"
    )


class DenodoEngineSpec(BaseEngineSpec, BasicParametersMixin):

    engine = "denodo"
    engine_name = "Denodo"

    default_driver = "psycopg2"
    sqlalchemy_uri_placeholder = (
        "denodo://user:password@host:port/dbname[?key=value&key=value...]"
    )
    encryption_parameters = {"sslmode": "require"}

    _time_grain_expressions = {
        None: "{col}",
        "PT1M": "TRUNC({col},'MI')",
        "PT1H": "TRUNC({col},'HH')",
        "P1D": "TRUNC({col},'DDD')",
        "P1W": "TRUNC({col},'W')",
        "P1M": "TRUNC({col},'MONTH')",
        "P3M": "TRUNC({col},'Q')",
        "P1Y": "TRUNC({col},'YEAR')",
    }

    custom_errors: dict[re.Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        _ErrorPatterns.CONNECTION_INVALID_USERNAME_PASSWORD_REGEX: (
            "Incorrect username or password.",
            SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
            {"invalid": ["username", "password"]},
        ),
        _ErrorPatterns.CONNECTION_INVALID_PASSWORD_NEEDED_REGEX: (
            "Please enter a password.",
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["password"]},
        ),
        _ErrorPatterns.CONNECTION_INVALID_HOSTNAME_REGEX: (
            "Hostname \"%(hostname)s\" cannot be resolved.",
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            {"invalid": ["host"]},
        ),
        _ErrorPatterns.CONNECTION_PORT_CLOSED_REGEX: (
            "Server refused the connection: check hostname and port.",
            SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
            {"invalid": ["host", "port"]},

        ),
        _ErrorPatterns.CONNECTION_UNKNOWN_DATABASE_REGEX: (
            "Unable to connect to database \"%(database)s\"",
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
        _ErrorPatterns.CONNECTION_FORBIDDEN_DATABASE_REGEX: (
            "Unable to connect to database \"%(database)s\": database does not "
            "exist or insufficient permissions",
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
            {"invalid": ["database"]},
        ),
        _ErrorPatterns.QUERY_SYNTAX_ERROR_REGEX: (
            "Please check your query for syntax errors at or "
            "near \"%(err)s\". Then, try running your query again.",
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
        _ErrorPatterns.QUERY_COLUMN_DOES_NOT_EXIST_REGEX: (
            "Column \"%(column)s\" not found in \"%(view)s\".",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        _ErrorPatterns.QUERY_GROUP_BY_GENERIC_ERROR_REGEX: (
            "Invalid aggregation expression.",
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
        _ErrorPatterns.QUERY_GROUP_BY_CANNOT_PROJECT_REGEX: (
            "\"%(exp)s\" is neither an aggregation function nor "
            "appears in the GROUP BY clause.",
            SupersetErrorType.SYNTAX_ERROR,
            {},
        )
    }

    @classmethod
    def get_datatype(cls, type_code: Any) -> Optional[str]:
        from psycopg2.extensions import binary_types, string_types
        # Obtain data type names from psycopg2
        types = binary_types.copy()
        types.update(string_types)
        if type_code in types:
            return types[type_code].name
        return None
