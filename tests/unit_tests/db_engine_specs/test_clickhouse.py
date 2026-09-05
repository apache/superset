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
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import Mock

import numpy as np
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
        # The base spec's float pattern is anchored (`^float`), so wrapped float
        # types only resolve as NUMERIC thanks to the ClickHouse-specific
        # `.*Float.*` mapping. File upload creates `Nullable(Float64)` columns,
        # which would otherwise be typed as STRING in Superset.
        ("Nullable(Float32)", Float, None, GenericDataType.NUMERIC, False),
        ("Nullable(Float64)", Float, None, GenericDataType.NUMERIC, False),
        (
            "LowCardinality(Nullable(Float64))",
            Float,
            None,
            GenericDataType.NUMERIC,
            False,
        ),
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


def test_connect_does_not_advertise_multivalues_insert() -> None:
    """
    The clickhouse-connect dialect rejects multi-values inserts, so the spec
    must keep advertising ``supports_multivalues_insert = False``: flipping it
    on makes ``BaseEngineSpec.df_to_sql`` pass ``method="multi"`` to pandas,
    which raises before any row reaches ClickHouse.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    assert ClickHouseConnectEngineSpec.supports_multivalues_insert is False


def test_connect_get_columns_reflects_through_a_connection(
    mocker: MockerFixture,
) -> None:
    """
    Reflection is rebound to an explicit ``Connection``. clickhouse-connect's
    inspector runs its reflection queries with ``Engine.execute()``, which the
    2.0-style engine Superset builds does not implement, so reflecting an
    ``Engine``-bound inspector (the post-upload ``fetch_metadata`` step) would
    otherwise raise ``NotImplementedError``.
    """
    from sqlalchemy import create_engine, inspect as sqla_inspect
    from sqlalchemy.engine import Connection

    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    columns = [{"column_name": "a"}]
    base_get_columns = mocker.patch.object(
        BaseEngineSpec, "get_columns", return_value=columns
    )
    engine = create_engine("sqlite://")

    result = ClickHouseConnectEngineSpec.get_columns(
        sqla_inspect(engine), Table("t"), {"opt": 1}
    )

    assert result == columns
    inspector, table, options = base_get_columns.call_args.args
    assert isinstance(inspector.bind, Connection)
    # The table and the caller's options are forwarded untouched.
    assert table.table == "t"
    assert options == {"opt": 1}
    # The connection is opened for reflection only, and released afterwards.
    assert inspector.bind.closed is True


def test_connect_get_columns_accepts_a_connection_bound_inspector(
    mocker: MockerFixture,
) -> None:
    """
    An inspector already bound to a ``Connection`` reaches the engine through
    ``bind.engine``, and the caller's own connection is left open.
    """
    from sqlalchemy import create_engine, inspect as sqla_inspect
    from sqlalchemy.engine import Connection

    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    base_get_columns = mocker.patch.object(
        BaseEngineSpec, "get_columns", return_value=[]
    )
    engine = create_engine("sqlite://")

    with engine.connect() as connection:
        ClickHouseConnectEngineSpec.get_columns(sqla_inspect(connection), Table("t"))

        reflection_inspector = base_get_columns.call_args.args[0]
        assert isinstance(reflection_inspector.bind, Connection)
        assert reflection_inspector.bind is not connection
        assert connection.closed is False


@pytest.mark.parametrize(
    "series,expected",
    [
        (pd.Series([True, False]), "Nullable(Bool)"),
        (pd.Series([1, 2]), "Nullable(Int64)"),
        (pd.Series([-1, 2], dtype="int32"), "Nullable(Int64)"),
        # 9223372036854775808 overflows Int64 and is read back as uint64.
        (pd.Series([9223372036854775808], dtype="uint64"), "Nullable(UInt64)"),
        (pd.Series([1.5, 2.5]), "Nullable(Float64)"),
        # Integers with a missing value are float64 in pandas.
        (pd.Series([1, np.nan]), "Nullable(Float64)"),
        (
            pd.Series(pd.to_datetime(["2021-01-01", "2021-01-02"])),
            "Nullable(DateTime64(6))",
        ),
        (
            pd.Series(pd.to_datetime(["2021-01-01T00:00:00Z"])),
            "Nullable(DateTime64(6))",
        ),
        # Object columns that actually hold dates/datetimes.
        (pd.Series([date(2021, 1, 1), date(2021, 1, 2)]), "Nullable(DateTime64(6))"),
        (
            pd.Series([datetime(2021, 1, 1, 3, 4, 5), None]),
            "Nullable(DateTime64(6))",
        ),
        (pd.Series(["x", "y"]), "Nullable(String)"),
        (pd.Series([], dtype="object"), "Nullable(String)"),
        # Mixed object columns fall back to String rather than silently
        # rounding or overflowing.
        (pd.Series([1, "x"]), "Nullable(String)"),
    ],
)
def test_clickhouse_column_type(series: pd.Series, expected: str) -> None:
    """
    Pandas dtypes map to concrete ClickHouse types, every one of them wrapped in
    ``Nullable`` so missing values round-trip as NULL instead of a coerced
    default.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    assert ClickHouseConnectEngineSpec._clickhouse_column_type(series) == expected


