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
from datetime import datetime
from typing import Any

import pytest
from sqlalchemy import column, types
from sqlalchemy.types import TypeEngine

from superset.errors import SupersetErrorType
from superset.superset_typing import DbapiDescription
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_engine_and_driver() -> None:
    """
    DB Eng Specs (openobserve): Test engine and driver names
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    assert OpenObserveEngineSpec.engine == "openobserve"
    assert OpenObserveEngineSpec.supports_backend("openobserve")
    assert OpenObserveEngineSpec.supports_backend("openobserve", "rest")
    assert not OpenObserveEngineSpec.supports_backend("openobserve", "odbc")


def test_metadata_points_at_the_driver_package() -> None:
    """
    DB Eng Specs (openobserve): Test metadata names the PyPI package
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    assert OpenObserveEngineSpec.metadata["pypi_packages"] == ["sqlalchemy-openobserve"]
    assert OpenObserveEngineSpec.metadata["default_port"] == 5080


def test_file_upload_is_not_supported() -> None:
    """
    DB Eng Specs (openobserve): Test the read-only driver takes no uploads
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    assert OpenObserveEngineSpec.supports_file_upload is False


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        ("PT1S", "date_trunc('second', ts)"),
        (
            "PT5S",
            "date_bin(INTERVAL '5 seconds', date_trunc('second', ts), "
            "TIMESTAMP '1970-01-01 00:00:00')",
        ),
        (
            "PT30S",
            "date_bin(INTERVAL '30 seconds', date_trunc('second', ts), "
            "TIMESTAMP '1970-01-01 00:00:00')",
        ),
        ("PT1M", "date_trunc('minute', ts)"),
        (
            "PT5M",
            "date_bin(INTERVAL '5 minutes', ts, TIMESTAMP '1970-01-01 00:00:00')",
        ),
        (
            "PT10M",
            "date_bin(INTERVAL '10 minutes', ts, TIMESTAMP '1970-01-01 00:00:00')",
        ),
        (
            "PT15M",
            "date_bin(INTERVAL '15 minutes', ts, TIMESTAMP '1970-01-01 00:00:00')",
        ),
        (
            "PT30M",
            "date_bin(INTERVAL '30 minutes', ts, TIMESTAMP '1970-01-01 00:00:00')",
        ),
        ("PT1H", "date_trunc('hour', ts)"),
        (
            "PT6H",
            "date_bin(INTERVAL '6 hours', ts, TIMESTAMP '1970-01-01 00:00:00')",
        ),
        ("P1D", "date_trunc('day', ts)"),
        ("P1W", "date_trunc('week', ts)"),
        ("P1M", "date_trunc('month', ts)"),
        ("P3M", "date_trunc('quarter', ts)"),
        ("P1Y", "date_trunc('year', ts)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    """
    DB Eng Specs (openobserve): Test time grain expressions
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    actual = str(
        OpenObserveEngineSpec.get_timestamp_expr(
            col=column("ts"), pdf=None, time_grain=time_grain
        )
    )
    assert actual == expected


@pytest.mark.parametrize(
    "pdf,time_grain,expected",
    [
        ("epoch_us", None, "to_timestamp_micros(ts)"),
        ("epoch_us", "PT1H", "date_trunc('hour', to_timestamp_micros(ts))"),
        (
            "epoch_us",
            "PT5M",
            "date_bin(INTERVAL '5 minutes', to_timestamp_micros(ts), "
            "TIMESTAMP '1970-01-01 00:00:00')",
        ),
        ("epoch_ms", "P1D", "date_trunc('day', to_timestamp_millis(ts))"),
        ("epoch_s", "P1D", "date_trunc('day', to_timestamp_seconds(ts))"),
    ],
)
def test_epoch_columns_are_converted_before_truncating(
    pdf: str, time_grain: str | None, expected: str
) -> None:
    """
    DB Eng Specs (openobserve): Test time grains on epoch columns
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    actual = str(
        OpenObserveEngineSpec.get_timestamp_expr(
            col=column("ts"), pdf=pdf, time_grain=time_grain
        )
    )
    assert actual == expected


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "DATE '2019-01-02'"),
        ("DateTime", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("TimeStamp", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("BigInt", None),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    """
    DB Eng Specs (openobserve): Test conversion to date time
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    assert_convert_dttm(OpenObserveEngineSpec, target_type, expected_result, dttm)


