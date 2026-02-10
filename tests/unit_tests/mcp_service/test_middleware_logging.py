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
