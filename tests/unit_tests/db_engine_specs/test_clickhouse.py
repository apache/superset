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

import sys
import types as pytypes
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from unittest.mock import Mock

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url
from sqlalchemy.types import (
    Boolean,
    Date,
    DateTime,
    DECIMAL,
    Float,
    Integer,
    String,
    TypeEngine,
)
from urllib3.connection import HTTPConnection
from urllib3.exceptions import NewConnectionError

from superset.sql.parse import Table
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "toDate('2019-01-02')"),
        ("DateTime", "toDateTime('2019-01-02 03:04:05', 'UTC')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.clickhouse import (
        ClickHouseEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "{col}"),
        ("PT1S", "toStartOfSecond(toDateTime64({col}, 3))"),
        ("PT1M", "toStartOfMinute(toDateTime({col}))"),
    ],
)
def test_time_grain_expressions(time_grain: Optional[str], expected: str) -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseBaseEngineSpec

    assert ClickHouseBaseEngineSpec._time_grain_expressions[time_grain] == expected


def test_convert_dttm_normalizes_aware_datetime_to_utc() -> None:
    from superset.db_engine_specs.clickhouse import (
        ClickHouseEngineSpec as spec,  # noqa: N813
    )

    aware_dttm: datetime = datetime(
        2026,
        6,
        30,
        12,
        30,
        tzinfo=timezone(timedelta(hours=3)),
    )

    assert (
        spec.convert_dttm("DateTime", aware_dttm)
        == "toDateTime('2026-06-30 09:30:00', 'UTC')"
    )


