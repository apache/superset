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
"""Unit tests for ``superset.connectors.sqla.partition_mapping``."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast
from importlib import import_module
from unittest.mock import MagicMock, patch, PropertyMock

import pandas as pd
import pytest
from dateutil.relativedelta import relativedelta
from flask import Flask
from sqlalchemy.dialects import mysql, postgresql

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.partition_mapping import (
    _probe_cache_key,
    _render_literal,
    build_probe_sql,
    contains_jinja,
    contains_value_placeholder,
    equality_mirrors_safely,
    evaluate_transform,
    find_non_deterministic_functions,
    grain_bucket_width,
    GRAIN_BUCKET_WIDTHS,
    is_bare_expression,
    is_parseable,
    is_transform_active,
    is_unfinished,
    MappingValidationIssue,
    MIRRORABLE_ALWAYS,
    MIRRORABLE_IF_MONOTONIC,
    mirrorable_operators,
    parse_error_detail,
    resolve_partition_mapping,
    stored_expression_error,
    validate_partition_mapping,
    validate_transform,
)
from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.oracle import OracleEngineSpec
from superset.models.core import Database
from superset.utils.core import FilterOperator


@pytest.fixture(autouse=True)
def real_probe_cache(app: Flask) -> Any:
    """
    The test app runs a null cache, which would make every cache assertion here
    vacuously pass. Swap in a real in-memory one for the duration.
    """
    from flask_caching import Cache

    from superset.extensions import cache_manager

    cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
    cache.init_app(app)
    original = cache_manager._cache  # noqa: SLF001
    cache_manager._cache = cache  # noqa: SLF001
    yield
    cache_manager._cache = original  # noqa: SLF001


@pytest.fixture(autouse=True)
def enable_partition_filter_mapping(app: Flask) -> Any:
    """The feature ships off; every test here exercises it on."""
    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    yield
    if original is None:
        del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]
    else:
        app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original


def _table(**kwargs: Any) -> SqlaTable:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    defaults: dict[str, Any] = {
        "table_name": "web_events",
        "database": database,
        "main_dttm_col": "event_time",
        "columns": [
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(
                column_name="dt_epoch",
                type="BIGINT",
                partition_value_transform=None,
            ),
            TableColumn(column_name="country", type="VARCHAR"),
            TableColumn(column_name="region_key", type="VARCHAR"),
        ],
    }
    defaults.update(kwargs)
    return SqlaTable(**defaults)


def _mapped_table(
    *,
    partition_column: str = "dt_epoch",
    mapped_column: str = "event_time",
    transform: str | None = "unix_timestamp(:value)",
    monotonic: bool = True,
    partition_mapped_column: str | None = None,
    main_dttm_col: str | None = "event_time",
) -> SqlaTable:
    table = _table(main_dttm_col=main_dttm_col)
    table.partition_column = partition_column
    table.partition_mapped_column = partition_mapped_column
    for column in table.columns:
        if column.column_name == mapped_column:
            column.partition_value_transform = transform
            column.partition_transform_is_monotonic = monotonic
    return table


# ---------------------------------------------------------------------------
# §2 — operator safety matrix
# ---------------------------------------------------------------------------


def test_equality_and_in_are_always_mirrorable() -> None:
    """``=`` and ``IN`` are safe for any function ``T``."""
    assert MIRRORABLE_ALWAYS == {FilterOperator.EQUALS, FilterOperator.IN}


def test_range_operators_require_a_monotonic_transform() -> None:
    assert MIRRORABLE_IF_MONOTONIC == {
        FilterOperator.GREATER_THAN,
        FilterOperator.GREATER_THAN_OR_EQUALS,
        FilterOperator.LESS_THAN,
        FilterOperator.LESS_THAN_OR_EQUALS,
        FilterOperator.TEMPORAL_RANGE,
    }


def test_mirrorable_operators_excludes_ranges_when_not_monotonic() -> None:
    assert mirrorable_operators(is_monotonic=False) == MIRRORABLE_ALWAYS


def test_mirrorable_operators_includes_ranges_when_monotonic() -> None:
    assert mirrorable_operators(is_monotonic=True) == (
        MIRRORABLE_ALWAYS | MIRRORABLE_IF_MONOTONIC
    )


@pytest.mark.parametrize(
    "operator",
    [
        FilterOperator.NOT_EQUALS,
        FilterOperator.NOT_IN,
        FilterOperator.LIKE,
        FilterOperator.ILIKE,
        FilterOperator.NOT_LIKE,
        FilterOperator.NOT_ILIKE,
        FilterOperator.IS_NULL,
        FilterOperator.IS_NOT_NULL,
        FilterOperator.IS_TRUE,
        FilterOperator.IS_FALSE,
    ],
)
def test_negations_and_pattern_matches_are_never_mirrorable(
    operator: FilterOperator,
) -> None:
    """
    ``T`` is not injective, so ``col != v`` does **not** imply ``T(col) != T(v)``:
    mirroring it would drop rows the original filter keeps.
    """
    assert operator not in mirrorable_operators(is_monotonic=True)


def test_equality_is_dropped_when_the_engine_does_not_compare_byte_exactly() -> None:
    """
    "Safe for any function ``T``" reasons about value equality: ``T`` is a
    function, so ``col = v`` gives ``T(col) = T(v)``. The engine reasons about
    *SQL* equality, and the two part company under a case-insensitive
    collation -- a stored ``'us'`` satisfies a filter for ``'US'`` while the
    mirror ``hex('US')`` excludes the row, and the chart loses it silently.
    """
    assert mirrorable_operators(is_monotonic=False, equality_is_safe=False) == set()


def test_ranges_survive_an_unsafe_equality() -> None:
    """
    Range mirroring already rests on the owner declaring ``T``
    order-preserving with respect to the column's own order -- an assertion
    about the very comparison semantics this gate checks for. Equality has no
    such declaration behind it, which is why only equality is withdrawn.
    """
    assert (
        mirrorable_operators(is_monotonic=True, equality_is_safe=False)
        == MIRRORABLE_IF_MONOTONIC
    )


def _column(type_: str) -> TableColumn:
    database = Database(database_name="t", sqlalchemy_uri="sqlite://")
    table = SqlaTable(table_name="t", database=database)
    return TableColumn(column_name="c", type=type_, table=table)


@pytest.mark.parametrize(
    "type_, binary, expected",
    [
        ("VARCHAR", True, True),
        ("VARCHAR", False, False),
        # Numeric and temporal comparison is exact everywhere.
        ("BIGINT", False, True),
        ("TIMESTAMP", False, True),
        ("DOUBLE", False, True),
    ],
)
def test_equality_mirrors_safely_only_guards_string_columns(
    app: Flask, type_: str, binary: bool, expected: bool
) -> None:
    class _Spec(BaseEngineSpec):
        binary_string_comparison = binary

    with app.app_context():
        assert equality_mirrors_safely(_column(type_), _Spec) is expected


def test_equality_mirrors_safely_fails_closed_on_an_unresolvable_type(
    app: Flask,
) -> None:
    """
    The gate exists to stop a silent wrong answer, so a column whose type it
    cannot read is treated as the risky case rather than waved through.
    """
    column = MagicMock()
    type(column).type_generic = PropertyMock(side_effect=ValueError("no type"))

    with app.app_context():
        assert equality_mirrors_safely(column, BaseEngineSpec) is False


def test_no_mapped_column_leaves_the_matrix_alone(app: Flask) -> None:
    """Nothing to reason about, and the resolver bails out on it anyway."""
    with app.app_context():
        assert equality_mirrors_safely(None, BaseEngineSpec) is True


@pytest.mark.parametrize(
    "module, spec_name",
    [
        ("presto", "PrestoEngineSpec"),
        ("hive", "HiveEngineSpec"),
        ("trino", "TrinoEngineSpec"),
        ("impala", "ImpalaEngineSpec"),
        ("postgres", "PostgresEngineSpec"),
        ("bigquery", "BigQueryEngineSpec"),
        ("sqlite", "SqliteEngineSpec"),
    ],
)
def test_the_byte_exact_engines_opt_in(module: str, spec_name: str) -> None:
    """
    The engines this feature targets compare text byte-exactly, so the gate
    must not cost them the second canonical mapping (`lower(:value)` onto a
    lowercased key).
    """
    spec = getattr(import_module(f"superset.db_engine_specs.{module}"), spec_name)
    assert spec.binary_string_comparison is True


@pytest.mark.parametrize("module, spec_name", [("mysql", "MySQLEngineSpec")])
def test_a_case_insensitive_engine_does_not_opt_in(
    module: str, spec_name: str
) -> None:
    """
    MySQL's default collation is `utf8mb4_0900_ai_ci`, which is exactly the
    case the reviewer raised.
    """
    spec = getattr(import_module(f"superset.db_engine_specs.{module}"), spec_name)
    assert spec.binary_string_comparison is False


def test_the_base_spec_does_not_opt_in() -> None:
    """A spec that has not said so does not mirror string equality."""
    assert BaseEngineSpec.binary_string_comparison is False


# ---------------------------------------------------------------------------
# Time grain bucket widths
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("grain", list(TimeGrain))
def test_every_builtin_grain_has_a_known_bucket_width(
    app: Flask, grain: TimeGrain
) -> None:
    """
    The widening is only sound for a grain whose bucket width we know, so a
    grain added upstream without a width here would silently stop mirroring.
    This is the test that notices.
    """
    with app.app_context():
        assert grain_bucket_width(grain.value, "sqlite") is not None


def test_a_calendar_grain_widens_by_a_calendar_month(app: Flask) -> None:
    """A month is not thirty days, and the month it lands in decides its width."""
    with app.app_context():
        width = grain_bucket_width(TimeGrain.MONTH.value, "sqlite")

    assert width is not None
    assert datetime(2026, 1, 31) + width == datetime(2026, 2, 28)
    assert datetime(2026, 2, 1) + width == datetime(2026, 3, 1)


def test_a_fractional_grain_has_a_width(app: Flask) -> None:
    """
    ``PT0.5H`` and ``P0.25Y`` are why the widths are written out rather than
    parsed -- and the anchored week grains are intervals ``parse_duration``
    rejects outright.
    """
    with app.app_context():
        assert grain_bucket_width(TimeGrain.HALF_HOUR.value, "sqlite") == relativedelta(
            minutes=30
        )
        assert grain_bucket_width(
            TimeGrain.WEEK_ENDING_SATURDAY.value, "sqlite"
        ) == relativedelta(days=7)


def test_an_unknown_grain_has_no_known_width(app: Flask) -> None:
    with app.app_context():
        assert grain_bucket_width("P13X", "sqlite") is None
        assert grain_bucket_width(None, "sqlite") is None


def test_an_addon_grain_has_no_known_width(app: Flask) -> None:
    """An operator-declared grain carries whatever duration string they typed."""
    with app.app_context():
        app.config["TIME_GRAIN_ADDONS"] = {"PT2S": "2 second"}
        try:
            assert grain_bucket_width("PT2S", "sqlite") is None
        finally:
            app.config["TIME_GRAIN_ADDONS"] = {}


def test_a_builtin_grain_an_operator_redefined_has_no_known_width(
    app: Flask,
) -> None:
    """
    ``TIME_GRAIN_ADDON_EXPRESSIONS`` replaces a built-in grain's SQL for one
    engine, so its duration no longer bounds the displacement *there* -- but it
    still does on every other engine.
    """
    with app.app_context():
        app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {
            "sqlite": {"P1D": "DATETIME({col}, 'start of year')"}
        }
        try:
            assert grain_bucket_width(TimeGrain.DAY.value, "sqlite") is None
            assert grain_bucket_width(TimeGrain.DAY.value, "hive") is not None
        finally:
            app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {}


def test_the_width_table_is_keyed_on_grain_durations(app: Flask) -> None:
    """Keys are the ISO duration a filter carries, not the enum member name."""
    assert GRAIN_BUCKET_WIDTHS[TimeGrain.DAY] == relativedelta(days=1)
    assert set(GRAIN_BUCKET_WIDTHS) == {grain.value for grain in TimeGrain}


# ---------------------------------------------------------------------------
# §4.1 — resolving the effective mapping, and the defensive bail-outs
# ---------------------------------------------------------------------------


def test_resolve_returns_the_mapping_when_everything_lines_up(app: Flask) -> None:
    with app.app_context():
        mapping = resolve_partition_mapping(_mapped_table())

    assert mapping is not None
    assert mapping.partition_column == "dt_epoch"
    assert mapping.mapped_column == "event_time"
    assert mapping.value_transform == "unix_timestamp(:value)"
    assert mapping.is_monotonic is True


def test_effective_mapped_column_follows_main_dttm_col(app: Flask) -> None:
    """No explicit override: the mapping follows the default datetime column."""
    with app.app_context():
        mapping = resolve_partition_mapping(_mapped_table())

    assert mapping is not None
    assert mapping.mapped_column == "event_time"


def test_explicit_override_wins_over_main_dttm_col(app: Flask) -> None:
    table = _mapped_table(
        mapped_column="country",
        transform="lower(:value)",
        monotonic=False,
        partition_mapped_column="country",
    )
    table.partition_column = "region_key"

    with app.app_context():
        mapping = resolve_partition_mapping(table)

    assert mapping is not None
    assert mapping.mapped_column == "country"
    assert mapping.partition_column == "region_key"
    assert mapping.is_monotonic is False


def test_resolve_returns_none_when_the_feature_flag_is_off(app: Flask) -> None:
    table = _mapped_table()
    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.feature_flag_manager."
            "is_feature_enabled",
            return_value=False,
        ):
            assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_without_a_partition_column(app: Flask) -> None:
    table = _mapped_table()
    table.partition_column = None
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_when_partition_column_no_longer_exists(
    app: Flask,
) -> None:
    """A column sync can drop the physical partition column out from under us."""
    table = _mapped_table()
    table.partition_column = "dt_epoch_gone"
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_when_the_mapped_column_no_longer_exists(
    app: Flask,
) -> None:
    table = _mapped_table(main_dttm_col="vanished")
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_on_self_mapping(app: Flask) -> None:
    """
    ``partition_column == effective mapped column`` mirrors a column onto itself.
    Save-time validation rejects it, but rows predating that validation exist.
    """
    table = _mapped_table(
        partition_column="event_time",
        mapped_column="event_time",
    )
    with app.app_context():
        assert resolve_partition_mapping(table) is None


@pytest.mark.parametrize("transform", [None, "", "   "])
def test_resolve_returns_none_without_a_transform(
    app: Flask, transform: str | None
) -> None:
    table = _mapped_table(transform=transform)
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_when_the_transform_lacks_the_placeholder(
    app: Flask,
) -> None:
    table = _mapped_table(transform="unix_timestamp(event_time)")
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_for_a_non_deterministic_transform(app: Flask) -> None:
    """
    The query-time gate is `is_transform_active`, the same one the Explore
    indicator reads. Anything narrower would let a transform that reached
    storage without passing `UpdateDatasetCommand` -- through import, or a
    hand-written bundle -- mirror a filter with a value frozen at probe time,
    while the editor reported the mapping as inactive and nothing on screen
    said otherwise.
    """
    table = _mapped_table(transform="unix_timestamp(:value) + rand()")
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_for_a_multi_expression_transform(app: Flask) -> None:
    """A select list is not an expression; the probe cannot align its columns."""
    table = _mapped_table(transform="lower(:value), 'x'")
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_for_an_unparseable_transform(app: Flask) -> None:
    table = _mapped_table(transform="unix_timestamp(:value")
    with app.app_context():
        assert resolve_partition_mapping(table) is None


def test_resolve_returns_none_when_the_mapped_column_has_an_advanced_data_type(
    app: Flask,
) -> None:
    """
    ``translate_filter`` builds its own predicate shape from *translated* values,
    so the ``(operator, value)`` pair the operator matrix reasons about does not
    exist. Mirroring anyway would silently apply the wrong values (§4.1).
    """
    table = _mapped_table()
    for column in table.columns:
        if column.column_name == "event_time":
            column.advanced_data_type = "port"

    with app.app_context():
        with patch.dict(app.config["ADVANCED_DATA_TYPES"], {"port": MagicMock()}):
            with patch(
                "superset.connectors.sqla.partition_mapping.feature_flag_manager."
                "is_feature_enabled",
                side_effect=lambda flag: flag
                in {"PARTITION_FILTER_MAPPING", "ENABLE_ADVANCED_DATA_TYPES"},
            ):
                assert resolve_partition_mapping(table) is None


def test_advanced_data_type_does_not_block_when_the_flag_is_off(app: Flask) -> None:
    """An inert ``advanced_data_type`` is not a reason to skip mirroring."""
    table = _mapped_table()
    for column in table.columns:
        if column.column_name == "event_time":
            column.advanced_data_type = "port"

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.feature_flag_manager."
            "is_feature_enabled",
            side_effect=lambda flag: flag == "PARTITION_FILTER_MAPPING",
        ):
            assert resolve_partition_mapping(table) is not None


# ---------------------------------------------------------------------------
# §5 — transform inspection helpers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "transform,expected",
    [
        ("unix_timestamp(:value)", True),
        ("lower(:value)", True),
        ("CAST(:value AS BIGINT)", True),
        ("unix_timestamp(event_time)", False),
        (":values", False),
        ("", False),
        (None, False),
    ],
)
def test_contains_value_placeholder(transform: str | None, expected: bool) -> None:
    assert contains_value_placeholder(transform) is expected


@pytest.mark.parametrize(
    "transform,expected",
    [
        ("unix_timestamp(:value)", False),
        ("{{ current_username() }}", True),
        ("lower({% if x %}:value{% endif %})", True),
        ("lower(:value) -- {# comment #}", True),
    ],
)
def test_contains_jinja(transform: str, expected: bool) -> None:
    assert contains_jinja(transform) is expected


@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value)",
        "lower(:value)",
        "CAST(:value AS BIGINT)",
        "date_format(:value, 'yyyyMMdd')",
    ],
)
def test_pure_transforms_report_no_non_deterministic_functions(
    transform: str,
) -> None:
    assert find_non_deterministic_functions(transform, "hive") == set()


@pytest.mark.parametrize(
    "transform,expected_name",
    [
        ("date_diff(:value, now())", "NOW"),
        ("CAST(:value AS BIGINT) + rand()", "RAND"),
        ("CAST(:value AS DATE) - current_date", "CURRENT_DATE"),
    ],
)
def test_non_deterministic_functions_are_reported(
    transform: str, expected_name: str
) -> None:
    """
    The probe runs at a different moment and in a different session from the
    chart query, and its result is cached, so anything time- or
    randomness-dependent freezes a snapshot of probe time into the predicate.
    """
    assert expected_name in find_non_deterministic_functions(transform, "hive")


def test_niladic_unix_timestamp_is_rejected_but_the_unary_form_is_not() -> None:
    """
    On Hive/Impala ``unix_timestamp()`` means "now" while ``unix_timestamp(x)``
    -- the canonical temporal transform -- is pure. The distinction is the whole
    reason this check inspects arity rather than just the name.
    """
    assert find_non_deterministic_functions("unix_timestamp(:value)", "hive") == set()
    assert find_non_deterministic_functions(
        "unix_timestamp(:value) - unix_timestamp()", "hive"
    )


# ---------------------------------------------------------------------------
# §4.2 — probe evaluation
# ---------------------------------------------------------------------------


def _database_returning(values: list[Any]) -> Database:
    """A real ``Database`` (so the dialect is real) with only ``get_df`` stubbed."""
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        return_value=pd.DataFrame(
            [values], columns=[f"v{i}" for i in range(len(values))]
        )
    )
    return database


def _database_returning_frame(frame: pd.DataFrame) -> Database:
    """
    ``_database_returning`` for a probe result whose column dtypes matter.

    The flat-list sibling builds its frame from one Python list, so pandas
    infers a single dtype and the row-versus-cell distinction cannot be seen.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        return_value=frame
    )
    return database


