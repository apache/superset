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
from textwrap import dedent
from typing import Any, Optional
from unittest import mock

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
        # Reachable for real: ``jinja_context.py`` calls this with
        # ``target_type or ""`` when no column type is known. Both unmapped and
        # empty types must return ``None`` — every caller branches on that
        # (``if sql:``) rather than on an exception.
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
    """Story 105826: ``PrestoEngineSpec.convert_dttm`` renders TIMESTAMP literals
    with **millisecond** precision, discarding anything finer.

    ``PrestoEngineSpec.convert_dttm`` deliberately overrides
    ``PrestoBaseEngineSpec.convert_dttm``, which uses microseconds. Nothing pinned
    that distinction before, and it is the only silent-failure mode in this file: a
    malformed or wrong-precision literal produces a *valid* query returning the
    wrong rows, with no error. A refactor collapsing the two methods would shift
    every Presto timestamp filter's precision without breaking a single test.

    The 123 trailing microseconds below are dropped, not rounded.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.convert_dttm(
        "TIMESTAMP", datetime(2022, 1, 1, 1, 23, 45, 600123)
    ) == ("TIMESTAMP '2022-01-01 01:23:45.600'")


def test_convert_dttm_base_spec_keeps_microseconds() -> None:
    """Story 105826: ``PrestoBaseEngineSpec.convert_dttm`` — shared with Trino and
    the Hive family — keeps **microsecond** precision.

    The other half of the override documented in
    ``test_convert_dttm_presto_spec_truncates_to_milliseconds``. Same input, same
    target type, six fractional digits instead of three.
    """
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
        # Story 105826 — the rest of ``column_type_mappings``. A column mapped to
        # the wrong generic type is not aggregatable, gets the wrong filter widget
        # and the wrong chart axis, so every row in the mapping needs an assertion.
        ("boolean", types.BOOLEAN, None, GenericDataType.BOOLEAN, False),
        # ``TinyInteger`` is the only genuinely custom numeric type here; it
        # subclasses ``Integer``, so this asserts the specific class, not the base.
        ("tinyint", TinyInteger, None, GenericDataType.NUMERIC, False),
        ("smallint", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("bigint", types.BigInteger, None, GenericDataType.NUMERIC, False),
        # ``^real.*`` and ``^double.*`` both map to a bare ``FLOAT()``.
        ("real", types.FLOAT, None, GenericDataType.NUMERIC, False),
        ("double", types.FLOAT, None, GenericDataType.NUMERIC, False),
        # Precision and scale are DISCARDED: the mapping returns a bare
        # ``DECIMAL()`` regardless of what the native type declared. Pinned
        # deliberately — contrast ``varchar(255)`` above, where length survives.
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
        # Nested types keep their custom classes but are treated as STRING, which
        # is what lets the results grid render them at all.
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
    """Story 105827: a schema name survives being written into the SQLAlchemy URI
    and read back out.

    Presto encodes the schema into the URI path as ``catalog/schema``, so
    ``adjust_engine_params`` percent-quotes it with ``safe=""`` and
    ``get_schema_from_engine_params`` unquotes it. Any asymmetry between those two
    silently points SQL Lab at the wrong schema — and a schema containing ``/``
    would otherwise split the path and be read back as a different name entirely.

    Round-tripping is the assertion that matters here; testing either half alone
    would not catch a mismatched pair.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    uri, _connect_args = PrestoEngineSpec.adjust_engine_params(
        make_url("presto://localhost:8080/hive"),
        {},
        schema=schema,
    )

    assert PrestoEngineSpec.get_schema_from_engine_params(uri, {}) == schema


