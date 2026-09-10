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
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import is_tool_visible_to_current_user
from superset.mcp_service.privacy import tool_requires_data_model_metadata_access
from superset.utils import json
from superset.utils.date_parser import get_since_until

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
            "resolve_dataset",
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
    assert data["from_dttm"] is None
    assert data["to_dttm"] is None
    assert data["row_count"] == 2
    assert len(data["data"]) == 2
    assert data["data"][0]["category"] == "Electronics"


@pytest.mark.asyncio
async def test_query_dataset_exposes_filters_to_jinja_macros(
    mcp_server: FastMCP,
) -> None:
    """The MCP query path populates the form data read by dataset Jinja macros."""
    from superset.common.query_object import QueryObject

    dataset = _make_dataset()
    query = QueryObject(
        filters=[{"col": "category", "op": "IN", "val": ["Electronics"]}],
        columns=["category"],
        metrics=["count"],
    )
    query_context = SimpleNamespace(queries=[query], form_data={})
    observed: dict[str, Any] = {}

    def run_query() -> dict[str, Any]:
        from superset.jinja_context import ExtraCache, get_dataset_id_from_context

        extra_cache = ExtraCache()
        observed["filter_values"] = extra_cache.filter_values("category")
        observed["get_filters"] = extra_cache.get_filters("category")
        # metric() without an explicit dataset ID uses this same context lookup.
        observed["metric_dataset_id"] = get_dataset_id_from_context("count")
        return _mock_command_result()

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            return_value=query_context,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate",
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            side_effect=run_query,
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
                        "filters": [
                            {
                                "col": "category",
                                "op": "IN",
                                "val": ["Electronics"],
                            }
                        ],
                    }
                },
            )

    assert not result.is_error
    assert observed["filter_values"] == ["Electronics"]
    assert observed["get_filters"] == [
        {"col": "category", "op": "IN", "val": ["Electronics"]}
    ]
    assert observed["metric_dataset_id"] == 1


