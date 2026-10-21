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

"""Regression tests for server-only MCP sanitization warnings."""

from typing import Any

import pytest
from fastmcp import FastMCP
from fastmcp.client import Client
from mcp.types import TextContent
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.schemas import GenerateChartRequest, UpdateChartRequest
from superset.mcp_service.dashboard.schemas import (
    DuplicateDashboardRequest,
    GenerateDashboardRequest,
    UpdateDashboardRequest,
)
from superset.mcp_service.middleware import ToolResultCompatibilityMiddleware
from superset.utils import json


@pytest.mark.parametrize(
    ("model", "payload", "title_field"),
    [
        (GenerateDashboardRequest, {"chart_ids": [1]}, "dashboard_title"),
        (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title"),
        (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title"),
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
        ),
    ],
)
@pytest.mark.parametrize("title", ["Safe title", "Safe <b>title</b>"])
def test_sanitization_warnings_are_server_only(
    model: type[
        GenerateChartRequest
        | GenerateDashboardRequest
        | UpdateDashboardRequest
        | DuplicateDashboardRequest
    ],
    payload: dict[str, Any],
    title_field: str,
    title: str,
) -> None:
    """Hide internal warnings in schemas without losing sanitization notices."""
    assert "sanitization_warnings" not in json.dumps(model.model_json_schema())
    # Also cover the type-adapter schema used by tool integrations.
    assert "sanitization_warnings" not in json.dumps(TypeAdapter(model).json_schema())

    payload = {
        **payload,
        title_field: title,
        "sanitization_warnings": ["caller-controlled warning"],
    }
    request = model.model_validate_json(json.dumps(payload))
    warnings = request.sanitization_warnings
    assert getattr(request, title_field) == "Safe title"
    if "<b>" in title:
        assert len(warnings) == 1
        assert title_field in warnings[0]
        assert "caller-controlled" not in warnings[0]
    else:
        assert warnings == []


@pytest.mark.parametrize(
    ("model", "payload", "field"),
    [
        (GenerateDashboardRequest, {"chart_ids": [1]}, "dashboard_title"),
        (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title"),
        (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title"),
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
        ),
    ],
)
@pytest.mark.parametrize(
    "title",
    [
        "[DEMO] Service Desk - Executive Summary "
        "(substitute data: Jira support tickets)",
        "Service Desk (source data: issue records and support tickets)",
    ],
)
def test_title_accepts_data_in_prose(
    model: type[
        GenerateChartRequest
        | GenerateDashboardRequest
        | UpdateDashboardRequest
        | DuplicateDashboardRequest
    ],
    payload: dict[str, Any],
    field: str,
    title: str,
) -> None:
    """A colon in prose is not a data URL scheme."""
    request = model.model_validate({**payload, field: title})
    assert getattr(request, field) == title
    assert request.sanitization_warnings == []


@pytest.mark.parametrize(
    ("model", "payload", "field"),
    [
        (GenerateDashboardRequest, {"chart_ids": [1]}, "dashboard_title"),
        (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title"),
        (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title"),
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
        ),
    ],
)
@pytest.mark.parametrize(
    "value",
    [
        "javascript:alert(1)",
        "data:text/html,payload",
        "<script>alert(1)</script>",
        "Inspect data: text,URL_PROBE",
    ],
)
def test_title_sanitization_error_names_field(
    model: type[
        GenerateChartRequest
        | GenerateDashboardRequest
        | UpdateDashboardRequest
        | DuplicateDashboardRequest
    ],
    payload: dict[str, Any],
    field: str,
    value: str,
) -> None:
    """Pre-field warning detection must preserve the rejected field's location."""
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "payload", "field"),
    [
        ("generate_dashboard", {"chart_ids": [1]}, "dashboard_title"),
        ("update_dashboard", {"identifier": 1}, "dashboard_title"),
        ("duplicate_dashboard", {"dashboard_id": 1}, "dashboard_title"),
        (
            "generate_chart",
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
        ),
        ("update_chart", {"identifier": 1}, "chart_name"),
    ],
)
@pytest.mark.parametrize("alias", [False, True])
@pytest.mark.parametrize(
    "rejected",
    [
        "javascript:alert('private-input')",
        "Inspect data: text,private-input",
        "java\tscript:private-input",
        "vb\nscript:private-input",
        "dat\ra:text/html,private-input",
    ],
)
async def test_title_sanitization_wire_error_names_field(
    tool: str,
    payload: dict[str, Any],
    field: str,
    alias: bool,
    rejected: str,
) -> None:
    """Real MCP argument validation names fields without exposing rejected input."""
    server = FastMCP("title-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    @server.tool
    def generate_dashboard(request: GenerateDashboardRequest) -> str:
        """Validate dashboard creation."""
        return "ok"

    @server.tool
    def update_dashboard(request: UpdateDashboardRequest) -> str:
        """Validate dashboard updates."""
        return "ok"

    @server.tool
    def duplicate_dashboard(request: DuplicateDashboardRequest) -> str:
        """Validate dashboard duplication."""
        return "ok"

    @server.tool
    def generate_chart(request: GenerateChartRequest) -> str:
        """Validate chart creation."""
        return "ok"

    @server.tool
    def update_chart(request: UpdateChartRequest) -> str:
        """Validate chart updates."""
        return "ok"

    async with Client(server) as client:
        result = await client.call_tool_mcp(
            tool, {"request": {**payload, "title" if alias else field: rejected}}
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.{field}: Invalid value" in message
    assert rejected not in message
    assert "private-input" not in message
