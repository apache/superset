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

"""Unit tests for the get_compatible_metrics MCP tool."""

from __future__ import annotations

import importlib
from collections.abc import Generator
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.utils import json

get_compatible_metrics_module: ModuleType = importlib.import_module(
    "superset.mcp_service.semantic_layer.tool.get_compatible_metrics"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(
            get_compatible_metrics_module,
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
    m: MagicMock = MagicMock()
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
    return col


def _make_dataset(dataset_id: int = 42) -> MagicMock:
    ds: MagicMock = MagicMock()
    ds.id = dataset_id
    ds.table_name = f"table_{dataset_id}"
    ds.columns = [_make_column("region")]
    ds.metrics = [_make_metric("count"), _make_metric("revenue", "SUM(revenue)")]
    return ds


def _make_view(view_id: int = 5) -> MagicMock:
    view: MagicMock = MagicMock()
    view.id = view_id
    view.name = f"view_{view_id}"
    view.raise_for_access = MagicMock(return_value=None)
    view.metrics = [_make_metric("bookings")]
    view.get_compatible_metrics = MagicMock(return_value=["bookings"])
    return view


def _access_denied_exc(message: str = "Access denied") -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message=message,
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


@pytest.mark.asyncio
async def test_get_compatible_metrics_builtin_happy_path(mcp_server: FastMCP) -> None:
    """Builtin datasets return all metrics for a valid dimension selection."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {"request": {"dataset_id": 42, "selected_dimensions": ["region"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["source"] == "builtin"
    names = {m["name"] for m in data["compatible_metrics"]}
    assert names == {"count", "revenue"}


@pytest.mark.asyncio
async def test_get_compatible_metrics_builtin_excludes_selected_metrics(
    mcp_server: FastMCP,
) -> None:
    """Builtin datasets exclude metrics already in selected_metrics.

    Regression test: previously all dataset metrics were returned unfiltered,
    so already-selected metrics were suggested again as "compatible".
    """
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {"request": {"dataset_id": 42, "selected_metrics": ["count"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    names = {m["name"] for m in data["compatible_metrics"]}
    assert names == {"revenue"}


@pytest.mark.asyncio
async def test_get_compatible_metrics_builtin_unknown_selection(
    mcp_server: FastMCP,
) -> None:
    """Builtin datasets reject unknown selected metric/dimension names."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {
                    "request": {
                        "dataset_id": 42,
                        "selected_metrics": ["bogus_metric"],
                        "selected_dimensions": ["bogus_dim"],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "Unknown metric: 'bogus_metric'" in data["error"]
    assert "Unknown dimension: 'bogus_dim'" in data["error"]


@pytest.mark.asyncio
async def test_get_compatible_metrics_external_happy_path(mcp_server: FastMCP) -> None:
    """External views delegate to view.get_compatible_metrics()."""
    mock_view = _make_view(5)

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {"request": {"view_id": 5, "selected_dimensions": ["country_name"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["source"] == "external"
    assert [m["name"] for m in data["compatible_metrics"]] == ["bookings"]
    mock_view.get_compatible_metrics.assert_called_once_with([], ["country_name"])


@pytest.mark.asyncio
async def test_get_compatible_metrics_mutual_exclusion_validation(
    mcp_server: FastMCP,
) -> None:
    """Errors when both dataset_id and view_id are provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_compatible_metrics",
            {"request": {"dataset_id": 1, "view_id": 2}},
        )
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_compatible_metrics_requires_one_source(
    mcp_server: FastMCP,
) -> None:
    """Errors when neither dataset_id nor view_id is provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_compatible_metrics", {"request": {}})
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_compatible_metrics_privacy_check(mcp_server: FastMCP) -> None:
    """Errors when the user lacks data-model metadata access."""
    with patch.object(
        get_compatible_metrics_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics", {"request": {"dataset_id": 1}}
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "DataModelMetadataRestricted"


@pytest.mark.asyncio
async def test_get_compatible_metrics_external_access_denied(
    mcp_server: FastMCP,
) -> None:
    """Returns AccessDenied when raise_for_access rejects the view."""
    mock_view = _make_view(5)
    mock_view.raise_for_access.side_effect = _access_denied_exc()

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics", {"request": {"view_id": 5}}
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "AccessDenied"


@pytest.mark.asyncio
async def test_get_compatible_metrics_not_found(mcp_server: FastMCP) -> None:
    """Returns NotFound when the dataset doesn't exist."""
    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics", {"request": {"dataset_id": 999}}
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_get_compatible_metrics_builtin_empty_selection(
    mcp_server: FastMCP,
) -> None:
    """Explicitly empty selected_metrics/selected_dimensions is not an error.

    An empty selection is the natural starting state of a query builder
    (nothing picked yet), so it must return all dataset metrics rather than
    a validation failure.
    """
    mock_ds: MagicMock = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {
                    "request": {
                        "dataset_id": 42,
                        "selected_metrics": [],
                        "selected_dimensions": [],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)

    assert data["success"] is True
    names: set[str] = {m["name"] for m in data["compatible_metrics"]}
    assert names == {"count", "revenue"}


@pytest.mark.asyncio
async def test_get_compatible_metrics_external_empty_selection(
    mcp_server: FastMCP,
) -> None:
    """External views handle an explicitly empty selection without error."""
    mock_view: MagicMock = _make_view(5)
    mock_view.get_compatible_metrics = MagicMock(return_value=[])

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {
                    "request": {
                        "view_id": 5,
                        "selected_metrics": [],
                        "selected_dimensions": [],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["compatible_metrics"] == []
    mock_view.get_compatible_metrics.assert_called_once_with([], [])


@pytest.mark.asyncio
async def test_get_compatible_metrics_unicode_unknown_selection_validation_error(
    mcp_server: FastMCP,
) -> None:
    """Unicode/special-character names in an unknown selection surface cleanly."""
    mock_ds: MagicMock = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_compatible_metrics",
                {
                    "request": {
                        "dataset_id": 42,
                        "selected_metrics": ["日本語_metric"],
                        "selected_dimensions": ["special!chars?"],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "Unknown metric: '日本語_metric'" in data["error"]
    assert "Unknown dimension: 'special!chars?'" in data["error"]
