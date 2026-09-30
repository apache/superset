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
from re import Pattern
from typing import Any, Optional

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.errors import SupersetErrorType


class ExasolEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Engine spec for Exasol"""

    engine = "exa"
    engine_name = "Exasol"
    max_column_name_length = 128

    # Keep the server's message from its keyword onwards, including the
    # position/identifier. The passthrough placeholder has no translatable text.
    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        re.compile(r"(?P<message>syntax error[^\n]*)", re.IGNORECASE): (
            "%(message)s",
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
        re.compile(r"(?P<message>table [^\n]* does not exist[^\n]*)", re.IGNORECASE): (
            "%(message)s",
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
        # Exasol reports a missing column as ``column <NAME> not found``. The
        # keyword must start the diagnostic (not follow another word, as in
        # ``object COLUMN not found``) and be followed by at most one qualified
        # identifier.
        re.compile(
            r'(?P<message>(?<![\w"] )(?<![\w.$"])column'
            r'(?: (?:"[^"\n]*"|[\w$]+)(?:\.(?:"[^"\n]*"|[\w$]+))*)?'
            r" not found[^\n]*)",
            re.IGNORECASE,
        ): (
            "%(message)s",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        re.compile(r"(?P<message>insufficient privileges[^\n]*)", re.IGNORECASE): (
            "%(message)s",
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
            {},
        ),
    }

    metadata = {
        "description": (
            "Exasol is a high-performance, in-memory, MPP analytical database."
        ),
        "logo": "exasol.png",
        "homepage_url": "https://www.exasol.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["sqlalchemy-exasol"],
        "connection_string": "exa+pyodbc://{username}:{password}@{dsn}",
        "default_port": 8563,
        "notes": (
            "SQL Lab recognizes Exasol syntax errors, missing-table and missing-column "
            "errors, and insufficient-privilege errors while retaining the server's "
            "diagnostic text. Echoed SQL is excluded from error classification. "
            "An ambiguous `object ... not found` message remains a "
            "generic database error; it does not distinguish a missing table from a "
            "missing column.\n\n"
            "For WebSocket connections, use PyExasol 2.4.1 or later to preserve server "
            "messages in DB-API exceptions. Earlier versions can return an empty "
            "error message."
        ),
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "dsn": "DSN name configured in odbc.ini",
        },
        "drivers": [
            {
                "name": "pyodbc",
                "pypi_package": "sqlalchemy-exasol",
                "connection_string": "exa+pyodbc://{username}:{password}@{dsn}",
                "is_recommended": True,
                "notes": "Requires ODBC driver and DSN configuration.",
            },
            {
                "name": "turbodbc",
                "pypi_package": "sqlalchemy-exasol[turbodbc]",
                "connection_string": "exa+turbodbc://{username}:{password}@{dsn}",
                "is_recommended": False,
                "notes": "Faster but requires additional dependencies.",
            },
            {
                "name": "websocket",
                "pypi_package": "sqlalchemy-exasol[websocket]",
                "connection_string": (
                    "exa+websocket://{username}:{password}@{host}:{port}/{schema}"
                ),
                "is_recommended": False,
                "notes": "Pure Python, no ODBC required.",
            },
        ],
    }

    # Exasol's DATE_TRUNC function is PostgresSQL compatible
    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('second', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.HOUR: "DATE_TRUNC('hour', {col})",
        TimeGrain.DAY: "DATE_TRUNC('day', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('week', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('month', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('quarter', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('year', {col})",
    }

    @classmethod
    def _extract_error_message(cls, ex: Exception) -> str:
        """Extract the server diagnostic without driver-echoed SQL."""
        message = super()._extract_error_message(ex)
        # Strip SQL before looking for a verbose message field: SQL literals
        # can themselves contain text resembling a driver envelope.
        # The (?m)^[ \t]* anchor strips only own-line SQL echoes: no Exasol
        # driver emits same-line [SQL: ...]; SQLAlchemy joins with \n and
        # PyExasol uses an own-line query => envelope.
        message = re.split(
            r"(?m)^[ \t]*(?:query[ \t]*=>|\[SQL:|\[parameters:)",
            message,
            maxsplit=1,
        )[0]
        if match := re.search(r"(?m)^[ \t]*message[ \t]*=>[ \t]*", message):
            # PyExasol prints the message first, then its fixed connection/query
            # fields. Only those field names end the message, so a diagnostic
            # line that itself contains ``=>`` is kept.
            diagnostic = re.split(
                r"(?m)^[ \t]*(?:(?:dsn|user|schema|session_id|code|query)[ \t]*=>"
                r"|\)[ \t]*$)",
                message[match.end() :],
                maxsplit=1,
            )[0].strip()
            if diagnostic:
                return diagnostic
        return message.strip()

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> list[tuple[Any, ...]]:
        data = super().fetch_data(cursor, limit)
        # Lists of `pyodbc.Row` need to be unpacked further
        return cls.pyodbc_rows_to_tuples(data)
