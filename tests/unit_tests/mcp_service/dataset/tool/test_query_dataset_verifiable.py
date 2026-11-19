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

"""query_dataset reports what the engine applied and whether rows were cut.

Every test goes through the MCP client, the real tool and the real
``ChartDataCommand`` envelope, so the assertions cover the wire response a
reporting client reads, not a helper in isolation.
"""

from __future__ import annotations

import importlib
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json
from tests.unit_tests.mcp_service.chart.query_result_fixtures import (
    chart_data_command_result,
)

query_dataset_module = importlib.import_module(
    "superset.mcp_service.dataset.tool.query_dataset"
)


@pytest.fixture(autouse=True)
def _mock_auth() -> Generator[None, None, None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as get_user,
        patch.object(
            query_dataset_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        get_user.return_value = Mock(id=1, username="admin")
        yield


def _column(name: str, is_dttm: bool = False) -> MagicMock:
    column = MagicMock()
    column.column_name = name
    column.is_dttm = is_dttm
    column.type = "TIMESTAMP" if is_dttm else "VARCHAR"
    column.python_date_format = None
    return column


def _dataset() -> MagicMock:
    dataset = MagicMock()
    dataset.id = 7
    dataset.table_name = "orders"
    dataset.main_dttm_col = "order_date"
    dataset.columns = [
        _column("region"),
        _column("segment"),
        _column("order_date", is_dttm=True),
    ]
    metric = MagicMock()
    metric.metric_name = "count"
    dataset.metrics = [metric]
    # No engine spec: temporal SIMPLE-filter validation is not under test here.
    dataset.database = MagicMock(db_engine_spec=None)
    return dataset


def _engine_result(
    rows: list[dict[str, Any]],
    *,
    applied: list[str] = (),  # type: ignore[assignment]
    rejected: list[tuple[str, str]] = (),  # type: ignore[assignment]
    template: list[str] = (),  # type: ignore[assignment]
    bounds: tuple[datetime | None, datetime | None] = (None, None),
) -> dict[str, Any]:
    """A real command envelope carrying the engine's filter metadata."""
    result = chart_data_command_result(rows)
    query = result["queries"][0]
    query["from_dttm"], query["to_dttm"] = bounds
    query["applied_filters"] = [{"column": column} for column in applied]
    query["rejected_filters"] = [
        {"column": column, "reason": reason} for column, reason in rejected
    ]
    query["rejected_filter_columns"] = [
        column for column, reason in rejected if reason == "not_in_datasource"
    ]
    query["applied_template_filters"] = list(template)
    return result


@contextmanager
def _engine(result: dict[str, Any]) -> Iterator[list[dict[str, Any]]]:
    captured: list[dict[str, Any]] = []

    def create(**kwargs: Any) -> MagicMock:
        captured.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=_dataset()),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate"
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=create,
        ),
    ):
        yield captured


