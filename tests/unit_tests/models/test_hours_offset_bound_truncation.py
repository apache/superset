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
"""Regression guards for dataset "Hours offset" bound and grain handling.

Two independent defects are covered here.

Defect 1 -- DATE-column filter bounds use a whole-day effective offset so rendering
    date-only literals cannot discard a sub-day remainder and move the window.

Defect 2 -- grained axis expressions apply the dataset offset in SQL before time
    grain truncation. Dataframe normalization suppresses its legacy post-query
    offset only for labels that were shifted in SQL.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime

import pandas as pd
import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy import column, create_engine, DateTime
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.models.core import Database
from superset.superset_typing import AdhocColumn, QueryObjectDict

# ---------------------------------------------------------------------------
# Defect 1 -- DATE-column filter bound literal truncated to day precision
# ---------------------------------------------------------------------------


def _pg_dataset(offset: int, col_type: str) -> SqlaTable:
    """A Postgres-backed dataset with a single temporal column of ``col_type``
    and the given dataset Hours ``offset``."""
    database = Database(
        id=1,
        database_name="pg",
        # A postgres:// URI selects PostgresEngineSpec; the SQL is only compiled,
        # never executed, so no live server is required.
        sqlalchemy_uri="postgresql://u:p@localhost:5432/db",
    )
    columns = [
        TableColumn(column_name="loan_date", is_dttm=1, type=col_type),
        TableColumn(column_name="value", type="INTEGER"),
    ]
    return SqlaTable(
        table_name="loans",
        columns=columns,
        main_dttm_col="loan_date",
        database=database,
        offset=offset,
    )


def _generated_sql(dataset: SqlaTable, mocker: MockerFixture, app: Flask) -> str:
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    # Requested window: the whole month of August 2026, i.e. [2026-08-01, 2026-09-01).
    query_obj: QueryObjectDict = {
        "granularity": "loan_date",
        "from_dttm": datetime(2026, 8, 1),
        "to_dttm": datetime(2026, 9, 1),
        "is_timeseries": False,
        "filter": [
            {
                "col": "loan_date",
                "op": "TEMPORAL_RANGE",
                "val": "2026-08-01 : 2026-09-01",
            }
        ],
        "metrics": [],
        "columns": ["value"],
    }
    with app.test_request_context():
        return dataset.get_query_str_extended(query_obj, mutate=False).sql


def test_date_column_hours_offset_does_not_shift_selected_day_window(
    mocker: MockerFixture, app: Flask
) -> None:
    """A pure ``DATE`` column stores calendar dates at midnight, so a +1h Hours
    offset can never move a value across a day boundary: the selected window must
    stay 2026-08-01 .. 2026-08-31 (identical to offset 0).

    The bug shifts the bounds back 1h (2026-07-31 23:00 / 2026-08-31 23:00) and
    then truncates each with ``.date()`` -> ``TO_DATE('2026-07-31')`` /
    ``TO_DATE('2026-08-31')``. That window, [2026-07-31, 2026-08-31), admits the
    out-of-range day 2026-07-31 and silently drops the last requested day,
    2026-08-31.
    """
    sql = _generated_sql(_pg_dataset(1, "DATE"), mocker, app)

    assert ">= TO_DATE('2026-08-01'" in sql, sql
    assert "< TO_DATE('2026-09-01'" in sql, sql
    # The lower bound must not admit the day before the requested range.
    assert ">= TO_DATE('2026-07-31'" not in sql, (
        f"DATE-column +1h offset admits out-of-range day 2026-07-31; SQL was:\n{sql}"
    )
    # The upper bound must not drop the last requested day (2026-08-31).
    assert "< TO_DATE('2026-08-31'" not in sql, (
        f"DATE-column +1h offset drops last requested day 2026-08-31; SQL was:\n{sql}"
    )


@pytest.mark.parametrize(
    ("offset", "expected_start", "expected_end"),
    [
        (0, "2026-08-01", "2026-09-01"),
        (1, "2026-08-01", "2026-09-01"),
        (24, "2026-07-31", "2026-08-31"),
        (25, "2026-07-31", "2026-08-31"),
        (-1, "2026-08-01", "2026-09-01"),
        (-25, "2026-08-02", "2026-09-02"),
    ],
)
def test_date_column_hours_offset_uses_whole_day_bounds(
    offset: int,
    expected_start: str,
    expected_end: str,
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """DATE bounds discard sub-day remainders symmetrically around zero."""
    sql = _generated_sql(_pg_dataset(offset, "DATE"), mocker, app)

    assert f">= TO_DATE('{expected_start}'" in sql, sql
    assert f"< TO_DATE('{expected_end}'" in sql, sql


def test_timestamp_column_hours_offset_preserves_exact_hour_bounds(
    mocker: MockerFixture, app: Flask
) -> None:
    """Control for Defect 1: the same +1h offset on a ``TIMESTAMP`` column keeps
    exact-hour precision (2026-07-31 23:00:00 / 2026-08-31 23:00:00) and loses
    nothing. This passes today and documents that the defect is DATE-specific."""
    sql = _generated_sql(_pg_dataset(1, "TIMESTAMP"), mocker, app)

    assert "2026-07-31 23:00:00" in sql, sql
    assert "2026-08-31 23:00:00" in sql, sql


@pytest.mark.parametrize(
    ("offset", "expected_start", "expected_end"),
    [
        (0, "2026-08-01 00:00:00", "2026-09-01 00:00:00"),
        (1, "2026-07-31 23:00:00", "2026-08-31 23:00:00"),
        (24, "2026-07-31 00:00:00", "2026-08-31 00:00:00"),
        (25, "2026-07-30 23:00:00", "2026-08-30 23:00:00"),
        (-1, "2026-08-01 01:00:00", "2026-09-01 01:00:00"),
        (-25, "2026-08-02 01:00:00", "2026-09-02 01:00:00"),
    ],
)
def test_timestamp_column_hours_offset_uses_exact_hour_bounds(
    offset: int,
    expected_start: str,
    expected_end: str,
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """Timestamp bounds preserve every configured offset hour."""
    sql = _generated_sql(_pg_dataset(offset, "TIMESTAMP"), mocker, app)

    assert expected_start in sql, sql
    assert expected_end in sql, sql


def test_datetime_named_column_keeps_exact_hour_bounds(
    mocker: MockerFixture, app: Flask
) -> None:
    """A DATETIME type name must not be mistaken for a pure DATE type."""
    sql = _generated_sql(_pg_dataset(1, "DATETIME"), mocker, app)

    assert "2026-07-31 23:00:00" in sql, sql
    assert "2026-08-31 23:00:00" in sql, sql


# ---------------------------------------------------------------------------
# Defect 2 -- Hours offset applied after DB-side time-grain truncation
# ---------------------------------------------------------------------------


def _sqlite_dataset(
    mocker: MockerFixture,
    offset: int,
    column_type: str,
    rows: list[str],
) -> tuple[SqlaTable, Engine]:
    """Build an executable SQLite dataset with controlled temporal rows."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    connection = engine.raw_connection()
    connection.execute(f"CREATE TABLE events (ts {column_type}, val INTEGER)")
    connection.executemany(
        "INSERT INTO events VALUES (?, 1)",
        [(row,) for row in rows],
    )
    connection.commit()

    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
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

    return (
        SqlaTable(
            database=database,
            schema=None,
            table_name="events",
            main_dttm_col="ts",
            offset=offset,
            columns=[
                TableColumn(column_name="ts", is_dttm=True, type=column_type),
                TableColumn(column_name="val", type="INTEGER"),
            ],
        ),
        engine,
    )


