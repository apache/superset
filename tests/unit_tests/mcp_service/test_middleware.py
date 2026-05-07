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
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from superset.commands.exceptions import (
    CommandInvalidError,
    ForbiddenError,
    ObjectNotFoundError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.mcp_service.middleware import (
    _is_user_error,
    create_response_size_guard_middleware,
    GlobalErrorHandlerMiddleware,
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
        """Should log warning when approaching limit.

        Mocks the token estimator to return a specific value above the
        warn threshold but below the hard limit, decoupling the test
        from whichever tokenizer (tiktoken or char heuristic) happens
        to be loaded.
        """
        middleware = ResponseSizeGuardMiddleware(
            token_limit=1000, warn_threshold_pct=80
        )

        context = MagicMock()
        context.message.name = "list_charts"
        context.message.params = {}

        response = {"data": "approaching the limit"}
        call_next = AsyncMock(return_value=response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch(
                "superset.mcp_service.middleware.estimate_response_tokens",
                return_value=850,
            ),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
        ):
            result = await middleware.on_call_tool(context, call_next)

        # Should return response (not blocked at 85% of limit)
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

    @pytest.mark.asyncio
    async def test_truncates_info_tool_instead_of_blocking(self) -> None:
        """Should truncate info tool responses instead of blocking them."""
        middleware = ResponseSizeGuardMiddleware(token_limit=500)

        context = MagicMock()
        context.message.name = "get_dataset_info"
        context.message.params = {}

        # Large info tool response with a big description
        large_response = {
            "id": 1,
            "table_name": "test",
            "description": "x" * 50000,
        }
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
        ):
            result = await middleware.on_call_tool(context, call_next)

        # Should return truncated response, not raise ToolError
        assert isinstance(result, dict)
        assert result["id"] == 1
        assert result["_response_truncated"] is True
        assert "[truncated" in result["description"]

    @pytest.mark.asyncio
    async def test_truncates_chart_info_with_large_form_data(self) -> None:
        """Should truncate get_chart_info with large form_data."""
        middleware = ResponseSizeGuardMiddleware(token_limit=500)

        context = MagicMock()
        context.message.name = "get_chart_info"
        context.message.params = {}

        large_response = {
            "id": 1,
            "slice_name": "My Chart",
            "form_data": {f"key_{i}": f"value_{i}" for i in range(100)},
        }
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
        ):
            result = await middleware.on_call_tool(context, call_next)

        assert isinstance(result, dict)
        assert result["id"] == 1
        assert result["_response_truncated"] is True

    @pytest.mark.asyncio
    async def test_still_blocks_non_info_tools(self) -> None:
        """Should still block non-info tools that exceed limit."""
        middleware = ResponseSizeGuardMiddleware(token_limit=100)

        context = MagicMock()
        context.message.name = "list_charts"  # Not an info tool
        context.message.params = {}

        large_response = {"data": "x" * 10000}
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            pytest.raises(ToolError),
        ):
            await middleware.on_call_tool(context, call_next)

    @pytest.mark.asyncio
    async def test_logs_truncation_event(self) -> None:
        """Should log mcp_response_truncated event on successful truncation."""
        middleware = ResponseSizeGuardMiddleware(token_limit=500)

        context = MagicMock()
        context.message.name = "get_dashboard_info"
        context.message.params = {}

        large_response = {
            "id": 1,
            "description": "x" * 50000,
        }
        call_next = AsyncMock(return_value=large_response)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger") as mock_event_logger,
        ):
            await middleware.on_call_tool(context, call_next)

        # Should log truncation event (not size_exceeded)
        mock_event_logger.log.assert_called()
        call_args = mock_event_logger.log.call_args
        assert call_args.kwargs["action"] == "mcp_response_truncated"


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


