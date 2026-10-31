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


@pytest.mark.parametrize("axis", ["granularity", "x_axis", "x_axis_alias"])
@pytest.mark.parametrize("column_type", ["DATE", "VARCHAR"])
def test_review_fill_time_range_retains_date_column_calendar(
    app: Flask, axis: str, column_type: str
) -> None:
    """DATE padding retains the same calendar boundaries as the SQL filter."""
    table, col = _dataset(
        column_type=column_type,
        uri="postgresql://" if column_type == "VARCHAR" else "sqlite://",
    )
    if column_type == "VARCHAR":
        col.python_date_format = "%Y-%m-%d"
    start, end = get_since_until(
        "2024-05-01T00:00:00+08:00 : 2024-06-01T00:00:00+08:00"
    )
    with app.app_context():
        sql = str(table.get_time_filter(col, start, end))
    assert "2024-05-01" in sql
    assert "2024-06-01" in sql
    assert "2024-04-30" not in sql
    query = QueryObject(
        datasource=table,
        granularity="ts" if axis == "granularity" else None,
        columns=(
            [
                {
                    "label": "Day" if axis == "x_axis_alias" else "ts",
                    "sqlExpression": "ts",
                    "columnType": "BASE_AXIS",
                }
            ]
            if axis != "granularity"
            else []
        ),
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
    "extra,offset,expected_start",
    [
        (None, 8, datetime(2024, 4, 1, 5)),
        ('{"timezone": "Europe/Berlin"}', 0, datetime(2024, 4, 1, 5)),
        ('{"timezone": "America/Los_Angeles"}', 0, datetime(2024, 4, 1, 10)),
    ],
)
def test_review_mcp_rewrite_uses_dataset_bound_semantics(
    extra: str | None, offset: int, expected_start: datetime
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
    result_start, result_end = get_since_until(rewritten["time_range"])
    assert table.adjust_time_bounds(result_start, result_end, col)[0] == expected_start


@pytest.mark.parametrize(
    "extra,offset", [('{"timezone": "Asia/Shanghai"}', 0), (None, 8)]
)
@pytest.mark.parametrize("aware_start", [False, True])
def test_review_jinja_preserves_naive_wall_clock_bounds(
    app: Flask, extra: str | None, offset: int, aware_start: bool
) -> None:
    """The macro adjusts explicit instants without changing its naive contract."""
    table, _ = _dataset(extra, offset)
    start = "2024-05-01T00:00:00+08:00" if aware_start else "2024-05-01"
    time_range = f"{start} : 2024-06-01"
    with app.test_request_context(json={"queries": [{"time_range": time_range}]}):
        macro = ExtraCache(database=table.database, table=table).get_time_filter(
            "ts", strftime="%Y-%m-%d"
        )
    assert macro.from_expr == ("2024-04-30" if aware_start else "2024-05-01")
    assert macro.to_expr == "2024-06-01"


@pytest.mark.parametrize("from_db_extra", [False, True])
@pytest.mark.parametrize("fmt", ["%Y-%m-%d", "%Y%m%d", "%Y-%m-%d %H:%M:%S"])
def test_review_string_date_bounds_match_literal_format(
    app: Flask, from_db_extra: bool, fmt: str
) -> None:
    """Calendar strings retain dates; timestamp strings still identify instants."""
    table, col = _dataset(column_type="VARCHAR", uri="postgresql://")
    if from_db_extra:
        table.database.extra = (
            '{"python_date_format_by_column_name": {"ts": "' + fmt + '"}}'
        )
    else:
        col.python_date_format = fmt
    start, end = get_since_until(QUARTER_RANGE)
    expected_start = datetime(2024, 3, 31, 16) if "%H" in fmt else datetime(2024, 4, 1)
    expected_end = datetime(2024, 6, 30, 16) if "%H" in fmt else datetime(2024, 7, 1)
    with app.app_context():
        sql = str(table.get_time_filter(col, start, end))
    assert f"'{expected_start.strftime(fmt)}'" in sql
    assert f"'{expected_end.strftime(fmt)}'" in sql


def test_review_native_timestamp_precedes_date_string_format(app: Flask) -> None:
    """A format hint must not turn a native timestamp literal into a calendar date."""
    table, col = _dataset(column_type="TIMESTAMP", uri="postgresql://")
    col.python_date_format = "%Y-%m-%d"
    with app.app_context():
        sql = str(table.get_time_filter(col, *get_since_until(QUARTER_RANGE)))
    assert "2024-03-31 16:00:00" in sql
    assert "2024-06-30 16:00:00" in sql


@pytest.mark.parametrize(
    "time_range,expected_start,expected_end,expected_count",
    [
        (QUARTER_RANGE, "2024-03-31 16:00Z", "2024-06-30 15:00Z", 2184),
        (
            "2024-03-31T00:00:00+00:00 : 2024-04-02T00:00:00+00:00",
            "2024-03-31 00:00Z",
            "2024-04-01 23:00Z",
            48,
        ),
    ],
)
@pytest.mark.parametrize("index_tz", ["UTC", "America/New_York", "Europe/Berlin"])
@pytest.mark.parametrize("offset", [8, -5])
def test_review_fill_aware_index_includes_display_hour_offset(
    index_tz: str,
    offset: int,
    time_range: str,
    expected_start: str,
    expected_end: str,
    expected_count: int,
) -> None:
    """Aware-index padding shifts along with normalize_dttm_col's display data."""
    table, _ = _dataset(offset=offset, column_type="TIMESTAMPTZ", uri="postgresql://")
    start, end = get_since_until(time_range)
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
    frame = pd.DataFrame(
        {"ts": pd.DatetimeIndex(["2024-04-01"], tz=index_tz), "value": [1.0]}
    )
    normalize_dttm_col(frame, (DateColumn(col_label="ts", offset=offset),))
    result = query.exec_post_processing(frame.set_index("ts"))
    utc_index = result.index.tz_convert("UTC")
    assert utc_index[0] == pd.Timestamp(expected_start) + pd.Timedelta(hours=offset)
    assert utc_index[-1] == pd.Timestamp(expected_end) + pd.Timedelta(hours=offset)
    assert len(result) == expected_count
    assert result.loc[frame.ts.iloc[0], "value"] == 1.0
