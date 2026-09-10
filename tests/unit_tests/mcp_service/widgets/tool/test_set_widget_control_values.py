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

"""Tests for the set_widget_control_values MCP tool."""

from __future__ import annotations

from typing import Any, Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.widgets.node_store import nodes, WidgetNode
from superset.mcp_service.widgets.tool.set_widget_control_values import (
    _set_widget_control_values_impl,
)
from superset.utils import json


@pytest.fixture(autouse=True)
def _clean_node_store() -> Iterator[None]:
    nodes.clear()
    yield
    nodes.clear()


def _seed(node_id: str, widget_type: str, props: dict[str, Any] | None = None) -> None:
    nodes[node_id] = WidgetNode(widget_type=widget_type, props=props or {})


def test_successful_write_merges_and_normalizes() -> None:
    _seed(
        "n1",
        "metric-tile",
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}, "decimals": 0},
    )

    result = _set_widget_control_values_impl("n1", {"decimals": 2, "prefix": "$"})

    assert result["errors"] == []
    assert result["values"]["decimals"] == 2
    assert result["values"]["prefix"] == "$"
    # Untouched top-level keys are preserved by the merge.
    assert result["values"]["dataBinding"]["datasetId"] == 1
    # The store itself was actually updated, not just the return value.
    assert nodes["n1"].props["decimals"] == 2


def test_successful_write_normalizes_defaults_for_unset_fields() -> None:
    _seed(
        "n1",
        "metric-tile",
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}},
    )

    result = _set_widget_control_values_impl("n1", {"decimals": 1})

    # Fields never explicitly set (by the seed or this call) still come back
    # normalized with their schema defaults, since model_dump serializes the
    # full validated model, not just the merged keys.
    assert result["values"]["suffix"] == ""
    assert result["values"]["label"] == ""


def test_invalid_values_return_errors_and_leave_node_unchanged() -> None:
    _seed(
        "n1",
        "metric-tile",
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}, "decimals": 0},
    )

    # dataBinding.datasetId must be an int; this is a validation failure, not
    # a partial/tolerant edit.
    result = _set_widget_control_values_impl(
        "n1", {"dataBinding": {"datasetId": "not-an-int", "metrics": ["count"]}}
    )

    assert result["errors"]
    assert "values" not in result
    # Rollback: the stored node is byte-identical to before the failed call.
    assert nodes["n1"].props == {
        "dataBinding": {"datasetId": 1, "metrics": ["count"]},
        "decimals": 0,
    }


def test_missing_required_field_returns_errors() -> None:
    _seed("n1", "metric-tile", {})  # no dataBinding at all yet

    result = _set_widget_control_values_impl("n1", {"decimals": 1})

    assert result["errors"]
    assert any("dataBinding" in str(error["loc"]) for error in result["errors"])
    assert nodes["n1"].props == {}


def test_unknown_node_id_returns_structured_error() -> None:
    result = _set_widget_control_values_impl("does-not-exist", {"decimals": 1})

    assert result["error"]["error_type"] == "unknown_node"
    assert "does-not-exist" in result["error"]["message"]


def test_node_with_unregistered_widget_type_returns_structured_error() -> None:
    _seed("n1", "not-a-real-widget-type", {})

    result = _set_widget_control_values_impl("n1", {"decimals": 1})

    assert result["error"]["error_type"] == "invalid_widget_type"
    assert "balloons" in result["valid_widget_types"]


@pytest.fixture(autouse=True)
def _mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.mark.asyncio
async def test_tool_registered_and_callable_over_client() -> None:
    # Proves the tool is actually wired into app.py's registration, not just
    # importable -- a tool exported from tool/__init__.py but missing from
    # app.py's import list would pass every direct-call test above while
    # being invisible to a real MCP client.
    _seed(
        "n1",
        "metric-tile",
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}, "decimals": 0},
    )
    async with Client(mcp) as client:
        names = {t.name for t in await client.list_tools()}
        assert "set_widget_control_values" in names

        result = await client.call_tool(
            "set_widget_control_values",
            {"node_id": "n1", "control_values": {"decimals": 3}},
        )
        data = json.loads(result.content[0].text)
        assert data["errors"] == []
        assert data["values"]["decimals"] == 3