@pytest.mark.asyncio
async def test_query_dataset_not_found(mcp_server: FastMCP) -> None:
    """Dataset ID that doesn't exist returns error."""
    with patch.object(
        query_dataset_module,
        "resolve_dataset",
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
        "resolve_dataset",
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
        "resolve_dataset",
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
            "resolve_dataset",
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
        "resolve_dataset",
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
            "resolve_dataset",
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
            "resolve_dataset",
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
            "resolve_dataset",
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
            "resolve_dataset",
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
            "resolve_dataset",
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
        "resolve_dataset",
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
            "resolve_dataset",
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
            "resolve_dataset",
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
        "resolve_dataset",
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
            "resolve_dataset",
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


@pytest.mark.asyncio
async def test_query_dataset_registered_tool_requires_metadata_access(
    mcp_server: FastMCP,
) -> None:
    """The tool object FastMCP actually registers carries the data-model
    metadata marker, so ``is_tool_visible_to_current_user`` can hide it from
    restricted users at ``tools/list`` time — matching list_datasets and
    get_dataset_info.
    """
    tool = await mcp_server.get_tool("query_dataset")
    assert tool is not None
    assert tool_requires_data_model_metadata_access(tool.fn) is True


@pytest.mark.asyncio
async def test_query_dataset_hidden_from_tools_list_when_metadata_restricted(
    mcp_server: FastMCP, app: Any
) -> None:
    """query_dataset is hidden from tools/list for metadata-restricted users,
    mirroring list_datasets and get_dataset_info.
    """
    from flask import g

    tool = await mcp_server.get_tool("query_dataset")
    assert tool is not None

    app.config["MCP_RBAC_ENABLED"] = True
    try:
        with app.app_context():
            g.user = Mock(username="restricted-user")

            with (
                patch(
                    "superset.mcp_service.auth.security_manager.can_access",
                    return_value=True,
                ),
                patch(
                    "superset.mcp_service.privacy.user_can_view_data_model_metadata",
                    return_value=False,
                ),
            ):
                assert is_tool_visible_to_current_user(tool) is False

            with (
                patch(
                    "superset.mcp_service.auth.security_manager.can_access",
                    return_value=True,
                ),
                patch(
                    "superset.mcp_service.privacy.user_can_view_data_model_metadata",
                    return_value=True,
                ),
            ):
                assert is_tool_visible_to_current_user(tool) is True
    finally:
        app.config.pop("MCP_RBAC_ENABLED", None)


class TestQueryDatasetBracketShorthandNormalization:
    """QueryDatasetRequest normalizes bracket-shorthand time ranges.

    LLM clients sometimes pass values like '[year]' or '[quarter]' after
    seeing grain tokens in dashboard filter contexts.  Passed through
    unnormalized, these separator-less tokens match none of
    get_since_until()'s recognized prefixes and silently resolve to an
    unbounded range (matching the whole table) instead of raising an
    error.  The schema validator maps day-and-up units ('[day]' through
    '[year]') to the canonical 'Last <unit>' form, and sub-day units
    ('[second]'/'[minute]'/'[hour]') to an explicit DATEADD/DATETIME
    expression, so get_since_until() resolves them to an actual bounded
    range.
    """

    def test_year_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[year]"}
        )
        assert req.time_range == "Last year"

    def test_quarter_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[quarter]"}
        )
        assert req.time_range == "Last quarter"

    def test_month_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[month]"}
        )
        assert req.time_range == "Last month"

    def test_week_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[week]"}
        )
        assert req.time_range == "Last week"

    def test_day_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[day]"}
        )
        assert req.time_range == "Last day"

    def test_hour_bracket_normalized(self) -> None:
        """'[hour]' maps to an explicit DATEADD/DATETIME expression.

        A bare 'Last hour' can't be used as-is: get_since_until() resolves
        its since-expression against 'now' but its default until-expression
        against 'today' (midnight), so since ends up after until and raises
        a "From date cannot be larger than to date" error. The validator
        applies the same rewrite to both spellings -- see
        test_bare_sub_day_last_normalized below.
        """
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[hour]"}
        )
        assert req.time_range == "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"

    def test_minute_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[minute]"}
        )
        assert (
            req.time_range == "DATEADD(DATETIME('now'), -1, MINUTE) : DATETIME('now')"
        )

    def test_second_bracket_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[second]"}
        )
        assert (
            req.time_range == "DATEADD(DATETIME('now'), -1, SECOND) : DATETIME('now')"
        )

    @pytest.mark.parametrize(
        "value,expected",
        [
            ("Last hour", "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"),
            (
                "Last 15 minutes",
                "DATEADD(DATETIME('now'), -15, MINUTE) : DATETIME('now')",
            ),
            (
                "Last 30 seconds",
                "DATEADD(DATETIME('now'), -30, SECOND) : DATETIME('now')",
            ),
        ],
    )
    def test_bare_sub_day_last_normalized(self, value: str, expected: str) -> None:
        """Sub-day 'Last ...' gets the same rewrite as its bracket form.

        Without it these reach get_since_until() as-is and raise "From date
        cannot be larger than to date" from deep in the query path, rather
        than being resolved to the range the caller asked for.
        """
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": value}
        )
        assert req.time_range == expected

    def test_bracket_uppercase_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[YEAR]"}
        )
        assert req.time_range == "Last year"

    def test_bracket_with_whitespace_normalized(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "  [year]  "}
        )
        assert req.time_range == "Last year"

    def test_valid_superset_range_unchanged(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "Last 7 days"}
        )
        assert req.time_range == "Last 7 days"

    def test_iso_range_unchanged(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {
                "dataset_id": 1,
                "metrics": ["count"],
                "time_range": "2024-01-01 : 2024-12-31",
            }
        )
        assert req.time_range == "2024-01-01 : 2024-12-31"

    def test_non_bracket_value_is_stripped(self) -> None:
        """Non-bracket values must be trimmed too, not just the lookup key.

        Otherwise leading/trailing whitespace around an otherwise valid
        relative range (e.g. from an LLM) would propagate to
        get_since_until() and could cause avoidable parse failures.
        """
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "  Last 7 days  "}
        )
        assert req.time_range == "Last 7 days"

    def test_time_range_field_description_examples_are_parseable(self) -> None:
        """Every relative shorthand named in the time_range field description
        must actually resolve to a bounded range via get_since_until().

        Regression guard: the description previously named 'this week' as
        an example, but that value has no ' : ' separator and matches none
        of get_since_until()'s recognized prefixes, so it silently resolved
        to an unbounded range (matching the whole table) instead of the
        current period. 'Current week' is the working equivalent.
        """
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        description = QueryDatasetRequest.model_fields["time_range"].description or ""
        for example in [
            "Last 7 days",
            "Last month",
            "Last year",
            "Last quarter",
            "Current week",
            "previous calendar year",
        ]:
            assert f"'{example}'" in description, (
                f"{example!r} missing from time_range field description"
            )
            since, until = get_since_until(time_range=example)
            assert since is not None, f"{example!r} did not resolve to a bounded range"
            assert until is not None
            assert since < until

    def test_none_unchanged(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": None}
        )
        assert req.time_range is None


