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
from decimal import Decimal
from importlib import import_module
from typing import Any, cast
from unittest.mock import MagicMock, patch, PropertyMock

import pandas as pd
import pytest
from dateutil.relativedelta import relativedelta
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy.dialects import mysql, postgresql

from superset.config import DISALLOWED_SQL_FUNCTIONS
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.partition_mapping import (
    _mirror_verdict_cache_key,
    _placeholder_is_bindable,
    _probe_cache_key,
    _reads_as_temporal,
    _render_literal,
    _render_predicate,
    BARE_WALL_CLOCK_KEYWORDS,
    build_mirrored_predicates,
    build_probe_sql,
    contains_executable_comment,
    contains_jinja,
    contains_value_placeholder,
    drop_unmapped_value_transforms,
    equality_mirrors_safely,
    evaluate_transform,
    find_non_deterministic_functions,
    grain_bucket_width,
    GRAIN_BUCKET_WIDTHS,
    is_bare_expression,
    is_parseable,
    is_transform_active,
    is_unfinished,
    known_mirror_verdict,
    literal_round_trips,
    MappingValidationIssue,
    mirror_operator,
    MIRRORABLE_ALWAYS,
    MIRRORABLE_IF_MONOTONIC,
    mirrorable_operators,
    NON_DETERMINISTIC_FUNCTIONS,
    parse_error_detail,
    placeholder_is_executable,
    probe_sql_is_evaluable,
    probed_value_type_error,
    RawProbeValue,
    resolve_partition_mapping,
    stored_expression_error,
    validate_partition_mapping,
    validate_transform,
)
from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.oracle import OracleEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.models.core import Database
from superset.sql.parse import SQLStatement
from superset.utils.core import FilterOperator, GenericDataType, override_user


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


@pytest.mark.parametrize(
    "operator,expected",
    [
        (FilterOperator.GREATER_THAN, FilterOperator.GREATER_THAN_OR_EQUALS),
        (FilterOperator.LESS_THAN, FilterOperator.LESS_THAN_OR_EQUALS),
        (
            FilterOperator.GREATER_THAN_OR_EQUALS,
            FilterOperator.GREATER_THAN_OR_EQUALS,
        ),
        (FilterOperator.LESS_THAN_OR_EQUALS, FilterOperator.LESS_THAN_OR_EQUALS),
        (FilterOperator.EQUALS, FilterOperator.EQUALS),
        (FilterOperator.IN, FilterOperator.IN),
    ],
)
def test_a_strict_bound_mirrors_non_strictly(
    operator: FilterOperator, expected: FilterOperator
) -> None:
    """
    Order-preserving means non-decreasing, not injective, so ``col < v``
    implies only ``T(col) <= T(v)``. A day-key transform maps a whole day onto
    one value and a strict mirror drops the boundary bucket. The non-strict
    cases are already safe and pass through, which is what makes applying this
    twice harmless.
    """
    assert mirror_operator(operator) == expected


def test_relaxing_a_bound_stays_inside_the_mirrorable_set() -> None:
    """
    The substitution is about strictness, not about which filters mirror. The
    Explore indicator reads `mirrorable_operators`, so leaving that set alone is
    what keeps the glyph from promising pruning the SQL does not do -- and it is
    also what guarantees `handle_comparison_filter` is never handed an operator
    it has no case for.
    """
    assert {
        mirror_operator(operator) for operator in MIRRORABLE_IF_MONOTONIC
    } <= MIRRORABLE_IF_MONOTONIC


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


@pytest.mark.parametrize(
    "type_, expected",
    [
        # The padded types: `'US'` and `'US '` are equal in the column, and
        # `lower()` of the two is not.
        ("CHAR(2)", False),
        ("CHAR", False),
        ("CHARACTER(2)", False),
        ("NCHAR(2)", False),
        # What PostgreSQL reflection reports for a `CHAR(n)` column.
        ("BPCHAR", False),
        ("bpchar(2)", False),
        ("NATIONAL CHARACTER(2)", False),
        # The variable-width types start with the same letters and must not be
        # caught by it.
        ("VARCHAR(2)", True),
        ("NVARCHAR(2)", True),
        ("CHARACTER VARYING(2)", True),
        ("TEXT", True),
    ],
)
def test_a_padded_character_column_declines_equality_on_a_byte_exact_engine(
    app: Flask, type_: str, expected: bool
) -> None:
    """
    `binary_string_comparison` speaks for the engine's default comparison,
    which PostgreSQL declares -- and a `CHAR(2)` there still matches a filter
    for `'US '` against a stored `'US'`, so the mirror `lower('US ')` excludes
    the row. Padding is a property of the type, so it is asked per column.
    """

    class _Spec(BaseEngineSpec):
        binary_string_comparison = True

    with app.app_context():
        assert equality_mirrors_safely(_column(type_), _Spec) is expected


def test_redshift_does_not_opt_in_to_byte_exact_comparison() -> None:
    """
    Redshift ignores trailing blanks for `VARCHAR` as well as `CHAR`, so the
    `True` it inherits from `PostgresBaseEngineSpec` would be wrong.
    """
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    assert RedshiftEngineSpec.binary_string_comparison is False


@pytest.mark.parametrize(
    "type_",
    [
        # PostgreSQL's case-insensitive text type matches no type pattern, so
        # the spec cannot classify it -- and its whole purpose is the
        # comparison this gate is about.
        "citext",
        # A column with no declared type at all.
        "",
        "SOME_EXTENSION_TYPE",
    ],
)
def test_equality_mirrors_safely_fails_closed_on_an_unresolvable_type(
    app: Flask, type_: str
) -> None:
    """
    The gate exists to stop a silent wrong answer, so a column whose type it
    cannot read is treated as the risky case rather than waved through.

    `type_generic` answers `None` for these -- neither string nor not-string --
    and the old reading waved them through, which for `citext` admitted exactly
    the case-insensitive equality the gate is for. Only the exception branch
    failed closed, though the docstring claimed otherwise.
    """
    with app.app_context():
        assert equality_mirrors_safely(_column(type_), PostgresEngineSpec) is False


def test_equality_mirrors_safely_reads_past_the_temporal_flag(app: Flask) -> None:
    """
    `TableColumn.type_generic` answers `TEMPORAL` for anything carrying
    `is_dttm`, so a `VARCHAR` flagged temporal skipped the string check
    entirely: on MySQL a filter for `'2026-01-01T00:00:00'` matches a stored
    `'...t00:00:00'` while the mirror `hex('...T...')` excludes it.
    """
    with app.app_context():
        flagged = _column("VARCHAR")
        flagged.is_dttm = True
        assert flagged.type_generic == GenericDataType.TEMPORAL
        # Declines where plain text declines...
        assert equality_mirrors_safely(flagged, MySQLEngineSpec) is False
        # ...and is admitted where plain text is admitted.
        assert equality_mirrors_safely(flagged, PostgresEngineSpec) is True

        # A column that really is temporal is unaffected.
        real = _column("TIMESTAMP")
        real.is_dttm = True
        assert equality_mirrors_safely(real, MySQLEngineSpec) is True


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
def test_a_case_insensitive_engine_does_not_opt_in(module: str, spec_name: str) -> None:
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
                side_effect=lambda flag: (
                    flag in {"PARTITION_FILTER_MAPPING", "ENABLE_ADVANCED_DATA_TYPES"}
                ),
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


def test_contains_jinja_answers_as_the_block_pattern_does() -> None:
    """
    The scan has to agree with the lazy, ``DOTALL`` pattern it stands in for
    on every input, including overlapping and unclosed delimiters, so that no
    stored transform changes verdict. Every string of up to seven characters
    over the delimiter characters, a newline and a filler is checked.
    """
    import itertools
    import re

    pattern = re.compile(r"\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}", re.DOTALL)
    for length in range(8):
        for chars in itertools.product("{}%#\na", repeat=length):
            text = "".join(chars)
            assert contains_jinja(text) is (pattern.search(text) is not None), text


@pytest.mark.parametrize("opening", ["{{", "{%", "{#"])
def test_contains_jinja_is_linear_in_a_run_of_opening_delimiters(
    opening: str,
) -> None:
    """
    A run of opening delimiters with no closing one made the lazy pattern retry
    from every position, which is quadratic. Stored transforms are not
    length-bounded here, so a long run has to stay cheap.
    """
    import time

    started = time.monotonic()
    assert contains_jinja(opening * 200_000) is False
    assert time.monotonic() - started < 1


@pytest.mark.parametrize(
    ("transform", "expected"),
    [
        ("lower(:value)", False),
        ("lower(:value) /* an ordinary comment */", False),
        ("lower(:value) -- a line comment", False),
        (":value /*!50000 + 1 */", True),
        (":value /*M!50000 + 1 */", True),
        (":value /*! + 1 */", True),
        ("", False),
        (None, False),
    ],
)
def test_contains_executable_comment(transform: str | None, expected: bool) -> None:
    assert contains_executable_comment(transform) is expected


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


@pytest.mark.parametrize(
    ("engine", "transform", "expected_name"),
    [
        # `now()` is statement-stable on PostgreSQL; these two are not even
        # that, and the ANSI four did not name them.
        ("postgresql", "age(clock_timestamp(), :value)", "CLOCK_TIMESTAMP"),
        ("postgresql", "age(statement_timestamp(), :value)", "STATEMENT_TIMESTAMP"),
        # Every engine spells "now" its own way, and the gate matches by name.
        ("mysql", "datediff(sysdate(), :value)", "SYSDATE"),
        ("mysql", "datediff(curdate(), :value)", "CURDATE"),
        ("oracle", "datediff(day, :value, LOCALTIMESTAMP)", "LOCALTIMESTAMP"),
        ("oracle", "SYSTIMESTAMP - :value", "SYSTIMESTAMP"),
        ("mssql", "DATEDIFF(day, :value, GETDATE())", "GETDATE"),
        ("mssql", "DATEDIFF(day, :value, SYSUTCDATETIME())", "SYSUTCDATETIME"),
        ("clickhouse", "now64() - :value", "NOW64"),
        ("bigquery", "DATE_DIFF(CURRENT_DATETIME(), :value, DAY)", "CURRENT_DATETIME"),
    ],
)
def test_every_engine_s_spelling_of_now_is_reported(
    engine: str, transform: str, expected_name: str
) -> None:
    """
    The list is matched by SQL function name, so a spelling it does not carry
    passes the gate. A relative partition key such as
    `datediff(day, :value, LOCALTIMESTAMP)` is then probed once, cached, and
    keeps emitting yesterday's partition value after midnight -- so the chart
    silently drops rows.
    """
    assert expected_name in find_non_deterministic_functions(transform, engine)