def _probe(database: Database) -> MagicMock:
    """
    The stubbed ``get_df``, typed for call assertions.

    ``Database.get_df`` is a real method, so mypy reads its declared signature
    rather than the mock that replaced it and rejects ``.call_args`` and
    friends.
    """
    return cast(MagicMock, database.get_df)


def test_evaluate_transform_returns_one_value_per_input(app: Flask) -> None:
    database = _database_returning([1767225600, 1769904000])

    with app.app_context():
        result = evaluate_transform(
            database,
            None,
            "default",
            "unix_timestamp(:value)",
            ["2026-01-01 00:00:00", "2026-02-01 00:00:00"],
        )

    assert result == [1767225600, 1769904000]
    _probe(database).assert_called_once()


def test_evaluate_transform_binds_values_rather_than_interpolating(
    app: Flask,
) -> None:
    """
    Filter values are attacker-controlled (a Gamma user picks them), so they must
    be bound and escaped, never pasted into the probe SQL.
    """
    database = _database_returning(["o''brien"])

    with app.app_context():
        evaluate_transform(database, None, None, "lower(:value)", ["O'Brien"])

    sql = _probe(database).call_args.kwargs["sql"]
    assert "O'Brien" not in sql
    assert "O''Brien" in sql


def test_evaluate_transform_dedupes_repeated_values(app: Flask) -> None:
    """Three inputs, two distinct: the probe evaluates the transform twice."""
    database = _database_returning(["us", "us"])

    with app.app_context():
        result = evaluate_transform(
            database, None, None, "lower(:value)", ["US", "US", "us"]
        )

    assert result == ["us", "us", "us"]
    sql = _probe(database).call_args.kwargs["sql"]
    assert sql.count("lower") == 2


