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
from superset.connectors.sqla.partition_mapping import RawProbeValue
from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict
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


def _mapped_date_table() -> SqlaTable:
    """
    A dataset whose mapped column is a ``DATE``.

    That is the type whose literal an engine resolves to a bare day, which is
    what the resolution reasoning is about; `_rendering_dates_like_presto` is
    what makes this table's spec answer that way.
    """
    table = _table(mapped_column="event_date", main_dttm_col="event_date")
    table.columns.append(
        TableColumn(column_name="event_date", is_dttm=True, type="DATE")
    )
    table.columns[-1].partition_value_transform = "unix_timestamp(:value)"
    table.columns[-1].partition_transform_is_monotonic = True
    return table


def _rendering_dates_like_presto(table: SqlaTable) -> Any:
    """
    Make the dataset's engine spec render a bound the way Presto does.

    `Database.db_engine_spec` is a derived property, so the spec cannot be
    swapped wholesale; delegating `convert_dttm` keeps the test tied to the real
    spec rather than to a hand-copied format string. Presto's DATE branch is
    `DATE '{dttm.date().isoformat()}'`, which Trino, BigQuery and some two dozen
    others share.
    """
    return patch.object(
        table.database.db_engine_spec,
        "convert_dttm",
        classmethod(
            lambda cls, target_type, dttm, db_extra=None: PrestoEngineSpec.convert_dttm(
                target_type, dttm, db_extra=db_extra
            )
        ),
    )


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
    assert "dt_epoch <= 1769904000" in sql


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
    assert "dt_epoch <= 1769904000" in sql


@pytest.mark.parametrize(
    "operator,expected",
    [
        (FilterOperator.GREATER_THAN, "dt_epoch >= 1767225600"),
        (FilterOperator.GREATER_THAN_OR_EQUALS, "dt_epoch >= 1767225600"),
        (FilterOperator.LESS_THAN, "dt_epoch <= 1767225600"),
        (FilterOperator.LESS_THAN_OR_EQUALS, "dt_epoch <= 1767225600"),
    ],
)
def test_strict_range_operators_mirror_non_strictly(
    app: Flask, operator: FilterOperator, expected: str
) -> None:
    """
    The direction is preserved; the strictness is not. "Preserves ordering"
    means non-decreasing, so `col < v` only implies `T(col) <= T(v)` -- a
    strict mirror would drop the rows a bucketing transform puts at the
    boundary. The non-strict mirror reads one extra partition, and the original
    filter is still there to exclude whatever it admits.
    """
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


def test_a_bucketing_transform_keeps_the_boundary_bucket(app: Flask) -> None:
    """
    A day key is monotonic but not *strictly* so: every instant in a day
    maps to one value, so an upper bound at `2026-07-06 12:00` and a row at
    `2026-07-06 06:00` share the bucket `20260706`. Mirroring that bound
    strictly prunes the bucket the row is in and drops it from the chart --
    silently, with the pruning glyph still promising only a speed-up.
    """
    table = _table(
        transform="to_char(:value, 'YYYYMMDD')",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, return_value=["20260705", "20260706"]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 7, 5),
                to_dttm=datetime(2026, 7, 6, 12, 0),
            )

    assert "region_key >= '20260705'" in sql
    assert "region_key <= '20260706'" in sql


def test_an_intraday_strict_pair_does_not_mirror_to_an_empty_range(
    app: Flask,
) -> None:
    """
    The zero-instead-of-nine case. `event_time > '2026-07-05 06:00'` plus
    `event_time < '2026-07-06 00:00'` is an ordinary pair of ad-hoc filters, and
    under a day key the bounds land in adjacent buckets. Mirrored strictly it
    reads `day_key > '20260705' AND day_key < '20260706'`, which is empty by
    construction whatever the table holds -- so the chart returns nothing while
    SQL Lab returns the real rows.
    """
    table = _table(
        transform="to_char(:value, 'YYYYMMDD')",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, return_value=["20260705", "20260706"]):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.GREATER_THAN.value,
                        "val": "2026-07-05 06:00:00",
                    },
                    {
                        "col": "event_time",
                        "op": FilterOperator.LESS_THAN.value,
                        "val": "2026-07-06 00:00:00",
                    },
                ],
            )

    assert "region_key >= '20260705'" in sql
    assert "region_key <= '20260706'" in sql