def _physical_axis_query(table: SqlaTable, time_grain: str | None) -> QueryObject:
    """Build the physical-axis query shape used by legacy time-series charts."""
    return QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[],
        granularity="ts",
        from_dttm=pd.Timestamp("2026-07-01"),
        to_dttm=pd.Timestamp("2026-10-01"),
        is_timeseries=True,
        extras={"time_grain_sqla": time_grain} if time_grain else {},
        row_limit=100,
    )


_EXPECTED_PHYSICAL_AXIS_TIMESTAMPS = {
    ("TIMESTAMP", None): {
        0: "2026-08-01 23:30:00",
        1: "2026-08-02 00:30:00",
        24: "2026-08-02 23:30:00",
        25: "2026-08-03 00:30:00",
        -1: "2026-08-01 22:30:00",
        -25: "2026-07-31 22:30:00",
    },
    ("TIMESTAMP", "P1D"): {
        0: "2026-08-01 00:00:00",
        1: "2026-08-02 00:00:00",
        24: "2026-08-02 00:00:00",
        25: "2026-08-03 00:00:00",
        -1: "2026-08-01 00:00:00",
        -25: "2026-07-31 00:00:00",
    },
    ("DATE", None): {
        0: "2026-08-02 00:00:00",
        1: "2026-08-02 01:00:00",
        24: "2026-08-03 00:00:00",
        25: "2026-08-03 01:00:00",
        -1: "2026-08-01 23:00:00",
        -25: "2026-07-31 23:00:00",
    },
    ("DATE", "P1D"): {
        0: "2026-08-02 00:00:00",
        1: "2026-08-02 00:00:00",
        24: "2026-08-03 00:00:00",
        25: "2026-08-03 00:00:00",
        -1: "2026-08-02 00:00:00",
        -25: "2026-08-01 00:00:00",
    },
}


