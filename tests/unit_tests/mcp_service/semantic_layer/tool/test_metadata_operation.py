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

"""MCP view discovery owns an acquisition scope outside HTTP requests."""

from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from fastmcp import Client
from flask import Flask

from superset.mcp_service.app import mcp
from superset.semantic_layers.metadata_binding import operation_deadline
from superset.utils import json
from tests.unit_tests.mcp_service.semantic_layer.tool.test_get_table import _make_view


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool", ["get_table", "get_compatible_metrics", "list_metrics"]
)
async def test_view_tool_enters_metadata_operation(app: Flask, tool: str) -> None:
    """Implementation reads retain one finite budget throughout the tool call."""
    view: MagicMock = _make_view()
    view.get_compatible_metrics.return_value = ["bookings"]
    implementation: MagicMock = MagicMock(selection_identity_version=None)
    implementation.get_dimensions.return_value = []
    observed: list[float] = []

    def discover() -> MagicMock:
        """Match the binding requirement before provider construction/discovery."""
        observed.append(operation_deadline())
        return implementation

    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch("superset.mcp_service.auth.get_user_from_request"),
        patch(
            f"superset.mcp_service.semantic_layer.tool.{tool}.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            type(view),
            "implementation",
            new_callable=PropertyMock,
            create=True,
            side_effect=discover,
        ),
        patch(
            "superset.mcp_service.semantic_layer.tool.get_table.execute_tabular_query",
            return_value={"queries": [{"data": [], "colnames": []}]},
        ),
    ):
        arguments: dict[str, Any] = {"view_id": 5}
        if tool == "get_table":
            arguments["metrics"] = ["bookings"]
        client: Client
        async with Client(mcp) as client:
            result: Any = await client.call_tool(tool, {"request": arguments})
        payload: dict[str, Any] = json.loads(result.content[0].text)
    assert payload["success"] is True
    assert observed
    assert len(set(observed)) == 1
    if tool == "list_metrics":
        assert [metric["name"] for metric in payload["metrics"]] == ["bookings"]
