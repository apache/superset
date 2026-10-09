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

"""External compatibility selection validation through the public MCP tools."""

from unittest.mock import MagicMock, patch

import pyarrow as pa
import pytest
from fastmcp import Client
from fastmcp.client.client import CallToolResult
from superset_core.semantic_layers.types import Dimension, Metric

from superset.mcp_service.app import mcp
from superset.semantic_layers.models import SemanticView
from superset.utils import json


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool_name", ["get_compatible_metrics", "get_compatible_dimensions"]
)
@pytest.mark.parametrize(
    "metrics, dimensions, error",
    [
        (
            ["bookings", "bogus_metric"],
            ["country_name"],
            "Unknown metric: 'bogus_metric'",
        ),
        (
            ["bookings"],
            ["country_name", "bogus_dimension"],
            "Unknown dimension: 'bogus_dimension'",
        ),
        (
            ["bogus_metric"],
            ["bogus_dimension"],
            "Unknown metric: 'bogus_metric'; Unknown dimension: 'bogus_dimension'",
        ),
        (["bookings"], ["country_name"], None),
        ([], [], None),
    ],
)
async def test_external_compatibility_selection_names(
    tool_name: str,
    metrics: list[str],
    dimensions: list[str],
    error: str | None,
) -> None:
    """Unknown names fail before provider compatibility; valid selections survive."""
    metric: Metric = Metric(
        id="orders.bookings",
        name="bookings",
        type=pa.float64(),
        definition="provider-private-metric-definition",
    )
    dimension: Dimension = Dimension(
        id="countries.country",
        name="country_name",
        type=pa.string(),
        definition="provider-private-dimension-definition",
    )
    provider: MagicMock = MagicMock(selection_identity_version=None)
    provider.get_metrics.return_value = {metric}
    provider.get_dimensions.return_value = {dimension}
    provider.get_compatible_metrics.return_value = {metric}
    provider.get_compatible_dimensions.return_value = {dimension}
    view: SemanticView = SemanticView(id=5, name="production-shaped-view")
    view.__dict__["implementation"] = provider
    user: MagicMock = MagicMock(id=1, username="admin")

    access: MagicMock
    client: Client
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            "superset.mcp_service.semantic_layer.tool.get_compatible_metrics.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.semantic_layer.tool.get_compatible_dimensions.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(view, "raise_for_access") as access,
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(
                tool_name,
                {
                    "request": {
                        "view_id": 5,
                        "selected_metrics": metrics,
                        "selected_dimensions": dimensions,
                    }
                },
            )
        data: dict[str, object] = json.loads(result.content[0].text)

    access.assert_called_once_with()
    if error is not None:
        assert data["success"] is False
        assert data["error_type"] == "ValidationError"
        assert data["message"] == error
        provider.get_compatible_metrics.assert_not_called()
        provider.get_compatible_dimensions.assert_not_called()
        assert "provider-private" not in str(data)
    else:
        assert data["success"] is True
        assert data["source"] == "external"
        if tool_name == "get_compatible_metrics":
            provider.get_compatible_metrics.assert_called_once_with(
                {metric} if metrics else set(),
                {dimension} if dimensions else set(),
            )
        else:
            provider.get_compatible_dimensions.assert_called_once_with(
                {metric} if metrics else set(),
                {dimension} if dimensions else set(),
            )