@pytest.mark.parametrize("column_type", ["DATE", "TIMESTAMP"])
@pytest.mark.parametrize("time_grain", [None, "P1D"])
@pytest.mark.parametrize("offset", [0, 1, 24, 25, -1, -25])
def test_physical_axis_offset_matrix(
    column_type: str,
    time_grain: str | None,
    offset: int,
    mocker: MockerFixture,
) -> None:
    """Physical axes apply each offset once at the precision of their grain."""
    raw_value = "2026-08-02" if column_type == "DATE" else "2026-08-01 23:30:00"
    table, _engine = _sqlite_dataset(mocker, offset, column_type, [raw_value])

    result = table.get_query_result(_physical_axis_query(table, time_grain))

    assert result.df["__timestamp"].tolist() == [
        pd.Timestamp(
            _EXPECTED_PHYSICAL_AXIS_TIMESTAMPS[(column_type, time_grain)][offset]
        )
    ]
    expected_shifted_labels = {"__timestamp"} if time_grain and offset else set()
    assert result.sql_shifted_temporal_labels == expected_shifted_labels


def test_ungrained_physical_axis_offset_is_applied_exactly_once(
    mocker: MockerFixture,
) -> None:
    """An ungrained axis stays on the established pandas-only offset path."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=["2026-08-01 23:30:00"],
    )

    result = table.get_query_result(_physical_axis_query(table, time_grain=None))

    assert result.df["__timestamp"].tolist() == [pd.Timestamp("2026-08-02 00:30:00")]
    assert result.sql_shifted_temporal_labels == set()


def test_negative_subday_date_offset_does_not_move_grained_bucket(
    mocker: MockerFixture,
) -> None:
    """A negative sub-day offset on a DATE grain quantizes to zero days."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=-1,
        column_type="DATE",
        rows=["2026-08-02"],
    )

    result = table.get_query_result(_physical_axis_query(table, time_grain="P1D"))

    assert result.df["__timestamp"].tolist() == [pd.Timestamp("2026-08-02 00:00:00")]
    assert result.sql_shifted_temporal_labels == {"__timestamp"}
    assert "+0 hours" not in result.query


def test_adhoc_base_axis_offset_is_applied_exactly_once(
    mocker: MockerFixture,
) -> None:
    """A non-timeseries BASE_AXIS query shifts before its embedded grain."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=["2026-08-01 23:30:00", "2026-08-02 10:00:00"],
    )
    base_axis: AdhocColumn = {
        "sqlExpression": "ts",
        "label": "ts",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1D",
    }
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[base_axis],
        granularity=None,
        is_timeseries=False,
        extras={},
        row_limit=100,
    )

    result = table.get_query_result(query_object)

    assert result.df["ts"].tolist() == [pd.Timestamp("2026-08-02 00:00:00")]
    assert result.df["ct"].tolist() == [2]
    assert result.sql_shifted_temporal_labels == {"ts"}


def test_adhoc_axis_without_temporal_shift_capability_uses_pandas_fallback(
    mocker: MockerFixture,
) -> None:
    """An ungated engine leaves an adhoc axis shift to pandas."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=["2026-08-01 23:30:00", "2026-08-02 10:00:00"],
    )
    mocker.patch.object(SqliteEngineSpec, "supports_temporal_column_shift", False)
    base_axis: AdhocColumn = {
        "sqlExpression": "ts",
        "label": "ts",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1D",
    }
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[base_axis],
        granularity=None,
        is_timeseries=False,
        extras={},
        row_limit=100,
    )

    result = table.get_query_result(query_object)

    assert set(result.df["ts"]) == {
        pd.Timestamp("2026-08-01 01:00:00"),
        pd.Timestamp("2026-08-02 01:00:00"),
    }
    assert result.df["ct"].tolist() == [1, 1]
    assert result.sql_shifted_temporal_labels == set()
    assert "+1 hours" not in result.query
    assert "DATETIME(DATETIME(ts" not in result.query