def test_an_integer_bucket_key_is_mirrored_non_strictly_too(app: Flask) -> None:
    """
    The same loss was measured on a day *number* as well as a day string, so it
    is a property of any many-to-one transform rather than of text keys or of
    the formatting function used to build them.
    """
    table = _table(transform="cast(unix_timestamp(:value) / 86400 as bigint)")

    with app.app_context():
        with patch(PROBE, return_value=[20638, 20639]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 7, 5),
                to_dttm=datetime(2026, 7, 6, 12, 0),
            )

    assert "dt_epoch >= 20638" in sql
    assert "dt_epoch <= 20639" in sql


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
    assert sql.count("dt_epoch <= 1769904000") == 1


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
    assert "dt_epoch <= 1769904000" in sql


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


def test_a_probe_result_the_partition_column_cannot_hold_emits_nothing(
    app: Flask,
) -> None:
    """
    `cast(:value as text) || 'x'` evaluates perfectly and answers with a string,
    and `dt_epoch` is a BIGINT. The predicate used to go out as
    `dt_epoch >= '2026-01-01 00:00:00x'`, which Postgres refuses -- and by then
    the mirror is in the statement, so the chart returned a 400 rather than
    losing its pruning.
    """
    table = _table(transform="cast(:value as text) || 'x'")

    with app.app_context():
        probed = ["2026-01-01 00:00:00x", "2026-02-01 00:00:00x"]
        with patch(PROBE, return_value=probed):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "dt_epoch" not in sql
    assert "event_time" in sql


def test_a_numeric_probe_result_still_mirrors_onto_a_numeric_key(
    app: Flask,
) -> None:
    """The other side of the gate: the ordinary case is untouched."""
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


def test_a_day_key_still_mirrors_onto_a_text_partition_column(app: Flask) -> None:
    """
    A `to_char(:value, 'YYYYMMDD')`-style transform answers with text, and a
    text partition column holds text. Refusing that would break the commonest
    bucketing mapping there is.
    """
    table = _table(
        transform="to_char(:value, 'YYYYMMDD')", partition_column="region_key"
    )

    with app.app_context():
        with patch(PROBE, return_value=["20260101", "20260201"]):
            sql = _query(
                table,
                granularity="event_time",
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
            )

    assert "region_key >= '20260101'" in sql


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

    Rounding outward is never narrower. What it moves is the *value* the probe
    is handed, which is what the assertion below pins -- every mirrored upper
    bound is inclusive either way, see `mirror_operator`.
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


def test_the_probe_widens_to_the_day_when_the_engine_drops_the_time(
    app: Flask,
) -> None:
    """
    Presto, Trino, BigQuery and some two dozen other specs render a DATE bound
    as `dttm.date().isoformat()`, so a 10:00 lower bound reaches the engine as
    `DATE '2026-01-01'` while the probe was handed 10:00. A Jan-1 row then has
    `dt_epoch = T(DATE '2026-01-01')`, which satisfies the real predicate and
    *fails* the mirror -- the whole first day is dropped.

    Rounding to the second cannot fix this: there is no sub-second part to
    floor, and flooring one would leave 10:00 exactly where it was.
    """
    table = _table(mapped_column="event_date", main_dttm_col="event_date")
    table.columns.append(
        TableColumn(column_name="event_date", is_dttm=True, type="DATE")
    )
    table.columns[-1].partition_value_transform = "unix_timestamp(:value)"
    table.columns[-1].partition_transform_is_monotonic = True

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1, 2]) as probe:
                sql = _query(
                    table,
                    granularity="event_date",
                    from_dttm=datetime(2026, 1, 1, 10, 0),
                    to_dttm=datetime(2026, 1, 2, 10, 0),
                )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 1, 0, 0),
        datetime(2026, 1, 3, 0, 0),
    ]
    assert "dt_epoch <= 2" in sql