# Sentinel for rows that were in a table before the upload started, so a test
# can tell "the original data survived" from "something new was written here".
PRE_EXISTING = object()


class FakeClickHouseClient:
    """A stand-in for the native ``clickhouse_connect`` client.

    Tracks which tables exist and what each one holds, so the replace path can
    be asserted on its outcome -- "does the user still have their data?" --
    rather than only on the order of the statements issued.
    """

    _CREATE = re.compile(r"^CREATE TABLE (?P<name>.+?) \(")
    _DROP = re.compile(r"^DROP TABLE (?:IF EXISTS )?(?P<name>.+)$")
    _EXISTS = re.compile(r"^EXISTS TABLE (?P<name>.+)$")
    _EXCHANGE = re.compile(r"^EXCHANGE TABLES (?P<left>.+) AND (?P<right>.+)$")
    _RENAME = re.compile(r"^RENAME TABLE (?P<source>.+) TO (?P<target>.+)$")

    def __init__(self, exists: bool = False) -> None:
        self.commands: list[str] = []
        self.inserts: list[tuple[str, pd.DataFrame, Optional[str]]] = []
        # Maps a qualified table name to the rows it holds. Tables that existed
        # before the upload are seeded with a sentinel so they can be told
        # apart from anything this upload created.
        self.tables: dict[str, Any] = {"`t`": PRE_EXISTING} if exists else {}
        # Failures to simulate.
        self.insert_error: Optional[Exception] = None
        self.exchange_error: Optional[Exception] = None

    @property
    def exists(self) -> bool:
        return "`t`" in self.tables

    @exists.setter
    def exists(self, value: bool) -> None:
        if value:
            self.tables["`t`"] = PRE_EXISTING
        else:
            self.tables.pop("`t`", None)

    def command(self, sql: str) -> Any:
        self.commands.append(sql)
        if match := self._EXISTS.match(sql):
            return 1 if match.group("name") in self.tables else 0
        if match := self._CREATE.match(sql):
            self.tables[match.group("name")] = None
        elif match := self._DROP.match(sql):
            self.tables.pop(match.group("name"), None)
        elif match := self._EXCHANGE.match(sql):
            if self.exchange_error:
                raise self.exchange_error
            left, right = match.group("left"), match.group("right")
            self.tables[left], self.tables[right] = (
                self.tables[right],
                self.tables[left],
            )
        elif match := self._RENAME.match(sql):
            self.tables[match.group("target")] = self.tables.pop(match.group("source"))
        return None

    def insert_df(
        self, table: str, df: pd.DataFrame, database: Optional[str] = None
    ) -> None:
        if self.insert_error:
            raise self.insert_error
        self.inserts.append((table, df, database))
        self.tables[table] = df

    # -- assertion helpers -------------------------------------------------
    @property
    def create_statement(self) -> str:
        return next(sql for sql in self.commands if sql.startswith("CREATE TABLE"))

    def commands_of(self, verb: str) -> list[str]:
        return [sql for sql in self.commands if sql.startswith(verb)]

    def staging_tables(self) -> list[str]:
        return [name for name in self.tables if "__superset_staging_" in name]


