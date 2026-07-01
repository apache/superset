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

"""Unit tests for the get_table MCP tool."""

from __future__ import annotations

import importlib
from collections.abc import Generator
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.utils import json

get_table_module = importlib.import_module(
    "superset.mcp_service.semantic_layer.tool.get_table"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(
            get_table_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        mock_user = Mock()
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


def _make_column(name: str, is_dttm: bool = False) -> MagicMock:
    col = MagicMock()
    col.column_name = name
    col.verbose_name = None
    col.description = None
    col.type = "VARCHAR"
    col.is_dttm = is_dttm
    col.groupby = True
    col.filterable = True
    return col


def _make_dataset(dataset_id: int = 42) -> MagicMock:
    ds = MagicMock()
    ds.id = dataset_id
    ds.table_name = f"table_{dataset_id}"
    ds.main_dttm_col = "created_at"
    ds.metrics = [_make_metric("revenue", "SUM(revenue)")]
    ds.columns = [
        _make_column("region"),
        _make_column("created_at", is_dttm=True),
    ]
    return ds


def _make_view(view_id: int = 5) -> MagicMock:
    view = MagicMock()
    view.id = view_id
    view.name = f"view_{view_id}"
    view.raise_for_access = MagicMock(return_value=None)
    view.metrics = [_make_metric("bookings")]
    view.columns = [_make_column("country_name")]
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
async def test_get_table_builtin_happy_path(mcp_server: FastMCP) -> None:
    """get_table returns tabular data for a built-in dataset."""
    mock_ds = _make_dataset(42)
    query_result = {
        "queries": [
            {
                "data": [{"region": "west", "revenue": 100}],
                "colnames": ["region", "revenue"],
                "rowcount": 1,
            }
        ]
    }

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_command_cls,
        patch(
            "superset.common.query_context_factory.QueryContextFactory"
        ) as mock_factory_cls,
    ):
        mock_command_cls.return_value.run.return_value = query_result
        mock_factory_cls.return_value.create.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "dimensions": ["region"],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["row_count"] == 1
    assert data["source"] == "builtin"
    assert data["dataset_id"] == 42


@pytest.mark.asyncio
async def test_get_table_requires_one_source(mcp_server: FastMCP) -> None:
    """get_table errors when neither dataset_id nor view_id is provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_table", {"request": {}})
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_table_mutual_exclusion_validation(mcp_server: FastMCP) -> None:
    """get_table errors when both dataset_id and view_id are provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_table", {"request": {"dataset_id": 1, "view_id": 2}}
        )
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_table_privacy_check(mcp_server: FastMCP) -> None:
    """get_table errors when the user lacks data-model metadata access."""
    with patch.object(
        get_table_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("get_table", {"request": {"dataset_id": 1}})
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "DataModelMetadataRestricted"


@pytest.mark.asyncio
async def test_get_table_unknown_metric_validation_error(mcp_server: FastMCP) -> None:
    """get_table errors when a requested metric doesn't exist on the dataset."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"dataset_id": 42, "metrics": ["does_not_exist"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_table_time_column_not_dttm_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table rejects a time_column that isn't marked as a datetime column."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "time_column": "region",
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "not marked as a datetime column" in data["message"]


@pytest.mark.asyncio
async def test_get_table_external_view_access_denied(mcp_server: FastMCP) -> None:
    """get_table returns AccessDenied when raise_for_access rejects the view."""
    mock_view = _make_view(5)
    mock_view.raise_for_access.side_effect = _access_denied_exc()

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"view_id": 5, "metrics": ["bookings"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "AccessDenied"
