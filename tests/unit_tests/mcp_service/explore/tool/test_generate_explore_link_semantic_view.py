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
"""generate_explore_link targeting a semantic view via view_id (sc-120959)."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.client.client import CallToolResult

from superset.mcp_service.app import mcp

GET_DATASOURCE: str = "superset.daos.datasource.DatasourceDAO.get_datasource"
PERMALINK: str = (
    "superset.commands.explore.permalink.create.CreateExplorePermalinkCommand.run"
)
FORM_DATA_KEY: str = (
    "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
)


@pytest.fixture(autouse=True)
def _mock_auth() -> Iterator[None]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        user: Mock = Mock()
        user.id = 1
        user.username = "admin"
        mock_get_user.return_value = user
        yield


@pytest.fixture(autouse=True)
def _mock_event_logger() -> Iterator[None]:
    with patch("superset.utils.log.DBEventLogger.log", return_value=None):
        yield


@pytest.fixture(autouse=True)
def _mock_base_url(app_context: None) -> Iterator[None]:
    from flask import current_app

    original: str | None = current_app.config.get("WEBDRIVER_BASEURL_USER_FRIENDLY")
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "http://localhost:9001/"
    yield
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = original


def _mock_view(view_id: int = 1) -> Mock:
    view: Mock = Mock()
    view.id = view_id
    view.name = "Jaffle Shop"
    time_col: Mock = Mock()
    time_col.column_name = "metric_time"
    time_col.type = "TIMESTAMP"
    time_col.is_dttm = True
    view.columns = [time_col]
    revenue: Mock = Mock()
    revenue.metric_name = "revenue"
    revenue.expression = "revenue"
    revenue.description = None
    view.metrics = [revenue]
    return view


LINE_CONFIG: dict[str, Any] = {
    "chart_type": "xy",
    "x": {"name": "metric_time"},
    "y": [{"name": "revenue", "saved_metric": True}],
    "kind": "line",
}


async def _call(request: dict[str, Any]) -> dict[str, Any]:
    async with Client(mcp) as client:
        result: CallToolResult = await client.call_tool(
            "generate_explore_link", {"request": request}
        )
    assert isinstance(result.structured_content, dict)
    return result.structured_content


@pytest.mark.asyncio
async def test_view_id_builds_a_semantic_view_explore_link() -> None:
    with (
        patch(GET_DATASOURCE, return_value=_mock_view()) as get_datasource,
        patch("superset.daos.dataset.DatasetDAO.find_by_id") as find_dataset,
        patch(PERMALINK, return_value="view_permalink"),
    ):
        content: dict[str, Any] = await _call({"view_id": 1, "config": LINE_CONFIG})

    assert content["error"] is None, content["error"]
    assert content["success"] is True
    assert content["url"] == "http://localhost:9001/explore/p/view_permalink/"
    assert content["permalink_key"] == "view_permalink"
    form_data: dict[str, Any] = content["form_data"]
    assert form_data["datasource"] == "1__semantic_view"
    assert form_data["viz_type"] == "echarts_timeseries_line"
    assert form_data["metrics"] == ["revenue"]
    get_datasource.assert_called_once()
    # The view id must never be looked up as a table dataset.
    find_dataset.assert_not_called()


@pytest.mark.asyncio
async def test_view_id_without_config_opens_the_view_in_explore() -> None:
    with patch(GET_DATASOURCE, return_value=_mock_view(4)):
        content: dict[str, Any] = await _call({"view_id": 4})

    assert content["success"] is True
    assert content["url"] == (
        "http://localhost:9001/explore/?datasource_type=semantic_view&datasource_id=4"
    )


@pytest.mark.asyncio
async def test_missing_view_is_a_typed_error() -> None:
    from superset.daos.exceptions import DatasourceNotFound

    with patch(GET_DATASOURCE, side_effect=DatasourceNotFound()):
        content: dict[str, Any] = await _call({"view_id": 404, "config": LINE_CONFIG})

    assert content["success"] is False
    assert content["error"]["error_type"] == "view_not_found"
    assert content["error"]["error_code"] == "MCP_SEMANTIC_VIEW_NOT_FOUND"


@pytest.mark.asyncio
async def test_adhoc_aggregate_on_a_view_is_rejected() -> None:
    config: dict[str, Any] = {
        **LINE_CONFIG,
        "y": [{"name": "revenue", "aggregate": "SUM"}],
    }
    with patch(GET_DATASOURCE, return_value=_mock_view()):
        content: dict[str, Any] = await _call({"view_id": 1, "config": config})

    assert content["success"] is False
    assert content["error"]["error_type"] == "semantic_view_adhoc_not_supported"


@pytest.mark.asyncio
async def test_implicit_aggregate_cannot_bypass_semantic_validation() -> None:
    """A dimension used as a metric must not become an implicit SUM expression."""
    config: dict[str, Any] = {
        **LINE_CONFIG,
        "y": [{"name": "metric_time", "label": "Implicit metric"}],
    }
    with (
        patch(GET_DATASOURCE, return_value=_mock_view()),
        patch(PERMALINK) as permalink,
        patch(FORM_DATA_KEY) as cache,
    ):
        content: dict[str, Any] = await _call({"view_id": 1, "config": config})
    assert content["success"] is False
    assert content["error"]["error_type"] == "semantic_view_adhoc_not_supported"
    permalink.assert_not_called()
    cache.assert_not_called()


@pytest.mark.asyncio
async def test_permalink_failure_falls_back_to_a_semantic_view_form_data_key() -> None:
    from superset.explore.permalink.exceptions import (
        ExplorePermalinkCreateFailedError,
    )

    with (
        patch(GET_DATASOURCE, return_value=_mock_view()),
        patch(PERMALINK, side_effect=ExplorePermalinkCreateFailedError("no")),
        patch(FORM_DATA_KEY, return_value="fdk123") as create_form_data,
    ):
        content: dict[str, Any] = await _call({"view_id": 1, "config": LINE_CONFIG})

    assert content["success"] is True
    assert "form_data_key=fdk123" in content["url"]
    assert content["form_data_key"] == "fdk123"
    create_form_data.assert_called_once()