@pytest.mark.parametrize(
    ("engine", "transform", "expected_name"),
    [
        # MySQL takes these with no parentheses at all...
        ("mysql", "datediff(UTC_DATE, :value)", "UTC_DATE"),
        ("mysql", "datediff(utc_timestamp, :value)", "UTC_TIMESTAMP"),
        ("mysql", "datediff(CURRENT_DATE, :value)", "CURRENT_DATE"),
        # ...as do Oracle and PostgreSQL for their own spellings.
        # sqlglot normalizes Oracle's bare `SYSDATE` to `CURRENT_TIMESTAMP`,
        # so it is caught as a function under that name -- which is a pass:
        # what matters is that the gate reports it, not what it is called.
        ("oracle", ":value - SYSDATE", "CURRENT_TIMESTAMP"),
        ("oracle", ":value - SYSTIMESTAMP", "SYSTIMESTAMP"),
        ("postgresql", "age(LOCALTIMESTAMP, :value)", "LOCALTIMESTAMP"),
    ],
)
def test_a_bare_wall_clock_keyword_is_reported(
    engine: str, transform: str, expected_name: str
) -> None:
    """
    Written without parentheses these parse as *column references*, so the
    function-name walk could not see them and probe time was frozen into a
    cached mirror.
    """
    assert expected_name in find_non_deterministic_functions(transform, engine)


def test_the_bare_list_stays_to_names_that_need_no_parentheses() -> None:
    """
    Refusing a bare name costs an owner a column genuinely called that, so the
    list is only the datetime keywords SQL lets you write without `()`.
    `rand`, `uuid` and `newid` always need them, and are plausible column
    names.
    """
    assert BARE_WALL_CLOCK_KEYWORDS <= {
        name.lower() for name in NON_DETERMINISTIC_FUNCTIONS
    }
    assert not BARE_WALL_CLOCK_KEYWORDS & {"rand", "random", "uuid", "newid"}
    # A column by one of those names is still an ordinary column.
    assert find_non_deterministic_functions("lower(:value) || uuid", "postgresql") == (
        set()
    )


@pytest.mark.parametrize(
    ("engine", "transform"),
    [
        # The canonical transforms, which must not be swept up by the names
        # added above.
        ("hive", "unix_timestamp(:value)"),
        ("postgresql", "to_char(:value, 'YYYYMMDD')"),
        ("postgresql", "extract(epoch from :value)"),
        ("mysql", "date_format(:value, '%Y%m%d')"),
        ("oracle", "trunc(:value)"),
        ("mssql", "CONVERT(date, :value)"),
    ],
)
def test_the_canonical_transforms_are_still_pure(engine: str, transform: str) -> None:
    """The list grew; this is the half that says it did not grow into the
    transforms this feature exists for."""
    assert find_non_deterministic_functions(transform, engine) == set()


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


def _user(username: str) -> Any:
    """A stand-in for `override_user`, which only needs `.username` here."""
    user = MagicMock()
    user.username = username
    user.is_anonymous = False
    return user


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


@pytest.mark.parametrize(
    ("transform", "expected"),
    [
        ("lower(:value)", True),
        ("CAST(:value AS BIGINT)", True),
        ("date_format(:value, '%Y%m%d')", True),
        # The cast shorthand: a trailing colon stops SQLAlchemy's bind scan.
        (":value::bigint", False),
        ("(:value::date)::text", False),
    ],
)
def test_a_postgres_cast_shorthand_is_not_bindable(
    transform: str, expected: bool
) -> None:
    """
    `VALUE_PLACEHOLDER_RE` is `:value\b`, which matches inside `:value::bigint`.
    SQLAlchemy's own scan ends with `(?![:\\w$])`, so the following colon stops
    it: `text(":value::bigint")` reports a parameter named `valu`, and asking it
    to bind `value` raises.

    Pinned because the two regexes disagreeing is the whole bug: every
    write-side gate accepted the transform and the probe then died on an
    `ArgumentError` that `_probe` swallows.
    """
    assert _placeholder_is_bindable(transform) is expected


def test_a_cast_shorthand_transform_still_probes(app: Flask) -> None:
    """
    The transform is valid SQL, passes every gate, and used to prune nothing:
    `build_probe_sql` raised, `_probe` swallowed it, and the only symptom was a
    mapping that silently never mirrored -- with the preview reporting an engine
    failure for SQL that was never sent.
    """
    database = _database_returning([20260115])

    with app.app_context():
        result = evaluate_transform(
            database, None, None, ":value::bigint", ["20260115"]
        )

    assert result == [20260115]
    assert _probe(database).call_count == 1
    assert "::bigint" in _probe(database).call_args.kwargs["sql"]