def test_alter_new_orm_column() -> None:
    """
    DB Eng Specs (openobserve): Test _timestamp becomes an epoch time column
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="openobserve", sqlalchemy_uri="openobserve://u:p@host/default"
    )
    tbl = SqlaTable(table_name="app_logs", database=database)
    timestamp = TableColumn(column_name="_timestamp", type="BIGINT", table=tbl)
    status = TableColumn(column_name="status", type="BIGINT", table=tbl)

    OpenObserveEngineSpec.alter_new_orm_column(timestamp)
    OpenObserveEngineSpec.alter_new_orm_column(status)

    assert timestamp.is_dttm is True
    assert timestamp.python_date_format == "epoch_us"
    assert not status.is_dttm
    assert status.python_date_format is None


def test_time_filter_compares_timestamp_with_integer(
    dttm: datetime,  # noqa: F811
) -> None:
    """
    DB Eng Specs (openobserve): Test time filters on _timestamp

    OpenObserve rejects a comparison between the integer column and a
    timestamp literal, so the filter value has to be epoch microseconds.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="openobserve", sqlalchemy_uri="openobserve://u:p@host/default"
    )
    tbl = SqlaTable(table_name="app_logs", database=database)
    timestamp = TableColumn(column_name="_timestamp", type="BIGINT", table=tbl)
    OpenObserveEngineSpec.alter_new_orm_column(timestamp)

    assert tbl.db_engine_spec is OpenObserveEngineSpec
    assert tbl.dttm_sql_literal(dttm, timestamp) == "1546398245000000"


