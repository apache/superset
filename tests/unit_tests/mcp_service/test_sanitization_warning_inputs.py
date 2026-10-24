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
from superset.mcp_service.dataset.schemas import (
    CreateDatasetMetricRequest,
    CreateDatasetRequest,
    CreateVirtualDatasetRequest,
    UpdateDatasetMetricRequest,
    UpdateDatasetRequest,
)
from superset.mcp_service.middleware import ToolResultCompatibilityMiddleware
from superset.mcp_service.sql_lab.schemas import OpenSqlLabRequest, SaveSqlQueryRequest
from superset.mcp_service.theme.schemas import CreateThemeRequest
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


def make_name_server() -> FastMCP:
    """Register required object-name request schemas for wire validation."""
    server = FastMCP("name-validation")
    server.add_middleware(ToolResultCompatibilityMiddleware())

    @server.tool
    def create_virtual_dataset(request: CreateVirtualDatasetRequest) -> str:
        """Validate virtual dataset creation."""
        return "ok"

    @server.tool
    def create_theme(request: CreateThemeRequest) -> str:
        """Validate theme creation."""
        return "ok"

    @server.tool
    def create_dataset_metric(request: CreateDatasetMetricRequest) -> str:
        """Validate metric creation."""
        return "ok"

    @server.tool
    def update_dataset_metric(request: UpdateDatasetMetricRequest) -> str:
        """Validate metric updates."""
        return "ok"

    @server.tool
    def update_dataset(request: UpdateDatasetRequest) -> str:
        """Validate dataset updates."""
        return "ok"

    @server.tool
    def save_sql_query(request: SaveSqlQueryRequest) -> str:
        """Validate saved query creation."""
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
        "Weekly &am<b></b>p;lt;b&amp;gt;KPIs",
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
        "Weekly &am<b></b>p;lt;b&amp;gt;KPIs",
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
            250,
        ),
        ("update_chart", {"identifier": 1}, "chart_name", 250),
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


_REQUIRED_NAME_CASES: list[tuple[str, dict[str, Any], str, list[str | None]]] = [
    (
        "create_virtual_dataset",
        {"database_id": 1, "sql": "select 1"},
        "dataset_name",
        ["", " \t\n"],
    ),
    ("create_theme", {"json_data": {}}, "theme_name", ["", " \t\n"]),
    (
        "create_dataset_metric",
        {"dataset_id": 1, "expression": "count(*)"},
        "metric_name",
        ["", " \t\n"],
    ),
    (
        "update_dataset_metric",
        {"dataset_id": 1, "metric": 1},
        "metric_name",
        ["", " \t\n", None],
    ),
    ("update_dataset", {"dataset_id": 1}, "table_name", ["", " \t\n", None]),
    (
        "save_sql_query",
        {"database_id": 1, "sql": "select 1"},
        "label",
        ["", " \t\n"],
    ),
]