def test_a_cast_shorthand_value_is_still_escaped_by_the_dialect(
    app: Flask,
) -> None:
    """
    The fallback substitutes where the bind path binds, so it has to earn the
    same guarantee its sibling above pins: the value is rendered by the
    dialect's literal processor, not pasted in.

    Binding was only ever the vehicle for reaching that processor --
    `_compile_literal` inlines the result either way -- so this renders first
    and substitutes second. Same string, different order.

    Rendering is necessary and not sufficient: whether the engine reads the
    rendered text back as this value is a separate question, and the one
    `literal_round_trips` answers. SQLite's engine honours the doubling its
    driver emits, which is why this value is probed here at all.
    """
    database = _database_returning(["x"])

    with app.app_context():
        evaluate_transform(database, None, None, ":value::text", ["O'Brien"])

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
    built from the wrong values rather than one that is merely short. A frame of
    `('us', 'x', 'ca', 'x')` read as the first two columns would have yielded
    `('us', 'x')` and dropped every CA row.

    The transform is a perfectly ordinary `lower(:value)` and the width comes
    from the stubbed frame, which is the only way to reach the guard: a
    transform that really does carry two expressions -- `lower(:value), 'x'` --
    is refused by `stored_expression_error` for not being a single expression,
    so `get_df` is never called and `None` comes back for an unrelated reason.
    Asserting the probe *ran* is what separates the two, and it is what makes
    relaxing the guard from `!=` to `<` fail here rather than pass: four columns
    for two inputs is not fewer than two.
    """
    database = _database_returning(["us", "x", "ca", "x"])

    with app.app_context():
        assert (
            evaluate_transform(database, None, None, "lower(:value)", ["US", "CA"])
            is None
        )

    assert _probe(database).call_count == 1


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


@pytest.mark.parametrize(
    ("module", "spec_name", "suffix"),
    [
        ("oracle", "OracleEngineSpec", " FROM DUAL"),
        ("db2", "Db2EngineSpec", " FROM SYSIBM.SYSDUMMY1"),
    ],
)
def test_the_probe_reads_the_from_suffix_off_the_engine_spec(
    app: Flask, mocker: MockerFixture, module: str, spec_name: str, suffix: str
) -> None:
    """
    The sibling above hands `build_probe_sql` a suffix directly, so it never
    exercises the step that reads `select_without_from_suffix` off the engine
    spec and forwards it. Drop that forwarding and the sibling stays green
    while Oracle and Db2 stop pruning entirely -- a bare `SELECT ...` raises
    there, `evaluate_transform` swallows it, and the only symptom is a
    correctly configured mapping that silently never prunes.

    So this drives the real entry point and asserts on the SQL the engine is
    handed, plus that the result is accepted.
    """
    spec = getattr(import_module(f"superset.db_engine_specs.{module}"), spec_name)
    database = _database_returning(["us"])
    mocker.patch.object(
        type(database), "db_engine_spec", PropertyMock(return_value=spec)
    )

    with app.app_context():
        assert evaluate_transform(database, None, None, "lower(:value)", ["US"]) == [
            "us"
        ]

    sql = _probe(database).call_args.kwargs["sql"]
    assert sql.endswith(suffix)
    # And the gate that re-parses the compiled probe accepts that shape, rather
    # than the suffix being appended only to be refused downstream.
    assert probe_sql_is_evaluable(sql, spec.engine, 1, suffix) is True


@pytest.mark.parametrize(
    ("transform", "expected"),
    [
        (":value || ':suffix'", "SELECT 'us' || ':suffix' AS v0"),
        ("concat(:value, ':x')", "SELECT concat('us', ':x') AS v0"),
        ("replace(:value, ':a', ':b')", "SELECT replace('us', ':a', ':b') AS v0"),
        # The separator shape, which is the ordinary reason to write one.
        ("concat(:value, ':', 'x')", "SELECT concat('us', ':', 'x') AS v0"),
        # A time format carries two.
        (
            "to_char(:value, 'HH24:MI:SS')",
            "SELECT to_char('us', 'HH24:MI:SS') AS v0",
        ),
        # And the placeholder itself still binds.
        ("lower(:value)", "SELECT lower('us') AS v0"),
    ],
)
def test_a_colon_in_a_literal_is_not_read_as_a_bind(
    transform: str, expected: str
) -> None:
    """
    `text()` reads any `:word` as a bind parameter, including inside a string
    literal, and an unbound one renders as `NULL` under literal binds rather
    than raising. So `:value || ':suffix'` compiled to `'us' || 'NULL'`: the
    mirror asked for a partition value no row holds and the chart dropped
    rows, with no error for `_probe` to swallow.
    """
    assert build_probe_sql(transform, ["us"]) == expected


def test_a_colon_literal_survives_the_unbindable_path_too() -> None:
    """
    The other branch substitutes textually through `parse_skeleton` and never
    hands the transform to `text()`, so it was never affected -- pinned so the
    escaping added for the bound path cannot leak into it as a stray backslash.
    """
    assert build_probe_sql(":value::bigint", [7]) == "SELECT 7::bigint AS v0"


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


def test_a_raw_probe_value_is_substituted_literally() -> None:
    r"""
    `RawProbeValue.sql` is rendered from a filter value, so it reaches
    `parse_skeleton` as the *replacement* for `:value`. Read as a replacement
    template, a backslash in it is an escape: `array('a\nb')` -- which is how a
    dialect renders the two characters `\` and `n` -- would become a real
    newline, so the engine is asked about a different array than the predicate
    compares and the mirror can exclude rows the filter keeps.
    """
    sql = build_probe_sql("toYYYYMM(:value)", [RawProbeValue(r"array('a\nb')")])

    assert sql == r"SELECT toYYYYMM(array('a\nb')) AS v0"


def test_a_raw_probe_value_does_not_re_inject_the_placeholder() -> None:
    r"""
    `\g<0>` in a replacement template expands to the whole match, which would
    put `:value` back into the probe -- an unbound parameter the engine refuses.
    """
    sql = build_probe_sql("toYYYYMM(:value)", [RawProbeValue(r"'a\g<0>b'")])

    assert sql == r"SELECT toYYYYMM('a\g<0>b') AS v0"
    assert ":value" not in sql


def test_a_raw_probe_value_with_a_group_reference_does_not_raise() -> None:
    r"""
    `\1` is an invalid group reference for this pattern, so as a replacement
    template it raised `re.PatternError` rather than probing anything.
    """
    sql = build_probe_sql("toYYYYMM(:value)", [RawProbeValue(r"'a\1b'")])

    assert sql == r"SELECT toYYYYMM('a\1b') AS v0"


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


@pytest.mark.parametrize(
    "comment",
    ["/*!50000 + (SELECT secret FROM vault LIMIT 1) */", "/*M!50000 + 1 */"],
)
def test_an_executable_comment_is_refused_by_every_gate(
    app: Flask, comment: str
) -> None:
    """
    The one construct that made the shape gates describe a statement the engine
    would not run.

    sqlglot reads a MySQL executable comment as comment data: the pinned parse
    below reports no sub-query and no clause, so `stored_expression_error` and
    `probe_sql_is_evaluable` both passed it, while MySQL and MariaDB execute
    what is inside. An owner with dataset write and no SQL Lab could put one in
    a transform, call the preview and read a table back out of
    `emitted_predicate`, with no RLS on the hidden query.

    Refused on every engine, not only the two that honour it -- hence SQLite
    here. There is no legitimate transform carrying one, and a per-engine gate
    would store on Postgres what detonates after the dataset is re-pointed.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    transform = f"(:value {comment})"

    # The premise: no parse-tree gate can see it.
    statement = SQLStatement(f"SELECT (1 {comment}) AS v0", "mysql")
    assert statement.has_subquery() is False
    assert statement.get_clause_names() == set()

    with app.app_context():
        assert stored_expression_error(database, None, None, transform) is not None

    blocking = [
        issue for issue in validate_transform(transform, "mysql") if issue.blocking
    ]
    assert len(blocking) == 1
    assert "executable comment" in str(blocking[0].message)


def test_an_executable_comment_stops_the_probe_before_the_engine(app: Flask) -> None:
    """
    The gate above is the save path. This is the row an earlier release stored:
    `_probe` consults `stored_expression_error` on every call, so a transform
    already in the metadata database never reaches `get_df`.
    """
    database = _database_returning(["x"])
    transform = "(:value /*!50000 + (SELECT secret FROM vault LIMIT 1) */)"

    with app.app_context():
        assert evaluate_transform(database, None, None, transform, ["US"]) is None

    assert _probe(database).call_count == 0


def test_a_unicode_escaped_identifier_is_refused_by_every_gate(app: Flask) -> None:
    """
    The second construct that made the gates reason about a name the engine
    does not use. sqlglot reports `U&"\\0071uery_to_xml"` as an anonymous
    function literally called `\\0071uery_to_xml`, so the function denylist --
    which matches on the reported name -- never sees `query_to_xml`, while
    PostgreSQL decodes the escape and runs it. An owner with dataset write and
    no SQL Lab could read rows outside their RLS scope back out of
    `emitted_predicate`.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://u@h/d")
    transform = "CAST(U&\"\\0071uery_to_xml\"(:value, false, true, '') AS TEXT)"

    # The premise: the denylist is matching the wrong name.
    statement = SQLStatement(
        "SELECT CAST(U&\"\\0071uery_to_xml\"('x', false, true, '') AS TEXT) AS v0",
        "postgresql",
    )
    assert statement.get_disallowed_functions({"query_to_xml"}) == set()

    with app.app_context():
        assert stored_expression_error(database, None, None, transform) is not None

    blocking = [
        issue for issue in validate_transform(transform, "postgresql") if issue.blocking
    ]
    assert len(blocking) == 1
    assert "escape sequence" in str(blocking[0].message)


def test_a_unicode_escaped_identifier_stops_the_probe_before_the_engine(
    app: Flask,
) -> None:
    """The row an earlier release stored, as for the executable comment."""
    database = _database_returning(["x"])
    transform = "U&\"\\0071uery_to_xml\"(:value, false, true, '') || ''"

    with app.app_context():
        assert evaluate_transform(database, None, None, transform, ["US"]) is None

    assert _probe(database).call_count == 0


def test_an_ordinary_quoted_identifier_is_still_allowed(app: Flask) -> None:
    """
    Only the escape prefix is refused. A plainly quoted identifier names what
    it says, so the denylist sees the real name and rejecting it would cost an
    owner a transform that works.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://u@h/d")

    with app.app_context():
        assert (
            stored_expression_error(database, None, None, 'lower("Mixed Case")') is None
        )


def test_the_escape_gate_reads_raw_text_and_says_so(app: Flask) -> None:
    """
    The prefix is refused wherever it appears, including inside a string
    literal -- the same trade the executable-comment gate makes, and for the
    same reason: a gate whose whole job is to fire before the parse cannot ask
    the parse whether the text is quoted. `concat(:value, 'u&"x"')` is refused,
    which costs an owner nothing anyone writes.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://u@h/d")

    with app.app_context():
        assert (
            stored_expression_error(database, None, None, "concat(:value, 'u&\"x\"')")
            is not None
        )


def test_a_plain_comment_is_still_allowed_through_the_shape_gates(
    app: Flask,
) -> None:
    """
    Only the executable form is refused. An ordinary comment is inert on every
    engine, so rejecting it would cost an owner a transform that works -- and
    the placeholder gate already covers the case that matters, a `:value` the
    comment swallows.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")

    with app.app_context():
        assert (
            stored_expression_error(database, None, None, "lower(:value) /* ok */")
            is None
        )


def test_a_transform_calling_a_disallowed_function_is_refused(app: Flask) -> None:
    """
    The probe executes the transform, so the operator's function denylist has
    to apply to it for the same reason it applies in SQL Lab.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    transform = "version() || :value"

    with app.app_context():
        original = app.config["DISALLOWED_SQL_FUNCTIONS"]
        try:
            app.config["DISALLOWED_SQL_FUNCTIONS"] = {"sqlite": {"version"}}
            reason = stored_expression_error(database, None, None, transform)
            assert reason is not None
            assert "version" in reason

            # Named, rather than echoing the operator's whole denylist back.
            assert "current_user" not in reason

            app.config["DISALLOWED_SQL_FUNCTIONS"] = {}
            assert stored_expression_error(database, None, None, transform) is None
        finally:
            # Restored: `app.config` is shared, and leaving it emptied silently
            # disabled this gate for every test that ran afterwards.
            app.config["DISALLOWED_SQL_FUNCTIONS"] = original


@pytest.mark.parametrize(
    "function",
    [
        "database_to_xml",
        "database_to_xmlschema",
        "database_to_xml_and_xmlschema",
        "schema_to_xml",
        "schema_to_xmlschema",
        "schema_to_xml_and_xmlschema",
        "table_to_xml",
        "table_to_xmlschema",
        "table_to_xml_and_xmlschema",
        "query_to_xml",
        "query_to_xmlschema",
        "query_to_xml_and_xmlschema",
    ],
)
def test_the_whole_postgres_xml_family_is_denied_by_default(function: str) -> None:
    """
    These read tables with no FROM clause and no sub-query, so every gate that
    reasons about table references is blind to them -- the denylist is the only
    thing that can refuse them, and it has to name each shape. `schema_to_xml`
    and three siblings were missing, so a bare scalar call cleared
    `stored_expression_error` entirely and returned connection-user-readable
    schema contents through preview.

    Asserted against the shipped default rather than through the gate, because
    the gap was an incomplete enumeration rather than broken wiring -- and
    because `app.config` is ambient here, which the behavioural test below
    handles by setting the denylist itself.
    """
    assert function in DISALLOWED_SQL_FUNCTIONS["postgresql"]


def test_a_denied_read_capable_function_is_refused_despite_having_no_from(
    app: Flask,
) -> None:
    """
    The wiring half: a bare scalar call passes the length, single-statement,
    bare-expression, sub-query and placeholder gates, so the denylist is what
    has to stop it.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://u@h/d")
    transform = "schema_to_xml('public', true, false, '') || :value"

    with app.app_context():
        original = app.config["DISALLOWED_SQL_FUNCTIONS"]
        app.config["DISALLOWED_SQL_FUNCTIONS"] = {"postgresql": {"schema_to_xml"}}
        try:
            reason = stored_expression_error(database, None, None, transform)
        finally:
            app.config["DISALLOWED_SQL_FUNCTIONS"] = original

    assert reason is not None
    assert "schema_to_xml" in reason


@pytest.mark.parametrize("function", ["ts_rewrite", "ts_stat"])
def test_the_postgres_full_text_query_functions_are_denied_by_default(
    function: str,
) -> None:
    """
    `ts_stat('select ...')` and `ts_rewrite(q, 'select ...')` run their *text*
    argument as a query. The query is a string, so these have the same blind
    spot the XML family above does: no FROM clause and no sub-query for a
    table-reference gate to reason about, which leaves the denylist as the only
    thing that can refuse them.
    """
    assert function in DISALLOWED_SQL_FUNCTIONS["postgresql"]


@pytest.mark.parametrize(
    "function",
    [
        "getxml",
        "getxmltype",
        "newcontext",
        "newcontextfromhierarchy",
        # No function argument to inspect at all: the table is named by the
        # path string handed to the constructor.
        "dburitype",
        # The same reader reached through its factory, and the sibling URI
        # types. Without a case each, deleting these three from `config.py`
        # left the suite green and reopened the factory path.
        "geturi",
        "xdburitype",
        "httpuritype",
    ],
)
def test_the_oracle_query_running_xml_functions_are_denied_by_default(
    function: str,
) -> None:
    """
    `DBMS_XMLGEN.GETXML('select secret from vault')` runs its text argument as
    a query -- the same blind spot as the PostgreSQL families above, on the
    engine both reviewers named. Listed bare because the package prefix never
    reaches the matcher: sqlglot parses the call as an anonymous function named
    `GETXML`, and `get_disallowed_functions` compares against that name.
    """
    assert function in DISALLOWED_SQL_FUNCTIONS["oracle"]


def test_a_package_qualified_denied_function_is_refused(app: Flask) -> None:
    """
    The wiring half for the bare-name listing above: the denylist entry has to
    match a call written with its package prefix, which is the only way anyone
    writes these.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="oracle://u@h/d")
    transform = "DBMS_XMLGEN.GETXML('select secret from vault') || :value"

    with app.app_context():
        reason = stored_expression_error(database, None, None, transform)

    assert reason is not None
    assert "getxml" in reason


def test_a_denied_query_running_text_function_is_refused(app: Flask) -> None:
    """
    The wiring half, and the only thing that proves the *name* matching works
    for these two: neither is a function sqlglot models, so each reaches
    `get_disallowed_functions` through its ANONYMOUS branch rather than as a
    typed node. A denylist entry that only matched modelled functions would
    pass the enumeration test above and still let these through.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://u@h/d")
    transform = "ts_stat('select 1') || :value"

    with app.app_context():
        original = app.config["DISALLOWED_SQL_FUNCTIONS"]
        app.config["DISALLOWED_SQL_FUNCTIONS"] = {"postgresql": {"ts_stat"}}
        try:
            reason = stored_expression_error(database, None, None, transform)
        finally:
            app.config["DISALLOWED_SQL_FUNCTIONS"] = original

    assert reason is not None
    assert "ts_stat" in reason


def test_the_function_denylist_is_keyed_on_the_engine_spec_name(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Every other denylist gate in the codebase keys on the engine spec's own
    name, which is also the name the config documentation tells an operator to
    write, so this one does too -- a spec covering several SQLAlchemy backends
    through `engine_aliases` reports the one canonical name under which its
    entry exists.

    Tested through an *aliased* engine, which is the only way to tell the two
    names apart. On `sqlite://` the backend and the spec name are both
    `"sqlite"`, so the assertion held whichever one the gate read, and the test
    did not check what its name promises. `postgres://` is
    `PostgresEngineSpec.engine_aliases`, so the URL's backend is `postgres`
    while the spec -- and the config key an operator writes -- is `postgresql`.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgres://u@h/d")

    with app.app_context():
        # The premise, asserted rather than assumed: if this alias ever goes
        # away, the test below stops discriminating and should say so here.
        assert database.backend == "postgres"
        assert database.db_engine_spec.engine == "postgresql"

        # Denied only under the spec's name. Keyed on `database.backend` the
        # gate would find no entry and let the call through.
        #
        # `monkeypatch`, because `app` is module-scoped: assigning to
        # `app.config` outlived the test and the next one to read the shipped
        # defaults -- `test_a_package_qualified_denied_function_is_refused` --
        # then found this stub and failed under any ordering that put it second.
        monkeypatch.setitem(
            app.config, "DISALLOWED_SQL_FUNCTIONS", {"postgresql": {"version"}}
        )
        reason = stored_expression_error(database, None, None, "version() || :value")

    assert reason is not None
    assert "version" in reason


