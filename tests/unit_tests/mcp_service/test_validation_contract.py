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

"""Producer wire contracts for safe argument-validation failures."""

from typing import Any

import pytest
from fastmcp import FastMCP
from fastmcp.client import Client
from fastmcp.tools.tool import ToolResult
from mcp.types import TextContent
from pydantic import BaseModel, field_validator

from superset.mcp_service.chart.schemas import GetChartSqlRequest, ListChartsRequest
from superset.mcp_service.dataset.schemas import ListDatasetsRequest
from superset.mcp_service.middleware import (
    GlobalErrorHandlerMiddleware,
    ToolResultCompatibilityMiddleware,
)
from superset.utils import json


class SensitiveRequest(BaseModel):
    """A validator whose exception must never be sent verbatim."""

    filters: dict[str, int] = {}
    secret: str = ""

    @field_validator("secret")
    @classmethod
    def reject_secret(cls, value: str) -> str:
        """Deliberately include input in the diagnostic to test redaction."""
        raise ValueError(f"Rejected {value}")


def make_server(*, inner_handler: bool, structured: bool) -> FastMCP:
    """Use real FastMCP validation and serialization, without a database."""
    server = FastMCP("validation-contract")
    server.add_middleware(
        ToolResultCompatibilityMiddleware(structured_output_enabled=structured)
    )
    if inner_handler:
        server.add_middleware(GlobalErrorHandlerMiddleware())

    @server.tool
    def list_datasets(request: ListDatasetsRequest | None = None) -> str:
        """Accept a wrapped list request."""
        return "ok"

    @server.tool
    def list_charts(request: ListChartsRequest | None = None) -> str:
        """Match the optional wrapper of the production list tool."""
        return "ok"

    @server.tool
    def get_chart_sql(request: GetChartSqlRequest) -> str:
        """Match the required wrapper of the production SQL tool."""
        return "ok"

    @server.tool
    def sensitive(request: SensitiveRequest) -> str:
        """Exercise untrusted messages and dictionary keys."""
        return "ok"

    return server


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("inner_handler", [False, True])
@pytest.mark.parametrize(
    ("tool", "arguments", "detail"),
    [
        (
            "list_datasets",
            {"request": {"page_size": "lots"}},
            "request.page_size: Expected an integer",
        ),
        (
            "list_datasets",
            {"page_size": 2},
            "request.page_size: Unexpected top-level argument (place under request)",
        ),
        (
            "list_charts",
            {"page_size": 2},
            "request.page_size: Unexpected top-level argument (place under request)",
        ),
        (
            "list_charts",
            {"request": {"page_size": "lots"}},
            "request.page_size: Expected an integer",
        ),
        ("get_chart_sql", {}, "request: Field required"),
    ],
)
async def test_validation_wire_contract(
    tool: str,
    arguments: dict[str, Any],
    detail: str,
    inner_handler: bool,
    structured: bool,
) -> None:
    """Failures carry both the MCP error flag and actionable safe detail."""
    server = make_server(inner_handler=inner_handler, structured=structured)
    async with Client(server) as client:
        result = await client.call_tool_mcp(tool, arguments)

    assert result.isError is True
    text = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert text == f"Error: Validation error in {tool}: {detail}"
    assert "[field]" not in text
    assert "lots" not in text
    assert "input_value" not in text
    assert "input_type" not in text
    assert "errors.pydantic.dev" not in text


