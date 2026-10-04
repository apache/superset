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
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
import sqlalchemy as sa
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.utils import json
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

    The bounds reach the probe as `datetime` objects here because the mapped
    column declares no ``python_date_format``, so that *is* its stored
    representation. See the sibling tests for a column where it is not.
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


def test_the_probe_receives_an_epoch_column_s_own_representation(
    app: Flask,
) -> None:
    """
    The real predicate compares the column against `dttm_sql_literal`, which
    for a column declaring an epoch ``python_date_format`` renders an integer.
    So on such a column the transform is a function of an integer -- probing it
    with a `datetime` evaluates something unrelated to the partition keys, or
    raises, and a raise costs the dataset its pruning silently.
    """
    table = _table(mapped_column="event_epoch", main_dttm_col="event_epoch")
    table.columns.append(
        TableColumn(
            column_name="event_epoch",
            is_dttm=True,
            type="BIGINT",
            python_date_format="epoch_s",
        )
    )
    table.columns[-1].partition_value_transform = "to_date(:value)"
    table.columns[-1].partition_transform_is_monotonic = True

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                granularity="event_epoch",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert probe.call_args.args[-1] == [1767225600, 1769904000]


def test_the_probe_honours_a_per_column_date_format_from_db_extra(
    app: Flask,
) -> None:
    """
    `dttm_sql_literal` falls back to ``python_date_format_by_column_name`` in
    the database's extra, so the probe has to read the same fallback.
    """
    table = _table()
    table.database.extra = json.dumps(
        {"python_date_format_by_column_name": {"event_time": "%Y%m%d"}}
    )

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert probe.call_args.args[-1] == ["20260101", "20260201"]