def test_evaluate_transform_fails_open_on_a_short_result_row(app: Flask) -> None:
    """A row narrower than the probe asked for means the results cannot be
    aligned back to their inputs; pruning is skipped rather than guessed at."""
    database = _database_returning(["us"])

    with app.app_context():
        assert (
            evaluate_transform(database, None, None, "lower(:value)", ["US", "CA"])
            is None
        )


def test_evaluate_transform_fails_open_on_a_wide_result_row(app: Flask) -> None:
    """
    Too many columns is the dangerous direction. A transform whose select list
    holds two expressions returns 2N columns for N inputs, and reading the first
    N interleaves the expressions instead of taking one per value -- a predicate
    built from the wrong values rather than one that is merely short. Here
    `lower('US'), 'x', lower('CA'), 'x'` would have yielded `('us', 'x')` and
    dropped every CA row.
    """
    database = _database_returning(["us", "x", "ca", "x"])

    with app.app_context():
        assert (
            evaluate_transform(database, None, None, "lower(:value), 'x'", ["US", "CA"])
            is None
        )


def test_the_probe_select_carries_the_engine_s_from_clause(app: Flask) -> None:
    """
    A `SELECT` with no `FROM` is not universal SQL: Oracle and Db2 need a
    one-row table to select from. Without this every probe on those engines
    raises, which `evaluate_transform` swallows -- so the only symptom is a
    correctly configured mapping that silently never prunes.
    """
    assert build_probe_sql("lower(:value)", ["US"]) == "SELECT lower('US') AS v0"
    assert build_probe_sql("lower(:value)", ["US"], None, " FROM DUAL").endswith(
        " FROM DUAL"
    )
    assert OracleEngineSpec.select_without_from_suffix == " FROM DUAL"
    assert BaseEngineSpec.select_without_from_suffix == ""