def test_the_denylist_key_falls_back_when_the_engine_spec_cannot_load(
    app: Flask, monkeypatch: pytest.MonkeyPatch
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
        # `monkeypatch` for the same reason as the test above: `app` is
        # module-scoped, so a plain assignment leaks into every later test.
        monkeypatch.setitem(
            app.config, "DISALLOWED_SQL_FUNCTIONS", {"sqlite": {"version"}}
        )
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


def test_the_probe_cache_ignores_the_caller_without_a_per_user_connection(
    app: Flask,
) -> None:
    """
    The common case keeps its hit rate.

    The cache exists to keep a synchronous warehouse round trip off the
    chart-query path, so keying it on the username everywhere would cost every
    deployment the sharing that makes it worth having -- to fix the two hooks
    that actually make the connection per-user.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.id = 1

    with app.app_context():
        with override_user(_user("alice")):
            as_alice = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
        with override_user(_user("bob")):
            as_bob = _probe_cache_key(database, None, None, "lower(:value)", ["US"])

    assert as_alice == as_bob


def test_an_impersonating_connection_keys_the_probe_cache_per_caller(
    app: Flask,
) -> None:
    """
    With impersonation the warehouse runs the probe as the Superset user, so the
    values the transform returns are computed under *that* user's grants.
    Shared, the cache handed user B what the transform saw as user A, and the
    preview echoed it in `emitted_predicate` -- a cross-user read for a
    transform wrapping any read-capable function the denylist does not name.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.id = 1
    database.impersonate_user = True

    with app.app_context():
        with override_user(_user("alice")):
            as_alice = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
            alice_verdict = _mirror_verdict_cache_key(
                database, None, None, "lower(:value)"
            )
        with override_user(_user("bob")):
            as_bob = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
            bob_verdict = _mirror_verdict_cache_key(
                database, None, None, "lower(:value)"
            )

    assert as_alice != as_bob
    # The verdict too: a function one account may call can be refused to
    # another, so "this transform evaluates" is not a shared answer either.
    assert alice_verdict != bob_verdict


def test_a_connection_mutator_keys_the_probe_cache_per_caller(app: Flask) -> None:
    """
    `DB_CONNECTION_MUTATOR` receives the effective username and may return an
    entirely different account's URL, so it makes the connection per-user even
    with `impersonate_user` off -- which is why the gate checks both.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.id = 1

    with app.app_context():
        app.config["DB_CONNECTION_MUTATOR"] = lambda *args: args[:2]
        try:
            with override_user(_user("alice")):
                as_alice = _probe_cache_key(
                    database, None, None, "lower(:value)", ["US"]
                )
            with override_user(_user("bob")):
                as_bob = _probe_cache_key(database, None, None, "lower(:value)", ["US"])
        finally:
            app.config["DB_CONNECTION_MUTATOR"] = None

    assert as_alice != as_bob


# ---------------------------------------------------------------------------
# A probe result the partition column cannot hold
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        # Even plain ISO: comparing a temporal column against text is an
        # implicit coercion, and Trino has none while BigQuery coerces only a
        # canonical literal -- so on an engine Superset has not confirmed, this
        # declines rather than risking the whole chart.
        "2026-01-01",
        "2026-01-01 00:00:00",
        "2026-01-01T10:08:11",
        # The unseparated forms, same answer.
        "20260101",
        "20260706100811",
        # Ordinary text, which is the whole point.
        "us",
        "US",
        "",
        "x20260101",
        "202601",
        "1767225600",
        "1767225600000",
    ],
)
def test_an_undeclared_engine_reads_no_text_as_an_instant(value: str) -> None:
    """
    `_PROBE_RESULT_TYPES` admits `str` for a temporal partition column so a day
    key keeps working. It admitted every string, so `lower(:value)` answering
    `'us'` passed and the chart failed at the database instead.

    An earlier cut admitted extended ISO everywhere and only asked the spec
    about the unseparated forms. That is the hole: on Trino a monotonic
    `date_format(CAST(:value AS TIMESTAMP), '%Y-%m-%d')` probes to
    `'2026-01-15'`, and `part_date >= '2026-01-15'` errors there rather than
    losing the pruning.
    """
    assert _reads_as_temporal(value, BaseEngineSpec) is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        # PostgreSQL's date/time input reads both spellings, so the day key
        # this feature exists for mirrors there.
        ("2026-01-01", True),
        ("2026-01-01 00:00:00", True),
        ("2026-01-01T10:08:11", True),
        ("2026-01-01 10:08:11.123456", True),
        ("20260101", True),
        ("20260706100811", True),
        # Still not a date, declared formats or not. `strptime` accepts
        # unpadded fields, so a bare epoch parsed happily as `%Y%m%d%H%M%S`
        # (1767-02-25 06:00) and was emitted as a date literal -- the exact
        # bad-literal error this gate exists to stop. The round-trip rejects it.
        ("1767225600", False),
        ("1767225600000", False),
        ("202601", False),
        ("us", False),
    ],
)
def test_an_engine_that_reads_a_day_key_says_so(value: str, expected: bool) -> None:
    """
    Which text reads as an instant is the engine's answer, declared in
    `temporal_literal_formats`.
    """
    assert _reads_as_temporal(value, PostgresEngineSpec) is expected


@pytest.mark.parametrize(
    ("module", "spec_name"),
    [
        # Inherit `PostgresBaseEngineSpec`, so declaring the formats there
        # handed them Postgres's date input. Snowflake's AUTO input does not
        # take `YYYYMMDD` and reads an all-digit string as epoch seconds.
        ("snowflake", "SnowflakeEngineSpec"),
        ("vertica", "VerticaEngineSpec"),
        ("hana", "HanaEngineSpec"),
        ("netezza", "NetezzaEngineSpec"),
        ("hologres", "HologresEngineSpec"),
        # And the engines the reviewer named as failing the query outright.
        ("trino", "TrinoEngineSpec"),
        ("bigquery", "BigQueryEngineSpec"),
    ],
)
def test_a_postgres_relative_does_not_inherit_the_day_key(
    module: str, spec_name: str
) -> None:
    """
    The declaration lives on the concrete `PostgresEngineSpec` and
    `RedshiftEngineSpec`, not on the base class seven other specs extend.
    """
    spec = getattr(import_module(f"superset.db_engine_specs.{module}"), spec_name)
    assert spec.temporal_literal_formats == ()


def test_redshift_shares_the_postgres_day_key() -> None:
    """Redshift shares PostgreSQL's date/time input, and names it itself."""
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    assert RedshiftEngineSpec.temporal_literal_formats == (
        PostgresEngineSpec.temporal_literal_formats
    )


def test_the_base_spec_claims_no_day_key_format() -> None:
    """
    Default closed: an engine that has not said it reads a day key declines
    the mirror, which costs the pruning rather than the query.
    """
    assert BaseEngineSpec.temporal_literal_formats == ()


def test_a_type_mismatch_does_not_poison_the_shared_transform_verdict(
    app: Flask,
) -> None:
    """
    The decline is about *this* dataset's partition column, and
    `_mirror_verdict_cache_key` holds no partition column -- only database,
    catalog, schema and transform.

    Recorded there, a dataset-specific outcome answered for every other dataset
    sharing the transform: `cast(:value as text)` mirroring happily onto a text
    key in dataset A was reported `evaluable: false`, and its pruning indicator
    hidden, because an owner previewed the same transform against a numeric key
    in dataset B. A probe cache hit on A never rewrites the verdict, so A
    stayed wrong until the entry expired.

    `evaluate_transform` is patched out here, so it records no verdict of its
    own and anything left in the cache can only have come from the branch under
    test. `real_probe_cache` is autouse in this module, so `None` is a real
    reading rather than what a null cache returns for everything.
    """
    table = _mapped_table(transform="cast(:value as text)")
    mapping = resolve_partition_mapping(table)
    assert mapping is not None

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.evaluate_transform",
            return_value=["2026-01-01 00:00:00"],
        ):
            predicates = build_mirrored_predicates(
                table, mapping, [(FilterOperator.EQUALS, "2026-01-01")]
            )

        # `dt_epoch` is a BIGINT and the transform answered with text, so the
        # mirror is declined -- that part is `probed_value_type_error`'s job.
        assert predicates == []
        # And nothing was written to the verdict every other dataset reads.
        # Before this, the branch above recorded `mirrors=False` here.
        assert (
            known_mirror_verdict(table.database, None, None, "cast(:value as text)")
            is None
        )


