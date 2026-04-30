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

"""Tests for the query_dataset MCP tool."""

from __future__ import annotations

import importlib
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP

from superset.mcp_service.app import mcp
from superset.utils import json

query_dataset_module = importlib.import_module(
    "superset.mcp_service.dataset.tool.query_dataset"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    """Mock authentication and metadata access for all tests."""
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(
            query_dataset_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_column(name: str, is_dttm: bool = False) -> MagicMock:
    """Build a mock SqlaTable column with the given name and datetime flag."""
    col = MagicMock()
    col.column_name = name
    col.is_dttm = is_dttm
    col.verbose_name = None
    col.type = "VARCHAR"
    col.groupby = True
    col.filterable = True
    col.description = None
    return col


def _make_metric(name: str, expression: str = "COUNT(*)") -> MagicMock:
    """Build a mock SqlMetric with the given name and SQL expression."""
    metric = MagicMock()
    metric.metric_name = name
    metric.verbose_name = None
    metric.expression = expression
    metric.description = None
    metric.d3format = None
    return metric


def _make_dataset(
    dataset_id: int = 1,
    table_name: str = "orders",
    columns: list[Any] | None = None,
    metrics: list[Any] | None = None,
    main_dttm_col: str | None = None,
) -> MagicMock:
    """Build a mock SqlaTable dataset with default columns and metrics."""
    ds = MagicMock()
    ds.id = dataset_id
    ds.table_name = table_name
    ds.uuid = f"test-uuid-{dataset_id}"
    ds.main_dttm_col = main_dttm_col
    ds.database = MagicMock()
    ds.database.database_name = "examples"
    ds.columns = columns or [
        _make_column("category"),
        _make_column("region"),
        _make_column("order_date", is_dttm=True),
    ]
    ds.metrics = metrics or [
        _make_metric("count", "COUNT(*)"),
        _make_metric("total_revenue", "SUM(revenue)"),
    ]
    return ds


def _mock_command_result(
    data: list[dict[str, Any]] | None = None,
    colnames: list[str] | None = None,
) -> dict[str, Any]:
    """Build the result dict that ChartDataCommand.run() returns."""
    data = data or [
        {"category": "Electronics", "count": 42},
        {"category": "Clothing", "count": 17},
    ]
    colnames = colnames or ["category", "count"]
    return {
        "queries": [
            {
                "data": data,
                "colnames": colnames,
                "rowcount": len(data),
                "cache_key": "abc123",
                "is_cached": False,
                "cached_dttm": None,
                "cache_timeout": 300,
            }
        ]
    }


@pytest.mark.asyncio
async def test_query_dataset_success(mcp_server: FastMCP) -> None:
    """Happy path: metrics + columns returns data."""
    dataset = _make_dataset()
    result_data = _mock_command_result()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=MagicMock(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "columns": ["category"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["dataset_id"] == 1
    assert data["dataset_name"] == "orders"
    assert data["row_count"] == 2
    assert len(data["data"]) == 2
    assert data["data"][0]["category"] == "Electronics"


@pytest.mark.asyncio
async def test_query_dataset_not_found(mcp_server: FastMCP) -> None:
    """Dataset ID that doesn't exist returns error."""
    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=None,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 999,
                        "metrics": ["count"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "NotFound"
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_query_dataset_invalid_metric(mcp_server: FastMCP) -> None:
    """Unknown metric name returns validation error with suggestions."""
    dataset = _make_dataset()

    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["countt"],  # typo
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    assert "countt" in data["error"]
    # Should suggest "count" as a close match
    assert "count" in data["error"]


@pytest.mark.asyncio
async def test_query_dataset_invalid_column(mcp_server: FastMCP) -> None:
    """Unknown column name returns validation error."""
    dataset = _make_dataset()

    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "columns": ["nonexistent_col"],
                        "metrics": ["count"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    assert "nonexistent_col" in data["error"]


@pytest.mark.asyncio
async def test_query_dataset_no_metrics_no_columns(mcp_server: FastMCP) -> None:
    """Providing neither metrics nor columns raises validation error."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="metrics.*columns"):
            await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": [],
                        "columns": [],
                    }
                },
            )


@pytest.mark.asyncio
async def test_query_dataset_with_time_range(mcp_server: FastMCP) -> None:
    """time_range is converted to TEMPORAL_RANGE filter + granularity."""
    dataset = _make_dataset(main_dttm_col="order_date")
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=capture_create,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "time_range": "Last 7 days",
                    }
                },
            )

    assert len(captured_queries) == 1
    query_dict = captured_queries[0]
    # Should have TEMPORAL_RANGE filter
    temporal_filters = [f for f in query_dict["filters"] if f["op"] == "TEMPORAL_RANGE"]
    assert len(temporal_filters) == 1
    assert temporal_filters[0]["col"] == "order_date"
    assert temporal_filters[0]["val"] == "Last 7 days"
    # Should set granularity
    assert query_dict["granularity"] == "order_date"
    # applied_filters in response must include the synthesized TEMPORAL_RANGE filter
    data = json.loads(result.content[0].text)
    resp_filters = data["applied_filters"]
    temporal_resp = [f for f in resp_filters if f["op"] == "TEMPORAL_RANGE"]
    assert len(temporal_resp) == 1
    assert temporal_resp[0]["col"] == "order_date"
    assert temporal_resp[0]["val"] == "Last 7 days"


@pytest.mark.asyncio
async def test_query_dataset_time_range_no_temporal_column(mcp_server: FastMCP) -> None:
    """time_range without a temporal column returns error."""
    dataset = _make_dataset(main_dttm_col=None)

    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "time_range": "Last 7 days",
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    assert "temporal column" in data["error"].lower()


@pytest.mark.asyncio
async def test_query_dataset_with_filters(mcp_server: FastMCP) -> None:
    """User-provided filters are passed through to the query."""
    dataset = _make_dataset()
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=capture_create,
        ),
    ):
        async with Client(mcp_server) as client:
            await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "filters": [
                            {"col": "category", "op": "==", "val": "Electronics"}
                        ],
                    }
                },
            )

    assert len(captured_queries) == 1
    filters = captured_queries[0]["filters"]
    assert len(filters) == 1
    assert filters[0]["col"] == "category"
    assert filters[0]["op"] == "=="
    assert filters[0]["val"] == "Electronics"


@pytest.mark.asyncio
async def test_query_dataset_empty_results(mcp_server: FastMCP) -> None:
    """Query that returns no data gives a response with row_count=0."""
    dataset = _make_dataset()
    empty_result = {
        "queries": [
            {
                "data": [],
                "colnames": [],
                "rowcount": 0,
                "is_cached": False,
                "cached_dttm": None,
                "cache_timeout": 300,
            }
        ]
    }

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=empty_result,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=MagicMock(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["row_count"] == 0
    assert data["data"] == []
    assert "no data" in data["summary"].lower()


@pytest.mark.asyncio
async def test_query_dataset_by_uuid(mcp_server: FastMCP) -> None:
    """UUID-based lookup works."""
    dataset = _make_dataset()
    result_data = _mock_command_result()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ) as mock_resolve,
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=MagicMock(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
                        "metrics": ["count"],
                    }
                },
            )

    # Verify the resolve function was called with the UUID
    mock_resolve.assert_called_once()
    call_args = mock_resolve.call_args
    assert call_args[0][0] == "a1b2c3d4-5678-90ab-cdef-1234567890ab"

    data = json.loads(result.content[0].text)
    assert data["dataset_id"] == 1


@pytest.mark.asyncio
async def test_query_dataset_permission_denied(mcp_server: FastMCP) -> None:
    """Permission denied from ChartDataCommand.validate() returns error."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    dataset = _make_dataset()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=MagicMock(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="Access denied",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.WARNING,
                )
            ),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "QueryError"


@pytest.mark.asyncio
async def test_query_dataset_order_by_valid(mcp_server: FastMCP) -> None:
    """order_by with valid column/metric names passes through."""
    dataset = _make_dataset()
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=capture_create,
        ),
    ):
        async with Client(mcp_server) as client:
            await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "columns": ["category"],
                        "order_by": ["count"],
                        "order_desc": True,
                    }
                },
            )

    assert len(captured_queries) == 1
    orderby = captured_queries[0].get("orderby", [])
    assert len(orderby) == 1
    assert orderby[0][0] == "count"
    # order_desc=True -> ascending=False
    assert orderby[0][1] is False