@pytest.mark.parametrize("dialect", [mysql.dialect(), postgresql.dialect()])
def test_the_probe_select_does_not_double_percent_signs(dialect: Any) -> None:
    """
    `TextClause` compilation runs the dialect's `post_process_text`, which
    doubles every `%` on any paramstyle whose DBAPI later interpolates
    parameters -- MySQL and Postgres, and every spec inheriting from them. The
    probe has no such interpolation pass: it executes with no bound parameters
    at all. Left doubled, `date_format(:value, '%Y%m%d')` asks the warehouse
    for the literal string `%%Y%%m%%d`, so the probe returns that instead of a
    date and the mirrored predicate drops every row the filter keeps.
    """
    sql = build_probe_sql("date_format(:value, '%Y%m%d')", ["2026-01-15"], dialect)

    assert "'%Y%m%d'" in sql
    assert "%%" not in sql


def test_the_probe_select_is_unchanged_on_a_dialect_that_does_not_double() -> None:
    """
    Pins the no-dialect path, which is also the blind spot: the default dialect
    does not double percent signs, so no assertion made through it can see the
    bug the two cases above cover.
    """
    assert (
        build_probe_sql("date_format(:value, '%Y%m%d')", ["2026-01-15"])
        == "SELECT date_format('2026-01-15', '%Y%m%d') AS v0"
    )