def _make_security_exception(msg: str = "access denied") -> SupersetSecurityException:
    """Helper to construct SupersetSecurityException with a proper SupersetError."""
    return SupersetSecurityException(
        SupersetError(
            message=msg,
            error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


class TestIsUserError:
    """Test _is_user_error classification helper."""

    @pytest.mark.parametrize(
        ("error", "expected"),
        [
            # User errors (WARNING) — expected in normal MCP operation
            (ToolError("bad request"), True),
            (PermissionError("access denied"), True),
            (ObjectNotFoundError("Chart", "123"), True),
            (ForbiddenError(), True),
            (_make_security_exception(), True),
            (ValueError("invalid param"), True),
            (FileNotFoundError("not found"), True),
            # System errors (ERROR) — unexpected failures
            (RuntimeError("unexpected"), False),
            (ConnectionError("connection refused"), False),
            (TypeError("type mismatch"), False),
            (KeyError("missing key"), False),
            (Exception("generic"), False),
        ],
        ids=[
            "ToolError",
            "PermissionError",
            "ObjectNotFoundError",
            "ForbiddenError",
            "SupersetSecurityException",
            "ValueError",  # user error — bad param from LLM
            "FileNotFoundError",
            "RuntimeError",
            "ConnectionError",
            "TypeError",
            "KeyError",
            "Exception",
        ],
    )
    def test_error_classification(self, error: Exception, expected: bool) -> None:
        """Test that _is_user_error correctly classifies error types."""
        assert _is_user_error(error) == expected

    def test_validation_error(self) -> None:
        """Test ValidationError is classified as user error."""
        from pydantic import BaseModel

        class TestModel(BaseModel):
            """Test model for validation error testing."""

            name: str

        with pytest.raises(ValidationError) as exc_info:
            TestModel.model_validate({})
        assert _is_user_error(exc_info.value) is True

    def test_command_invalid_error(self) -> None:
        """Test CommandInvalidError is classified as user error."""
        error = CommandInvalidError()
        assert _is_user_error(error) is True
        assert error.status == 422

    def test_operational_error(self) -> None:
        """Test OperationalError is classified as system error."""
        error = OperationalError("db error", {}, Exception())
        assert _is_user_error(error) is False

    def test_superset_exception_status_based(self) -> None:
        """Test SupersetException classification is based on .status attribute."""
        # 4xx status → user error
        error_400 = SupersetException("bad request")
        error_400.status = 400
        assert _is_user_error(error_400) is True

        error_408 = SupersetException("timeout")
        error_408.status = 408
        assert _is_user_error(error_408) is True

        error_422 = SupersetException("unprocessable")
        error_422.status = 422
        assert _is_user_error(error_422) is True

        # 5xx status → system error
        error_500 = SupersetException("internal error")
        error_500.status = 500
        assert _is_user_error(error_500) is False

        error_503 = SupersetException("unavailable")
        error_503.status = 503
        assert _is_user_error(error_503) is False


class TestGlobalErrorHandlerLogLevels:
    """Test that GlobalErrorHandlerMiddleware logs at correct levels."""

    @pytest.mark.asyncio
    async def test_user_error_logs_warning(self) -> None:
        """User errors (e.g. ValueError) should log at WARNING."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=ValueError("invalid page"))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError),
        ):
            await middleware.on_message(context, call_next)

        # Should log at WARNING, not ERROR
        mock_logger.warning.assert_called()
        mock_logger.error.assert_not_called()

    @pytest.mark.asyncio
    async def test_system_error_logs_error(self) -> None:
        """System errors (OperationalError, generic Exception) should log at ERROR."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "execute_sql"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=OperationalError("db error", {}, Exception()))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError),
        ):
            await middleware.on_message(context, call_next)

        # Should log at ERROR
        mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_unexpected_error_logs_error(self) -> None:
        """Truly unexpected errors should log at ERROR with error_id."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=RuntimeError("something broke"))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError, match="Internal error"),
        ):
            await middleware.on_message(context, call_next)

        # Should log at ERROR (both the classification log and the error_id log)
        assert mock_logger.error.call_count >= 1

    @pytest.mark.asyncio
    async def test_event_logger_includes_severity(self) -> None:
        """Event logger payload should include severity field."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=ValueError("bad param"))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger") as mock_event_logger,
            patch("superset.mcp_service.middleware.logger"),
            pytest.raises(ToolError),
        ):
            await middleware.on_message(context, call_next)

        mock_event_logger.log.assert_called_once()
        payload = mock_event_logger.log.call_args.kwargs["curated_payload"]
        assert payload["severity"] == "warning"

    @pytest.mark.asyncio
    async def test_permission_error_logs_warning(self) -> None:
        """PermissionError should log at WARNING — agents are expected to
        try tools they lack access to."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "generate_chart"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=PermissionError("not allowed"))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError, match="Permission denied"),
        ):
            await middleware.on_message(context, call_next)

        mock_logger.warning.assert_called()
        mock_logger.error.assert_not_called()

    @pytest.mark.asyncio
    async def test_connection_error_logs_error(self) -> None:
        """ConnectionError should log at ERROR — infrastructure issue."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        call_next = AsyncMock(side_effect=ConnectionError("connection refused"))

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError, match="Connection error"),
        ):
            await middleware.on_message(context, call_next)

        mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_superset_exception_4xx_logs_warning(self) -> None:
        """SupersetException with 4xx status should log at WARNING."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        error = SupersetException("bad request")
        error.status = 400
        call_next = AsyncMock(side_effect=error)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError, match="Invalid request"),
        ):
            await middleware.on_message(context, call_next)

        mock_logger.warning.assert_called()
        mock_logger.error.assert_not_called()

    @pytest.mark.asyncio
    async def test_superset_exception_5xx_logs_error(self) -> None:
        """SupersetException with 5xx status should log at ERROR."""
        middleware = GlobalErrorHandlerMiddleware()

        context = MagicMock()
        context.message.name = "list_charts"
        context.method = "tools/call"

        error = SupersetException("internal failure")
        error.status = 500
        call_next = AsyncMock(side_effect=error)

        with (
            patch("superset.mcp_service.middleware.get_user_id", return_value=1),
            patch("superset.mcp_service.middleware.event_logger"),
            patch("superset.mcp_service.middleware.logger") as mock_logger,
            pytest.raises(ToolError, match="Internal error"),
        ):
            await middleware.on_message(context, call_next)

        mock_logger.error.assert_called()