def test_get_catalog_names_lists_catalogs() -> None:
    """Story 105827: the catalog dropdown.

    Presto is multi-catalog, unlike most engines, so this override exists at all.
    The integration suite has a ``test_get_catalog_names`` but it returns early
    unless the example database is Presto — and it asserts against a *list* while
    the method returns a *set*, so it would fail if it ever actually ran. This is
    the first real coverage of the method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    inspector = mock.MagicMock()
    conn = inspector.engine.connect.return_value.__enter__.return_value
    conn.execute.return_value = [("jmx",), ("tpch",), ("memory",)]

    result = PrestoEngineSpec.get_catalog_names(mock.MagicMock(), inspector)

    assert result == {"jmx", "tpch", "memory"}
    assert str(conn.execute.call_args[0][0]) == "SHOW CATALOGS"


def test_get_view_names_queries_information_schema_with_schema() -> None:
    """Unit-suite mirror of presto_tests.py::test_get_view_names_with_schema (L41).

    pyhive's Presto dialect does not implement ``get_view_names`` at all, so
    Superset hand-rolls this ``information_schema`` query. If it breaks, views
    vanish from the dataset picker.

    Asserts the SQL body *and* the params: only the schema branch parameterises.
    The integration original is intentionally retained: it proves the same
    expectations against a live app and metadata database, which this test does not.
    """
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
    """Unit-suite mirror of
    presto_tests.py::test_get_view_names_without_schema (L63).

    No schema means no ``table_schema`` predicate and empty params — a different
    SQL body, not the same query with a null parameter.
    """
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
    """Story 105827: a schema with no views yields an empty set, not ``None``."""
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().fetchall.return_value = []

    assert PrestoEngineSpec.get_view_names(database, mock.Mock(), "empty") == set()


def test_get_view_names_propagates_driver_error() -> None:
    """Story 105827: ``get_view_names`` does not swallow driver errors.

    Whatever the reason the query fails — the schema was dropped, or the user lacks
    permission on ``information_schema`` — the exception surfaces. Nothing in the
    engine spec converts it, and for Presto the caller's
    ``get_dbapi_mapped_exception`` is a pass-through, since Presto overrides
    neither ``get_dbapi_exception_mapping`` nor ``parse_error_exception``.

    This replaces the ticket's "permission denied is handled gracefully"
    criterion, which describes handling that does not exist anywhere in this path.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().execute.side_effect = (
        DatabaseError("Access Denied: Cannot select from table information_schema")
    )

    with pytest.raises(DatabaseError, match="Access Denied"):
        PrestoEngineSpec.get_view_names(database, mock.Mock(), "my_schema")


def test_get_table_names_subtracts_views() -> None:
    """Story 105822: the whole reason this override exists.

    pyhive's dialect wrongly reports views as tables, so Presto's
    ``get_table_names`` subtracts the view names from what the inspector returned.
    If either side of that subtraction breaks, users report duplicated entries or
    missing tables.
    """
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
    """Story 105827: an empty schema yields an empty set from both sides of the
    subtraction.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    inspector = mock.MagicMock()
    inspector.get_table_names.return_value = []
    database = mock.MagicMock()
    database.get_raw_connection().__enter__().cursor().fetchall.return_value = []

    assert PrestoEngineSpec.get_table_names(database, inspector, "empty") == set()


def test_get_create_view_returns_view_definition() -> None:
    """Unit-suite mirror of presto_tests.py::test_get_create_view (L963).

    Despite the name it does not *generate* DDL — it runs ``SHOW CREATE VIEW`` and
    returns row 0, column 0, which is what the UI shows in the view-definition
    panel.
    """
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
        # Schema and table are interpolated into the SQL string, not passed as
        # bound parameters. Pinned so the interpolation is visible: these values
        # reach this method from the metadata database, not from user input, but
        # any change to that assumption changes the risk.
        pytest.param(
            "s",
            'v" OR 1=1',
            'SHOW CREATE VIEW s.v" OR 1=1',
            id="not_parameterised",
        ),
    ],
)
def test_get_create_view_interpolates_schema_qualified_name(
    schema: str,
    table: str,
    expected_sql: str,
) -> None:
    """Story 105822: the statement is built from a schema-qualified name."""
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.return_value = [["CREATE VIEW ..."]]

    PrestoEngineSpec.get_create_view(database, schema=schema, table=table)

    cursor.execute.assert_called_once_with(expected_sql)


def test_get_create_view_returns_none_for_non_view() -> None:
    """Unit-suite mirror of
    presto_tests.py::test_get_create_view_database_error (L985).

    ``SHOW CREATE VIEW`` on a real table raises ``DatabaseError``, which is caught
    and reported as "not a view" rather than surfacing as an error.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    cursor = database.get_raw_connection().__enter__().cursor()
    cursor.fetchall.side_effect = DatabaseError()

    assert PrestoEngineSpec.get_create_view(database, schema="s", table="t") is None


