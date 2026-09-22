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
"""A time grain passed through ``extra_form_data`` must re-aggregate the data.

Charts built on Generic Chart Axes (anything with an ``x_axis``, e.g.
``echarts_timeseries_bar`` and ``mixed_timeseries``) keep the temporal axis as a
``BASE_AXIS`` adhoc column in ``columns``, and that column's own ``timeGrain``
is what ``SqlaTable.adhoc_column_to_sqla`` turns into the SQL truncation. A
grain override routed only into ``extras["time_grain_sqla"]`` is therefore never
read: the query runs at the chart's saved grain and returns the saved row count,
with no error for the caller to notice.

These tests execute the resulting query against a real SQLite dataset so the
grain override is proven by the returned buckets, not by an echoed field.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.mcp_service.chart.chart_helpers import (
    merge_extra_form_data_filters_into_query,
)
from superset.models.core import Database
from superset.superset_typing import AdhocColumn

# 90 consecutive days starting 2024-01-01: 90 daily buckets, 3 monthly buckets.
_START = datetime(2024, 1, 1)
_DAYS = 90


def _events_dataset(mocker: MockerFixture) -> SqlaTable:
    """An executable SQLite dataset with one row per day."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    connection = engine.raw_connection()
    connection.execute("CREATE TABLE events (ts TIMESTAMP, val INTEGER)")
    connection.executemany(
        "INSERT INTO events VALUES (?, 1)",
        [
            ((_START + timedelta(days=offset)).strftime("%Y-%m-%d %H:%M:%S"),)
            for offset in range(_DAYS)
        ],
    )
    connection.commit()

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):  # noqa: ANN001
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
        main_dttm_col="ts",
        columns=[
            TableColumn(column_name="ts", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="val", type="INTEGER"),
        ],
    )