def test_the_probe_rounds_outward_when_the_engine_drops_subseconds(
    app: Flask,
) -> None:
    """
    SQLite renders a timestamp with ``timespec="seconds"``, so the real lower
    bound is floored while the probe was handed the full precision. That makes
    the mirror *narrower* than the predicate it stands in for, and narrower
    means it drops rows the filter keeps -- a row at ``.250000`` matches
    ``event_time >= '2026-01-01 00:00:00'`` but not a mirror derived from
    ``.500000``.

    Rounding outward is never narrower. The upper bound turns inclusive for the
    same reason the grain widening does: a ceiled bound is only safe inclusive.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1, 0, 0, 0, 500000),
                to_dttm=datetime(2026, 2, 1, 0, 0, 0, 500000),
            )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 1, 0, 0, 0),
        datetime(2026, 2, 1, 0, 0, 1),
    ]
    assert "dt_epoch <= 2" in sql


def test_the_probe_keeps_full_precision_on_an_engine_that_does_not_truncate(
    app: Flask,
) -> None:
    """
    The widening is detected, not enumerated per engine: an engine whose
    literal carries the sub-second part needs no rounding, and rounding anyway
    would scan partitions for no reason.
    """
    table = _table()

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec,
            "convert_dttm",
            classmethod(lambda cls, target_type, dttm, db_extra=None: repr(dttm)),
        ):
            with patch(PROBE, return_value=[1, 2]) as probe:
                _query(
                    table,
                    granularity="event_time",
                    from_dttm=datetime(2026, 1, 1, 0, 0, 0, 500000),
                    to_dttm=datetime(2026, 2, 1, 0, 0, 0, 500000),
                )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 1, 0, 0, 0, 500000),
        datetime(2026, 2, 1, 0, 0, 0, 500000),
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


def _split_series_limit(sql: str) -> tuple[str, str]:
    """The ranking subquery and the outer query, as separate text."""
    _, marker, rest = sql.partition("JOIN (SELECT")
    assert marker, "expected a series-limit subquery"
    subquery, _, outer = rest.partition(") AS series_limit")
    return subquery, outer


def test_the_series_limit_subquery_mirrors_the_inner_time_window(
    app: Flask,
) -> None:
    """
    The ranking subquery filters the *inner* window, not the outer one. On a
    time comparison `processing_time_offsets` shifts `from_dttm`/`to_dttm` to
    the comparison period and leaves `inner_*` on the original, so an
    outer-window mirror in the subquery demands partition keys from a period
    the subquery's own time filter excludes: the ranking comes back empty and
    the join drops the comparison series entirely.
    """
    table = _table()
    epochs = {
        datetime(2025, 1, 1): 1735689600,
        datetime(2025, 2, 1): 1738368000,
        datetime(2026, 1, 1): 1767225600,
        datetime(2026, 2, 1): 1769904000,
    }

    with app.app_context():
        with patch(
            PROBE, side_effect=lambda *args, **kwargs: [epochs[v] for v in args[-1]]
        ):
            sql = _query(
                table,
                columns=["country"],
                metrics=["hits"],
                granularity="event_time",
                is_timeseries=True,
                from_dttm=datetime(2025, 1, 1),
                to_dttm=datetime(2025, 2, 1),
                inner_from_dttm=datetime(2026, 1, 1),
                inner_to_dttm=datetime(2026, 2, 1),
                timeseries_limit=5,
                timeseries_limit_metric="hits",
            )

    subquery, outer = _split_series_limit(sql)

    # The subquery asks for the window its own time filter describes.
    assert "dt_epoch >= 1767225600" in subquery
    assert "dt_epoch >= 1735689600" not in subquery

    # The outer query still asks for the window it was given.
    assert "dt_epoch >= 1735689600" in outer
    assert "dt_epoch >= 1767225600" not in outer


def test_the_series_limit_prequery_mirrors_the_inner_window(app: Flask) -> None:
    """
    The other series-limit branch is already right, for a different reason: it
    re-enters `query()` with `inner_from_dttm or from_dttm` as its own
    `from_dttm`, so the mirrors are recomputed for the inner window rather than
    inherited. Pinned so a future refactor cannot quietly break the half that
    works.
    """
    table = _table()
    captured: list[dict[str, Any]] = []

    def _capture(query_obj: dict[str, Any]) -> Any:
        captured.append(query_obj)
        return MagicMock(df=pd.DataFrame({"country": []}))

    with app.app_context():
        with patch.object(table.database.db_engine_spec, "allows_joins", False):
            with patch(PROBE, return_value=[1767225600, 1769904000]):
                with patch.object(type(table), "query", side_effect=_capture):
                    _query(
                        table,
                        columns=["country"],
                        metrics=["hits"],
                        granularity="event_time",
                        is_timeseries=True,
                        from_dttm=datetime(2025, 1, 1),
                        to_dttm=datetime(2025, 2, 1),
                        inner_from_dttm=datetime(2026, 1, 1),
                        inner_to_dttm=datetime(2026, 2, 1),
                        timeseries_limit=5,
                        timeseries_limit_metric="hits",
                    )

    assert captured, "expected a prequery"
    assert captured[0]["from_dttm"] == datetime(2026, 1, 1)
    assert captured[0]["to_dttm"] == datetime(2026, 2, 1)


def test_one_probe_round_trip_when_both_windows_match(app: Flask) -> None:
    """
    The inner sink is collected unconditionally, but building its predicates a
    second time would cost a second probe round trip. Every query that is not a
    time comparison asks for the same thing twice, so the result is reused.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]) as probe:
            _query(
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

    probe.assert_called_once()


def test_the_series_limit_subquery_keeps_row_level_security(app: Flask) -> None:
    """
    The subquery takes a snapshot of `where_clause_and` from before the mirrors
    are appended. That snapshot has to be taken *after* row level security and
    the extras `where` go on, or swapping the mirrors would quietly drop them
    from the ranking subquery -- which for row level security would be a
    security bug, not a pruning one.
    """
    table = _table()

    with app.app_context():
        with patch.object(
            type(table),
            "get_sqla_row_level_filters",
            return_value=[sa.text("country = 'US'")],
        ):
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
                    extras={"where": "region_key <> 'x'"},
                )

    subquery, _ = _split_series_limit(sql)
    assert "country = 'US'" in subquery
    assert "region_key <> 'x'" in subquery


def _mapped_country_table() -> SqlaTable:
    """A string-column mapping: ``country`` onto ``region_key``."""
    return _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="country",
        partition_mapped_column="country",
        partition_column="region_key",
    )


def test_string_equality_does_not_mirror_on_a_case_insensitive_engine(
    app: Flask,
) -> None:
    """
    `col = v` mirrors onto `partition_col = T(v)` on the strength of `col = v`
    implying `T(col) = T(v)` -- true of value equality, false of SQL equality
    under any comparison that is not byte-exact. With a case-insensitive
    collation a stored `country` of `'us'` satisfies a filter for `'US'` while
    the mirror `region_key = 'us'` is derived from `'US'` and excludes the row,
    so the chart loses it with nothing to indicate why.
    """
    table = _mapped_country_table()

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec, "binary_string_comparison", False
        ):
            with patch(PROBE, return_value=["us"]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "country",
                            "op": FilterOperator.EQUALS.value,
                            "val": "US",
                        }
                    ],
                )

    assert "region_key" not in sql
    assert "country = 'US'" in sql
    probe.assert_not_called()


