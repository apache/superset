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
"""Offset-aware quarter bounds through their real downstream consumers."""

import sqlite3
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
from flask import Flask

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.jinja_context import ExtraCache
from superset.mcp_service.dashboard_scope import (
    _rewrite_dataset_request,
    DashboardConstraints,
    intersect_time_ranges,
)
from superset.models.core import Database
from superset.utils.core import DateColumn, normalize_dttm_col
from superset.utils.date_parser import (
    datetime_eval,
    get_past_or_future,
    get_since_until,
)

QUARTER_RANGE = (
    "DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER) : "
    "DATETIME('2024-07-01T00:00:00+08:00')"
)


def _dataset(
    extra: str | None = None,
    offset: int = 0,
    column_type: str = "TIMESTAMP",
    uri: str = "sqlite://",
) -> tuple[SqlaTable, TableColumn]:
    """Build a real datasource with temporal metadata without connecting to a DB."""
    col = TableColumn(column_name="ts", type=column_type, is_dttm=True)
    table = SqlaTable(
        table_name="events",
        columns=[col],
        main_dttm_col="ts",
        database=Database(database_name="test", sqlalchemy_uri=uri),
        extra=extra,
        offset=offset,
    )
    return table, col


@pytest.mark.parametrize("unit", ["", ", DAY"])
def test_review_datediff_mixed_quarter_bounds(unit: str) -> None:
    """DATEDIFF and nesting it in DATEADD retain the legacy mixed-bound duration."""
    diff = (
        "DATEDIFF(DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER), "
        f"DATETIME('2024-06-01'){unit})"
    )
    assert datetime_eval(diff) == 61
    assert datetime_eval(f"DATEADD(DATETIME('2024-01-01'), {diff}, DAY)") == datetime(
        2024, 3, 2
    )


@pytest.mark.parametrize("phrase", ["1 year ago", "1 month ago", "1 quarter ago"])
def test_review_comparison_shift_keeps_offset(app: Flask, phrase: str) -> None:
    """Comparison bounds keep their input offset through the real shift and SQL."""
    table, col = _dataset('{"timezone": "Europe/Berlin"}')
    start, end = get_since_until(QUARTER_RANGE)
    assert start is not None
    assert end is not None
    shifted_start = get_past_or_future(phrase, start)
    shifted_end = get_past_or_future(phrase, end)
    assert shifted_start.utcoffset() == timedelta(hours=8)
    assert shifted_end.utcoffset() == timedelta(hours=8)
    with app.app_context():
        sql = str(table.get_time_filter(col, shifted_start, shifted_end))
    assert shifted_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") in sql


@pytest.mark.parametrize("uri", ["sqlite://", "postgresql://"])
def test_review_date_columns_preserve_calendar_dates(app: Flask, uri: str) -> None:
    """DATE literals retain the input calendar date rather than the prior UTC date."""
    table, col = _dataset(column_type="DATE", uri=uri)
    start, end = get_since_until(
        "2024-05-01T00:00:00+08:00 : 2024-06-01T00:00:00+08:00"
    )
    with app.app_context():
        adjusted = table.adjust_time_bounds(start, end, col)
        sql = str(table.get_time_filter(col, start, end))
    assert adjusted == (datetime(2024, 5, 1), datetime(2024, 6, 1))
    assert "2024-05-01" in sql
    assert "2024-06-01" in sql
    assert "2024-04-30" not in sql


@pytest.mark.parametrize("extra", [None, '{"timezone": "Invalid/Zone"}'])
def test_review_hour_offset_applies_only_to_naive_bounds(
    app: Flask, extra: str | None
) -> None:
    """An aware start is converted once; the naive end uses the dataset Hour Offset."""
    table, col = _dataset(extra, offset=8)
    start, end = get_since_until(
        "DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER) : 2024-07-01"
    )
    with app.app_context():
        assert table.adjust_time_bounds(start, end, col) == (
            datetime(2024, 3, 31, 16),
            datetime(2024, 6, 30, 16),
        )


@pytest.mark.parametrize("extra", [None, '{"timezone": "Europe/Berlin"}'])
def test_review_jinja_filter_matches_chart_and_sqlite_rows(
    app: Flask, extra: str | None
) -> None:
    """The Jinja macro and chart clause select the same actual SQLite rows."""
    table, col = _dataset(extra, offset=8)
    start, end = get_since_until(QUARTER_RANGE)
    with app.test_request_context(json={"queries": [{"time_range": QUARTER_RANGE}]}):
        macro = ExtraCache(database=table.database, table=table).get_time_filter(
            "ts", target_type="TIMESTAMP"
        )
        chart = table.get_time_filter(col, start, end)
    with sqlite3.connect(":memory:") as connection:
        connection.execute("CREATE TABLE events (ts TEXT)")
        connection.executemany(
            "INSERT INTO events VALUES (?)",
            [
                ("2024-03-31 15:59:59",),
                ("2024-03-31 20:00:00",),
                ("2024-06-30 16:00:00",),
            ],
        )
        macro_rows = connection.execute(
            f"SELECT ts FROM events WHERE ts >= {macro.from_expr} "  # noqa: S608
            f"AND ts < {macro.to_expr}"
        ).fetchall()
        chart_rows = connection.execute(
            f"SELECT ts FROM events WHERE {chart}"  # noqa: S608
        ).fetchall()
    assert macro_rows == chart_rows == [("2024-03-31 20:00:00",)]


