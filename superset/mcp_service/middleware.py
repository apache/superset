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

import logging
import time
from collections import defaultdict
from typing import Any, Awaitable, Callable, Dict, Protocol

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError, TimeoutError
from starlette.exceptions import HTTPException

from superset.extensions import event_logger
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


def _sanitize_error_for_logging(error: Exception) -> str:
    """Sanitize error messages to prevent information disclosure in logs."""
    error_str = str(error)

    # SECURITY FIX: Limit error message length FIRST to prevent ReDoS attacks
    if len(error_str) > 500:
        error_str = error_str[:500] + "...[truncated]"

    # SECURITY FIX: Use substring checks and bounded patterns to prevent ReDoS
    import re

    # Database connection strings - use substring checks instead of complex regex
    error_str_lower = error_str.lower()
    if "postgresql://" in error_str_lower:
        # Simple bounded pattern for postgres URLs
        error_str = re.sub(
            r"postgresql://[^@]{1,100}@[^/]{1,100}/",
            "postgresql://[REDACTED]@[REDACTED]/",
            error_str,
        )
    if "mysql://" in error_str_lower:
        # Simple bounded pattern for mysql URLs
        error_str = re.sub(
            r"mysql://[^@]{1,100}@[^/]{1,100}/",
            "mysql://[REDACTED]@[REDACTED]/",
            error_str,
        )

    # API keys and tokens - substring check first, then bounded pattern
    if "api" in error_str_lower and "key" in error_str_lower:
        error_str = re.sub(
            r"[Aa]pi[_-]?[Kk]ey[:\s]{0,5}[^\s'\"]{1,100}",
            "ApiKey: [REDACTED]",
            error_str,
        )
    if "token" in error_str_lower:
        error_str = re.sub(
            r"[Tt]oken[:\s]{0,5}[^\s'\"]{1,100}", "Token: [REDACTED]", error_str
        )

    # File paths - substring check first
    if "/superset/" in error_str:
        # Bounded pattern for file paths
        error_str = re.sub(
            r"/[a-zA-Z0-9_\-/.]{1,200}/superset/", "/[REDACTED]/superset/", error_str
        )

    # IP addresses - already safe pattern, keep as-is
    error_str = re.sub(r"\b(\d+)\.\d+\.\d+\.\d+\b", r"\1.xxx.xxx.xxx", error_str)

    # For certain error types, provide generic messages
    if isinstance(error, (OperationalError, TimeoutError)):
        return "Database operation failed"
    elif isinstance(error, PermissionError):
        return "Access denied"
    elif isinstance(error, ValidationError):
        return "Request validation failed"

    return error_str