def test_string_equality_still_mirrors_on_a_byte_exact_engine(app: Flask) -> None:
    """
    The gate must not cost the feature its second canonical mapping on the
    engines it exists for, all of which compare text byte-exactly.
    """
    table = _mapped_country_table()

    with app.app_context():
        with patch(PROBE, return_value=["us"]):
            sql = _query(
                table,
                filter=[
                    {"col": "country", "op": FilterOperator.EQUALS.value, "val": "US"}
                ],
            )

    assert "region_key = 'us'" in sql


def test_a_numeric_mapped_column_is_unaffected_by_the_collation_gate(
    app: Flask,
) -> None:
    """Numeric comparison is exact on every engine."""
    table = _table(
        transform="CAST(:value AS STRING)",
        monotonic=False,
        mapped_column="dt_epoch",
        partition_mapped_column="dt_epoch",
        partition_column="region_key",
    )

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec, "binary_string_comparison", False
        ):
            with patch(PROBE, return_value=["17"]):
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "dt_epoch",
                            "op": FilterOperator.EQUALS.value,
                            "val": 17,
                        }
                    ],
                )

    assert "region_key = '17'" in sql


def test_the_summary_withdraws_the_operators_the_query_path_withdraws(
    app: Flask,
) -> None:
    """
    The glyph reads `mirrorable_operators` off this summary, so the gate has to
    reach it or Explore would mark a filter chip as pruned while the generated
    SQL carries no partition predicate -- which is the whole class of bug the
    indicator work has been closing.
    """
    table = _mapped_country_table()

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec, "binary_string_comparison", False
        ):
            summary = table.partition_filter_mapping_summary

        assert summary is not None
        assert summary["mirrorable_operators"] == []

        unguarded = table.partition_filter_mapping_summary

    assert unguarded is not None
    assert unguarded["mirrorable_operators"] == ["==", "IN"]


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


# ---------------------------------------------------------------------------
# Time grains
# ---------------------------------------------------------------------------


def test_a_grain_bearing_equality_filter_does_not_mirror(app: Flask) -> None:
    """
    Drill-to-detail sends the clicked bucket as `==` plus the chart's grain, and
    the real predicate compares the *truncated* column. Mirroring the raw bucket
    start would keep only the rows at the bucket's first instant and silently
    drop the rest of the bucket.

    Deferred rather than unsafe: `==` on a bucket could become a two-sided
    range, but that needs a monotonic transform -- `EQUALS` mirrors without one
    today -- and a parse back into a datetime.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1767225600]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.EQUALS.value,
                        "val": "2026-01-05",
                        "grain": "P1W",
                    }
                ],
            )

    assert "dt_epoch" not in sql


def test_a_grain_bearing_temporal_range_widens_both_bounds(app: Flask) -> None:
    """
    A grained range compares the truncated column, so the raw bounds it carries
    do not describe the rows it keeps. Widening both ends by one bucket is the
    smallest range guaranteed to contain all of them -- both ends, because which
    way a grain rounds is not knowable from its duration.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-08 : 2026-02-01",
                        "grain": "P1D",
                    }
                ],
            )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 7),
        datetime(2026, 2, 2),
    ]
    assert "dt_epoch" in sql
    # The widened upper bound is inclusive: `ts < until + width` only gives
    # `T(ts) <= T(until + width)` for a transform that is monotonic but not
    # strictly so.
    assert "dt_epoch <= 2" in sql
    assert "dt_epoch >= 1" in sql


def test_a_grain_bearing_range_widens_a_month_across_the_boundary(
    app: Flask,
) -> None:
    """A month is not thirty days: the widening has to be calendar arithmetic."""
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-31 : 2026-03-31",
                        "grain": "P1M",
                    }
                ],
            )

    assert probe.call_args.args[-1] == [
        datetime(2025, 12, 31),
        datetime(2026, 4, 30),
    ]


def test_a_forward_rounding_grain_still_mirrors(app: Flask) -> None:
    """
    ``WEEK_ENDING_SATURDAY`` rounds *forward* on Hive and Presto, which is
    exactly why the widening is symmetric: a floor-only version would drop up to
    a week of rows off the bottom of the range.
    """
    table = _table()

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-08 : 2026-02-01",
                        "grain": "P1W/1970-01-03T00:00:00Z",
                    }
                ],
            )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 1),
        datetime(2026, 2, 8),
    ]
    assert "dt_epoch" in sql