_BLANK_ERROR_LIMIT_CASES: list[tuple[type[BaseModel], dict[str, Any], str, int]] = [
    (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title", 500),
    (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title", 500),
    (
        CreateVirtualDatasetRequest,
        {"database_id": 1, "sql": "select 1"},
        "dataset_name",
        250,
    ),
    (CreateThemeRequest, {"json_data": {}}, "theme_name", 250),
    (
        CreateDatasetMetricRequest,
        {"dataset_id": 1, "expression": "count(*)"},
        "metric_name",
        255,
    ),
    (UpdateDatasetMetricRequest, {"dataset_id": 1, "metric": 1}, "metric_name", 255),
    (UpdateDatasetRequest, {"dataset_id": 1}, "table_name", 250),
    (
        SaveSqlQueryRequest,
        {"database_id": 1, "sql": "select 1"},
        "label",
        256,
    ),
]


@pytest.mark.parametrize("model,payload,field,limit", _BLANK_ERROR_LIMIT_CASES)
@pytest.mark.parametrize("input_type", [str, bytes, bytearray])
@pytest.mark.parametrize("whitespace", [" ", "\u2003"])
def test_documented_blank_errors_precede_length(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    limit: int,
    input_type: type[str] | type[bytes] | type[bytearray],
    whitespace: str,
) -> None:
    """Every documented blank-name error takes precedence over its field cap."""
    blank = whitespace * (limit + 1)
    value = blank if input_type is str else input_type(blank.encode())
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["type"] == "empty_text"
    assert errors[0]["loc"] == (field,)


@pytest.mark.parametrize("model,payload,field,limit", _BLANK_ERROR_LIMIT_CASES)
@pytest.mark.parametrize("input_type", [str, bytes, bytearray])
@pytest.mark.parametrize("extra", [0, 1])
def test_documented_name_nonblank_length_boundary(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    limit: int,
    input_type: type[str] | type[bytes] | type[bytearray],
    extra: int,
) -> None:
    """Blank-first validation must not bypass the cap for nonblank names."""
    text = "x" * (limit + extra)
    value = text if input_type is str else input_type(text.encode())
    if extra:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, field: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"
        assert exc.value.errors()[0]["loc"] == (field,)
    else:
        assert getattr(model.model_validate({**payload, field: value}), field) == text


_LITERAL_NAME_LIMIT_CASES = [
    case
    for case in _BLANK_ERROR_LIMIT_CASES
    if case[2] in ("theme_name", "metric_name", "table_name")
]


@pytest.mark.parametrize("model,payload,field,limit", _LITERAL_NAME_LIMIT_CASES)
@pytest.mark.parametrize("input_type", [str, bytes, bytearray])
@pytest.mark.parametrize("extra", [0, 1])
def test_literal_names_keep_nonblank_whitespace(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    limit: int,
    input_type: type[str] | type[bytes] | type[bytearray],
    extra: int,
) -> None:
    """Blank-first checks preserve literal names and count their whitespace."""
    text = " " + "x" * (limit - 2 + extra) + " "
    value = text if input_type is str else input_type(text.encode())
    if extra:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, field: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"
    else:
        assert getattr(model.model_validate({**payload, field: value}), field) == text


@pytest.mark.parametrize("model,payload,field,limit", _LITERAL_NAME_LIMIT_CASES)
@pytest.mark.parametrize(
    "value,error_type",
    [
        (b"\xff", "string_unicode"),
        (bytearray(b"\xff"), "string_unicode"),
        (1, "string_type"),
    ],
)
def test_literal_names_reject_malformed_inputs(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    limit: int,
    value: bytes | bytearray | int,
    error_type: str,
) -> None:
    """Blank-first checks leave malformed-input errors to Pydantic."""
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    assert exc.value.errors()[0]["type"] == error_type
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool,payload,field",
    [(tool, payload, field) for tool, payload, field, _ in _REQUIRED_NAME_CASES],
)
@pytest.mark.parametrize("extra", [1, 50])
async def test_required_name_over_cap_blank_wire_reason(
    tool: str,
    payload: dict[str, Any],
    field: str,
    extra: int,
) -> None:
    """Over-cap blank names retain the documented safe reason over MCP."""
    limit = {"metric_name": 255, "label": 256}.get(field, 250)
    async with Client(make_name_server()) as client:
        result = await client.call_tool_mcp(
            tool, {"request": {**payload, field: " " * (limit + extra)}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text=f"Error: Validation error in {tool}: request.{field}: "
            "Text must not be empty",
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "payload", "field", "rejected"),
    [
        (tool, payload, field, rejected)
        for tool, payload, field, blanks in _REQUIRED_NAME_CASES
        for rejected in blanks
    ],
)
async def test_required_name_empty_wire_reason(
    tool: str, payload: dict[str, Any], field: str, rejected: str | None
) -> None:
    """Blank object names report a safe reason at the declared field."""
    async with Client(make_name_server()) as client:
        result = await client.call_tool_mcp(
            tool, {"request": {**payload, field: rejected}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text=f"Error: Validation error in {tool}: request.{field}: "
            "Text must not be empty",
        )
    ]


@pytest.mark.parametrize(
    "model,payload",
    [
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
        ),
        (UpdateChartRequest, {"identifier": 1}),
    ],
)
@pytest.mark.parametrize("length", [250, 251, 252, 253, 254, 255])
def test_chart_name_model_column_boundary(
    model: type[BaseModel], payload: dict[str, Any], length: int
) -> None:
    """Chart names must fit the persisted Slice name column."""
    from superset.models.slice import Slice

    limit = Slice.__table__.c.slice_name.type.length
    assert limit == 250
    if length <= limit:
        assert (
            model.model_validate({**payload, "chart_name": "x" * length}).chart_name
            == "x" * length
        )
    else:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, "chart_name": "x" * length})
        assert exc.value.errors()[0]["type"] == "string_too_long"
        assert exc.value.errors()[0]["loc"] == ("chart_name",)


