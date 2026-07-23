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
import re
import secrets
import time
from contextvars import ContextVar
from typing import Any, Awaitable, Callable, Sequence

import mcp.types as mt
from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.server.middleware.middleware import CallNext
from fastmcp.tools.tool import Tool, ToolResult
from flask import g
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError, TimeoutError
from starlette.exceptions import HTTPException

from superset.commands.exceptions import (
    CommandInvalidError,
    ForbiddenError,
    ObjectNotFoundError,
)
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.extensions import event_logger, stats_logger_manager
from superset.mcp_service.auth import (
    _get_app_context_manager,
    get_user_from_request,
    is_tool_visible_to_current_user,
    MCPNoAuthSourceError,
    MCPPermissionDeniedError,
)
from superset.mcp_service.constants import (
    DEFAULT_MAX_LIST_ITEMS,
    DEFAULT_TOKEN_LIMIT,
    DEFAULT_WARN_THRESHOLD_PCT,
)
from superset.mcp_service.utils.token_utils import (
    estimate_response_tokens,
    format_size_limit_error,
    INFO_TOOLS,
    truncate_oversized_response,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)
_mcp_call_id_var: ContextVar[str | None] = ContextVar("mcp_call_id", default=None)

# Conservative shape for a tool-name segment embedded in a StatsD metric key.
# Matches registered tool names (snake_case, plus dots for extension-prefixed
# tools) while rejecting StatsD metadata characters and unbounded lengths.
_METRIC_TOOL_NAME_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.\-]{0,127}")