def test_a_day_resolution_bound_already_at_midnight_is_left_alone(
    app: Flask,
) -> None:
    """
    Widening is outward-only, so a bound that already sits on the day boundary
    needs nothing done to it -- and the upper bound must not be pushed out a
    whole extra day for no reason.
    """
    table = _table(mapped_column="event_date", main_dttm_col="event_date")
    table.columns.append(
        TableColumn(column_name="event_date", is_dttm=True, type="DATE")
    )
    table.columns[-1].partition_value_transform = "unix_timestamp(:value)"
    table.columns[-1].partition_transform_is_monotonic = True

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1, 2]) as probe:
                _query(
                    table,
                    granularity="event_date",
                    from_dttm=datetime(2026, 1, 1),
                    to_dttm=datetime(2026, 2, 1),
                )

    assert probe.call_args.args[-1] == [
        datetime(2026, 1, 1, 0, 0),
        datetime(2026, 2, 1, 0, 0),
    ]


def test_an_equality_is_not_mirrored_when_the_engine_drops_the_time(
    app: Flask,
) -> None:
    """
    An ungrained temporal equality -- what drill-to-detail builds -- compares
    `event_date = DATE '2026-01-01'` on such an engine, so a mirror probed with
    10:00 asks for a key no row holds. These entries are AND-ed onto the query,
    so unlike a range there is nowhere to widen to: the only safe answer is to
    emit no mirror and lose the pruning.
    """
    table = _table(mapped_column="event_date", main_dttm_col="event_date")
    table.columns.append(
        TableColumn(column_name="event_date", is_dttm=True, type="DATE")
    )
    table.columns[-1].partition_value_transform = "unix_timestamp(:value)"
    table.columns[-1].partition_transform_is_monotonic = True

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.EQUALS.value,
                            "val": datetime(2026, 1, 1, 10, 0),
                        }
                    ],
                )

    probe.assert_not_called()
    assert "dt_epoch" not in sql


def test_an_equality_at_midnight_still_mirrors_on_a_date_column(
    app: Flask,
) -> None:
    """
    The guard above is about *lost* precision, not about DATE columns: at
    midnight the engine's literal and the probe's value agree, so the mirror is
    exact and the pruning is kept.
    """
    table = _table(mapped_column="event_date", main_dttm_col="event_date")
    table.columns.append(
        TableColumn(column_name="event_date", is_dttm=True, type="DATE")
    )
    table.columns[-1].partition_value_transform = "unix_timestamp(:value)"
    table.columns[-1].partition_transform_is_monotonic = True

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767225600]):
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.EQUALS.value,
                            "val": datetime(2026, 1, 1),
                        }
                    ],
                )

    assert "dt_epoch = 1767225600" in sql


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


# ---------------------------------------------------------------------------
# The value the engine actually compares
# ---------------------------------------------------------------------------