def test_get_create_view_propagates_other_errors() -> None:
    """Unit-suite mirror of presto_tests.py::test_get_create_view_exception (L976).

    Only ``DatabaseError`` means "not a view". Anything else — a dropped
    connection, an auth failure — propagates rather than being misreported as a
    missing view definition.
    """
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
            # The regex captures the surrounding single quotes, so the rendered
            # message doubles up the quoting. Pinned as-is: this is what a user
            # sees today, and changing it is a product decision, not a test fix.
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
    """Story 105825: every pattern in ``PrestoEngineSpec.custom_errors`` maps a raw
    driver message to a typed, user-readable error.

    These nine regexes are the difference between an actionable message and a raw
    pyhive string in a red toast. Before this test only the HTTP 401 pattern was
    covered, so a typo in any of the other eight shipped silently — invisible until
    a user hit that exact error.

    ``context`` is not optional for the four patterns whose message templates
    reference placeholders their regex never captures; see
    ``test_extract_errors_raises_key_error_without_context``.

    Asserts ``error_type`` and the rendered message only — never whole-``extra``
    equality, because ``extract_errors`` mutates the class-level ``custom_errors``
    dicts in place (``base.py`` writes ``extra["engine_name"]``, and
    ``SupersetError.__post_init__`` adds ``issue_codes``), which makes any
    whole-dict assertion order-dependent.
    """
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
    """Story 105825 — CHARACTERIZATION test, not an endorsement of this behaviour.

    Four of the nine patterns declare message placeholders their own regex never
    captures, so ``base.extract_errors`` builds ``params`` without them and the
    eager-``gettext`` ``str % dict`` raises ``KeyError``. Callers that omit
    ``context`` therefore get a ``KeyError`` instead of a typed Superset error.

    This is pinned as current behaviour so a future fix is a deliberate, visible
    change rather than an accident. If these connection errors should degrade
    gracefully instead — returning a typed error rather than raising — then
    this test inverts and the four patterns move into the matrix above with an
    empty context.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(KeyError, match=missing_placeholder):
        PrestoEngineSpec.extract_errors(Exception(raw_message))


def test_extract_errors_returns_first_matching_pattern() -> None:
    """Story 105825: ``extract_errors`` returns on the first matching regex.

    ``custom_errors`` is iterated in insertion order, after any
    ``CUSTOM_DATABASE_ERRORS`` config entries, and the loop returns as soon as one
    regex matches. A message satisfying two patterns therefore resolves to
    whichever is declared first — ``COLUMN_DOES_NOT_EXIST_REGEX`` here, not
    ``TABLE_DOES_NOT_EXIST_REGEX``. Pinning this makes reordering the dict a
    visible behaviour change rather than a silent one.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import SupersetErrorType

    msg = "line 1:8: Table 'x' does not exist and Column 'bar' cannot be resolved"
    result = PrestoEngineSpec.extract_errors(Exception(msg))

    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR


def test_extract_errors_falls_back_to_generic_error() -> None:
    """Unit-suite mirror of presto_tests.py::test_extract_errors (L1020).

    A message matching none of the nine patterns falls through to
    ``GENERIC_DB_ENGINE_ERROR`` carrying the raw text. The integration original is
    intentionally retained; this mirror only removes the app/DB fixture requirement.
    """
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
    """Unit-suite mirror of presto_tests.py::test_extract_error_message_orig (L998).

    Branch 1 of three: a SQLAlchemy wrapper exposing the driver error via ``.orig``,
    whose first element is Presto's error dict. Without this the user would see
    ``<object at 0x...>`` instead of the server's own diagnosis.
    """
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
    """Unit-suite mirror of
    presto_tests.py::test_extract_error_message_db_error (L1008).

    Branch 2 of three: pyhive raises ``DatabaseError`` with the error dict as its
    first arg.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"message": "Err message"})

    assert PrestoEngineSpec._extract_error_message(exception) == "Err message"


def test_extract_error_message_from_database_error_without_message() -> None:
    """Story 105825: a ``DatabaseError`` whose dict carries no ``message`` key
    degrades to a fixed string rather than raising.

    This is the "malformed error responses are handled gracefully" criterion — the
    one branch of ``_extract_error_message`` with no coverage in either suite.
    ``_`` is ``lazy_gettext``, so the return value is a ``LazyString`` and must be
    coerced before comparison.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"errorName": "SYNTAX_ERROR"})

    assert str(PrestoEngineSpec._extract_error_message(exception)) == (
        "Unknown Presto Error"
    )


def test_extract_error_message_from_general_exception() -> None:
    """Unit-suite mirror of
    presto_tests.py::test_extract_error_message_general_exception (L1015).

    Branch 3 of three: anything else falls back to
    ``utils.error_msg_from_exception``.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec._extract_error_message(Exception("Err message"))
        == "Err message"
    )


def test_expand_data_returns_input_untouched_when_flag_disabled() -> None:
    """Story 105870: with ``PRESTO_EXPAND_DATA`` off, the inputs come back as they
    went in and nothing is expanded.

    This is the path almost every deployment takes: the flag defaults to ``False``
    and is documented in ``config.py`` as "Experimental, doesn't work with all
    nested types", lifecycle ``development``. It was also completely untested,
    which is worth fixing first — a regression here would switch nested-column
    expansion on for everyone.
    """
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
    """Story 105870: five levels of nested ``ROW`` terminate and flatten correctly.

    The ticket asks for this to "complete without recursion errors", but
    ``expand_data`` is **iterative** — a ``deque`` with a ``while`` loop — so
    ``RecursionError`` cannot occur and that assertion would pass vacuously. What
    is worth asserting is termination plus correctness, which is what this does.

    The exact column list is asserted rather than just its length, so a future
    change in breadth — the real risk here, along with the O(n^2) de-duplication
    check on each iteration — trips this test instead of passing silently.
    """
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
    """Story 105870 — CHARACTERIZATION test. This asserts a bug, deliberately.

    ``destringify`` is ``json.loads`` with no ``try/except`` (``result_set.py``),
    so a nested column whose value is not valid JSON raises out of ``expand_data``
    rather than passing through. Via simplejson the exception is a
    ``JSONDecodeError``, which subclasses ``ValueError``.

    The ticket asks for "graceful pass-through rather than uncaught exception" —
    that describes a fix which has not been written. Rather than blocking the
    story, current behaviour is pinned here and in the ROW-branch test below. When
    the companion fix ticket lands, both invert; that inversion should be an
    acceptance criterion on the fix, not tribal knowledge.

    No ``xfail`` — that would silently mask the gap.
    """
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
    """Story 105870 — CHARACTERIZATION test, the second unguarded ``destringify``.

    There are two call sites, not one: the ARRAY branch and the ROW branch. A fix
    that guards only the first would leave this path crashing, so both are pinned.
    """
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
    """Story 105824: SQL Lab autocomplete.

    The implementation is a single line — ``SHOW FUNCTIONS`` into a DataFrame,
    ``["Function"].tolist()`` out — with no error handling and no de-duplication.
    Worth stating plainly: if this returns nothing, users type function names by
    hand and nothing else breaks. It is the lowest-impact method in the file.
    """
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
    """Story 105824: a well-formed but empty result yields an empty list.

    "Handles an empty function list" is ambiguous in the ticket, and the two
    readings behave differently. This is the benign one: the ``Function`` column
    exists but has no rows.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.return_value = pd.DataFrame({"Function": []})

    assert PrestoEngineSpec.get_function_names(database) == []