def _text_mapped_table(backend: str, transform: str) -> SqlaTable:
    """
    A text key mirrored from a text column, on ``backend``.

    The module's own fixture maps a timestamp onto a `BIGINT`, where no probe
    result can carry a quote or a backslash at all. These tests are about what
    the probe *answers*, so both ends have to be text.

    Callers name the driver (``hive+hive://``) rather than leaving it to be
    discovered. `Database.get_db_engine_spec` asks the URL for its driver name,
    and SQLAlchemy answers that by importing the dialect entrypoint unless the
    URL spells the driver out -- so a bare ``hive://`` drags in `pyhive`, which
    imports `TCLIService`, which imports `thrift`. CI installs the first two and
    not the third, and `get_db_engine_spec` rescues only `NoSuchModuleError`, so
    the `ModuleNotFoundError` came out of the fixture. Naming the driver skips
    the import entirely and leaves `backend` as ``hive``, which is all these
    tests need: it is the sqlglot dialect `literal_round_trips` parses the
    rendered literal with.
    """
    table = _mapped_table(
        partition_column="region_key",
        mapped_column="country",
        partition_mapped_column="country",
        transform=transform,
        monotonic=False,
    )
    table.database = Database(database_name="probe_db", sqlalchemy_uri=backend)
    return table


def test_a_probe_result_the_engine_reads_back_differently_is_not_mirrored(
    app: Flask,
) -> None:
    """
    The other end of the round trip `evaluate_transform` makes on the way in.

    The chart query is compiled with ``literal_binds``, so the probed key is
    rendered into it by the same renderer and read by the same lexer -- and
    `concat(:value, chr(92), 'b')` turns the unremarkable input `US` into the key
    `us\\b`, which Hive reads back as `us` followed by a backspace. Emitted, the
    mirror asks for a partition no row is in, and because it is ANDed onto the
    query the chart loses every row the filter keeps rather than losing its
    pruning.

    No verdict is recorded, for the reason the type mismatch above gives: the
    probe succeeded, and this is a property of one of its answers.
    """
    table = _text_mapped_table(
        "hive+hive://localhost:10000/default", "concat(lower(:value), chr(92), 'b')"
    )
    mapping = resolve_partition_mapping(table)
    assert mapping is not None

    escaping_errors: list[str] = []
    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.evaluate_transform",
            return_value=["us\\b"],
        ):
            predicates = build_mirrored_predicates(
                table,
                mapping,
                [(FilterOperator.EQUALS, "US")],
                escaping_errors=escaping_errors,
            )

    assert predicates == []
    assert escaping_errors
    assert (
        known_mirror_verdict(table.database, None, None, mapping.value_transform)
        is None
    )


def test_the_same_probe_result_still_mirrors_where_the_engine_agrees(
    app: Flask,
) -> None:
    """
    Not a blanket refusal of the character: SQLite's renderer and lexer spell a
    backslash the same way, so the key it answered with is asked for as it
    stands.
    """
    table = _text_mapped_table("sqlite://", "concat(lower(:value), char(92), 'b')")
    mapping = resolve_partition_mapping(table)
    assert mapping is not None

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.evaluate_transform",
            return_value=["us\\b"],
        ):
            predicates = build_mirrored_predicates(
                table, mapping, [(FilterOperator.EQUALS, "US")]
            )

    assert len(predicates) == 1
    assert "us\\b" in _render_predicate(table, predicates[0])


def test_one_unspellable_answer_costs_only_its_own_request(app: Flask) -> None:
    """
    Per request, not per query. A range arrives as two requests, and keeping
    only the bound whose key survives the trip leaves a mirror *wider* than the
    filter, which is all a mirror has to be -- so declining the whole query
    would cost the other filters their pruning for nothing.
    """
    table = _text_mapped_table(
        "hive+hive://localhost:10000/default", "concat(lower(:value), chr(92), 'b')"
    )
    mapping = resolve_partition_mapping(table)
    assert mapping is not None

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.evaluate_transform",
            return_value=["us\\b", "ca"],
        ):
            predicates = build_mirrored_predicates(
                table,
                mapping,
                [
                    (FilterOperator.EQUALS, "US"),
                    (FilterOperator.EQUALS, "CA"),
                ],
            )

    assert len(predicates) == 1
    rendered = _render_predicate(table, predicates[0])
    assert "'ca'" in rendered
    assert "\\b" not in rendered


def test_one_unspellable_answer_declines_the_whole_in_list(app: Flask) -> None:
    """
    As for a `None` answer: mirroring the members that survive would be
    *narrower* than the `IN` the chart carries, and would drop rows it keeps.
    """
    table = _text_mapped_table(
        "hive+hive://localhost:10000/default", "concat(lower(:value), chr(92), 'b')"
    )
    mapping = resolve_partition_mapping(table)
    assert mapping is not None

    with app.app_context():
        with patch(
            "superset.connectors.sqla.partition_mapping.evaluate_transform",
            return_value=["us\\b", "ca"],
        ):
            predicates = build_mirrored_predicates(
                table, mapping, [(FilterOperator.IN, ["US", "CA"])]
            )

    assert predicates == []


def _partition_column(column_type: str, **kwargs: Any) -> TableColumn:
    column = TableColumn(column_name="dt_epoch", type=column_type, **kwargs)
    column.table = SqlaTable(
        table_name="web_events",
        database=Database(database_name="probe_db", sqlalchemy_uri="sqlite://"),
    )
    return column


@pytest.mark.parametrize(
    "column_type, value, mismatched",
    [
        ("BIGINT", 1767225600, False),
        ("BIGINT", 1767225600.0, False),
        # Postgres answers `extract(epoch from ...)` -- the commonest transform
        # this feature has -- with a `Decimal`, and a driver is free to pick any
        # number type it likes. Rejecting one would cost the feature its main
        # use case on Postgres for nothing.
        ("BIGINT", Decimal("1767225600.000000"), False),
        ("BIGINT", "2026-01-01 00:00:00x", True),
        # `bool` satisfies `isinstance(x, int)` and renders as `true`, which is
        # not a number to any engine that cares about the difference.
        ("BIGINT", True, True),
        ("VARCHAR", "20260101", False),
        # Not every engine takes a number in a text comparison: Postgres,
        # Trino and BigQuery all refuse it outright, and SQLite silently
        # compares it as never equal, which drops every row the filter keeps.
        ("VARCHAR", 20260101, True),
        # And a `Decimal`, which is what Postgres answers `extract(epoch
        # from ...)` with -- a gate written against `(int, float)` has slipped
        # through here once already.
        ("VARCHAR", Decimal("20260101"), True),
        ("VARCHAR", 20260101.0, True),
        ("BOOLEAN", True, False),
        ("BOOLEAN", 1, True),
        ("TIMESTAMP", datetime(2026, 1, 1), False),
        # A `to_char` day key is legitimately text, but only where the engine
        # reads it: this fixture's database is SQLite, which declares nothing,
        # so the mirror declines and the query keeps working. The declared case
        # is `test_an_engine_that_reads_a_day_key_says_so`.
        ("TIMESTAMP", "2026-01-01", True),
        ("TIMESTAMP", 1767225600, True),
    ],
)
def test_a_probe_result_is_judged_against_the_partition_column(
    column_type: str, value: Any, mismatched: bool
) -> None:
    """
    `cast(:value as text) || 'x'` evaluates fine, and two of its results
    compare, so neither the probe nor the ordering backstop sees anything
    wrong. The engine is the first thing to object, and it objects by failing
    the whole chart -- so the mismatch has to be caught while declining still
    costs only the pruning.
    """
    error = probed_value_type_error(_partition_column(column_type), [value])

    assert (error is not None) is mismatched
    if mismatched:
        assert error is not None
        assert "dt_epoch" in error


def test_a_numeric_partition_column_flagged_temporal_takes_a_number() -> None:
    """
    A `BIGINT` partition key bucketed by `python_date_format = epoch_s` is
    temporal to `TableColumn.type_generic` and a number to the engine. The gate
    is about the comparison, so it asks the engine spec: an epoch transform's
    integer is held, where the semantic flag refused it and cost a working
    mapping its mirror.
    """
    column = _partition_column("BIGINT", is_dttm=True, python_date_format="epoch_s")

    assert column.type_generic == GenericDataType.TEMPORAL
    assert probed_value_type_error(column, [1767225600]) is None


def test_a_timestamp_column_still_refuses_a_number() -> None:
    """
    The fallback is per-column, not blanket: a real `TIMESTAMP` resolves to
    `TEMPORAL` through the engine spec too, so it keeps refusing the epoch a
    transform returns for it.
    """
    column = _partition_column("TIMESTAMP", is_dttm=True)

    assert probed_value_type_error(column, [1767225600]) is not None


def test_a_column_whose_type_says_nothing_is_left_alone() -> None:
    """
    Fails open wherever there is nothing to check against, which is the same
    answer every other gate in this module gives to missing information.
    """
    assert probed_value_type_error(_partition_column(""), ["anything"]) is None


def test_a_null_probe_result_is_not_a_type_mismatch() -> None:
    """The caller skips those requests on its own; see `build_mirrored_predicates`."""
    assert probed_value_type_error(_partition_column("BIGINT"), [None]) is None


def test_one_bad_member_condemns_the_list() -> None:
    """An `IN` is one predicate, so one unusable member breaks all of it."""
    error = probed_value_type_error(_partition_column("BIGINT"), [1, "x"])

    assert error is not None
    assert "'x'" in error


# ---------------------------------------------------------------------------
# The advisory verdict the UI reads
# ---------------------------------------------------------------------------


def test_nothing_is_claimed_before_anything_has_probed(app: Flask) -> None:
    """
    `None`, not `False`: a mapping nobody has run a chart on yet is not broken,
    and reporting it so would trade one wrong claim for another.
    """
    database = _database_returning([1])

    with app.app_context():
        assert (
            known_mirror_verdict(database, None, None, "unix_timestamp(:value)") is None
        )