@pytest.mark.asyncio
async def test_query_dataset_order_by_invalid(mcp_server: FastMCP) -> None:
    """order_by with an unknown name returns validation error."""
    dataset = _make_dataset()

    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "order_by": ["nonexistent"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    assert "nonexistent" in data["error"]


@pytest.mark.asyncio
async def test_query_dataset_time_column_override(mcp_server: FastMCP) -> None:
    """Explicit time_column overrides dataset main_dttm_col."""
    dataset = _make_dataset(main_dttm_col="order_date")
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=capture_create,
        ),
    ):
        async with Client(mcp_server) as client:
            await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "time_range": "Last 30 days",
                        "time_column": "order_date",
                    }
                },
            )

    assert len(captured_queries) == 1
    query_dict = captured_queries[0]
    assert query_dict["granularity"] == "order_date"
    temporal_filters = [f for f in query_dict["filters"] if f["op"] == "TEMPORAL_RANGE"]
    assert temporal_filters[0]["col"] == "order_date"


@pytest.mark.asyncio
async def test_query_dataset_non_dttm_time_column_warns(mcp_server: FastMCP) -> None:
    """Using a non-datetime column for time_range produces a warning."""
    dataset = _make_dataset(main_dttm_col=None)
    result_data = _mock_command_result()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value=result_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=MagicMock(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "time_range": "Last 7 days",
                        "time_column": "category",
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert len(data["warnings"]) > 0
    assert "not marked as a datetime" in data["warnings"][0]


@pytest.mark.asyncio
async def test_query_dataset_invalid_filter_column(mcp_server: FastMCP) -> None:
    """Filter on a column that doesn't exist returns validation error."""
    dataset = _make_dataset()

    with patch.object(
        query_dataset_module,
        "_resolve_dataset",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "filters": [
                            {
                                "col": "nonexistent",
                                "op": "==",
                                "val": "test",
                            }
                        ],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    assert "nonexistent" in data["error"]


@pytest.mark.asyncio
async def test_query_dataset_metadata_access_denied_no_suggestions(
    mcp_server: FastMCP,
) -> None:
    """Users without data-model metadata access cannot probe column/metric names.

    The privacy gate must fire before the validation step that returns close-match
    suggestions, so restricted users cannot enumerate schema details via typos.
    """
    dataset = _make_dataset()

    with (
        patch.object(
            query_dataset_module,
            "_resolve_dataset",
            return_value=dataset,
        ),
        patch.object(
            query_dataset_module,
            "user_can_view_data_model_metadata",
            return_value=False,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        # Typo that would normally trigger close-match suggestions
                        "metrics": ["countt"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    # Must be denied before returning any schema suggestions
    assert data["error_type"] == "DataModelMetadataRestricted"
    # Must NOT contain column/metric name suggestions
    assert "countt" not in data.get("error", "")
    assert "count" not in data.get("error", "")


@pytest.mark.asyncio
async def test_query_dataset_metadata_access_denied_nonexistent_dataset(
    mcp_server: FastMCP,
) -> None:
    """Metadata-restricted users must not be able to probe dataset existence.

    The privacy gate fires before the DAO lookup, so a restricted caller
    always receives DataModelMetadataRestricted — never NotFound — regardless
    of whether the requested dataset ID exists.
    """
    with patch.object(
        query_dataset_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        # Use a dataset_id that does not exist
                        "dataset_id": 999999,
                        "metrics": ["count"],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    # Must receive restricted error, not a NotFound that leaks existence
    assert data["error_type"] == "DataModelMetadataRestricted"
    assert data["error_type"] != "NotFound"