def test_execute_connection_error() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec
    from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError

    database = Mock()
    cursor = Mock()
    cursor.execute.side_effect = NewConnectionError(
        HTTPConnection("localhost"), "Exception with sensitive data"
    )
    with pytest.raises(SupersetDBAPIDatabaseError) as excinfo:
        ClickHouseEngineSpec.execute(cursor, "SELECT col1 from table1", database)
    assert str(excinfo.value) == "Connection failed"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "toDate('2019-01-02')"),
        ("DateTime", "toDateTime('2019-01-02 03:04:05', 'UTC')"),
        ("UnknownType", None),
    ],
)
def test_connect_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.clickhouse import (
        ClickHouseEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("String", String, None, GenericDataType.STRING, False),
        ("LowCardinality(String)", String, None, GenericDataType.STRING, False),
        ("Nullable(String)", String, None, GenericDataType.STRING, False),
        (
            "LowCardinality(Nullable(String))",
            String,
            None,
            GenericDataType.STRING,
            False,
        ),
        ("Array(UInt8)", String, None, GenericDataType.MULTI_VALUE, False),
        ("Array(String)", String, None, GenericDataType.MULTI_VALUE, False),
        ("Array(UInt64)", String, None, GenericDataType.MULTI_VALUE, False),
        (
            "Array(LowCardinality(String))",
            String,
            None,
            GenericDataType.MULTI_VALUE,
            False,
        ),
        # Array(Enum(...)) is a real array and must classify as MULTI_VALUE, not
        # get short-circuited by the Enum rule (the anchored ^Array\( pattern is
        # ordered before the Enum entry).
        (
            "Array(Enum8('a' = 1, 'b' = 2))",
            String,
            None,
            GenericDataType.MULTI_VALUE,
            False,
        ),
        # Arrays nested inside Map/Tuple are not top-level array columns; the
        # anchored pattern must not over-match them into MULTI_VALUE.
        ("Map(String, Array(String))", String, None, GenericDataType.STRING, False),
        ("Tuple(Array(String))", String, None, GenericDataType.STRING, False),
        ("Enum('hello', 'world')", String, None, GenericDataType.STRING, False),
        ("Enum('UInt32', 'Bool')", String, None, GenericDataType.STRING, False),
        (
            "LowCardinality(Enum('hello', 'world'))",
            String,
            None,
            GenericDataType.STRING,
            False,
        ),
        (
            "Nullable(Enum('hello', 'world'))",
            String,
            None,
            GenericDataType.STRING,
            False,
        ),
        (
            "LowCardinality(Nullable(Enum('hello', 'world')))",
            String,
            None,
            GenericDataType.STRING,
            False,
        ),
        ("FixedString(16)", String, None, GenericDataType.STRING, False),
        ("Nullable(FixedString(16))", String, None, GenericDataType.STRING, False),
        (
            "LowCardinality(Nullable(FixedString(16)))",
            String,
            None,
            GenericDataType.STRING,
            False,
        ),
        ("UUID", String, None, GenericDataType.STRING, False),
        ("Int8", Integer, None, GenericDataType.NUMERIC, False),
        ("Int16", Integer, None, GenericDataType.NUMERIC, False),
        ("Int32", Integer, None, GenericDataType.NUMERIC, False),
        ("Int64", Integer, None, GenericDataType.NUMERIC, False),
        ("Int128", Integer, None, GenericDataType.NUMERIC, False),
        ("Int256", Integer, None, GenericDataType.NUMERIC, False),
        ("Nullable(Int256)", Integer, None, GenericDataType.NUMERIC, False),
        (
            "LowCardinality(Nullable(Int256))",
            Integer,
            None,
            GenericDataType.NUMERIC,
            False,
        ),
        ("UInt8", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt16", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt32", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt64", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt128", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt256", Integer, None, GenericDataType.NUMERIC, False),
        ("Nullable(UInt256)", Integer, None, GenericDataType.NUMERIC, False),
        (
            "LowCardinality(Nullable(UInt256))",
            Integer,
            None,
            GenericDataType.NUMERIC,
            False,
        ),
        ("Float32", Float, None, GenericDataType.NUMERIC, False),
        ("Float64", Float, None, GenericDataType.NUMERIC, False),
        ("Decimal(1, 2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal32(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal64(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal128(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal256(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Bool", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Nullable(Bool)", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Date", Date, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Date)", Date, None, GenericDataType.TEMPORAL, True),
        ("LowCardinality(Nullable(Date))", Date, None, GenericDataType.TEMPORAL, True),
        ("Date32", Date, None, GenericDataType.TEMPORAL, True),
        ("Datetime", DateTime, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Datetime)", DateTime, None, GenericDataType.TEMPORAL, True),
        (
            "LowCardinality(Nullable(Datetime))",
            DateTime,
            None,
            GenericDataType.TEMPORAL,
            True,
        ),
        ("Datetime('UTC')", DateTime, None, GenericDataType.TEMPORAL, True),
        ("Datetime64(3)", DateTime, None, GenericDataType.TEMPORAL, True),
        ("Datetime64(3, 'UTC')", DateTime, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_connect_get_column_spec(
    native_type: str,
    sqla_type: type[TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.clickhouse import (
        ClickHouseConnectEngineSpec as spec,  # noqa: N813
    )

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "schema, expected_result",
    [
        (None, "clickhousedb+connect://localhost:443/__default__"),
        (
            "new_schema",
            "clickhousedb+connect://localhost:443/new_schema",
        ),
    ],
)
def test_adjust_engine_params_fully_qualified(
    schema: str, expected_result: str
) -> None:
    from superset.db_engine_specs.clickhouse import (
        ClickHouseConnectEngineSpec as spec,  # noqa: N813
    )

    url = make_url("clickhousedb+connect://localhost:443/__default__")

    uri = spec.adjust_engine_params(url, {}, None, schema)[0]
    assert str(uri) == expected_result


def test_get_column_description_retry_sql_preserves_comments_and_zero_rows() -> None:
    """
    Regression test for SC-114843.

    clickhouse-connect's cursor only backfills cursor.description for a
    zero-row result when the operation string starts with SELECT/WITH after
    stripping whitespace. SQL_QUERY_MUTATOR-inserted leading comments (e.g.
    query hash / workspace attribution) defeat that check. The retry SQL
    built by ``get_column_description_retry_sql`` must wrap the *exact*
    mutated SQL -- including all of its comments -- in a bare outer SELECT,
    without dropping or reordering anything, and without introducing a
    real-row probe.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    mutated_sql = (
        "-- query hash: abc123\n"
        "-- workspace_slug: acme-corp\n"
        "SELECT arrayElement(tags, 1) AS tag\n"
        "FROM events\n"
        "WHERE false\n"
        "LIMIT 1\n"
        "-- query hash: abc123"
    )

    retry_sql = ClickHouseConnectEngineSpec.get_column_description_retry_sql(
        mutated_sql
    )

    assert retry_sql is not None
    assert retry_sql.strip().upper().startswith("SELECT")
    # every line of the original mutated SQL -- comments included -- must
    # survive verbatim
    for line in mutated_sql.splitlines():
        assert line in retry_sql
    assert "where false" in retry_sql.lower()
    assert retry_sql.strip().lower().endswith("limit 0")


def test_base_engine_spec_has_no_column_description_retry_by_default() -> None:
    """
    The comment-safe retry is opt-in: engines that don't override
    ``get_column_description_retry_sql`` must keep returning ``None`` so
    ``get_columns_description`` never retries for them.
    """
    from superset.db_engine_specs.base import BaseEngineSpec

    assert BaseEngineSpec.get_column_description_retry_sql("SELECT 1") is None


def test_sampling_read_limit_override_base_spec_returns_none() -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    sql = "SELECT col FROM tbl LIMIT 100"
    assert BaseEngineSpec.apply_sampling_read_limit_override(sql) is None


@pytest.mark.parametrize(
    "spec_name",
    ["ClickHouseEngineSpec", "ClickHouseConnectEngineSpec"],
)
def test_sampling_read_limit_override_clickhouse_family(spec_name: str) -> None:
    from superset.db_engine_specs import clickhouse

    spec = getattr(clickhouse, spec_name)
    sql = "SELECT col FROM tbl LIMIT 100"
    assert spec.apply_sampling_read_limit_override(sql) == (
        "SELECT col FROM tbl LIMIT 100\nSETTINGS read_overflow_mode='break'"
    )


def test_sampling_read_limit_override_strips_statement_terminator() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    assert ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(
        "SELECT col FROM tbl LIMIT 100;\n"
    ) == ("SELECT col FROM tbl LIMIT 100\nSETTINGS read_overflow_mode='break'")


def test_sampling_read_limit_override_survives_trailing_comment() -> None:
    """
    The retry operates on the final mutated statement, which SQL mutators may
    terminate with a single-line comment; the SETTINGS clause must land on its
    own line so the comment cannot swallow it.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    sql = "SELECT col FROM tbl LIMIT 100\n-- query hash: abc123"
    result = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(sql)
    assert result is not None
    assert result.splitlines()[-1] == "SETTINGS read_overflow_mode='break'"


def test_sampling_read_limit_override_already_applied_returns_none() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    sql = "SELECT col FROM tbl LIMIT 100"
    once = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(sql)
    assert once is not None
    assert ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(once) is None


def test_sampling_read_limit_override_existing_settings_returns_none() -> None:
    """
    ClickHouse permits one SETTINGS clause per statement; SQL that already
    carries one (from any source) must not be retried with a second.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    sql = "SELECT col FROM tbl LIMIT 100 SETTINGS max_threads=2"
    assert ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(sql) is None


def test_sampling_read_limit_override_ignores_settings_text_in_literals() -> None:
    """
    SETTINGS-clause-shaped text inside string literals or comments (e.g. a
    fetch_values_predicate value or a mutator comment) must not suppress the
    retry -- only a genuine statement-level clause counts.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    in_literal = (
        "SELECT DISTINCT col AS column_values FROM tbl "
        "WHERE note = 'try SETTINGS max_threads=4 for speed' LIMIT 100"
    )
    result = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(in_literal)
    assert result is not None
    assert result.endswith("SETTINGS read_overflow_mode='break'")

    in_comment = (
        "SELECT col FROM tbl LIMIT 100\n-- mutator note: SETTINGS max_threads=4"
    )
    result = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(in_comment)
    assert result is not None

    genuine = "SELECT col FROM tbl LIMIT 100 SETTINGS max_threads=4 -- note"
    assert (
        ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(genuine) is None
    )


def test_sampling_read_limit_override_ignores_settings_named_column() -> None:
    """
    The existing-clause guard matches the ``SETTINGS <key> = ...`` clause
    shape, not the bare token, so a column named ``settings`` must not
    suppress the retry.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    sql = "SELECT DISTINCT settings AS column_values FROM tbl LIMIT 100"
    result = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(sql)
    assert result is not None
    assert result.endswith("SETTINGS read_overflow_mode='break'")

    filtered = "SELECT DISTINCT settings FROM tbl WHERE settings = 'a' LIMIT 100"
    result = ClickHouseConnectEngineSpec.apply_sampling_read_limit_override(filtered)
    assert result is not None


def _make_database(spec: Any, opt_out: bool = False) -> Any:
    """A minimal Database stand-in with the real retry methods bound."""
    from superset.models.core import Database

    class FakeDatabase:
        unique_name = "test_db"
        db_engine_spec = spec
        disable_sampling_read_limit_override = opt_out
        sampling_read_limit_retry_sql = Database.sampling_read_limit_retry_sql
        run_with_sampling_read_limit_retry = Database.run_with_sampling_read_limit_retry

    return FakeDatabase()


def test_database_sampling_read_limit_retry_sql_honors_opt_out() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    sql = "SELECT col FROM tbl LIMIT 100"

    database = _make_database(ClickHouseConnectEngineSpec)
    retry_sql = database.sampling_read_limit_retry_sql(sql)
    assert retry_sql is not None
    assert retry_sql.endswith("SETTINGS read_overflow_mode='break'")

    database = _make_database(ClickHouseConnectEngineSpec, opt_out=True)
    assert database.sampling_read_limit_retry_sql(sql) is None


def test_database_sampling_read_limit_retry_sql_none_without_engine_support() -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    database = _make_database(BaseEngineSpec)
    assert database.sampling_read_limit_retry_sql("SELECT col FROM tbl") is None


def test_is_read_limit_error_base_spec_recognizes_nothing() -> None:
    from superset.db_engine_specs.base import BaseEngineSpec

    assert not BaseEngineSpec.is_read_limit_error(Exception("TOO_MANY_ROWS"))


READ_LIMIT_ERROR_MESSAGE = (
    "Code: 158. DB::Exception: Limit for rows (controlled by "
    "'max_rows_to_read' setting) exceeded. (TOO_MANY_ROWS)"
)


def test_is_read_limit_error_clickhouse_anchored_to_error_codes() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    assert ClickHouseConnectEngineSpec.is_read_limit_error(
        Exception(READ_LIMIT_ERROR_MESSAGE)
    )
    assert ClickHouseConnectEngineSpec.is_read_limit_error(Exception("(TOO_MANY_ROWS)"))
    # A message merely mentioning the setting name is not a read-limit
    # rejection.
    assert not ClickHouseConnectEngineSpec.is_read_limit_error(
        Exception("Cannot modify 'max_rows_to_read' setting in readonly mode")
    )


def test_run_with_sampling_read_limit_retry_success_never_alters_sql() -> None:
    """
    Deployments whose sampling queries succeed (including readonly=1
    ClickHouse users) never see altered SQL.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    database = _make_database(ClickHouseConnectEngineSpec)
    executed: list[str] = []

    def run(sql: str) -> str:
        executed.append(sql)
        return "ok"

    result = database.run_with_sampling_read_limit_retry(
        "SELECT col FROM tbl LIMIT 100", run
    )
    assert result == "ok"
    assert executed == ["SELECT col FROM tbl LIMIT 100"]


def test_run_with_sampling_read_limit_retry_retries_on_read_limit() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    database = _make_database(ClickHouseConnectEngineSpec)
    executed: list[str] = []

    def run(sql: str) -> str:
        executed.append(sql)
        if "SETTINGS" not in sql:
            raise Exception(READ_LIMIT_ERROR_MESSAGE)  # noqa: TRY002
        return "partial"

    result = database.run_with_sampling_read_limit_retry(
        "SELECT col FROM tbl LIMIT 100", run
    )
    assert result == "partial"
    assert len(executed) == 2
    assert executed[1].endswith("SETTINGS read_overflow_mode='break'")


def test_run_with_sampling_read_limit_retry_reraises_other_errors() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    database = _make_database(ClickHouseConnectEngineSpec)

    def run(sql: str) -> str:
        raise ValueError("connection refused")

    with pytest.raises(ValueError, match="connection refused"):
        database.run_with_sampling_read_limit_retry("SELECT 1", run)


def test_run_with_sampling_read_limit_retry_surfaces_original_error() -> None:
    """
    When the retry itself fails (e.g. a readonly connection rejecting the
    in-query SETTINGS change), the original read-limit error is raised, so
    such deployments see the same failure they saw before the retry existed.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    database = _make_database(ClickHouseConnectEngineSpec)

    def run(sql: str) -> str:
        if "SETTINGS" in sql:
            raise Exception(  # noqa: TRY002
                "Cannot modify 'read_overflow_mode' setting in readonly mode. Code: 164"
            )
        raise Exception(READ_LIMIT_ERROR_MESSAGE)  # noqa: TRY002

    with pytest.raises(Exception, match="TOO_MANY_ROWS"):
        database.run_with_sampling_read_limit_retry("SELECT 1", run)


def test_run_with_sampling_read_limit_retry_honors_opt_out() -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    database = _make_database(ClickHouseConnectEngineSpec, opt_out=True)
    executed: list[str] = []

    def run(sql: str) -> str:
        executed.append(sql)
        raise Exception(READ_LIMIT_ERROR_MESSAGE)  # noqa: TRY002

    with pytest.raises(Exception, match="TOO_MANY_ROWS"):
        database.run_with_sampling_read_limit_retry("SELECT 1", run)
    assert executed == ["SELECT 1"]


def test_handle_boolean_filter() -> None:
    """
    Test that ClickHouse uses equality operators for boolean filters instead of IS.

    ClickHouse rejects the ``column IS true/false`` form, so boolean filters must
    render as ``column = true/false``.
    """
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.clickhouse import ClickHouseBaseEngineSpec
    from superset.utils.core import FilterOperator

    bool_col = Column("test_col", Boolean)

    result_true = ClickHouseBaseEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_true.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = true"
    )

    result_false = ClickHouseBaseEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_FALSE, False
    )
    assert (
        str(result_false.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = false"
    )

    # Regression: the original bug also affects computed boolean columns like
    # `(is_cancelled = 1)`. Verify the equality operator also compiles
    # correctly when the "column" is a computed expression.
    from sqlalchemy import literal_column

    computed_col = literal_column("(is_cancelled = 1)")
    result_computed = ClickHouseBaseEngineSpec.handle_boolean_filter(
        computed_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_computed.compile(compile_kwargs={"literal_binds": True}))
        == "(is_cancelled = 1) = true"
    )


def test_use_equality_for_boolean_filters_property() -> None:
    """
    Test that ClickHouse has the use_equality_for_boolean_filters property set.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseBaseEngineSpec

    assert ClickHouseBaseEngineSpec.use_equality_for_boolean_filters is True


def _compile(expr) -> str:
    return str(expr.compile(compile_kwargs={"literal_binds": True}))


def test_clickhouse_supports_multivalue_columns() -> None:
    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    assert spec.supports_multivalue_columns is True


def test_multivalue_contains_any_sql() -> None:
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    expr = spec.array_contains_any(column("skills"), ["Driver", "Cook"])
    assert _compile(expr) == "hasAny(skills, array('Driver', 'Cook'))"


def test_multivalue_contains_all_sql() -> None:
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    expr = spec.array_contains_all(column("skills"), ["Driver", "Cook"])
    assert _compile(expr) == "hasAll(skills, array('Driver', 'Cook'))"


def test_multivalue_contains_binds_parameters() -> None:
    """Values must be bound parameters, not inlined (SQL-injection safety)."""
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    expr = spec.array_contains_any(column("skills"), ["Driver"])
    compiled = expr.compile()
    assert "Driver" not in str(compiled)
    assert "Driver" in compiled.params.values()


def test_multivalue_length_sql() -> None:
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    expr = spec.array_length(column("skills"))
    assert _compile(expr) == "length(skills)"


@pytest.mark.parametrize(
    "native_type,expected",
    [
        ("Array(String)", GenericDataType.STRING),
        ("Array(Int32)", GenericDataType.NUMERIC),
        ("Array(UInt64)", GenericDataType.NUMERIC),
        ("Array(Decimal(10, 2))", GenericDataType.NUMERIC),
        ("Array(DateTime)", GenericDataType.TEMPORAL),
        ("Array(Enum8('a' = 1))", GenericDataType.STRING),
        # Wrappers around the element type don't change the generic type.
        ("Array(Nullable(Int64))", GenericDataType.NUMERIC),
        ("Array(LowCardinality(String))", GenericDataType.STRING),
        # Non-array / nested-array types have no array element type.
        ("String", None),
        ("Map(String, Array(String))", None),
    ],
)
def test_multivalue_get_array_element_type(
    native_type: str, expected: GenericDataType | None
) -> None:
    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    assert spec.get_array_element_type(native_type) == expected


def test_multivalue_array_explode_sql() -> None:
    """array_explode compiles to ``arrayJoin(col)`` (element expansion)."""
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    expr = spec.array_explode(column("scores"))
    assert _compile(expr) == "arrayJoin(scores)"


def test_multivalue_contains_any_numeric_coercion_sql() -> None:
    """Numeric-array element values must render as numbers, not quoted strings."""
    from sqlalchemy import column

    from superset.db_engine_specs.clickhouse import (  # noqa: N813
        ClickHouseEngineSpec as spec,
    )

    # Simulate values already coerced to numbers (as helpers.py does via the
    # element type) and confirm the emitted array literal is numeric.
    expr = spec.array_contains_any(column("scores"), [5, 6])
    assert _compile(expr) == "hasAny(scores, array(5, 6))"


def test_connect_supports_file_upload() -> None:
    """
    File upload is disabled on the legacy clickhouse-sqlalchemy spec but
    re-enabled on the clickhouse-connect spec, whose driver can insert data.
    """
    from superset.db_engine_specs.clickhouse import (
        ClickHouseConnectEngineSpec,
        ClickHouseEngineSpec,
    )

    assert ClickHouseEngineSpec.supports_file_upload is False
    assert ClickHouseConnectEngineSpec.supports_file_upload is True
    assert (
        ClickHouseConnectEngineSpec.get_public_information()["supports_file_upload"]
        is True
    )


@pytest.fixture
def upload_mocks(mocker: MockerFixture) -> Any:
    """
    Wire up ``ClickHouseConnectEngineSpec.df_to_sql`` for unit testing without a
    live ClickHouse: a fake ``clickhouse_connect`` module supplies a recording
    ``MergeTree``, ``get_engine``/``inspect`` are stubbed, and the SQLAlchemy
    ``Table`` and ``DataFrame.to_sql`` calls are captured instead of executed.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    merge_trees: list[Any] = []

    class FakeMergeTree:
        def __init__(self, **kwargs: Any) -> None:
            self.kwargs = kwargs
            merge_trees.append(self)

    tableengine = pytypes.ModuleType(
        "clickhouse_connect.cc_sqlalchemy.ddl.tableengine"
    )
    tableengine.MergeTree = FakeMergeTree  # type: ignore[attr-defined]
    mocker.patch.dict(
        sys.modules,
        {
            "clickhouse_connect": pytypes.ModuleType("clickhouse_connect"),
            "clickhouse_connect.cc_sqlalchemy": pytypes.ModuleType(
                "clickhouse_connect.cc_sqlalchemy"
            ),
            "clickhouse_connect.cc_sqlalchemy.ddl": pytypes.ModuleType(
                "clickhouse_connect.cc_sqlalchemy.ddl"
            ),
            "clickhouse_connect.cc_sqlalchemy.ddl.tableengine": tableengine,
        },
    )

    engine = mocker.MagicMock()
    engine.dialect.supports_multivalues_insert = False
    engine_ctx = mocker.MagicMock()
    engine_ctx.__enter__.return_value = engine
    mocker.patch.object(
        ClickHouseConnectEngineSpec, "get_engine", return_value=engine_ctx
    )

    inspector = mocker.MagicMock()
    inspector.has_table.return_value = False
    mocker.patch("sqlalchemy.inspect", return_value=inspector)

    table_factory = mocker.patch("sqlalchemy.Table")
    to_sql = mocker.patch.object(pd.DataFrame, "to_sql")

    return pytypes.SimpleNamespace(
        spec=ClickHouseConnectEngineSpec,
        merge_trees=merge_trees,
        inspector=inspector,
        table_factory=table_factory,
        to_sql=to_sql,
    )


def test_connect_df_to_sql_default_engine(upload_mocks: Any) -> None:
    """
    With no ``extra`` config, the table is created with ``MergeTree`` and an
    ``ORDER BY tuple()`` (no sort key), then rows are appended.
    """
    database = Mock()
    database.get_extra.return_value = {}
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})

    upload_mocks.spec.df_to_sql(
        database, Table("t"), df, {"if_exists": "fail", "index": False}
    )

    # Table created with a MergeTree engine defaulting to tuple().
    assert len(upload_mocks.merge_trees) == 1
    assert str(upload_mocks.merge_trees[0].kwargs["order_by"]) == "tuple()"
    upload_mocks.table_factory.return_value.create.assert_called_once()

    # Rows are appended, not re-created, and the index is dropped.
    upload_mocks.to_sql.assert_called_once()
    kwargs = upload_mocks.to_sql.call_args.kwargs
    assert kwargs["name"] == "t"
    assert kwargs["if_exists"] == "append"
    assert kwargs["index"] is False


def test_connect_df_to_sql_configurable_engine(upload_mocks: Any) -> None:
    """
    ``order_by``/``partition_by`` are read from the database ``extra``, and
    columns named in ``order_by`` become non-nullable sort keys.
    """
    database = Mock()
    database.get_extra.return_value = {
        "clickhouse_file_upload": {
            "order_by": ["a"],
            "partition_by": "toYYYYMM(a)",
        }
    }
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})

    upload_mocks.spec.df_to_sql(database, Table("t"), df, {"if_exists": "append"})

    merge_tree = upload_mocks.merge_trees[0]
    assert merge_tree.kwargs["order_by"] == ["a"]
    assert merge_tree.kwargs["partition_by"] == "toYYYYMM(a)"

    # The sort-key column is non-nullable; the rest stay nullable.
    columns = {
        col.name: col for col in upload_mocks.table_factory.call_args.args[2:]
    }
    assert columns["a"].nullable is False
    assert columns["b"].nullable is True


def test_connect_df_to_sql_fail_when_exists(upload_mocks: Any) -> None:
    """
    ``if_exists='fail'`` on an existing table raises ``ValueError`` so the
    uploader surfaces its friendly "table already exists" message.
    """
    upload_mocks.inspector.has_table.return_value = True
    database = Mock()
    database.get_extra.return_value = {}
    df = pd.DataFrame({"a": [1]})

    with pytest.raises(ValueError, match="already exists"):
        upload_mocks.spec.df_to_sql(
            database, Table("t"), df, {"if_exists": "fail"}
        )
    upload_mocks.to_sql.assert_not_called()


def test_connect_df_to_sql_replace_drops_first(upload_mocks: Any) -> None:
    """
    ``if_exists='replace'`` drops the existing table before recreating it.
    """
    upload_mocks.inspector.has_table.return_value = True
    database = Mock()
    database.get_extra.return_value = {}
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(database, Table("t"), df, {"if_exists": "replace"})

    upload_mocks.table_factory.return_value.drop.assert_called_once()
    upload_mocks.table_factory.return_value.create.assert_called_once()
    upload_mocks.to_sql.assert_called_once()


def test_connect_df_to_sql_preserves_index_label(upload_mocks: Any) -> None:
    """
    When the index is uploaded, the requested ``index_label`` is used as the
    new column name instead of pandas' default ``index``.
    """
    database = Mock()
    database.get_extra.return_value = {}
    df = pd.DataFrame({"a": [1, 2]})

    upload_mocks.spec.df_to_sql(
        database,
        Table("t"),
        df,
        {"if_exists": "fail", "index": True, "index_label": "row_id"},
    )

    columns = {col.name for col in upload_mocks.table_factory.call_args.args[2:]}
    assert columns == {"row_id", "a"}
    assert upload_mocks.to_sql.call_args.kwargs["index"] is False


def test_connect_df_to_sql_infers_object_dates(upload_mocks: Any) -> None:
    """
    Object columns holding date values are typed as DateTime rather than being
    flattened to String, so date operations keep working after upload.
    """
    database = Mock()
    database.get_extra.return_value = {}
    df = pd.DataFrame(
        {"d": [date(2021, 1, 1), date(2021, 1, 2)], "s": ["x", "y"]}
    )

    upload_mocks.spec.df_to_sql(database, Table("t"), df, {"if_exists": "fail"})

    columns = {col.name: col for col in upload_mocks.table_factory.call_args.args[2:]}
    assert isinstance(columns["d"].type, DateTime)
    assert isinstance(columns["s"].type, String)
