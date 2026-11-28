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
from __future__ import annotations

import re
from datetime import datetime
from re import Pattern
from typing import Any, TYPE_CHECKING

from flask_babel import lazy_gettext as _
from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIDataError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.errors import SupersetErrorType
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.connectors.sqla.models import TableColumn

# Every stream has this column: the event time, as an integer number of
# microseconds since the Unix epoch.
TIMESTAMP_COLUMN = "_timestamp"

# The sqlalchemy-openobserve driver reports failed HTTP requests with the
# message of the `requests` error, and rejected queries with the message of
# the OpenObserve search API.
CONNECTION_ACCESS_DENIED_REGEX = re.compile("401 Client Error: Unauthorized")
CONNECTION_UNKNOWN_DATABASE_REGEX = re.compile(
    r"404 Client Error: Not Found for url: \S+/api/(?P<database>[^/\s]+)/streams"
)
CONNECTION_INVALID_HOSTNAME_REGEX = re.compile(
    "Failed to resolve '(?P<hostname>[^']+)'"
)
CONNECTION_PORT_CLOSED_REGEX = re.compile(
    r"host='(?P<hostname>[^']+)', port=(?P<port>\d+)\): "
    "Failed to establish a new connection: .*Connection refused"
)
# Only a connect timeout: a query that takes too long also "timed out"
CONNECTION_HOST_DOWN_REGEX = re.compile(
    r"host='(?P<hostname>[^']+)', port=(?P<port>\d+)\).*ConnectTimeoutError"
)
TABLE_DOES_NOT_EXIST_REGEX = re.compile(r"Search stream not found: (?P<table_name>\S+)")
COLUMN_DOES_NOT_EXIST_REGEX = re.compile("unknown field '(?P<column_name>.+?)'")
SYNTAX_ERROR_REGEX = re.compile(
    r"ParserError\(.*?found: (?P<syntax_error>.+?) at Line: \d+, Column: \d+"
)


def _date_bin(interval: str, *, whole_seconds: bool = False) -> str:
    """
    Bucket a timestamp into fixed-width intervals counted from the Unix epoch.

    `date_trunc` only truncates to a calendar unit, so grains such as five
    minutes need `date_bin`.

    `whole_seconds` truncates to the second first: sub-minute `date_bin` on a
    raw timestamp crashes OpenObserve v1.0.4 over days of data.
    """
    col = "date_trunc('second', {col})" if whole_seconds else "{col}"
    return f"date_bin(INTERVAL '{interval}', {col}, TIMESTAMP '1970-01-01 00:00:00')"