def test_an_addon_grain_still_does_not_mirror(app: Flask) -> None:
    """An operator-supplied grain has no width Superset can claim to know."""
    table = _table()

    with app.app_context():
        # An operator declares both halves: the label and the SQL that builds it.
        app.config["TIME_GRAIN_ADDONS"] = {"PT2S": "2 second"}
        app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {
            "sqlite": {"PT2S": "DATETIME({col}, 'start of day')"}
        }
        try:
            with patch(PROBE, return_value=[1, 2]):
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_time",
                            "op": FilterOperator.TEMPORAL_RANGE.value,
                            "val": "2026-01-01 : 2026-02-01",
                            "grain": "PT2S",
                        }
                    ],
                )
        finally:
            app.config["TIME_GRAIN_ADDONS"] = {}
            app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {}

    assert "dt_epoch" not in sql


def test_a_builtin_grain_an_operator_redefined_does_not_mirror(
    app: Flask,
) -> None:
    """
    ``TIME_GRAIN_ADDON_EXPRESSIONS`` can replace a built-in grain's SQL for one
    engine, so ``P1D`` there may have nothing to do with a day. The duration
    alone no longer bounds the displacement.
    """
    table = _table()

    with app.app_context():
        app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {
            "sqlite": {"P1D": "DATETIME({col}, 'start of year')"}
        }
        try:
            with patch(PROBE, return_value=[1, 2]):
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_time",
                            "op": FilterOperator.TEMPORAL_RANGE.value,
                            "val": "2026-01-01 : 2026-02-01",
                            "grain": "P1D",
                        }
                    ],
                )
        finally:
            app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {}

    assert "dt_epoch" not in sql


def test_widening_is_applied_after_the_timezone_adjustment(app: Flask) -> None:
    """
    The grain truncation happens in the frame the column is *stored* in, so the
    bucket width has to be added there too. Widening first and converting after
    lands an hour out across a DST boundary.
    """
    table = _table()
    table.extra = '{"timezone": "Europe/Berlin"}'

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]) as probe:
            _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.TEMPORAL_RANGE.value,
                        "val": "2026-01-09 : 2026-01-10",
                        "grain": "P1D",
                    }
                ],
            )

    # Berlin is UTC+1 in January: adjust to 23:00 the day before, then widen.
    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 7, 23, 0),
        datetime(2026, 1, 10, 23, 0),
    ]


def test_an_ungrained_filter_still_mirrors(app: Flask) -> None:
    """The grain guard must not cost pruning for the ordinary case."""
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

    assert "dt_epoch" in sql
    # The widened `<=` must not leak into the common path, which mirrors an
    # exclusive upper bound exactly.
    assert "dt_epoch < 1769904000" in sql
    assert "dt_epoch <= " not in sql


# ---------------------------------------------------------------------------
# NULL partition values
# ---------------------------------------------------------------------------


def test_rows_in_a_null_partition_survive_mirroring(app: Flask) -> None:
    """
    A mirrored comparison against NULL is NULL, so a row whose partition value
    is NULL is dropped by the mirror even when the real filter matches it. Hive
    and Impala park such rows in the default partition, and a transform that
    returns NULL for an input it cannot convert produces them on any engine.
    The mirror only has to be *no narrower* than the real filter, so widening it
    to admit NULL partitions keeps those rows while still pruning.
    """
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
    assert "region_key IS NULL" in sql
    assert "OR" in sql


def test_the_null_escape_covers_the_in_path(app: Flask) -> None:
    """A row in a NULL partition is dropped by `IN` just as surely as by `=`."""
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
    assert "region_key IS NULL" in sql


def test_the_null_escape_wraps_the_whole_conjunction(app: Flask) -> None:
    """
    With two bounds the escape has to sit outside both. `a AND (b OR p IS NULL)`
    would still drop every NULL-partition row on the `a` comparison -- the bug
    the escape exists to prevent, one bound later.
    """
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

    # SQLAlchemy drops the redundant inner parentheses; AND binds tighter than
    # OR, so this still parses as `(a AND b) OR p IS NULL`. What matters is that
    # the escape sits outside *both* comparisons, not between them.
    assert (
        "(dt_epoch >= 1767225600 AND dt_epoch < 1769904000 OR dt_epoch IS NULL)"
    ) in sql


def test_a_mapping_that_emits_nothing_emits_no_bare_null_check(app: Flask) -> None:
    """
    The escape widens a predicate; with no predicate to widen it would be a
    bare `p IS NULL`, which keeps only the rows the mirror was meant to spare.
    """
    table = _table(monotonic=False)

    with app.app_context():
        with patch(PROBE, return_value=[1767225600]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.GREATER_THAN.value,
                        "val": "2026-01-01",
                    }
                ],
            )

    assert "dt_epoch" not in sql