class TestQueryDatasetTimeRangeValidation:
    """QueryDatasetRequest.time_range rejects values get_since_until()
    would otherwise silently resolve to an unbounded, full-table range.

    See SC-114824: shared validator in
    superset.mcp_service.common.time_range_validation. Complements
    TestQueryDatasetBracketShorthandNormalization above, which only
    covers the eight recognized bracket tokens -- this class covers the
    open class of previously-silent, non-bracket values the shared
    validator now rejects.
    """

    @pytest.mark.parametrize(
        "bad_value",
        ["banana", "this week", "this month", "last week", "yesterday", "[decade]"],
    )
    def test_previously_silent_values_now_raise(self, bad_value: str) -> None:
        """These values used to silently return an unfiltered, full-table
        result (empty warnings, success: true). They must now raise a
        ValidationError instead."""
        from pydantic import ValidationError

        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        with pytest.raises(ValidationError, match="Unrecognized time_range"):
            QueryDatasetRequest.model_validate(
                {"dataset_id": 1, "metrics": ["count"], "time_range": bad_value}
            )


class TestQueryDatasetTemporalRangeFilterValidation:
    """A TEMPORAL_RANGE spelled out longhand in `filters` gets the same
    validation as the dedicated `time_range` field.

    query_dataset forwards request.filters into the query verbatim, and
    TEMPORAL_RANGE values resolve through get_since_until() just like
    time_range does -- so validating only time_range would leave the
    identical silent full-table match reachable through this field.
    """

    @staticmethod
    def _request(val: Any) -> dict[str, Any]:
        return {
            "dataset_id": 1,
            "metrics": ["count"],
            "filters": [{"col": "ts", "op": "TEMPORAL_RANGE", "val": val}],
        }

    @pytest.mark.parametrize(
        "bad_value",
        ["banana", "this month", "last week", "[decade]", "Last nonsense"],
    )
    def test_malformed_temporal_range_filter_rejected(self, bad_value: str) -> None:
        from pydantic import ValidationError

        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        with pytest.raises(ValidationError, match="Unrecognized time_range"):
            QueryDatasetRequest.model_validate(self._request(bad_value))

    def test_temporal_range_filter_normalizes_like_time_range(self) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(self._request("Last hour"))
        assert req.filters[0].val == (
            "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"
        )

    @pytest.mark.parametrize("good_value", ["Last 7 days", "2024-01-01 : 2024-12-31"])
    def test_valid_temporal_range_filter_unchanged(self, good_value: str) -> None:
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(self._request(good_value))
        assert req.filters[0].val == good_value

    def test_non_temporal_operator_value_untouched(self) -> None:
        """Only TEMPORAL_RANGE goes through the time grammar -- 'banana' is
        a perfectly good value to compare a text column against."""
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(
            {
                "dataset_id": 1,
                "metrics": ["count"],
                "filters": [{"col": "fruit", "op": "==", "val": "banana"}],
            }
        )
        assert req.filters[0].val == "banana"

    def test_non_string_temporal_value_left_to_downstream(self) -> None:
        """A non-string val isn't a time_range expression at all; the time
        grammar has nothing to say about it."""
        from superset.mcp_service.dataset.schemas import QueryDatasetRequest

        req = QueryDatasetRequest.model_validate(self._request(None))
        assert req.filters[0].val is None


