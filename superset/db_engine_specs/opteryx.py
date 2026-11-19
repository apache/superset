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
from datetime import datetime
from re import Pattern
from typing import Any, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy import types

from superset import db
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY, TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIDataError,
    SupersetDBAPIError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.errors import SupersetErrorType
from superset.utils.core import GenericDataType, QueryStatus

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.models.sql_lab import Query

# Error messages surfaced by the ``opteryx-sqlalchemy`` driver. The engine
# wraps object names in Markdown emphasis (`name` or *name*).
CONNECTION_ACCESS_DENIED_REGEX = re.compile(r"Authentication error: (?P<detail>.*)")
TABLE_DOES_NOT_EXIST_REGEX = re.compile(
    r"Dataset [`*]?(?P<table>[^`*]+?)[`*]? cannot be found"
)
COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    r"Column [`*]?(?P<column>[^`*]+?)[`*]? cannot be found"
)


def _time_bucket(magnitude: int, unit: str) -> str:
    """
    Fixed-width buckets anchored at the Unix epoch.

    ``TIME_BUCKET`` takes the magnitude first and the value last; the magnitude
    and unit must both be literals.
    """
    return f"TIME_BUCKET({magnitude}, '{unit}', CAST({{col}} AS TIMESTAMP))"


def _date_trunc(unit: str) -> str:
    # The CAST lets DATE (and string) columns be truncated: Opteryx's
    # DATE_TRUNC is only guaranteed over TIMESTAMP operands.
    return f"DATE_TRUNC('{unit}', CAST({{col}} AS TIMESTAMP))"