@pytest.mark.parametrize(
    "model,payload",
    [
        (
            GenerateChartRequest,
            {
                "dataset_id": 1,
                "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            },
        ),
        (UpdateChartRequest, {"identifier": 1}),
    ],
)
@pytest.mark.parametrize("alias", ["chart_name", "name", "title", "slice_name"])
@pytest.mark.parametrize("length", [250, 251])
def test_padded_chart_name_boundary(
    model: type[BaseModel], payload: dict[str, Any], alias: str, length: int
) -> None:
    """Validate the trimmed chart name against the model column boundary."""
    value = "  " + "x" * length + "  "
    if length == 250:
        assert (
            model.model_validate({**payload, alias: value}).chart_name == "x" * length
        )
    else:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, alias: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"


@pytest.mark.parametrize("length", [250, 251, 310])
def test_theme_name_model_column_boundary(length: int) -> None:
    """Theme creation must respect its persisted name column."""
    from superset.models.core import Theme

    assert Theme.__table__.c.theme_name.type.length == 250
    if length == 250:
        assert (
            CreateThemeRequest(theme_name="x" * length, json_data={}).theme_name
            == "x" * length
        )
    else:
        with pytest.raises(ValidationError) as exc:
            CreateThemeRequest(theme_name="x" * length, json_data={})
        assert exc.value.errors()[0]["type"] == "string_too_long"


@pytest.mark.asyncio
@pytest.mark.parametrize("alias", ["dashboard_title", "title", "name"])
@pytest.mark.parametrize("value", ["", " \t\n"])
async def test_update_dashboard_blank_title_wire_reason(alias: str, value: str) -> None:
    """Reject blank renames rather than reporting a title that was not saved."""
    async with Client(make_title_server()) as client:
        result = await client.call_tool_mcp(
            "update_dashboard", {"request": {"identifier": 1, alias: value}}
        )
    assert result.isError is True
    assert "request.dashboard_title: Text must not be empty" in result.content[0].text


@pytest.mark.parametrize("alias", ["chart_name", "name", "title", "slice_name"])
@pytest.mark.parametrize("script_only", [True, False])
def test_update_chart_sanitization_matches_generate(
    alias: str, script_only: bool
) -> None:
    """Update rejects stripped-only names and warns on partially stripped names."""
    if script_only:
        with pytest.raises(ValidationError) as exc:
            UpdateChartRequest.model_validate(
                {"identifier": 1, alias: "<script>alert(1)</script>"}
            )
        assert exc.value.errors()[0]["type"] == "unsafe_text"
        assert exc.value.errors()[0]["loc"] == ("chart_name",)
        return
    request = UpdateChartRequest.model_validate(
        {
            "identifier": 1,
            alias: "Weekly KPIs <img src=x onerror=alert(1)>",
            "sanitization_warnings": ["untrusted"],
        }
    )
    assert request.chart_name == "Weekly KPIs"
    assert len(request.sanitization_warnings) == 1
    assert "untrusted" not in request.sanitization_warnings
    assert "sanitization_warnings" not in json.dumps(
        UpdateChartRequest.model_json_schema()
    )


def test_duplicate_dataset_error_is_readable() -> None:
    """Duplicate errors use a plain string and preserve display-name characters."""
    from superset.commands.dataset.exceptions import DatasetExistsValidationError
    from superset.sql.parse import Table

    name = "Sales “Q3” & Growth"
    error = DatasetExistsValidationError(
        Table(name, schema="my schema", catalog="my catalog")
    )
    assert error.normalized_messages() == {
        "table": [f"Dataset my catalog.my schema.{name} already exists"]
    }
    assert type(error.messages[0]) is str


@pytest.mark.parametrize(
    "kind,limit", [("dataset", 250), ("saved_query", 256), ("tab", 256)]
)
@pytest.mark.parametrize("extra", [0, 1])
def test_padded_sibling_name_boundary(kind: str, limit: int, extra: int) -> None:
    """Persisted names that trim must check the length after trimming."""
    from superset.mcp_service.sql_lab.schemas import OpenSqlLabRequest

    cases: dict[str, tuple[type[BaseModel], dict[str, Any], str]] = {
        "dataset": (
            CreateVirtualDatasetRequest,
            {"database_id": 1, "sql": "select 1"},
            "dataset_name",
        ),
        "saved_query": (
            SaveSqlQueryRequest,
            {"database_id": 1, "sql": "select 1"},
            "label",
        ),
        "tab": (OpenSqlLabRequest, {"database_id": 1}, "title"),
    }
    model, payload, field = cases[kind]
    value = "x" * (limit + extra)
    if not extra:
        assert (
            getattr(model.model_validate({**payload, field: f"  {value}  "}), field)
            == value
        )
    else:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, field: f"  {value}  "})
        assert exc.value.errors()[0]["type"] == "string_too_long"


