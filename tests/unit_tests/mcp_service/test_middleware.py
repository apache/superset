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
Unit tests for MCP service middleware.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastmcp.exceptions import ToolError

from superset.mcp_service.middleware import (
    create_response_size_guard_middleware,
    ResponseSizeGuardMiddleware,
)


class TestResponseSizeGuardMiddleware:
    """Test ResponseSizeGuardMiddleware class."""

    def test_init_default_values(self) -> None:
        """Should initialize with default values."""
        middleware = ResponseSizeGuardMiddleware()
        assert middleware.token_limit == 25_000
        assert middleware.warn_threshold_pct == 80
        assert middleware.warn_threshold == 20000
        assert middleware.excluded_tools == set()

    def test_init_custom_values(self) -> None:
        """Should initialize with custom values."""
        middleware = ResponseSizeGuardMiddleware(
            token_limit=10000,
            warn_threshold_pct=70,
            excluded_tools=["health_check", "get_chart_preview"],
        )
        assert middleware.token_limit == 10000
        assert middleware.warn_threshold_pct == 70
        assert middleware.warn_threshold == 7000
        assert middleware.excluded_tools == {"health_check", "get_chart_preview"}

    def test_init_excluded_tools_as_string(self) -> None:
        """Should handle excluded_tools as a single string."""
        middleware = ResponseSizeGuardMiddleware(
            excluded_tools="health_check",
        )
        assert middleware.excluded_tools == {"health_check"}

    @pytest.mark.asyncio
    async def test_allows_small_response(self) -> None:
        """Should allow responses under token limit."""
        middleware = ResponseSizeGuardMiddleware(token_limit=25000)

        # Create mock context
        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {}

        # Create mock call_next that returns small response
        small_response = {"charts": [{"id": 1, "name": "test"}]}
        call_next = AsyncMock(return_value=small_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
        ):
            result = await middleware.on_call_tool(context, call_next)

        assert result == small_response
        call_next.assert_called_once_with(context)

    @pytest.mark.asyncio
    async def test_blocks_large_response(self) -> None:
        """Should block responses over token limit."""
        middleware = ResponseSizeGuardMiddleware(token_limit=100)  # Very low limit

        # Create mock context
        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {"page_size": 100}

        # Create large response
        large_response = {
            "charts": [{"id": i, "name": f"chart_{i}"} for i in range(1000)]
        }
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            pytest.raises(ToolError) as exc_info,
        ):
            await middleware.on_call_tool(context, call_next)

        # Verify error contains helpful information
        error_message = str(exc_info.value)
        assert "Response too large" in error_message
        assert "limit" in error_message.lower()

    @pytest.mark.asyncio
    async def test_skips_excluded_tools(self) -> None:
        """Should skip checking for excluded tools."""
        middleware = ResponseSizeGuardMiddleware(
            token_limit=100, excluded_tools=["health_check"]
        )

        # Create mock context for excluded tool
        context = MagicMock()
        context.message.name = "health_check"
        context.message.params = {}

        # Create response that would exceed limit
        large_response = {"data": "x" * 10000}
        call_next = AsyncMock(return_value=large_response)

        # Should not raise even though response exceeds limit
        result = await middleware.on_call_tool(context, call_next)
        assert result == large_response

    @pytest.mark.asyncio
    async def test_logs_warning_at_threshold(self) -> None:
        """Should log warning when approaching limit."""
        middleware = ResponseSizeGuardMiddleware(
            token_limit=1000, warn_threshold_pct=80
        )

        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {}

        # Response at ~85% of limit (should trigger warning but not block)
        response = {"data": "x" * 2900}  # ~828 tokens at 3.5 chars/token
        call_next = AsyncMock(return_value=response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
        ):
            result = await middleware.on_call_tool(context, call_next)

        # Should return response (not blocked)
        assert result == response
        # Should log warning
        mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_error_includes_suggestions(self) -> None:
        """Should include suggestions in error message."""
        middleware = ResponseSizeGuardMiddleware(token_limit=100)

        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {"page_size": 100}

        large_response = {"charts": [{"id": i} for i in range(1000)]}
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            pytest.raises(ToolError) as exc_info,
        ):
            await middleware.on_call_tool(context, call_next)

        error_message = str(exc_info.value)
        # Should have numbered suggestions
        assert "1." in error_message
        # Should suggest reducing page_size
        assert "page_size" in error_message.lower() or "limit" in error_message.lower()

    @pytest.mark.asyncio
    async def test_logs_size_exceeded_event(self) -> None:
        """Should log to event logger when size exceeded."""
        middleware = ResponseSizeGuardMiddleware(token_limit=100)

        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {}

        large_response = {"data": "x" * 10000}
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger") as mock_event_logger,
            pytest.raises(ToolError),
        ):
            await middleware.on_call_tool(context, call_next)

        # Should log to event logger
        mock_event_logger.log.assert_called()
        call_args = mock_event_logger.log.call_args
        assert call_args.kwargs["action"] == "mcp_response_size_exceeded"


