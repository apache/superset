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
    def list_datasets(request: ListDatasetsRequest) -> str:
        """Accept a wrapped list request."""
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
    ("arguments", "location", "reason"),
    [
        ({"request": {"page_size": "lots"}}, "request.page_size", "integer"),
        ({"page_size": 2}, "request", "required"),
    ],
    ids=["wrong-type", "missing-wrapper"],
)
async def test_validation_wire_contract(
    arguments: dict[str, Any],
    location: str,
    reason: str,
    inner_handler: bool,
    structured: bool,
) -> None:
    """Failures carry both the MCP error flag and actionable safe detail."""
    server = make_server(inner_handler=inner_handler, structured=structured)
    async with Client(server) as client:
        result = await client.call_tool_mcp("list_datasets", arguments)

    assert result.isError is True
    text = " ".join(
        block.text for block in result.content if isinstance(block, TextContent)
    )
    assert location in text
    assert reason in text.lower()
    assert "lots" not in text
    assert "input_value" not in text
    assert "input_type" not in text
    assert "errors.pydantic.dev" not in text


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