@pytest.fixture()
def upload_mocks(mocker: MockerFixture) -> Any:
    """
    Wire ``ClickHouseConnectEngineSpec.df_to_sql`` up for unit testing without a
    live ClickHouse: ``get_engine`` yields an engine whose raw connection
    exposes a recording fake native client.
    """
    from superset.db_engine_specs.clickhouse import ClickHouseConnectEngineSpec

    client = FakeClickHouseClient()

    raw_connection = mocker.MagicMock()
    raw_connection.driver_connection.client = client

    engine = mocker.MagicMock()
    engine.raw_connection.return_value = raw_connection

    engine_ctx = mocker.MagicMock()
    engine_ctx.__enter__.return_value = engine
    get_engine = mocker.patch.object(
        ClickHouseConnectEngineSpec, "get_engine", return_value=engine_ctx
    )

    return SimpleNamespace(
        spec=ClickHouseConnectEngineSpec,
        client=client,
        raw_connection=raw_connection,
        get_engine=get_engine,
    )


def test_connect_df_to_sql_creates_mergetree_and_bulk_loads(
    upload_mocks: Any,
) -> None:
    """
    A new table is created as ``MergeTree`` with explicit ClickHouse column
    types, then the rows go in through the driver's native bulk loader.
    """
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})

    upload_mocks.spec.df_to_sql(
        Mock(), Table("t"), df, {"if_exists": "fail", "index": False}
    )

    assert upload_mocks.client.create_statement == (
        "CREATE TABLE `t` (`a` Nullable(Int64), `b` Nullable(String)) "
        "ENGINE = MergeTree ORDER BY tuple()"
    )

    # Rows are loaded via insert_df, never pandas' to_sql.
    assert len(upload_mocks.client.inserts) == 1
    name, inserted, database = upload_mocks.client.inserts[0]
    assert name == "`t`"
    assert database is None
    pd.testing.assert_frame_equal(inserted, df)


def test_connect_df_to_sql_qualifies_and_quotes_schema(upload_mocks: Any) -> None:
    """
    The schema qualifies the DDL statements and is passed to ``insert_df`` as
    the target database.
    """
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(
        Mock(), Table("t", "my_schema"), df, {"if_exists": "fail"}
    )

    assert upload_mocks.client.commands[0] == "EXISTS TABLE `my_schema`.`t`"
    assert upload_mocks.client.create_statement.startswith(
        "CREATE TABLE `my_schema`.`t` ("
    )
    assert upload_mocks.client.inserts[0][0] == "`my_schema`.`t`"


@pytest.mark.parametrize(
    "table_name,schema,expected",
    [
        ("t", None, "`t`"),
        ("t", "my_schema", "`my_schema`.`t`"),
        # A dotted name is the case the bare name got wrong: the driver only
        # quotes a table name with no dot in it, and reads a dotted one as
        # ``database.table`` while ignoring its own ``database`` argument, so
        # these rows would have been written to table `2024` of database
        # `sales` -- silently, if such a table happened to exist.
        ("sales.2024", None, "`sales.2024`"),
        ("sales.2024", "my_schema", "`my_schema`.`sales.2024`"),
    ],
)
def test_connect_df_to_sql_inserts_into_the_qualified_name(
    upload_mocks: Any, table_name: str, schema: Optional[str], expected: str
) -> None:
    """
    ``insert_df`` targets the same quoted, schema-qualified identifier the DDL
    used, so the rows cannot land in a different table than the one created.
    """
    upload_mocks.spec.df_to_sql(
        Mock(),
        Table(table_name, schema),
        pd.DataFrame({"a": [1]}),
        {"if_exists": "fail"},
    )

    assert upload_mocks.client.create_statement.startswith(f"CREATE TABLE {expected} (")
    assert upload_mocks.client.inserts[0][0] == expected


def test_connect_df_to_sql_renders_string_columns_as_text(upload_mocks: Any) -> None:
    """
    A column declared ``Nullable(String)`` is handed to the driver holding only
    strings and NULLs. A mixed column -- a numeric ID with one ``N/A`` cell, say
    -- is the common case: the driver's String writer calls ``encode()`` on
    every value, so a stray int would fail the insert after the CREATE.
    """
    df = pd.DataFrame({"zip": [12345, 90210, "N/A", None], "n": [1, 2, 3, 4]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "fail"})

    assert upload_mocks.client.create_statement == (
        "CREATE TABLE `t` (`zip` Nullable(String), `n` Nullable(Int64)) "
        "ENGINE = MergeTree ORDER BY tuple()"
    )
    inserted = upload_mocks.client.inserts[0][1]
    assert inserted["zip"].tolist()[:3] == ["12345", "90210", "N/A"]
    assert inserted["zip"].isna().tolist() == [False, False, False, True]
    # Columns with an exact type are untouched.
    assert inserted["n"].tolist() == [1, 2, 3, 4]


