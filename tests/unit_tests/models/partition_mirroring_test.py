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
"""
Partition filter mirroring inside ``ExploreMixin.get_sqla_query``.

The probe that resolves ``T(v)`` against the engine is stubbed throughout; what
these tests pin down is *which* predicates get mirrored and with what values,
which is where the correctness argument lives.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import patch

import pytest
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.utils.core import FilterOperator

PROBE = "superset.connectors.sqla.partition_mapping.evaluate_transform"


@pytest.fixture(autouse=True)
def enable_partition_filter_mapping(app: Flask) -> Any:
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    yield
    del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]


def _table(
    *,
    transform: str = "unix_timestamp(:value)",
    monotonic: bool = True,
    partition_column: str | None = "dt_epoch",
    mapped_column: str = "event_time",
    partition_mapped_column: str | None = None,
    main_dttm_col: str | None = "event_time",
) -> SqlaTable:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    columns = [
        TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
        TableColumn(column_name="other_time", is_dttm=True, type="TIMESTAMP"),
        TableColumn(column_name="dt_epoch", type="BIGINT"),
        TableColumn(column_name="country", type="VARCHAR"),
        TableColumn(column_name="region_key", type="VARCHAR"),
    ]
    table = SqlaTable(
        table_name="web_events",
        database=database,
        schema=None,
        main_dttm_col=main_dttm_col,
        columns=columns,
        metrics=[SqlMetric(metric_name="hits", expression="COUNT(*)")],
    )
    table.partition_column = partition_column
    table.partition_mapped_column = partition_mapped_column
    for column in columns:
        if column.column_name == mapped_column:
            column.partition_value_transform = transform
            column.partition_transform_is_monotonic = monotonic
    return table


def _query(table: SqlaTable, **kwargs: Any) -> str:
    defaults: dict[str, Any] = {
        "columns": ["country"],
        "metrics": [],
        "orderby": [],
        "extras": {},
        "filter": [],
        "granularity": None,
        "is_timeseries": False,
    }
    defaults.update(kwargs)
    result = table.get_sqla_query(**defaults)
    return str(
        result.sqla_query.compile(compile_kwargs={"literal_binds": True})
    ).replace("\n", " ")


# ---------------------------------------------------------------------------
# The safe operators
# ---------------------------------------------------------------------------


def test_equality_filter_mirrors_onto_the_partition_column(app: Flask) -> None:
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="country",
        partition_mapped_column="country",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, return_value=["us"]):
            sql = _query(
                table,
                filter=[
                    {"col": "country", "op": FilterOperator.EQUALS.value, "val": "US"}
                ],
            )

    assert "region_key = 'us'" in sql
    assert "country = 'US'" in sql


def test_in_filter_mirrors_element_wise(app: Flask) -> None:
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="country",
        partition_mapped_column="country",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, return_value=["us", "ca"]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "country",
                        "op": FilterOperator.IN.value,
                        "val": ["US", "CA"],
                    }
                ],
            )

    assert "region_key IN ('us', 'ca')" in sql


def test_time_range_mirrors_both_bounds(app: Flask) -> None:
    """
    The Explore time range is the most important operator in the feature, and it
    is a range operator -- so it only mirrors on a declared-monotonic transform.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch >= 1767225600" in sql
    assert "dt_epoch < 1769904000" in sql


def test_temporal_range_filter_mirrors_both_bounds(app: Flask) -> None:
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-01 : 2026-02-01",
                    }
                ],
            )

    assert "dt_epoch >= 1767225600" in sql
    assert "dt_epoch < 1769904000" in sql


