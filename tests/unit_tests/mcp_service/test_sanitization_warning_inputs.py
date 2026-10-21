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
from pydantic import BaseModel, TypeAdapter, ValidationError

from superset.mcp_service.chart.schemas import (
    BaseChartConfig,
    BulletChartConfig,
    ColumnRef,
    FilterConfig,
    GanttSortByConfig,
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    InteractivePivotChartConfig,
    SunburstChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)
from superset.mcp_service.dashboard.schemas import (
    DuplicateDashboardRequest,
    GenerateDashboardRequest,
    ManageDashboardCertificationRequest,
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


def make_title_server() -> FastMCP:
    """Register the real title request schemas for wire-level validation."""
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

    return server


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
        "Exec (source data: source-a, source-b) private-input",
        "java\tscript:private-input",
        "vb\nscript:private-input",
        "dat\ra:text/html,private-input",
    ],
)
async def test_title_sanitization_wire_error_names_field_with_actionable_reason(
    tool: str,
    payload: dict[str, Any],
    field: str,
    alias: bool,
    rejected: str,
) -> None:
    """Real MCP argument validation names fields without exposing rejected input."""
    server = make_title_server()

    async with Client(server) as client:
        result = await client.call_tool_mcp(
            tool, {"request": {**payload, "title" if alias else field: rejected}}
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.{field}: Contains disallowed content" in message
    assert "a 'data:' label must not be followed by a comma" in message
    assert rejected not in message
    assert "private-input" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("model", "payload", "field"),
    [
        (ManageDashboardCertificationRequest, {"identifier": 1}, "certified_by"),
        (
            ManageDashboardCertificationRequest,
            {"identifier": 1},
            "certification_details",
        ),
        (BaseChartConfig, {}, "temporal_column"),
        (ColumnRef, {}, "name"),
        (ColumnRef, {"name": "amount"}, "label"),
        (FilterConfig, {"op": "=", "value": "safe"}, "column"),
        (FilterConfig, {"column": "region", "op": "="}, "value"),
        (GanttSortByConfig, {}, "column"),
        (
            SunburstChartConfig,
            {"hierarchy": [{"name": "region"}], "metric": {"name": "amount"}},
            "time_range",
        ),
        (
            InteractivePivotChartConfig,
            {"rows": [{"name": "region"}], "metrics": [{"name": "amount"}]},
            "comparison_period",
        ),
        (BulletChartConfig, {"metric": {"name": "amount"}}, "time_range"),
        (BulletChartConfig, {"metric": {"name": "amount"}}, "range_labels"),
        (BulletChartConfig, {"metric": {"name": "amount"}}, "marker_labels"),
        (BulletChartConfig, {"metric": {"name": "amount"}}, "marker_line_labels"),
    ],
)
@pytest.mark.parametrize(
    "rejected",
    [
        "Exec (source data: source-a, source-b) private-input",
        "javascript:private-input",
    ],
)
async def test_sibling_sanitization_wire_error_names_field_with_actionable_reason(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    rejected: str,
) -> None:
    """Every sanitizer caller provides field-scoped, input-free wire diagnostics."""
    server = FastMCP("sibling-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    def validate(request: BaseModel) -> str:
        """Validate a sanitized text field without executing a tool."""
        return "ok"

    validate.__annotations__["request"] = model
    server.tool(validate)
    value: str | list[str] = [rejected] if field.endswith("labels") else rejected
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "validate", {"request": {**payload, field: value}}
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.{field}: " in message
    if field.endswith("labels") and "," in rejected:
        assert "Bullet labels cannot contain commas" in message
    else:
        assert f"request.{field}: Contains disallowed content" in message
        assert "a 'data:' label must not be followed by a comma" in message
    assert "Invalid value; check the field schema" not in message
    assert rejected not in message
    assert "private-input" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("model", "payload", "field", "value", "reason"),
    [
        (ColumnRef, {}, "name", " ", "Text must not be empty"),
        (
            ColumnRef,
            {},
            "sql_expression",
            "/* private-input */ SUM(amount)",
            "Contains disallowed content",
        ),
        (
            ColumnRef,
            {},
            "sql_expression",
            "a" * 2001,
            "String exceeds the allowed maximum length",
        ),
        (
            ColumnRef,
            {"name": "amount"},
            "label",
            "a" * 501,
            "String exceeds the allowed maximum length",
        ),
        (
            FilterConfig,
            {"column": "region", "op": "="},
            "value",
            "a" * 1001,
            "String exceeds the allowed maximum length",
        ),
        (
            FilterConfig,
            {"column": "region", "op": "="},
            "value",
            "private-input; DROP TABLE x",
            "Contains disallowed content",
        ),
        (
            ManageDashboardCertificationRequest,
            {"identifier": 1},
            "certified_by",
            "<b></b>",
            "No content remains after sanitization",
        ),
        (
            ManageDashboardCertificationRequest,
            {"identifier": 1},
            "certification_details",
            "<b></b>",
            "No content remains after sanitization",
        ),
    ],
)
async def test_sanitizer_guard_wire_error_is_actionable(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    value: str,
    reason: str,
) -> None:
    """Empty, oversized, and SQL-specific rejections also have safe reasons."""
    server = FastMCP("sanitizer-guard-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    def validate(request: BaseModel) -> str:
        """Validate sanitizer guards without executing a tool."""
        return "ok"

    validate.__annotations__["request"] = model
    server.tool(validate)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "validate", {"request": {**payload, field: value}}
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.{field}: {reason}" in message
    assert "private-input" not in message
    assert "Invalid value; check the field schema" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "model",
    [
        GenerateChartRequest,
        UpdateChartRequest,
        GenerateExploreLinkRequest,
        UpdateChartPreviewRequest,
    ],
)
@pytest.mark.parametrize(
    ("config", "field"),
    [
        (
            {
                "chart_type": "table",
                "columns": [
                    {"name": "amount", "label": "source data: a,b private-input"}
                ],
            },
            "columns.0.label",
        ),
        (
            {
                "chart_type": "table",
                "columns": [{"name": "amount"}],
                "temporal_column": "source data: a,b private-input",
            },
            "temporal_column",
        ),
        (
            {
                "chart_type": "bullet",
                "metric": {"name": "amount"},
                "time_range": "source data: a,b private-input",
            },
            "time_range",
        ),
    ],
)
async def test_nested_chart_sanitization_wire_error_names_field(
    model: type[BaseModel], config: dict[str, Any], field: str
) -> None:
    """Compact chart schemas must not hide the rejected nested field."""
    server = FastMCP("nested-chart-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    def validate(request: BaseModel) -> str:
        """Validate a chart request without executing a tool."""
        return "ok"

    validate.__annotations__["request"] = model
    server.tool(validate)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "validate",
            {"request": {"dataset_id": 1, "identifier": 1, "config": config}},
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.config.{field}: Contains disallowed content" in message
    assert "a 'data:' label must not be followed by a comma" in message
    assert "private-input" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("model", "payload", "alias", "field"),
    [
        (ColumnRef, {}, "column_name", "name"),
        (ColumnRef, {}, "column", "name"),
        (FilterConfig, {"op": "=", "value": "safe"}, "col", "column"),
        (FilterConfig, {"column": "region", "op": "IN"}, "val", "value"),
        (GanttSortByConfig, {}, "col", "column"),
    ],
)
async def test_sibling_alias_sanitization_wire_error_names_canonical_field(
    model: type[BaseModel], payload: dict[str, Any], alias: str, field: str
) -> None:
    """Input aliases must not hide the corresponding schema-backed field."""
    server = FastMCP("sibling-alias-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    def validate(request: BaseModel) -> str:
        """Validate an aliased sanitizer field without executing a tool."""
        return "ok"

    validate.__annotations__["request"] = model
    server.tool(validate)
    rejected = "source data: a,b private-input"
    value: str | list[str] = [rejected] if alias == "val" else rejected
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "validate", {"request": {**payload, alias: value}}
        )
    assert result.isError is True
    message = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert f"request.{field}: Contains disallowed content" in message
    assert "private-input" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "payload", "field", "limit"),
    [
        ("generate_dashboard", {"chart_ids": [1]}, "dashboard_title", 500),
        ("update_dashboard", {"identifier": 1}, "dashboard_title", 500),
        ("duplicate_dashboard", {"dashboard_id": 1}, "dashboard_title", 500),
        (
            "generate_chart",
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
            "chart_name",
            255,
        ),
        ("update_chart", {"identifier": 1}, "chart_name", 255),
    ],
)
@pytest.mark.parametrize("alias", [None, "title", "name"])
@pytest.mark.parametrize("length", [None, 600])
async def test_title_length_wire_reason(
    tool: str,
    payload: dict[str, Any],
    field: str,
    limit: int,
    alias: str | None,
    length: int | None,
) -> None:
    """Length errors retain their reason through warning detection and MCP."""
    rejected = "x" * (length or limit + 1)
    async with Client(make_title_server()) as client:
        result = await client.call_tool_mcp(
            tool, {"request": {**payload, alias or field: rejected}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text=f"Error: Validation error in {tool}: request.{field}: "
            "String exceeds the allowed maximum length",
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["dashboard_title", "title", "name"])
@pytest.mark.parametrize("rejected", ["", " \t\n"])
async def test_duplicate_dashboard_empty_title_wire_reason(
    field: str,
    rejected: str,
) -> None:
    """Blank required titles have a static, actionable reason on the wire."""
    async with Client(make_title_server()) as client:
        result = await client.call_tool_mcp(
            "duplicate_dashboard", {"request": {"dashboard_id": 1, field: rejected}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text="Error: Validation error in duplicate_dashboard: "
            "request.dashboard_title: Text must not be empty",
        )
    ]