def test_get_function_names_raises_on_dataframe_without_function_column() -> None:
    """Story 105824 — CHARACTERIZATION test, and the other reading of "empty".

    A DataFrame with no ``Function`` column at all — an entirely empty result, or a
    Presto version that labels the column differently — raises ``KeyError`` rather
    than degrading to an empty list.

    Pinned to resolve the ticket's ambiguity by asserting both readings explicitly
    rather than picking one silently.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    database = mock.MagicMock()
    database.get_df.return_value = pd.DataFrame()

    with pytest.raises(KeyError, match="Function"):
        PrestoEngineSpec.get_function_names(database)


def test_get_function_names_propagates_connection_error() -> None:
    """Story 105824: the engine spec propagates; it does not degrade gracefully.

    The ticket asks for graceful handling of connection errors, but that already
    exists one layer up: ``Database.function_names`` wraps this call in a broad
    ``try/except`` returning ``[]``, with a comment citing issue #9678 — "used in
    bulk APIs and should not hard crash".

    So the spec-layer contract is propagation, which is what is asserted here. The
    graceful-``[]`` behaviour belongs to a ``Database.function_names`` test, in a
    different module.
    """
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
    """Story 105821: cost estimation requires Presto >= 0.319.

    Showing the "Estimate cost" button on a version that cannot support it produces
    a confusing failure at click time instead of a hidden button, so the boundary
    is worth pinning exactly — including the off-by-one at 0.318/0.319 and the
    ``{"version": None}`` case, which is a different code path from a missing key.

    Reach is low either way: ``Database.allows_cost_estimate`` additionally
    requires an admin to have set ``cost_estimate_enabled`` in the database's Extra
    JSON, so this gate is only half of a double opt-in.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_allow_cost_estimate(extra) is expected


def test_get_allow_cost_estimate_rejects_unparseable_version() -> None:
    """Story 105821 — CHARACTERIZATION test, not an endorsement of this behaviour.

    A non-empty but unparseable version string reaches ``packaging.Version`` and
    raises ``InvalidVersion``, so a malformed ``version`` in a database's Extra
    JSON surfaces as an exception rather than simply disabling the feature.

    Pinned so a future guard is deliberate. Whether an admin typo should disable
    cost estimation or raise is a product decision, not a test fix.
    """
    from packaging.version import InvalidVersion

    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(InvalidVersion):
        PrestoEngineSpec.get_allow_cost_estimate({"version": "not-a-version"})


def test_estimate_statement_cost() -> None:
    """Unit-suite mirror of presto_tests.py::test_estimate_statement_cost (L940).

    ``EXPLAIN (TYPE IO, FORMAT JSON)`` returns a single row, single column of JSON,
    which is parsed and handed back untouched. The integration original is
    intentionally retained; this mirror only removes the app/DB fixture requirement.
    """
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
    """Unit-suite mirror of
    presto_tests.py::test_estimate_statement_cost_invalid_syntax (L954).

    A statement Presto refuses to explain — invalid syntax, or a DDL statement it
    will not plan — raises from ``cursor.execute`` and is not swallowed here.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    cursor = mock.MagicMock()
    cursor.execute.side_effect = Exception("line 1:1: mismatched input 'DROP'")

    with pytest.raises(Exception, match="mismatched input"):
        PrestoEngineSpec.estimate_statement_cost(
            mock.MagicMock(), "DROP TABLE birth_names", cursor
        )


def test_query_cost_formatter() -> None:
    """Unit-suite mirror of presto_tests.py::test_query_cost_formatter (L617).

    Turns raw float estimates into the strings shown in the cost panel. Same
    expectations as the integration original, with that test's large
    ``inputTableColumnInfos`` block dropped — the formatter only reads
    ``row["estimate"]``.

    Note ``humanize`` floor-divides by 1000 repeatedly, so these are deliberately
    coarse: 904,969,899 rows renders as "904 M rows", not "905 M rows".
    """
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
    """Story 105821: only the keys Presto actually returned are formatted.

    A partial estimate must not surface as zeros or placeholder rows in the cost
    panel, and a row with no ``estimate`` at all yields an empty dict rather than
    raising.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    raw_cost = [{"estimate": {"outputRowCount": 1234.0}}, {}]

    assert PrestoEngineSpec.query_cost_formatter(raw_cost) == [
        {"Output count": "1 K rows"},
        {},
    ]


