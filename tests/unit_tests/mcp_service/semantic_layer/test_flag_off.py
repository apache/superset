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

"""Direct semantic MCP tool calls honor runtime availability."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.client.client import CallToolResult

from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool",
    [
        "list_metrics",
        "get_table",
        "get_compatible_metrics",
        "get_compatible_dimensions",
    ],
)
async def test_semantic_tool_refuses_when_disabled(tool: str) -> None:
    """No semantic tool can contact a provider while the feature is disabled."""
    client: Client
    listing: MagicMock
    lookup: MagicMock
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=False),
        patch("superset.mcp_service.auth.get_user_from_request"),
        patch(
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            f"superset.mcp_service.semantic_layer.tool.{tool}.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch("superset.daos.semantic_layer.SemanticViewDAO.find_by_id") as lookup,
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_accessible"
        ) as listing,
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(
                tool, {"request": {"view_id": 17}}
            )
    payload: dict[str, Any] = json.loads(result.content[0].text)
    assert payload["error"] == "Semantic layers are not enabled."
    assert payload["error_type"] == "SemanticLayersDisabledError"
    lookup.assert_not_called()
    listing.assert_not_called()
