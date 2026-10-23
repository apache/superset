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
Row-level contract for the Drill by queries the frontend builds from a
temporal bucket (``superset-frontend/src/components/Chart/DrillBy/
drillByTimeRange.ts``): a drill returns exactly the rows its bucket counts in
the chart. The queries run through the real query object pipeline on SQLite.
"""

import sqlite3
from pathlib import Path
from typing import Any

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database

# (order_date, ship_date, status)
ORDERS = [
    ("2003-11-20 10:00:00", "2003-12-05 00:00:00", "A"),
    ("2003-12-05 10:00:00", "2003-12-20 00:00:00", "A"),
    ("2003-12-10 10:00:00", "2004-01-10 00:00:00", "A"),
    ("2003-12-20 10:00:00", "2004-01-05 00:00:00", "B"),
    ("2003-12-28 10:00:00", "2004-02-01 00:00:00", "A"),
    ("2004-01-05 10:00:00", "2004-01-20 00:00:00", "A"),
    ("2004-01-25 10:00:00", "2004-02-10 00:00:00", "B"),
    ("2004-02-10 10:00:00", "2004-03-01 00:00:00", "A"),
    ("2004-02-20 10:00:00", "2004-07-01 00:00:00", "A"),
]
RANGE = "2004-01-01 : 2005-01-01"
SHIP_RANGE = "2003-01-01 : 2004-06-01"
X_AXIS = {
    "timeGrain": "P1M",
    "columnType": "BASE_AXIS",
    "sqlExpression": "order_date",
    "label": "order_date",
    "expressionType": "SQL",
    "isColumnReference": True,
}


def _temporal(col: str, val: str) -> dict[str, str]:
    return {"col": col, "op": "TEMPORAL_RANGE", "val": val}


@pytest.fixture
def run_query(mocker: MockerFixture, app: Flask, tmp_path: Path) -> Any:
    path = tmp_path / "orders.db"
    con = sqlite3.connect(path)
    con.execute(
        "CREATE TABLE orders (order_date TIMESTAMP, ship_date TIMESTAMP, status TEXT)"
    )
    con.executemany("INSERT INTO orders VALUES (?, ?, ?)", ORDERS)
    con.commit()
    con.close()
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    dataset = SqlaTable(
        id=1,
        table_name="orders",
        columns=[
            TableColumn(column_name="order_date", is_dttm=1, type="TIMESTAMP"),
            TableColumn(column_name="ship_date", is_dttm=1, type="TIMESTAMP"),
            TableColumn(column_name="status", type="TEXT"),
        ],
        main_dttm_col="order_date",
        database=Database(
            id=1, database_name="orders", sqlalchemy_uri=f"sqlite:///{path}"
        ),
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    factory = QueryContextFactory()

    def run(query: dict[str, Any], form_data: dict[str, Any]) -> list[Any]:
        query_object = factory._query_object_factory.create(
            ChartDataResultType.FULL,
            datasource={"id": 1, "type": "table"},
            datasource_model_instance=dataset,
            metrics=["count"],
            is_timeseries=False,
            **query,
        )
        query_object = factory._process_query_object(dataset, form_data, query_object)
        sql = dataset.get_query_str_extended(query_object.to_dict(), mutate=True).sql
        con = sqlite3.connect(path)
        rows = con.execute(sql).fetchall()
        con.close()
        return rows

    with app.test_request_context():
        yield run


def _bar(rows: list[Any], month: str) -> int:
    return sum(row[-1] for row in rows if str(row[0]).startswith(month))


def test_query_wide_range_does_not_limit_an_unfiltered_x_axis(run_query: Any) -> None:
    """A chart range reaches ship_date only, so the drill keeps the whole bucket."""
    form_data = {"x_axis": "order_date"}
    chart = run_query(
        {
            "columns": [X_AXIS],
            "time_range": RANGE,
            "filters": [_temporal("ship_date", SHIP_RANGE)],
        },
        form_data,
    )
    drill = run_query(
        {
            "columns": [X_AXIS, "status"],
            "filters": [
                _temporal("ship_date", RANGE),
                _temporal("order_date", "2003-12-01T00:00:00 : 2004-01-01T00:00:00"),
            ],
        },
        form_data,
    )
    assert _bar(chart, "2003-12") == 3
    assert sum(row[-1] for row in drill) == 3


def test_time_column_filters_the_drill_by_the_first_x_axis_filter(
    run_query: Any,
) -> None:
    """With a time column, every x-axis filter is dropped and the first one
    filters the time column, so it must carry the bucket."""
    form_data = {"x_axis": "order_date"}
    chart = run_query(
        {
            "columns": [X_AXIS],
            "granularity": "order_date",
            "time_range": RANGE,
            "filters": [
                _temporal("order_date", "No filter"),
                _temporal("ship_date", SHIP_RANGE),
            ],
        },
        form_data,
    )
    bucket = "2004-01-01T00:00:00 : 2004-02-01T00:00:00"

    def drill(saved_order_date: str) -> int:
        rows = run_query(
            {
                "columns": [X_AXIS, "status"],
                "granularity": "order_date",
                "filters": [
                    _temporal("order_date", saved_order_date),
                    _temporal("ship_date", RANGE),
                    _temporal("order_date", bucket),
                ],
            },
            form_data,
        )
        return sum(row[-1] for row in rows)

    assert _bar(chart, "2004-01") == 2
    assert drill(bucket) == 2
    # The bucket alone is dropped with the other x-axis filters.
    assert drill(RANGE) == 4
