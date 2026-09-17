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

"""Per-failure-class error classification for MCP tool calls.

Three unrelated failures used to reach MCP clients as one undifferentiated
message, because FastMCP re-raises everything a tool body throws as
``ToolError(f"Error calling tool {name!r}: {e}") from e`` *before* any
middleware error hook runs. ``GlobalErrorHandlerMiddleware`` then matched its
first branch, ``isinstance(error, ToolError)``, and re-raised — so its entire
per-type branch chain was unreachable for tool failures, and the client got
whatever ``str(exc)`` happened to say.

The rest of the suite exercises that chain by injecting *raw* exceptions into
``on_message``, which is why the gap went unnoticed: no test drove a tool
exception through FastMCP's wrapping first. These tests do, end to end.
"""

from typing import Any

import pytest
from fastmcp import FastMCP
from fastmcp.client import Client
from fastmcp.exceptions import ToolError

from superset.commands.exceptions import ForbiddenError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetException,
    SupersetSecurityException,
)
from superset.mcp_service.auth import MCPPermissionDeniedError
from superset.mcp_service.middleware import (
    _datasource_error_reason,
    _is_datasource_error,
    _unwrap_tool_error,
    GlobalErrorHandlerMiddleware,
    ToolResultCompatibilityMiddleware,
)

# A connection string and an internal path, planted in the exception messages
# below to prove neither reaches the caller.
LEAKED_DSN = "postgresql://admin:hunter2@db.internal/prod"
LEAKED_PATH = "/srv/app/superset/mcp_service/chart/tool/get_chart_data.py"