@pytest.mark.asyncio
async def test_query_dataset_bracket_year_resolves_without_parse_error(
    mcp_server: FastMCP,
) -> None:
    """'[year]' as time_range must resolve to a bounded range.

    Regression test: LLM clients passing '[year]' verbatim reach
    get_since_until(time_range="[year]") unnormalized. That string contains
    no ' : ' separator and matches none of get_since_until()'s recognized
    prefixes, so it falls through to the unbounded default -- (None, today)
    -- silently matching the entire table rather than raising an error.
    The schema validator now maps '[year]' to 'Last year' before the query
    context is built, so the range is actually bounded.
    """
    dataset = _make_dataset(main_dttm_col="order_date")
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "resolve_dataset",
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
                        "time_range": "[year]",
                    }
                },
            )

    data = json.loads(result.content[0].text)
    # Must succeed (no error_type) and forward the normalized value
    assert "error_type" not in data or data.get("error_type") is None
    assert len(captured_queries) == 1
    temporal_filters = [
        f for f in captured_queries[0]["filters"] if f["op"] == "TEMPORAL_RANGE"
    ]
    assert len(temporal_filters) == 1
    assert temporal_filters[0]["val"] == "Last year"
    # Exercise the real parser (not mocked above) to prove the normalized
    # value is actually parseable, not just forwarded unchanged.
    since, until = get_since_until(time_range=temporal_filters[0]["val"])
    assert since is not None
    assert until is not None
    assert since < until