@pytest.mark.parametrize(
    "operator,expected",
    [
        (FilterOperator.GREATER_THAN, "dt_epoch > 1767225600"),
        (FilterOperator.GREATER_THAN_OR_EQUALS, "dt_epoch >= 1767225600"),
        (FilterOperator.LESS_THAN, "dt_epoch < 1767225600"),
        (FilterOperator.LESS_THAN_OR_EQUALS, "dt_epoch <= 1767225600"),
    ],
)
def test_range_operators_mirror_with_the_same_direction(
    app: Flask, operator: FilterOperator, expected: str
) -> None:
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": operator.value,
                        "val": "2026-01-01 00:00:00",
                    }
                ],
            )

    assert expected in sql


# ---------------------------------------------------------------------------
# The unsafe operators — nothing is emitted
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "flt",
    [
        {"col": "country", "op": FilterOperator.NOT_EQUALS.value, "val": "US"},
        {"col": "country", "op": FilterOperator.NOT_IN.value, "val": ["US"]},
        {"col": "country", "op": FilterOperator.LIKE.value, "val": "U%"},
        {"col": "country", "op": FilterOperator.ILIKE.value, "val": "U%"},
        {"col": "country", "op": FilterOperator.NOT_LIKE.value, "val": "U%"},
        {"col": "country", "op": FilterOperator.IS_NULL.value},
        {"col": "country", "op": FilterOperator.IS_NOT_NULL.value},
    ],
)
def test_unsafe_operators_emit_nothing(app: Flask, flt: dict[str, Any]) -> None:
    """
    ``T`` need not be injective, so ``country != 'US'`` does not imply
    ``region_key != 'us'`` -- mirroring it would drop rows whose ``country`` is
    already lowercase, rows the original filter keeps.
    """
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="country",
        partition_mapped_column="country",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(table, filter=[flt])

    assert "region_key" not in sql


def test_ranges_do_not_mirror_when_the_transform_is_not_order_preserving(
    app: Flask,
) -> None:
    """
    ``hour(:value)`` is a perfectly reasonable partition transform on a
    ``TIMESTAMP`` column and it is not monotonic, so a time range must not
    mirror through it.
    """
    table = _table(transform="hour(:value)", monotonic=False)

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql


def test_equality_still_mirrors_when_the_transform_is_not_order_preserving(
    app: Flask,
) -> None:
    table = _table(transform="hour(:value)", monotonic=False)

    with app.app_context():
        with patch(PROBE, return_value=[13]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.EQUALS.value,
                        "val": "2026-01-01 13:00:00",
                    }
                ],
            )

    assert "dt_epoch = 13" in sql


# ---------------------------------------------------------------------------
# Bail-outs and edge cases
# ---------------------------------------------------------------------------


def test_nothing_mirrors_when_the_feature_flag_is_off(app: Flask) -> None:
    table = _table()
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = False

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql


def test_an_open_ended_range_mirrors_only_the_bound_it_has(app: Flask) -> None:
    """``from_dttm``/``to_dttm`` are ``None`` for open-ended ranges."""
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600]) as probe:
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=None,
            )

    assert probe.call_args.args[-1] == [datetime(2026, 1, 1)]
    assert "dt_epoch >= 1767225600" in sql
    assert "dt_epoch <" not in sql


def test_no_filter_range_mirrors_nothing(app: Flask) -> None:
    table = _table()

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=None,
                to_dttm=None,
            )

    assert "dt_epoch" not in sql


def test_the_same_bound_is_not_mirrored_twice(app: Flask) -> None:
    """
    A ``granularity`` time filter *and* a ``TEMPORAL_RANGE`` ad-hoc filter on the
    same column is a routine Explore configuration. Emitting the predicate twice
    is harmless SQL but makes "View query" surprising.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-01 : 2026-02-01",
                    }
                ],
            )

    assert sql.count("dt_epoch >= 1767225600") == 1
    assert sql.count("dt_epoch < 1769904000") == 1


def test_always_filter_main_dttm_mirrors_the_main_column_too(app: Flask) -> None:
    """
    With ``always_filter_main_dttm`` the query also filters ``main_dttm_col``,
    which is a *different* column from the one the chart grouped by. That filter
    is the one the mapping tracks, so it has to mirror.
    """
    table = _table()
    table.always_filter_main_dttm = True

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                granularity="other_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch >= 1767225600" in sql
    assert "dt_epoch < 1769904000" in sql


def test_a_failing_probe_leaves_the_query_correct_and_unpruned(app: Flask) -> None:
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=None):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql
    assert "event_time" in sql


def test_an_inverted_transform_emits_nothing(app: Flask) -> None:
    """
    ``T(lower) <= T(upper)`` is a nearly-free runtime backstop for the
    monotonicity *declaration*: it catches inverted transforms, and catches
    ``hour()`` on any range spanning a day boundary. Necessary, not sufficient.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1769904000, 1767225600]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql


