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
import math
from datetime import datetime
from textwrap import dedent
from typing import Any, Optional
from unittest import mock
from unittest.mock import Mock

import pandas as pd
import pytest
import pytz
from pyhive.sqlalchemy_presto import PrestoDialect
from pytest_mock import MockerFixture
from sqlalchemy import column, sql, text, types
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.models.sql_types.presto_sql_types import (
    Array,
    Interval,
    Map,
    Row,
    TinyInteger,
)
from superset.sql.parse import Table
from superset.superset_typing import ResultSetColumnType
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)


@pytest.mark.parametrize(
    "target_type,dttm,expected_result",
    [
        ("VARCHAR", datetime(2022, 1, 1), None),
        ("", datetime(2022, 1, 1), None),
        ("DATE", datetime(2022, 1, 1), "DATE '2022-01-01'"),
        (
            "TIMESTAMP",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000, tzinfo=pytz.UTC),
            "TIMESTAMP '2022-01-01 01:23:45.600+00:00'",
        ),
    ],
)
def test_convert_dttm(
    target_type: str,
    dttm: datetime,
    expected_result: Optional[str],
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_convert_dttm_presto_spec_truncates_to_milliseconds() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.convert_dttm(
        "TIMESTAMP", datetime(2022, 1, 1, 1, 23, 45, 600123)
    ) == ("TIMESTAMP '2022-01-01 01:23:45.600'")


def test_convert_dttm_base_spec_keeps_microseconds() -> None:
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec

    assert PrestoBaseEngineSpec.convert_dttm(
        "TIMESTAMP", datetime(2022, 1, 1, 1, 23, 45, 600123)
    ) == ("TIMESTAMP '2022-01-01 01:23:45.600123'")


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("varchar(255)", types.VARCHAR, {"length": 255}, GenericDataType.STRING, False),
        ("varchar", types.String, None, GenericDataType.STRING, False),
        ("char(255)", types.CHAR, {"length": 255}, GenericDataType.STRING, False),
        ("char", types.String, None, GenericDataType.STRING, False),
        ("integer", types.Integer, None, GenericDataType.NUMERIC, False),
        ("time", types.Time, None, GenericDataType.TEMPORAL, True),
        ("timestamp", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("boolean", types.BOOLEAN, None, GenericDataType.BOOLEAN, False),
        ("tinyint", TinyInteger, None, GenericDataType.NUMERIC, False),
        ("smallint", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("bigint", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("real", types.FLOAT, None, GenericDataType.NUMERIC, False),
        ("double", types.FLOAT, None, GenericDataType.NUMERIC, False),
        (
            "decimal(10,2)",
            types.DECIMAL,
            {"precision": None, "scale": None},
            GenericDataType.NUMERIC,
            False,
        ),
        ("varbinary", types.VARBINARY, None, GenericDataType.STRING, False),
        ("json", types.JSON, None, GenericDataType.STRING, False),
        ("date", types.Date, None, GenericDataType.TEMPORAL, True),
        ("interval year to month", Interval, None, GenericDataType.TEMPORAL, True),
        ("array(varchar)", Array, None, GenericDataType.STRING, False),
        ("map(varchar, integer)", Map, None, GenericDataType.STRING, False),
        ("row(a varchar, b integer)", Row, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "string_value,expected_float",
    [
        ("NaN", math.nan),
        ("Infinity", math.inf),
        ("-Infinity", -math.inf),
    ],
)
def test_column_type_mutator_double_special_values(
    string_value: str, expected_float: float
) -> None:
    """
    Presto's coordinator sends results as JSON, which has no literal for
    NaN/Infinity/-Infinity, so REAL/DOUBLE columns holding those values
    arrive as quoted strings. They must be coerced back to real floats
    (inherited from PrestoBaseEngineSpec, shared with TrinoEngineSpec).
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_cursor = Mock()
    mock_cursor.fetchall.return_value = [[string_value]]
    mock_cursor.description = [("val", "double")]

    (result_value,) = PrestoEngineSpec.fetch_data(mock_cursor)[0]
    assert isinstance(result_value, float)
    if math.isnan(expected_float):
        assert math.isnan(result_value)
    else:
        assert result_value == expected_float


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive/default"),
            {},
        )
        == "default"
    )

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive"),
            {},
        )
        is None
    )


@pytest.mark.parametrize(
    "schema",
    [
        pytest.param("with/slash", id="slash"),
        pytest.param("with space", id="space"),
        pytest.param("with%percent", id="percent"),
        pytest.param("地区", id="unicode"),
        pytest.param("plain", id="plain"),
    ],
)
def test_schema_survives_engine_params_round_trip(schema: str) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    uri, _connect_args = PrestoEngineSpec.adjust_engine_params(
        make_url("presto://localhost:8080/hive"),
        {},
        schema=schema,
    )

    assert PrestoEngineSpec.get_schema_from_engine_params(uri, {}) == schema


def test_get_catalog_names_lists_catalogs() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    inspector = mock.MagicMock()
    conn = inspector.engine.connect.return_value.__enter__.return_value
    conn.execute.return_value = [("jmx",), ("tpch",), ("memory",)]

    result = PrestoEngineSpec.get_catalog_names(mock.MagicMock(), inspector)

    assert result == {"jmx", "tpch", "memory"}
    assert str(conn.execute.call_args[0][0]) == "SHOW CATALOGS"


def test_get_view_names_queries_information_schema_with_schema() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.return_value = [["a", "b,", "c"], ["d", "e"]]

    result = PrestoEngineSpec.get_view_names(database, mock.Mock(), "my_schema")

    assert result == {"a", "d"}
    cursor.execute.assert_called_once_with(
        dedent(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = %(schema)s
            AND table_type = 'VIEW'
            """
        ).strip(),
        {"schema": "my_schema"},
    )


def test_get_view_names_queries_information_schema_without_schema() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.return_value = [["a", "b,", "c"], ["d", "e"]]

    result = PrestoEngineSpec.get_view_names(database, mock.Mock(), None)

    assert result == {"a", "d"}
    cursor.execute.assert_called_once_with(
        dedent(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_type = 'VIEW'
            """
        ).strip(),
        {},
    )


def test_get_view_names_returns_empty_set_when_no_views() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().fetchall.return_value = []

    assert PrestoEngineSpec.get_view_names(database, mock.Mock(), "empty") == set()


def test_get_view_names_propagates_driver_error() -> None:
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().execute.side_effect = (
        DatabaseError("Access Denied: Cannot select from table information_schema")
    )

    with pytest.raises(DatabaseError, match="Access Denied"):
        PrestoEngineSpec.get_view_names(database, mock.Mock(), "my_schema")


def test_get_table_names_subtracts_views() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    inspector = mock.MagicMock()
    inspector.get_table_names.return_value = ["t1", "t2", "v1", "v2"]
    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().fetchall.return_value = [
        ["v1"],
        ["v2"],
    ]

    result = PrestoEngineSpec.get_table_names(database, inspector, "my_schema")

    assert result == {"t1", "t2"}


def test_get_table_names_returns_empty_set_for_empty_schema() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    inspector = mock.MagicMock()
    inspector.get_table_names.return_value = []
    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().fetchall.return_value = []

    assert PrestoEngineSpec.get_table_names(database, inspector, "empty") == set()


def test_get_create_view_returns_view_definition() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.return_value = [["CREATE VIEW v AS SELECT 1", "b"], ["d"]]

    result = PrestoEngineSpec.get_create_view(database, schema="s", table="v")

    assert result == "CREATE VIEW v AS SELECT 1"


@pytest.mark.parametrize(
    "schema,table,expected_sql",
    [
        pytest.param("s", "v", "SHOW CREATE VIEW s.v", id="simple"),
        pytest.param(
            "analytics",
            "daily_users",
            "SHOW CREATE VIEW analytics.daily_users",
            id="schema_qualified",
        ),
        pytest.param(
            "Raw_2024",
            "Daily_Active_Users_v2",
            "SHOW CREATE VIEW Raw_2024.Daily_Active_Users_v2",
            id="mixed_case_digits_underscores",
        ),
    ],
)
def test_get_create_view_uses_schema_qualified_name(
    schema: str,
    table: str,
    expected_sql: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.return_value = [["CREATE VIEW ..."]]

    PrestoEngineSpec.get_create_view(database, schema=schema, table=table)

    cursor.execute.assert_called_once_with(expected_sql)


def test_get_create_view_returns_none_for_non_view() -> None:
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.side_effect = DatabaseError()

    assert PrestoEngineSpec.get_create_view(database, schema="s", table="t") is None


def test_get_create_view_propagates_other_errors() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.execute.side_effect = Exception("connection reset")

    with pytest.raises(Exception, match="connection reset"):
        PrestoEngineSpec.get_create_view(database, schema="s", table="v")


@mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.latest_partition")
@pytest.mark.parametrize(
    ["column_type", "column_value", "expected_value"],
    [
        ("DATE", "2023-05-01", "DATE '2023-05-01'"),
        ("TIMESTAMP", "2023-05-01", "TIMESTAMP '2023-05-01'"),
        ("VARCHAR", "2023-05-01", "'2023-05-01'"),
        ("INT", 1234, "1234"),
    ],
)
def test_where_latest_partition(
    mock_latest_partition,
    column_type: str,
    column_value: Any,
    expected_value: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_latest_partition.return_value = (["partition_key"], [column_value])

    assert (
        str(
            PrestoEngineSpec.where_latest_partition(  # type: ignore
                database=mock.MagicMock(),
                table=Table("table"),
                query=sql.select(text("* FROM table")),
                columns=[
                    {
                        "column_name": "partition_key",
                        "name": "partition_key",
                        "type": column_type,
                        "is_dttm": False,
                    }
                ],
            ).compile(
                dialect=PrestoDialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == f"""SELECT * FROM table \nWHERE "partition_key" = {expected_value}"""  # noqa: S608
    )


def test_adjust_engine_params_fully_qualified() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has catalog and schema.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive/default")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_adjust_engine_params_catalog_only() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has only the catalog.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_get_default_catalog() -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive/default",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "date_trunc('second', CAST(col AS TIMESTAMP))"),
        (
            "PT5S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT30S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1M", "date_trunc('minute', CAST(col AS TIMESTAMP))"),
        (
            "PT5M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT10M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 10)",  # noqa: E501
        ),
        (
            "PT15M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 15)",  # noqa: E501
        ),
        (
            "PT0.5H",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1H", "date_trunc('hour', CAST(col AS TIMESTAMP))"),
        (
            "PT6H",
            "date_trunc('hour', CAST(col AS TIMESTAMP)) - interval '1' hour * (hour(CAST(col AS TIMESTAMP)) % 6)",  # noqa: E501
        ),
        ("P1D", "date_trunc('day', CAST(col AS TIMESTAMP))"),
        ("P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        ("P1M", "date_trunc('month', CAST(col AS TIMESTAMP))"),
        ("P3M", "date_trunc('quarter', CAST(col AS TIMESTAMP))"),
        ("P1Y", "date_trunc('year', CAST(col AS TIMESTAMP))"),
        (
            "1969-12-28T00:00:00Z/P1W",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) - interval '1' day",  # noqa: E501
        ),
        ("1969-12-29T00:00:00Z/P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) + interval '5' day",  # noqa: E501
        ),
        (
            "P1W/1970-01-04T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP)) + interval '6' day",
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    database = mocker.MagicMock()
    dialect = mocker.MagicMock()

    def quote_table(table: Table, dialect: Dialect) -> str:
        return ".".join(
            part for part in (table.catalog, table.schema, table.table) if part
        )

    mocker.patch.object(spec, "quote_table", quote_table)

    spec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    )

    query = database.compile_sqla_query.mock_calls[0][1][0]
    assert (
        str(query)
        == """
SELECT * \nFROM my_catalog.my_schema.my_table
 LIMIT :param_1
    """.strip()
    )


def test_handle_boolean_filter() -> None:
    """
    Test that Presto uses equality operators for boolean filters instead of IS,
    since `col IS TRUE` can fail on computed boolean expressions like
    `(expiration = 1) AS expiration`.
    """
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils.core import FilterOperator

    bool_col = Column("test_col", Boolean)

    result_true = PrestoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_true.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = true"
    )

    result_false = PrestoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_FALSE, False
    )
    assert (
        str(result_false.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = false"
    )

    # Regression: the original bug was on computed boolean columns like
    # `(expiration = 1) AS expiration`. Verify the equality operator also
    # compiles correctly when the "column" is a computed expression.
    from sqlalchemy import literal_column

    computed_col = literal_column("(expiration = 1)")
    result_computed = PrestoEngineSpec.handle_boolean_filter(
        computed_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_computed.compile(compile_kwargs={"literal_binds": True}))
        == "(expiration = 1) = true"
    )


def test_extract_errors_maps_401_to_access_denied() -> None:
    """
    Regression for #33554: Presto 401 errors must surface as
    CONNECTION_ACCESS_DENIED_ERROR rather than a raw GENERIC_DB_ENGINE_ERROR.

    pyhive raises "presto error: Unexpected status code 401 b'Unauthorized'"
    when the Presto server rejects the connection with HTTP 401. SQL Lab
    users see a cryptic raw error instead of an actionable "check your
    credentials" message.

    The custom_errors map has a pattern for "Access Denied: Invalid
    credentials" (PyHive LDAP auth path), but not for the HTTP 401
    status-code message that pyhive raises when the server rejects the
    initial request. Adding the pattern surfaces a user-readable error.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import SupersetErrorType

    msg = "presto error: Unexpected status code 401 b'Unauthorized'"
    result = PrestoEngineSpec.extract_errors(Exception(msg))
    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR


@pytest.mark.parametrize(
    "raw_message,context,expected_error_type,expected_message",
    [
        pytest.param(
            "line 1:8: Column 'bar' cannot be resolved",
            {},
            "COLUMN_DOES_NOT_EXIST_ERROR",
            'We can\'t seem to resolve the column "bar" at line 1:8.',
            id="column_does_not_exist",
        ),
        pytest.param(
            "Table 'default.foo' does not exist",
            {},
            "TABLE_DOES_NOT_EXIST_ERROR",
            "The table \"'default.foo'\" does not exist. "
            "A valid table must be used to run this query.",
            id="table_does_not_exist",
        ),
        pytest.param(
            "line 1:15: Schema 'bar' does not exist",
            {},
            "SCHEMA_DOES_NOT_EXIST_ERROR",
            'The schema "bar" does not exist. '
            "A valid schema must be used to run this query.",
            id="schema_does_not_exist",
        ),
        pytest.param(
            "Access Denied: Invalid credentials",
            {"username": "bob"},
            "CONNECTION_ACCESS_DENIED_ERROR",
            'Either the username "bob" or the password is incorrect.',
            id="access_denied_invalid_credentials",
        ),
        pytest.param(
            "presto error: Unexpected status code 401 b'Unauthorized'",
            {},
            "CONNECTION_ACCESS_DENIED_ERROR",
            "Unexpected HTTP 401 response. Check your credentials.",
            id="access_denied_http_401",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 8] nodename nor "
            "servname provided, or not known",
            {"hostname": "badhost"},
            "CONNECTION_INVALID_HOSTNAME_ERROR",
            'The hostname "badhost" cannot be resolved.',
            id="invalid_hostname",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 60] Operation timed out",
            {"hostname": "myhost", "port": 8080},
            "CONNECTION_HOST_DOWN_ERROR",
            'The host "myhost" might be down, and can\'t be reached on port 8080.',
            id="host_down_operation_timed_out",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 61] Connection refused",
            {"hostname": "myhost", "port": 8080},
            "CONNECTION_PORT_CLOSED_ERROR",
            'Port 8080 on hostname "myhost" refused the connection.',
            id="port_closed",
        ),
        pytest.param(
            "line 1:8: Catalog 'foo' does not exist",
            {},
            "CONNECTION_UNKNOWN_DATABASE_ERROR",
            'Unable to connect to catalog named "foo".',
            id="unknown_catalog",
        ),
    ],
)
def test_extract_errors_matches_all_custom_error_patterns(
    raw_message: str,
    context: dict[str, Any],
    expected_error_type: str,
    expected_message: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import ErrorLevel, SupersetErrorType

    result = PrestoEngineSpec.extract_errors(Exception(raw_message), context=context)

    assert len(result) == 1
    assert result[0].error_type == getattr(SupersetErrorType, expected_error_type)
    assert result[0].message == expected_message
    assert result[0].level == ErrorLevel.ERROR
    assert result[0].extra is not None
    assert result[0].extra["engine_name"] == "Presto"


@pytest.mark.parametrize(
    "raw_message,missing_placeholder",
    [
        pytest.param(
            "Access Denied: Invalid credentials", "username", id="access_denied"
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 8] nodename nor "
            "servname provided, or not known",
            "hostname",
            id="invalid_hostname",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 60] Operation timed out",
            "hostname",
            id="host_down",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 61] Connection refused",
            "port",
            id="port_closed",
        ),
    ],
)
def test_extract_errors_raises_key_error_without_context(
    raw_message: str,
    missing_placeholder: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(KeyError, match=missing_placeholder):
        PrestoEngineSpec.extract_errors(Exception(raw_message))


def test_extract_errors_returns_first_matching_pattern() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import SupersetErrorType

    msg = "line 1:8: Table 'x' does not exist and Column 'bar' cannot be resolved"
    result = PrestoEngineSpec.extract_errors(Exception(msg))

    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR


def test_extract_errors_falls_back_to_generic_error() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import ErrorLevel, SupersetErrorType

    result = PrestoEngineSpec.extract_errors(Exception("Generic Error"))

    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert result[0].message == "Generic Error"
    assert result[0].level == ErrorLevel.ERROR
    assert result[0].extra is not None
    assert result[0].extra["engine_name"] == "Presto"
    assert result[0].extra["issue_codes"] == [
        {
            "code": 1002,
            "message": "Issue 1002 - The database returned an unexpected error.",
        }
    ]


def test_extract_error_message_from_orig_database_error() -> None:
    from collections import namedtuple

    from superset.db_engine_specs.presto import PrestoEngineSpec

    DatabaseError = namedtuple("DatabaseError", ["error_dict"])  # noqa: N806
    db_err = DatabaseError(
        {"errorName": "name", "errorLocation": "location", "message": "msg"}
    )
    exception = Exception()
    exception.orig = db_err  # type: ignore[attr-defined]

    assert PrestoEngineSpec._extract_error_message(exception) == "name at location: msg"


def test_extract_error_message_from_database_error_args() -> None:
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"message": "Err message"})

    assert PrestoEngineSpec._extract_error_message(exception) == "Err message"