def _saved_query(time_grain: str) -> dict[str, Any]:
    """The query payload a saved Generic Chart Axes chart stores."""
    base_axis: AdhocColumn = {
        "sqlExpression": "ts",
        "label": "ts",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": time_grain,
    }
    return {
        "columns": [base_axis],
        "metrics": [
            {"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}
        ],
        "filters": [],
        "extras": {"time_grain_sqla": time_grain},
        "row_limit": 1000,
    }


def _buckets(table: SqlaTable, query: dict[str, Any]) -> list[pd.Timestamp]:
    """Execute a query payload and return its temporal buckets."""
    query_object = QueryObject(
        datasource=table,
        metrics=query["metrics"],
        columns=query["columns"],
        filters=query["filters"],
        granularity=query.get("granularity"),
        is_timeseries=False,
        extras=query["extras"],
        row_limit=query["row_limit"],
    )
    return table.get_query_result(query_object).df["ts"].tolist()


@pytest.fixture
def _no_datasource_engine_lookup(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    )


@pytest.mark.usefixtures("_no_datasource_engine_lookup")
def test_extra_form_data_time_grain_re_aggregates_generic_axis_chart(
    mocker: MockerFixture, app_context: None
) -> None:
    """Overriding a daily saved grain with ``P1M`` must return monthly buckets."""
    table = _events_dataset(mocker)

    saved = _saved_query("P1D")
    baseline = _buckets(table, saved)
    assert len(baseline) == _DAYS

    overridden = _saved_query("P1D")
    merge_extra_form_data_filters_into_query(
        overridden, {"time_grain_sqla": "P1M"}, 1, "table"
    )

    monthly = _buckets(table, overridden)

    # The override must change the data, not just the payload: 90 daily rows
    # collapse into the 3 months they span.
    assert monthly != baseline
    assert monthly == [
        pd.Timestamp("2024-01-01"),
        pd.Timestamp("2024-02-01"),
        pd.Timestamp("2024-03-01"),
    ]
    # ...and the BASE_AXIS column, which is what the SQL truncation reads, must
    # carry the new grain alongside the extras entry.
    assert overridden["columns"][0]["timeGrain"] == "P1M"
    assert overridden["extras"]["time_grain_sqla"] == "P1M"


@pytest.mark.usefixtures("_no_datasource_engine_lookup")
def test_extra_form_data_time_grain_refines_generic_axis_chart(
    mocker: MockerFixture, app_context: None
) -> None:
    """The override works in the other direction too: monthly refined to daily."""
    table = _events_dataset(mocker)

    saved = _saved_query("P1M")
    assert len(_buckets(table, saved)) == 3

    overridden = _saved_query("P1M")
    merge_extra_form_data_filters_into_query(
        overridden, {"time_grain_sqla": "P1D"}, 1, "table"
    )

    assert len(_buckets(table, overridden)) == _DAYS


@pytest.mark.usefixtures("_no_datasource_engine_lookup")
def test_time_grain_override_leaves_non_axis_adhoc_columns_alone() -> None:
    """Only the ``BASE_AXIS`` entry carries a grain; other adhoc columns don't."""
    query: dict[str, Any] = {
        "columns": [
            {"sqlExpression": "UPPER(country)", "label": "country"},
            {
                "sqlExpression": "ts",
                "label": "ts",
                "columnType": "BASE_AXIS",
                "timeGrain": "P1D",
            },
        ],
        "filters": [],
    }

    merge_extra_form_data_filters_into_query(
        query, {"time_grain_sqla": "P1M"}, 1, "table"
    )

    assert "timeGrain" not in query["columns"][0]
    assert query["columns"][1]["timeGrain"] == "P1M"


@pytest.mark.usefixtures("_no_datasource_engine_lookup")
def test_no_time_grain_override_preserves_saved_axis_grain() -> None:
    """Without an override the saved ``BASE_AXIS`` grain is left untouched."""
    query = _saved_query("P1D")

    merge_extra_form_data_filters_into_query(
        query, {"time_range": "No filter"}, 1, "table"
    )

    assert query["columns"][0]["timeGrain"] == "P1D"
    assert query["extras"]["time_grain_sqla"] == "P1D"


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="Calls the undecorated execute_chart_data core that master's #44113 "
    "refactor split out of the @tool-wrapped get_chart_data. 7.0 doesn't have "
    "that split (the feature it was extracted for isn't backported), and the "
    "decorated tool can't run outside a live FastMCP Client context. The "
    "underlying time-grain fix is covered directly by the other tests in this "
    "file."
)
@pytest.mark.parametrize(
    "viz_type,query_count",
    [
        ("echarts_timeseries_bar", 1),
        ("mixed_timeseries", 2),
    ],
)
@pytest.mark.parametrize("grain,expected_rows", [(None, 25), ("P1M", 1), ("P1W", 5)])
@pytest.mark.usefixtures("_no_datasource_engine_lookup")
async def test_saved_chart_grain_acceptance(
    mocker: MockerFixture,
    app_context: None,
    grain: str | None,
    expected_rows: int,
    viz_type: str,
    query_count: int,
) -> None:
    """Execute single- and multi-query charts with real temporal aggregation."""
    import importlib
    from contextlib import nullcontext
    from copy import deepcopy
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from sqlalchemy import text

    from superset.mcp_service.chart.schemas import (
        ChartData,
        ChartSql,
        GetChartDataRequest,
    )
    from superset.mcp_service.chart.tool.get_chart_sql import (
        _sql_from_saved_query_context,
    )
    from superset.models.slice import Slice
    from superset.utils import json

    mocker.patch(f"{__name__}._START", datetime(2020, 6, 1))
    table = _events_dataset(mocker)
    table.id = 1
    # Keep 25 June dates spanning all five weekly buckets, plus out-of-range rows.
    with table.database.get_sqla_engine() as engine:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "DELETE FROM events WHERE ts >= '2020-06-06' AND ts < '2020-06-11'"
                )
            )
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=table,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    module = importlib.import_module("superset.mcp_service.chart.tool.get_chart_data")
    query = _saved_query("P1D")
    query["granularity"] = "ts"
    non_axis = {"sqlExpression": "1", "label": "constant", "timeGrain": "P1D"}
    query["columns"].append(deepcopy(non_axis))
    chart = Slice(
        id=1,
        slice_name="Grain acceptance",
        viz_type=viz_type,
        datasource_id=1,
        datasource_type="table",
        table=table,
        params=json.dumps({"viz_type": viz_type}),
        query_context=json.dumps(
            {
                "datasource": {"id": 1, "type": "table"},
                "queries": [deepcopy(query) for _ in range(query_count)],
                "result_type": "full",
                "result_format": "json",
            }
        ),
    )
    mocker.patch.object(module, "find_chart_by_identifier", return_value=chart)
    mocker.patch.object(
        module,
        "validate_chart_dataset",
        return_value=SimpleNamespace(is_valid=True, warnings=[]),
    )
    mocker.patch.object(
        module,
        "event_logger",
        SimpleNamespace(log_context=lambda **kwargs: nullcontext()),
    )
    mocker.patch.object(module.guest_scope, "is_guest_read", return_value=False)
    mocker.patch.object(module.guest_scope, "guest_dashboard_id", return_value=None)
    mock_user = mocker.Mock(id=1, username="admin", roles=[])
    mocker.patch(
        "superset.mcp_service.auth.get_user_from_request", return_value=mock_user
    )
    extra = {"time_range": "2020-06-01 : 2020-07-01"}
    if grain:
        extra["time_grain_sqla"] = grain
    merge_spy = mocker.spy(module, "merge_extra_form_data_filters_into_query")
    response = await module.get_chart_data(
        GetChartDataRequest(
            identifier=1,
            extra_form_data=extra,
            use_cache=False,
            force_refresh=True,
            limit=1000,
        ),
        AsyncMock(),
    )
    assert isinstance(response, ChartData), response
    results = response.query_results or [response]
    assert len(results) == query_count
    counts = [result.row_count for result in results]
    assert counts == [expected_rows] * query_count
    assert [len(result.data) for result in results] == [expected_rows] * query_count
    assert all(sum(row["ct"] for row in result.data) == 25 for result in results)
    for call in merge_spy.call_args_list:
        assert call.args[0]["columns"][1] == non_axis
    if grain is None:
        expected_dates = [
            pd.Timestamp(2020, 6, day)
            for day in range(1, 31)
            if day not in range(6, 11)
        ]
        for result in results:
            actual_dates = pd.to_datetime([row["ts"] for row in result.data])
            assert sorted(actual_dates) == expected_dates
    sql_response = _sql_from_saved_query_context(chart, extra)
    assert isinstance(sql_response, ChartSql), sql_response
    assert not sql_response.error
    sql_counts = []
    with table.database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            for statement in sql_response.sql.split(";"):
                if statement.strip():
                    rows = connection.execute(text(statement)).fetchall()
                    sql_counts.append(len(rows))
                    assert sum(row.ct for row in rows) == 25
    assert sql_counts == [expected_rows] * query_count