def test_a_probed_literal_keeps_its_percent_sign(app: Flask) -> None:
    """
    The preview panel renders probed values through the same dialect, so a
    value that merely contains a `%` would be shown doubled.
    """
    database = Database(database_name="pct_db", sqlalchemy_uri="postgresql://h/d")

    with app.app_context():
        assert _render_literal(database, "100%") == "'100%'"


def test_the_probe_reads_each_cell_without_row_wide_dtype_coercion(
    app: Flask,
) -> None:
    """
    A row is a Series, so it carries one dtype across every probe column: a row
    mixing an exact int64 with a float unifies to float64 and an integer
    partition key above 2^53 comes back rounded. The mirror then asks for a key
    the warehouse does not hold, and the row the filter matched is dropped.
    """
    database = _database_returning_frame(
        pd.DataFrame({"v0": [9007199254740993], "v1": [1.5]})
    )

    with app.app_context():
        probed = evaluate_transform(
            database, None, None, "CAST(:value AS NUMERIC)", ["9007199254740993", "1.5"]
        )

    assert probed == [9007199254740993, 1.5]


def test_evaluate_transform_pins_catalog_and_schema(app: Flask) -> None:
    """
    The probe runs in a different session from the chart query; pinning the
    catalog and schema keeps session settings as close as the pool allows.
    """
    database = _database_returning([1])

    with app.app_context():
        evaluate_transform(database, "prod", "analytics", "lower(:value)", ["x"])

    kwargs = _probe(database).call_args.kwargs
    assert kwargs["catalog"] == "prod"
    assert kwargs["schema"] == "analytics"


def test_evaluate_transform_fails_open_when_the_probe_raises(app: Flask) -> None:
    """A wedged engine must not break the chart — it just stops pruning."""
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("connection reset")
    )

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", ["x"]) is None


def test_evaluate_transform_fails_open_on_an_empty_result(app: Flask) -> None:
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        return_value=pd.DataFrame()
    )

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", ["x"]) is None


def test_evaluate_transform_returns_none_for_no_values(app: Flask) -> None:
    database = _database_returning([])

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", []) is None

    _probe(database).assert_not_called()


@pytest.mark.parametrize(
    "transform",
    [
        "(SELECT password FROM ab_user LIMIT 1) || :value",
        "lower(:value) UNION ALL SELECT password FROM ab_user",
        "lower(:value); DROP TABLE ab_user",
        "password || :value FROM ab_user",
        "lower(:value) FROM ab_user WHERE 1 = 1",
    ],
    ids=[
        "subquery",
        "set-operation",
        "multi-statement",
        "bare-from",
        "from-and-where",
    ],
)
def test_a_transform_that_is_not_a_storable_expression_never_runs(
    app: Flask, transform: str
) -> None:
    """
    The probe is where a transform stops being text and becomes SQL.

    `build_probe_sql` binds `:value` and splices the rest in verbatim, so a
    transform that was never a single harmless expression is arbitrary SQL
    against the dataset's database -- read back out of the emitted predicate
    by anyone who can open "View query". The write-side gates refuse these,
    but they can only speak for rows written after they existed, so the last
    word belongs here.
    """
    database = _database_returning(["irrelevant"])

    with app.app_context():
        assert evaluate_transform(database, None, None, transform, ["us"]) is None

    _probe(database).assert_not_called()