@pytest.mark.asyncio
async def test_query_dataset_bracket_hour_resolves_without_parse_error(
    mcp_server: FastMCP,
) -> None:
    """'[hour]' as time_range must resolve to a bounded range.

    Regression test: like '[year]', a raw '[hour]' token has no ' : '
    separator and matches none of get_since_until()'s recognized prefixes,
    so it silently falls through to (None, today) rather than raising an
    error. Unlike the other bracket shorthands, '[hour]' also can't simply
    normalize to 'Last hour': get_since_until() resolves that expression's
    since-clause against 'now' but its until-clause against 'today'
    (midnight), which raises "From date cannot be larger than to date" for
    any sub-day unit. The schema validator instead maps '[hour]' to an
    explicit DATEADD/DATETIME range that resolves both ends against 'now'.
    """
    dataset = _make_dataset(main_dttm_col="order_date")
    result_data = _mock_command_result()
    captured_queries: list[dict[str, Any]] = []

    def capture_create(**kwargs):
        captured_queries.extend(kwargs.get("queries", []))
        return MagicMock()

    with (
        patch.object(
            query_dataset_module,
            "resolve_dataset",
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
                        "time_range": "[hour]",
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert "error_type" not in data or data.get("error_type") is None
    assert len(captured_queries) == 1
    temporal_filters = [
        f for f in captured_queries[0]["filters"] if f["op"] == "TEMPORAL_RANGE"
    ]
    assert len(temporal_filters) == 1
    assert (
        temporal_filters[0]["val"]
        == "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"
    )
    # Exercise the real parser (not mocked above) to prove the normalized
    # value is actually parseable, not just forwarded unchanged.
    since, until = get_since_until(time_range=temporal_filters[0]["val"])
    assert since is not None
    assert until is not None
    assert since < until


@pytest.mark.parametrize(
    ("expression", "expected_start", "expected_end"),
    [
        ("Last month", "2026-06-17T00:00:00", "2026-07-17T00:00:00"),
        ("Last year", "2025-07-17T00:00:00", "2026-07-17T00:00:00"),
        ("previous calendar month", "2026-06-01T00:00:00", "2026-07-01T00:00:00"),
        ("Current year", "2026-01-01T00:00:00", "2027-01-01T00:00:00"),
        ("2025-06-01 : 2025-07-01", "2025-06-01T00:00:00", "2025-07-01T00:00:00"),
        ("No filter", None, None),
    ],
)
@pytest.mark.parametrize("use_filter", [False, True])
@pytest.mark.parametrize("result_kind", ["fresh", "cached", "empty"])
@pytest.mark.asyncio
async def test_query_dataset_returns_engine_time_bounds(
    mcp_server: FastMCP,
    expression: str,
    expected_start: str | None,
    expected_end: str | None,
    use_filter: bool,
    result_kind: str,
) -> None:
    """Resolve MCP inputs with the real factory and serialize execution bounds."""
    from flask import current_app
    from freezegun import freeze_time

    from superset.common.chart_data import ChartDataResultType
    from superset.common.query_object_factory import QueryObjectFactory

    dataset = _make_dataset(main_dttm_col="order_date")

    def execute(
        datasource_id: int, datasource_type: str, query_dict: dict[str, Any], **_: Any
    ) -> dict[str, Any]:
        """Use production date resolution in place of database execution."""
        factory = QueryObjectFactory(current_app.config, MagicMock())
        with freeze_time("2026-07-17 12:34:56"):
            query = factory.create(
                parent_result_type=ChartDataResultType.FULL,
                **query_dict,
            )
        payload = _mock_command_result()
        result = payload["queries"][0]
        result.update(from_dttm=query.from_dttm, to_dttm=query.to_dttm)
        result["is_cached"] = result_kind == "cached"
        if result_kind == "empty":
            result.update(data=[], colnames=[], rowcount=0)
        return payload

    request: dict[str, Any] = {"dataset_id": 1, "metrics": ["count"]}
    if use_filter:
        request["filters"] = [
            {"col": "order_date", "op": "TEMPORAL_RANGE", "val": expression}
        ]
    else:
        request["time_range"] = expression

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(
            query_dataset_module, "execute_tabular_query", side_effect=execute
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("query_dataset", {"request": request})

    data = json.loads(result.content[0].text)
    assert data["from_dttm"] == expected_start
    assert data["to_dttm"] == expected_end
    assert data["applied_filters"][0]["val"] == expression.strip()


@pytest.mark.parametrize("empty", [False, True])
@pytest.mark.asyncio
async def test_query_dataset_reexecutes_across_rollover(
    mcp_server: FastMCP, empty: bool
) -> None:
    """A relative range that rolls over re-executes, so bounds match the rows.

    Sharing one cache entry across the rollover reported the requesting range
    while serving the earlier range's rows.
    """
    from datetime import timedelta

    from flask import current_app
    from flask_caching import Cache
    from freezegun import freeze_time
    from pandas import DataFrame

    from superset.common.chart_data import ChartDataResultType
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.common.query_object import QueryObject
    from superset.common.query_object_factory import QueryObjectFactory
    from superset.constants import CacheRegion
    from superset.models.helpers import QueryResult

    dataset = _make_dataset(main_dttm_col="order_date")
    dataset.column_names = ["count"]
    context = MagicMock(datasource=dataset, force=False)
    processor = QueryContextProcessor(context)
    cache = Cache(current_app, config={"CACHE_TYPE": "SimpleCache"})
    rows = [] if empty else [{"count": 3}]
    source_result = QueryResult(
        df=DataFrame(rows, columns=["count"]),
        query="SELECT COUNT(*) AS count FROM orders",
        duration=timedelta(0),
        applied_filter_columns=["order_date"],
    )
    keys: list[str] = []

    def execute(
        datasource_id: int, datasource_type: str, query_dict: dict[str, Any], **_: Any
    ) -> dict[str, Any]:
        """Acquire through production cache handling; adapt its dataframe payload."""
        query = QueryObjectFactory(current_app.config, MagicMock()).create(
            parent_result_type=ChartDataResultType.FULL, **query_dict
        )
        keys.append(query.cache_key())
        payload = processor.get_df_payload(query)
        frame = payload.pop("df")
        payload.update(
            data=frame.to_dict(orient="records"), colnames=list(frame.columns)
        )
        return {"queries": [payload]}

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(
            query_dataset_module, "execute_tabular_query", side_effect=execute
        ),
        patch.dict(
            "superset.common.utils.query_cache_manager._cache",
            {CacheRegion.DATA: cache},
        ),
        patch.object(processor, "query_cache_key", side_effect=QueryObject.cache_key),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_annotation_data", return_value={}),
        patch.object(
            processor, "get_query_result", return_value=source_result
        ) as get_query_result,
    ):
        async with Client(mcp_server) as client:
            request = {
                "request": {
                    "dataset_id": 1,
                    "metrics": ["count"],
                    "time_range": "Last month",
                }
            }
            with freeze_time("2026-07-17 23:59:59"):
                fresh = await client.call_tool("query_dataset", request)
            with freeze_time("2026-07-18 00:00:01"):
                cached = await client.call_tool("query_dataset", request)
                stored = cache.get(keys[0])
                assert stored is not None
                assert "from_dttm" not in stored
                assert "to_dttm" not in stored

    assert get_query_result.call_count == 2
    assert keys[0] != keys[1]
    fresh_data = json.loads(fresh.content[0].text)
    cached_data = json.loads(cached.content[0].text)
    assert fresh_data["data"] == cached_data["data"] == rows
    assert fresh_data["cache_status"]["cache_hit"] is False
    assert cached_data["cache_status"]["cache_hit"] is False
    assert fresh_data["from_dttm"] == "2026-06-17T00:00:00"
    assert fresh_data["to_dttm"] == "2026-07-17T00:00:00"
    assert cached_data["from_dttm"] == "2026-06-18T00:00:00"
    assert cached_data["to_dttm"] == "2026-07-18T00:00:00"
    assert cached_data["performance"]["cache_status"] == (
        "no_data" if empty else "fresh"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "dimensions",
    [
        ["address.city.name"],
        ["event_name"],
        ["address.city.name", "address.postal_code"],
        ["address.city.name", "event_name", "address.postal_code"],
    ],
)
async def test_query_dataset_unregistered_dimension_is_actionable(
    mcp_server: FastMCP, dimensions: list[str]
) -> None:
    """Unregistered struct paths and wrong-dataset names explain how to recover."""
    dataset = _make_dataset(
        table_name="example_events",
        columns=[_make_column("address"), _make_column("channel")],
    )
    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(query_dataset_module, "execute_tabular_query") as execute,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "columns": dimensions,
                    }
                },
            )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    for dimension in dimensions:
        assert dimension in data["error"]
    assert "example_events" in data["error"]
    assert "Available columns: address, channel" in data["error"]
    assert "get_dataset_info" in data["error"]
    dotted_dimensions = [name for name in dimensions if "." in name]
    if dotted_dimensions:
        assert "not registered" in data["error"]
        for guidance in (
            "query_dataset requires exact registered column names",
            "registering a parent struct does not expose its nested fields",
            "Refresh the dataset columns",
            "add a calculated column",
            "Use execute_sql",
        ):
            assert data["error"].count(guidance) == 1
    else:
        assert "nested fields" not in data["error"]
    execute.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("engine", ["sqlite", "bigquery"])