def test_adhoc_base_axis_probe_quantizes_date_offset(
    mocker: MockerFixture,
) -> None:
    """A probed DATE expression quantizes a sub-day offset to zero hours."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=-1,
        column_type="TIMESTAMP",
        rows=["2026-08-02"],
    )
    probe = mocker.patch(
        "superset.connectors.sqla.models.get_columns_description",
        return_value=[{"is_dttm": True, "type": "DATE"}],
    )
    base_axis: AdhocColumn = {
        "sqlExpression": "DATE(ts)",
        "label": "ts",
        "isColumnReference": False,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1D",
    }
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[base_axis],
        granularity=None,
        is_timeseries=False,
        extras={},
        row_limit=100,
    )

    result = table.get_query_result(query_object)

    probe.assert_called()
    assert result.df["ts"].tolist() == [pd.Timestamp("2026-08-02 00:00:00")]
    assert result.sql_shifted_temporal_labels == {"ts"}
    assert "-1 hours" not in result.query
    assert "DATETIME(DATETIME(DATE(ts)" not in result.query


def test_engine_without_temporal_shift_capability_uses_pandas_fallback(
    mocker: MockerFixture,
) -> None:
    """An ungated engine leaves the axis unshifted and applies the offset in pandas."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=["2026-08-01 23:30:00"],
    )
    mocker.patch.object(SqliteEngineSpec, "supports_temporal_column_shift", False)

    result = table.get_query_result(_physical_axis_query(table, time_grain="P1D"))

    assert result.df["__timestamp"].tolist() == [pd.Timestamp("2026-08-01 01:00:00")]
    assert result.sql_shifted_temporal_labels == set()
    assert "+1 hours" not in result.query
    assert "DATETIME(DATETIME(ts" not in result.query