def _dead_table_error() -> SupersetErrorException:
    """The upstream failure a chart over a dropped table produces."""
    return SupersetErrorException(
        SupersetError(
            message=f'relation "orders" does not exist ({LEAKED_DSN})',
            error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


def _build_server() -> FastMCP:
    """A FastMCP server with one tool per failure class.

    ``LoggingMiddleware`` is deliberately omitted: it needs a Flask app
    context, and it does not participate in classifying the response.
    """
    mcp: FastMCP = FastMCP("error-classification")

    @mcp.tool
    def rbac_denied(unused: int = 1) -> str:
        """RBAC denial raised by the @tool permission decorator."""
        raise MCPPermissionDeniedError(
            permission_name="can_get",
            view_name="User",
            tool_name="rbac_denied",
        )

    @mcp.tool
    def forbidden(unused: int = 1) -> str:
        """Authorization refused below the MCP layer."""
        raise ForbiddenError()

    @mcp.tool
    def dead_table(unused: int = 1) -> str:
        """Well-formed call whose datasource is gone."""
        raise _dead_table_error()

    @mcp.tool
    def needs_id(id: int) -> str:  # noqa: A002
        """Schema mismatch: callers guess ``identifier`` for ``id``."""
        return "ok"

    @mcp.tool
    def internal_bug(unused: int = 1) -> str:
        """A genuine server-side defect."""
        raise RuntimeError(f"unexpected failure in {LEAKED_PATH}")

    mcp.add_middleware(
        ToolResultCompatibilityMiddleware(structured_output_enabled=False)
    )
    mcp.add_middleware(GlobalErrorHandlerMiddleware())
    return mcp


async def _call(tool: str, arguments: dict[str, Any] | None = None) -> str:
    """Return the client-facing text for a failing tool call."""
    async with Client(_build_server()) as client:
        result = await client.call_tool(tool, arguments or {}, raise_on_error=False)
    assert result.is_error, f"{tool} was expected to fail"
    return result.content[0].text


class TestFastMCPWrappingPrecondition:
    """Guard the assumption the classification fix is built on."""

    @pytest.mark.asyncio
    async def test_tool_exceptions_arrive_wrapped_in_tool_error(self) -> None:
        """FastMCP wraps tool exceptions before middleware sees them.

        If a FastMCP upgrade stops doing this, ``_unwrap_tool_error`` becomes
        a no-op and the branch chain keeps working — but this test failing is
        the signal that the comments explaining *why* it exists are stale.
        """
        seen: list[Exception] = []

        mcp: FastMCP = FastMCP("precondition")

        @mcp.tool
        def boom(unused: int = 1) -> str:
            raise PermissionError("denied")

        class Capture(ToolResultCompatibilityMiddleware):
            async def on_call_tool(self, context: Any, call_next: Any) -> Any:
                try:
                    return await call_next(context)
                except Exception as exc:  # noqa: BLE001
                    seen.append(exc)
                    raise

        mcp.add_middleware(Capture(structured_output_enabled=False))

        async with Client(mcp) as client:
            await client.call_tool("boom", {}, raise_on_error=False)

        assert len(seen) == 1
        assert isinstance(seen[0], ToolError)
        assert isinstance(seen[0].__cause__, PermissionError)


class TestUnwrapToolError:
    """``_unwrap_tool_error`` must recover the cause without eating
    deliberately raised ToolErrors."""

    def test_returns_cause_of_wrapped_error(self) -> None:
        cause = MCPPermissionDeniedError(permission_name="can_read", view_name="Chart")
        wrapped = ToolError("Error calling tool 'list_charts': denied")
        wrapped.__cause__ = cause

        assert _unwrap_tool_error(wrapped) is cause

    def test_passes_through_deliberate_tool_error(self) -> None:
        """A ToolError raised by tool code has no cause and is already
        formatted for MCP, so it must survive untouched."""
        deliberate = ToolError("'search_tools' cannot be called via the proxy")

        assert _unwrap_tool_error(deliberate) is deliberate

    def test_passes_through_unwrapped_exception(self) -> None:
        error = ValueError("page must be positive")

        assert _unwrap_tool_error(error) is error


class TestDatasourceErrorClassification:
    """Only genuine query/datasource failures take the datasource branch."""

    def test_classifies_missing_table(self) -> None:
        assert _is_datasource_error(_dead_table_error()) is True

    def test_reason_is_the_enumerated_error_type(self) -> None:
        assert (
            _datasource_error_reason(_dead_table_error())
            == SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR.value
        )

    def test_security_exception_is_not_a_datasource_error(self) -> None:
        """SupersetSecurityException subclasses SupersetErrorException, so the
        permission branch must win — a denied table is not a broken table."""
        error = SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        assert _is_datasource_error(error) is False

    def test_unrelated_superset_exception_is_not_a_datasource_error(self) -> None:
        assert _is_datasource_error(SupersetException("something else")) is False

    def test_reason_is_none_for_unlisted_error_type(self) -> None:
        error = SupersetErrorException(
            SupersetError(
                message="nope",
                error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

        assert _datasource_error_reason(error) is None


class TestPerClassClientFacingErrors:
    """Each failure class reaches the caller as its own honest message."""

    @pytest.mark.asyncio
    async def test_rbac_denial_uses_permission_denied_shape(self) -> None:
        """An RBAC denial names the permission and the resource, and never
        tells the caller to go re-read the tool schema."""
        message = await _call("rbac_denied")

        assert "Permission denied: can_get on User" in message
        assert "Validation error" not in message
        assert "inputSchema" not in message
        assert "Internal error" not in message

    @pytest.mark.asyncio
    async def test_non_rbac_authorization_failure_also_says_permission_denied(
        self,
    ) -> None:
        """Denials raised below the MCP RBAC decorator get the same shape, so
        a caller can recognise a denial regardless of which layer refused."""
        message = await _call("forbidden")

        assert "Permission denied" in message

    @pytest.mark.asyncio
    async def test_schema_mismatch_keeps_validation_guidance(self) -> None:
        """Wrong argument names still get the advice that actually fits:
        the offending fields, so the caller can match the inputSchema."""
        message = await _call("needs_id", {"identifier": 5})

        assert "Validation error in needs_id" in message
        assert "id" in message
        assert "identifier" in message
        assert "Permission denied" not in message

    @pytest.mark.asyncio
    async def test_datasource_failure_blames_the_query_not_the_caller(self) -> None:
        """A dropped table says the datasource failed and states the call was
        valid — the previous message implied a bad tool name or arguments."""
        message = await _call("dead_table")

        assert "Datasource error in dead_table" in message
        assert SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR.value in message
        assert "arguments were valid" in message
        assert "Permission denied" not in message
        assert "Validation error" not in message

    @pytest.mark.asyncio
    async def test_internal_error_is_opaque_and_carries_an_error_id(self) -> None:
        message = await _call("internal_bug")

        assert "Internal error in internal_bug" in message
        assert "Error ID:" in message

    @pytest.mark.asyncio
    async def test_the_four_classes_do_not_share_a_message(self) -> None:
        """The regression in one assertion: conflating these is the bug."""
        messages = [
            await _call("rbac_denied"),
            await _call("needs_id", {"identifier": 5}),
            await _call("dead_table"),
            await _call("internal_bug"),
        ]

        assert len(set(messages)) == len(messages)


class TestNoNewDisclosure:
    """Classification must not widen what a failure discloses."""

    @pytest.mark.asyncio
    async def test_datasource_error_does_not_echo_raw_driver_output(self) -> None:
        """Only the enumerated SupersetErrorType is surfaced; the driver
        message (which carried a DSN) is not."""
        message = await _call("dead_table")

        assert LEAKED_DSN not in message
        assert "hunter2" not in message
        assert "db.internal" not in message
        assert "orders" not in message

    @pytest.mark.asyncio
    async def test_internal_error_does_not_echo_server_paths(self) -> None:
        message = await _call("internal_bug")

        assert LEAKED_PATH not in message
        assert "mcp_service" not in message