@pytest.mark.parametrize(
    "message,error_type,expected,extra",
    [
        (
            "OpenObserve GET request to streams failed: 401 Client Error: "
            "Unauthorized for url: http://localhost:5080/api/default/streams?type=logs",
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            "Unexpected HTTP 401 response. Check your credentials.",
            {"invalid": ["username", "password"]},
        ),
        (
            "OpenObserve GET request to streams failed: 404 Client Error: "
            "Not Found for url: http://localhost:5080/api/my_org/streams?type=logs",
            SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
            'Unable to connect to database "my_org".',
            {"invalid": ["database"]},
        ),
        (
            "OpenObserve GET request to streams failed: HTTPConnectionPool("
            "host='observe.invalid', port=5080): Max retries exceeded with url: "
            "/api/default/streams?type=logs (Caused by NameResolutionError("
            "\"HTTPConnection(host='observe.invalid', port=5080): Failed to "
            "resolve 'observe.invalid' ([Errno 8] nodename nor servname provided, "
            'or not known)"))',
            SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            'The hostname "observe.invalid" cannot be resolved.',
            {"invalid": ["host"]},
        ),
        (
            "OpenObserve GET request to streams failed: HTTPConnectionPool("
            "host='localhost', port=5081): Max retries exceeded with url: "
            "/api/default/streams?type=logs (Caused by NewConnectionError("
            "\"HTTPConnection(host='localhost', port=5081): Failed to establish "
            'a new connection: [Errno 61] Connection refused"))',
            SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
            'Port 5081 on hostname "localhost" refused the connection.',
            {"invalid": ["host", "port"]},
        ),
        (
            "OpenObserve GET request to streams failed: HTTPConnectionPool("
            "host='10.255.255.1', port=5080): Max retries exceeded with url: "
            "/api/default/streams?type=logs (Caused by ConnectTimeoutError("
            "<HTTPConnection(host='10.255.255.1', port=5080) at 0x10b58f4d0>, "
            "'Connection to 10.255.255.1 timed out. (connect timeout=30)'))",
            SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            'The host "10.255.255.1" might be down, and can\'t be reached on '
            "port 5080.",
            {"invalid": ["host", "port"]},
        ),
        (
            "Search stream not found: no_such_stream",
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            'The table "no_such_stream" does not exist. '
            "A valid table must be used to run this query.",
            {},
        ),
        (
            "unknown field 'nope'",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            'We can\'t seem to resolve the column "nope"',
            {},
        ),
        (
            'Error# SQL error: ParserError("Expected: an SQL statement, found: '
            'SELEC at Line: 1, Column: 1")',
            SupersetErrorType.SYNTAX_ERROR,
            'Please check your query for syntax errors at or near "SELEC". '
            "Then, try running your query again.",
            {},
        ),
    ],
)
def test_extract_errors(
    message: str,
    error_type: SupersetErrorType,
    expected: str,
    extra: dict[str, Any],
) -> None:
    """
    DB Eng Specs (openobserve): Test driver and server errors are mapped
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    errors = OpenObserveEngineSpec.extract_errors(Exception(message))

    assert [(error.error_type, error.message) for error in errors] == [
        (error_type, expected)
    ]
    error_extra = errors[0].extra or {}
    assert error_extra["engine_name"] == "OpenObserve"
    assert {key: error_extra[key] for key in extra} == extra


@pytest.mark.parametrize(
    "message",
    [
        # A slow query is not a host that is down
        "OpenObserve POST request to _search failed: HTTPConnectionPool("
        "host='localhost', port=5080): Read timed out. (read timeout=30)",
        "Search SQL execute error",
        "unknown function 'no_such_fn'",
    ],
)
def test_other_errors_keep_their_message(message: str) -> None:
    """
    DB Eng Specs (openobserve): Test unmapped errors are passed through
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    errors = OpenObserveEngineSpec.extract_errors(Exception(message))

    assert [(error.error_type, error.message) for error in errors] == [
        (SupersetErrorType.GENERIC_DB_ENGINE_ERROR, message)
    ]


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type,is_dttm",
    [
        # Arrow type names, as the driver reports them for query results
        ("UTF8", types.String, GenericDataType.STRING, False),
        ("LARGEUTF8", types.String, GenericDataType.STRING, False),
        ("UINT8", types.BigInteger, GenericDataType.NUMERIC, False),
        ("UINT64", types.BigInteger, GenericDataType.NUMERIC, False),
        ("INT64", types.Integer, GenericDataType.NUMERIC, False),
        ("FLOAT64", types.Float, GenericDataType.NUMERIC, False),
        ("BOOLEAN", types.Boolean, GenericDataType.BOOLEAN, False),
        ("DATE32", types.Date, GenericDataType.TEMPORAL, True),
        (
            "TIMESTAMP(MICROSECOND, NONE)",
            types.TIMESTAMP,
            GenericDataType.TEMPORAL,
            True,
        ),
        # SQL type names, as the dialect reflects them for stream fields
        ("VARCHAR", types.String, GenericDataType.STRING, False),
        ("BIGINT", types.BigInteger, GenericDataType.NUMERIC, False),
        ("DOUBLE", types.Float, GenericDataType.NUMERIC, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[TypeEngine],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    """
    DB Eng Specs (openobserve): Test Arrow and SQL type names are recognized
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    assert_column_spec(
        OpenObserveEngineSpec, native_type, sqla_type, None, generic_type, is_dttm
    )


def test_query_result_columns_get_generic_types() -> None:
    """
    DB Eng Specs (openobserve): Test result columns described with Arrow types

    Superset upper-cases the type code of the cursor description, and reports
    a column whose type it does not recognize without a generic type.
    """
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec
    from superset.result_set import SupersetResultSet

    description: DbapiDescription = [
        ("service", "Utf8", None, None, None, None, True),
        ("status", "Int64", None, None, None, None, True),
        ("slow", "Boolean", None, None, None, None, True),
    ]
    result_set = SupersetResultSet(
        [("api", 200, True)], description, OpenObserveEngineSpec
    )

    assert [
        (column["column_name"], column["type"], column["type_generic"])
        for column in result_set.columns
    ] == [
        ("service", "UTF8", GenericDataType.STRING),
        ("status", "INT64", GenericDataType.NUMERIC),
        ("slow", "BOOLEAN", GenericDataType.BOOLEAN),
    ]


def test_sql_is_parsed_as_postgres() -> None:
    """
    DB Eng Specs (openobserve): Test SQL is parsed with the PostgreSQL dialect

    OpenObserve runs SQL on Apache DataFusion, which follows PostgreSQL syntax.
    The generic dialect rewrites the regex operator into REGEXP_LIKE and leaves
    out the alias a subquery needs.
    """
    from superset.sql.parse import SQLScript

    sql = "SELECT message FROM (SELECT * FROM app_logs) AS t WHERE message ~ 'err'"

    assert SQLScript(sql, "openobserve").format() == (
        "SELECT\n  message\nFROM (\n  SELECT\n    *\n  FROM app_logs\n) AS t\n"
        "WHERE\n  message ~ 'err'"
    )


def test_get_dbapi_exception_mapping() -> None:
    """
    DB Eng Specs (openobserve): Test driver errors map to Superset DBAPI errors
    """
    from superset.db_engine_specs.exceptions import (
        SupersetDBAPIDatabaseError,
        SupersetDBAPIDataError,
        SupersetDBAPIOperationalError,
        SupersetDBAPIProgrammingError,
    )
    from superset.db_engine_specs.openobserve import OpenObserveEngineSpec

    dbapi = pytest.importorskip("sqlalchemy_openobserve.dbapi")

    mapping = OpenObserveEngineSpec.get_dbapi_exception_mapping()

    assert mapping == {
        dbapi.DatabaseError: SupersetDBAPIDatabaseError,
        dbapi.DataError: SupersetDBAPIDataError,
        dbapi.NotSupportedError: SupersetDBAPIDatabaseError,
        dbapi.OperationalError: SupersetDBAPIOperationalError,
        dbapi.ProgrammingError: SupersetDBAPIProgrammingError,
    }
    mapped = OpenObserveEngineSpec.get_dbapi_mapped_exception(
        dbapi.ProgrammingError("Search stream not found: logs")
    )
    assert isinstance(mapped, SupersetDBAPIProgrammingError)
    assert str(mapped) == "Search stream not found: logs"