@pytest.mark.parametrize(
    "transform, unfinished",
    [
        ("unix_timestamp(:value", True),
        ("unix_timestamp(:value))", True),
        ("unix_timestamp(:value) +", True),
        ("unix_timestamp(:value)", False),
        ("unix_timestamp(:value); DROP TABLE ab_user", False),
        ("unix_timestamp(:value) UNION ALL SELECT password FROM ab_user", False),
        ("password || :value FROM ab_user", False),
    ],
)
def test_is_unfinished_separates_not_sql_yet_from_the_wrong_sql(
    transform: str, unfinished: bool
) -> None:
    """
    The two deserve opposite treatment -- a half-typed transform is stored and
    parked inactive, the wrong SQL is refused -- and neither `is_parseable` nor
    parsing as a single statement tells them apart, because the multi-statement
    form fails both exactly as unfinished text does. Parsing as a script does.
    """
    assert is_unfinished(transform, "hive") is unfinished


def test_a_transform_smuggling_its_own_from_clause_is_refused(app: Flask) -> None:
    """
    The hole this gate was added for.

    `is_parseable` counts only the projection, so `password || :value FROM
    ab_user` reads as a single select expression and passed every write-side
    gate -- including with `ALLOW_ADHOC_SUBQUERY` off, since a top-level FROM
    is not a sub-query. `build_probe_sql` then emitted `SELECT password || 'us'
    AS v0 FROM ab_user`, where its own alias is read as a table alias on the
    FROM clause the transform brought with it: valid SQL, one row, and the
    secret handed back through the predicate the preview panel renders.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    transform = "password || :value FROM ab_user"

    assert is_parseable(transform, "sqlite") is True
    assert is_bare_expression(transform, "sqlite") is False

    with app.app_context():
        reason = stored_expression_error(database, None, None, transform)
    assert reason is not None

    blocking = _blocking(validate_transform(transform, "sqlite"))
    assert len(blocking) == 1
    assert "single SQL expression" in str(blocking[0].message)
    assert is_transform_active(transform, "sqlite") is False


def test_a_subquery_transform_is_refused_even_with_adhoc_subquery_enabled(
    app: Flask,
) -> None:
    """
    `validate_adhoc_subquery` admits a sub-query under `ALLOW_ADHOC_SUBQUERY`
    and returns RLS-rewritten SQL -- which this path has no way to propagate,
    because `build_probe_sql` splices the original transform text. So the probe
    ran a sub-query with no row-level-security predicates at all and reported
    the hidden row in `emitted_predicate`. A transform is a scalar function of
    `:value`, so refusing the sub-query outright is both correct and what makes
    the missing RLS rewrite moot.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    transform = "(SELECT secret FROM vault LIMIT 1) || :value"

    with app.app_context():
        app.config["DEFAULT_FEATURE_FLAGS"]["ALLOW_ADHOC_SUBQUERY"] = True
        try:
            reason = stored_expression_error(database, None, None, transform)
        finally:
            del app.config["DEFAULT_FEATURE_FLAGS"]["ALLOW_ADHOC_SUBQUERY"]

    assert reason is not None
    assert "sub-query" in reason


def test_a_transform_calling_a_disallowed_function_is_refused(app: Flask) -> None:
    """
    The probe executes the transform, so the operator's function denylist has
    to apply to it for the same reason it applies in SQL Lab.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    transform = "version() || :value"

    with app.app_context():
        app.config["DISALLOWED_SQL_FUNCTIONS"] = {"sqlite": {"version"}}
        reason = stored_expression_error(database, None, None, transform)
        assert reason is not None
        assert "version" in reason

        # Named, rather than echoing the operator's whole denylist back.
        assert "current_user" not in reason

        app.config["DISALLOWED_SQL_FUNCTIONS"] = {}
        assert stored_expression_error(database, None, None, transform) is None


def test_the_function_denylist_is_keyed_on_the_engine_spec_name(app: Flask) -> None:
    """
    Every other denylist gate in the codebase keys on the engine spec's own
    name, which is also the name the config documentation tells an operator to
    write, so this one does too -- a spec covering several SQLAlchemy backends
    through `engine_aliases` reports the one canonical name under which its
    entry exists.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")

    with app.app_context():
        app.config["DISALLOWED_SQL_FUNCTIONS"] = {
            database.db_engine_spec.engine: {"version"}
        }
        assert (
            stored_expression_error(database, None, None, "version() || :value")
            is not None
        )


