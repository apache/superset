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

from datetime import datetime, timezone as dt_timezone

from flask import Flask

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database


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