def test_extract_error_message_from_database_error_without_message() -> None:
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"errorName": "SYNTAX_ERROR"})

    assert str(PrestoEngineSpec._extract_error_message(exception)) == (
        "Unknown Presto Error"
    )


def test_extract_error_message_from_general_exception() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec._extract_error_message(Exception("Err message"))
        == "Err message"
    )


def test_expand_data_returns_input_untouched_when_flag_disabled() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    columns: list[ResultSetColumnType] = [
        {
            "column_name": "row_column",
            "name": "row_column",
            "type": "ROW(NESTED_OBJ VARCHAR)",
            "is_dttm": False,
        }
    ]
    data = [{"row_column": ["a"]}]

    result_columns, result_data, expanded = PrestoEngineSpec.expand_data(columns, data)

    assert result_columns is columns
    assert result_data is data
    assert expanded == []


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    {"PRESTO_EXPAND_DATA": True},
    clear=True,
)
def test_expand_data_flattens_deeply_nested_row_columns() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    columns: list[ResultSetColumnType] = [
        {
            "column_name": "r",
            "name": "r",
            "type": "ROW(L1 ROW(L2 ROW(L3 ROW(L4 VARCHAR))))",
            "is_dttm": False,
        }
    ]
    data = [{"r": [[[["deep"]]]]}]

    result_columns, result_data, expanded = PrestoEngineSpec.expand_data(columns, data)

    assert [column["column_name"] for column in result_columns] == [
        "r",
        "r.l1",
        "r.l1.l2",
        "r.l1.l2.l3",
        "r.l1.l2.l3.l4",
    ]
    assert [column["column_name"] for column in expanded] == [
        "r.l1",
        "r.l1.l2",
        "r.l1.l2.l3",
        "r.l1.l2.l3.l4",
    ]
    assert result_data[0]["r.l1.l2.l3.l4"] == "deep"


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    {"PRESTO_EXPAND_DATA": True},
    clear=True,
)
def test_expand_data_raises_on_malformed_json_in_array_column() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    columns: list[ResultSetColumnType] = [
        {
            "column_name": "array_column",
            "name": "array_column",
            "type": "ARRAY(BIGINT)",
            "is_dttm": False,
        }
    ]

    with pytest.raises(ValueError, match="Expecting value"):
        PrestoEngineSpec.expand_data(columns, [{"array_column": "not json"}])


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    {"PRESTO_EXPAND_DATA": True},
    clear=True,
)
def test_expand_data_raises_on_malformed_json_in_row_column() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    columns: list[ResultSetColumnType] = [
        {
            "column_name": "row_column",
            "name": "row_column",
            "type": "ROW(NESTED_OBJ VARCHAR)",
            "is_dttm": False,
        }
    ]

    with pytest.raises(ValueError, match="Expecting value"):
        PrestoEngineSpec.expand_data(columns, [{"row_column": "not json"}])


