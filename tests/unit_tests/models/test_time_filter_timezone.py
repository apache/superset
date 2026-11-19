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

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone as dt_timezone
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.superset_typing import AdhocColumn
from superset.utils import json


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


def _date_table(
    extra: str | None,
    sqlalchemy_uri: str = "sqlite://",
    offset: int = 0,
) -> tuple[SqlaTable, TableColumn]:
    """A dataset with one ``DATE`` column ``day``, for compiling time filters."""
    database = Database(database_name="test_db", sqlalchemy_uri=sqlalchemy_uri)
    time_col = TableColumn(column_name="day", is_dttm=1, type="DATE")
    table = SqlaTable(
        table_name="events",
        columns=[time_col],
        main_dttm_col="day",
        database=database,
        extra=extra,
        offset=offset,
    )
    return table, time_col


@pytest.mark.parametrize("dataset_timezone", ["America/New_York", "Asia/Tokyo"])
@pytest.mark.parametrize(
    ("sqlalchemy_uri", "expected_start", "expected_end"),
    [
        ("sqlite://", "'2026-09-20'", "'2026-09-22'"),
        (
            "postgresql://u:p@localhost:5432/db",
            "TO_DATE('2026-09-20', 'YYYY-MM-DD')",
            "TO_DATE('2026-09-22', 'YYYY-MM-DD')",
        ),
    ],
)
def test_get_time_filter_date_column_keeps_boundaries(
    dataset_timezone: str,
    sqlalchemy_uri: str,
    expected_start: str,
    expected_end: str,
    app: Flask,
) -> None:
    """
    A ``DATE`` column holds calendar days with no time of day, so the dataset
    timezone does not move its bounds. Converted bounds land off midnight and
    select one day early or late: west of UTC on SQLite, which compares the
    text, and east of UTC on PostgreSQL, which cuts each bound to its date.
    """
    table, time_col = _date_table(
        json.dumps({"timezone": dataset_timezone}), sqlalchemy_uri
    )

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 9, 20),
            end_dttm=datetime(2026, 9, 22),
        )

    sql = str(clause)
    assert f"day >= {expected_start}" in sql, sql
    assert f"day < {expected_end}" in sql, sql


def test_get_time_filter_date_column_timezone_takes_precedence_over_offset(
    app: Flask,
) -> None:
    """
    On a ``DATE`` column the timezone still takes precedence over the Hour
    Offset, so a whole-day offset is not applied in its place.
    """
    table, time_col = _date_table('{"timezone": "Asia/Tokyo"}', offset=24)

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 9, 20),
            end_dttm=datetime(2026, 9, 22),
        )

    sql = str(clause)
    assert "day >= '2026-09-20'" in sql, sql
    assert "day < '2026-09-22'" in sql, sql


def test_get_time_filter_date_column_invalid_timezone_falls_back_to_offset(
    app: Flask,
) -> None:
    """An unknown timezone on a ``DATE`` column falls back to the Hour Offset."""
    table, time_col = _date_table('{"timezone": "Not/AZone"}', offset=24)

    with app.app_context():
        clause = table.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2026, 9, 20),
            end_dttm=datetime(2026, 9, 22),
        )

    sql = str(clause)
    assert "day >= '2026-09-19'" in sql, sql
    assert "day < '2026-09-21'" in sql, sql