def test_query_cost_formatter_raises_on_null_estimate_value() -> None:
    """Story 105821 — CHARACTERIZATION test, not an endorsement of this behaviour.

    ``humanize`` guards ``int(value)`` with ``except ValueError`` only, but a JSON
    ``null`` in the estimate reaches it as ``None`` and ``int(None)`` raises
    **``TypeError``**, which is not caught. So a Presto estimate carrying a null
    field breaks the cost panel outright instead of rendering the fields that did
    arrive.

    Contrast ``test_query_cost_formatter_omits_missing_estimate_keys``: an *absent*
    key is handled cleanly, a *null* value is not. Pinned so a future widening of
    that ``except`` is deliberate.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(TypeError):
        PrestoEngineSpec.query_cost_formatter(
            [{"estimate": {"outputRowCount": None, "outputSizeInBytes": 1.0}}]
        )


def test_estimate_query_cost_raises_when_version_too_old(
    mocker: MockerFixture,
) -> None:
    """Story 105821: the disabled path.

    This criterion is base-class code (``BaseEngineSpec.estimate_query_cost``)
    reached *through* the Presto spec: the version gate is consulted before any
    connection is opened, and failing it raises rather than returning an empty
    estimate.
    """
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
    """Story 105821: multi-statement handling, also base-class code.

    The SQL is parsed by a real ``SQLScript``, so each statement gets its own
    ``EXPLAIN`` on the same cursor and the results come back in order. One cost
    entry per statement — not one per query.

    Note the statements are *re-rendered* by the parser before being explained,
    not passed through verbatim: ``SELECT 1`` reaches the cursor pretty-printed as
    ``SELECT\n  1``. Asserted as-is, because what actually gets sent to Presto is
    the point of the test.
    """
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
    """A pyhive-shaped cursor whose tracking-URL attributes are real values.

    A bare ``MagicMock`` auto-creates every attribute, so ``get_tracking_url``
    would happily interpolate ``<MagicMock ...>`` reprs into the URL and the test
    would assert nothing useful.
    """
    cursor = mock.MagicMock()
    cursor._protocol = "https"
    cursor._host = "presto.example.com"
    cursor._port = 8080
    cursor.last_query_id = "20220101_120000_00001_abcde"
    return cursor


def _handle_cursor_query(
    mocker: MockerFixture,
) -> tuple[mock.MagicMock, mock.MagicMock]:
    """Wire up the ``(mock_db, query)`` pair ``handle_cursor`` needs.

    Three things bite here and all three are load-bearing:

    - ``handle_cursor`` re-reads the query from the session on every iteration, so
      the object the assertions inspect is the session's return value, not the one
      passed in — it has to be wired back.
    - ``poll_interval`` comes from ``query.database.connect_args.get(...)``, which
      on a ``MagicMock`` returns a ``MagicMock`` that later explodes inside
      ``time.sleep``. It must be a real dict, and a real zero.
    - ``query.progress`` feeds ``max(query.progress, progress)``, so it must be a
      real number.
    """
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
    """Story 105823: the "View in Presto" deep link is assembled from the cursor's
    protocol, host, port and query id.

    The ticket describes this as reading ``info_uri``; the implementation uses
    ``last_query_id``, ``_protocol``, ``_host`` and ``_port`` instead, and there is
    no ``info_uri`` anywhere in the file.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_tracking_url(_presto_cursor()) == TRACKING_URL