class LoggingMiddleware(Middleware):
    """
    Middleware that logs every MCP message (request and response) using Superset's
    event logger. This matches the core Superset audit log system (Action Log UI,
    logs table, custom loggers). Also attempts to log dashboard_id, chart_id
    (slice_id), and dataset_id if present in tool params.
    """

    async def on_message(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        # Extract agent_id and user_id
        agent_id = None
        user_id = None
        dashboard_id = None
        slice_id = None
        dataset_id = None
        params = getattr(context.message, "params", {}) or {}
        if hasattr(context, "metadata") and context.metadata:
            agent_id = context.metadata.get("agent_id")
        if not agent_id and hasattr(context, "session") and context.session:
            agent_id = getattr(context.session, "agent_id", None)
        try:
            user_id = get_user_id()
        except Exception:
            user_id = None
        # Try to extract IDs from params
        if isinstance(params, dict):
            dashboard_id = params.get("dashboard_id")
            # Chart ID may be under 'chart_id' or 'slice_id'
            slice_id = params.get("chart_id") or params.get("slice_id")
            dataset_id = params.get("dataset_id")
        # Log to Superset's event logger (DB, Action Log UI, or custom)
        event_logger.log(
            user_id=user_id,
            action="mcp_tool_call",
            dashboard_id=dashboard_id,
            duration_ms=None,
            slice_id=slice_id,
            referrer=None,
            curated_payload={
                "tool": getattr(context.message, "name", None),
                "agent_id": agent_id,
                "params": params,
                "method": context.method,
                "dashboard_id": dashboard_id,
                "slice_id": slice_id,
                "dataset_id": dataset_id,
            },
        )
        # (Optional) also log to standard logger for debugging
        logger.info(
            "MCP tool call: tool=%s, agent_id=%s, user_id=%s, method=%s, "
            "dashboard_id=%s, slice_id=%s, dataset_id=%s",
            getattr(context.message, "name", None),
            agent_id,
            user_id,
            context.method,
            dashboard_id,
            slice_id,
            dataset_id,
        )
        return await call_next(context)


class PrivateToolMiddleware(Middleware):
    """
    Middleware that blocks access to tools tagged as 'private'.
    """

    async def on_call_tool(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
        if "private" in getattr(tool, "tags", set()):
            raise ToolError(f"Access denied to private tool: {context.message.name}")
        return await call_next(context)


class GlobalErrorHandlerMiddleware(Middleware):
    """
    Global error handler middleware that provides consistent error responses
    and proper error logging for all MCP tool calls.
    """

    async def on_message(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Handle all message types with consistent error handling"""
        start_time = time.time()
        tool_name = getattr(context.message, "name", "unknown")

        try:
            return await call_next(context)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return await self._handle_error(e, context, tool_name, duration_ms)

    async def _handle_error(  # noqa: C901
        self,
        error: Exception,
        context: MiddlewareContext,
        tool_name: str,
        duration_ms: int,
    ) -> None:
        """Handle different types of errors with appropriate responses"""
        # Extract user context for logging
        user_id = None
        try:
            user_id = get_user_id()
        except Exception:
            user_id = None  # User not authenticated

        # SECURITY FIX: Log the error with sanitized context
        sanitized_error = _sanitize_error_for_logging(error)
        logger.error(
            "MCP tool error: tool=%s, user_id=%s, duration_ms=%s, "
            "error_type=%s, error=%s",
            tool_name,
            user_id,
            duration_ms,
            type(error).__name__,
            sanitized_error,
        )

        # Log to Superset's event system
        try:
            event_logger.log(
                user_id=user_id,
                action="mcp_tool_error",
                duration_ms=duration_ms,
                curated_payload={
                    "tool": tool_name,
                    "error_type": type(error).__name__,
                    "error_message": str(error),
                    "method": context.method,
                },
            )
        except Exception as log_error:
            logger.warning("Failed to log error event: %s", log_error)

        # Handle specific error types with appropriate responses
        if isinstance(error, ToolError):
            # Tool errors are already formatted for MCP
            raise error
        elif isinstance(error, ValidationError):
            # Pydantic validation errors
            validation_details = []
            for err in error.errors():
                field = " -> ".join(str(loc) for loc in err["loc"])
                validation_details.append(f"{field}: {err['msg']}")

            raise ToolError(
                f"Validation error in {tool_name}: {'; '.join(validation_details)}"
            ) from error
        elif isinstance(error, (OperationalError, TimeoutError)):
            # Database errors
            raise ToolError(
                f"Database error in {tool_name}: Service temporarily unavailable. "
                f"Please try again in a few moments."
            ) from error
        elif isinstance(error, HTTPException):
            # HTTP errors from screenshot endpoints or API calls
            raise ToolError(f"Service error in {tool_name}: {error.detail}") from error
        elif isinstance(error, PermissionError):
            # Permission/authorization errors
            raise ToolError(
                f"Permission denied for {tool_name}: "
                f"You don't have access to this resource."
            ) from error
        elif isinstance(error, FileNotFoundError):
            # File/resource not found errors
            raise ToolError(
                f"Resource not found in {tool_name}: {str(error)}"
            ) from error
        elif isinstance(error, ValueError):
            # Value/parameter errors
            raise ToolError(
                f"Invalid parameter in {tool_name}: {str(error)}"
            ) from error
        else:
            # Generic internal errors
            error_id = f"err_{int(time.time())}"
            logger.error("Unexpected error [%s] in %s: %s", error_id, tool_name, error)

            raise ToolError(
                f"Internal error in {tool_name}: An unexpected error occurred. "
                f"Error ID: {error_id}. Please contact support if this persists."
            ) from error


class RateLimiterProtocol(Protocol):
    """Protocol for rate limiter implementations."""

    def is_rate_limited(
        self, key: str, limit: int, window: int = 60
    ) -> tuple[bool, dict[str, Any]]:
        """Check if a key is rate limited."""
        ...

    def cleanup(self) -> None:
        """Clean up old entries if needed."""
        ...


class InMemoryRateLimiter:
    """In-memory rate limiter for development."""

    def __init__(self) -> None:
        # Structure: {key: [(timestamp, count), ...]}
        self._requests: Dict[str, list[tuple[float, int]]] = defaultdict(list)
        self._cleanup_interval = 300  # Clean up every 5 minutes
        self._last_cleanup = time.time()

    def is_rate_limited(
        self, key: str, limit: int, window: int = 60
    ) -> tuple[bool, dict[str, Any]]:
        """Check if request should be rate limited using sliding window."""
        current_time = time.time()
        window_start = current_time - window

        # Get requests in the current window
        requests_in_window = [
            (timestamp, count)
            for timestamp, count in self._requests[key]
            if timestamp > window_start
        ]

        # Calculate total requests in window
        total_requests = sum(count for _, count in requests_in_window)

        # Check if rate limited BEFORE adding the current request
        if total_requests >= limit:
            # Rate limit info when limited
            rate_limit_info = {
                "limit": limit,
                "remaining": 0,
                "reset_time": int(window_start + window),
                "window_seconds": window,
            }
            return True, rate_limit_info

        # Add current request to tracking
        self._requests[key].append((current_time, 1))

        # Update total after adding
        total_requests += 1

        # Keep only recent entries
        self._requests[key] = [
            (ts, count)
            for ts, count in self._requests[key]
            if ts > current_time - 3600  # Keep last hour
        ]

        # Rate limit info after adding request
        rate_limit_info = {
            "limit": limit,
            "remaining": max(0, limit - total_requests),
            "reset_time": int(window_start + window),
            "window_seconds": window,
        }

        return False, rate_limit_info

    def cleanup(self) -> None:
        """Remove entries older than 1 hour to prevent memory leaks."""
        current_time = time.time()

        # SECURITY FIX: Check both time-based and size-based cleanup conditions
        total_entries = sum(len(requests) for requests in self._requests.values())
        size_threshold = 10000  # Maximum entries before forced cleanup

        time_based_cleanup = current_time - self._last_cleanup >= self._cleanup_interval
        size_based_cleanup = total_entries > size_threshold

        if not (time_based_cleanup or size_based_cleanup):
            return

        cutoff_time = current_time - 3600  # 1 hour ago
        keys_to_clean = []

        for key, requests in self._requests.items():
            # Remove old entries
            self._requests[key] = [
                (timestamp, count)
                for timestamp, count in requests
                if timestamp > cutoff_time
            ]
            # Mark empty keys for removal
            if not self._requests[key]:
                keys_to_clean.append(key)

        for key in keys_to_clean:
            del self._requests[key]

        # SECURITY FIX: If still too many entries, implement aggressive cleanup
        if total_entries > size_threshold:
            logger.warning(
                "Rate limiter memory high (%d entries), performing aggressive cleanup",
                total_entries,
            )
            # Keep only the most recent entries per key
            for key in list(self._requests.keys()):
                if len(self._requests[key]) > 100:  # Keep max 100 entries per key
                    self._requests[key] = self._requests[key][-100:]

        self._last_cleanup = current_time


class RedisRateLimiter:
    """Redis-backed rate limiter for production."""

    def __init__(self) -> None:
        from superset.extensions import cache_manager

        self._cache = cache_manager.cache
        self._prefix = "mcp:ratelimit:"

    def is_rate_limited(
        self, key: str, limit: int, window: int = 60
    ) -> tuple[bool, dict[str, Any]]:
        """Check if request should be rate limited using Redis sliding window."""
        current_time = time.time()
        full_key = "%s%s" % (self._prefix, key)

        try:
            # Use Redis sorted set for sliding window
            window_start = current_time - window

            # Remove old entries outside the window
            self._cache.delete_many(
                [
                    k
                    for k, score in self._cache.get(full_key) or []
                    if score < window_start
                ]
            )

            # Get count of requests in window
            request_count = self._cache.get("%s:count" % full_key) or 0

            # Rate limit info
            rate_limit_info = {
                "limit": limit,
                "remaining": max(0, limit - request_count),
                "reset_time": int(current_time + window),
                "window_seconds": window,
            }

            if request_count >= limit:
                return True, rate_limit_info

            # Increment counter with TTL
            new_count = (request_count or 0) + 1
            self._cache.set("%s:count" % full_key, new_count, timeout=window)

            return False, rate_limit_info

        except Exception as e:
            logger.warning("Redis rate limiter error: %s, allowing request", e)
            # On Redis error, allow the request
            return False, {
                "limit": limit,
                "remaining": limit,
                "reset_time": 0,
                "window_seconds": window,
            }

    def cleanup(self) -> None:
        """No cleanup needed for Redis - TTL handles expiration."""
        pass


def create_rate_limiter() -> RateLimiterProtocol:
    """Factory to create appropriate rate limiter based on environment."""
    try:
        # Try to use Redis first (production)
        from superset.extensions import cache_manager

        if cache_manager and cache_manager.cache:
            # Test Redis connectivity
            test_key = "mcp:ratelimit:test"
            cache_manager.cache.set(test_key, 1, timeout=1)
            if cache_manager.cache.get(test_key):
                cache_manager.cache.delete(test_key)
                logger.info("Using Redis for rate limiting")
                return RedisRateLimiter()
    except Exception as e:
        logger.warning(
            "Redis not available for rate limiting: %s, falling back to in-memory", e
        )

    # Fallback to in-memory rate limiter (development)
    logger.info("Using in-memory rate limiter")
    return InMemoryRateLimiter()


class RateLimitMiddleware(Middleware):
    """
    Rate limiting middleware to prevent abuse of MCP tools.

    Implements sliding window rate limiting with separate limits for:
    - Per-user limits (if authenticated)
    - Per-IP limits (for unauthenticated requests)
    - Per-tool limits (for expensive operations)

    Configuration:
    - default_requests_per_minute: Default rate limit (60 requests/minute)
    - per_user_requests_per_minute: Rate limit per authenticated user (120/min)
    - expensive_tool_requests_per_minute: Rate limit for expensive tools (10/min)
    """

    def __init__(
        self,
        default_requests_per_minute: int = 60,
        per_user_requests_per_minute: int = 120,
        expensive_tool_requests_per_minute: int = 10,
        expensive_tools: list[str] | None = None,
    ) -> None:
        self.default_rpm = default_requests_per_minute
        self.user_rpm = per_user_requests_per_minute
        self.expensive_rpm = expensive_tool_requests_per_minute
        self.expensive_tools = set(
            expensive_tools
            or [
                "get_chart_preview",
                "generate_chart",
                "generate_dashboard",
                "get_chart_data",
            ]
        )

        # Use hybrid rate limiter (Redis in production, in-memory in development)
        self._rate_limiter = create_rate_limiter()

    def _get_rate_limit_key(self, context: MiddlewareContext) -> tuple[str, int]:
        """
        Generate rate limit key and determine applicable limit.

        Returns:
            Tuple of (key, requests_per_minute_limit)
        """
        tool_name = getattr(context.message, "name", "unknown")

        # Get user context
        user_id = None
        try:
            user_id = get_user_id()
        except Exception:
            user_id = None  # User not authenticated

        # Determine rate limit
        if tool_name in self.expensive_tools:
            limit = self.expensive_rpm
            key_prefix = "expensive"
        elif user_id:
            limit = self.user_rpm
            key_prefix = "user"
        else:
            limit = self.default_rpm
            key_prefix = "default"

        # Generate key
        if user_id:
            key = f"{key_prefix}:user:{user_id}:{tool_name}"
        else:
            # Use agent_id or session info as fallback
            agent_id = None
            if hasattr(context, "metadata") and context.metadata:
                agent_id = context.metadata.get("agent_id")
            if not agent_id and hasattr(context, "session") and context.session:
                agent_id = getattr(context.session, "agent_id", None)

            if agent_id:
                key = f"{key_prefix}:agent:{agent_id}:{tool_name}"
            else:
                key = f"{key_prefix}:anonymous:{tool_name}"

        return key, limit

    async def on_call_tool(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Check rate limits before allowing tool calls."""
        # Clean up old entries periodically (only needed for in-memory)
        self._rate_limiter.cleanup()

        # Get rate limit key and limit
        key, limit = self._get_rate_limit_key(context)

        # Check if rate limited
        is_limited, rate_info = self._rate_limiter.is_rate_limited(key, limit)

        if is_limited:
            tool_name = getattr(context.message, "name", "unknown")

            # Log rate limit event
            try:
                user_id = get_user_id() if hasattr(context, "session") else None
                event_logger.log(
                    user_id=user_id,
                    action="mcp_rate_limit_exceeded",
                    curated_payload={
                        "tool": tool_name,
                        "rate_limit_key": key,
                        "limit": limit,
                        "window_seconds": 60,
                    },
                )
            except Exception as log_error:
                logger.warning("Failed to log rate limit event: %s", log_error)

            logger.warning(
                "Rate limit exceeded for %s: key=%s, limit=%s/min, reset_in=%ss",
                tool_name,
                key,
                limit,
                rate_info["reset_time"] - int(time.time()),
            )

            raise ToolError(
                "Rate limit exceeded for %s. "
                "Limit: %s requests per minute. "
                "Try again in %s seconds."
                % (tool_name, limit, rate_info["reset_time"] - int(time.time()))
            )

        # Log rate limit info for monitoring
        logger.debug(
            "Rate limit check: %s: key=%s, remaining=%s/%s",
            getattr(context.message, "name", "unknown"),
            key,
            rate_info["remaining"],
            limit,
        )

        return await call_next(context)


class FieldPermissionsMiddleware(Middleware):
    """
    Middleware that applies field-level permissions to filter sensitive data
    from MCP tool responses based on user permissions.
    """

    # Map tool names to object types for permission filtering
    TOOL_OBJECT_TYPE_MAP = {
        "list_datasets": "dataset",
        "get_dataset_info": "dataset",
        "list_charts": "chart",
        "get_chart_info": "chart",
        "get_chart_data": "chart",
        "get_chart_preview": "chart",
        "update_chart": "chart",
        "generate_chart": "chart",
        "list_dashboards": "dashboard",
        "get_dashboard_info": "dashboard",
        "generate_dashboard": "dashboard",
        "add_chart_to_existing_dashboard": "dashboard",
    }

    async def on_call_tool(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Apply field-level permissions to tool responses."""
        # Get the tool response first
        response = await call_next(context)

        # Get tool name
        tool_name = getattr(context.message, "name", "unknown")

        # Check if this tool needs field-level filtering
        object_type = self.TOOL_OBJECT_TYPE_MAP.get(tool_name)
        if not object_type:
            # No filtering needed
            return response

        # Get current user for permissions
        try:
            user = self._get_current_user()
        except Exception as e:
            logger.warning("Could not get current user for field filtering: %s", e)
            user = None

        # Apply field-level permissions to the response
        try:
            filtered_response = self._filter_response(response, object_type, user)

            # Log field filtering activity for monitoring
            logger.debug(
                "Applied field-level permissions for %s (object_type=%s, user=%s)",
                tool_name,
                object_type,
                getattr(user, "username", "anonymous"),
            )

            return filtered_response

        except Exception as e:
            logger.error("Error applying field permissions to %s: %s", tool_name, e)
            # Return original response if filtering fails
            return response

    def _get_current_user(self) -> Any:
        """Get the current authenticated user."""
        try:
            from flask import g

            return getattr(g, "user", None)
        except Exception:
            # Try to get user from core utils
            try:
                user_id = get_user_id()
                if user_id:
                    from flask_appbuilder.security.sqla.models import User

                    from superset.extensions import db

                    return db.session.query(User).filter_by(id=user_id).first()
            except Exception as e:
                logger.debug("Could not get user from session: %s", e)
                return None

    def _filter_response(self, response: Any, object_type: str, user: Any) -> Any:
        """
        Filter response data based on object type and user permissions.

        Args:
            response: The response object to filter
            object_type: Type of object ('dataset', 'chart', 'dashboard')
            user: User object for permission checking

        Returns:
            Filtered response
        """
        from superset.mcp_service.utils.permissions_utils import filter_sensitive_data

        if not response:
            return response

        # Handle different response types
        if hasattr(response, "model_dump"):
            # Pydantic model - convert to dict, filter, and return dict
            response_dict = response.model_dump()
            return filter_sensitive_data(response_dict, object_type, user)
        elif isinstance(response, dict):
            # Dictionary response - filter directly
            return filter_sensitive_data(response, object_type, user)
        elif isinstance(response, list):
            # List response - filter each item
            return [filter_sensitive_data(item, object_type, user) for item in response]
        else:
            # Unknown response type, return as-is
            logger.debug(
                "Unknown response type for field filtering: %s", type(response)
            )
            return response