def test_incomparable_probe_results_emit_nothing(app: Flask) -> None:
    """Probe results come back as pandas scalars; not every pair compares."""
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[object(), object()]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql


def test_self_mapping_is_skipped_defensively(app: Flask) -> None:
    """Save-time validation rejects this, but older rows can carry it."""
    table = _table(partition_column="event_time")

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert sql.count("event_time >=") == 1


def test_a_filter_on_an_unmapped_column_mirrors_nothing(app: Flask) -> None:
    table = _table()

    with app.app_context():
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            sql = _query(
                table,
                filter=[
                    {"col": "country", "op": FilterOperator.EQUALS.value, "val": "US"}
                ],
            )

    assert "dt_epoch" not in sql


def test_the_probe_receives_timezone_adjusted_bounds(app: Flask) -> None:
    """
    ``get_time_filter`` shifts the bounds by the dataset's timezone before
    building the clause. Probing the *raw* bounds would produce epoch bounds
    describing a different instant than the timestamp bounds they mirror --
    wrong by exactly the offset, silently.
    """
    table = _table()
    table.extra = '{"timezone": "Europe/Berlin"}'

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 9),
                to_dttm=datetime(2026, 1, 10),
            )

    # Berlin is UTC+1 in January, so local midnight is 23:00 the day before.
    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 8, 23, 0),
        datetime(2026, 1, 9, 23, 0),
    ]


def test_the_probe_receives_hour_offset_adjusted_bounds(app: Flask) -> None:
    """The legacy ``offset`` field shifts bounds too, and must reach the probe."""
    table = _table()
    table.offset = 5

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 9, 12),
                to_dttm=datetime(2026, 1, 10, 12),
            )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 9, 7),
        datetime(2026, 1, 10, 7),
    ]


def test_one_probe_round_trip_per_query(app: Flask) -> None:
    """Mirror requests are collected and resolved together, not one at a time."""
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]) as probe:
            _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-01 : 2026-02-01",
                    }
                ],
            )

    probe.assert_called_once()


def test_mirrored_predicates_reach_the_series_limit_subquery(app: Flask) -> None:
    """
    The mirrored predicate is appended to ``where_clause_and``, which the
    series-limit subquery reuses -- so pruning applies there too.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                columns=["country"],
                metrics=["hits"],
                granularity="event_time",
                is_timeseries=True,
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
                timeseries_limit=5,
                timeseries_limit_metric="hits",
            )

    assert sql.count("dt_epoch >= 1767225600") >= 2


def test_extra_cache_keys_include_the_mapping(app: Flask) -> None:
    """
    The mapping changes the SQL a cached chart result came from, so it has to
    participate in the chart-data cache key or a mapping fix leaves stale pruned
    results behind.
    """
    table = _table()

    with app.app_context():
        keys = table.get_extra_cache_keys({})

    assert any("dt_epoch" in str(key) for key in keys)


def test_extra_cache_keys_are_unchanged_without_a_mapping(app: Flask) -> None:
    """Cache keys must not churn for the entire installed base."""
    table = _table(partition_column=None)

    with app.app_context():
        assert table.get_extra_cache_keys({}) == []
