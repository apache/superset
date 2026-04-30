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
- on_message() logs non-tool messages without duration
- _extract_context_info() extracts entity IDs from params
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
    ):
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
    ):
        """on_call_tool records success=False when tool raises."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError, match="boom"):
            await middleware.on_call_tool(ctx, call_next)

        # Verify event_logger.log was still called (in the finally block)
        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["curated_payload"]["success"] is False
        assert call_kwargs["duration_ms"] >= 0

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_failure_on_tool_error(
        self, mock_get_user_id, mock_event_logger
    ):
        """on_call_tool records success=False when GlobalErrorHandler raises ToolError.

        This simulates the real middleware chain: GlobalErrorHandler catches
        tool exceptions and re-raises them as ToolError. Since LoggingMiddleware
        sits between GlobalErrorHandler and StructuredContentStripper, it
        catches the ToolError directly.
        """
        from fastmcp.exceptions import ToolError

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
    ):
        """on_call_tool adds mcp_call_id to curated_payload."""
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="tool_result")

        await middleware.on_call_tool(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        mcp_call_id = call_kwargs["curated_payload"]["mcp_call_id"]
        assert isinstance(mcp_call_id, str)
        assert len(mcp_call_id) == 12

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_injects_mcp_call_id_into_tool_result_meta(
        self, mock_get_user_id, mock_event_logger
    ):
        """on_call_tool injects mcp_call_id into ToolResult.meta."""
        from fastmcp.tools.tool import ToolResult
        from mcp import types as mt

        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        original_result = ToolResult(content=[mt.TextContent(type="text", text="ok")])
        call_next = AsyncMock(return_value=original_result)

        result = await middleware.on_call_tool(ctx, call_next)

        assert isinstance(result, ToolResult)
        assert "mcp_call_id" in result.meta
        assert len(result.meta["mcp_call_id"]) == 12

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_preserves_existing_meta(
        self, mock_get_user_id, mock_event_logger
    ):
        """on_call_tool merges mcp_call_id with existing ToolResult.meta."""
        from fastmcp.tools.tool import ToolResult
        from mcp import types as mt

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
    ):
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
    ):
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


class TestExtractContextInfo:
    """Tests for LoggingMiddleware._extract_context_info()."""

    @patch("superset.mcp_service.middleware.get_user_id", return_value=99)
    def test_extract_with_metadata_agent_id(self, mock_get_user_id):
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
    def test_extract_handles_missing_user(self, mock_get_user_id):
        """Gracefully handles missing user context."""
        middleware = LoggingMiddleware()
        ctx = _make_context()

        agent_id, user_id, dashboard_id, slice_id, dataset_id, params = (
            middleware._extract_context_info(ctx)
        )

        assert user_id is None

    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    def test_extract_slice_id_from_chart_id(self, mock_get_user_id):
        """Extracts slice_id from chart_id param (alias)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(params={"chart_id": 55})

        _, _, _, slice_id, _, _ = middleware._extract_context_info(ctx)

        assert slice_id == 55

    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    def test_extract_slice_id_from_slice_id(self, mock_get_user_id):
        """Extracts slice_id from slice_id param (fallback)."""
        middleware = LoggingMiddleware()
        ctx = _make_context(params={"slice_id": 66})

        _, _, _, slice_id, _, _ = middleware._extract_context_info(ctx)

        assert slice_id == 66


class TestIsErrorResponse:
    """Tests for LoggingMiddleware._is_error_response()."""

    def test_detects_error_schema_response(self):
        """Detects ToolResult containing a serialized error schema
        (ChartError, DashboardError, etc.) via "error_type" field."""
        from fastmcp.tools.tool import ToolResult
        from mcp import types as mt

        middleware = LoggingMiddleware()
        error_json = (
            '{"error": "Chart 999 not found",'
            ' "error_type": "not_found",'
            ' "timestamp": "2026-04-09T00:00:00Z"}'
        )
        result = ToolResult(content=[mt.TextContent(type="text", text=error_json)])
        assert middleware._is_error_response(result) is True

    def test_success_response_not_detected_as_error(self):
        """Normal ToolResult is not detected as error."""
        from fastmcp.tools.tool import ToolResult
        from mcp import types as mt

        middleware = LoggingMiddleware()
        result = ToolResult(
            content=[mt.TextContent(type="text", text="Successfully retrieved data")]
        )
        assert middleware._is_error_response(result) is False

    def test_empty_content_not_detected_as_error(self):
        """ToolResult with empty content is not detected as error."""
        from fastmcp.tools.tool import ToolResult

        middleware = LoggingMiddleware()
        assert middleware._is_error_response(ToolResult(content=[])) is False

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=42)
    @pytest.mark.asyncio
    async def test_on_call_tool_logs_failure_for_error_schema(
        self, mock_get_user_id, mock_event_logger
    ):
        """on_call_tool logs success=False when tool returns an
        error schema (e.g. ChartError)."""
        from fastmcp.tools.tool import ToolResult
        from mcp import types as mt

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
    ):
        """Tool exception is logged as success=False through the
        real middleware chain from build_middleware_list()."""
        from functools import partial

        from fastmcp.tools.tool import ToolResult

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