async def _call(request: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    async with Client(mcp) as client:
        result = await client.call_tool(
            "query_dataset",
            {"request": {"dataset_id": 7, "metrics": ["count"], **request}},
            raise_on_error=False,
        )
    return json.loads(result.content[0].text), result.is_error


ROWS = [{"region": "east", "count": 3}, {"region": "west", "count": 4}]
REGION = {"col": "region", "op": "==", "val": "east"}
JANUARY = (datetime(2026, 1, 1), datetime(2026, 2, 1))


def _statuses(payload: dict[str, Any]) -> dict[str, str]:
    return {entry["col"]: entry["status"] for entry in payload["filter_status"]}


# --- Filter enforcement -----------------------------------------------------


@pytest.mark.asyncio
async def test_filter_reported_applied_by_engine_is_applied() -> None:
    with _engine(_engine_result(ROWS, applied=["region"])):
        payload, _ = await _call({"columns": ["region"], "filters": [REGION]})

    assert _statuses(payload) == {"region": "applied"}
    assert payload["filter_status"][0]["reason"] is None
    assert not any("filter" in warning.lower() for warning in payload["warnings"])


@pytest.mark.asyncio
async def test_filter_rejected_by_engine_is_reported_not_echoed() -> None:
    """The engine dropped the filter; the old response still listed it."""
    result = _engine_result(ROWS, rejected=[("region", "not_in_datasource")])
    with _engine(result):
        payload, is_error = await _call({"columns": ["region"], "filters": [REGION]})

    assert is_error is False
    assert _statuses(payload) == {"region": "rejected"}
    assert payload["filter_status"][0]["reason"] == "not_in_datasource"
    assert any("region" in warning for warning in payload["warnings"])
    # Rows are still returned in the default (non-strict) mode.
    assert payload["row_count"] == 2


@pytest.mark.asyncio
async def test_filter_consumed_by_template_is_unresolved() -> None:
    result = _engine_result(ROWS, applied=["region"], template=["region"])
    with _engine(result):
        payload, _ = await _call({"columns": ["region"], "filters": [REGION]})

    assert _statuses(payload) == {"region": "unresolved"}
    assert "template" in payload["filter_status"][0]["reason"]


@pytest.mark.asyncio
async def test_filter_not_reported_by_engine_is_unresolved() -> None:
    with _engine(_engine_result(ROWS)):
        payload, _ = await _call({"columns": ["region"], "filters": [REGION]})

    assert _statuses(payload) == {"region": "unresolved"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("time_column", "bounds", "status"),
    [
        ("order_date", JANUARY, "applied"),
        ("order_date", (None, None), "unresolved"),
        ("region", JANUARY, "rejected"),
    ],
    ids=["engine-bounds", "no-engine-bounds", "not-a-datetime-column"],
)
async def test_time_range_status_follows_engine_time_bounds(
    time_column: str, bounds: tuple[Any, Any], status: str
) -> None:
    """The time range is applied as the engine's primary bounds, not a filter.

    The query context removes the TEMPORAL_RANGE filter on the time column, so
    it never appears in the engine's filter report. A time column that is not
    a datetime column is swapped by the engine and the range is not applied.
    """
    with _engine(_engine_result(ROWS, bounds=bounds)):
        payload, _ = await _call(
            {
                "columns": ["region"],
                "time_range": "2026-01-01 : 2026-02-01",
                "time_column": time_column,
            }
        )

    assert payload["applied_filters"][0]["op"] == "TEMPORAL_RANGE"
    assert payload["filter_status"][0]["col"] == time_column
    assert payload["filter_status"][0]["status"] == status


@pytest.mark.asyncio
async def test_other_filter_on_time_column_does_not_mask_missing_bounds() -> None:
    """An applied comparison on order_date is no proof the range applied."""
    result = _engine_result(ROWS, applied=["order_date"])
    with _engine(result):
        payload, _ = await _call(
            {
                "columns": ["region"],
                "filters": [{"col": "order_date", "op": ">=", "val": "2026-01-01"}],
                "time_range": "2026-01-01 : 2026-02-01",
            }
        )

    assert [entry["status"] for entry in payload["filter_status"]] == [
        "applied",
        "unresolved",
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "engine",
    [
        {"rejected": [("region", "not_in_datasource")]},
        {"applied": ["region"], "template": ["region"]},
        {},
    ],
    ids=["rejected", "template-consumed", "unreported"],
)
async def test_strict_filters_blocks_rows_unless_every_filter_applied(
    engine: dict[str, Any],
) -> None:
    with _engine(_engine_result(ROWS, **engine)):
        payload, is_error = await _call(
            {"columns": ["region"], "filters": [REGION], "strict_filters": True}
        )

    assert payload["error_type"] == "FilterNotApplied"
    assert "region" in payload["error"]
    assert "data" not in payload


@pytest.mark.asyncio
async def test_strict_filters_returns_rows_when_every_filter_applied() -> None:
    with _engine(_engine_result(ROWS, applied=["region"], bounds=JANUARY)):
        payload, _ = await _call(
            {
                "columns": ["region"],
                "filters": [REGION],
                "time_range": "Last week",
                "strict_filters": True,
            }
        )

    assert payload.get("error_type") is None
    assert set(_statuses(payload).values()) == {"applied"}
    assert payload["row_count"] == 2


# --- Completeness -----------------------------------------------------------


@pytest.mark.asyncio
async def test_rows_beyond_row_limit_are_reported_truncated() -> None:
    """One extra probe row proves more rows matched than were returned."""
    rows = [{"region": f"r{index}", "count": index} for index in range(3)]
    with _engine(_engine_result(rows, applied=[])) as captured:
        payload, _ = await _call({"columns": ["region"], "row_limit": 2})

    assert captured[0]["row_limit"] == 3
    assert payload["truncated"] is True
    assert payload["row_limit"] == 2
    assert payload["row_count"] == 2
    assert len(payload["data"]) == 2
    # The number of matching rows is unknown, so it is not reported as 2 or 3.
    assert payload["total_rows"] is None
    assert any("row_limit" in warning for warning in payload["warnings"])


@pytest.mark.asyncio
async def test_rows_within_row_limit_are_reported_complete() -> None:
    with _engine(_engine_result(ROWS)):
        payload, _ = await _call({"columns": ["region"], "row_limit": 2})

    assert payload["truncated"] is False
    assert payload["row_count"] == 2
    assert payload["total_rows"] == 2


@pytest.mark.asyncio
async def test_empty_result_is_complete_not_unknown() -> None:
    with _engine(_engine_result([])):
        payload, _ = await _call({"columns": ["region"], "row_limit": 2})

    assert payload["row_count"] == 0
    assert payload["truncated"] is False


@pytest.mark.asyncio
async def test_server_row_cap_makes_completeness_unknown(
    app: Any,
) -> None:
    """A server cap below the request leaves no room for the probe row."""
    rows = [{"region": f"r{index}", "count": index} for index in range(2)]
    previous = app.config["SQL_MAX_ROW"]
    app.config["SQL_MAX_ROW"] = 2
    try:
        with _engine(_engine_result(rows)) as captured:
            payload, _ = await _call({"columns": ["region"], "row_limit": 5})
    finally:
        app.config["SQL_MAX_ROW"] = previous

    assert captured[0]["row_limit"] == 2
    assert payload["row_limit"] == 2
    assert payload["truncated"] is None
    assert payload["total_rows"] is None
    assert any("capped" in warning for warning in payload["warnings"])


@pytest.mark.asyncio
async def test_real_sql_builder_reports_requested_and_time_filters_applied() -> None:
    """The real SqlaTable builder, not a fixture, decides the filter status.

    Mirrors ``query_actions._filter_status``: the builder's applied and rejected
    filter columns become the payload's ``applied_filters``/``rejected_filters``.
    """
    from sqlalchemy.dialects.sqlite import dialect

    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    database = Database(database_name="test", sqlalchemy_uri="sqlite://")
    engine = MagicMock(dialect=dialect())
    engine_context = MagicMock()
    engine_context.__enter__.return_value = engine
    dataset = SqlaTable(
        id=7,
        table_name="orders",
        database=database,
        main_dttm_col="order_date",
        columns=[
            TableColumn(column_name="region", type="TEXT"),
            TableColumn(column_name="order_date", type="DATETIME", is_dttm=True),
        ],
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    compiled: list[str] = []

    def execute(
        dataset_id: int, datasource_type: str, query: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """Run the real query-context processing and SQL builder."""
        from superset.common.query_context_factory import QueryContextFactory

        with patch.object(
            QueryContextFactory, "_convert_to_model", return_value=dataset
        ):
            query_context = QueryContextFactory().create(
                datasource={"id": dataset_id, "type": datasource_type},
                queries=[query],
                form_data={},
            )
        query_object = query_context.queries[0]
        sqlaq = dataset.get_query_str_extended(query_object.to_dict())
        compiled.append(sqlaq.sql)
        return _engine_result(
            ROWS,
            applied=[str(column) for column in sqlaq.applied_filter_columns],
            rejected=[
                (str(column), "not_in_datasource")
                for column in sqlaq.rejected_filter_columns
            ],
            template=list(sqlaq.applied_template_filters or []),
            bounds=(query_object.from_dttm, query_object.to_dttm),
        )

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(database, "get_sqla_engine", return_value=engine_context),
        patch.object(dataset, "get_sqla_row_level_filters", return_value=[]),
        patch.object(
            query_dataset_module, "execute_tabular_query", side_effect=execute
        ),
    ):
        payload, _ = await _call(
            {
                "columns": ["region"],
                "filters": [REGION],
                "time_range": "2026-01-01 : 2026-02-01",
                "row_limit": 2,
                "strict_filters": True,
            }
        )

    assert payload.get("error_type") is None, payload
    assert _statuses(payload) == {"region": "applied", "order_date": "applied"}
    assert "region = 'east'" in compiled[0]
    assert "order_date >=" in compiled[0]
    assert "LIMIT 3" in compiled[0]


@pytest.mark.asyncio
async def test_rows_dropped_by_the_response_size_guard_are_reported_truncated() -> None:
    """A complete query result trimmed to fit the response is no longer complete."""
    from fastmcp import FastMCP

    from superset.mcp_service.middleware import (
        ResponseSizeGuardMiddleware,
        ToolResultCompatibilityMiddleware,
    )

    server = FastMCP("size-guard")
    tool = await mcp.get_tool("query_dataset")
    assert tool is not None
    server.add_tool(tool)
    server.add_middleware(ResponseSizeGuardMiddleware(max_bytes=4_000))
    # The guard returns text only, as in the default server stack.
    server.add_middleware(
        ToolResultCompatibilityMiddleware(structured_output_enabled=False)
    )
    rows = [{"region": "r" * 40 + str(index), "count": index} for index in range(200)]
    with _engine(_engine_result(rows)):
        async with Client(server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 7,
                        "metrics": ["count"],
                        "columns": ["region"],
                        "row_limit": 1000,
                    }
                },
            )
    payload = json.loads(result.content[0].text)

    assert payload["_response_truncated"] is True
    assert payload["row_count"] == len(payload["data"]) < 200
    assert payload["truncated"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("strict", [False, True])
@pytest.mark.parametrize("with_time_range", [False, True])
async def test_multiple_temporal_ranges_on_same_column_are_rejected(
    strict: bool, with_time_range: bool
) -> None:
    december = {
        "col": "order_date",
        "op": "TEMPORAL_RANGE",
        "val": "2025-12-01 : 2026-01-01",
    }
    january = {
        "col": "order_date",
        "op": "TEMPORAL_RANGE",
        "val": "2026-01-01 : 2026-02-01",
    }
    request: dict[str, Any] = {"strict_filters": strict, "filters": [december]}
    if with_time_range:
        request["time_range"] = january["val"]
    else:
        request["filters"].append(january)
    with _engine(_engine_result(ROWS, bounds=JANUARY)) as queries:
        payload, _ = await _call(request)
    assert payload.get("error_type") == "ValidationError"
    assert "multiple temporal ranges" in payload["error"].lower()
    assert "data" not in payload
    assert queries == []


@pytest.mark.asyncio
@pytest.mark.parametrize("strict", [False, True])
@pytest.mark.parametrize("explicit_time_column", [False, True])
async def test_time_range_with_other_temporal_column_is_rejected_before_query(
    strict: bool, explicit_time_column: bool
) -> None:
    """A second column's range must not replace the primary time bounds."""
    request: dict[str, Any] = {
        "strict_filters": strict,
        "time_range": "2026-01-01 : 2026-02-01",
        "filters": [
            {
                "col": "ship_date",
                "op": "TEMPORAL_RANGE",
                "val": "2025-12-01 : 2026-01-01",
            }
        ],
    }
    if explicit_time_column:
        request["time_column"] = "order_date"
    dataset = _dataset()
    dataset.columns.append(_column("ship_date", is_dttm=True))
    with _engine(_engine_result(ROWS, bounds=JANUARY)) as queries:
        with patch.object(
            query_dataset_module, "resolve_dataset", return_value=dataset
        ):
            payload, _ = await _call(request)
    assert payload.get("error_type") == "ValidationError"
    assert "time_range" in payload["error"]
    assert "TEMPORAL_RANGE" in payload["error"]
    assert "data" not in payload
    assert queries == []