async def test_query_dataset_registered_dotted_groupby(
    mcp_server: FastMCP, engine: str
) -> None:
    """Registered dotted names reach SQL generation without MCP sanitization.

    SQLite treats the dot as part of a literal identifier, not a struct path.
    Splitting every dotted dimension into SQL identifiers would break this case.
    """
    from sqlalchemy.dialects.sqlite import dialect

    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    sql_dialect = (
        pytest.importorskip("sqlalchemy_bigquery").BigQueryDialect()
        if engine == "bigquery"
        else dialect()
    )
    database = Database(
        database_name="test",
        sqlalchemy_uri="bigquery://test-project"
        if engine == "bigquery"
        else "sqlite://",
    )
    mock_engine = MagicMock()
    mock_engine.dialect = sql_dialect
    engine_context = MagicMock()
    engine_context.__enter__.return_value = mock_engine
    dimension = "address.city.name"
    dataset = SqlaTable(
        id=1,
        table_name="example_locations",
        database=database,
        columns=[TableColumn(column_name=dimension, type="TEXT")],
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    compiled: list[str] = []

    def compile_query(
        dataset_id: int, datasource_type: str, query: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """Exercise the real dataset SQL builder without a warehouse connection."""
        assert query["columns"] == [dimension]
        sqla_query = dataset.get_sqla_query(
            groupby=query["columns"], metrics=query["metrics"], is_timeseries=False
        )
        compiled.append(str(sqla_query.sqla_query.compile(dialect=sql_dialect)))
        return _mock_command_result(
            data=[{dimension: "Sports", "count": 2}], colnames=[dimension, "count"]
        )

    with (
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(database, "get_sqla_engine", return_value=engine_context),
        patch.object(dataset, "get_sqla_row_level_filters", return_value=[]),
        patch.object(
            query_dataset_module, "execute_tabular_query", side_effect=compile_query
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {
                    "request": {
                        "dataset_id": 1,
                        "metrics": ["count"],
                        "columns": [dimension],
                    }
                },
            )
    data = json.loads(result.content[0].text)
    assert data["data"] == [{dimension: "Sports", "count": 2}]
    assert len(compiled) == 1
    if engine == "bigquery":
        assert "`address`.`city`.`name`" in compiled[0]
        assert "GROUP BY" in compiled[0]
    else:
        assert 'GROUP BY "address.city.name"' in compiled[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("column_count", [0, 12])
async def test_query_dataset_available_columns_preview(
    mcp_server: FastMCP, column_count: int
) -> None:
    """Dimension errors bound the preview and handle datasets without columns."""
    dataset = _make_dataset()
    dataset.columns = [_make_column(f"col_{i:02}") for i in range(column_count)]
    with patch.object(query_dataset_module, "resolve_dataset", return_value=dataset):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {"request": {"dataset_id": 1, "columns": ["missing"]}},
            )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "ValidationError"
    if column_count:
        assert "col_00" in data["error"]
        assert "col_09" in data["error"]
        assert "col_10" not in data["error"]
        assert "(and 2 more)" in data["error"]
    else:
        assert "Available columns: (none)" in data["error"]
    assert "get_dataset_info with this dataset_id" in data["error"]


@pytest.mark.parametrize("identifier", [1, "1", "00000000-0000-0000-0000-000000000001"])
async def test_out_of_scope_query_refuses_without_execution(
    mcp_server: FastMCP,
    identifier: int | str,
) -> None:
    """The authenticated MCP entry point refuses rather than queries a substitute."""
    from uuid import UUID

    from fastmcp.exceptions import ToolError

    dataset = _make_dataset()
    dataset.uuid = UUID("00000000-0000-0000-0000-000000000001")
    with (
        patch(
            "superset.mcp_service.dataset_scope.get_dataset_scope",
            return_value=frozenset(),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch.object(query_dataset_module, "execute_tabular_query") as execute,
    ):
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="Do not substitute"):
                await client.call_tool(
                    "query_dataset",
                    {"request": {"dataset_id": identifier, "metrics": ["count"]}},
                )
        execute.assert_not_called()