def test_the_denylist_key_falls_back_when_the_engine_spec_cannot_load(
    app: Flask,
) -> None:
    """
    Resolving the engine spec loads the SQLAlchemy dialect entrypoint, which
    imports the driver package. A deployment missing an optional driver that
    raises on import rather than being absent must not have its dataset
    imports turned into hard failures by this gate, so the key falls back to
    the URL's backend -- the same string for every engine without aliases.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")

    with (
        app.app_context(),
        patch.object(
            type(database),
            "db_engine_spec",
            new_callable=lambda: property(
                lambda self: (_ for _ in ()).throw(ModuleNotFoundError("no driver"))
            ),
        ),
    ):
        app.config["DISALLOWED_SQL_FUNCTIONS"] = {"sqlite": {"version"}}
        assert (
            stored_expression_error(database, None, None, "version() || :value")
            is not None
        )


# ---------------------------------------------------------------------------
# §5 — save-time validation, in two tiers
# ---------------------------------------------------------------------------


def _issues(**kwargs: Any) -> list[MappingValidationIssue]:
    defaults: dict[str, Any] = {
        "column_names": {"event_time", "dt_epoch", "country", "region_key"},
        "partition_column": "dt_epoch",
        "partition_mapped_column": None,
        "main_dttm_col": "event_time",
        "transform": "unix_timestamp(:value)",
        "engine": "hive",
    }
    defaults.update(kwargs)
    return validate_partition_mapping(**defaults)


def _blocking(issues: list[MappingValidationIssue]) -> list[MappingValidationIssue]:
    return [issue for issue in issues if issue.blocking]


def _warnings(issues: list[MappingValidationIssue]) -> list[MappingValidationIssue]:
    return [issue for issue in issues if not issue.blocking]


def test_a_well_formed_mapping_raises_nothing() -> None:
    assert _issues() == []


def test_no_partition_column_means_nothing_to_validate() -> None:
    assert _issues(partition_column=None, transform=None) == []


# Tier 1 — blocks the save


def test_an_unknown_partition_column_blocks_the_save() -> None:
    issues = _issues(partition_column="nope")
    assert len(_blocking(issues)) == 1
    assert issues[0].field == "partition_column"


def test_an_unknown_mapped_column_override_blocks_the_save() -> None:
    issues = _issues(partition_mapped_column="nope")
    assert len(_blocking(issues)) == 1
    assert issues[0].field == "partition_mapped_column"


def test_an_explicit_self_mapping_blocks_the_save() -> None:
    issues = _blocking(_issues(partition_mapped_column="dt_epoch"))
    assert len(issues) == 1
    assert "itself" in issues[0].message


def test_an_implicit_self_mapping_is_reported_without_blocking() -> None:
    """
    Still caught -- checking only the explicit override would miss the case an
    owner actually hits, where `partition_column` names the column that is
    *already* the default datetime column -- but Tier 2 rather than Tier 1.

    Blocking it made the state unescapable. `fetch_metadata` could choose the
    partition column as the default datetime column without anyone asking, and
    once it had, every later write failed validation -- including one that
    changed nothing but the description, and including the write that would
    have set the override that fixes it. The mapping is inert either way, since
    `resolve_partition_mapping` bails out on it, so reporting is the whole job.
    """
    issues = _issues(partition_column="event_time", main_dttm_col="event_time")

    assert _blocking(issues) == []
    reported = [issue for issue in issues if "points at itself" in str(issue.message)]
    assert len(reported) == 1
    assert reported[0].field == "partition_mapped_column"
    # And it names the two ways out, since neither is obvious from the error.
    assert "override" in str(reported[0].message)
    assert "default datetime column" in str(reported[0].message)


def test_an_explicit_self_mapping_still_blocks_the_save() -> None:
    """The counterpart: asked for directly, it is the mistake it looks like."""
    issues = _blocking(
        _issues(partition_column="event_time", partition_mapped_column="event_time")
    )
    assert len(issues) == 1
    assert "itself" in str(issues[0].message)


def test_an_override_clears_the_implicit_self_mapping_report() -> None:
    """
    The way out the message names has to actually work: setting an override
    away from the partition column leaves no self-mapping at all.
    """
    issues = _issues(
        partition_column="event_time",
        main_dttm_col="event_time",
        partition_mapped_column="country",
    )

    assert _blocking(issues) == []
    assert not [issue for issue in issues if "points at itself" in str(issue.message)]


def test_jinja_in_the_transform_blocks_the_save() -> None:
    """
    The probe would render the template in a different context at a different
    time from the chart query, so v1 disallows it outright.
    """
    issues = _blocking(_issues(transform="unix_timestamp('{{ ds }}' , :value)"))
    assert len(issues) == 1
    assert "Jinja" in issues[0].message


@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value) - unix_timestamp()",
        "date_diff(:value, now())",
        "CAST(:value AS BIGINT) + rand()",
    ],
)
def test_a_non_deterministic_transform_blocks_the_save(transform: str) -> None:
    issues = _blocking(_issues(transform=transform))
    assert len(issues) == 1
    assert issues[0].field == "partition_value_transform"


# Tier 2 — saves, but the mapping stays inactive


def test_an_unparseable_transform_saves_with_a_warning() -> None:
    """The PRD is explicit: a bad transform still saves, it just stays inactive."""
    issues = _issues(transform="unix_timestamp(:value")
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_a_parse_failure_names_what_the_parser_choked_on() -> None:
    """
    "Could not be parsed" tells an owner nothing they can act on. When the
    parser hands us a position, pass it along.
    """
    issues = _issues(transform="unix_timestamp(:value")
    message = str(_warnings(issues)[0].message)
    assert "position" in message


def test_a_misspelled_function_is_not_a_parse_error() -> None:
    """
    sqlglot parses unknown functions happily -- they are anonymous calls, not
    syntax errors -- so a typo like this reaches the engine and is reported
    from there instead. Pinning it so the distinction is not lost.
    """
    assert parse_error_detail("unix_timestmp(:value)", "postgresql") is None


def test_a_transform_without_the_placeholder_saves_with_a_warning() -> None:
    issues = _issues(transform="unix_timestamp(event_time)")
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_a_missing_transform_saves_with_a_warning() -> None:
    issues = _issues(transform=None)
    assert _blocking(issues) == []
    assert len(_warnings(issues)) == 1


def test_an_unparseable_transform_skips_the_checks_that_need_a_parse() -> None:
    """
    The Jinja and non-determinism checks require a successful parse. When there
    is nothing to inspect, fall through to a warning rather than reporting a
    blocking error the owner cannot act on.
    """
    issues = _issues(transform="now(:value")
    assert _blocking(issues) == []


# ---------------------------------------------------------------------------
# §4.2 — the probe cache
# ---------------------------------------------------------------------------


def test_a_repeated_probe_is_served_from_cache(app: Flask) -> None:
    """
    Day-aligned ranges ("Last month") repeat constantly across charts, so the
    hit rate is what keeps the added round trip off the hot path.
    """
    database = _database_returning([1767225600])

    with app.app_context():
        first = evaluate_transform(
            database, None, None, "unix_timestamp(:value)", ["2026-01-01"]
        )
        second = evaluate_transform(
            database, None, None, "unix_timestamp(:value)", ["2026-01-01"]
        )

    assert first == second == [1767225600]
    _probe(database).assert_called_once()


def test_the_cache_key_includes_the_transform(app: Flask) -> None:
    """Editing the transform must not serve the old transform's results."""
    database = _database_returning([1])

    with app.app_context():
        evaluate_transform(database, None, None, "unix_timestamp(:value)", ["x"])
        evaluate_transform(database, None, None, "lower(:value)", ["x"])

    assert _probe(database).call_count == 2