class OpenObserveEngineSpec(BaseEngineSpec):
    """Engine spec for the OpenObserve observability platform."""

    engine = "openobserve"
    engine_name = "OpenObserve"
    drivers = {"rest": "OpenObserve HTTP search API"}
    default_driver = "rest"
    sqlalchemy_uri_placeholder = (
        "openobserve://{email}:{password}@{host}:{port}/{organization}"
    )
    # The driver only reads: OpenObserve ingests through its own APIs
    supports_file_upload = False

    metadata = {
        "description": (
            "OpenObserve is an open-source observability platform for logs, "
            "metrics and traces, queried with SQL."
        ),
        "logo": "openobserve.svg",
        "categories": [DatabaseCategory.SEARCH_NOSQL, DatabaseCategory.OPEN_SOURCE],
        "pypi_packages": ["sqlalchemy-openobserve"],
        "connection_string": (
            "openobserve://{email}:{password}@{host}:{port}/{organization}"
        ),
        "default_port": 5080,
        "connection_examples": [
            {
                "description": "Local server over plain HTTP",
                "connection_string": (
                    "openobserve://root%40example.com:password@localhost:5080/default"
                    "?ssl=false"
                ),
            },
        ],
        "notes": (
            "The username is your OpenObserve email. Write its @ as %40, and "
            "percent-encode special characters in the password. HTTPS is used "
            "by default; add ?ssl=false for a plain HTTP server. Each log "
            "stream is a table, and its _timestamp column is set up as the "
            "time column. Queries are read-only; SHOW and SELECT 1 are not "
            "supported by the server. Known server limits: a SELECT with "
            "ORDER BY and LIMIT that has no aggregate can return fewer rows "
            "than the limit, often none, and SELECT * over a CTE or "
            "subquery returns no columns when it matches no rows."
        ),
        "homepage_url": "https://openobserve.ai/",
        "docs_url": "https://openobserve.ai/docs/",
    }

    # OpenObserve runs SQL on Apache DataFusion
    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_trunc('second', {col})",
        TimeGrain.FIVE_SECONDS: _date_bin("5 seconds", whole_seconds=True),
        TimeGrain.THIRTY_SECONDS: _date_bin("30 seconds", whole_seconds=True),
        TimeGrain.MINUTE: "date_trunc('minute', {col})",
        TimeGrain.FIVE_MINUTES: _date_bin("5 minutes"),
        TimeGrain.TEN_MINUTES: _date_bin("10 minutes"),
        TimeGrain.FIFTEEN_MINUTES: _date_bin("15 minutes"),
        TimeGrain.THIRTY_MINUTES: _date_bin("30 minutes"),
        TimeGrain.HOUR: "date_trunc('hour', {col})",
        TimeGrain.SIX_HOURS: _date_bin("6 hours"),
        TimeGrain.DAY: "date_trunc('day', {col})",
        TimeGrain.WEEK: "date_trunc('week', {col})",
        TimeGrain.MONTH: "date_trunc('month', {col})",
        TimeGrain.QUARTER: "date_trunc('quarter', {col})",
        TimeGrain.YEAR: "date_trunc('year', {col})",
    }

    # The driver describes query result columns with Apache Arrow type names.
    # The default mappings cover the ones that start like a SQL type (Int64,
    # Float64, Boolean, Date32, Timestamp), but not these.
    column_type_mappings = (
        (
            re.compile(r"^(large)?utf8", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r"^uint", re.IGNORECASE),
            types.BigInteger(),
            GenericDataType.NUMERIC,
        ),
    )

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            _("Unexpected HTTP 401 response. Check your credentials."),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
        ),
        CONNECTION_UNKNOWN_DATABASE_REGEX: (
            _('Unable to connect to database "%(database)s".'),
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            {"invalid": ["database"]},
        ),
        CONNECTION_INVALID_HOSTNAME_REGEX: (
            _('The hostname "%(hostname)s" cannot be resolved.'),
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            {"invalid": ["host"]},
        ),
        CONNECTION_PORT_CLOSED_REGEX: (
            _('Port %(port)s on hostname "%(hostname)s" refused the connection.'),
            SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
            {"invalid": ["host", "port"]},
        ),
        CONNECTION_HOST_DOWN_REGEX: (
            _(
                'The host "%(hostname)s" might be down, and can\'t be '
                "reached on port %(port)s."
            ),
            SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            {"invalid": ["host", "port"]},
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            _(
                'The table "%(table_name)s" does not exist. '
                "A valid table must be used to run this query.",
            ),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            _('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SYNTAX_ERROR_REGEX: (
            _(
                "Please check your query for syntax errors at or "
                'near "%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_openobserve import dbapi

        return {
            dbapi.DatabaseError: SupersetDBAPIDatabaseError,
            dbapi.DataError: SupersetDBAPIDataError,
            dbapi.NotSupportedError: SupersetDBAPIDatabaseError,
            dbapi.OperationalError: SupersetDBAPIOperationalError,
            dbapi.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "to_timestamp_seconds({col})"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "to_timestamp_millis({col})"

    @classmethod
    def epoch_us_to_dttm(cls) -> str:
        return "to_timestamp_micros({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        """
        Render typed literals for timestamp and date expressions.

        `_timestamp` itself is an integer column, so it gets no literal here:
        its `epoch_us` date format makes Superset compare it with an integer.
        OpenObserve rejects a comparison between it and a timestamp literal.
        """
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"DATE '{dttm.date().isoformat()}'"
        if isinstance(sqla_type, types.DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"TIMESTAMP '{dttm_formatted}'"
        return None

    @classmethod
    def alter_new_orm_column(cls, orm_col: TableColumn) -> None:
        """
        Set up `_timestamp` as a time column holding epoch microseconds.

        Time filters then compare the column with an integer, and time grains
        convert it with `to_timestamp_micros`.
        """
        if orm_col.column_name == TIMESTAMP_COLUMN:
            orm_col.is_dttm = True
            orm_col.python_date_format = "epoch_us"