def test_a_string_equality_carrying_a_time_does_not_mirror_on_a_date_column(
    app: Flask,
) -> None:
    """
    A simple filter arrives as the text the chart author typed, not as a
    `datetime`: `filter_values_handler` rewrites only an all-digit value, which
    it reads as epoch milliseconds. On a DATE column the engine compares that
    text on its date part alone, so the filter keeps the whole of 2026-01-01
    while a mirror probed at 10:00 asks for a key no row holds.

    The `datetime` form of this has been covered since the day resolution was
    detected at all -- see
    `test_an_equality_is_not_mirrored_when_the_engine_drops_the_time`. The
    string form is the one a user can actually produce, and it was the one that
    dropped rows.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.EQUALS.value,
                            "val": "2026-01-01 10:00:00",
                        }
                    ],
                )

    probe.assert_not_called()
    assert "dt_epoch" not in sql
    assert "event_date = '2026-01-01 10:00:00'" in sql


@pytest.mark.parametrize(
    "values",
    [
        ["2026-01-01 10:00:00", "2026-01-02 09:00:00"],
        ["2026-01-01", "2026-01-02 09:00:00"],
    ],
    ids=["every-member-coarse", "one-member-coarse"],
)
def test_a_string_in_list_declines_entire_when_any_member_carries_a_time(
    app: Flask, values: list[str]
) -> None:
    """
    An `IN` list is mirrored as one predicate, so a member the engine compares
    more coarsely than the mirror can be built from is the whole list's
    problem. Mirroring only the members that do work would be *narrower* than
    the filter -- the same narrowing the `None`-member guard refuses -- so the
    list declines entire.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1, 2]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.IN.value,
                            "val": values,
                        }
                    ],
                )

    probe.assert_not_called()
    assert "dt_epoch" not in sql


def test_a_string_in_list_of_dates_mirrors_element_wise(app: Flask) -> None:
    """
    The guard above is about a *time of day*, not about `IN` on a DATE column:
    every member at the start of its day is compared in full, so the list
    mirrors and the pruning is kept.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767225600, 1767312000]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.IN.value,
                            "val": ["2026-01-01", "2026-01-02"],
                        }
                    ],
                )

    assert probe.call_args.args[-1] == ["2026-01-01", "2026-01-02"]
    assert "dt_epoch IN (1767225600, 1767312000)" in sql


def test_a_string_lower_bound_rounds_outward_on_a_date_column(app: Flask) -> None:
    """
    A bound has somewhere to widen to where an equality does not. The engine
    compares `event_date >= DATE '2026-01-05'`, so every row on 2026-01-05
    satisfies the filter and the mirror has to admit that whole day -- which is
    what moving the bound back to midnight does.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767571200]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": "2026-01-05 10:00:00",
                        }
                    ],
                )

    assert probe.call_args.args[-1] == [datetime(2026, 1, 5, 0, 0)]
    assert "dt_epoch >= 1767571200" in sql


def test_a_string_upper_bound_rounds_outward_on_a_date_column(app: Flask) -> None:
    """
    The upper bound moves the other way, and by a whole day: the engine compares
    `event_date < DATE '2026-01-20'`, and the mirror must not exclude the
    partition the boundary rows live in.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1768953600]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.LESS_THAN.value,
                            "val": "2026-01-20 10:00:00",
                        }
                    ],
                )

    assert probe.call_args.args[-1] == [datetime(2026, 1, 21, 0, 0)]
    assert "dt_epoch <= 1768953600" in sql


def test_a_date_only_string_equality_still_mirrors_unchanged(app: Flask) -> None:
    """
    A value the engine compares in full is left exactly as it arrived, down to
    the type the probe binds: reading the string back into an instant would
    change the bind type and the probe's cache key on a query that was already
    correct, for no gain at all.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767225600]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.EQUALS.value,
                            "val": "2026-01-01",
                        }
                    ],
                )

    assert probe.call_args.args[-1] == ["2026-01-01"]
    assert "dt_epoch = 1767225600" in sql