@pytest.mark.parametrize(
    "model,payload",
    [
        (GenerateDashboardRequest, {"chart_ids": [1]}),
        (UpdateDashboardRequest, {"identifier": 1}),
        (DuplicateDashboardRequest, {"dashboard_id": 1}),
    ],
)
@pytest.mark.parametrize("alias", ["dashboard_title", "title", "name"])
@pytest.mark.parametrize("length", [500, 501])
def test_padded_dashboard_title_boundary(
    model: type[BaseModel], payload: dict[str, Any], alias: str, length: int
) -> None:
    """Dashboard aliases check the trimmed title against the column cap."""
    if length == 500:
        assert (
            model.model_validate(
                {**payload, alias: "  " + "x" * length + "  "}
            ).dashboard_title
            == "x" * length
        )
    else:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, alias: "  " + "x" * length + "  "})
        assert exc.value.errors()[0]["type"] == "string_too_long"


def test_padded_dashboard_slug_boundary() -> None:
    """Update slug normalization precedes its persisted column limit."""
    request = UpdateDashboardRequest(identifier=1, slug="  " + "x" * 255 + "  ")
    assert request.slug == "x" * 255
    with pytest.raises(ValidationError):
        UpdateDashboardRequest(identifier=1, slug="  " + "x" * 256 + "  ")


