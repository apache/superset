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
"""A Sunburst drill on a grained temporal ring returns that ring's rows.

The Sunburst groups a grained temporal level through a ``BASE_AXIS`` column,
which applies the dataset Hours offset before time grain truncation. Drill to
detail and Drill by send the clicked bucket as a ``TEMPORAL_RANGE`` filter in
local (offset) time, so the filter bounds must be shifted back by the offset to
select the same rows the ring counted.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Any

import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.superset_typing import AdhocColumn, QueryObjectDict
from superset.utils.core import QueryObjectFilterClause

# Raw (stored) timestamps. With a +5h offset, the first row is locally
# 2026-08-01 01:00 (August) and the last is locally 2026-09-01 01:00
# (September), so a filter that ignores the offset moves both across months.
ROWS = [
    ("2026-07-31 20:00:00", "a"),
    ("2026-08-10 12:00:00", "a"),
    ("2026-08-20 12:00:00", "b"),
    ("2026-08-31 18:59:59", "b"),
    ("2026-08-31 20:00:00", "a"),
    ("2026-09-15 12:00:00", "b"),
]

# Bucket start (local time) -> exclusive end, the range the frontend sends.
MONTH_RANGES = {
    "2026-07-01T00:00:00": "2026-08-01T00:00:00",
    "2026-08-01T00:00:00": "2026-09-01T00:00:00",
    "2026-09-01T00:00:00": "2026-10-01T00:00:00",
}


@pytest.fixture
def events_table(mocker: MockerFixture, session: Session) -> SqlaTable:
    SqlaTable.metadata.create_all(session.get_bind())
    engine: Engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    connection = engine.raw_connection()
    connection.execute("CREATE TABLE events (order_date TIMESTAMP, kind TEXT)")
    for ts, kind in ROWS:
        connection.execute("INSERT INTO events VALUES (?, ?)", (ts, kind))
    connection.commit()

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

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
    return SqlaTable(
        database=database,
        schema=None,
        table_name="events",
        offset=5,
        columns=[
            TableColumn(column_name="order_date", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="kind", type="TEXT"),
        ],
    )


def _ring_counts(table: SqlaTable) -> dict[str, int]:
    """Row count per month bucket, grouped the way Sunburst buildQuery does."""
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[
            AdhocColumn(
                timeGrain="P1M",
                columnType="BASE_AXIS",
                sqlExpression="order_date",
                label="order_date",
                isColumnReference=True,
            )
        ],
        extras={"time_grain_sqla": "P1M"},
        row_limit=100,
    )
    df = table.get_query_result(query_object).df
    return {
        ts.strftime("%Y-%m-%dT%H:%M:%S"): int(ct)
        for ts, ct in zip(df["order_date"], df["ct"], strict=True)
    }


def _drill_filter(since: str, until: str) -> QueryObjectFilterClause:
    return {"col": "order_date", "op": "TEMPORAL_RANGE", "val": f"{since} : {until}"}


def _drill_to_detail_count(table: SqlaTable, since: str, until: str) -> int:
    query_object = QueryObject(
        datasource=table,
        columns=["order_date", "kind"],
        metrics=[],
        filters=[_drill_filter(since, until)],
        row_limit=100,
    )
    return len(table.get_query_result(query_object).df)


def _drill_by_count(table: SqlaTable, since: str, until: str) -> int:
    query_object = QueryObject(
        datasource=table,
        columns=["kind"],
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        filters=[_drill_filter(since, until)],
        row_limit=100,
    )
    return int(table.get_query_result(query_object).df["ct"].sum())


def test_sunburst_ring_buckets_apply_the_hours_offset(
    events_table: SqlaTable, app: Flask
) -> None:
    with app.test_request_context():
        counts = _ring_counts(events_table)

    assert counts == {
        "2026-08-01T00:00:00": 4,
        "2026-09-01T00:00:00": 2,
    }


@pytest.mark.parametrize("drill_count", [_drill_to_detail_count, _drill_by_count])
def test_sunburst_drill_range_matches_ring_bucket_with_hours_offset(
    events_table: SqlaTable,
    app: Flask,
    drill_count: Any,
) -> None:
    """Every ring bucket's drill returns exactly the rows the ring counted."""
    with app.test_request_context():
        counts = _ring_counts(events_table)
        drilled = {
            since: drill_count(events_table, since, MONTH_RANGES[since])
            for since in counts
        }

    assert drilled == counts
    assert sum(drilled.values()) == len(ROWS)


def test_sunburst_drill_range_bounds_are_shifted_by_hours_offset(
    events_table: SqlaTable, app: Flask
) -> None:
    """The August bucket filter compiles to [07-31 19:00, 08-31 19:00) raw."""
    query_obj: QueryObjectDict = {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "filter": [_drill_filter("2026-08-01T00:00:00", "2026-09-01T00:00:00")],
        "metrics": [],
        "columns": ["order_date", "kind"],
    }
    with app.test_request_context():
        sql = events_table.get_query_str_extended(query_obj, mutate=False).sql

    assert "'2026-07-31 19:00:00'" in sql, sql
    assert "'2026-08-31 19:00:00'" in sql, sql
    assert datetime(2026, 8, 1).isoformat(" ") not in sql, sql