def test_get_tracking_url_returns_none_for_falsy_query_id() -> None:
    """Story 105823: no query id yet — the cursor exists but has not been assigned
    a Presto query — yields no link rather than a malformed one.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    cursor = _presto_cursor()
    cursor.last_query_id = None

    assert PrestoEngineSpec.get_tracking_url(cursor) is None


def test_get_tracking_url_returns_none_when_attribute_absent() -> None:
    """Story 105823: the second, distinct ``None`` path — the attribute is missing
    entirely, so ``contextlib.suppress(AttributeError)`` swallows the lookup.

    ``spec=[]`` is required to reach it: a plain ``MagicMock`` auto-creates
    ``last_query_id``, so the ``AttributeError`` never fires and this branch would
    silently go untested.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.get_tracking_url(mock.Mock(spec=[])) is None


def test_handle_cursor_records_tracking_url_and_progress(
    mocker: MockerFixture,
) -> None:
    """Story 105823: the SQL Lab progress bar.

    One poll reporting 5 of 10 splits complete, then ``None`` to end the query.
    The tracking URL is written once up front, and progress is recorded as a
    percentage.
    """
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
    """Story 105823: a ``FINISHED`` state breaks out of the loop *before* the
    progress arithmetic runs.

    That ordering matters: the final poll of a finished query carries no split
    counts, so reaching the progress update would raise (see
    ``test_handle_cursor_raises_type_error_on_missing_split_counts``).
    """
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
    """Story 105823: **the Stop button.**

    While a query runs, the user clicking Stop only sets the query's status in the
    metadata database — nothing signals the worker directly. This loop is what
    notices, and the ``cursor.cancel()`` it issues is what actually releases the
    Presto cluster resources.

    If this branch regressed, Stop would appear to work in the UI while the query
    kept running on the cluster, and nothing would fail loudly. The re-read of the
    query from the session on every iteration is precisely how the click crosses
    process boundaries, which is why the mock wires the session's return value
    back to the same object.
    """
    from superset.common.db_query_status import QueryStatus
    from superset.db_engine_specs.presto import PrestoEngineSpec

    _mock_db, query = _handle_cursor_query(mocker)
    query.status = getattr(QueryStatus, status)
    cursor = _presto_cursor()
    cursor.poll.side_effect = [
        {"stats": {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}},
    ]

    PrestoEngineSpec.handle_cursor(cursor, query)

    cursor.cancel.assert_called_once_with()
    assert query.progress == 0
    assert cursor.poll.call_count == 1


def test_handle_cursor_ignores_empty_stats(mocker: MockerFixture) -> None:
    """Story 105823: a poll carrying an empty ``stats`` block leaves progress
    untouched and keeps polling, rather than resetting the bar to zero.

    Note the payload is ``{"stats": {}}`` and not ``{}``: the loop condition tests
    the poll result itself, so any falsy payload ends polling immediately. Only a
    truthy payload with empty stats reaches the branch under test.
    """
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
    """Story 105823 — CHARACTERIZATION test, not an endorsement of this behaviour.

    ``completedSplits``/``totalSplits`` are read with ``stats.get(...)`` and passed
    straight to ``float()``, so a poll that reports a state but omits the split
    counts raises ``TypeError`` inside the worker rather than degrading to "no
    progress information".

    Pinned so a future guard is a deliberate change. Fixing it is out of scope for
    a test-only change and deserves its own issue: the fix has to decide whether a
    stats block without split counts means "no progress yet" or is a driver bug.
    """
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