def test_a_successful_probe_records_that_the_mapping_mirrors(app: Flask) -> None:
    database = _database_returning([1767225600])

    with app.app_context():
        evaluate_transform(
            database, None, None, "unix_timestamp(:value)", ["2026-01-01"]
        )

        assert (
            known_mirror_verdict(database, None, None, "unix_timestamp(:value)") is True
        )


def test_a_failed_probe_records_that_it_does_not_mirror(app: Flask) -> None:
    """
    The fact the editor's banner and Explore's glyph need and had nowhere to
    read: a misspelled function parses happily, so `is_transform_active` calls
    the transform active and both surfaces promise a speed-up the query path
    then silently gives up.

    Recorded even though the probe *result* deliberately is not -- see
    `record_mirror_verdict`. Withholding a promise on one bad answer is not the
    same trade as withholding the pruning itself.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("function no_such_fn(unknown) does not exist")
    )

    with app.app_context():
        evaluate_transform(database, None, None, "no_such_fn(:value)", ["2026-01-01"])

        assert known_mirror_verdict(database, None, None, "no_such_fn(:value)") is False


def test_a_probe_that_returns_null_leaves_the_verdict_alone(app: Flask) -> None:
    """
    A `NULL` is this input's answer, not the transform's. The verdict is keyed
    without the values -- see the test below -- so recording one input's `NULL`
    against the whole transform is the same category error the type-mismatch
    decline already avoids.

    The filter itself still gets no mirror: that is the caller's own `NULL`
    guard, which is per request and where it belongs.
    """
    database = _database_returning([None])

    with app.app_context():
        evaluate_transform(database, None, None, "lower(:value)", ["x"])

        assert known_mirror_verdict(database, None, None, "lower(:value)") is True


def test_a_null_for_one_input_does_not_outlive_itself(app: Flask) -> None:
    """
    The reason it matters that a `NULL` is not a withdrawal: a *failed* probe
    is deliberately not cached, so the next chart re-probes and re-records --
    but a `NULL` is a successful probe and is cached, so the false verdict
    outlived every later hit.

    `NULLIF(:value, 0)` is the shape: `n = 2` probes to 2, `n = 0` probes to
    `NULL`, and `n = 2` again is served from cache. Explore hid the glyph and
    the editor said filters were not mirrored while the query went on pruning.
    """
    transform = "NULLIF(:value, 0)"
    database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")

    def answer(sql: str, **kwargs: Any) -> pd.DataFrame:
        """`NULLIF('0', 0)` is NULL; `NULLIF('2', 0)` is 2."""
        value = None if "'0'" in sql else 2
        return pd.DataFrame([[value]], columns=["v0"])

    database.get_df = MagicMock(side_effect=answer)  # type: ignore[method-assign]

    with app.app_context():
        assert evaluate_transform(database, None, None, transform, ["2"]) == [2]
        assert known_mirror_verdict(database, None, None, transform) is True

        # The input that answers NULL.
        assert evaluate_transform(database, None, None, transform, ["0"]) == [None]

        # ...and the first input again, now served from the probe cache.
        assert evaluate_transform(database, None, None, transform, ["2"]) == [2]
        assert known_mirror_verdict(database, None, None, transform) is True


def test_one_filter_s_verdict_answers_for_the_next(app: Flask) -> None:
    """
    Whether a transform evaluates is a property of the transform and the
    connection, not of the value that happened to be probing it, so the verdict
    is keyed without the values -- one chart settles it for every other.
    """
    database = _database_returning([1])

    with app.app_context():
        evaluate_transform(database, None, None, "lower(:value)", ["us"])

        assert known_mirror_verdict(database, None, None, "lower(:value)") is True


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


# ---------------------------------------------------------------------------
# A placeholder the engine never evaluates
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("engine", ["sqlite", "postgresql", "hive", "snowflake"])
@pytest.mark.parametrize(
    "transform, executable",
    [
        ("unix_timestamp(:value)", True),
        ("CAST(:value AS BIGINT)", True),
        ("lower(:value)", True),
        (":value", True),
        ("concat(:value, :value)", True),
        ("date_format(:value, '%Y%m%d')", True),
        ("':value'", False),
        ("concat(':value', :value)", False),
        ("1 -- :value", False),
        ("1 /* :value */", False),
        ("lower(x)", False),
        (None, False),
        # The stand-in written by hand. It supplies the bare column reference a
        # placeholder inside a literal failed to produce, so the counts cancel
        # and the gate used to pass a `:value` the engine never evaluates.
        ("concat(superset_pfm_value_standin, ':value')", False),
        ("SUPERSET_PFM_VALUE_STANDIN || ':value'", False),
        # Refused even alongside a placeholder that *is* executable: there is no
        # legitimate transform naming this identifier at all.
        ("concat(superset_pfm_value_standin, :value)", False),
    ],
)
def test_a_placeholder_is_executable_only_where_the_engine_reads_it(
    transform: str | None, executable: bool, engine: str
) -> None:
    """
    `contains_value_placeholder` is a regex, and `parse_skeleton` substitutes
    before anything parses, so neither can say *where* the placeholder landed.
    This can: an identifier stand-in leaves a column reference behind, and a
    stand-in that fell inside a string literal or a comment leaves none.

    `concat(':value', :value)` is the mixed case -- one occurrence is
    executable and one is not, so the count disagrees and it is refused.
    `lower(x)` has no placeholder at all, which is a separate (Tier 2) matter
    `validate_transform` reports before reaching this.
    """
    assert placeholder_is_executable(transform, engine) is executable


@pytest.mark.parametrize(
    "transform",
    ["':value'", "concat(':value', 'x')", "1 -- :value", "1 /* :value */"],
    ids=["quoted", "quoted-in-call", "line-comment", "block-comment"],
)
def test_validate_transform_blocks_a_placeholder_the_engine_will_not_read(
    transform: str,
) -> None:
    """
    Blocking, not Tier 2. An inactive mapping is the right answer for a
    transform that is merely wrong; these two are a sub-query waiting for a
    filter value to close the quote, and a comment that eats the probe's own
    alias and makes it answer with a constant.
    """
    issues = validate_transform(transform, "sqlite")

    assert len(issues) == 1
    assert issues[0].blocking is True
    assert issues[0].field == "partition_value_transform"
    assert ":value" in issues[0].message


def test_a_quoted_placeholder_really_does_compile_into_a_subquery() -> None:
    """
    The reason the check above is blocking rather than cosmetic.

    `sa.text`'s bind scan has no notion of SQL string literals, so the
    placeholder inside the owner's quotes is bound regardless, and the String
    literal processor renders the bind *with its own quotes*. A sample that
    opens and closes with `||` therefore concatenates whatever it likes between
    them -- here a sub-query, which is exactly what `stored_expression_error`
    refuses when it is written in the open.
    """
    sql = build_probe_sql(
        "':value'",
        [" || (SELECT secret FROM vault LIMIT 1) || "],
    )

    assert "(SELECT secret FROM vault LIMIT 1)" in sql
    # ...and the backstop declines to run it.
    assert probe_sql_is_evaluable(sql, "sqlite", 1) is False


def test_a_commented_placeholder_loses_the_alias_the_probe_reads_by() -> None:
    """
    The other half. `build_probe_sql` joins its selections with `", "` on one
    line, so a comment swallows its own `AS v0` and every selection after it.
    With one distinct value the engine still answers with one column, so the
    probe's column-count guard is satisfied and the constant in front of the
    comment is accepted as the transform's result -- the mirror then asks for
    that constant whatever the filter value was.
    """
    sql = build_probe_sql("1 -- :value", ["2026-01-15"])

    assert "AS v0" in sql  # the alias is *there*, but after the comment marker
    assert sql.index("--") < sql.index("AS v0")
    assert probe_sql_is_evaluable(sql, "sqlite", 1) is False


def test_a_hand_written_standin_cannot_cancel_the_placeholder_count() -> None:
    """
    The count gate is two-sided, and a transform that writes the stand-in itself
    pays the difference. `concat(superset_pfm_value_standin, ':value')` has one
    `:value`, inside a literal that yields no column reference, and one bare
    reference the owner wrote -- so the counts matched and the gate passed a
    placeholder the engine never evaluates.

    Which mattered because the probe then renders the bound value inside the
    owner's quotes: a value closing that literal aliases a column of any table
    the connection can read into the stand-in's own name, and the probe hands it
    back through the preview's emitted predicate. A dataset-write principal
    without SQL Lab could read the warehouse that way.

    Both halves are pinned here because each is independently sufficient, and
    the compiled probe used to satisfy every check it had: one statement, no
    sub-query, and `v0` as its only alias.
    """
    transform = "concat(superset_pfm_value_standin, ':value')"

    # The write-side gate, which is what keeps the transform from ever activating.
    assert placeholder_is_executable(transform, "postgresql") is False
    assert validate_transform(transform, "postgresql") != []

    # And the probe-side backstop, for a transform stored before that gate
    # existed: the smuggled FROM is not the one the engine asked for.
    sql = build_probe_sql(
        transform,
        [") AS v0 FROM private.secrets AS p(superset_pfm_value_standin) -- "],
    )
    assert "FROM private.secrets" in sql
    assert probe_sql_is_evaluable(sql, "postgresql", 1, "") is False


@pytest.mark.parametrize(
    "sql, expected, suffix, evaluable",
    [
        ("SELECT lower('a') AS v0", 1, "", True),
        ("SELECT lower('a') AS v0, lower('b') AS v1", 2, "", True),
        # `select_without_from_suffix`, for an engine that cannot select bare:
        # accepted where the engine asked for that FROM...
        ("SELECT lower('a') AS v0 FROM DUAL", 1, " FROM DUAL", True),
        (
            "SELECT lower('a') AS v0 FROM SYSIBM.SYSDUMMY1",
            1,
            " FROM SYSIBM.SYSDUMMY1",
            True,
        ),
        # Spacing need not match; sqlglot renders both sides.
        ("SELECT lower('a') AS v0 FROM DUAL", 1, "   from DUAL", True),
        # ...and refused where it did not, or where the table is not the one it
        # named. A rendered value can close the projection and append a FROM of
        # its own without disturbing the aliases that follow.
        ("SELECT lower('a') AS v0 FROM DUAL", 1, "", False),
        ("SELECT lower('a') AS v0 FROM private.secrets", 1, " FROM DUAL", False),
        # A WHERE is not a clause this gate's caller ever builds either.
        ("SELECT lower('a') AS v0 WHERE 1 = 1", 1, "", False),
        ("SELECT '' || (SELECT secret FROM vault) || '' AS v0", 1, "", False),
        ("SELECT 1 -- 'x' AS v0", 1, "", False),
        ("SELECT 1 AS v0; DROP TABLE t", 1, "", False),
        ("SELECT lower('a') AS v0", 2, "", False),
        ("SELECT lower('a')", 1, "", False),
        ("not sql at all (", 1, "", False),
    ],
)
def test_the_probe_backstop_accepts_only_a_plain_projection_per_value(
    sql: str, expected: int, suffix: str, evaluable: bool
) -> None:
    """
    The write-side gates all read the transform with a stand-in where the value
    goes, so an escape that needs a real value to complete is invisible to them
    -- and the values come from whoever is filtering the chart, not only from
    the owner who wrote the transform. This is the gate that sees the finished
    query.

    A FROM clause is allowed only where `select_without_from_suffix` asked for
    one, and only the one it named: Oracle and Db2 cannot select bare, which is
    not a reason to let a value smuggle in a table of its own. Compared as
    sqlglot renders both sides, so the suffix's own spacing does not have to
    match what the probe emitted. Identifier case does: sqlglot preserves it,
    and `_probe` hands the same constant to the builder and to this gate.
    """
    assert probe_sql_is_evaluable(sql, "sqlite", expected, suffix) is evaluable


def test_a_backslash_escaped_quote_really_does_break_out_of_the_probe_literal() -> None:
    """
    Why `literal_round_trips` exists, in the shape of the escape it was written
    for.

    SQLAlchemy's default literal processor doubles apostrophes and leaves
    backslashes alone. Hive and Spark read it the other way round, so a value
    of ``x\\'`` ends its own literal four characters in: everything after it is
    SQL, the value supplies the ``AS v0`` the gate looks for, and ``--`` hides
    the one `build_probe_sql` appended. The probe then evaluates an expression
    of the filterer's choosing and hands the answer back in the mirrored
    predicate -- reachable by anyone who can filter a chart.

    Both halves are pinned because each is independently sufficient: the value
    never reaches the probe (`literal_round_trips`), and the compiled statement
    would be refused if it did (`probe_sql_is_evaluable`, on the comment).
    """
    payload = 'x\\\' || reflect("java.lang.System","getenv","HOME") AS v0 --'
    sql = build_probe_sql(":value", [payload])

    # Where the renderer and the lexer agree, that same compiled text is one
    # literal holding the value, whole, and the probe is harmless.
    assert SQLStatement(sql, "sqlite").get_select_literal_value() == payload
    # Where they do not, the literal ends four characters in: the projection is
    # no longer a literal at all, and the alias the builder appended is inside
    # the comment the value opened.
    assert SQLStatement(sql, "hive").get_select_literal_value() is None
    assert SQLStatement(sql, "hive").has_comment() is True

    assert literal_round_trips(payload, None, "hive") is False
    assert probe_sql_is_evaluable(sql, "hive", 1) is False


@pytest.mark.parametrize(
    ("engine", "dialect", "value", "faithful"),
    [
        # Hive and Spark honour the backslash and not the doubling, so both of
        # the characters that can end a literal early are ambiguous there.
        ("hive", None, "plain", True),
        ("hive", None, "O'Brien", False),
        ("hive", None, "a\\b", False),
        ("spark", None, "O'Brien", False),
        # Postgres agrees about the apostrophe. It does not agree about the
        # backslash: SQLAlchemy only learns whether the server honours one in
        # `initialize(connection)`, which the probe's dialect never reaches, so
        # it renders `a\b` as `'a\\b'` and a server with the standard setting
        # reads four characters.
        ("postgresql", postgresql.dialect(), "O'Brien", True),
        ("postgresql", postgresql.dialect(), "a\\b", False),
        # And where the two agree, nothing is declined -- this is not a blanket
        # refusal of either character.
        ("mysql", mysql.dialect(), "O'Brien", True),
        ("mysql", mysql.dialect(), "a\\b", True),
        ("sqlite", None, "O'Brien", True),
        ("sqlite", None, "a\\b", True),
        # Nor of anything else that merely looks like syntax.
        ("hive", None, 'a"b', True),
        ("hive", None, "a--b", True),
        ("hive", None, "a\nb", True),
        # A number is not written between delimiters at all.
        ("hive", None, 42, True),
    ],
)
def test_a_literal_the_engine_reads_back_differently_is_not_mirrored(
    engine: str, dialect: Any, value: Any, faithful: bool
) -> None:
    """
    The rule, stated as the verdict per renderer-and-lexer pair.

    Verified rather than escaped: which spelling the engine honours is a
    per-session server setting no engine spec exposes, so an escape would have
    to guess, and a wrong guess either leaves the hole open or probes a value
    nobody filtered on. Rendering the literal and reading it back answers the
    question that actually matters, and the answer is only ever used to
    decline.
    """
    assert literal_round_trips(value, dialect, engine) is faithful


def test_a_comment_in_the_compiled_probe_is_refused() -> None:
    """
    The value-blind half, which is what makes the alias check sufficient rather
    than merely necessary: a value that closes its own quote has to hide the
    text appended after it, and a comment is the only way to do that and still
    balance the quotes.

    Read off the parse, so a comment *inside* a literal is data and costs no
    pruning.
    """
    assert probe_sql_is_evaluable("SELECT lower('a') AS v0", "sqlite", 1) is True
    assert (
        probe_sql_is_evaluable("SELECT lower('a') AS v0 /* note */", "sqlite", 1)
        is False
    )
    assert probe_sql_is_evaluable("SELECT lower('a--b') AS v0", "sqlite", 1) is True


def test_a_value_the_dialect_cannot_write_faithfully_is_never_probed(
    app: Flask,
) -> None:
    """
    The backstop, above `_run_probe` on purpose.

    `ExploreMixin.mirror_probe_request` declines such a value earlier with a
    reason the preview explains, but it is not the only door into the probe:
    a range's bounds are collected without passing through it, and on a
    formatted column what is probed is `strftime(python_date_format)` -- text
    no mapping gate has read.

    And no verdict is recorded. This is a property of one input, so withdrawing
    the mirror for the whole transform would report a working mapping as broken
    for every later value, the way a `NULL` result once did.
    """
    database = Database(
        database_name="probe_db", sqlalchemy_uri="hive+hive://localhost:10000/default"
    )
    database.get_df = MagicMock()  # type: ignore[method-assign]

    with app.app_context():
        assert (
            evaluate_transform(database, None, None, "lower(:value)", ["O'Brien"])
            is None
        )
        assert known_mirror_verdict(database, None, None, "lower(:value)") is None

    cast(MagicMock, database.get_df).assert_not_called()


@pytest.mark.parametrize(
    "transform",
    [
        # Advances a sequence. One function call, no clause, no sub-query, and
        # absent from the shipped `DISALLOWED_SQL_FUNCTIONS` -- so every other
        # gate in `stored_expression_error` passes it.
        "nextval(:value)",
        "setval('s', :value)",
        # Also caught by the shipped denylist, which is config an operator can
        # replace; this gate is not.
        "lo_export(:value, '/tmp/x')",
    ],
)
def test_a_transform_that_changes_data_is_refused(app: Flask, transform: str) -> None:
    """
    Shape is not effect. The gates around this one ask what the transform
    *selects*; a bare scalar expression can still write, and the probe then
    runs it -- on a cache schedule, so the write repeats every time the entry
    expires, with no SQL Lab access needed and nothing on screen to say so.

    `is_mutating` is the question SQL Lab and the chart executor already ask
    before letting SQL run, so the transform is held to the bar the rest of
    Superset sets rather than to one invented here.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://")

    with app.app_context():
        original = app.config["DISALLOWED_SQL_FUNCTIONS"]
        try:
            # Emptied so the verdict is this gate's and not the denylist's --
            # `lo_export` is on both, and the point is that it does not need to
            # be.
            app.config["DISALLOWED_SQL_FUNCTIONS"] = {}
            reason = stored_expression_error(database, None, None, transform)
        finally:
            app.config["DISALLOWED_SQL_FUNCTIONS"] = original

    assert reason is not None
    assert "cannot change data" in reason


