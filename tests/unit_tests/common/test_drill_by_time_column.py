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
Row-level contract for Drill by from a temporal bucket: a drill returns exactly
the rows its bucket counts in the chart. The frontend keeps every time filter
of the chart as it is and adds the clicked bucket as a grained equality filter
on the x-axis label (``getTemporalBucketDrillByFilter`` in
``plugin-chart-echarts``), so the backend applies the same time rules to both
queries. The queries run through the real query object pipeline on SQLite.
"""

import sqlite3
from copy import deepcopy
from datetime import datetime, timezone
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
MONTHS = ["2003-11", "2003-12", "2004-01", "2004-02"]


def _axis(expression: str, label: str | None = None, **extra: Any) -> dict[str, Any]:
    return {
        "timeGrain": "P1M",
        "columnType": "BASE_AXIS",
        "sqlExpression": expression,
        "label": label or expression,
        "expressionType": "SQL",
        **extra,
    }


X_AXIS = _axis("order_date", isColumnReference=True)


def _temporal(col: str, val: str) -> dict[str, str]:
    return {"col": col, "op": "TEMPORAL_RANGE", "val": val}


def _bucket(col: str, month: str) -> dict[str, Any]:
    """The filter a Drill by from the month bar sends."""
    start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
    return {
        "col": col,
        "op": "==",
        "val": int(start.timestamp() * 1000),
        "grain": "P1M",
    }


@pytest.fixture
def executed_sql() -> list[str]:
    return []


@pytest.fixture
def run_query(
    mocker: MockerFixture, app: Flask, tmp_path: Path, executed_sql: list[str]
) -> Any:
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
        # Processing mutates the columns and filters (e.g. a Time Column
        # override replaces the x-axis expression), so keep the setups intact.
        query = deepcopy(query)
        query_object = factory._query_object_factory.create(
            ChartDataResultType.FULL,
            datasource={"id": 1, "type": "table"},
            datasource_model_instance=dataset,
            metrics=["count"],
            **{"is_timeseries": False, **query},
        )
        query_object = factory._process_query_object(dataset, form_data, query_object)
        sql = dataset.get_query_str_extended(query_object.to_dict(), mutate=True).sql
        executed_sql.append(sql)
        con = sqlite3.connect(path)
        rows = con.execute(sql).fetchall()
        con.close()
        return rows

    with app.test_request_context():
        yield run


def _bar(rows: list[Any], month: str) -> int:
    return sum(row[-1] for row in rows if str(row[0]).startswith(month))


# Each setup is a chart query as the frontend builds it (dashboard filters
# come before the chart's own) and the form data the backend receives.
SETUPS: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {
    "range_and_ship_filter": (
        {
            "columns": [X_AXIS],
            "time_range": RANGE,
            "filters": [_temporal("ship_date", SHIP_RANGE)],
        },
        {"x_axis": "order_date"},
    ),
    "time_column_and_x_axis_no_filter": (
        {
            "columns": [X_AXIS],
            "granularity": "order_date",
            "time_range": RANGE,
            "filters": [
                _temporal("order_date", "No filter"),
                _temporal("ship_date", SHIP_RANGE),
            ],
        },
        {"x_axis": "order_date", "granularity_sqla": "order_date"},
    ),
    "time_column_and_dashboard_x_axis_filter": (
        {
            "columns": [X_AXIS],
            "granularity": "order_date",
            "time_range": RANGE,
            "filters": [
                {**_temporal("order_date", "No filter"), "isExtra": True},
                _temporal("ship_date", SHIP_RANGE),
            ],
        },
        {
            "x_axis": "order_date",
            "granularity_sqla": "order_date",
            "extra_form_data": {
                "filters": [_temporal("order_date", "No filter")],
            },
        },
    ),
    "time_column_overrides_x_axis": (
        {
            "columns": [X_AXIS],
            "granularity": "ship_date",
            "time_range": RANGE,
            "filters": [_temporal("ship_date", SHIP_RANGE)],
        },
        {"x_axis": "order_date", "granularity_sqla": "ship_date"},
    ),
    "custom_sql_x_axis": (
        {
            "columns": [_axis("order_date")],
            "time_range": RANGE,
            "filters": [_temporal("ship_date", SHIP_RANGE)],
        },
        {
            "x_axis": {
                "expressionType": "SQL",
                "sqlExpression": "order_date",
                "label": "order_date",
            },
        },
    ),
    "custom_sql_x_axis_with_own_label": (
        {
            "columns": [_axis("order_date", "order_month")],
            "time_range": RANGE,
            "filters": [_temporal("ship_date", SHIP_RANGE)],
        },
        {
            "x_axis": {
                "expressionType": "SQL",
                "sqlExpression": "order_date",
                "label": "order_month",
            },
        },
    ),
}
EXPECTED_BARS = {
    "range_and_ship_filter": [0, 3, 2, 2],
    "time_column_and_x_axis_no_filter": [0, 0, 2, 2],
    "time_column_and_dashboard_x_axis_filter": [0, 0, 2, 2],
    # Bars count ship_date months: the Time Column replaces the x-axis.
    "time_column_overrides_x_axis": [0, 0, 3, 2],
    "custom_sql_x_axis": [0, 0, 2, 2],
    "custom_sql_x_axis_with_own_label": [0, 0, 2, 2],
}


@pytest.mark.parametrize("setup", list(SETUPS))
def test_drill_by_returns_the_rows_of_the_clicked_bucket(
    run_query: Any, setup: str
) -> None:
    query, form_data = SETUPS[setup]
    axis = query["columns"][0]["label"]
    chart = run_query(query, form_data)
    assert [_bar(chart, month) for month in MONTHS] == EXPECTED_BARS[setup]
    for month in MONTHS:
        drill = run_query(
            {
                **query,
                "columns": [*query["columns"], "status"],
                "filters": [*query["filters"], _bucket(axis, month)],
            },
            form_data,
        )
        assert sum(row[-1] for row in drill) == _bar(chart, month), month


def test_nested_drill_narrows_only_the_bucket(run_query: Any) -> None:
    """A further drill from a status keeps the bucket and the chart filters."""
    query, form_data = SETUPS["time_column_and_dashboard_x_axis_filter"]
    nested = run_query(
        {
            **query,
            "columns": [X_AXIS, "status"],
            "filters": [
                *query["filters"],
                _bucket("order_date", "2004-01"),
                {"col": "status", "op": "==", "val": "A"},
            ],
        },
        form_data,
    )
    assert sum(row[-1] for row in nested) == 1


def test_legacy_time_column_bucket_follows_the_dashboard_time_column(
    run_query: Any,
) -> None:
    """Without an x-axis the bucket filters __timestamp, i.e. the time column
    the chart groups by, including a dashboard Time Column override."""
    query: dict[str, Any] = {
        "is_timeseries": True,
        "granularity": "ship_date",
        "time_range": RANGE,
        "extras": {"time_grain_sqla": "P1M"},
        "filters": [_temporal("order_date", "No filter")],
    }
    form_data = {
        "granularity_sqla": "order_date",
        "extra_form_data": {"granularity_sqla": "ship_date"},
    }
    chart = run_query(query, form_data)
    assert _bar(chart, "2004-01") == 3
    drill = run_query(
        {
            **query,
            "columns": ["status"],
            "filters": [*query["filters"], _bucket("__timestamp", "2004-01")],
        },
        form_data,
    )
    assert sum(row[-1] for row in drill) == 3


def test_expression_x_axis_bucket_compares_an_iso_datetime(
    run_query: Any, executed_sql: list[str]
) -> None:
    """An expression axis has no native type for an engine literal, so the
    bucket is written as the naive ISO datetime, not epoch milliseconds."""
    axis = _axis("DATETIME(order_date)", "order_ts")
    run_query(
        {"columns": [axis, "status"], "filters": [_bucket("order_ts", "2004-01")]},
        {"x_axis": {"sqlExpression": "DATETIME(order_date)", "label": "order_ts"}},
    )
    assert "(DATETIME(order_date)) = '2004-01-01T00:00:00'" in executed_sql[-1]


def test_time_range_filter_on_the_time_column_keeps_a_grained_bucket(
    run_query: Any,
) -> None:
    """A grained bucket on the Time Column (e.g. a Sunburst level) survives the
    Time Range filter the Time Column replaces."""
    query: dict[str, Any] = {
        "columns": ["status"],
        "granularity": "order_date",
        "time_range": RANGE,
        "filters": [_temporal("order_date", "No filter")],
    }
    drill = run_query(
        {**query, "filters": [*query["filters"], _bucket("order_date", "2004-01")]},
        {"granularity_sqla": "order_date"},
    )
    assert sum(row[-1] for row in run_query(query, {})) == 4
    assert sum(row[-1] for row in drill) == 2