class OpteryxEngineSpec(BaseEngineSpec):
    """
    Engine spec for Opteryx (https://opteryx.app), a hosted SQL service built
    on the open-source Opteryx query engine.

    Datasets are addressed as ``workspace.collection.dataset``. The
    ``opteryx-sqlalchemy`` dialect reports ``workspace.collection`` as the
    schema, so Superset lists one schema per collection and renders table
    references in the three-part form users write.
    """

    engine = "opteryx"
    engine_name = "Opteryx"
    default_driver = "http"
    drivers = {"http": "Opteryx jobs API over HTTPS"}
    sqlalchemy_uri_placeholder = (
        "opteryx://{client_id}:{client_secret}@opteryx.app:443/?ssl=true"
    )

    # The driver talks to an HTTPS API whose service hostnames are derived from
    # the host in the URI; an SSH tunnel would replace that host with a local
    # forwarding address.
    disable_ssh_tunneling = True
    supports_file_upload = False

    # ``SELECT * FROM (WITH ... SELECT ...) AS virtual_table`` is rejected:
    # the CTE is not visible inside the derived table.
    allows_cte_in_subquery = False

    # The job ID that ``cancel_query`` needs exists only once the statement is
    # submitted; ``execute`` submits without waiting (see below).
    has_query_id_before_execute = False

    metadata = {
        "description": (
            "Opteryx is a hosted SQL workspace on an open-source query engine. "
            "It queries files in S3 and GCS, Iceberg tables and PostgreSQL "
            "databases where they live."
        ),
        "logo": "opteryx.svg",
        "homepage_url": "https://opteryx.app/",
        "docs_url": "https://docs.opteryx.app/",
        "categories": [
            DatabaseCategory.QUERY_ENGINES,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["opteryx-sqlalchemy"],
        "connection_string": (
            "opteryx://{client_id}:{client_secret}@opteryx.app:443/?ssl=true"
        ),
        "default_port": 443,
        "parameters": {
            "client_id": "Client ID of an Opteryx API client",
            "client_secret": "Client secret of that API client",
        },
        "notes": (
            "Authenticates with OAuth client credentials. Tables are listed "
            "per collection: the schema is `workspace.collection`, and SQL "
            "refers to datasets as `workspace.collection.dataset`."
        ),
        "drivers": [
            {
                "name": "opteryx-sqlalchemy",
                "pypi_package": "opteryx-sqlalchemy",
                "connection_string": (
                    "opteryx://{client_id}:{client_secret}@opteryx.app:443/?ssl=true"
                ),
                "is_recommended": True,
            }
        ],
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: _date_trunc("second"),
        TimeGrain.FIVE_SECONDS: _time_bucket(5, "second"),
        TimeGrain.THIRTY_SECONDS: _time_bucket(30, "second"),
        TimeGrain.MINUTE: _date_trunc("minute"),
        TimeGrain.FIVE_MINUTES: _time_bucket(5, "minute"),
        TimeGrain.TEN_MINUTES: _time_bucket(10, "minute"),
        TimeGrain.FIFTEEN_MINUTES: _time_bucket(15, "minute"),
        TimeGrain.THIRTY_MINUTES: _time_bucket(30, "minute"),
        TimeGrain.HALF_HOUR: _time_bucket(30, "minute"),
        TimeGrain.HOUR: _date_trunc("hour"),
        TimeGrain.SIX_HOURS: _time_bucket(6, "hour"),
        TimeGrain.DAY: _date_trunc("day"),
        # Opteryx weeks start on Monday (ISO).
        TimeGrain.WEEK: _date_trunc("week"),
        TimeGrain.WEEK_STARTING_MONDAY: _date_trunc("week"),
        TimeGrain.WEEK_STARTING_SUNDAY: (
            "DATE_TRUNC('week', CAST({col} AS TIMESTAMP) + INTERVAL '1' DAY)"
            " - INTERVAL '1' DAY"
        ),
        TimeGrain.WEEK_ENDING_SATURDAY: (
            "DATE_TRUNC('week', CAST({col} AS TIMESTAMP) + INTERVAL '1' DAY)"
            " + INTERVAL '5' DAY"
        ),
        TimeGrain.WEEK_ENDING_SUNDAY: (
            "DATE_TRUNC('week', CAST({col} AS TIMESTAMP)) + INTERVAL '6' DAY"
        ),
        TimeGrain.MONTH: _date_trunc("month"),
        TimeGrain.QUARTER: _date_trunc("quarter"),
        TimeGrain.QUARTER_YEAR: _date_trunc("quarter"),
        TimeGrain.YEAR: _date_trunc("year"),
    }

    # Opteryx's storage types (INT8..INT64, FLOAT32/64, BOOL, NVARCHAR, ...)
    # are covered by the base mappings; unsigned integers are not.
    column_type_mappings = (
        (
            re.compile(r"^uint(8|16|32|64)?$", re.IGNORECASE),
            types.BigInteger(),
            GenericDataType.NUMERIC,
        ),
    )

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        CONNECTION_ACCESS_DENIED_REGEX: (
            __(
                "Opteryx rejected the client credentials: %(detail)s. Check the "
                "client ID and secret."
            ),
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            {"invalid": ["username", "password"]},
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            __(
                'The dataset "%(table)s" does not exist or is not visible to this '
                "client. Datasets are named workspace.collection.dataset."
            ),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('The column "%(column)s" does not exist.'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-outside-toplevel
        try:
            from sqlalchemy_dialect import dbapi
        except ImportError:
            return {}

        # The driver raises the PEP 249 classes directly (lookup is by exact
        # type): OperationalError for authentication, connection and timeout
        # failures, ProgrammingError for statements the engine rejects.
        return {
            dbapi.Error: SupersetDBAPIError,
            dbapi.InterfaceError: SupersetDBAPIError,
            dbapi.DatabaseError: SupersetDBAPIDatabaseError,
            dbapi.DataError: SupersetDBAPIDataError,
            dbapi.IntegrityError: SupersetDBAPIDatabaseError,
            dbapi.InternalError: SupersetDBAPIDatabaseError,
            dbapi.NotSupportedError: SupersetDBAPIDatabaseError,
            dbapi.OperationalError: SupersetDBAPIOperationalError,
            dbapi.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def get_function_names(cls, database: "Database") -> list[str]:
        # The driver ships the engine's function names, so autocomplete needs
        # no query (every Opteryx query counts against the account's quota).
        # pylint: disable=import-outside-toplevel
        try:
            from sqlalchemy_dialect.functions import FUNCTION_NAMES
        except ImportError:
            return []
        return list(FUNCTION_NAMES)

    @classmethod
    def execute(
        cls,
        cursor: Any,
        query: str,
        database: "Database",
        **kwargs: Any,
    ) -> None:
        # SQL Lab passes ``async_``: submit the job and return, so its ID can be
        # recorded for Stop before the results are waited on. Fetching (or
        # reading the cursor's description) waits for the job.
        if not kwargs.get("async_") or not hasattr(cursor, "execute_async"):
            super().execute(cursor, query, database, **kwargs)
            return
        try:
            cursor.execute_async(query)
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex) from ex

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: "Query") -> str | None:
        return getattr(cursor, "statement_handle", None)

    @classmethod
    def prepare_cancel_query(cls, query: "Query") -> None:
        # Submitting a job takes a round trip or two, so a Stop can arrive
        # before its ID is recorded; flag it for ``handle_cursor``.
        if QUERY_CANCEL_KEY not in query.extra:
            query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)

    @classmethod
    def handle_cursor(cls, cursor: Any, query: "Query") -> None:
        # Called once the job ID is recorded: cancel the job if Stop came first.
        cancel_query_id = cls.get_cancel_query_id(cursor, query)
        if cancel_query_id is None:
            return
        db.session.refresh(query)
        if (
            query.extra.get(QUERY_EARLY_CANCEL_KEY)
            or query.status == QueryStatus.STOPPED
        ):
            cls.cancel_query(cursor, query, cancel_query_id)

    @classmethod
    def cancel_query(cls, cursor: Any, query: "Query", cancel_query_id: str) -> bool:
        # Job IDs look like ``20261108120000-a1b2c3d4e5f6g7h8``; the ID becomes
        # part of the cancel URL.
        if not cls.validate_cancel_query_id(cancel_query_id, r"^[A-Za-z0-9-]+$"):
            return False
        try:
            return bool(cursor.cancel(cancel_query_id))
        except Exception:  # pylint: disable=broad-except
            return False

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "FROM_UNIXTIME({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        # Opteryx rejects type-prefixed literals (TIMESTAMP '...'); CAST is the
        # supported spelling.
        sqla_type = cls.get_sqla_column_type(target_type)
        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"CAST('{dttm_formatted}' AS TIMESTAMP)"
        return None
