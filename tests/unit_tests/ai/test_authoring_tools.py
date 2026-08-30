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
"""Tests for native adapters over Superset's MCP authoring tools."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from superset.ai.tools.authoring import (
    _call_mcp_tool,
    _run_mcp_tool,
    CreateVirtualDatasetTool,
    GenerateChartTool,
    GenerateDashboardTool,
)
from superset.ai.tools.base import ToolError
from superset.mcp_service.chart.schemas import GenerateChartRequest
from superset.utils import json


def test_generate_chart_returns_an_inline_embed() -> None:
    def generate(request: Any) -> dict[str, Any]:
        assert request.save_chart is True
        return {
            "success": True,
            "chart": {"id": 42},
            "form_data_key": "chart-preview-42",
            "explore_url": "/explore/?slice_id=42",
        }

    output = GenerateChartTool(caller=generate).run(
        dataset_id=1,
        config={
            "chart_type": "big_number",
            "metric": {"name": "amount", "aggregate": "SUM"},
        },
        chart_name="Total amount",
        save_chart=True,
    )

    assert output.payload["chart_id"] == 42
    assert "form_data_key=chart-preview-42" in output.payload["chat_embed_markdown"]
    assert output.display == {
        "kind": "chart_authoring",
        "success": True,
        "chart_id": 42,
        "form_data_key": "chart-preview-42",
        "explore_url": "/explore/?slice_id=42",
    }


def test_generate_chart_accepts_json_config() -> None:
    output = GenerateChartTool(
        caller=lambda _request: {"success": True, "form_data_key": "preview"}
    ).run(
        dataset_id=1,
        config=json.dumps(
            {
                "chart_type": "big_number",
                "metric": {"name": "amount", "aggregate": "SUM"},
            }
        ),
    )

    assert output.payload["form_data_key"] == "preview"


def test_mcp_runner_isolates_request_state(app_context: None) -> None:
    from flask import g, has_request_context

    original_user = MagicMock(username="admin", email="admin@example.test")
    worker_user = MagicMock(username="admin", email="admin@example.test")
    g.user = original_user
    seen: list[tuple[Any, bool]] = []

    async def call(_tool_name: str, _request: Any) -> dict[str, Any]:
        from flask import g as worker_g

        seen.append((worker_g.user, has_request_context()))
        return {"success": True}

    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "amount", "aggregate": "SUM"},
            },
        }
    )

    with (
        patch("superset.ai.tools.authoring._call_mcp_tool", new=call),
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=worker_user,
        ) as load_user,
    ):

        async def run() -> dict[str, Any]:
            return _run_mcp_tool("generate_chart", request)

        output = asyncio.run(run())

    assert output == {"success": True}
    load_user.assert_called_once_with(username="admin", email="admin@example.test")
    assert seen == [(worker_user, True)]
    assert g.user is original_user


def test_mcp_runner_times_out_stalled_worker(app_context: None) -> None:
    from flask import current_app, g

    g.user = MagicMock(username="admin", email="admin@example.test")
    worker = MagicMock()
    worker.is_alive.return_value = True

    with (
        patch.dict(current_app.config, {"AI_AGENT_TIMEOUT_SECONDS": 12}),
        patch("superset.ai.tools.authoring.Thread", return_value=worker),
        pytest.raises(ToolError, match="authoring timed out"),
    ):
        _run_mcp_tool("generate_chart", MagicMock())

    worker.start.assert_called_once_with()
    worker.join.assert_called_once_with(12.0)


@pytest.mark.asyncio
async def test_mcp_call_prefers_structured_content() -> None:
    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.call_tool = AsyncMock(
        return_value=SimpleNamespace(
            is_error=False,
            data=object(),
            structured_content={"success": True},
        )
    )

    with patch("fastmcp.Client", return_value=client):
        result = await _call_mcp_tool(
            "generate_chart",
            GenerateChartRequest.model_validate(
                {
                    "dataset_id": 1,
                    "config": {
                        "chart_type": "big_number",
                        "metric": {"name": "amount", "aggregate": "SUM"},
                    },
                }
            ),
        )

    assert result == {"success": True}


def test_generate_dashboard_returns_the_native_url() -> None:
    def generate(request: Any) -> dict[str, Any]:
        assert request.chart_ids == [42, 43]
        return {"dashboard": {"id": 7}, "dashboard_url": "/dashboard/7/"}

    output = GenerateDashboardTool(caller=generate).run(
        chart_ids=[42, 43],
        dashboard_title="Summary",
    )

    assert output.payload["chat_link_markdown"] == "[Open dashboard](/dashboard/7/)"
    assert output.display is not None
    assert output.display["dashboard_id"] == 7


def test_create_virtual_dataset_returns_chartable_columns() -> None:
    def generate(request: Any) -> dict[str, Any]:
        assert request.database_id == 3
        return {
            "id": 51,
            "dataset_name": "event_totals",
            "database_id": 3,
            "columns": ["category", "period", "amount"],
            "url": "/explore/?datasource_id=51",
        }

    output = CreateVirtualDatasetTool(caller=generate).run(
        database_id=3,
        dataset_name="event_totals",
        sql="SELECT category, period, amount FROM analytics.events",
    )

    assert output.payload == {
        "dataset_id": 51,
        "dataset_name": "event_totals",
        "database_id": 3,
        "columns": ["category", "period", "amount"],
        "url": "/explore/?datasource_id=51",
    }


def test_authoring_validation_is_actionable() -> None:
    with pytest.raises(ToolError, match="chart_ids"):
        GenerateDashboardTool(caller=lambda _request: {}).run(chart_ids=[])


def test_authoring_failures_are_reported_as_tool_errors() -> None:
    with pytest.raises(ToolError, match="not saved"):
        GenerateChartTool(
            caller=lambda _request: {
                "success": False,
                "error": {"message": "Chart was not saved."},
            }
        ).run(
            dataset_id=1,
            config={
                "chart_type": "big_number",
                "metric": {"name": "amount", "aggregate": "SUM"},
            },
        )


def test_server_only_fields_are_not_offered_to_the_model() -> None:
    assert "sanitization_warnings" not in GenerateChartTool.input_schema["properties"]
    assert (
        "sanitization_warnings" not in GenerateDashboardTool.input_schema["properties"]
    )