def test_connect_df_to_sql_normalizes_date_objects(upload_mocks: Any) -> None:
    """
    An object column holding ``datetime.date`` is declared ``DateTime64(6)``,
    so it has to reach the driver as real timestamps: the driver's DateTime64
    writer calls ``timestamp()``, which ``date`` does not have (only
    ``datetime`` does).
    """
    df = pd.DataFrame({"d": [date(1965, 3, 4), datetime(2021, 1, 2, 3, 4, 5), None]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "fail"})

    assert upload_mocks.client.create_statement == (
        "CREATE TABLE `t` (`d` Nullable(DateTime64(6))) "
        "ENGINE = MergeTree ORDER BY tuple()"
    )
    inserted = upload_mocks.client.inserts[0][1]["d"]
    assert pd.api.types.is_datetime64_any_dtype(inserted.dtype)
    assert inserted.tolist() == [
        pd.Timestamp("1965-03-04"),
        pd.Timestamp("2021-01-02 03:04:05"),
        pd.NaT,
    ]


def test_connect_df_to_sql_prepares_the_frame_before_dropping(
    upload_mocks: Any,
) -> None:
    """
    Replacing a table is not recoverable -- ClickHouse has no transactional
    DDL -- so anything that can fail on the data has to fail first. A frame
    that cannot be coerced to its declared types must leave the existing table
    standing.
    """
    upload_mocks.client.exists = True
    # datetime64[ns] tops out in 2262, so this date cannot be normalized.
    df = pd.DataFrame({"d": [date(9999, 12, 31)]})

    with pytest.raises(pd.errors.OutOfBoundsDatetime):
        upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "replace"})

    assert upload_mocks.client.commands_of("DROP TABLE") == []
    assert upload_mocks.client.commands_of("CREATE TABLE") == []
    assert upload_mocks.client.inserts == []


def test_connect_df_to_sql_does_not_mutate_the_callers_frame(
    upload_mocks: Any,
) -> None:
    """Coercing to text must not rewrite the DataFrame the uploader still holds."""
    df = pd.DataFrame({"zip": [12345, "N/A"]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "fail"})

    assert df["zip"].tolist() == [12345, "N/A"]


def test_connect_df_to_sql_appends_without_coercing(upload_mocks: Any) -> None:
    """
    Appending to an existing table declares nothing, so the frame is passed
    through as-is: the server's schema governs the types, not our inference.
    """
    upload_mocks.client.exists = True
    df = pd.DataFrame({"zip": [12345, "N/A"]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "append"})

    assert upload_mocks.client.commands_of("CREATE TABLE") == []
    pd.testing.assert_frame_equal(upload_mocks.client.inserts[0][1], df)


def test_connect_df_to_sql_escapes_identifiers(upload_mocks: Any) -> None:
    """
    Backticks in table and column names are doubled, so an identifier cannot
    terminate its own quoting and inject SQL into the DDL.
    """
    df = pd.DataFrame({"a`b": [1]})

    upload_mocks.spec.df_to_sql(
        Mock(), Table("t`) ENGINE = Log --"), df, {"if_exists": "fail"}
    )

    create = upload_mocks.client.create_statement
    assert create == (
        "CREATE TABLE `t``) ENGINE = Log --` (`a``b` Nullable(Int64)) "
        "ENGINE = MergeTree ORDER BY tuple()"
    )


def test_connect_df_to_sql_fail_when_exists(upload_mocks: Any) -> None:
    """
    ``if_exists='fail'`` on an existing table raises ``ValueError`` so the
    uploader surfaces its friendly "table already exists" message, and nothing
    is created or inserted.
    """
    upload_mocks.client.exists = True
    df = pd.DataFrame({"a": [1]})

    with pytest.raises(ValueError, match="already exists"):
        upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "fail"})

    assert upload_mocks.client.commands_of("CREATE TABLE") == []
    assert upload_mocks.client.commands_of("DROP TABLE") == []
    assert upload_mocks.client.inserts == []


def test_connect_df_to_sql_defaults_to_fail(upload_mocks: Any) -> None:
    """``if_exists`` defaults to ``fail`` when the uploader doesn't pass it."""
    upload_mocks.client.exists = True

    with pytest.raises(ValueError, match="already exists"):
        upload_mocks.spec.df_to_sql(Mock(), Table("t"), pd.DataFrame({"a": [1]}), {})


