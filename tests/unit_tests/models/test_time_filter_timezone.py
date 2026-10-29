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
"""Tests for dataset-timezone handling in ``get_time_filter`` (PR #37014)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone as dt_timezone

import pytest
from flask import Flask

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.utils.date_parser import get_since_until
from tests.unit_tests.conftest import with_feature_flags


def _table(extra: str | None) -> tuple[SqlaTable, TableColumn]:
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    time_col = TableColumn(column_name="last_modified", is_dttm=1, type="TIMESTAMP")
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="last_modified",
        database=database,
        extra=extra,
    )
    return table, time_col


def test_get_time_filter_converts_local_boundaries_to_utc(app: Flask) -> None:
    """
    A dataset configured with ``{"timezone": "Europe/Berlin"}`` interprets the
    naive UI boundaries as local time and shifts them to UTC for querying
    UTC-stored data. In January, Berlin is UTC+1, so local midnight becomes
    23:00 the previous day in UTC (matches the PR's reported repro).
    """
    table, time_col = _table('{"timezone": "Europe/Berlin"}')

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=datetime(2026, 1, 10),
        )

    sql = str(clause)
    assert "2026-01-08 23:00:00" in sql
    assert "2026-01-09 23:00:00" in sql


def test_get_time_filter_without_timezone_keeps_boundaries(app: Flask) -> None:
    """With no dataset timezone configured, boundaries pass through unchanged."""
    table, time_col = _table(None)

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=datetime(2026, 1, 10),
        )

    sql = str(clause)
    assert "2026-01-09 00:00:00" in sql
    assert "2026-01-10 00:00:00" in sql


@pytest.mark.parametrize("extra", [None, '{"timezone": "Invalid/Zone"}'])
@pytest.mark.parametrize("offset", [0, 4])
def test_aware_quarter_filter_queries_sqlite_text_rows(
    app: Flask, extra: str | None, offset: int
) -> None:
    """An explicit offset is converted to naive UTC before SQLite compares text."""
    table, time_col = _table(extra)
    table.offset = offset
    start, end = get_since_until(
        "DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER) : "
        "DATETIME('2024-07-01T00:00:00+08:00')"
    )
    with app.app_context():
        clause = table.get_time_filter(time_col, start, end)
    boundary = "2024-03-31 16:00:00"
    end_boundary = "2024-06-30 16:00:00"
    with sqlite3.connect(":memory:") as connection:
        connection.execute("CREATE TABLE events (last_modified TEXT)")
        connection.executemany(
            "INSERT INTO events VALUES (?)",
            [
                ("2024-03-31 11:59:59",),
                (boundary,),
                ("2024-04-01 00:00:00",),
                (end_boundary,),
            ],
        )
        rows = connection.execute(
            # The clause is generated exclusively from the fixed test inputs.
            f"SELECT last_modified FROM events WHERE {clause} ORDER BY last_modified"  # noqa: S608
        ).fetchall()
    assert rows == [(boundary,), ("2024-04-01 00:00:00",)]


@pytest.mark.parametrize(
    "start_offset,end_offset,offset,expected",
    [
        ("+08:00", "", "inherit", "5270400 seconds ago"),
        ("", "+08:00", "inherit", "5270400 seconds ago"),
        ("+08:00", "+00:00", "inherit", "5299200 seconds ago"),
        ("+08:00", "", "2024-03-01", "31 days ago"),
    ],
)
def test_quarter_comparison_offsets_accept_mixed_bounds(
    start_offset: str, end_offset: str, offset: str, expected: str
) -> None:
    """Real datasource comparison offsets accept parsed aware quarter bounds."""
    table, _ = _table(None)
    start, end = get_since_until(
        f"DATETRUNC(DATETIME('2024-05-31T12:00:00{start_offset}'), QUARTER) : "
        f"DATETIME('2024-06-01T00:00:00{end_offset}')"
    )
    assert start is not None
    assert end is not None
    assert table.get_offset_custom_or_inherit(offset, start, end) == expected


@with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
@pytest.mark.parametrize(
    "comparison,expected_start,expected_end",
    [
        ("y", "2023-04-01T00:00:00+08:00", "2023-07-01T00:00:00+08:00"),
        ("m", "2024-03-01T00:00:00+08:00", "2024-06-01T00:00:00+08:00"),
        ("w", "2024-03-25T00:00:00+08:00", "2024-06-24T00:00:00+08:00"),
        ("r", "2024-01-01T00:00:00+08:00", "2024-04-01T00:00:00+08:00"),
    ],
)
def test_quarter_instant_comparison_preserves_offsets_through_sql(
    app: Flask, comparison: str, expected_start: str, expected_end: str
) -> None:
    """Comparison periods retain offsets through expression rebuilding and SQL."""
    table, time_col = _table('{"timezone": "Europe/Berlin"}')
    start, end = get_since_until(
        "DATETRUNC(DATETIME('2024-05-31T12:00:00+08:00'), QUARTER) : "
        "DATETIME('2024-07-01T00:00:00+08:00')",
        instant_time_comparison_range=comparison,
    )
    assert start is not None
    assert end is not None
    assert start.isoformat() == expected_start
    assert end.isoformat() == expected_end
    with app.app_context():
        clause = table.get_time_filter(time_col, start, end)
    for value in (expected_start, expected_end):
        utc_value = datetime.fromisoformat(value).astimezone(dt_timezone.utc)
        assert utc_value.strftime("%Y-%m-%d %H:%M:%S") in str(clause)


@pytest.mark.parametrize(
    "start,end,expected_start,expected_end",
    [
        (
            "2024-05-31T12:34:56+08:00",
            "2024-07-01T00:00:00+08:00",
            "2024-03-31 16:00:00",
            "2024-06-30 16:00:00",
        ),
        (
            "2024-02-29T12:34:56-05:30",
            "2024-04-01T00:00:00+00:00",
            "2024-01-01 05:30:00",
            "2024-04-01 00:00:00",
        ),
        (
            "2024-05-31T12:34:56+08:00",
            "2024-07-01T00:00:00",
            "2024-03-31 16:00:00",
            "2024-06-30 22:00:00",
        ),
        (
            "2024-05-31T12:34:56",
            "2024-07-01T00:00:00+08:00",
            "2024-03-31 22:00:00",
            "2024-06-30 16:00:00",
        ),
    ],
)
def test_get_time_filter_preserves_explicit_quarter_offsets(
    app: Flask, start: str, end: str, expected_start: str, expected_end: str
) -> None:
    """Explicit offsets survive parsing and dataset timezone conversion."""
    table, time_col = _table('{"timezone": "Europe/Berlin"}')
    table.offset = 4
    start_dttm, end_dttm = get_since_until(
        f"DATETRUNC(DATETIME('{start}'), QUARTER) : DATETIME('{end}')"
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col, start_dttm=start_dttm, end_dttm=end_dttm
        )

    sql = str(clause)
    assert expected_start in sql
    assert expected_end in sql


def test_get_time_filter_offset_only_shifts_bounds(app: Flask) -> None:
    """
    With no dataset timezone but a configured "Hour Offset", the legacy
    fixed-offset behavior (#41391, already on ``master``) still applies:
    filter bounds are shifted by -offset to stay consistent with what's
    displayed.
    """
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    time_col = TableColumn(column_name="last_modified", is_dttm=1, type="TIMESTAMP")
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="last_modified",
        database=database,
        offset=4,
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=datetime(2026, 1, 10),
        )

    sql = str(clause)
    assert "2026-01-08 20:00:00" in sql
    assert "2026-01-09 20:00:00" in sql


def test_get_time_filter_timezone_takes_precedence_over_offset(app: Flask) -> None:
    """
    When a dataset has both a configured timezone and a legacy Hour Offset
    set, the DST-aware timezone conversion wins and the Hour Offset is
    ignored entirely, rather than the two mechanisms stacking.
    """
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    time_col = TableColumn(column_name="last_modified", is_dttm=1, type="TIMESTAMP")
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="last_modified",
        database=database,
        extra='{"timezone": "Europe/Berlin"}',
        offset=4,
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=datetime(2026, 1, 10),
        )

    sql = str(clause)
    # Berlin is UTC+1 in January, so the timezone conversion (not the +4h
    # Hour Offset) determines the shift.
    assert "2026-01-08 23:00:00" in sql
    assert "2026-01-09 23:00:00" in sql


def test_get_time_filter_non_string_timezone_falls_back_to_offset(app: Flask) -> None:
    """
    ``extra`` is arbitrary user-supplied JSON, so ``timezone`` could hold a
    non-string value (a number, object, list, ...). That must not raise
    ``TypeError`` out of ``ZoneInfo``, and should fall back to the Hour
    Offset if one is configured.
    """
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    time_col = TableColumn(column_name="last_modified", is_dttm=1, type="TIMESTAMP")
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="last_modified",
        database=database,
        extra='{"timezone": 123}',
        offset=4,
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=datetime(2026, 1, 10),
        )

    sql = str(clause)
    assert "2026-01-08 20:00:00" in sql
    assert "2026-01-09 20:00:00" in sql


def test_get_time_filter_epoch_column_uses_utc_regardless_of_server_tz(
    app: Flask,
) -> None:
    """
    Epoch-formatted columns (``epoch_s``/``epoch_ms``) compute seconds-since-
    epoch from an explicitly UTC-anchored datetime (see ``dttm_sql_literal``),
    not the server's local timezone. This matters for the dataset-timezone
    path above, since it hands ``dttm_sql_literal`` a naive datetime that
    represents UTC wall-clock time after the local-to-UTC conversion.
    """
    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    time_col = TableColumn(
        column_name="last_modified",
        is_dttm=1,
        type="INTEGER",
        python_date_format="epoch_s",
    )
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="last_modified",
        database=database,
        extra='{"timezone": "Europe/Berlin"}',
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 1, 9),
            end_dttm=None,
        )

    # Berlin is UTC+1 in January: local midnight -> 2026-01-08 23:00 UTC.
    expected_epoch = int(
        datetime(2026, 1, 8, 23, 0, 0, tzinfo=dt_timezone.utc).timestamp()
    )
    assert str(expected_epoch) in str(clause)
