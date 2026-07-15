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

"""Unit tests for the list_metrics MCP tool."""

from __future__ import annotations

import contextlib
import importlib
from collections.abc import Generator
from types import ModuleType
from typing import Any
from unittest.mock import call, MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.utils import json

list_metrics_module: ModuleType = importlib.import_module(
    "superset.mcp_service.semantic_layer.tool.list_metrics"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(
            list_metrics_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        mock_user: Mock = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_metric(name: str, expression: str = "COUNT(*)") -> MagicMock:
    m = MagicMock()
    m.metric_name = name
    m.verbose_name = None
    m.expression = expression
    m.description = None
    m.d3format = None
    m.warning_text = None
    return m


def _make_column(name: str) -> MagicMock:
    col = MagicMock()
    col.column_name = name
    col.verbose_name = None
    col.description = None
    col.type = "VARCHAR"
    col.is_dttm = False
    col.groupby = True
    col.filterable = True
    return col


def _make_dataset(dataset_id: int = 1) -> MagicMock:
    ds = MagicMock()
    ds.id = dataset_id
    ds.table_name = f"table_{dataset_id}"
    ds.metrics = [_make_metric("count"), _make_metric("revenue", "SUM(revenue)")]
    ds.columns = [_make_column("region"), _make_column("category")]
    return ds


def _make_view(view_id: int = 5) -> MagicMock:
    view = MagicMock()
    view.id = view_id
    view.name = f"view_{view_id}"
    view.raise_for_access = MagicMock(return_value=None)
    view.metrics = [_make_metric("bookings"), _make_metric("revenue", "SUM(revenue)")]
    view.columns = [_make_column("listing__country_name"), _make_column("channel")]
    view.get_compatible_dimensions = MagicMock(return_value=["listing__country_name"])
    return view


def _access_denied_exc(message: str = "Access denied") -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message=message,
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


@contextlib.contextmanager
def _patched_dataset_lookup(
    dataset: MagicMock | None,
) -> Generator[tuple[MagicMock, MagicMock], None, None]:
    """Patch the ``dataset_id``-driven lookup path.

    Covers ``DatasetDAO.find_by_id`` (direct lookup by id) plus the
    ``SemanticViewDAO.find_accessible`` call every ``list_metrics`` request
    makes regardless of scope.
    """
    with (
        patch.object(list_metrics_module, "DatasetDAO") as mock_dao,
        patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao,
    ):
        mock_dao.find_by_id.return_value = dataset
        mock_view_dao.find_accessible.return_value = []
        yield mock_dao, mock_view_dao


@contextlib.contextmanager
def _patched_dataset_search(
    datasets: list[MagicMock],
) -> Generator[tuple[MagicMock, MagicMock, MagicMock], None, None]:
    """Patch the search-driven lookup path.

    Covers the unscoped/searched query path: ``DatasetDAO._apply_base_filter``
    applied to a ``db.session.query(...).options(...)`` chain, as used when no
    ``dataset_id``/``view_id`` narrows the request.
    """
    with (
        patch.object(list_metrics_module, "DatasetDAO") as mock_dao,
        patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao,
        patch.object(list_metrics_module, "db") as mock_db,
    ):
        mock_view_dao.find_accessible.return_value = []
        mock_query: MagicMock = MagicMock()
        mock_db.session.query.return_value.options.return_value = mock_query
        mock_dao._apply_base_filter.return_value = mock_query
        mock_query.all.return_value = datasets
        yield mock_dao, mock_view_dao, mock_db


@pytest.mark.asyncio
async def test_list_metrics_builtin_happy_path(mcp_server: FastMCP) -> None:
    """list_metrics returns builtin metrics when only datasets exist."""
    mock_ds: MagicMock = _make_dataset(42)

    with _patched_dataset_lookup(mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"dataset_id": 42, "include_compatible_dimensions": False}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["total_count"] == 2
    metrics = data["metrics"]
    assert {m["name"] for m in metrics} == {"count", "revenue"}
    assert all(m["source"] == "builtin" for m in metrics)
    assert all(m["dataset_id"] == 42 for m in metrics)


@pytest.mark.asyncio
async def test_list_metrics_mutual_exclusion_validation(mcp_server: FastMCP) -> None:
    """list_metrics returns a validation error when dataset_id and view_id coexist."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_metrics",
            {"request": {"dataset_id": 1, "view_id": 2}},
        )
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_list_metrics_privacy_check(mcp_server: FastMCP) -> None:
    """list_metrics returns an error when the user lacks data-model metadata access."""
    with patch.object(
        list_metrics_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("list_metrics", {})
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "DataModelMetadataRestricted"


@pytest.mark.asyncio
async def test_list_metrics_search_filter(mcp_server: FastMCP) -> None:
    """list_metrics filters metrics by search term."""
    mock_ds: MagicMock = _make_dataset(1)

    with _patched_dataset_search([mock_ds]):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"search": "revenue"}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    # Only the "revenue" metric should match the search
    metrics = data["metrics"]
    assert len(metrics) == 1
    assert metrics[0]["name"] == "revenue"


@pytest.mark.asyncio
async def test_list_metrics_external_includes_verbose_name(
    mcp_server: FastMCP,
) -> None:
    """External metrics include verbose_name, matching the builtin path."""
    mock_view = _make_view(5)
    mock_view.metrics[0].verbose_name = "Bookings Count"

    with patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao:
        mock_view_dao.find_by_id.return_value = mock_view

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"view_id": 5, "include_compatible_dimensions": False}},
            )
        data = json.loads(result.content[0].text)

    metrics = {m["name"]: m for m in data["metrics"]}
    assert metrics["bookings"]["verbose_name"] == "Bookings Count"


@pytest.mark.asyncio
async def test_list_metrics_external_access_denied(mcp_server: FastMCP) -> None:
    """An explicit view_id lookup surfaces AccessDenied instead of InternalError."""
    mock_view = _make_view(5)
    mock_view.raise_for_access.side_effect = _access_denied_exc()

    with patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao:
        mock_view_dao.find_by_id.return_value = mock_view

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"view_id": 5}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "AccessDenied"


@pytest.mark.asyncio
async def test_list_metrics_external_per_metric_compatible_dimensions(
    mcp_server: FastMCP,
) -> None:
    """External metrics resolve compatible_dimensions per metric, not view-wide."""
    mock_view = _make_view(5)

    def _compatible_dimensions(
        selected_metrics: list[str], selected_dimensions: list[str]
    ) -> list[str]:
        return ["listing__country_name"] if selected_metrics == ["bookings"] else []

    mock_view.get_compatible_dimensions.side_effect = _compatible_dimensions

    with patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao:
        mock_view_dao.find_by_id.return_value = mock_view

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"view_id": 5, "include_compatible_dimensions": True}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    metrics = {m["name"]: m for m in data["metrics"]}
    assert [d["name"] for d in metrics["bookings"]["compatible_dimensions"]] == [
        "listing__country_name"
    ]
    assert metrics["revenue"]["compatible_dimensions"] == []
    assert mock_view.get_compatible_dimensions.call_args_list == [
        call(["bookings"], []),
        call(["revenue"], []),
    ]


@pytest.mark.asyncio
async def test_list_metrics_pagination_is_stable(mcp_server: FastMCP) -> None:
    """Metrics are sorted deterministically before pagination is applied."""
    mock_ds: MagicMock = MagicMock()
    mock_ds.id = 1
    mock_ds.table_name = "table_1"
    mock_ds.metrics = [_make_metric("zzz_metric"), _make_metric("aaa_metric")]
    mock_ds.columns = []

    with _patched_dataset_search([mock_ds]):
        async with Client(mcp_server) as client:
            page_1 = await client.call_tool(
                "list_metrics", {"request": {"page": 1, "page_size": 1}}
            )
            page_2 = await client.call_tool(
                "list_metrics", {"request": {"page": 2, "page_size": 1}}
            )
        data_1 = json.loads(page_1.content[0].text)
        data_2 = json.loads(page_2.content[0].text)

    assert data_1["metrics"][0]["name"] == "aaa_metric"
    assert data_2["metrics"][0]["name"] == "zzz_metric"


@pytest.mark.asyncio
async def test_list_metrics_search_no_match_returns_empty(mcp_server: FastMCP) -> None:
    """A search term that matches nothing returns an empty (not error) result."""
    mock_ds: MagicMock = _make_dataset(1)

    with _patched_dataset_search([mock_ds]):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"search": "no_such_metric_anywhere"}},
            )
        data: dict[str, Any] = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["metrics"] == []
    assert data["total_count"] == 0


@pytest.mark.asyncio
async def test_list_metrics_nonexistent_dataset_id_returns_empty(
    mcp_server: FastMCP,
) -> None:
    """A dataset_id that doesn't resolve to a dataset returns an empty result.

    The tool degrades gracefully (empty list) rather than raising NotFound,
    since dataset_id here is a scoping filter, not a required lookup key.
    """
    with patch.object(list_metrics_module, "DatasetDAO") as mock_dao:
        mock_dao.find_by_id.return_value = None

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"dataset_id": 999999}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["metrics"] == []
    assert data["total_count"] == 0
    mock_dao.find_by_id.assert_called_once()


@pytest.mark.asyncio
async def test_list_metrics_nonexistent_view_id_returns_empty(
    mcp_server: FastMCP,
) -> None:
    """A view_id that doesn't resolve to a view returns an empty result."""
    with patch.object(list_metrics_module, "SemanticViewDAO") as mock_view_dao:
        mock_view_dao.find_by_id.return_value = None

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"view_id": 999999}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["metrics"] == []
    assert data["total_count"] == 0
    mock_view_dao.find_by_id.assert_called_once()


@pytest.mark.asyncio
async def test_list_metrics_search_unicode_matches(mcp_server: FastMCP) -> None:
    """Unicode search strings match against unicode descriptions correctly."""
    mock_ds: MagicMock = _make_dataset(1)
    mock_ds.metrics[1].description = "café blend revenue – daily"

    with _patched_dataset_search([mock_ds]):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"search": "café"}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    metrics: list[dict[str, Any]] = data["metrics"]
    assert len(metrics) == 1
    assert metrics[0]["name"] == "revenue"