def test_connect_df_to_sql_replace_swaps_a_loaded_staging_table_in(
    upload_mocks: Any,
) -> None:
    """
    ``if_exists='replace'`` loads a staging table and swaps it in atomically,
    rather than dropping the target and hoping the load succeeds: ClickHouse
    has no transactional DDL, so a drop-first replace cannot be undone.
    """
    upload_mocks.client.exists = True
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "replace"})

    staged = upload_mocks.client.inserts[0][0]
    assert "__superset_staging_" in staged
    # Nothing touches the target until the rows are loaded, and the swap is the
    # atomic EXCHANGE rather than a drop.
    assert upload_mocks.client.create_statement.startswith(f"CREATE TABLE {staged} (")
    assert upload_mocks.client.commands_of("EXCHANGE TABLES") == [
        f"EXCHANGE TABLES `t` AND {staged}"
    ]
    assert upload_mocks.client.commands_of("DROP TABLE") == [
        f"DROP TABLE IF EXISTS {staged}"
    ]
    # The target holds the new rows and the staging table is cleaned up.
    pd.testing.assert_frame_equal(upload_mocks.client.tables["`t`"], df)
    assert upload_mocks.client.staging_tables() == []


def test_connect_df_to_sql_replace_keeps_the_old_table_when_loading_fails(
    upload_mocks: Any,
) -> None:
    """
    The point of staging: if the load fails, the table the user already had is
    still there with its original data, and no staging table is left behind.
    """
    upload_mocks.client.exists = True
    upload_mocks.client.insert_error = RuntimeError("connection reset")

    with pytest.raises(RuntimeError, match="connection reset"):
        upload_mocks.spec.df_to_sql(
            Mock(), Table("t"), pd.DataFrame({"a": [1]}), {"if_exists": "replace"}
        )

    assert upload_mocks.client.tables["`t`"] is PRE_EXISTING
    assert upload_mocks.client.staging_tables() == []


def test_connect_df_to_sql_replace_keeps_the_old_table_when_the_swap_fails(
    upload_mocks: Any,
) -> None:
    """A failing EXCHANGE is not swallowed, and still leaves the original intact."""
    upload_mocks.client.exists = True
    upload_mocks.client.exchange_error = RuntimeError("TOO_MANY_SIMULTANEOUS_QUERIES")

    with pytest.raises(RuntimeError, match="TOO_MANY_SIMULTANEOUS_QUERIES"):
        upload_mocks.spec.df_to_sql(
            Mock(), Table("t"), pd.DataFrame({"a": [1]}), {"if_exists": "replace"}
        )

    assert upload_mocks.client.tables["`t`"] is PRE_EXISTING
    assert upload_mocks.client.staging_tables() == []


def test_connect_df_to_sql_replace_falls_back_when_exchange_is_unsupported(
    upload_mocks: Any,
) -> None:
    """
    ``EXCHANGE TABLES`` needs the Atomic database engine (the default since
    ClickHouse 20.10). On a legacy Ordinary database it reports NOT_IMPLEMENTED,
    and the replace falls back to drop-and-rename -- still with the rows already
    loaded, so only the swap itself is exposed.
    """
    upload_mocks.client.exists = True
    upload_mocks.client.exchange_error = RuntimeError("Code: 48. NOT_IMPLEMENTED")
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "replace"})

    staged = upload_mocks.client.inserts[0][0]
    assert upload_mocks.client.commands_of("RENAME TABLE") == [
        f"RENAME TABLE {staged} TO `t`"
    ]
    pd.testing.assert_frame_equal(upload_mocks.client.tables["`t`"], df)
    assert upload_mocks.client.staging_tables() == []


def test_connect_df_to_sql_replace_keeps_the_loaded_rows_if_the_rename_fails(
    upload_mocks: Any,
) -> None:
    """
    On the legacy fallback the target is dropped before the rename, so from
    that point the staging table holds the only copy of the data. A failing
    rename must not take it down with the error.
    """
    client = upload_mocks.client
    client.exists = True
    client.exchange_error = RuntimeError("Code: 48. NOT_IMPLEMENTED")
    real_command = client.command

    def fail_on_rename(sql: str) -> Any:
        if sql.startswith("RENAME TABLE"):
            client.commands.append(sql)
            raise RuntimeError("server went away")
        return real_command(sql)

    client.command = fail_on_rename

    with pytest.raises(RuntimeError, match="server went away"):
        upload_mocks.spec.df_to_sql(
            Mock(), Table("t"), pd.DataFrame({"a": [1]}), {"if_exists": "replace"}
        )

    assert client.staging_tables() != []