def _sqlite_dataset(
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
    column_type: str,
    rows: list[str],
    dataset_timezone: str,
) -> SqlaTable:
    """An in-memory SQLite dataset with one temporal column ``day``. The engine
    is disposed when the test ends."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    request.addfinalizer(engine.dispose)
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    connection = engine.raw_connection()
    connection.execute(f"CREATE TABLE events (day {column_type}, val INTEGER)")
    connection.executemany(
        "INSERT INTO events VALUES (?, 1)",
        [(row,) for row in rows],
    )
    connection.commit()
    connection.close()

    @contextmanager
    def mock_get_sqla_engine(
        catalog: str | None = None,
        schema: str | None = None,
        **kwargs: Any,
    ) -> Iterator[Engine]:
        """Hand out the in-memory engine instead of connecting."""
        yield engine

    mocker.patch.object(database, "get_sqla_engine", new=mock_get_sqla_engine)
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )

    return SqlaTable(
        database=database,
        table_name="events",
        main_dttm_col="day",
        extra=json.dumps({"timezone": dataset_timezone}),
        columns=[
            TableColumn(column_name="day", is_dttm=True, type=column_type),
            TableColumn(column_name="val", type="INTEGER"),
        ],
    )


def _axis_query(table: SqlaTable, time_grain: str | None) -> QueryObject:
    """A chart query on ``day`` as the x-axis, from 2026-09-20 to 2026-09-22."""
    base_axis: AdhocColumn = {
        "sqlExpression": "day",
        "label": "day",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
    }
    if time_grain:
        base_axis["timeGrain"] = time_grain
    return QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[base_axis],
        filters=[
            {"col": "day", "op": "TEMPORAL_RANGE", "val": "2026-09-20 : 2026-09-22"}
        ],
        is_timeseries=False,
        row_limit=100,
    )


@pytest.mark.parametrize("dataset_timezone", ["America/New_York", "Asia/Tokyo"])
@pytest.mark.parametrize("time_grain", [None, "P1D"])
def test_date_column_query_returns_and_shows_selected_days(
    dataset_timezone: str,
    time_grain: str | None,
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
) -> None:
    """
    A chart query on a ``DATE`` axis returns the selected days and shows them
    as stored. Converting them selected 09-21 and 09-22 in New York and showed
    them at 20:00 on the day before, and showed the days at 09:00 in Tokyo.
    """
    table = _sqlite_dataset(
        mocker,
        request,
        "DATE",
        ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"],
        dataset_timezone,
    )

    result = table.get_query_result(_axis_query(table, time_grain))

    assert result.df["day"].tolist() == [
        pd.Timestamp("2026-09-20"),
        pd.Timestamp("2026-09-21"),
    ]


def test_date_column_legacy_time_column_shows_selected_days(
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
) -> None:
    """The legacy ``__timestamp`` column of a ``DATE`` granularity is not moved."""
    table = _sqlite_dataset(
        mocker,
        request,
        "DATE",
        ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"],
        "America/New_York",
    )
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[],
        granularity="day",
        from_dttm=pd.Timestamp("2026-09-20"),
        to_dttm=pd.Timestamp("2026-09-22"),
        is_timeseries=True,
        extras={"time_grain_sqla": "P1D"},
        row_limit=100,
    )

    result = table.get_query_result(query_object)

    assert result.df["__timestamp"].tolist() == [
        pd.Timestamp("2026-09-20"),
        pd.Timestamp("2026-09-21"),
    ]


def test_timestamp_column_query_still_uses_dataset_timezone(
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
) -> None:
    """
    A ``TIMESTAMP`` column keeps the conversion: the bounds move to UTC and the
    values are shown in the dataset timezone.
    """
    table = _sqlite_dataset(
        mocker,
        request,
        "TIMESTAMP",
        [
            "2026-09-20 02:00:00",
            "2026-09-20 12:00:00",
            "2026-09-21 12:00:00",
            "2026-09-22 02:00:00",
        ],
        "America/New_York",
    )

    result = table.get_query_result(_axis_query(table, time_grain=None))

    assert "day >= '2026-09-20 04:00:00'" in result.query, result.query
    assert result.df["day"].tolist() == [
        pd.Timestamp("2026-09-20 08:00:00"),
        pd.Timestamp("2026-09-21 08:00:00"),
        pd.Timestamp("2026-09-21 22:00:00"),
    ]


@pytest.mark.parametrize(
    ("column", "expected"),
    [
        ({"column_name": "day", "type": "DATE"}, True),
        ({"column_name": "day", "type": "TIMESTAMP"}, False),
        (TableColumn(column_name="day", type="DATE"), True),
        (TableColumn(column_name="day", type="DATETIME"), False),
        (None, False),
    ],
)
def test_is_date_only_column(column: object, expected: bool) -> None:
    """Column objects and dicts are both read, as in ``_python_date_format``."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.helpers import ExploreMixin

    datasource = MagicMock()
    datasource.db_engine_spec = SqliteEngineSpec
    datasource.db_extra = None
    datasource.get_column = lambda name: column if name == "day" else None

    assert ExploreMixin._is_date_only_column(datasource, "day") is expected