def test_get_function_names_lists_presto_functions() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.return_value = pd.DataFrame(
        {"Function": ["abs", "avg", "cardinality"]}
    )

    assert PrestoEngineSpec.get_function_names(database) == [
        "abs",
        "avg",
        "cardinality",
    ]
    database.get_df.assert_called_once_with("SHOW FUNCTIONS")


def test_get_function_names_returns_empty_list_for_no_functions() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.return_value = pd.DataFrame({"Function": []})

    assert PrestoEngineSpec.get_function_names(database) == []


def test_get_function_names_raises_on_dataframe_without_function_column() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.return_value = pd.DataFrame()

    with pytest.raises(KeyError, match="Function"):
        PrestoEngineSpec.get_function_names(database)


def test_get_function_names_propagates_connection_error() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.side_effect = Exception("Connection refused")

    with pytest.raises(Exception, match="Connection refused"):
        PrestoEngineSpec.get_function_names(database)


@pytest.mark.parametrize(
    "extra,expected",
    [
        pytest.param({}, False, id="no_version_key"),
        pytest.param({"version": None}, False, id="version_none"),
        pytest.param({"version": "0.318"}, False, id="just_below_gate"),
        pytest.param({"version": "0.319"}, True, id="exactly_at_gate"),
        pytest.param({"version": "0.400"}, True, id="above_gate"),
    ],
)
def test_get_allow_cost_estimate_version_gate(
    extra: dict[str, Any],
    expected: bool,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_allow_cost_estimate(extra) is expected


def test_get_allow_cost_estimate_rejects_unparseable_version() -> None:
    from packaging.version import InvalidVersion

    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(InvalidVersion):
        PrestoEngineSpec.get_allow_cost_estimate({"version": "not-a-version"})


def test_estimate_statement_cost() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    cursor = mock.MagicMock()
    cursor.fetchone.return_value = ['{"a": "b"}']

    result = PrestoEngineSpec.estimate_statement_cost(
        mock.MagicMock(), "SELECT * FROM birth_names", cursor
    )

    assert result == {"a": "b"}
    cursor.execute.assert_called_once_with(
        "EXPLAIN (TYPE IO, FORMAT JSON) SELECT * FROM birth_names"
    )


def test_estimate_statement_cost_propagates_execute_failure() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    cursor = mock.MagicMock()
    cursor.execute.side_effect = Exception("line 1:1: mismatched input 'DROP'")

    with pytest.raises(Exception, match="mismatched input"):
        PrestoEngineSpec.estimate_statement_cost(
            mock.MagicMock(), "DROP TABLE birth_names", cursor
        )


def test_query_cost_formatter() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    raw_cost = [
        {
            "estimate": {
                "outputRowCount": 9.04969899e8,
                "outputSizeInBytes": 3.54143678301e11,
                "cpuCost": 3.54143678301e11,
                "maxMemory": 0.0,
                "networkCost": 3.54143678301e11,
            },
        }
    ]

    assert PrestoEngineSpec.query_cost_formatter(raw_cost) == [
        {
            "Output count": "904 M rows",
            "Output size": "354 GB",
            "CPU cost": "354 G",
            "Max memory": "0 B",
            "Network cost": "354 G",
        }
    ]


def test_query_cost_formatter_omits_missing_estimate_keys() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    raw_cost = [{"estimate": {"outputRowCount": 1234.0}}, {}]

    assert PrestoEngineSpec.query_cost_formatter(raw_cost) == [
        {"Output count": "1 K rows"},
        {},
    ]


def test_query_cost_formatter_raises_on_null_estimate_value() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(TypeError):
        PrestoEngineSpec.query_cost_formatter(
            [{"estimate": {"outputRowCount": None, "outputSizeInBytes": 1.0}}]
        )


def test_estimate_query_cost_raises_when_version_too_old(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mocker.MagicMock()
    database.get_extra.return_value = {"version": "0.318"}

    with pytest.raises(Exception, match="Database does not support cost estimation"):
        PrestoEngineSpec.estimate_query_cost(
            database, "hive", "default", "SELECT 1", None
        )

    database.get_raw_connection.assert_not_called()


def test_estimate_query_cost_estimates_each_statement(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mocker.MagicMock()
    database.get_extra.return_value = {"version": "0.400"}
    database.mutate_sql_based_on_config.side_effect = lambda sql, **_kwargs: sql
    cursor = mock.MagicMock()
    cursor.fetchone.side_effect = [
        ['{"estimate": {"outputRowCount": 1.0}}'],
        ['{"estimate": {"outputRowCount": 2.0}}'],
    ]
    database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value = (  # noqa: E501
        cursor
    )

    result = PrestoEngineSpec.estimate_query_cost(
        database, "hive", "default", "SELECT 1; SELECT 2", None
    )

    assert result == [
        {"estimate": {"outputRowCount": 1.0}},
        {"estimate": {"outputRowCount": 2.0}},
    ]
    assert cursor.execute.call_args_list == [
        mock.call("EXPLAIN (TYPE IO, FORMAT JSON) SELECT\n  1"),
        mock.call("EXPLAIN (TYPE IO, FORMAT JSON) SELECT\n  2"),
    ]


TRACKING_URL = (
    "https://presto.example.com:8080/ui/query.html?20220101_120000_00001_abcde"
)


def _presto_cursor() -> mock.MagicMock:
    cursor = mock.MagicMock()
    cursor._protocol = "https"
    cursor._host = "presto.example.com"
    cursor._port = 8080
    cursor.last_query_id = "20220101_120000_00001_abcde"
    return cursor


def _handle_cursor_query(
    mocker: MockerFixture,
) -> tuple[mock.MagicMock, mock.MagicMock]:
    from superset.common.db_query_status import QueryStatus

    mock_db = mocker.patch("superset.db_engine_specs.presto.db")
    query = mock.MagicMock()
    query.id = 42
    query.progress = 0
    query.status = QueryStatus.RUNNING
    query.database.connect_args = {"poll_interval": 0}
    mock_db.session.query.return_value.filter_by.return_value.one.return_value = query
    return mock_db, query


def test_get_tracking_url_builds_presto_ui_link() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_tracking_url(_presto_cursor()) == TRACKING_URL


def test_get_tracking_url_returns_none_for_falsy_query_id() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    cursor = _presto_cursor()
    cursor.last_query_id = None

    assert PrestoEngineSpec.get_tracking_url(cursor) is None


def test_get_tracking_url_returns_none_when_attribute_absent() -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_tracking_url(mock.Mock(spec=[])) is None


def test_handle_cursor_records_tracking_url_and_progress(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_db, query = _handle_cursor_query(mocker)
    cursor = _presto_cursor()
    cursor.poll.side_effect = [
        {"stats": {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}},
        None,
    ]

    PrestoEngineSpec.handle_cursor(cursor, query)

    assert query.tracking_url == TRACKING_URL
    assert query.progress == 50.0
    assert cursor.poll.call_count == 2
    cursor.cancel.assert_not_called()
    assert mock_db.session.commit.called


def test_handle_cursor_stops_polling_when_query_finished(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    _mock_db, query = _handle_cursor_query(mocker)
    cursor = _presto_cursor()
    cursor.poll.side_effect = [{"stats": {"state": "FINISHED"}}]

    PrestoEngineSpec.handle_cursor(cursor, query)

    assert query.progress == 0
    assert cursor.poll.call_count == 1
    cursor.cancel.assert_not_called()


@pytest.mark.parametrize("status", ["STOPPED", "TIMED_OUT"])
def test_handle_cursor_cancels_when_user_stops_query(
    mocker: MockerFixture,
    status: str,
) -> None:
    from superset.common.db_query_status import QueryStatus
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_db, running_query = _handle_cursor_query(mocker)
    stopped_query = mock.MagicMock()
    stopped_query.id = running_query.id
    stopped_query.progress = 0
    stopped_query.status = getattr(QueryStatus, status)
    mock_db.session.query.return_value.filter_by.return_value.one.return_value = (
        stopped_query
    )
    cursor = _presto_cursor()
    cursor.poll.side_effect = [
        {"stats": {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}},
    ]
    order = mock.Mock()
    order.attach_mock(mock_db.session.query, "reload")
    order.attach_mock(cursor.cancel, "cancel")

    PrestoEngineSpec.handle_cursor(cursor, running_query)

    cursor.cancel.assert_called_once_with()
    mock_db.session.query.return_value.filter_by.assert_called_once_with(
        id=running_query.id
    )
    call_names = [call[0] for call in order.mock_calls]
    assert call_names.index("cancel") > call_names.index("reload")
    assert running_query.status == QueryStatus.RUNNING
    assert stopped_query.progress == 0
    assert cursor.poll.call_count == 1


def test_handle_cursor_ignores_empty_stats(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    _mock_db, query = _handle_cursor_query(mocker)
    query.progress = 25
    cursor = _presto_cursor()
    cursor.poll.side_effect = [{"stats": {}}, None]

    PrestoEngineSpec.handle_cursor(cursor, query)

    assert query.progress == 25
    assert cursor.poll.call_count == 2


def test_handle_cursor_raises_type_error_on_missing_split_counts(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    _mock_db, query = _handle_cursor_query(mocker)
    cursor = _presto_cursor()
    cursor.poll.side_effect = [{"stats": {"state": "RUNNING"}}]

    with pytest.raises(TypeError):
        PrestoEngineSpec.handle_cursor(cursor, query)


def test_latest_sub_partition_rejects_unknown_field(
    mocker: MockerFixture,
) -> None:
    """Regression test for #41869.

    ``PrestoBaseEngineSpec.latest_sub_partition`` previously used a chained
    comparison (``k not in k in part_fields``) that Python evaluates as
    ``(k not in k) and (k in part_fields)``. Since ``k not in k`` is always
    ``False`` for strings, the guard was unreachable and unknown kwarg names
    were silently accepted, flowing into ``_partition_query`` and enabling
    SQL injection via the ``latest_sub_partition`` Jinja macro. This test
    locks in that unknown fields are now rejected before reaching the query
    builder.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec
    from superset.exceptions import SupersetTemplateException

    database: mock.MagicMock = mocker.MagicMock()
    database.get_indexes.return_value = [{"column_names": ["ds", "event_type"]}]
    table: mock.MagicMock = mocker.MagicMock()
    with pytest.raises(SupersetTemplateException) as exc_info:
        PrestoBaseEngineSpec.latest_sub_partition(
            database,
            table,
            unknown_field="anything",
        )

    assert "unknown_field" in str(exc_info.value)
    assert "not part of the partitioning key" in str(exc_info.value)


def test_partition_query_escapes_single_quote_in_filter_value(
    mocker: MockerFixture,
) -> None:
    """Regression test for #41869.

    ``_partition_query`` previously interpolated filter values directly into
    the SQL ``WHERE`` clause with an f-string, allowing SQL injection via any
    caller that let user input reach ``filters``. Values must be escaped
    (single-quote doubling per SQL standard) so a ``'`` in the value cannot
    break out of the string literal.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec

    database: mock.MagicMock = mocker.MagicMock()
    database.get_extra.return_value = {}
    table: Table = Table("my_table", "my_schema")

    injected: str = "2024-01-01' UNION SELECT secret FROM other_table--"
    sql: str = PrestoBaseEngineSpec._partition_query(
        table,
        indexes=[{"column_names": ["ds", "event_type"]}],
        database=database,
        filters={"ds": injected},
    )

    # The single quote in the value must be doubled so the injection stays
    # inside the SQL string literal — this is the whole payload wrapped in
    # ONE literal, escape sequence and all.
    assert "'2024-01-01'' UNION SELECT secret FROM other_table--'" in sql
    # The pre-escape form (single quote closing the literal early followed
    # by injected SQL) must NOT appear anywhere in the output — that would
    # mean the payload broke out of the literal.
    assert "'2024-01-01' UNION SELECT" not in sql


def test_mask_encrypted_extra() -> None:
    """
    The sensitive `auth_params` values are masked, while `auth_method` and
    non-sensitive fields such as `username` stay visible.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    config = json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "my-password"},
        }
    )

    assert PrestoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "XXXXXXXXXX"},
        }
    )


def test_mask_encrypted_extra_jwt_in_connect_args() -> None:
    """
    A JWT passed via `connect_args.requests_kwargs` is masked without touching
    the surrounding connection settings.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    config = json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "my-secret-token"},
            },
        }
    )

    assert PrestoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "XXXXXXXXXX"},
            },
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Masked credentials are reused from the previous value; edited ones are kept.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    old = json.dumps({"auth_method": "jwt", "auth_params": {"token": "old-token"}})
    new = json.dumps({"auth_method": "jwt", "auth_params": {"token": "XXXXXXXXXX"}})

    assert PrestoEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {"auth_method": "jwt", "auth_params": {"token": "old-token"}}
    )