def test_connect_df_to_sql_replace_creates_outright_when_absent(
    upload_mocks: Any,
) -> None:
    """
    ``replace`` against a table that doesn't exist has nothing to protect, so it
    creates the target directly instead of staging and swapping.
    """
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "replace"})

    assert upload_mocks.client.commands_of("EXCHANGE TABLES") == []
    assert upload_mocks.client.create_statement.startswith("CREATE TABLE `t` (")
    assert upload_mocks.client.inserts[0][0] == "`t`"


def test_connect_df_to_sql_append_reuses_existing_table(upload_mocks: Any) -> None:
    """
    ``if_exists='append'`` on an existing table inserts into it as-is: no DROP,
    and no CREATE that would clobber a user-defined sort key or partitioning.
    """
    upload_mocks.client.exists = True
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "append"})

    assert upload_mocks.client.commands == ["EXISTS TABLE `t`"]
    assert len(upload_mocks.client.inserts) == 1


def test_connect_df_to_sql_append_creates_missing_table(upload_mocks: Any) -> None:
    """``if_exists='append'`` still creates the table when it doesn't exist."""
    df = pd.DataFrame({"a": [1]})

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "append"})

    assert len(upload_mocks.client.commands_of("CREATE TABLE")) == 1
    assert len(upload_mocks.client.inserts) == 1


def test_connect_df_to_sql_folds_index_into_columns(upload_mocks: Any) -> None:
    """
    When the index is uploaded it becomes a real column, under the requested
    ``index_label``, in both the DDL and the inserted frame -- otherwise the
    created table and the loaded rows would disagree on shape.
    """
    df = pd.DataFrame({"a": [1, 2]}, index=pd.Index([10, 20]))

    upload_mocks.spec.df_to_sql(
        Mock(),
        Table("t"),
        df,
        {"if_exists": "fail", "index": True, "index_label": "row_id"},
    )

    assert upload_mocks.client.create_statement == (
        "CREATE TABLE `t` (`row_id` Nullable(Int64), `a` Nullable(Int64)) "
        "ENGINE = MergeTree ORDER BY tuple()"
    )
    inserted = upload_mocks.client.inserts[0][1]
    assert list(inserted.columns) == ["row_id", "a"]
    assert inserted["row_id"].tolist() == [10, 20]


def test_connect_df_to_sql_ignores_index_when_not_requested(
    upload_mocks: Any,
) -> None:
    """Without ``index=True`` the index is not written as a column."""
    df = pd.DataFrame({"a": [1, 2]}, index=pd.Index([10, 20]))

    upload_mocks.spec.df_to_sql(Mock(), Table("t"), df, {"if_exists": "fail"})

    assert "row_id" not in upload_mocks.client.create_statement
    assert list(upload_mocks.client.inserts[0][1].columns) == ["a"]


def test_connect_df_to_sql_closes_raw_connection(upload_mocks: Any) -> None:
    """The raw connection is returned to the pool on success..."""
    upload_mocks.spec.df_to_sql(
        Mock(), Table("t"), pd.DataFrame({"a": [1]}), {"if_exists": "fail"}
    )

    upload_mocks.raw_connection.close.assert_called_once()


def test_connect_df_to_sql_closes_raw_connection_on_error(upload_mocks: Any) -> None:
    """...and also when the upload fails, so a rejected upload can't leak it."""
    upload_mocks.client.exists = True

    with pytest.raises(ValueError, match="already exists"):
        upload_mocks.spec.df_to_sql(
            Mock(), Table("t"), pd.DataFrame({"a": [1]}), {"if_exists": "fail"}
        )

    upload_mocks.raw_connection.close.assert_called_once()


def test_connect_df_to_sql_passes_catalog_and_schema_to_engine(
    upload_mocks: Any,
) -> None:
    """The engine is opened against the target table's catalog and schema."""
    database = Mock()

    upload_mocks.spec.df_to_sql(
        database,
        Table("t", "my_schema", "my_catalog"),
        pd.DataFrame({"a": [1]}),
        {"if_exists": "fail"},
    )

    upload_mocks.get_engine.assert_called_once_with(
        database, catalog="my_catalog", schema="my_schema"
    )