@pytest.mark.asyncio
@pytest.mark.parametrize("inner_handler", [False, True])
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("tool", ["list_datasets", "list_charts"])
async def test_validation_masks_undeclared_top_level_keys(
    inner_handler: bool, structured: bool, tool: str
) -> None:
    """Wrapper hints must not disclose an arbitrary caller key or its value."""
    server = make_server(inner_handler=inner_handler, structured=structured)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            tool, {"caller-private-key": "caller-private-value"}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text=f"Error: Validation error in {tool}: [field]: Unexpected argument",
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("inner_handler", [False, True])
@pytest.mark.parametrize("key", ["secret", "filters", "request"])
async def test_validation_masks_keys_colliding_with_declared_fields(
    inner_handler: bool, key: str
) -> None:
    """A field declared elsewhere cannot authorize a free-form dictionary key."""
    server = make_server(inner_handler=inner_handler, structured=False)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "sensitive", {"request": {"filters": {key: "bad"}}}
        )
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text="Error: Validation error in sensitive: "
            "request.filters.[field]: Expected an integer",
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("inner_handler", [False, True])
async def test_validation_never_echoes_values_or_dynamic_keys(
    inner_handler: bool,
) -> None:
    """Neither validator text nor dictionary-key locations are trusted."""
    sensitive_value = (
        "secret-marker https://backend.invalid SELECT private FROM accounts"
    )
    server = make_server(inner_handler=inner_handler, structured=False)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "sensitive",
            {
                "request": {
                    "filters": {sensitive_value: "bad"},
                    "secret": sensitive_value,
                }
            },
        )
    text = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert result.isError is True
    assert "request.filters" in text
    assert "request.secret" in text
    for forbidden in (
        sensitive_value,
        "secret-marker",
        "backend.invalid",
        "SELECT",
        "accounts",
        "bad",
        "Traceback",
    ):
        assert forbidden not in text


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("is_error", [False, True])
async def test_structured_tool_error_is_unchanged(
    structured: bool, is_error: bool
) -> None:
    """Explicit domain errors retain their text, metadata and error flag."""
    server = make_server(inner_handler=True, structured=structured)
    payload = {
        "error_type": "column_not_found",
        "message": "Column unavailable",
        "suggestions": [],
    }
    original_text = json.dumps(payload)

    @server.tool
    def domain_error() -> ToolResult:
        """Return an already-classified tool error."""
        return ToolResult(
            content=[TextContent(type="text", text=original_text)],
            structured_content=payload,
            meta={"test_marker": "unchanged"},
            is_error=is_error,
        )

    async with Client(server) as client:
        result = await client.call_tool_mcp("domain_error", {})
    assert result.isError is is_error
    assert result.content == [TextContent(type="text", text=original_text)]
    assert result.meta == {"test_marker": "unchanged"}
    assert result.structuredContent == (payload if structured else None)


@pytest.mark.asyncio
@pytest.mark.parametrize("inner_handler", [False, True])
async def test_validation_details_are_bounded(inner_handler: bool) -> None:
    """Large invalid collections cannot produce unbounded diagnostics."""
    server = make_server(inner_handler=inner_handler, structured=False)
    async with Client(server) as client:
        result = await client.call_tool_mcp(
            "sensitive",
            {"request": {"filters": {str(index): "invalid" for index in range(100)}}},
        )
    text = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert result.isError is True
    assert text.count("Expected an integer") == 8
    assert "Additional validation errors omitted" in text
    assert len(text) < 1024


@pytest.mark.asyncio
@pytest.mark.parametrize("inner_handler", [False, True])
async def test_unstructured_validation_exception_fails_closed(
    inner_handler: bool,
) -> None:
    """Never parse arbitrary validation exception text for client diagnostics."""
    from fastmcp.exceptions import ValidationError as FastMCPValidationError

    server = make_server(inner_handler=inner_handler, structured=False)

    @server.tool
    def opaque_validation() -> str:
        """Simulate validation without a structured Pydantic cause."""
        raise FastMCPValidationError(
            "private-value https://backend.invalid SELECT data"
        )

    async with Client(server) as client:
        result = await client.call_tool_mcp("opaque_validation", {})
    assert result.isError is True
    assert result.content == [
        TextContent(
            type="text",
            text="Error: Validation error in opaque_validation: "
            "arguments: Invalid arguments; check the input schema",
        )
    ]


