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

from typing import Any, cast
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.connectors.sqla.partition_mapping import (
    contains_jinja,
    contains_value_placeholder,
    evaluate_transform,
    find_non_deterministic_functions,
    MappingValidationIssue,
    MIRRORABLE_ALWAYS,
    MIRRORABLE_IF_MONOTONIC,
    mirrorable_operators,
    parse_error_detail,
    resolve_partition_mapping,
    validate_partition_mapping,
)
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


def test_an_implicit_self_mapping_blocks_the_save() -> None:
    """
    Checking only the explicit override misses the case an owner actually hits:
    setting ``partition_column`` to the column that is *already* the default
    datetime column, with no override in play.
    """
    issues = _blocking(
        _issues(partition_column="event_time", main_dttm_col="event_time")
    )
    assert len(issues) == 1
    assert "itself" in issues[0].message


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