def test_grained_physical_filter_sql_is_unchanged(
    mocker: MockerFixture, app: Flask
) -> None:
    """Physical grained filters keep their pre-existing unshifted expression."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=[],
    )
    query_object = QueryObject(
        datasource=table,
        columns=["val"],
        metrics=[],
        is_timeseries=False,
        filters=[
            {
                "col": "ts",
                "op": "TEMPORAL_RANGE",
                "val": "2026-08-02 : 2026-08-03",
                "grain": "P1D",
            }
        ],
    )
    with app.test_request_context():
        query = table.get_query_str_extended(query_object.to_dict(), mutate=False)

    assert query.sql == (
        "SELECT val AS val \n"
        "FROM events \n"
        "WHERE DATETIME(ts, 'start of day') >= '2026-08-01 23:00:00' "
        "AND DATETIME(ts, 'start of day') < '2026-08-02 23:00:00' GROUP BY val"
    )
    assert query.sql_shifted_temporal_labels == set()


def test_grained_adhoc_filter_sql_is_unchanged(
    mocker: MockerFixture, app: Flask
) -> None:
    """A BASE_AXIS-shaped adhoc filter does not opt into the axis-only shift."""
    table, _engine = _sqlite_dataset(
        mocker,
        offset=1,
        column_type="TIMESTAMP",
        rows=[],
    )
    base_axis_filter: AdhocColumn = {
        "sqlExpression": "ts",
        "label": "ts",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1D",
    }
    query_object = QueryObject(
        datasource=table,
        columns=["val"],
        metrics=[],
        is_timeseries=False,
        filters=[
            {
                "col": base_axis_filter,
                "op": "==",
                "val": "2026-08-02 00:00:00",
            }
        ],
    )
    with app.test_request_context():
        query = table.get_query_str_extended(query_object.to_dict(), mutate=False)

    assert query.sql == (
        "SELECT val AS val \n"
        "FROM events \n"
        "WHERE (DATETIME(ts, 'start of day')) = '2026-08-02 00:00:00' GROUP BY val"
    )
    assert query.sql_shifted_temporal_labels == set()


@pytest.mark.parametrize(
    ("offset", "postgres_sql", "sqlite_sql"),
    [
        (1, "ts + INTERVAL '1' HOUR", "DATETIME(ts, '+1 hours')"),
        (-1, "ts + INTERVAL '-1' HOUR", "DATETIME(ts, '-1 hours')"),
        (24, "ts + INTERVAL '24' HOUR", "DATETIME(ts, '+24 hours')"),
        (-25, "ts + INTERVAL '-25' HOUR", "DATETIME(ts, '-25 hours')"),
    ],
)
def test_temporal_column_shift_expression_compiles_for_supported_guard_dialects(
    offset: int,
    postgres_sql: str,
    sqlite_sql: str,
) -> None:
    """The bounded engine hook emits valid PostgreSQL and SQLite shift syntax."""
    source = column("ts", type_=DateTime())

    postgres_shift = PostgresEngineSpec.get_temporal_column_shift_expr(source, offset)
    sqlite_shift = SqliteEngineSpec.get_temporal_column_shift_expr(source, offset)
    postgres_bucket = PostgresEngineSpec.get_timestamp_expr(postgres_shift, None, "P1D")
    sqlite_bucket = SqliteEngineSpec.get_timestamp_expr(sqlite_shift, None, "P1D")

    assert BaseEngineSpec.supports_temporal_column_shift is False
    assert PostgresEngineSpec.supports_temporal_column_shift is True
    assert SqliteEngineSpec.supports_temporal_column_shift is True
    assert str(postgres_shift.compile(dialect=postgresql.dialect())) == postgres_sql
    assert str(sqlite_shift.compile(dialect=sqlite.dialect())) == sqlite_sql
    assert str(postgres_bucket.compile(dialect=postgresql.dialect())) == (
        f"DATE_TRUNC('day', {postgres_sql})"
    )
    assert str(sqlite_bucket.compile(dialect=sqlite.dialect())) == (
        f"DATETIME({sqlite_sql}, 'start of day')"
    )


def test_hours_offset_is_applied_before_time_grain_truncation(
    mocker: MockerFixture, session: Session
) -> None:
    """A row near a day boundary must be bucketed by the grain using its
    offset-shifted (local) time, not its raw time.

    Raw ``2026-08-01 23:30`` at a +1h dataset offset is locally ``2026-08-02
    00:30``; under a daily grain it belongs to 2026-08-02. The bug truncates the
    raw value to 2026-08-01 in the database and only then adds the offset in
    pandas, so the row is mislabeled as 2026-08-01 (a full day early).
    """
    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    connection = engine.raw_connection()
    connection.execute("CREATE TABLE events (ts TIMESTAMP, val INTEGER)")
    # Boundary row (local day 2026-08-02) and a same-local-day daytime row.
    connection.execute("INSERT INTO events VALUES ('2026-08-01 23:30:00', 1)")
    connection.execute("INSERT INTO events VALUES ('2026-08-02 10:00:00', 1)")
    connection.commit()

    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
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

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="events",
        main_dttm_col="ts",
        offset=1,
        columns=[
            TableColumn(column_name="ts", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="val", type="INTEGER"),
        ],
    )

    from superset.common.query_object import QueryObject

    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[],
        granularity="ts",
        from_dttm=pd.Timestamp("2026-07-01"),
        to_dttm=pd.Timestamp("2026-10-01"),
        is_timeseries=True,
        extras={"time_grain_sqla": "P1D"},
        filters=[
            {"col": "ts", "op": "TEMPORAL_RANGE", "val": "2026-07-01 : 2026-10-01"}
        ],
        row_limit=100,
    )

    result = table.get_query_result(query_object)
    bucket_days = {ts.date() for ts in result.df["__timestamp"]}

    # Both rows are locally on 2026-08-02, so every bucket must be 2026-08-02.
    # The bug leaves the boundary row on 2026-08-01.
    assert date(2026, 8, 1) not in bucket_days, (
        "Row raw 2026-08-01 23:30 (local 2026-08-02 00:30) was bucketed to "
        f"2026-08-01, a day early. Buckets: {sorted(bucket_days)}"
    )
    assert bucket_days == {date(2026, 8, 2)}, (
        f"All rows should bucket to 2026-08-02; got {sorted(bucket_days)}"
    )