_TITLE_SANITIZATION_CASES = [
    (
        GenerateChartRequest,
        {
            "dataset_id": 1,
            "config": {"chart_type": "table", "columns": [{"name": "a"}]},
            "save_chart": False,
        },
        "chart_name",
    ),
    (
        GenerateChartRequest,
        {
            "dataset_id": 1,
            "config": {"chart_type": "table", "columns": [{"name": "a"}]},
        },
        "chart_name",
    ),
    (UpdateChartRequest, {"identifier": 1}, "chart_name"),
    (GenerateDashboardRequest, {"chart_ids": [1]}, "dashboard_title"),
    (UpdateDashboardRequest, {"identifier": 1}, "dashboard_title"),
    (DuplicateDashboardRequest, {"dashboard_id": 1}, "dashboard_title"),
]


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize(
    "value",
    [
        "Users aged <30",
        "Revenue <$1M",
        "Love <3 charts",
        "Users aged <30 & “VIP” 📈",
        "Users aged >30",
        "Revenue\u00a0>\u00a0$1M",
    ],
)
def test_literal_less_than_title_round_trip(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Non-tag less-than signs survive validation and JSON readback unchanged."""
    request = model.model_validate({**payload, field: value})
    assert getattr(request, field) == value
    assert request.sanitization_warnings == []
    assert json.loads(request.model_dump_json())[field] == value


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize(
    "value", ["Weekly <img src=x>KPIs", "Q3 <b>revenue</b> &amp; costs"]
)
def test_title_sanitized_once(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Persist the single sanitizer result, never a second-pass empty fallback."""
    from unittest.mock import patch

    from superset.mcp_service.utils.sanitization import sanitize_user_input

    expected = sanitize_user_input(value, "Title", max_length=500, allow_empty=True)
    assert expected
    with (
        patch(
            "superset.mcp_service.utils.sanitization.sanitize_user_input",
            wraps=sanitize_user_input,
        ) as sanitize,
        patch("superset.mcp_service.chart.schemas.sanitize_user_input", sanitize),
        patch("superset.mcp_service.dashboard.schemas.sanitize_user_input", sanitize),
    ):
        request = model.model_validate({**payload, field: value})
    calls = [
        c
        for c in sanitize.call_args_list
        if c.args[1] in ("Chart name", "Dashboard title")
    ]
    assert len(calls) == 1
    assert getattr(request, field) == expected
    assert len(request.sanitization_warnings) == 1


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize(
    "value", ["&#x3c;&#x3c;</b>x", "&amp;lt;</script>click= <b>📈"]
)
def test_reconstructed_tag_title_rejected(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Encoded tag text is rejected instead of stored or auto-named."""
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    assert exc.value.errors()[0]["loc"] == (field,)
    assert exc.value.errors()[0]["type"] == "unsafe_text"


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
def test_empty_sanitized_title_never_uses_fallback(
    model: type[BaseModel], payload: dict[str, Any], field: str
) -> None:
    """Encoded script-only names retain the existing disallowed-content reason."""
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: "&amp;lt;script>alert(1)</script>"})
    assert exc.value.errors()[0]["loc"] == (field,)
    assert exc.value.errors()[0]["type"] == "unsafe_text"


_SIBLING_SANITIZATION_CASES = [
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
        {
            "hierarchy": [{"name": "region"}],
            "metric": {"name": "amount", "aggregate": "SUM"},
        },
        "time_range",
    ),
    (
        InteractivePivotChartConfig,
        {
            "rows": [{"name": "region"}],
            "metrics": [{"name": "amount", "aggregate": "SUM"}],
        },
        "comparison_period",
    ),
    (
        BulletChartConfig,
        {"metric": {"name": "amount", "aggregate": "SUM"}},
        "time_range",
    ),
    (
        BulletChartConfig,
        {"metric": {"name": "amount", "aggregate": "SUM"}},
        "range_labels",
    ),
    (
        BulletChartConfig,
        {"metric": {"name": "amount", "aggregate": "SUM"}},
        "marker_labels",
    ),
    (
        BulletChartConfig,
        {"metric": {"name": "amount", "aggregate": "SUM"}},
        "marker_line_labels",
    ),
]


@pytest.mark.parametrize("model,payload,field", _SIBLING_SANITIZATION_CASES)
@pytest.mark.parametrize(
    "value", ["Users aged <30", "Users aged >30", "Users\u00a0>30"]
)
def test_sibling_fields_preserve_literal_comparison(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Every sibling accepts a non-tag comparison and preserves its literal text."""
    if model is InteractivePivotChartConfig:
        payload = {**payload, "comparison_type": "values"}
    expected = [value] if field.endswith("_labels") else value
    request = model.model_validate({**payload, field: expected})
    assert getattr(request, field) == expected


@pytest.mark.parametrize("model,payload,field", _SIBLING_SANITIZATION_CASES)
@pytest.mark.parametrize(
    "value", ["&#x3c;&#x3c;</b>x", "&amp;lt;</script>click= <b>📈"]
)
def test_sibling_fields_reject_reconstructed_tag(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Reconstructed tag openers fail with a canonical field and typed reason."""
    if model is InteractivePivotChartConfig:
        payload = {**payload, "comparison_type": "values"}
    with pytest.raises(ValidationError) as exc:
        model.model_validate(
            {**payload, field: [value] if field.endswith("_labels") else value}
        )
    assert [(error["type"], error["loc"]) for error in exc.value.errors()] == [
        ("unsafe_text", (field,))
    ]


@pytest.mark.parametrize(
    "model,payload,field",
    [
        (
            CreateVirtualDatasetRequest,
            {"database_id": 1, "sql": "select 1"},
            "dataset_name",
        ),
        (UpdateDatasetRequest, {"dataset_id": 1}, "table_name"),
        (
            CreateDatasetMetricRequest,
            {"dataset_id": 1, "expression": "SUM(x)"},
            "metric_name",
        ),
        (UpdateDatasetMetricRequest, {"dataset_id": 1, "metric": 1}, "metric_name"),
        (CreateThemeRequest, {"json_data": {}}, "theme_name"),
        (SaveSqlQueryRequest, {"database_id": 1, "sql": "select 1"}, "label"),
        (
            CreateVirtualDatasetRequest,
            {"database_id": 1, "sql": "select 1", "dataset_name": "ds"},
            "description",
        ),
        (UpdateDatasetRequest, {"dataset_id": 1}, "description"),
        (
            SaveSqlQueryRequest,
            {"database_id": 1, "sql": "select 1", "label": "query"},
            "description",
        ),
        (UpdateDashboardRequest, {"identifier": 1}, "description"),
    ],
)
@pytest.mark.parametrize(
    "value",
    [
        "Users aged <30",
        "Revenue <$1M",
        "Love <3 charts",
        "&#x3c;&#x3c;</b>x",
        "&amp;lt;</script>click= <b>📈",
    ],
)
def test_unsanitized_sibling_names_remain_literal(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Non-sanitizer paths retain their existing literal identifier/text contract."""
    request = model.model_validate({**payload, field: value})
    assert getattr(request, field) == value


@pytest.mark.parametrize(
    "value",
    [
        "Users aged <30",
        "Revenue <$1M",
        "Love <3 charts",
        "&#x3c;&#x3c;</b>x",
        "&amp;lt;</script>click= <b>📈",
    ],
)
def test_sql_lab_title_remains_literal(value: str) -> None:
    """SQL Lab tab titles trim whitespace without HTML sanitization."""
    from superset.mcp_service.sql_lab.schemas import OpenSqlLabRequest

    assert OpenSqlLabRequest(database_id=1, title=value).title == value


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["dashboard_title", "title", "name"])
@pytest.mark.parametrize(
    "rejected", ["<script>alert(1)</script>", "Weekly &am<b></b>p;lt;b&amp;gt;KPIs"]
)
async def test_duplicate_dashboard_removed_or_unstable_title_wire_reason(
    field: str, rejected: str
) -> None:
    """Removed or unstable markup is unsafe content, not an empty input."""
    async with Client(make_title_server()) as client:
        result = await client.call_tool_mcp(
            "duplicate_dashboard", {"request": {"dashboard_id": 1, field: rejected}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text="Error: Validation error in duplicate_dashboard: "
            "request.dashboard_title: Contains disallowed content "
            "(HTML, script or data: URL, event handler, or SQL keyword); "
            "a 'data:' label must not be followed by a comma",
        )
    ]


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("character", [">", "\u00a0"])
@pytest.mark.parametrize("at_limit", [True, False])
def test_title_length_counts_plain_text(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    character: str,
    at_limit: bool,
) -> None:
    """Entity serialization must not inflate persisted titles or reject valid ones."""
    limit = 250 if field == "chart_name" else 500
    value = "x" * (limit - 2 + (not at_limit)) + character + "y"
    if not at_limit:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, field: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"
        return
    request = model.model_validate({**payload, field: value})
    assert getattr(request, field) == value
    assert len(getattr(request, field)) == limit
    assert request.sanitization_warnings == []
    assert getattr(model.model_validate(request.model_dump()), field) == value


def test_builtin_name_validation_documented_for_administrators() -> None:
    """Built-in validation guidance belongs with server administration."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[3]
    admin = (root / "docs/admin_docs/configuration/mcp-server.mdx").read_text()
    extensions = (root / "docs/developer_docs/extensions/mcp.md").read_text()
    for heading in ("Chart and dashboard titles", "Object-name validation"):
        assert heading in admin
        assert heading not in extensions
    assert "Theme names retain their whitespace" in admin
    assert "length validation applies after trimming" in admin


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
def test_escaped_title_still_fits_model_column(
    model: type[BaseModel], payload: dict[str, Any], field: str
) -> None:
    """Conservative bracket escaping cannot bypass a persisted title's length cap."""
    limit = 250 if field == "chart_name" else 500
    value = "x" * (limit - 2) + "<ſ"
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    assert exc.value.errors()[0]["type"] == "string_too_long"


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("whitespace", ["\t", "\n", "\r", "\v", "\f", "\x85"])
@pytest.mark.parametrize(
    "control",
    ["!channel", "@U123", "#C123|general", "https://example.invalid|Open dashboard"],
)
def test_title_control_whitespace_cannot_form_slack_markup(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    whitespace: str,
    control: str,
) -> None:
    """Report title normalization must not join brackets into Slack controls."""
    from superset.utils.file import sanitize_title

    value = f"Q3 <{whitespace}{control}>"
    request = model.model_validate({**payload, field: value})
    stored = getattr(request, field)
    assert "<" not in sanitize_title(stored)
    assert getattr(model.model_validate(request.model_dump()), field) == stored


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("alias_index", range(4))
@pytest.mark.parametrize("length_delta", [-5, 0, 1])
@pytest.mark.parametrize("padding", ["", " ", "&#32;", "\u00a0"])
def test_markup_title_length_uses_sanitized_text(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    alias_index: int,
    length_delta: int,
    padding: str,
) -> None:
    """Markup is not part of the persisted title's character budget."""
    aliases = (
        ("chart_name", "name", "title", "slice_name")
        if field == "chart_name"
        else ("dashboard_title", "title", "name", "dashboard_title")
    )
    limit = 250 if field == "chart_name" else 500
    text = "x" * (limit + length_delta)
    value = "<b>" + padding + text + padding + "</b>"
    if length_delta > 0:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, aliases[alias_index]: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"
    else:
        request = model.model_validate({**payload, aliases[alias_index]: value})
        assert getattr(request, field) == text
        assert len(request.sanitization_warnings) == 1


@pytest.mark.parametrize(
    "model,payload,field",
    [case for case in _SIBLING_SANITIZATION_CASES if case[2] != "value"],
)
@pytest.mark.parametrize("extra", [0, 1])
@pytest.mark.parametrize("padding", ["", " ", "&#32;", "\u00a0"])
def test_sibling_sanitized_length_budget(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    extra: int,
    padding: str,
) -> None:
    """All callers of the shared text sanitizer enforce the final text cap."""
    limits = {
        "certified_by": 500,
        "certification_details": 5000,
        "temporal_column": 255,
        "name": 255,
        "label": 500,
        "column": 255,
        "time_range": 1000,
        "comparison_period": 100,
        "range_labels": 200,
        "marker_labels": 200,
        "marker_line_labels": 200,
    }
    if model is InteractivePivotChartConfig:
        payload = {**payload, "comparison_type": "values"}
    text = "x" * (limits[field] + extra)
    value = "<b>" + padding + text + padding + "</b>"
    if extra:
        with pytest.raises(ValidationError) as exc:
            model.model_validate(
                {**payload, field: [value] if field.endswith("_labels") else value}
            )
        assert exc.value.errors()[0]["type"] == "string_too_long"
    else:
        request = model.model_validate(
            {**payload, field: [value] if field.endswith("_labels") else value}
        )
        assert getattr(request, field) == (
            [text] if field.endswith("_labels") else text
        )


@pytest.mark.parametrize(
    "model,payload,field",
    _TITLE_SANITIZATION_CASES
    + [
        case
        for case in _SIBLING_SANITIZATION_CASES
        if case[2] != "value" and not case[2].endswith("_labels")
    ],
)
@pytest.mark.parametrize("value", [b"<b>Safe</b>", bytearray(b"<b>Safe</b>")])
def test_sibling_byte_strings_are_sanitized_before_coercion(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    value: bytes | bytearray,
) -> None:
    """Pydantic's byte-string decoding must not bypass before sanitizers."""
    if model is InteractivePivotChartConfig:
        payload = {**payload, "comparison_type": "values"}
    request = model.model_validate({**payload, field: value})
    assert getattr(request, field) == "Safe"


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("alias_index", range(4))
@pytest.mark.parametrize("input_type", [str, bytes, bytearray])
@pytest.mark.parametrize("length", [0, 251, 501, 10001])
def test_blank_titles_normalize_before_length(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    alias_index: int,
    input_type: type[str] | type[bytes] | type[bytearray],
    length: int,
) -> None:
    """Blank fallback or required-title errors precede the persisted length cap."""
    aliases = (
        ("chart_name", "name", "title", "slice_name")
        if field == "chart_name"
        else ("dashboard_title", "title", "name", "dashboard_title")
    )
    blank = " " * length
    value = blank if input_type is str else input_type(blank.encode())
    if model in (UpdateDashboardRequest, DuplicateDashboardRequest):
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, aliases[alias_index]: value})
        assert exc.value.errors()[0]["type"] == "empty_text"
        assert exc.value.errors()[0]["loc"] == (field,)
    else:
        request = model.model_validate({**payload, aliases[alias_index]: value})
        expected = "" if model is GenerateDashboardRequest and length == 0 else None
        assert getattr(request, field) == expected
        assert request.sanitization_warnings == []


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("alias_index", range(4))
@pytest.mark.parametrize("as_bytearray", [False, True])
@pytest.mark.parametrize("extra", [0, 1])
def test_byte_title_sanitized_length_boundary(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    alias_index: int,
    as_bytearray: bool,
    extra: int,
) -> None:
    """Decoded title aliases sanitize before their final text length is checked."""
    aliases = (
        ("chart_name", "name", "title", "slice_name")
        if field == "chart_name"
        else ("dashboard_title", "title", "name", "dashboard_title")
    )
    limit = 250 if field == "chart_name" else 500
    text = "x" * (limit + extra)
    encoded = f"<b> {text} </b>".encode()
    value = bytearray(encoded) if as_bytearray else encoded
    if extra:
        with pytest.raises(ValidationError) as exc:
            model.model_validate({**payload, aliases[alias_index]: value})
        assert exc.value.errors()[0]["type"] == "string_too_long"
    else:
        request = model.model_validate({**payload, aliases[alias_index]: value})
        assert getattr(request, field) == text
        assert len(request.sanitization_warnings) == 1


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("as_bytearray", [False, True])
def test_byte_title_removed_content_is_rejected(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    as_bytearray: bool,
) -> None:
    """Byte decoding cannot bypass the stripped-only title guard."""
    encoded = b"<script>alert(1)</script>"
    value = bytearray(encoded) if as_bytearray else encoded
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, field: value})
    assert exc.value.errors()[0]["type"] == "unsafe_text"
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize(
    "model,payload,field,limit",
    [
        (CreateDatasetRequest, {"database_id": 1}, "table_name", 250),
        (
            CreateVirtualDatasetRequest,
            {"database_id": 1, "sql": "select 1"},
            "dataset_name",
            250,
        ),
        (SaveSqlQueryRequest, {"database_id": 1, "sql": "select 1"}, "label", 256),
        (OpenSqlLabRequest, {"database_id": 1}, "title", 256),
    ],
)
@pytest.mark.parametrize("as_bytearray", [False, True])
def test_byte_object_name_trims_before_length(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    limit: int,
    as_bytearray: bool,
) -> None:
    """Literal-name models also normalize decoded whitespace before their cap."""
    text = "x" * limit
    encoded = f" {text} ".encode()
    value = bytearray(encoded) if as_bytearray else encoded
    request = model.model_validate({**payload, field: value})
    assert getattr(request, field) == text