def test_the_cache_key_includes_the_values(app: Flask) -> None:
    database = _database_returning([1])

    with app.app_context():
        evaluate_transform(database, None, None, "lower(:value)", ["x"])
        evaluate_transform(database, None, None, "lower(:value)", ["y"])

    assert _probe(database).call_count == 2


def test_the_cache_key_includes_the_catalog_and_schema(app: Flask) -> None:
    """
    The transform is evaluated against a pinned catalog and schema; the same
    expression can resolve differently under a different one.
    """
    database = _database_returning([1])

    with app.app_context():
        evaluate_transform(database, "prod", "analytics", "lower(:value)", ["x"])
        evaluate_transform(database, "prod", "staging", "lower(:value)", ["x"])

    assert _probe(database).call_count == 2


def test_a_failed_probe_is_not_cached(app: Flask) -> None:
    """Caching a failure would keep a transient engine blip pruning-free for a day."""
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=[
            RuntimeError("connection reset"),
            pd.DataFrame([[42]], columns=["v0"]),
        ]
    )

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", ["x"]) is None
        assert evaluate_transform(database, None, None, "lower(:value)", ["x"]) == [42]


def test_a_null_monotonic_flag_reads_as_not_declared(app: Flask) -> None:
    """
    The column is nullable because the legacy datasource editor writes NULL for
    any field its payload omits. NULL has to fail closed: ranges stop mirroring
    rather than mirroring through a transform nobody declared order-preserving.
    """
    table = _mapped_table()
    for column in table.columns:
        if column.column_name == "event_time":
            column.partition_transform_is_monotonic = None

    with app.app_context():
        mapping = resolve_partition_mapping(table)

    assert mapping is not None
    assert mapping.is_monotonic is False
    assert not mapping.mirrors(FilterOperator.TEMPORAL_RANGE)
    assert mapping.mirrors(FilterOperator.EQUALS)


def test_a_failed_probe_reports_the_engine_error_when_asked(app: Flask) -> None:
    """
    The query path swallows probe failures -- losing pruning beats failing a
    chart. The editor's preview passes a sink so it can tell the owner why,
    which is the only way a misspelled function ever gets explained.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("function unix_timestmp does not exist")
    )
    errors: list[str] = []

    with app.app_context():
        assert (
            evaluate_transform(
                database, None, None, "unix_timestmp(:value)", ["x"], errors=errors
            )
            is None
        )

    assert errors == ["function unix_timestmp does not exist"]


def test_a_failed_probe_stays_silent_without_a_sink(app: Flask) -> None:
    """The hot path passes nothing and must not pay for the message."""
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("connection reset")
    )

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", ["x"]) is None


def test_probe_cache_key_tracks_the_connection(app: Flask) -> None:
    """
    The probe asks a specific database to evaluate the transform, so the answer
    belongs to that connection. ``database.id`` survives an edit to the URI or
    to ``extra`` (a session timezone, say), which would otherwise serve values
    computed against the old environment for the whole cache timeout -- and a
    wrong transformed bound prunes away rows the real filter keeps.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.id = 1

    with app.app_context():
        before = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
        database.sqlalchemy_uri = "postgresql://host/db"
        after_uri = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
        database.extra = '{"engine_params": {"connect_args": {"timezone": "UTC"}}}'
        after_extra = _probe_cache_key(database, None, None, "lower(:value)", ["US"])

    assert before != after_uri
    assert after_uri != after_extra


# ---------------------------------------------------------------------------
# §6 — the read-side predicate the Explore indicator asks
# ---------------------------------------------------------------------------

#: One transform per branch of ``validate_transform``, blocking and not.
INACTIVE_TRANSFORMS = [
    None,
    "",
    "   ",
    "unix_timestamp(:value",
    "unix_timestamp(event_time)",
    "unix_timestamp('{{ ds }}', :value)",
    "date_diff(:value, now())",
]


def test_a_well_formed_transform_is_active() -> None:
    assert is_transform_active("unix_timestamp(:value)", "hive") is True


@pytest.mark.parametrize("transform", INACTIVE_TRANSFORMS)
def test_every_transform_issue_leaves_it_inactive(transform: str | None) -> None:
    """
    Blocking issues count as much as the rest. A Jinja or non-deterministic
    transform is rejected on PUT, but create and import do not validate the
    mapping, so one can still be read back -- and it mirrors nothing either.
    """
    assert is_transform_active(transform, "hive") is False


@pytest.mark.parametrize(
    "transform",
    ["unix_timestamp(:value)", "CAST(:value AS BIGINT)", *INACTIVE_TRANSFORMS],
)
def test_activity_is_exactly_the_absence_of_issues(transform: str | None) -> None:
    """
    The indicator and the save path have to answer the same question. Pinning
    the equivalence is what stops the two from drifting apart again.
    """
    assert is_transform_active(transform, "hive") is (
        validate_transform(transform, "hive") == []
    )
