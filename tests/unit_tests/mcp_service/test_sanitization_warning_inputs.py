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
    CreateVirtualDatasetRequest,
    UpdateDatasetMetricRequest,
    UpdateDatasetRequest,
)
from superset.mcp_service.middleware import ToolResultCompatibilityMiddleware
from superset.mcp_service.sql_lab.schemas import SaveSqlQueryRequest
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
    ["Users aged <30", "Revenue <$1M", "Love <3 charts", "Users aged <30 & “VIP” 📈"],
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


@pytest.mark.parametrize(
    "model,payload,field",
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
    ],
)
@pytest.mark.parametrize(
    "value", ["Users aged <30", "&#x3c;&#x3c;</b>x", "&amp;lt;</script>click= <b>📈"]
)
def test_sibling_fields_use_single_sanitizer_result(
    model: type[BaseModel], payload: dict[str, Any], field: str, value: str
) -> None:
    """Shared-sanitizer siblings preserve comparisons and never re-sanitize output."""
    from superset.mcp_service.utils.sanitization import sanitize_user_input

    if model is InteractivePivotChartConfig:
        payload = {**payload, "comparison_type": "values"}
    sql_identifier = field in ("column", "temporal_column", "name")
    expected: str | int | float | None
    try:
        if model is FilterConfig and field == "value":
            from superset.mcp_service.utils.sanitization import sanitize_filter_value

            expected = sanitize_filter_value(value)
        else:
            expected = sanitize_user_input(
                value,
                "Value",
                max_length=500,
                check_sql_keywords=sql_identifier,
                allow_empty=True,
            )
    except ValueError:
        # SQL identifiers intentionally reject ampersands in the encoded result.
        with pytest.raises(ValidationError):
            model.model_validate({**payload, field: value})
        return
    is_list = field.endswith("_labels")
    request = model.model_validate({**payload, field: [value] if is_list else value})
    assert getattr(request, field) == ([expected] if is_list else expected)


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
