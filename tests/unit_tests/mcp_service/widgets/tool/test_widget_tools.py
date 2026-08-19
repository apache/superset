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

"""Tests for the Dashboard V2 widget-control MCP tools."""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.widgets.tool.get_widget_control_schema import (
    _get_widget_control_schema_impl,
)
from superset.mcp_service.widgets.tool.list_widget_types import (
    _list_widget_types_impl,
)
from superset.utils import json


def test_list_widget_types_impl() -> None:
    ids = {b["id"] for b in _list_widget_types_impl()}
    assert {"metric-tile", "ag-grid-table", "balloons"} <= ids


def test_get_widget_control_schema_is_minimal() -> None:
    result = _get_widget_control_schema_impl("balloons")
    assert result["x-disclosure"] == "minimal"
    assert result["properties"]["customize"]["x-collapsed"] is True
    # Mandatory leaves are surfaced inline.
    assert (
        result["properties"]["dataBinding"]["properties"]["datasetId"]["type"]
        == "integer"
    )


def test_get_widget_control_schema_unknown_type_error() -> None:
    result = _get_widget_control_schema_impl("does-not-exist")
    assert result["error"]["error_type"] == "invalid_widget_type"
    assert "balloons" in result["valid_widget_types"]


def test_get_widget_control_schema_drills_into_enriched_series() -> None:
    result = _get_widget_control_schema_impl(
        "balloons",
        paths=["customize/series"],
        control_values={
            "dataBinding": {"datasetId": 1, "metrics": ["count"], "dimensions": ["g"]}
        },
        series=["boy", "girl"],
    )
    series_schema = result["subtrees"]["customize/series"]
    assert set(series_schema["properties"]) == {"boy", "girl"}


def test_get_widget_control_schema_expands_multiple_paths_at_once() -> None:
    result = _get_widget_control_schema_impl(
        "balloons", paths=["dataBinding", "customize"]
    )
    # Both requested branches come back in one call, keyed by path.
    assert set(result["subtrees"]) == {"dataBinding", "customize"}
    assert "datasetId" in result["subtrees"]["dataBinding"]["properties"]
    assert "series" in result["subtrees"]["customize"]["properties"]


def test_get_widget_control_schema_bad_path_error() -> None:
    result = _get_widget_control_schema_impl("balloons", paths=["nope/nope"])
    assert result["error"]["error_type"] == "invalid_path"


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for client-based tool tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.mark.asyncio
async def test_tools_registered_and_callable() -> None:
    async with Client(mcp) as client:
        names = {t.name for t in await client.list_tools()}
        assert {"list_widget_types", "get_widget_control_schema"} <= names
        # The separate field-schema tool was folded into get_widget_control_schema.
        assert "get_widget_control_field_schema" not in names

        result = await client.call_tool(
            "get_widget_control_schema", {"widget_type": "metric-tile"}
        )
        data = json.loads(result.content[0].text)
        assert data["x-disclosure"] == "minimal"
        assert "dataBinding" in data["properties"]

        # Passing paths returns the requested subtrees instead of the root.
        drilled = await client.call_tool(
            "get_widget_control_schema",
            {"widget_type": "balloons", "paths": ["dataBinding"]},
        )
        drilled_data = json.loads(drilled.content[0].text)
        assert "datasetId" in drilled_data["subtrees"]["dataBinding"]["properties"]