class TestCreateResponseSizeGuardMiddleware:
    """Test create_response_size_guard_middleware factory function."""

    def test_creates_middleware_when_enabled(self) -> None:
        """Should create middleware when enabled in config."""
        mock_config = {
            "enabled": True,
            "token_limit": 30000,
            "warn_threshold_pct": 75,
            "excluded_tools": ["health_check"],
        }

        mock_flask_app = MagicMock()
        mock_flask_app.config.get.return_value = mock_config

        with patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=mock_flask_app,
        ):
            middleware = create_response_size_guard_middleware()

        assert middleware is not None
        assert isinstance(middleware, ResponseSizeGuardMiddleware)
        assert middleware.token_limit == 30000
        assert middleware.warn_threshold_pct == 75
        assert "health_check" in middleware.excluded_tools

    def test_returns_none_when_disabled(self) -> None:
        """Should return None when disabled in config."""
        mock_config = {"enabled": False}

        mock_flask_app = MagicMock()
        mock_flask_app.config.get.return_value = mock_config

        with patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=mock_flask_app,
        ):
            middleware = create_response_size_guard_middleware()

        assert middleware is None

    def test_uses_defaults_when_config_missing(self) -> None:
        """Should use defaults when config values are missing."""
        mock_config = {"enabled": True}  # Only enabled, no other values

        mock_flask_app = MagicMock()
        mock_flask_app.config.get.return_value = mock_config

        with patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=mock_flask_app,
        ):
            middleware = create_response_size_guard_middleware()

        assert middleware is not None
        assert middleware.token_limit == 25_000  # Default
        assert middleware.warn_threshold_pct == 80  # Default

    def test_handles_exception_gracefully(self) -> None:
        """Should return None on expected configuration exceptions."""
        with patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            side_effect=ImportError("Config error"),
        ):
            middleware = create_response_size_guard_middleware()

        assert middleware is None


class TestMiddlewareIntegration:
    """Integration tests for middleware behavior."""

    @pytest.mark.asyncio
    async def test_pydantic_model_response(self) -> None:
        """Should handle Pydantic model responses."""
        from pydantic import BaseModel

        class ChartInfo(BaseModel):
            id: int
            name: str

        middleware = ResponseSizeGuardMiddleware(token_limit=25000)

        context = MagicMock()
        context.message.name = "get_chart_info"
        context.message.params = {}

        response = ChartInfo(id=1, name="Test Chart")
        call_next = AsyncMock(return_value=response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
        ):
            result = await middleware.on_call_tool(context, call_next)

        assert result == response

    @pytest.mark.asyncio
    async def test_list_response(self) -> None:
        """Should handle list responses."""
        middleware = ResponseSizeGuardMiddleware(token_limit=25000)

        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {}

        response = [{"id": 1}, {"id": 2}, {"id": 3}]
        call_next = AsyncMock(return_value=response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
        ):
            result = await middleware.on_call_tool(context, call_next)

        assert result == response

    @pytest.mark.asyncio
    async def test_string_response(self) -> None:
        """Should handle string responses."""
        middleware = ResponseSizeGuardMiddleware(token_limit=25000)

        context = MagicMock()
        context.message.name = "health_check"
        context.message.params = {}

        response = "OK"
        call_next = AsyncMock(return_value=response)

        result = await middleware.on_call_tool(context, call_next)
        assert result == response