@pytest.mark.parametrize("as_bytearray", [False, True])
@pytest.mark.parametrize(
    "value,expected",
    [(" " + "x" * 255 + " ", "x" * 255), (" My slug!? ", "My-slug"), (" " * 256, "")],
)
def test_byte_dashboard_slug_normalizes_before_length(
    as_bytearray: bool, value: str, expected: str
) -> None:
    """Slug coercion also precedes its existing REST-compatible normalization."""
    encoded = value.encode()
    byte_value = bytearray(encoded) if as_bytearray else encoded
    request = UpdateDashboardRequest.model_validate(
        {"identifier": 1, "slug": byte_value}
    )
    assert request.slug == expected


@pytest.mark.parametrize("field", ["schema_", "schema", "catalog"])
@pytest.mark.parametrize("as_bytearray", [False, True])
@pytest.mark.parametrize(
    "value,expected",
    [
        ("  public  ", "public"),
        ("   ", None),
        (" " * 251, None),
        (" " + "x" * 250 + " ", "x" * 250),
    ],
)
def test_byte_dataset_namespace_normalizes_before_length(
    field: str, as_bytearray: bool, value: str, expected: str | None
) -> None:
    """Namespace bytes follow the same trim/blank contract as string inputs."""
    encoded = value.encode()
    request = CreateDatasetRequest.model_validate(
        {
            "database_id": 1,
            "table_name": "t",
            field: bytearray(encoded) if as_bytearray else encoded,
        }
    )
    assert getattr(request, "schema_" if field == "schema" else field) == expected

    from superset.mcp_service.dataset.tool.create_dataset import (
        _build_dataset_properties,
    )

    properties, error = _build_dataset_properties(request)
    assert error is None
    expected_properties: dict[str, object] = {"database": 1, "table_name": "t"}
    if expected is not None:
        expected_properties["schema" if field == "schema_" else field] = expected
    assert properties == expected_properties