@pytest.mark.parametrize(
    ("backend", "transform"),
    [
        # The suffix form, which parses as a qualified column.
        ("oracle", "orders_seq.NEXTVAL + :value"),
        ("oracle", "orders_seq.CURRVAL + :value"),
        ("oracle", "ORDERS_SEQ.nextval + :value"),
        ("oracle", 'lower("Schema"."Seq".NEXTVAL || :value)'),
        # And the call, which parses as a function. `is_mutating` walks
        # function names on PostgreSQL alone, so every other engine let these
        # through -- the suffix check cannot see them either.
        ("postgresql", "nextval('s') + :value"),
        ("duckdb", "nextval('s') + :value"),
        ("mysql", "NEXTVAL(s) + :value"),
        ("mysql", "SETVAL(s, 1) + :value"),
        ("mssql", "NEXT VALUE FOR s + :value"),
    ],
)
def test_a_transform_reading_a_sequence_is_refused(
    app: Flask, backend: str, transform: str
) -> None:
    """
    The gate above walks *function* names, and `orders_seq.NEXTVAL` is a
    qualified **column** reference to the parser -- so it passed every shape
    check, the denylist included, while advancing the sequence each time the
    probe ran. On a cache schedule, from a dataset editor holding neither SQL
    Lab nor a DML grant.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri=f"{backend}://u@h/d")

    with app.app_context():
        reason = stored_expression_error(database, None, None, transform)

    assert reason is not None
    # Either gate is a pass: on PostgreSQL `is_mutating` already walks
    # function names and answers first with "cannot change data". What matters
    # is that no spelling reaches the probe.
    assert "cannot read a sequence" in reason or "cannot change data" in reason


def test_a_column_merely_named_like_a_sequence_is_not_refused(app: Flask) -> None:
    """
    The premise of asking the parse rather than the raw text: the construct is
    the name *in column position*, so a string literal holding the word, or a
    mapped column called `nextval_count`, is ordinary.
    """
    database = Database(database_name="probe_db", sqlalchemy_uri="oracle://u@h/d")

    with app.app_context():
        assert (
            stored_expression_error(database, None, None, "lower(:value) || 'nextval'")
            is None
        )
        assert (
            stored_expression_error(database, None, None, "nextval_count + :value")
            is None
        )


@pytest.mark.parametrize(
    "transform",
    [
        "unix_timestamp(:value)",
        ":value::bigint",
        "lower(:value)",
        "to_char(:value, 'YYYYMMDD')",
    ],
)
def test_an_ordinary_transform_still_reads(app: Flask, transform: str) -> None:
    """The read-only gate must not cost the canonical mappings."""
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://")

    with app.app_context():
        assert stored_expression_error(database, None, None, transform) is None


def test_a_transform_that_changes_data_stops_the_probe_before_the_engine(
    app: Flask,
) -> None:
    """
    The gate above is the save path. This is the row an earlier release stored,
    or one an operator's own denylist let through: `_probe` consults
    `stored_expression_error` on every call, so it never reaches `get_df`.
    """
    # PostgreSQL rather than the sibling helper's SQLite, because
    # `is_mutating`'s function-name walk is dialect-gated -- the same names are
    # read-only on other engines. `get_df` is stubbed, so nothing connects.
    database = Database(database_name="probe_db", sqlalchemy_uri="postgresql://")
    database.get_df = MagicMock(  # type: ignore[method-assign]
        return_value=pd.DataFrame([["x"]], columns=["v0"])
    )

    with app.app_context():
        assert (
            evaluate_transform(database, None, None, "nextval(:value)", ["US"]) is None
        )

    assert _probe(database).call_count == 0


def test_an_incoming_transform_on_a_non_mapped_column_is_dropped() -> None:
    """
    NEW-R11-01. The mapping mirrors one column, so only that column may carry a
    transform; one parked anywhere else is invisible -- no row but the mapped
    one renders a transform -- and goes live the moment the mapped column
    resolves back to it.

    `DatasetDAO.clear_unmapped_partition_transforms` answers for the model, but
    it is gated on the feature flag because it discards stored configuration.
    This answers for the payload, which is how the leftover arrives.
    """
    columns = [
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        },
        {
            "column_name": "other_time",
            "partition_value_transform": "to_unixtime(:value)",
            "partition_transform_is_monotonic": True,
        },
    ]

    cleared = drop_unmapped_value_transforms(
        columns,
        partition_column="dt_epoch",
        partition_mapped_column=None,
        main_dttm_col="event_time",
    )

    assert cleared == ["other_time"]
    # The mapped column keeps what the owner wrote for it.
    assert columns[0]["partition_value_transform"] == "unix_timestamp(:value)"
    assert columns[0]["partition_transform_is_monotonic"] is True
    assert columns[1]["partition_value_transform"] is None
    assert columns[1]["partition_transform_is_monotonic"] is False


def test_an_override_decides_which_incoming_transform_survives() -> None:
    """
    The mapped column is `partition_mapped_column or main_dttm_col`, so the
    override moves which column may hold one -- and both can be part of the same
    request, which is why the caller passes all three rather than a resolved
    name.
    """
    columns = [
        {"column_name": "event_time", "partition_value_transform": "a(:value)"},
        {"column_name": "country", "partition_value_transform": "lower(:value)"},
    ]

    assert drop_unmapped_value_transforms(
        columns,
        partition_column="region_key",
        partition_mapped_column="country",
        main_dttm_col="event_time",
    ) == ["event_time"]
    assert columns[1]["partition_value_transform"] == "lower(:value)"


def test_without_a_partition_column_no_incoming_transform_survives() -> None:
    """
    No partition column means nothing is mirrored, so no column is the mapped
    one -- which is how the model-level pass resolves it too. A transform stored
    here would be waiting for a partition column nobody has chosen yet.
    """
    columns = [
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
        }
    ]

    assert drop_unmapped_value_transforms(
        columns,
        partition_column=None,
        partition_mapped_column=None,
        main_dttm_col="event_time",
    ) == ["event_time"]
    assert columns[0]["partition_value_transform"] is None


def test_an_echo_of_a_stored_transform_is_not_dropped() -> None:
    """
    The GET-then-PUT shape every client of these endpoints uses: the payload
    carries every column back exactly as it arrived. Changing the default
    datetime column away from the mapped one then made the unchanged copy of
    its transform look like a value being parked, and nulling it destroyed
    configuration the owner never touched -- unrecoverably, since with the flag
    off the editor hides the fields and the model-level pass declines to run.

    An unchanged value is the model-level pass's business, under its own flag,
    which is the line this function already draws for a column the payload
    omits entirely.
    """
    columns = [
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        }
    ]
    stored: dict[str, tuple[str | None, bool]] = {
        "event_time": ("unix_timestamp(:value)", True)
    }

    # `event_time2` is the newly chosen default, so `event_time` is no longer
    # the mapped column -- and its transform is nonetheless an echo.
    assert (
        drop_unmapped_value_transforms(
            columns,
            partition_column="dt_epoch",
            partition_mapped_column=None,
            main_dttm_col="event_time2",
            stored_by_name=stored,
        )
        == []
    )
    assert columns[0]["partition_value_transform"] == "unix_timestamp(:value)"
    assert columns[0]["partition_transform_is_monotonic"] is True


@pytest.mark.parametrize(
    ("transform", "monotonic"),
    [
        # A different expression...
        ("to_unixtime(:value)", True),
        # ...or the same expression with the flag flipped. Either is the
        # request introducing something, which is what the gate is for.
        ("unix_timestamp(:value)", False),
    ],
)
def test_a_changed_transform_on_an_unmapped_column_is_still_dropped(
    transform: str, monotonic: bool
) -> None:
    """
    The other half: knowing what is stored must not turn the gate off. A
    flag-off window is precisely when a value gets parked for later, and this
    is the writer that stops it.
    """
    columns = [
        {
            "column_name": "event_time",
            "partition_value_transform": transform,
            "partition_transform_is_monotonic": monotonic,
        }
    ]

    assert drop_unmapped_value_transforms(
        columns,
        partition_column="dt_epoch",
        partition_mapped_column=None,
        main_dttm_col="event_time2",
        stored_by_name={"event_time": ("unix_timestamp(:value)", True)},
    ) == ["event_time"]
    assert columns[0]["partition_value_transform"] is None


@pytest.mark.parametrize(
    "entry",
    [
        # The transform echoed, the declaration simply absent.
        {"id": 7, "partition_value_transform": "unix_timestamp(:value)"},
        # And the reverse: the declaration echoed, the transform absent.
        {"id": 7, "partition_transform_is_monotonic": True},
    ],
)
def test_a_partial_echo_counts_as_unchanged(entry: dict[str, Any]) -> None:
    """
    `_upsert_columns` writes only the keys an entry carries, so a payload
    echoing one of the two fields is a valid partial update. Read as a change,
    it failed the exemption and both fields were written back as null -- the
    same unrecoverable loss the exemption exists to prevent.
    """
    columns = [dict(entry)]

    assert (
        drop_unmapped_value_transforms(
            columns,
            partition_column="dt_epoch",
            partition_mapped_column=None,
            main_dttm_col="event_time2",
            names_by_id={7: "event_time"},
            stored_by_name={"event_time": ("unix_timestamp(:value)", True)},
        )
        == []
    )
    assert columns[0] == entry


def test_a_caller_that_cannot_see_storage_keeps_the_stricter_behaviour() -> None:
    """
    `stored_by_name` is optional, and omitting it drops an unmapped column's
    transform whether or not it is an echo -- the behaviour every caller had
    before. A column storage does not mention is treated as an introduction
    for the same reason.
    """
    columns = [
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
        }
    ]

    assert drop_unmapped_value_transforms(
        columns,
        partition_column="dt_epoch",
        partition_mapped_column=None,
        main_dttm_col="event_time2",
    ) == ["event_time"]


def test_a_column_the_payload_says_nothing_about_is_left_alone() -> None:
    """
    "Incoming" is the whole scope. A transform already in storage on a column
    this request does not mention belongs to the model-level pass, under its own
    feature flag -- adding a null here would discard stored configuration from a
    request that never asked to.
    """
    columns: list[dict[str, Any]] = [
        {"column_name": "event_time"},
        {"column_name": "other_time", "partition_transform_is_monotonic": False},
    ]

    assert (
        drop_unmapped_value_transforms(
            columns,
            partition_column="dt_epoch",
            partition_mapped_column=None,
            main_dttm_col="event_time",
        )
        == []
    )
    assert "partition_value_transform" not in columns[0]
    assert "partition_value_transform" not in columns[1]


def test_dropping_incoming_transforms_tolerates_no_columns() -> None:
    """A request can carry no columns payload at all; both callers pass `.get`."""
    assert (
        drop_unmapped_value_transforms(
            None,
            partition_column="dt_epoch",
            partition_mapped_column=None,
            main_dttm_col="event_time",
        )
        == []
    )


@pytest.mark.parametrize(
    "column_type, value",
    [
        ("Array(Int32)", 5),
        ("Array(String)", "us"),
    ],
    ids=["numeric-elements", "text-elements"],
)
def test_an_array_partition_column_is_refused_whatever_the_value(
    column_type: str, value: Any
) -> None:
    """
    Every other branch of this gate compares a probe result against the
    column's type. An array has no scalar to compare: `handle_comparison_filter`
    emits a bare ``col = value``, so an ``Array(Int32)`` key mirrors as
    ``dt_epoch = 5`` and a PostgreSQL ``text[]`` one as ``dt_epoch = 'us'``,
    and neither is an operator the engine has -- the predicate fails the whole
    chart once it is in the statement.

    So it is refused for the *column*, ahead of the per-value table, and the
    value it is handed makes no difference. `MULTI_VALUE` having no entry in
    `_PROBE_RESULT_TYPES` read as "nothing to check" and let the mirror
    through.
    """
    # Imported here rather than at module scope: at module scope it widens the
    # set of modules the mypy pre-commit hook analyses, which then reports an
    # unrelated `type: ignore` in `db_engine_specs/mysql.py` as unused.
    from superset.db_engine_specs.clickhouse import (  # noqa: PLC0415
        ClickHouseEngineSpec,
    )

    column = _partition_column(column_type)

    with patch.object(
        type(column.table.database),
        "db_engine_spec",
        new_callable=lambda: property(lambda self: ClickHouseEngineSpec),
    ):
        assert column.type_generic == GenericDataType.MULTI_VALUE
        error = probed_value_type_error(column, [value])

    assert error is not None
    assert "array column" in error


def test_a_scalar_column_on_an_array_capable_engine_still_mirrors() -> None:
    """
    The refusal is for the array type, not for every column on an engine that
    has arrays -- an ordinary `Int32` key under the same spec still takes the
    number its transform returns.
    """
    from superset.db_engine_specs.clickhouse import (  # noqa: PLC0415
        ClickHouseEngineSpec,
    )

    column = _partition_column("Int32")

    with patch.object(
        type(column.table.database),
        "db_engine_spec",
        new_callable=lambda: property(lambda self: ClickHouseEngineSpec),
    ):
        assert probed_value_type_error(column, [1767225600]) is None