def _sanitize_error_for_logging(error: Exception) -> str:
    """Sanitize error messages to prevent information disclosure in logs."""
    error_str = str(error)

    # SECURITY FIX: Limit error message length FIRST to prevent ReDoS attacks
    if len(error_str) > 500:
        error_str = error_str[:500] + "...[truncated]"

    # SECURITY FIX: Use bounded patterns to prevent ReDoS
    import re

    # Database connection strings - bounded patterns with word boundaries
    # Use case-insensitive flag to handle both cases
    error_str = re.sub(
        r"\bpostgresql://[^@\s]{1,100}@[^/\s]{1,100}/[^\s]{0,100}",
        "postgresql://[REDACTED]@[REDACTED]/[REDACTED]",
        error_str,
        flags=re.IGNORECASE,
    )
    error_str = re.sub(
        r"\bmysql://[^@\s]{1,100}@[^/\s]{1,100}/[^\s]{0,100}",
        "mysql://[REDACTED]@[REDACTED]/[REDACTED]",
        error_str,
        flags=re.IGNORECASE,
    )

    # API keys and tokens - bounded patterns
    error_str = re.sub(
        r"[Aa]pi[_-]?[Kk]ey[:\s]{0,5}[^\s'\"]{1,100}",
        "ApiKey: [REDACTED]",
        error_str,
    )
    error_str = re.sub(
        r"[Tt]oken[:\s]{0,5}[^\s'\"]{1,100}", "Token: [REDACTED]", error_str
    )

    # File paths - bounded pattern
    error_str = re.sub(
        r"/[a-zA-Z0-9_\-/.]{1,200}/superset/", "/[REDACTED]/superset/", error_str
    )

    # Generic database connection URIs (redis, snowflake, bigquery, mssql, etc.)
    error_str = re.sub(
        r"\b\w+://[^@\s]{1,100}@[^/\s]{1,100}/[^\s]{0,100}",
        "[SCHEME]://[REDACTED]@[REDACTED]/[REDACTED]",
        error_str,
        flags=re.IGNORECASE,
    )

    # Email addresses
    error_str = re.sub(
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "[EMAIL-REDACTED]",
        error_str,
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


def _invoke_error_hook(error: Exception, hook_context: dict[str, Any]) -> None:
    """Invoke the operator-configured ``MCP_ERROR_HOOK``, if any.

    Kept vendor-neutral (no ``sentry_sdk`` import here) so the OSS repo has
    no hard dependency on any particular error tracker — operators wire
    their own hook (e.g. calling ``sentry_sdk.capture_exception``) via
    ``MCP_ERROR_HOOK`` in ``superset_config.py``. Hook failures are logged
    and swallowed; they must never affect the MCP response.
    """
    try:
        from superset.mcp_service.flask_singleton import get_flask_app

        hook = get_flask_app().config.get("MCP_ERROR_HOOK")
    except Exception:  # noqa: BLE001
        return
    if hook is None:
        return
    try:
        hook(error, hook_context)
    except Exception as hook_error:  # noqa: BLE001
        logger.warning("MCP_ERROR_HOOK raised an exception: %s", hook_error)


# Errors caused by the LLM/user — expected in normal MCP operation.
# Agents send bad params, try tools they lack access to, request nonexistent
# resources. These are 400-class errors and should be logged at WARNING.
_USER_ERROR_TYPES = (
    ToolError,
    ValidationError,
    PermissionError,
    MCPPermissionDeniedError,
    ValueError,
    FileNotFoundError,
    CommandInvalidError,
    ObjectNotFoundError,
    ForbiddenError,
    SupersetSecurityException,
)


def _is_user_error(error: Exception) -> bool:
    """Classify whether an error is user-caused (WARNING) or system-caused (ERROR).

    User errors are expected in normal MCP operation — agents send bad params,
    try tools they lack access to, request nonexistent resources. These are
    400-class errors and should be logged at WARNING.

    System errors are unexpected — database down, unexpected exceptions,
    infrastructure failures. These are 500-class and should be logged at ERROR.
    """
    if isinstance(error, _USER_ERROR_TYPES):
        return True
    # SupersetException and CommandException have a .status attribute.
    # 4xx = user error, 5xx = system error.
    if isinstance(error, SupersetException):
        return error.status < 500
    # HTTPException: Starlette uses status_code, werkzeug uses code.
    if isinstance(error, HTTPException):
        status = getattr(error, "status_code", getattr(error, "code", 500))
        return status < 500
    return False


_SENSITIVE_PARAM_KEYS = frozenset(
    {
        "password",
        "token",
        "api_key",
        "secret",
        "credentials",
        "authorization",
        "cookie",
    }
)


def _sanitize_params(params: dict[str, Any]) -> dict[str, Any]:
    """Remove sensitive fields from params before logging."""
    if not isinstance(params, dict):
        return params
    result: dict[str, Any] = {}
    for k, v in params.items():
        if k.lower() in _SENSITIVE_PARAM_KEYS:
            result[k] = "[REDACTED]"
        elif k == "arguments" and isinstance(v, dict):
            result[k] = _sanitize_params(v)
        else:
            result[k] = v
    return result


class LoggingMiddleware(Middleware):
    """
    Middleware that logs every MCP message (request and response) using the
    event logger. This matches the core audit log system (Action Log UI,
    logs table, custom loggers). Also attempts to log dashboard_id, chart_id
    (slice_id), and dataset_id if present in tool params.

    Tool calls are handled in on_call_tool() which wraps execution to capture
    duration_ms. Non-tool messages (resource reads, prompts, etc.) are handled
    in on_message().

    When tool search is enabled (progressive discovery), the MCP client calls
    ``call_tool`` proxies instead of individual tools.  This middleware resolves
    the underlying tool name from ``call_tool`` arguments so that analytics
    queries can filter by the actual tool (stored as ``mcp_tool`` in the curated
    payload).
    """

    #: Proxy name used by FastMCP tool-search transforms.
    _CALL_TOOL_PROXY = "call_tool"

    def _is_error_response(self, result: ToolResult) -> bool:
        """Check if a tool result contains an error schema response.

        MCP tools return error schemas (ChartError, DashboardError, etc.)
        instead of raising exceptions. These serialize to JSON containing
        an "error_type" field.
        """
        try:
            return '"error_type"' in result.content[0].text
        except (AttributeError, IndexError):
            return False

    @staticmethod
    def _extract_error_type_from_response(result: ToolResult) -> str | None:
        """Extract the ``error_type`` field from a serialized error response.

        Structured MCP error schemas (ChartError, DashboardError, etc.) embed
        an ``error_type`` string. Parsing it here — instead of discarding it
        after the substring sniff in ``_is_error_response`` — lets it flow
        into the log line, curated payload, and metric tag.
        """
        from superset.utils.json import loads as json_loads

        try:
            text = result.content[0].text
        except (AttributeError, IndexError):
            return None
        try:
            payload = json_loads(text)
        except (ValueError, TypeError):
            return None
        if isinstance(payload, dict):
            error_type = payload.get("error_type")
            if isinstance(error_type, str):
                return error_type
        return None

    def _extract_context_info(
        self, context: MiddlewareContext
    ) -> tuple[
        str | None, int | None, int | None, int | None, int | None, dict[str, Any]
    ]:
        """Extract agent_id, user_id, and entity IDs from context."""
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
        except (RuntimeError, AttributeError):
            user_id = None
        if isinstance(params, dict):
            dashboard_id = params.get("dashboard_id")
            slice_id = params.get("chart_id") or params.get("slice_id")
            dataset_id = params.get("dataset_id")
        return agent_id, user_id, dashboard_id, slice_id, dataset_id, params

    @staticmethod
    def _resolve_tool_name(tool_name: str | None, params: Any) -> str | None:
        """Resolve the underlying tool name from call_tool proxy arguments.

        When tool search is enabled, the MCP client uses the ``call_tool``
        proxy and passes the real tool name as the ``name`` argument.  This
        helper extracts that value so we can log which tool was actually
        executed rather than just ``"call_tool"``.

        Returns:
            The resolved tool name if *tool_name* is the call_tool proxy and
            ``params["name"]`` is a non-empty string, otherwise ``None``.
        """
        if (
            tool_name == LoggingMiddleware._CALL_TOOL_PROXY
            and isinstance(params, dict)
            and isinstance(params.get("name"), str)
            and params["name"]
        ):
            return params["name"]
        return None

    @staticmethod
    async def _resolve_metric_tool_name(
        context: MiddlewareContext,
        tool_name: str | None,
        mcp_tool: str | None,
    ) -> str:
        """Return a StatsD-safe tool segment for the per-tool metric keys.

        Both ``mcp_tool`` (the ``call_tool`` proxy's ``name`` argument) and
        ``tool_name`` (the raw message name) are client-controlled input.
        Using them verbatim in a metric key would let any authenticated
        client mint unbounded metric series or inject StatsD metadata
        characters (``\\n``/``:``/``|``) into the wire format. Only names
        that resolve in the FastMCP tool registry are used; anything else
        falls back to a constant. The raw name still reaches the curated
        payload and log line, which are not StatsD keys.
        """
        candidate = mcp_tool or tool_name
        if not candidate:
            return "unknown"
        try:
            registered = await context.fastmcp_context.fastmcp.get_tool(candidate)
        except (AttributeError, TypeError):
            # No registry reachable from this context (e.g. unit tests with
            # mocked contexts) — accept only conservatively-shaped names.
            if _METRIC_TOOL_NAME_RE.fullmatch(candidate):
                return candidate
            registered = None
        except Exception:  # noqa: BLE001
            # Registry reachable but the lookup failed (NotFoundError in
            # FastMCP versions that raise instead of returning None) —
            # treat as unregistered.
            registered = None
        if registered is not None:
            return candidate
        return "call_tool" if mcp_tool else "unknown"

    async def _emit_call_metrics(
        self,
        context: MiddlewareContext,
        tool_name: str | None,
        mcp_tool: str | None,
        *,
        success: bool,
        raised_is_user_error: bool | None,
        duration_ms: int,
    ) -> None:
        """Emit the per-tool outcome counter and timing for one call.

        Single emission point for the per-tool outcome counters —
        GlobalErrorHandlerMiddleware (inner) re-raises every failure as
        ToolError, so counting there as well would double-count raised
        errors. Mirrors base_api.py's success/warning/error split: raised
        user errors → warning, raised system errors → error. Structured
        error responses (``raised_is_user_error`` is None) carry a
        free-form error_type that cannot be reliably classified, so they
        count as error (the parsed error_type is in the curated payload).
        """
        metric_tool = await self._resolve_metric_tool_name(context, tool_name, mcp_tool)
        if success:
            outcome = "success"
        elif raised_is_user_error:
            outcome = "warning"
        else:
            outcome = "error"
        stats_logger_manager.instance.incr(f"mcp.tool.{metric_tool}.{outcome}")
        stats_logger_manager.instance.timing(
            f"mcp.tool.{metric_tool}.time", duration_ms
        )

    async def on_call_tool(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Log tool calls with duration tracking."""
        agent_id, user_id, dashboard_id, slice_id, dataset_id, params = (
            self._extract_context_info(context)
        )
        tool_name = getattr(context.message, "name", None)
        mcp_tool = self._resolve_tool_name(tool_name, params)

        mcp_call_id = secrets.token_hex(16)
        _mcp_call_id_var.set(mcp_call_id)
        start_time = time.time()
        success = False
        error_type: str | None = None
        raised_is_user_error: bool | None = None
        try:
            result = await call_next(context)
            success = not self._is_error_response(result)
            if not success and isinstance(result, ToolResult):
                error_type = self._extract_error_type_from_response(result)
            if isinstance(result, ToolResult):
                existing_meta = result.meta or {}
                result = ToolResult(
                    content=result.content,
                    meta={**existing_meta, "mcp_call_id": mcp_call_id},
                    structured_content=result.structured_content,
                )
            return result
        except Exception as exc:
            # GlobalErrorHandlerMiddleware (inner) wraps tool exceptions in
            # ToolError with the original attached as __cause__; unwrap it so
            # error_type and the user/system classification reflect the real
            # failure rather than the ToolError wrapper.
            original = (
                exc.__cause__
                if isinstance(exc, ToolError) and exc.__cause__ is not None
                else exc
            )
            error_type = type(original).__name__
            raised_is_user_error = _is_user_error(original)
            success = False
            raise
        finally:
            duration_ms = int((time.time() - start_time) * 1000)
            payload: dict[str, Any] = {
                "mcp_call_id": mcp_call_id,
                "tool": tool_name,
                "agent_id": agent_id,
                "params": _sanitize_params(params),
                "method": context.method,
                "dashboard_id": dashboard_id,
                "slice_id": slice_id,
                "dataset_id": dataset_id,
                "success": success,
            }
            if mcp_tool is not None:
                payload["mcp_tool"] = mcp_tool
            if error_type is not None:
                payload["error_type"] = error_type
            try:
                with _get_app_context_manager():
                    event_logger.log(
                        user_id=user_id,
                        action="mcp_tool_call",
                        dashboard_id=dashboard_id,
                        duration_ms=duration_ms,
                        slice_id=slice_id,
                        referrer=None,
                        curated_payload=payload,
                    )
            except Exception as log_error:  # noqa: BLE001
                # A failing event logger (custom EVENT_LOGGER, app-context
                # setup error) must not mask the tool's real exception or
                # skip the metrics/log line below.
                logger.warning("Failed to log mcp_tool_call event: %s", log_error)
            extra_parts = []
            if mcp_tool is not None:
                extra_parts.append(f"mcp_tool={mcp_tool}")
            if error_type is not None:
                extra_parts.append(f"error_type={error_type}")
            extra = (", " + ", ".join(extra_parts)) if extra_parts else ""
            logger.info(
                "MCP tool call: tool=%s, agent_id=%s, user_id=%s, method=%s, "
                "dashboard_id=%s, slice_id=%s, dataset_id=%s, duration_ms=%s, "
                "success=%s, mcp_call_id=%s%s",
                tool_name,
                agent_id,
                user_id,
                context.method,
                dashboard_id,
                slice_id,
                dataset_id,
                duration_ms,
                success,
                mcp_call_id,
                extra,
            )
            try:
                await self._emit_call_metrics(
                    context,
                    tool_name,
                    mcp_tool,
                    success=success,
                    raised_is_user_error=raised_is_user_error,
                    duration_ms=duration_ms,
                )
            except Exception as metrics_error:  # noqa: BLE001
                # A failing stats backend must never mask the tool's real
                # result or exception — metrics are a side effect only.
                logger.warning("Failed to emit MCP tool metrics: %s", metrics_error)

    async def on_message(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Log non-tool messages (resource reads, prompts, etc.)."""
        agent_id, user_id, dashboard_id, slice_id, dataset_id, params = (
            self._extract_context_info(context)
        )
        try:
            with _get_app_context_manager():
                event_logger.log(
                    user_id=user_id,
                    action="mcp_message",
                    dashboard_id=dashboard_id,
                    duration_ms=None,
                    slice_id=slice_id,
                    referrer=None,
                    curated_payload={
                        "tool": getattr(context.message, "name", None),
                        "agent_id": agent_id,
                        "params": _sanitize_params(params),
                        "method": context.method,
                        "dashboard_id": dashboard_id,
                        "slice_id": slice_id,
                        "dataset_id": dataset_id,
                    },
                )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log mcp_message event: %s", log_error)
        logger.info(
            "MCP message: tool=%s, agent_id=%s, user_id=%s, method=%s",
            getattr(context.message, "name", None),
            agent_id,
            user_id,
            context.method,
        )
        return await call_next(context)


class StructuredContentStripperMiddleware(Middleware):
    """Strip ``outputSchema`` and ``structured_content`` to prevent encoding errors.

    FastMCP 3.x auto-generates ``outputSchema`` in tool definitions
    (``tools/list``) and ``structuredContent`` in tool call responses
    (``tools/call``) when the tool has a typed return annotation.

    Some MCP client transports (e.g. Claude.ai's MCP bridge) cannot handle
    ``structuredContent`` dicts, causing ``TypeError: encoding without a
    string argument``.  Additionally, if ``outputSchema`` is advertised but
    ``structuredContent`` is stripped from the response, clients may raise
    ``Output validation error: outputSchema defined but no structured output
    returned``.

    This middleware handles both sides:
    - ``on_list_tools``: removes ``output_schema`` from every tool definition
    - ``on_call_tool``: removes ``structured_content`` from every tool result
    """

    async def on_list_tools(
        self,
        context: MiddlewareContext[mt.ListToolsRequest],
        call_next: CallNext[mt.ListToolsRequest, Sequence[Tool]],
    ) -> Sequence[Tool]:
        try:
            tools = await call_next(context)
        except Exception:
            # ToolError raised by inner middleware (e.g. GlobalErrorHandlerMiddleware)
            # cannot be encoded by the MCP SDK in a tools/list response — it expects a
            # list, not an error object — causing "encoding without a string argument".
            # Return an empty list; GlobalErrorHandlerMiddleware already logged it.
            return []
        return [
            t.model_copy(update={"output_schema": None})
            if t.output_schema is not None
            else t
            for t in tools
        ]

    async def on_call_tool(
        self,
        context: MiddlewareContext[mt.CallToolRequestParams],
        call_next: Callable[[MiddlewareContext], Awaitable[ToolResult]],
    ) -> ToolResult:
        try:
            result = await call_next(context)
        except Exception as e:
            # When exceptions propagate past the middleware chain to the
            # MCP SDK layer, they become CallToolResult(isError=True).
            # Some transports (Claude.ai's MCP bridge) cannot encode these
            # error responses, producing "encoding without a string argument".
            # Catch ALL exceptions (not just specific types) because any
            # unhandled exception — including ToolError from
            # GlobalErrorHandlerMiddleware, ValueError, TypeError, etc. —
            # will cause encoding failures on the wire.
            mcp_call_id = _mcp_call_id_var.get(None)
            # This is the documented "must never propagate" point, but
            # formatting/sanitizing both call str(e) — a pathological
            # __str__ would make this handler itself raise past the
            # middleware chain. Fall back to the exception class name.
            try:
                error_text = f"Error: {e}"
                sanitized_message = _sanitize_error_for_logging(e)
            except Exception:  # noqa: BLE001
                error_text = f"Error: {type(e).__name__}"
                sanitized_message = type(e).__name__
            if not isinstance(e, ToolError):
                # GlobalErrorHandlerMiddleware converts every exception it
                # sees into ToolError (and already invokes MCP_ERROR_HOOK
                # for system-class errors there). A non-ToolError reaching
                # this final catch means it slipped past that handler
                # entirely — invoke the hook here as the true last-resort
                # capture point. All contract keys are populated so hooks
                # can index them unconditionally; user_id and duration_ms
                # are unknown at this layer and passed as None.
                _invoke_error_hook(
                    e,
                    {
                        "tool_name": getattr(context.message, "name", "unknown"),
                        "mcp_call_id": mcp_call_id,
                        "user_id": None,
                        "error_type": type(e).__name__,
                        "sanitized_message": sanitized_message,
                        "duration_ms": None,
                    },
                )
            return ToolResult(
                content=[mt.TextContent(type="text", text=error_text)],
                meta={"mcp_call_id": mcp_call_id} if mcp_call_id else None,
            )
        if isinstance(result, ToolResult) and result.structured_content is not None:
            result = ToolResult(content=result.content, meta=result.meta)
        return result


class RBACToolVisibilityMiddleware(Middleware):
    """Filter tools/list response based on current user's RBAC permissions.

    Intercepts every ``tools/list`` request and removes tools the calling user
    is not permitted to execute. Public tools (no ``class_permission_name``) and
    tools whose permission check passes are included; all others are hidden.

    Fail-open vs fail-closed behaviour:
    - No auth context at all (no Flask context, no auth header, no dev user
      configured) → fail open (return all tools). Call-time RBAC enforces.
    - Auth was attempted but credentials are invalid (bad API key, dev
      username not in DB, etc.) → fail closed (return empty list).
    - Unexpected errors → fail open. Call-time RBAC still enforces.
    """

    async def on_list_tools(
        self,
        context: MiddlewareContext[mt.ListToolsRequest],
        call_next: CallNext[mt.ListToolsRequest, list[Tool]],
    ) -> list[Tool]:
        tools = await call_next(context)

        try:
            with _get_app_context_manager():
                # Use get_user_from_request directly rather than
                # _setup_user_context, which carries per-call execution
                # overhead (retry loop, session management, error logging)
                # that is unnecessary and noisy during tools/list.
                try:
                    user = get_user_from_request()
                except ValueError as exc:
                    if isinstance(exc, MCPNoAuthSourceError):
                        # No auth source configured at all → fail open.
                        # No log: this is expected in dev/internal deployments.
                        return tools
                    # Auth was attempted (e.g. MCP_DEV_USERNAME set) but the
                    # user was not found in the DB → fail closed
                    logger.warning(
                        "MCP tool list: credential failure, hiding all tools: %s",
                        exc,
                    )
                    return []
                except PermissionError as exc:
                    # API key present but invalid/expired → fail closed
                    logger.warning(
                        "MCP tool list: credential failure, hiding all tools: %s",
                        exc,
                    )
                    return []

                if user is None:
                    return tools  # no Flask app context → fail open
                g.user = user
                return [t for t in tools if is_tool_visible_to_current_user(t)]
        except Exception:  # noqa: BLE001
            # Unexpected setup errors (ImportError, etc.) → fail open.
            # Call-time RBAC still enforces permissions.
            return tools


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

        # Log with appropriate level: user errors (expected) → WARNING,
        # system errors (unexpected) → ERROR
        sanitized_error = _sanitize_error_for_logging(error)
        is_user = _is_user_error(error)
        log_fn = logger.warning if is_user else logger.error
        log_fn(
            "MCP tool call failed: tool=%s, user_id=%s, "
            "duration_ms=%s, error_type=%s, error=%s",
            tool_name,
            user_id,
            duration_ms,
            type(error).__name__,
            sanitized_error,
            exc_info=not is_user,
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
                    "error_message": sanitized_error,
                    "method": context.method,
                    "severity": "warning" if is_user else "error",
                },
            )
        except Exception as log_error:
            logger.warning("Failed to log error event: %s", log_error)

        # No stats emission here: this handler re-raises every failure as
        # ToolError, which the outer LoggingMiddleware catches and counts
        # (with the user/system classification recovered via __cause__).
        # Emitting a counter here as well would double-count raised errors.

        mcp_call_id = _mcp_call_id_var.get(None)
        if not is_user:
            # System-class errors only — user errors (bad params, permission
            # denials) are expected MCP traffic and would otherwise flood an
            # error tracker.
            _invoke_error_hook(
                error,
                {
                    "tool_name": tool_name,
                    "mcp_call_id": mcp_call_id,
                    "user_id": user_id,
                    "error_type": type(error).__name__,
                    "sanitized_message": sanitized_error,
                    "duration_ms": duration_ms,
                },
            )

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
        elif isinstance(error, MCPPermissionDeniedError):
            # MCP RBAC permission denied — convert to structured ToolError.
            # Must come before the generic PermissionError branch because
            # MCPPermissionDeniedError inherits from PermissionError.
            raise ToolError(str(error)) from error
        elif isinstance(error, PermissionError):
            # Permission/authorization errors
            raise ToolError(
                f"Permission denied for {tool_name}: "
                f"You don't have access to this resource."
            ) from error
        elif isinstance(error, ValueError):
            # Value/parameter errors from tool code
            raise ToolError(
                f"Invalid parameter in {tool_name}: {str(error)}"
            ) from error
        elif isinstance(error, (ObjectNotFoundError, CommandInvalidError)):
            # Superset command: not found (404) or validation (422)
            raise ToolError(
                f"Invalid request for {tool_name}: {_sanitize_error_for_logging(error)}"
            ) from error
        elif isinstance(error, (ForbiddenError, SupersetSecurityException)):
            # Superset access denied — agent tried a tool it can't use
            raise ToolError(
                f"Permission denied for {tool_name}: "
                f"{_sanitize_error_for_logging(error)}"
            ) from error
        elif isinstance(error, SupersetException):
            # Other Superset errors — .status determines severity (already
            # classified by _is_user_error above for log level)
            msg = "Invalid request" if error.status < 500 else "Internal error"
            raise ToolError(
                f"{msg} in {tool_name}: {_sanitize_error_for_logging(error)}"
            ) from error
        elif isinstance(error, ConnectionError):
            # Network errors — transient, expected during pod restarts
            # (ConnectionRefusedError, ConnectionResetError, BrokenPipeError
            # are all subclasses of ConnectionError)
            raise ToolError(
                f"Connection error in {tool_name}: {_sanitize_error_for_logging(error)}"
            ) from error
        else:
            # Generic internal errors — truly unexpected. Reuse the per-call
            # mcp_call_id (set by LoggingMiddleware.on_call_tool) instead of a
            # second-granularity timestamp, which collides under concurrent
            # failures.
            error_id = mcp_call_id or f"err_{secrets.token_hex(8)}"
            logger.error("Unexpected error [%s] in %s: %s", error_id, tool_name, error)

            raise ToolError(
                f"Internal error in {tool_name}: An unexpected error occurred. "
                f"Error ID: {error_id}. Please contact support if this persists."
            ) from error


class ResponseSizeGuardMiddleware(Middleware):
    """
    Middleware that prevents oversized responses from overwhelming LLM clients.

    When a tool response exceeds the configured token limit, this middleware
    intercepts it and returns a helpful error message with suggestions for
    reducing the response size.

    This is critical for protecting LLM clients like Claude Desktop which can
    crash or become unresponsive when receiving extremely large responses.

    Configuration via MCP_RESPONSE_SIZE_CONFIG in superset_config.py:
    - enabled: Toggle the guard on/off (default: True)
    - token_limit: Maximum estimated tokens per response (default: 25,000)
    - warn_threshold_pct: Log warnings above this % of limit (default: 80%)
    - max_list_items: Cap for list fields during dynamic truncation (default: 100)
    - excluded_tools: Tools to skip checking
    """

    def __init__(
        self,
        token_limit: int = DEFAULT_TOKEN_LIMIT,
        warn_threshold_pct: int = DEFAULT_WARN_THRESHOLD_PCT,
        excluded_tools: list[str] | str | None = None,
        max_list_items: int = DEFAULT_MAX_LIST_ITEMS,
    ) -> None:
        self.token_limit = token_limit
        self.warn_threshold_pct = warn_threshold_pct
        self.warn_threshold = int(token_limit * warn_threshold_pct / 100)
        if isinstance(excluded_tools, str):
            excluded_tools = [excluded_tools]
        self.excluded_tools = set(excluded_tools or [])
        self.max_list_items = max(1, max_list_items)

    @staticmethod
    def _extract_payload_from_tool_result(
        response: Any,
    ) -> dict[str, Any] | None:
        """Extract the JSON payload dict from a ToolResult's content[0].text.

        FastMCP converts tool return values into ToolResult before middleware
        sees them.  The actual data (e.g. DashboardInfo dict) is serialized
        as a JSON string inside ``content[0].text``.  Truncation must operate
        on that parsed dict — not on the ToolResult wrapper — otherwise
        phases like "truncate charts list" never find the right keys.

        Returns the payload dict when extraction succeeds, or ``None`` when
        the response is not a ToolResult or cannot be parsed.
        """
        from fastmcp.tools.tool import ToolResult

        from superset.utils.json import loads as json_loads

        if not isinstance(response, ToolResult):
            return None

        if (
            not response.content
            or not hasattr(response.content[0], "text")
            or not response.content[0].text
        ):
            return None

        try:
            payload = json_loads(response.content[0].text)
        except (ValueError, TypeError):
            return None

        if not isinstance(payload, dict):
            return None

        return payload

    @staticmethod
    def _rewrap_as_tool_result(payload: dict[str, Any], original: Any) -> Any:
        """Re-serialize a truncated payload dict back into a ToolResult."""
        from fastmcp.tools.tool import ToolResult
        from mcp.types import TextContent

        from superset.utils.json import dumps as json_dumps

        text = json_dumps(payload)
        return ToolResult(
            content=[TextContent(type="text", text=text)],
            meta=original.meta if isinstance(original, ToolResult) else None,
        )

    def _try_truncate_info_response(
        self,
        tool_name: str,
        response: Any,
        estimated_tokens: int,
    ) -> Any | None:
        """Attempt to dynamically truncate an info tool response to fit the limit.

        Returns the truncated response if successful, None otherwise.

        When the response is a ToolResult (the normal case — FastMCP wraps
        every tool return value), the actual data lives inside
        ``content[0].text`` as a JSON string.  We parse that string, run the
        truncation phases on the resulting dict, then re-wrap the result.
        """
        # Unwrap ToolResult so truncation operates on the real payload
        extracted = self._extract_payload_from_tool_result(response)
        if extracted is not None:
            truncation_target = extracted
        else:
            logger.debug(
                "Could not extract dict payload from response for %s; "
                "falling back to truncating the raw response object",
                tool_name,
            )
            truncation_target = response

        try:
            truncated, was_truncated, notes = truncate_oversized_response(
                truncation_target,
                self.token_limit,
                max_list_items=self.max_list_items,
            )
        except (MemoryError, RecursionError) as trunc_error:
            logger.warning(
                "Truncation failed for %s due to %s: %s",
                tool_name,
                type(trunc_error).__name__,
                trunc_error,
            )
            return None

        if not was_truncated:
            return None

        truncated_tokens = estimate_response_tokens(truncated)
        if truncated_tokens > self.token_limit:
            return None

        logger.warning(
            "Response for %s truncated from ~%d to ~%d tokens (limit: %d). Fields: %s",
            tool_name,
            estimated_tokens,
            truncated_tokens,
            self.token_limit,
            "; ".join(notes),
        )

        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_truncated",
                curated_payload={
                    "tool": tool_name,
                    "original_tokens": estimated_tokens,
                    "truncated_tokens": truncated_tokens,
                    "token_limit": self.token_limit,
                    "truncation_notes": notes,
                },
            )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log truncation event: %s", log_error)

        if isinstance(truncated, dict):
            truncated["_response_truncated"] = True
            truncated["_truncation_notes"] = notes

        # Re-wrap into ToolResult if we unwrapped one
        if extracted is not None and isinstance(truncated, dict):
            return self._rewrap_as_tool_result(truncated, response)

        return truncated

    async def on_call_tool(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Check response size after tool execution."""
        tool_name = getattr(context.message, "name", "unknown")

        # Skip excluded tools
        if tool_name in self.excluded_tools:
            return await call_next(context)

        # Execute the tool
        response = await call_next(context)

        # When the response is a ToolResult, estimate tokens on the actual
        # payload inside content[0].text rather than on the ToolResult
        # wrapper (which would double-serialize the JSON string).
        extracted = self._extract_payload_from_tool_result(response)
        estimation_target = extracted if extracted is not None else response

        try:
            estimated_tokens = estimate_response_tokens(estimation_target)
        except MemoryError as me:
            logger.warning(
                "MemoryError while estimating tokens for %s: %s", tool_name, me
            )
            # Treat as over limit to avoid further serialization
            estimated_tokens = self.token_limit + 1
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "Failed to estimate response tokens for %s: %s", tool_name, e
            )
            # Conservative fallback: block rather than risk OOM
            estimated_tokens = self.token_limit + 1

        # Log warning if approaching limit
        if estimated_tokens > self.warn_threshold:
            logger.warning(
                "Response size warning for %s: ~%d tokens (%.0f%% of %d limit)",
                tool_name,
                estimated_tokens,
                (estimated_tokens / self.token_limit * 100) if self.token_limit else 0,
                self.token_limit,
            )

        # Block if over limit
        if estimated_tokens > self.token_limit:
            params = getattr(context.message, "params", {}) or {}

            # For info tools, try dynamic truncation before blocking
            if tool_name in INFO_TOOLS:
                truncated = self._try_truncate_info_response(
                    tool_name, response, estimated_tokens
                )
                if truncated is not None:
                    return truncated

            # Log the blocked response (user-caused: requested too much data)
            logger.warning(
                "Response blocked for %s: ~%d tokens exceeds limit of %d",
                tool_name,
                estimated_tokens,
                self.token_limit,
            )

            # Log to event logger for monitoring
            try:
                user_id = get_user_id()
                event_logger.log(
                    user_id=user_id,
                    action="mcp_response_size_exceeded",
                    curated_payload={
                        "tool": tool_name,
                        "estimated_tokens": estimated_tokens,
                        "token_limit": self.token_limit,
                        "params": _sanitize_params(params),
                    },
                )
            except Exception as log_error:  # noqa: BLE001
                logger.warning("Failed to log size exceeded event: %s", log_error)

            error_message = format_size_limit_error(
                tool_name=tool_name,
                params=params,
                estimated_tokens=estimated_tokens,
                token_limit=self.token_limit,
                response=None,
            )

            raise ToolError(error_message)

        return response


def _safe_int_config(config: dict[str, Any], key: str, default: int) -> int:
    """Best-effort int coercion for MCP_RESPONSE_SIZE_CONFIG values.

    Falls back to ``default`` (with a warning log) when the configured value
    can't be converted to an int, so a malformed ``superset_config.py``
    setting doesn't crash middleware initialization.
    """
    value = config.get(key, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid %s in MCP_RESPONSE_SIZE_CONFIG: %r is not a valid integer; "
            "falling back to default %d",
            key,
            value,
            default,
        )
        return default


def create_response_size_guard_middleware() -> ResponseSizeGuardMiddleware | None:
    """
    Factory function to create ResponseSizeGuardMiddleware from config.

    Reads configuration from Flask app's MCP_RESPONSE_SIZE_CONFIG.
    Returns None if the guard is disabled.

    Returns:
        ResponseSizeGuardMiddleware instance or None if disabled
    """
    try:
        from superset.mcp_service.flask_singleton import get_flask_app
        from superset.mcp_service.mcp_config import MCP_RESPONSE_SIZE_CONFIG

        flask_app = get_flask_app()

        # Get config from Flask app, falling back to defaults
        config = flask_app.config.get(
            "MCP_RESPONSE_SIZE_CONFIG", MCP_RESPONSE_SIZE_CONFIG
        )

        if not config.get("enabled", True):
            logger.info("Response size guard is disabled")
            return None

        max_list_items: int = _safe_int_config(
            config, "max_list_items", DEFAULT_MAX_LIST_ITEMS
        )

        middleware = ResponseSizeGuardMiddleware(
            token_limit=_safe_int_config(config, "token_limit", DEFAULT_TOKEN_LIMIT),
            warn_threshold_pct=_safe_int_config(
                config, "warn_threshold_pct", DEFAULT_WARN_THRESHOLD_PCT
            ),
            excluded_tools=config.get("excluded_tools"),
            max_list_items=max_list_items,
        )

        logger.info(
            "Created ResponseSizeGuardMiddleware with token_limit=%d",
            middleware.token_limit,
        )
        return middleware

    except (ImportError, AttributeError, KeyError) as e:
        logger.error("Failed to create ResponseSizeGuardMiddleware: %s", e)
        return None