@pytest.mark.parametrize("index_tz", [None, "UTC", "Europe/Berlin"])
def test_review_fill_time_range_matches_queried_instants(index_tz: str | None) -> None:
    """Hourly fill covers the UTC query period, including its exclusive end."""
    start, end = get_since_until(QUARTER_RANGE)
    query = QueryObject(
        row_limit=1,
        from_dttm=start,
        to_dttm=end,
        post_processing=[
            {
                "operation": "resample",
                "options": {
                    "rule": "1h",
                    "method": "asfreq",
                    "fill_value": 0,
                    "fill_time_range": True,
                },
            }
        ],
    )
    frame = pd.DataFrame(
        {"value": [1.0]}, index=pd.DatetimeIndex(["2024-05-01"], tz=index_tz)
    )
    result = query.exec_post_processing(frame)
    index = result.index if index_tz is None else result.index.tz_convert(None)
    assert index[0] == pd.Timestamp("2024-03-31 16:00:00")
    assert index[-1] == pd.Timestamp("2024-06-30 15:00:00")
    assert len(index) == 2184


@pytest.mark.parametrize(
    "extra,offset,display_start,display_end",
    [
        ('{"timezone": "Europe/Berlin"}', 0, "2024-03-31 18:00", "2024-06-30 17:00"),
        (None, 8, "2024-04-01 00:00", "2024-06-30 23:00"),
    ],
)
def test_review_fill_time_range_uses_normalized_display_frame(
    extra: str | None, offset: int, display_start: str, display_end: str
) -> None:
    """Padding uses the same display frame as the datasource-normalized data."""
    table, _ = _dataset(extra, offset)
    start, end = get_since_until(QUARTER_RANGE)
    query = QueryObject(
        datasource=table,
        row_limit=1,
        from_dttm=start,
        to_dttm=end,
        post_processing=[
            {
                "operation": "resample",
                "options": {
                    "rule": "1h",
                    "method": "asfreq",
                    "fill_value": 0,
                    "fill_time_range": True,
                },
            }
        ],
    )
    frame = pd.DataFrame({"ts": pd.to_datetime(["2024-05-01"]), "value": [1.0]})
    normalize_dttm_col(
        frame,
        (
            DateColumn(
                col_label="ts", offset=offset, timezone=table.get_dataset_timezone()
            ),
        ),
    )
    result = query.exec_post_processing(frame.set_index("ts"))
    assert result.index[0] == pd.Timestamp(display_start)
    assert result.index[-1] == pd.Timestamp(display_end)


def test_review_mcp_mixed_result_survives_reparse() -> None:
    """A valid instant range stays valid when the selected endpoints are mixed."""
    table, col = _dataset()
    result = intersect_time_ranges(
        "2024-04-01T00:00:00+08:00 : 2024-04-02T00:00:00+08:00",
        "2024-03-31T20:00:00 : 2024-04-03",
    )
    assert table.adjust_time_bounds(*get_since_until(result), col) == (
        datetime(2024, 3, 31, 20),
        datetime(2024, 4, 1, 16),
    )


def test_review_fill_time_range_retains_date_column_calendar() -> None:
    """DATE padding retains the same calendar boundaries as the SQL filter."""
    table, _ = _dataset(column_type="DATE")
    start, end = get_since_until(
        "2024-05-01T00:00:00+08:00 : 2024-06-01T00:00:00+08:00"
    )
    query = QueryObject(
        datasource=table,
        granularity="ts",
        row_limit=1,
        from_dttm=start,
        to_dttm=end,
        post_processing=[
            {
                "operation": "resample",
                "options": {
                    "rule": "1h",
                    "method": "asfreq",
                    "fill_value": 0,
                    "fill_time_range": True,
                },
            }
        ],
    )
    frame = pd.DataFrame({"value": [1.0]}, index=pd.to_datetime(["2024-05-15"]))
    result = query.exec_post_processing(frame)
    assert result.index[0] == pd.Timestamp("2024-05-01")
    assert result.index[-1] == pd.Timestamp("2024-05-31 23:00:00")


def test_review_mcp_intersection_cannot_widen_offset_scope() -> None:
    """03:00 UTC cannot replace a dashboard scope beginning at 05:00 UTC."""
    result = intersect_time_ranges(
        "DATETRUNC(DATETIME('2024-05-31T12:00:00-05:00'), QUARTER) : 2024-07-01",
        "2024-04-01T03:00:00 : 2024-06-01",
    )
    table, col = _dataset()
    bounds = get_since_until(result)
    assert table.adjust_time_bounds(*bounds, col)[0] == datetime(2024, 4, 1, 5)


@pytest.mark.parametrize(
    "extra,offset", [(None, 8), ('{"timezone": "Europe/Berlin"}', 0)]
)
def test_review_mcp_rewrite_uses_dataset_bound_semantics(
    extra: str | None, offset: int
) -> None:
    """The dataset request rewrite intersects using the same adjustments as SQL."""
    table, col = _dataset(extra, offset)
    scope_range = "2024-04-01T00:00:00-05:00 : 2024-07-01"
    rewritten = _rewrite_dataset_request(
        {"time_range": "2024-04-01T03:00:00 : 2024-06-01", "time_column": "ts"},
        DashboardConstraints((), scope_range, "ts"),
        table,
        lambda value: value,
    )
    scope_start = get_since_until(scope_range)[0]
    result_start, result_end = get_since_until(rewritten["time_range"])
    assert (
        table.adjust_time_bounds(result_start, result_end, col)[0]
        == table.adjust_time_bounds(scope_start, None, col)[0]
    )