@pytest.mark.parametrize("definitions", ["$defs", "definitions"])
@pytest.mark.parametrize("composition", ["anyOf", "oneOf", "allOf"])
@pytest.mark.parametrize(
    ("location", "expected"),
    [
        (("request", "secret"), "request.secret"),
        (("request", "filters", "secret"), "request.filters.[field]"),
        (("request", "filters", 42, "secret"), "request.filters.[field].[field]"),
        (("request", "rows", 0, "secret"), "request.rows.0.secret"),
        (("request", "rows", "secret"), "request.rows.[field]"),
        (("request", "rows", -1, "secret"), "request.rows.[field].[field]"),
        (("request", "pair", 0, "secret"), "request.pair.0.secret"),
        (("request", "pair", 1, "secret"), "request.pair.1.[field]"),
        (("request", "pair", 2, "secret"), "request.pair.2.secret"),
        (("request", "variant", "secret"), "request.variant.secret"),
        (
            ("request", "variant", "unknown-tag", "secret"),
            "request.variant.[field].[field]",
        ),
        (("request", "broken", "secret"), "request.broken.[field]"),
        (("request", "external", "secret"), "request.external.[field]"),
        (("request", "cycle", "secret"), "request.cycle.[field]"),
        (("request", "s" * 64), "request." + "s" * 64),
        (("request", "s" * 65), "request.[field]"),
        (("request",) + ("child",) * 9, ".".join(["request"] + ["child"] * 7)),
        ((), "arguments"),
    ],
)
def test_validation_locations_follow_schema_paths(
    definitions: str,
    composition: str,
    location: tuple[str | int, ...],
    expected: str,
) -> None:
    """References and branches authorize fields only at their own positions."""
    from superset.mcp_service.utils.validation import _schema_location

    # The escaped definition name also exercises JSON Pointer resolution.
    leaf = {"$ref": f"#/{definitions}/Leaf~1~0"}
    request = {"$ref": f"#/{definitions}/Request"}
    schema = {
        "properties": {"request": request},
        definitions: {
            "Leaf/~": {"properties": {"secret": {"type": "integer"}}},
            "Cycle": {"$ref": f"#/{definitions}/Cycle"},
            "Request": {
                "properties": {
                    "secret": {"type": "string"},
                    "filters": {"type": "object", "additionalProperties": leaf},
                    "rows": {"type": "array", "items": leaf},
                    "pair": {"prefixItems": [leaf, {}], "items": leaf},
                    "variant": {composition: [{"type": "null"}, leaf]},
                    "broken": {"$ref": f"#/{definitions}/Missing"},
                    "external": {"$ref": "https://example.invalid/schema"},
                    "cycle": {"$ref": f"#/{definitions}/Cycle"},
                    "child": request,
                    "s" * 64: {},
                    "s" * 65: {},
                }
            },
        },
    }
    assert _schema_location(schema, location) == expected


@pytest.mark.parametrize("composition", ["anyOf", "oneOf", "allOf"])
@pytest.mark.parametrize(
    ("location", "expected"),
    [
        (("page_size",), True),
        (("s" * 64,), True),
        (("s" * 65,), False),
        (("top_level",), False),
        (("nested_only",), False),
        (("undeclared",), False),
        (("request", "page_size"), False),
        (("request", "filters", "page_size"), False),
        ((0,), False),
        ((), False),
    ],
)
def test_wrapper_hint_only_matches_direct_request_properties(
    composition: str, location: tuple[str | int, ...], expected: bool
) -> None:
    """Only misplaced direct request fields qualify, not arbitrary collisions."""
    from superset.mcp_service.utils.validation import _is_unwrapped_request_field

    schema = {
        "properties": {
            "top_level": {},
            "request": {composition: [{"$ref": "#/$defs/Request"}, {"type": "null"}]},
        },
        "$defs": {
            "Request": {
                "properties": {
                    "page_size": {"type": "integer"},
                    "top_level": {},
                    "s" * 64: {},
                    "s" * 65: {},
                    "filters": {"properties": {"nested_only": {}}},
                }
            },
        },
    }
    assert _is_unwrapped_request_field(schema, location) is expected