@pytest.mark.asyncio
async def test_list_metrics_search_special_characters_no_crash(
    mcp_server: FastMCP,
) -> None:
    """Search strings with regex-special characters are treated as plain text."""
    mock_ds = _make_dataset(1)

    with _patched_dataset_search([mock_ds]):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"search": "rev$enue%^&*()[.*]"}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["metrics"] == []
    assert data["total_count"] == 0


# ---------------------------------------------------------------------------
# Pagination edge cases
#
# list_metrics hand-rolls its own pagination (list slicing) instead of using
# ModelListCore, but the request schema still enforces page >= 1 and
# 1 <= page_size <= 500 (superset/mcp_service/semantic_layer/schemas.py).
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_metrics_page_zero_rejected(mcp_server: FastMCP) -> None:
    """page must be >= 1; page=0 is rejected before the tool body runs."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="greater than or equal to 1"):
            await client.call_tool("list_metrics", {"request": {"page": 0}})


@pytest.mark.asyncio
async def test_list_metrics_negative_page_rejected(mcp_server: FastMCP) -> None:
    """Negative page numbers are rejected the same way as page=0."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="greater than or equal to 1"):
            await client.call_tool("list_metrics", {"request": {"page": -1}})


@pytest.mark.asyncio
async def test_list_metrics_page_size_zero_rejected(mcp_server: FastMCP) -> None:
    """page_size must be >= 1; page_size=0 is rejected before the tool body
    runs, surfacing as a structured ToolError rather than a raw 500."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="greater than or equal to 1"):
            await client.call_tool("list_metrics", {"request": {"page_size": 0}})


@pytest.mark.asyncio
async def test_list_metrics_page_size_over_max_rejected(mcp_server: FastMCP) -> None:
    """page_size above the 500 ceiling is rejected, not silently clamped."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="less than or equal to 500"):
            await client.call_tool("list_metrics", {"request": {"page_size": 501}})


@pytest.mark.asyncio
async def test_list_metrics_page_size_at_max_accepted(mcp_server: FastMCP) -> None:
    """page_size == 500 (the max) is accepted and echoed back."""
    mock_ds: MagicMock = _make_dataset(42)

    with _patched_dataset_lookup(mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"dataset_id": 42, "page_size": 500}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["page_size"] == 500
    assert data["total_count"] == 2


@pytest.mark.asyncio
async def test_list_metrics_page_beyond_last_page_returns_empty(
    mcp_server: FastMCP,
) -> None:
    """Requesting a page past the end returns an empty page, not an error.

    Unlike the ModelListCore-backed list tools, MetricList has no
    has_next/has_previous fields — only metrics, total_count, page,
    page_size, and total_pages.
    """
    mock_ds: MagicMock = _make_dataset(42)

    with _patched_dataset_lookup(mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_metrics",
                {"request": {"dataset_id": 42, "page": 9999, "page_size": 50}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["metrics"] == []
    assert data["total_count"] == 2
    assert data["page"] == 9999
    assert data["total_pages"] == 1