def test_a_datetime_lower_bound_rounds_outward_instead_of_declining(
    app: Flask,
) -> None:
    """
    A `datetime` bound used to reach the same guard an equality does and
    decline, which left a string and the `datetime` denoting the same instant
    mirroring differently -- the asymmetry that let the string case above go
    unnoticed. A bound widens whichever shape it arrived in.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767571200]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": datetime(2026, 1, 5, 10, 0),
                        }
                    ],
                )

    assert probe.call_args.args[-1] == [datetime(2026, 1, 5, 0, 0)]
    assert "dt_epoch >= 1767571200" in sql


def test_a_string_filter_value_is_untouched_on_a_full_precision_engine(
    app: Flask,
) -> None:
    """
    The widening is detected, not enumerated per engine. An engine whose
    literal carries the whole value needs none of this, and substituting an
    instant for the text would move the probe off the cache entry every
    already-correct query shares.
    """
    table = _table()

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec,
            "convert_dttm",
            classmethod(lambda cls, target_type, dttm, db_extra=None: repr(dttm)),
        ):
            with patch(PROBE, return_value=[1]) as probe:
                _query(
                    table,
                    filter=[
                        {
                            "col": "event_time",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": "2026-01-05 10:00:00",
                        }
                    ],
                )

    assert probe.call_args.args[-1] == ["2026-01-05 10:00:00"]


def test_a_string_in_list_is_untouched_on_a_full_precision_engine(
    app: Flask,
) -> None:
    """The `IN` counterpart: the new element-wise routing disturbs nothing."""
    table = _table()

    with app.app_context():
        with patch.object(
            table.database.db_engine_spec,
            "convert_dttm",
            classmethod(lambda cls, target_type, dttm, db_extra=None: repr(dttm)),
        ):
            with patch(PROBE, return_value=[1, 2]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_time",
                            "op": FilterOperator.IN.value,
                            "val": ["2026-01-01 10:00:00", "2026-01-02 09:00:00"],
                        }
                    ],
                )

    assert probe.call_args.args[-1] == [
        "2026-01-01 10:00:00",
        "2026-01-02 09:00:00",
    ]
    assert "dt_epoch IN (1, 2)" in sql


def test_an_unparseable_string_is_left_exactly_as_it_arrived(app: Flask) -> None:
    """
    Only ISO 8601 is read, because it is the one format whose meaning is not a
    guess. Reading ``'06/07/2026'`` as July 6 or as June 7 is a coin flip, and a
    mirror derived from the wrong one is the silent narrowing all of this is
    here to prevent -- so a value the mirror cannot read is passed through.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1]) as probe:
                _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": "06/07/2026",
                        }
                    ],
                )

    assert probe.call_args.args[-1] == ["06/07/2026"]