@pytest.mark.parametrize("model,payload,field", _TITLE_SANITIZATION_CASES)
@pytest.mark.parametrize("alias_index", range(4))
@pytest.mark.parametrize("value", [b"\xff", bytearray(b"\xff")])
def test_invalid_utf8_title_error_is_field_located(
    model: type[BaseModel],
    payload: dict[str, Any],
    field: str,
    alias_index: int,
    value: bytes | bytearray,
) -> None:
    """Model-level byte decoding retains Pydantic's field-level Unicode error."""
    aliases = (
        ("chart_name", "name", "title", "slice_name")
        if field == "chart_name"
        else ("dashboard_title", "title", "name", "dashboard_title")
    )
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**payload, aliases[alias_index]: value})
    assert exc.value.errors()[0]["type"] == "string_unicode"
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize(
    "value", [b"/explore/p/safe-key/", bytearray(b"/explore/p/safe-key/")]
)
def test_byte_permalink_url_extracts_key(value: bytes | bytearray) -> None:
    """Byte permalink URLs cannot skip the same normalization as text URLs."""
    from superset.mcp_service.chart.schemas import GetChartInfoRequest

    request = GetChartInfoRequest.model_validate({"permalink_key": value})
    assert request.permalink_key == "safe-key"


@pytest.mark.parametrize("field", ["schema_", "schema", "catalog"])
@pytest.mark.parametrize(
    "value",
    ["x" * 251, b"x" * 251, bytearray(b"x" * 251), 1, True, {}, b"\xff"],
)
def test_dataset_namespace_rejects_malformed_values(field: str, value: object) -> None:
    """Namespace trimming does not omit malformed inputs or bypass the cap."""
    with pytest.raises(ValidationError) as exc:
        CreateDatasetRequest.model_validate(
            {"database_id": 1, "table_name": "t", field: value}
        )
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("as_bytearray", [False, True])
def test_byte_permalink_rejects_other_url(as_bytearray: bool) -> None:
    """Byte URLs outside the Explore permalink path cannot become cache keys."""
    from superset.mcp_service.chart.schemas import GetChartInfoRequest

    encoded = b"https://superset.example.com/superset/dashboard/p/key/"
    with pytest.raises(ValidationError) as exc:
        GetChartInfoRequest.model_validate(
            {"permalink_key": bytearray(encoded) if as_bytearray else encoded}
        )
    assert exc.value.errors()[0]["loc"] == ("permalink_key",)
