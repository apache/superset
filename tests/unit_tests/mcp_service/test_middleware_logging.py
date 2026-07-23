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

"""
Unit tests for LoggingMiddleware on_call_tool() and on_message() methods.

Tests verify that:
- on_call_tool() captures duration_ms and success status
- on_call_tool() resolves call_tool proxy to actual tool name (mcp_tool)
- on_call_tool() captures error_type on failure
- on_message() logs non-tool messages without duration
- _extract_context_info() extracts entity IDs from params
"""

from functools import partial
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastmcp.exceptions import ToolError
from fastmcp.tools.tool import ToolResult
from mcp import types as mt
from sqlalchemy.exc import OperationalError

from superset.mcp_service.middleware import LoggingMiddleware


def _make_context(
    method: str = "tools/call",
    name: str = "list_charts",
    params: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
):
    """Create a mock MiddlewareContext."""
    ctx = MagicMock()
    ctx.method = method
    message = MagicMock()
    message.name = name
    message.params = params or {}
    ctx.message = message
    if metadata is not None:
        ctx.metadata = metadata
    else:
        ctx.metadata = None
    ctx.session = None
    return ctx


class TestLoggingMiddlewareOnCallTool:
    """Tests for LoggingMiddleware.on_call_tool()."""

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_duration_and_success(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool records duration_ms and success=True on normal return."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="tool_result")

        result = await middleware.on_call_tool(ctx, call_next)

        assert result == "tool_result"
        call_next.assert_awaited_once_with(ctx)

        # Verify event_logger.log was called with duration_ms and success
        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["action"] == "mcp_tool_call"
        assert call_kwargs["user_id"] == 42
        assert isinstance(call_kwargs["duration_ms"], int)
        assert call_kwargs["duration_ms"] >= 0
        assert call_kwargs["curated_payload"]["success"] is True
        assert call_kwargs["curated_payload"]["tool"] == "list_charts"

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_failure_on_exception(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool records success=False and error_type when tool raises."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError, match="boom"):
            await middleware.on_call_tool(ctx, call_next)

        # Verify event_logger.log was still called (in the finally block)
        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["curated_payload"]["success"] is False
        assert call_kwargs["curated_payload"]["error_type"] == "ValueError"
        assert call_kwargs["duration_ms"] >= 0

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_failure_on_tool_error(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool records success=False when GlobalErrorHandler raises ToolError.

        This simulates the real middleware chain: GlobalErrorHandler catches
        tool exceptions and re-raises them as ToolError. Since LoggingMiddleware
        sits between GlobalErrorHandler and StructuredContentStripper, it
        catches the ToolError directly.
        """
        middleware = LoggingMiddleware()
        ctx = _make_context(name="get_chart_info")
        call_next = AsyncMock(side_effect=ToolError("Chart 999999 not found"))

        with pytest.raises(ToolError, match="Chart 999999 not found"):
            await middleware.on_call_tool(ctx, call_next)

        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["curated_payload"]["success"] is False
        assert call_kwargs["curated_payload"]["tool"] == "get_chart_info"
        assert call_kwargs["duration_ms"] >= 0

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_includes_mcp_call_id_in_curated_payload(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool adds mcp_call_id to curated_payload."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="tool_result")

        await middleware.on_call_tool(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        mcp_call_id = call_kwargs["curated_payload"]["mcp_call_id"]
        assert isinstance(mcp_call_id, str)
        assert len(mcp_call_id) == 32

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_injects_mcp_call_id_into_tool_result_meta(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool injects mcp_call_id into ToolResult.meta."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        original_result = ToolResult(content=[mt.TextContent(type="text", text="ok")])
        call_next = AsyncMock(return_value=original_result)

        result = await middleware.on_call_tool(ctx, call_next)

        assert isinstance(result, ToolResult)
        assert "mcp_call_id" in result.meta
        assert len(result.meta["mcp_call_id"]) == 32

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_preserves_existing_meta(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool merges mcp_call_id with existing ToolResult.meta."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        original_result = ToolResult(
            content=[mt.TextContent(type="text", text="ok")],
            meta={"existing_key": "existing_value"},
        )
        call_next = AsyncMock(return_value=original_result)

        result = await middleware.on_call_tool(ctx, call_next)

        assert result.meta["existing_key"] == "existing_value"
        assert "mcp_call_id" in result.meta

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_extracts_entity_ids(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool extracts dashboard_id, chart_id, dataset_id from params."""
        middleware = LoggingMiddleware()
        ctx = _make_context(
            name="get_chart_info",
            params={
                "dashboard_id": 10,
                "chart_id": 20,
                "dataset_id": 30,
            },
        )
        call_next = AsyncMock(return_value="ok")

        await middleware.on_call_tool(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["dashboard_id"] == 10
        assert call_kwargs["slice_id"] == 20
        assert call_kwargs["curated_payload"]["dataset_id"] == 30


class TestLoggingMiddlewareOnMessage:
    """Tests for LoggingMiddleware.on_message()."""

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    @pytest.mark.asyncio
    async def test_on_message_logs_without_duration(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_message logs with action=mcp_message and duration_ms=None."""
        middleware = LoggingMiddleware()
        ctx = _make_context(method="resources/read", name="instance/metadata")
        call_next = AsyncMock(return_value="resource_data")

        result = await middleware.on_message(ctx, call_next)

        assert result == "resource_data"
        call_next.assert_awaited_once_with(ctx)

        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["action"] == "mcp_message"
        assert call_kwargs["duration_ms"] is None
        # on_message should NOT have success field
        assert "success" not in call_kwargs["curated_payload"]

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_no_error_type_on_success(
        self, mock_get_user_id: MagicMock, mock_event_logger: MagicMock
    ) -> None:
        """on_call_tool omits error_type from payload on success."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="ok")

        await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert "error_type" not in payload

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_resolves_call_tool_proxy(
        self, mock_get_user_id: MagicMock, mock_event_logger: MagicMock
    ) -> None:
        """call_tool proxy is resolved to the actual tool name via mcp_tool."""
        middleware = LoggingMiddleware()
        ctx = _make_context(
            name="call_tool",
            params={"name": "list_datasets", "arguments": {"page": 1}},
        )
        call_next = AsyncMock(return_value="datasets")

        await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["tool"] == "call_tool"
        assert payload["mcp_tool"] == "list_datasets"

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_no_mcp_tool_for_direct_calls(
        self, mock_get_user_id: MagicMock, mock_event_logger: MagicMock
    ) -> None:
        """Direct tool calls (not via proxy) omit mcp_tool from payload."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="charts")

        await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["tool"] == "list_charts"
        assert "mcp_tool" not in payload

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_proxy_failure_captures_both_fields(
        self, mock_get_user_id: MagicMock, mock_event_logger: MagicMock
    ) -> None:
        """call_tool proxy failure captures mcp_tool and error_type."""
        middleware = LoggingMiddleware()
        ctx = _make_context(
            name="call_tool",
            params={"name": "get_chart_data", "arguments": {"chart_id": 1}},
        )
        call_next = AsyncMock(side_effect=PermissionError("access denied"))

        with pytest.raises(PermissionError):
            await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["tool"] == "call_tool"
        assert payload["mcp_tool"] == "get_chart_data"
        assert payload["success"] is False
        assert payload["error_type"] == "PermissionError"


class TestResolveToolName:
    """Tests for LoggingMiddleware._resolve_tool_name()."""

    def test_resolves_call_tool_proxy(self) -> None:
        """Returns the real tool name when call_tool proxy is used."""
        assert (
            LoggingMiddleware._resolve_tool_name(
                "call_tool", {"name": "list_datasets", "arguments": {}}
            )
            == "list_datasets"
        )

    def test_returns_none_for_direct_tool(self) -> None:
        """Returns None for direct tool calls (not via proxy)."""
        assert LoggingMiddleware._resolve_tool_name("list_charts", {"page": 1}) is None

    def test_returns_none_when_name_missing(self) -> None:
        """Returns None when call_tool params lack 'name'."""
        assert LoggingMiddleware._resolve_tool_name("call_tool", {"foo": "bar"}) is None

    def test_returns_none_for_empty_name(self) -> None:
        """Returns None when call_tool params have empty 'name'."""
        assert LoggingMiddleware._resolve_tool_name("call_tool", {"name": ""}) is None

    def test_returns_none_for_non_string_name(self) -> None:
        """Returns None when call_tool name param is not a string."""
        assert LoggingMiddleware._resolve_tool_name("call_tool", {"name": 123}) is None

    def test_returns_none_for_search_tools(self) -> None:
        """search_tools proxy is not resolved (no underlying tool name)."""
        assert (
            LoggingMiddleware._resolve_tool_name("search_tools", {"query": "datasets"})
            is None
        )


class TestExtractContextInfo:
    """Tests for LoggingMiddleware._extract_context_info()."""

    @patch("superset.mcp_service.middleware.get_user_id", return_value=99)
    def test_extract_with_metadata_agent_id(self, mock_get_user_id) -> None:
        """Extracts agent_id from context.metadata."""
        middleware = LoggingMiddleware()
        ctx = _make_context(metadata={"agent_id": "agent-123"})

        agent_id, user_id, dashboard_id, slice_id, dataset_id, params = (
            middleware._extract_context_info(ctx)
        )

        assert agent_id == "agent-123"
        assert user_id == 99

    @patch(
        "superset.mcp_service.middleware.get_user_id",
        side_effect=RuntimeError("no Flask request context"),
    )
    def test_extract_handles_missing_user(self, mock_get_user_id) -> None:
        """Gracefully handles missing user context."""
        middleware = LoggingMiddleware()
        ctx = _make_context()

        agent_id, user_id, dashboard_id, slice_id, dataset_id, params = (
            middleware._extract_context_info(ctx)
        )

        assert user_id is None

    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    def test_extract_slice_id_from_chart_id(self, mock_get_user_id) -> None:
        """Extracts slice_id from chart_id param (alias)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(params={"chart_id": 55})

        _, _, _, slice_id, _, _ = middleware._extract_context_info(ctx)

        assert slice_id == 55

    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    def test_extract_slice_id_from_slice_id(self, mock_get_user_id) -> None:
        """Extracts slice_id from slice_id param (fallback)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(params={"slice_id": 66})

        _, _, _, slice_id, _, _ = middleware._extract_context_info(ctx)

        assert slice_id == 66


class TestIsErrorResponse:
    """Tests for LoggingMiddleware._is_error_response()."""

    def test_detects_error_schema_response(self) -> None:
        """Detects ToolResult containing a serialized error schema
        (ChartError, DashboardError, etc.) via "error_type" field."""
        middleware = LoggingMiddleware()
        error_json = (
            '{"error": "Chart 999 not found",'
            ' "error_type": "not_found",'
            ' "timestamp": "2026-04-09T00:00:00Z"}'
        )
        result = ToolResult(content=[mt.TextContent(type="text", text=error_json)])
        assert middleware._is_error_response(result) is True

    def test_success_response_not_detected_as_error(self) -> None:
        """Normal ToolResult is not detected as error."""
        middleware = LoggingMiddleware()
        result = ToolResult(
            content=[mt.TextContent(type="text", text="Successfully retrieved data")]
        )
        assert middleware._is_error_response(result) is False

    def test_empty_content_not_detected_as_error(self) -> None:
        """ToolResult with empty content is not detected as error."""
        middleware = LoggingMiddleware()
        assert middleware._is_error_response(ToolResult(content=[])) is False

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_failure_for_error_schema(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """on_call_tool logs success=False when tool returns an
        error schema (e.g. ChartError)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="get_chart_info")

        error_json = (
            '{"error": "Chart 999999 not found",'
            ' "error_type": "not_found",'
            ' "timestamp": "2026-04-09T00:00:00Z"}'
        )
        error_result = ToolResult(
            content=[mt.TextContent(type="text", text=error_json)]
        )
        call_next = AsyncMock(return_value=error_result)

        result = await middleware.on_call_tool(ctx, call_next)

        assert isinstance(result, ToolResult)
        assert result.content == error_result.content
        assert "mcp_call_id" in result.meta
        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["curated_payload"]["success"] is False
        assert call_kwargs["curated_payload"]["tool"] == "get_chart_info"


class TestMiddlewareChainOrder:
    """Test that the middleware order from server.py logs failures correctly.

    If the order is wrong (StructuredContentStripper innermost),
    it swallows exceptions before LoggingMiddleware can see them,
    causing success=True for failures.
    """

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_real_middleware_chain_logs_exception_as_failure(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """Tool exception is logged as success=False through the
        real middleware chain from build_middleware_list()."""
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def failing_tool(context: Any) -> Any:
            raise ValueError("chart not found")

        # Build chain same way FastMCP does
        chain = failing_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="get_chart_info")
        result = await chain(ctx)

        # StructuredContentStripper (outermost) must catch the re-raised
        # exception and convert it to a safe ToolResult with "Error:" text.
        # If it's not outermost, the exception would leak to the MCP SDK.
        assert isinstance(result, ToolResult)
        assert result.content[0].text.startswith("Error:")

        # LoggingMiddleware must log
        # success=False. If the middleware order is wrong
        # (StructuredContentStripper innermost), this would be
        # success=True because the exception gets swallowed
        # before LoggingMiddleware sees it.
        log_calls = [
            c
            for c in mock_event_logger.log.call_args_list
            if c[1].get("action") == "mcp_tool_call"
        ]
        assert len(log_calls) == 1
        assert log_calls[0][1]["curated_payload"]["success"] is False, (
            "Middleware order is wrong: StructuredContentStripper is "
            "swallowing exceptions before LoggingMiddleware can detect "
            "them. Ensure StructuredContentStripper is outermost "
            "(first added) in build_middleware_list()."
        )

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_real_middleware_chain_error_result_has_mcp_call_id(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """When a tool raises, the error ToolResult from
        StructuredContentStripper still carries mcp_call_id in meta."""
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def failing_tool(context: Any) -> Any:
            raise ValueError("chart not found")

        chain = failing_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="get_chart_info")
        result = await chain(ctx)

        assert isinstance(result, ToolResult)
        assert result.content[0].text.startswith("Error:")
        assert result.meta is not None
        assert "mcp_call_id" in result.meta
        assert len(result.meta["mcp_call_id"]) == 32

    @pytest.mark.asyncio
    async def test_list_tools_exception_returns_empty_list(self):
        """Exception during tools/list returns [] instead of causing encoding error.

        ToolError raised by GlobalErrorHandlerMiddleware cannot be encoded
        by the MCP SDK in a tools/list response, producing "encoding without
        a string argument". StructuredContentStripperMiddleware.on_list_tools
        must catch it and return an empty list.
        """
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def failing_list_tools(context: Any) -> Any:
            raise ValueError("auth failed")

        chain = failing_list_tools
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(method="tools/list", name="")
        result = await chain(ctx)

        assert result == [], (
            "on_list_tools must return [] on exception — "
            "ToolError cannot be encoded in a tools/list response."
        )


class TestExtractErrorTypeFromResponse:
    """Tests for LoggingMiddleware._extract_error_type_from_response()."""

    def test_extracts_error_type(self) -> None:
        """Parses the error_type field out of a structured error response
        instead of just sniffing for its presence."""
        result = ToolResult(
            content=[
                mt.TextContent(
                    type="text",
                    text='{"error": "Chart 999 not found", "error_type": "not_found"}',
                )
            ]
        )
        assert (
            LoggingMiddleware._extract_error_type_from_response(result) == "not_found"
        )

    def test_returns_none_for_non_dict_payload(self) -> None:
        result = ToolResult(content=[mt.TextContent(type="text", text="[1, 2, 3]")])
        assert LoggingMiddleware._extract_error_type_from_response(result) is None

    def test_returns_none_for_invalid_json(self) -> None:
        result = ToolResult(content=[mt.TextContent(type="text", text="not json")])
        assert LoggingMiddleware._extract_error_type_from_response(result) is None

    def test_returns_none_for_missing_error_type(self) -> None:
        result = ToolResult(content=[mt.TextContent(type="text", text='{"ok": true}')])
        assert LoggingMiddleware._extract_error_type_from_response(result) is None

    def test_returns_none_for_non_string_error_type(self) -> None:
        result = ToolResult(
            content=[mt.TextContent(type="text", text='{"error_type": 404}')]
        )
        assert LoggingMiddleware._extract_error_type_from_response(result) is None

    def test_returns_none_for_empty_content(self) -> None:
        assert (
            LoggingMiddleware._extract_error_type_from_response(ToolResult(content=[]))
            is None
        )


class TestOnCallToolErrorTypeExtraction:
    """Tests that on_call_tool surfaces the parsed error_type from
    structured error responses (ChartError, DashboardError, etc.), rather
    than discarding it after the substring sniff."""

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_logs_error_type_from_structured_response(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        middleware = LoggingMiddleware()
        ctx = _make_context(name="get_chart_info")

        error_json = (
            '{"error": "Chart 999999 not found",'
            ' "error_type": "not_found",'
            ' "timestamp": "2026-04-09T00:00:00Z"}'
        )
        error_result = ToolResult(
            content=[mt.TextContent(type="text", text=error_json)]
        )
        call_next = AsyncMock(return_value=error_result)

        await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["error_type"] == "not_found"

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_exception_error_type_takes_precedence(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """When call_next raises, error_type comes from the exception class
        (there is no structured response to parse)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError, match="boom"):
            await middleware.on_call_tool(ctx, call_next)

        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["error_type"] == "ValueError"


class TestOnCallToolStatsMetrics:
    """Tests that on_call_tool emits per-tool StatsD counters and timing,
    mirroring the success/warning/error split in base_api.py. This is the
    single emission point — GlobalErrorHandlerMiddleware must not emit."""

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_emits_success_counter_and_timing(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="ok")

        await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with("mcp.tool.list_charts.success")
        mock_stats.instance.timing.assert_called_once()
        timing_key, timing_value = mock_stats.instance.timing.call_args[0]
        assert timing_key == "mcp.tool.list_charts.time"
        assert isinstance(timing_value, int)
        assert timing_value >= 0

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_emits_warning_counter_for_raised_user_error(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """A raised user-class error (ValueError) counts as warning,
        matching base_api.py's 4xx handling."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError, match="boom"):
            await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with("mcp.tool.execute_sql.warning")

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_emits_error_counter_for_raised_system_error(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """A raised system-class error (RuntimeError) counts as error."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=RuntimeError("db down"))

        with pytest.raises(RuntimeError, match="db down"):
            await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with("mcp.tool.execute_sql.error")

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_unwraps_tool_error_cause_for_classification(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """A ToolError wrapping a system error (as raised by
        GlobalErrorHandlerMiddleware via ``raise ... from error``) must be
        classified by its __cause__, not by the ToolError wrapper."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        wrapped = ToolError("Database error in execute_sql")
        wrapped.__cause__ = OperationalError("db error", {}, Exception())
        call_next = AsyncMock(side_effect=wrapped)

        with pytest.raises(ToolError):
            await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with("mcp.tool.execute_sql.error")
        payload = mock_event_logger.log.call_args[1]["curated_payload"]
        assert payload["error_type"] == "OperationalError"

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_emits_error_counter_for_structured_error_response(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """A tool that returns an error schema (rather than raising) must
        still increment the error counter, not the success counter."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="get_chart_info")
        error_result = ToolResult(
            content=[
                mt.TextContent(
                    type="text",
                    text='{"error": "not found", "error_type": "not_found"}',
                )
            ]
        )
        call_next = AsyncMock(return_value=error_result)

        await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with(
            "mcp.tool.get_chart_info.error"
        )

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_metric_uses_resolved_tool_name_for_call_tool_proxy(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """When invoked via the call_tool search proxy, the metric key
        must use the real tool name, not the literal 'call_tool'."""
        middleware = LoggingMiddleware()
        ctx = _make_context(
            name="call_tool",
            params={"name": "list_datasets", "arguments": {}},
        )
        call_next = AsyncMock(return_value="ok")

        await middleware.on_call_tool(ctx, call_next)

        mock_stats.instance.incr.assert_called_once_with(
            "mcp.tool.list_datasets.success"
        )

    @patch("superset.mcp_service.middleware.logger")
    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_metrics_failure_does_not_mask_tool_result(
        self, mock_get_user_id, mock_event_logger, mock_stats, mock_logger
    ) -> None:
        """A failing stats backend must not turn a successful tool call
        into an error — metrics are a side effect only. The swallowed
        error must still be logged, not silently dropped."""
        mock_stats.instance.incr.side_effect = RuntimeError("metrics backend down")
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="ok")

        result = await middleware.on_call_tool(ctx, call_next)

        assert result == "ok"
        warning_messages = [c.args[0] for c in mock_logger.warning.call_args_list]
        assert any("Failed to emit MCP tool metrics" in m for m in warning_messages)

    @patch("superset.mcp_service.middleware.logger")
    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_metrics_failure_does_not_mask_tool_exception(
        self, mock_get_user_id, mock_event_logger, mock_stats, mock_logger
    ) -> None:
        """A failing stats backend must not replace the tool's real
        exception with its own error in the finally block."""
        mock_stats.instance.incr.side_effect = RuntimeError("metrics backend down")
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError, match="boom"):
            await middleware.on_call_tool(ctx, call_next)

        warning_messages = [c.args[0] for c in mock_logger.warning.call_args_list]
        assert any("Failed to emit MCP tool metrics" in m for m in warning_messages)


class TestResolveMetricToolName:
    """Tests for the StatsD metric-key validation in
    _resolve_metric_tool_name — client-controlled tool names must never
    reach a metric key unvalidated."""

    @pytest.mark.asyncio
    async def test_registered_tool_name_is_used(self) -> None:
        """A name that resolves in the FastMCP tool registry is used."""
        ctx = _make_context()
        ctx.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=MagicMock())

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "call_tool", "list_datasets"
        )

        assert result == "list_datasets"
        ctx.fastmcp_context.fastmcp.get_tool.assert_awaited_once_with("list_datasets")

    @pytest.mark.asyncio
    async def test_unregistered_proxy_name_falls_back_to_call_tool(self) -> None:
        """A bogus call_tool proxy name must not mint a new metric series."""
        ctx = _make_context()
        ctx.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=None)

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "call_tool", "totally_fake_tool_9000"
        )

        assert result == "call_tool"

    @pytest.mark.asyncio
    async def test_unregistered_direct_name_falls_back_to_unknown(self) -> None:
        """A bogus direct tool name must not mint a new metric series."""
        ctx = _make_context()
        ctx.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=None)

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "totally_fake_tool_9000", None
        )

        assert result == "unknown"

    @pytest.mark.asyncio
    async def test_registry_raise_treated_as_unregistered(self) -> None:
        """get_tool raising (NotFoundError-style) means unregistered."""
        ctx = _make_context()
        ctx.fastmcp_context.fastmcp.get_tool = AsyncMock(
            side_effect=KeyError("not found")
        )

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "call_tool", "totally_fake_tool_9000"
        )

        assert result == "call_tool"

    @pytest.mark.asyncio
    async def test_injection_shaped_name_rejected_without_registry(self) -> None:
        """With no registry reachable (mocked context), StatsD metadata
        characters must still never reach the metric key."""
        ctx = _make_context()  # plain MagicMock — get_tool is not awaitable

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "call_tool", "evil\nfake.metric:1|c"
        )

        assert result == "call_tool"

    @pytest.mark.asyncio
    async def test_injection_shaped_name_rejected_via_registry(self) -> None:
        """The production path: a reachable registry that does not know
        the hostile name must fall back to the constant — the metadata
        characters never reach the metric key."""
        ctx = _make_context()
        ctx.fastmcp_context.fastmcp.get_tool = AsyncMock(return_value=None)

        result = await LoggingMiddleware._resolve_metric_tool_name(
            ctx, "call_tool", "evil\nfake.metric:1|c"
        )

        assert result == "call_tool"

    @pytest.mark.asyncio
    async def test_overlong_name_rejected_without_registry(self) -> None:
        ctx = _make_context()

        result = await LoggingMiddleware._resolve_metric_tool_name(ctx, "x" * 500, None)

        assert result == "unknown"

    @pytest.mark.asyncio
    async def test_missing_name_returns_unknown(self) -> None:
        ctx = _make_context()

        assert (
            await LoggingMiddleware._resolve_metric_tool_name(ctx, None, None)
            == "unknown"
        )


class TestChainLevelStatsMetrics:
    """Drive failures through the REAL middleware chain from
    build_middleware_list() and assert the exact set of stats calls —
    pins that per-tool outcome counters are emitted exactly once per call
    (no double-counting between LoggingMiddleware and
    GlobalErrorHandlerMiddleware)."""

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_raised_user_error_counts_warning_exactly_once(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def failing_tool(context: Any) -> Any:
            raise ValueError("chart not found")

        chain = failing_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="get_chart_info")
        result = await chain(ctx)

        # Stripper (outermost) converts the ToolError to a safe ToolResult
        assert isinstance(result, ToolResult)
        assert result.content[0].text.startswith("Error:")

        # Exactly ONE outcome counter for the whole chain: ValueError is a
        # user error, classified via the ToolError __cause__ unwrap.
        incr_keys = [c.args[0] for c in mock_stats.instance.incr.call_args_list]
        assert incr_keys == ["mcp.tool.get_chart_info.warning"]
        timing_keys = [c.args[0] for c in mock_stats.instance.timing.call_args_list]
        assert timing_keys == ["mcp.tool.get_chart_info.time"]

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_raised_system_error_counts_error_exactly_once(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def failing_tool(context: Any) -> Any:
            raise RuntimeError("infrastructure down")

        chain = failing_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="execute_sql")
        result = await chain(ctx)

        assert isinstance(result, ToolResult)
        assert result.content[0].text.startswith("Error:")

        incr_keys = [c.args[0] for c in mock_stats.instance.incr.call_args_list]
        assert incr_keys == ["mcp.tool.execute_sql.error"]

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_success_counts_success_exactly_once(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def ok_tool(context: Any) -> Any:
            return ToolResult(content=[mt.TextContent(type="text", text="ok")])

        chain = ok_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="list_charts")
        await chain(ctx)

        incr_keys = [c.args[0] for c in mock_stats.instance.incr.call_args_list]
        assert incr_keys == ["mcp.tool.list_charts.success"]

    @patch("superset.mcp_service.middleware.stats_logger_manager")
    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_structured_error_response_counts_error_exactly_once(
        self, mock_get_user_id, mock_event_logger, mock_stats
    ) -> None:
        """A tool that returns an error schema (no raise) counts one
        .error through the real chain — not .success, not doubled."""
        from superset.mcp_service.server import build_middleware_list

        middleware_list = build_middleware_list()

        async def error_returning_tool(context: Any) -> Any:
            return ToolResult(
                content=[
                    mt.TextContent(
                        type="text",
                        text='{"error": "not found", "error_type": "not_found"}',
                    )
                ]
            )

        chain = error_returning_tool
        for mw in reversed(middleware_list):
            chain = partial(mw, call_next=chain)

        ctx = _make_context(name="get_chart_info")
        await chain(ctx)

        incr_keys = [c.args[0] for c in mock_stats.instance.incr.call_args_list]
        assert incr_keys == ["mcp.tool.get_chart_info.error"]


class TestAppContextFixForAuditRows:
    """Regression tests for the has_app_context() skip bug: the DB audit
    row (event_logger.log) must never be silently dropped just because
    the per-tool app context has already exited by the time the
    middleware finally block runs. Both on_call_tool and on_message must
    wrap the log call in _get_app_context_manager() rather than
    conditionally skipping it."""

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @patch("superset.mcp_service.middleware._get_app_context_manager")
    @pytest.mark.asyncio
    async def test_on_call_tool_uses_app_context_manager(
        self, mock_get_app_context_manager, mock_get_user_id, mock_event_logger
    ) -> None:
        from contextlib import nullcontext

        mock_get_app_context_manager.return_value = nullcontext()
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="ok")

        await middleware.on_call_tool(ctx, call_next)

        mock_get_app_context_manager.assert_called_once()
        mock_event_logger.log.assert_called_once()

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @patch("superset.mcp_service.middleware._get_app_context_manager")
    @pytest.mark.asyncio
    async def test_on_message_uses_app_context_manager(
        self, mock_get_app_context_manager, mock_get_user_id, mock_event_logger
    ) -> None:
        from contextlib import nullcontext

        mock_get_app_context_manager.return_value = nullcontext()
        middleware = LoggingMiddleware()
        ctx = _make_context(method="resources/read", name="instance/metadata")
        call_next = AsyncMock(return_value="resource_data")

        await middleware.on_message(ctx, call_next)

        mock_get_app_context_manager.assert_called_once()
        mock_event_logger.log.assert_called_once()