def test_an_offset_bearing_bound_declines_rather_than_narrowing(app: Flask) -> None:
    """
    Rounding an offset-bearing bound outward would first have to place it in the
    frame the partition column was written in, and guessing that frame is how a
    mirror ends up a whole offset narrower than the filter. Declining costs the
    query its pruning and nothing else.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1]) as probe:
                sql = _query(
                    table,
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": "2026-01-05T10:00:00+02:00",
                        }
                    ],
                )

    probe.assert_not_called()
    assert "dt_epoch" not in sql


def test_a_non_temporal_string_equality_is_unaffected(app: Flask) -> None:
    """
    Every string value is now offered to an ISO parse, so the text mapping most
    of this file exercises has to come out the other side unchanged: `'US'` does
    not parse, and a VARCHAR column's `convert_dttm` answers nothing either way.
    """
    table = _mapped_country_table()

    with app.app_context():
        with patch(PROBE, return_value=["us"]) as probe:
            sql = _query(
                table,
                filter=[
                    {"col": "country", "op": FilterOperator.EQUALS.value, "val": "US"}
                ],
            )

    assert probe.call_args.args[-1] == ["US"]
    assert "region_key = 'us'" in sql


def test_a_rounded_string_bound_dedupes_against_the_time_filter(app: Flask) -> None:
    """
    Rounding a string bound outward lands it on the same instant the chart's own
    time filter already contributed, so the two collapse into one request --
    which is what the dedupe in `_build_partition_mirror_predicates` promises
    and what a reader of "View query" expects to see.
    """
    table = _mapped_date_table()

    with app.app_context():
        with _rendering_dates_like_presto(table):
            with patch(PROBE, return_value=[1767571200, 1768953600]):
                sql = _query(
                    table,
                    granularity="event_date",
                    from_dttm=datetime(2026, 1, 5),
                    to_dttm=datetime(2026, 1, 20),
                    filter=[
                        {
                            "col": "event_date",
                            "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
                            "val": "2026-01-05 10:00:00",
                        }
                    ],
                )

    assert sql.count("dt_epoch >=") == 1


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


def _cache_key_query_obj() -> QueryObjectDict:
    """A query object `get_extra_cache_keys` will actually build SQL from."""
    return {
        "columns": ["country"],
        "metrics": [],
        "granularity": "event_time",
        "is_timeseries": False,
        "from_dttm": datetime(2026, 1, 1),
        "to_dttm": datetime(2026, 2, 1),
    }


def test_extra_cache_key_extraction_does_not_probe(app: Flask) -> None:
    """
    `get_extra_cache_keys` builds the whole query when the dataset uses a macro
    like `current_username()`, and it runs unconditionally *before* the chart
    cache is consulted -- so probing there meant a synchronous warehouse round
    trip even on a cache hit. On a relative range the chart key is deliberately
    stable as time passes while the probe key moves every second, so the probe
    missed every single time.
    """
    table = _table()
    table.sql = "SELECT * FROM t WHERE user = '{{ current_username() }}'"

    with app.app_context():
        with patch(PROBE) as probe:
            table.get_extra_cache_keys(_cache_key_query_obj())

    probe.assert_not_called()


def test_suppressing_the_mirror_does_not_change_the_cache_key(app: Flask) -> None:
    """
    Skipping the probe during key extraction is only safe because the mirrors
    contribute nothing to `extra_cache_keys` -- those come from the Jinja
    template processor, and the mapping's own identity is appended separately.
    """
    table = _table()
    table.sql = "SELECT * FROM t WHERE user = '{{ current_username() }}'"
    # Spelled out rather than splatting `_cache_key_query_obj()`: that is a
    # `QueryObjectDict`, which carries keys `get_sqla_query` does not accept.
    bounds: dict[str, Any] = {
        "columns": ["country"],
        "metrics": [],
        "granularity": "event_time",
        "is_timeseries": False,
        "from_dttm": datetime(2026, 1, 1),
        "to_dttm": datetime(2026, 2, 1),
    }

    with app.app_context():
        with patch(PROBE, return_value=[1, 2]):
            mirrored = table.get_sqla_query(**bounds, mirror_partition_filters=True)
            plain = table.get_sqla_query(**bounds, mirror_partition_filters=False)

    assert mirrored.extra_cache_keys == plain.extra_cache_keys
    # And the suppression really did change the SQL, so the comparison above is
    # not vacuous.
    assert "dt_epoch" in str(
        mirrored.sqla_query.compile(compile_kwargs={"literal_binds": True})
    )
    assert "dt_epoch" not in str(
        plain.sqla_query.compile(compile_kwargs={"literal_binds": True})
    )


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
    # Every mirrored upper bound is inclusive, widened or not -- see
    # `mirror_operator`. What this test pins is the widening of the *value*.
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
    assert "dt_epoch >= 1767225600" in sql
    assert "dt_epoch <= 1769904000" in sql


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
        "(dt_epoch >= 1767225600 AND dt_epoch <= 1769904000 OR dt_epoch IS NULL)"
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


# ---------------------------------------------------------------------------
# The mirror has to use the value the real predicate binds
# ---------------------------------------------------------------------------


def test_a_mixed_number_in_list_is_probed_as_the_predicate_binds_it(
    app: Flask,
) -> None:
    """
    SQLAlchemy infers an `IN` bind's type from the first element, so a mixed
    int/float list has to be widened to float before binding or every later
    float truncates (#33206). That widening used to happen inside the `IN`
    branch, a hundred lines after the mirror had already copied the unwidened
    values -- so the probe was asked about `9007199254740993` while the query
    compared `9007199254740992.0`, and the mirror then pruned away the very
    partition the filter matched.
    """
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="metric_value",
        partition_mapped_column="metric_value",
        partition_column="region_key",
    )
    table.columns.append(TableColumn(column_name="metric_value", type="DOUBLE"))
    for column in table.columns:
        if column.column_name == "metric_value":
            column.partition_value_transform = "lower(:value)"
            column.partition_transform_is_monotonic = False

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return ["a", "b"]

    with app.app_context():
        with patch(PROBE, side_effect=record):
            _query(
                table,
                filter=[
                    {
                        "col": "metric_value",
                        "op": FilterOperator.IN.value,
                        "val": ["9007199254740993", "1.5"],
                    }
                ],
            )

    # Both widened, so the probe sees what the predicate binds.
    assert probed == [[9007199254740992.0, 1.5]]


def test_a_mixed_number_probe_result_is_bound_as_one_type(app: Flask) -> None:
    """
    The same inference, one step later and on the other side of the probe. The
    probe answers per value, so a transform over a mixed-number filter can
    answer with a mixed-number *partition key*: results of `[33, 29.02]` bound
    through `in_` emitted `region_key IN (33, 29)` and pruned away the
    partition holding `29.02`.
    """
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="country",
        partition_mapped_column="country",
        partition_column="region_key",
    )

    with app.app_context():
        with patch(PROBE, return_value=[33, 29.02]):
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

    assert "region_key IN (33.0, 29.02)" in sql
    assert "29)" not in sql


def test_an_epoch_millisecond_equality_is_probed_as_the_predicate_renders_it(
    app: Flask,
) -> None:
    """
    `filter_values_handler` turns an epoch-millisecond value on a temporal
    column into engine SQL rather than a value -- what drill-to-detail and
    cross-filters send. That cannot be the value of a bind parameter, so the
    probe's compilation raised and the query silently lost its pruning.

    Carried as text it substitutes instead, which is also what the preview path
    already does with the same input.
    """
    table = _table()

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return [1767261600]

    with app.app_context():
        with patch(PROBE, side_effect=record):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.EQUALS.value,
                        "val": 1767261600000,
                    }
                ],
            )

    assert probed == [[RawProbeValue("'2026-01-01 10:00:00'")]]
    assert "dt_epoch = 1767261600" in sql


def test_an_epoch_millisecond_in_filter_is_probed_element_wise(app: Flask) -> None:
    """Same for the list form, which is the one a cross-filter builds."""
    table = _table()

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return [1767261600, 1767348000]

    with app.app_context():
        with patch(PROBE, side_effect=record):
            sql = _query(
                table,
                filter=[
                    {
                        "col": "event_time",
                        "op": FilterOperator.IN.value,
                        "val": [1767261600000, 1767348000000],
                    }
                ],
            )

    assert probed == [
        [
            RawProbeValue("'2026-01-01 10:00:00'"),
            RawProbeValue("'2026-01-02 10:00:00'"),
        ]
    ]
    assert "dt_epoch IN (1767261600, 1767348000)" in sql


def test_an_array_column_is_probed_with_the_literal_the_predicate_compares(
    app: Flask,
) -> None:
    """
    An array column's predicate is not built from the handled filter values at
    all: it parses the pasted literal into elements, coerces them to the
    array's element type and asks the engine spec for its own array syntax. So
    mirroring the handled value probed the transform at something the query
    never compares.

    ClickHouse is the only spec implementing `array_literal`, so it is the only
    engine this branch is reachable on.
    """
    table = _table(
        transform="lower(:value)",
        monotonic=False,
        mapped_column="tags",
        partition_mapped_column="tags",
        partition_column="region_key",
    )
    table.columns.append(TableColumn(column_name="tags", type="Array(Int32)"))
    for column in table.columns:
        if column.column_name == "tags":
            column.partition_value_transform = "lower(:value)"
            column.partition_transform_is_monotonic = False

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return ["us"]

    with app.app_context():
        with patch(PROBE, side_effect=record):
            with patch.object(
                type(table.database),
                "db_engine_spec",
                new_callable=lambda: property(lambda self: ClickHouseEngineSpec),
            ):
                _query(
                    table,
                    filter=[
                        {
                            "col": "tags",
                            "op": FilterOperator.EQUALS.value,
                            "val": "[1, 2]",
                        }
                    ],
                )

    # Rendered SQL rather than a bound value, because an array literal is an
    # expression -- and the elements coerced to the column's element type,
    # which is what keeps `array(1, 2)` from becoming `array('1', '2')`.
    assert probed == [[RawProbeValue("array(1, 2)")]]


# ---------------------------------------------------------------------------
# `time_groupby_inline`
# ---------------------------------------------------------------------------


def test_no_inner_time_mirror_when_the_subquery_gets_no_time_filter(
    app: Flask,
) -> None:
    """
    The ranking subquery's time predicate is skipped on a
    `time_groupby_inline` engine -- the time grouping is inlined instead -- but
    the inner time *mirror* was added regardless. That left the mirror as the
    only predicate narrowing the subquery to a window nothing else in the query
    mentions, so the ranking was computed over a different span from the one
    asked for and which series came back "top" could change just because
    mapping was enabled.

    The window-independent filter mirrors are a different matter and stay: they
    correspond to `where_clause_and`, which the subquery does receive.
    """
    table = _table()
    epochs = {
        datetime(2025, 1, 1): 1735689600,
        datetime(2025, 2, 1): 1738368000,
    }

    with app.app_context():
        with patch(
            PROBE, side_effect=lambda *args, **kwargs: [epochs[v] for v in args[-1]]
        ):
            with patch.object(
                type(table.database),
                "db_engine_spec",
                new_callable=lambda: property(lambda self: ClickHouseEngineSpec),
            ):
                sql = _query(
                    table,
                    columns=["country"],
                    metrics=["hits"],
                    granularity="event_time",
                    is_timeseries=True,
                    from_dttm=datetime(2025, 1, 1),
                    to_dttm=datetime(2025, 2, 1),
                    timeseries_limit=5,
                    timeseries_limit_metric="hits",
                )

    subquery, outer = _split_series_limit(sql)

    # No time predicate in the subquery, so no time mirror either.
    assert "event_time >=" not in subquery
    assert "dt_epoch >=" not in subquery

    # The outer query, which does carry the time filter, still prunes.
    assert "dt_epoch >= 1735689600" in outer


def test_no_inner_mirror_for_main_dttm_which_the_subquery_never_filters(
    app: Flask,
) -> None:
    """
    `always_filter_main_dttm` adds a second time predicate on `main_dttm_col`,
    and this branch only runs when that is a *different* column from the one
    the chart grouped by. The ranking subquery's own time predicate is built on
    the grouped column, so it never carries a `main_dttm_col` predicate at all
    -- there is nothing there for an inner mirror to stand in for.

    Guarding the inner mirror on `time_groupby_inline` asked the wrong
    question: "does the subquery get *a* time filter", not "does it get one on
    this column". Since the mapping tracks `main_dttm_col` here, the grouped
    column's own mirror sites record nothing, so the mirror was the sole
    predicate narrowing the ranking to a window nothing else in the subquery
    mentioned, and which series ranked top moved just because mapping was on.
    """
    table = _table()
    table.always_filter_main_dttm = True

    with app.app_context():
        with patch(PROBE, return_value=[1767225600, 1769904000]):
            sql = _query(
                table,
                columns=["country"],
                metrics=["hits"],
                granularity="other_time",
                is_timeseries=True,
                from_dttm=datetime(2026, 1, 1),
                to_dttm=datetime(2026, 2, 1),
                timeseries_limit=5,
                timeseries_limit_metric="hits",
            )

    subquery, outer = _split_series_limit(sql)

    # The subquery filters `other_time`, the grouped column, and nothing else.
    assert "other_time >=" in subquery
    assert "dt_epoch" not in subquery

    # The outer query does filter `main_dttm_col`, so it still prunes.
    assert "dt_epoch >= 1767225600" in outer
    assert "dt_epoch <= 1769904000" in outer
