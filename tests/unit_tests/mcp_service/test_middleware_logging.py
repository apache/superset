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
- Event logger calls always include required positional args
"""

import contextlib
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastmcp.exceptions import ToolError

from superset.mcp_service.middleware import (
    GlobalErrorHandlerMiddleware,
    LoggingMiddleware,
    RateLimitMiddleware,
    ResponseSizeGuardMiddleware,
)
from superset.utils.log import AuditLogSource, DBEventLogger


def _make_context(
    method: str = "tools/call",
    name: str = "list_charts",
    params: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> MagicMock:
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
    async def test_on_message_logs_with_duration(
        self, mock_get_user_id, mock_event_logger
    ):
        """on_message logs after call_next with duration_ms and success=True."""
        middleware = LoggingMiddleware()
        ctx = _make_context(method="resources/read", name="instance/metadata")
        call_next = AsyncMock(return_value="resource_data")

        result = await middleware.on_message(ctx, call_next)

        assert result == "resource_data"
        call_next.assert_awaited_once_with(ctx)

        mock_event_logger.log.assert_called_once()
        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["action"] == "mcp_message"
        assert isinstance(call_kwargs["duration_ms"], int)
        assert call_kwargs["duration_ms"] >= 0
        assert call_kwargs["curated_payload"]["success"] is True


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


class TestLoggingMiddlewareMCPSource:
    """Tests that LoggingMiddleware passes source=AuditLogSource.MCP."""

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    @pytest.mark.asyncio
    async def test_on_call_tool_passes_mcp_source(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        middleware = LoggingMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="result")

        await middleware.on_call_tool(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["source"] == AuditLogSource.MCP

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    @pytest.mark.asyncio
    async def test_on_call_tool_failure_still_passes_mcp_source(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        middleware = LoggingMiddleware()
        ctx = _make_context(name="execute_sql")
        call_next = AsyncMock(side_effect=ValueError("fail"))

        with pytest.raises(ValueError, match="fail"):
            await middleware.on_call_tool(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["source"] == AuditLogSource.MCP

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=1)
    @pytest.mark.asyncio
    async def test_on_message_passes_mcp_source(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        middleware = LoggingMiddleware()
        ctx = _make_context(method="resources/read", name="instance/metadata")
        call_next = AsyncMock(return_value="data")

        await middleware.on_message(ctx, call_next)

        call_kwargs = mock_event_logger.log.call_args[1]
        assert call_kwargs["source"] == AuditLogSource.MCP


class TestEventLoggerRequiredArgs:
    """
    Tests that all event_logger.log() call sites pass the four required
    positional args (dashboard_id, duration_ms, slice_id, referrer).
    Without these, DBEventLogger.log() raises TypeError silently swallowed
    by the surrounding try/except, causing audit events to never be stored.
    """

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=5)
    @pytest.mark.asyncio
    async def test_error_event_includes_required_positional_args(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """_handle_error() passes dashboard_id, duration_ms, slice_id, referrer."""
        middleware = GlobalErrorHandlerMiddleware()
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(side_effect=RuntimeError("db connection failed"))

        with pytest.raises(ToolError):
            await middleware.on_message(ctx, call_next)

        mock_event_logger.log.assert_called_once()
        kw = mock_event_logger.log.call_args[1]
        assert kw["action"] == "mcp_tool_error"
        assert "dashboard_id" in kw
        assert "slice_id" in kw
        assert "referrer" in kw
        assert "duration_ms" in kw

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=5)
    @pytest.mark.asyncio
    async def test_error_event_uses_sanitized_error_message(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """_handle_error() writes sanitized_error (not str(error)) to audit payload."""
        middleware = GlobalErrorHandlerMiddleware()
        ctx = _make_context(name="list_charts")
        conn_string = "postgresql://user:p%40ssword@host/db"  # noqa: S105
        call_next = AsyncMock(side_effect=RuntimeError(conn_string))

        with pytest.raises(ToolError):
            await middleware.on_message(ctx, call_next)

        mock_event_logger.log.assert_called_once()
        kw = mock_event_logger.log.call_args[1]
        payload = kw["curated_payload"]
        assert conn_string not in payload["error_message"]

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=None)
    @pytest.mark.asyncio
    async def test_rate_limit_event_includes_required_positional_args(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """RateLimitMiddleware passes dashboard_id, duration_ms, slice_id, referrer."""
        middleware = RateLimitMiddleware(default_requests_per_minute=1)
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value="ok")

        # First call should succeed; trigger rate limit on second
        with contextlib.suppress(ToolError):
            await middleware.on_call_tool(ctx, call_next)

        # Second call hits the rate limit
        with pytest.raises(ToolError, match="Rate limit exceeded"):
            await middleware.on_call_tool(ctx, call_next)

        mock_event_logger.log.assert_called()
        kw = mock_event_logger.log.call_args[1]
        assert kw["action"] == "mcp_rate_limit_exceeded"
        assert "dashboard_id" in kw
        assert "duration_ms" in kw
        assert "slice_id" in kw
        assert "referrer" in kw

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=2)
    @pytest.mark.asyncio
    async def test_size_exceeded_event_includes_required_positional_args(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """ResponseSizeGuardMiddleware size-exceeded log includes all required args."""
        middleware = ResponseSizeGuardMiddleware(token_limit=100)
        ctx = _make_context(name="list_charts")
        call_next = AsyncMock(return_value={"data": "x" * 10000})

        with pytest.raises(ToolError):
            await middleware.on_call_tool(ctx, call_next)

        mock_event_logger.log.assert_called()
        kw = mock_event_logger.log.call_args[1]
        assert kw["action"] == "mcp_response_size_exceeded"
        assert "dashboard_id" in kw
        assert "duration_ms" in kw
        assert "slice_id" in kw
        assert "referrer" in kw

    @patch("superset.mcp_service.middleware.event_logger")
    @patch("superset.mcp_service.middleware.get_user_id", return_value=2)
    @pytest.mark.asyncio
    async def test_truncation_event_includes_required_positional_args(
        self, mock_get_user_id, mock_event_logger
    ) -> None:
        """ResponseSizeGuardMiddleware truncation log includes all required args."""
        middleware = ResponseSizeGuardMiddleware(token_limit=500)
        ctx = _make_context(name="get_dashboard_info")
        large_response = {"id": 1, "description": "x" * 50000}
        call_next = AsyncMock(return_value=large_response)

        await middleware.on_call_tool(ctx, call_next)

        mock_event_logger.log.assert_called()
        kw = mock_event_logger.log.call_args[1]
        assert kw["action"] == "mcp_response_truncated"
        assert "dashboard_id" in kw
        assert "duration_ms" in kw
        assert "slice_id" in kw
        assert "referrer" in kw


class TestDBEventLoggerBulkSave:
    """Verify that the records= kwarg actually reaches bulk_save_objects.

    Uses a real DBEventLogger (not mocked) with only db.session patched,
    confirming that omitting records= produces zero writes while including
    it produces exactly one.
    """

    def test_log_with_records_calls_bulk_save_objects(self) -> None:
        """DBEventLogger.log() with records=[payload] passes a non-empty list
        to bulk_save_objects."""
        db_event_logger = DBEventLogger()
        payload = {"tool": "list_charts", "success": True}

        with patch("superset.db") as mock_db:
            db_event_logger.log(
                user_id=1,
                action="mcp_tool_call",
                dashboard_id=None,
                duration_ms=100,
                slice_id=None,
                referrer=None,
                source=AuditLogSource.MCP,
                records=[payload],
                curated_payload=payload,
            )

        mock_db.session.bulk_save_objects.assert_called_once()
        saved = mock_db.session.bulk_save_objects.call_args[0][0]
        assert len(saved) == 1
        assert saved[0].action == "mcp_tool_call"

    def test_log_without_records_writes_nothing(self) -> None:
        """DBEventLogger.log() without records= kwarg passes an empty list
        to bulk_save_objects."""
        db_event_logger = DBEventLogger()
        payload = {"tool": "list_charts", "success": True}

        with patch("superset.db") as mock_db:
            db_event_logger.log(
                user_id=1,
                action="mcp_tool_call",
                dashboard_id=None,
                duration_ms=100,
                slice_id=None,
                referrer=None,
                source=AuditLogSource.MCP,
                curated_payload=payload,
            )

        mock_db.session.bulk_save_objects.assert_called_once()
        saved = mock_db.session.bulk_save_objects.call_args[0][0]
        assert len(saved) == 0
