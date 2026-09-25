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

import asyncio
import logging
import re
import secrets
import time
import warnings
from contextvars import ContextVar
from typing import Any, Awaitable, Callable, Sequence

import mcp.types as mt
from fastmcp.exceptions import ToolError, ValidationError as FastMCPValidationError
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
from superset.errors import SupersetErrorType
from superset.exceptions import (
    ColumnNotFoundException,
    DatabaseNotFound,
    SupersetErrorsException,
    SupersetException,
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.extensions import event_logger, stats_logger_manager
from superset.mcp_service.auth import (
    _get_app_context_manager,
    _mcp_user_id_var,
    get_user_from_request,
    is_tool_visible_to_current_user,
    MCPNoAuthSourceError,
    MCPPermissionDeniedError,
)
from superset.mcp_service.constants import (
    CONNECTION_ERROR_TYPES,
    DEFAULT_MAX_LIST_ITEMS,
    DEFAULT_MAX_RESPONSE_BYTES,
    DEFAULT_WARN_THRESHOLD_PCT,
)
from superset.mcp_service.utils.response_size_utils import (
    COMMITTED_WRITE_SPECS,
    COMMITTED_WRITE_TOOLS,
    CommittedWriteSpec,
    DATA_QUERY_TOOLS,
    format_size_limit_error,
    get_response_size_bytes,
    INFO_TOOLS,
    string_clip_chars,
    STRING_FIELD_TRUNCATION_TOOLS,
    truncate_oversized_response,
    truncate_query_result,
    truncate_string_field_response,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)
_mcp_call_id_var: ContextVar[str | None] = ContextVar("mcp_call_id", default=None)

# Conservative shape for a tool-name segment embedded in a StatsD metric key.
# Matches registered tool names (snake_case, plus dots for extension-prefixed
# tools) while rejecting StatsD metadata characters and unbounded lengths.
_METRIC_TOOL_NAME_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.\-]{0,127}")

# Character cap for the free-form string fields kept in a minimal committed-write
# confirmation (see ``_shrink_minimal_response``). Generous enough to keep a
# chart name or a short error readable, small enough that the whole confirmation
# stays bounded no matter how large the fields were in the original payload.
# Small byte budgets lower it further (see ``string_clip_chars``).
_MINIMAL_FIELD_CHARS = 200

# Bound both list overhead and total string content in write confirmations.
_MINIMAL_LIST_ITEMS = 20

# Identifying fields kept when a structured ``error`` has to be reduced to fit
# (see ``_clip_error``). Everything else on ``MCPBaseError`` and its subclasses
# is an unbounded container -- ``validation_errors``, ``dataset_context``,
# ``query_info``, ``suggestions`` -- any of which can dwarf the write
# confirmation it is riding on. ``error`` mirrors ``message`` as a
# backward-compatible alias, so both are kept.
_MINIMAL_ERROR_FIELDS = ("error_type", "error", "message", "error_code", "details")

# Scalar fields kept when a committed write's identifying object (a nested
# ``chart``/``dashboard``/``metric`` dict) has to be reduced to fit. These are
# the names across the info models that answer "what was written" --
# everything else on them is either unbounded or irrelevant to that question.
# ``is_unsaved_state`` is here because update_chart defaults to
# ``generate_preview=True`` and then persists nothing, so it is the caller's
# only in-band way to tell a cached preview from a persisted write.
_MINIMAL_IDENTITY_FIELDS = (
    "id",
    "uuid",
    "url",
    "slice_name",
    "dashboard_title",
    "metric_name",
    "table_name",
    "dataset_name",
    "label",
    "is_unsaved_state",
)


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
    elif isinstance(error, (ValidationError, FastMCPValidationError)):
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


# The prefix FastMCP puts on every ToolError it wraps a tool exception in.
# Pinned by a guard test so an upstream change surfaces as a clear failure
# rather than silently reinstating the undifferentiated-error bug.
_FASTMCP_WRAPPED_ERROR_PREFIX = "Error calling tool "


def _unwrap_tool_error(error: Exception) -> Exception:
    """Return the exception a ``ToolError`` was raised from, if any.

    A tool failure is wrapped twice on its way out: FastMCP wraps whatever the
    tool body raised, and :class:`GlobalErrorHandlerMiddleware` re-raises its
    classified message as a fresh ``ToolError`` chained off the same cause.
    Either way the real failure is the ``__cause__``.

    This is for *classification only* — log severity, metrics, and
    error-tracker capture — where attributing a failure to the wrapper rather
    than to ``OperationalError`` or ``MCPPermissionDeniedError`` loses the
    distinction that matters. It does not decide client-facing text; use
    :func:`_unwrap_fastmcp_wrapped_error` for that.
    """
    if isinstance(error, ToolError) and isinstance(error.__cause__, Exception):
        return error.__cause__
    return error


def _unwrap_fastmcp_wrapped_error(error: Exception) -> Exception:
    """Return the original exception behind *FastMCP's* ``ToolError`` wrapper.

    FastMCP catches every non-``FastMCPError`` raised inside a tool body and
    re-raises it as ``ToolError(f"Error calling tool {name!r}: {e}") from e``
    *before* any middleware error hook runs (see ``FastMCP._call_tool``). By
    the time :class:`GlobalErrorHandlerMiddleware` sees a tool failure, the
    concrete type — ``MCPPermissionDeniedError``, ``SupersetException``,
    ``OperationalError`` — is no longer the exception itself, only its
    ``__cause__``. Classifying the wrapper instead of the cause collapses
    every distinct failure into one undifferentiated message.

    A ``ToolError`` raised deliberately by tool code is already formatted for
    MCP and is returned as-is. Tool code may legitimately chain one off
    another exception (``raise ToolError(...) from exc``), so ``__cause__``
    alone does not identify FastMCP's wrapper — the message prefix is
    required as well, otherwise a tool-authored message would be discarded
    and replaced by cause-based handling.
    """
    if (
        isinstance(error, ToolError)
        and isinstance(error.__cause__, Exception)
        and str(error).startswith(_FASTMCP_WRAPPED_ERROR_PREFIX)
    ):
        return error.__cause__
    return error


# Exception classes that mean "the query behind this tool failed", not "the
# caller used the tool wrong". The tool name and arguments were valid; the
# datasource, table, column, or connection it reads is broken or gone.
#
# Deliberately narrow: only classes that are datasource-scoped *by definition*
# and that do not reliably carry a recognisable ``SupersetErrorType``. Broader
# classes are matched by error type instead (see _DATASOURCE_ERROR_TYPES),
# because the class alone does not establish that the datasource is at fault:
#
# - ``SQLAlchemyError`` also covers metadata-database IntegrityError /
#   ProgrammingError raised while a tool reads Superset's own metastore.
# - ``SupersetTimeoutException`` is the generic timeout class; SigalrmTimeout
#   and TimerTimeout raise it with BACKEND_TIMEOUT_ERROR.
# - ``QueryObjectValidationError`` is raised for missing/invalid query fields
#   and invalid result types, which are caller or configuration problems.
#
# Misclassifying any of those would tell the caller their arguments were valid
# and blame a datasource that is in fact healthy.
_DATASOURCE_ERROR_EXCEPTIONS = (
    ColumnNotFoundException,
    DatabaseNotFound,
    SupersetGenericDBErrorException,
)

# ``SupersetError.error_type`` values in the DB-engine, viz, and SQL Lab
# families. Superset raises a bare ``SupersetErrorException`` for many of
# these, so the exception class alone is not enough to classify them. The
# connection half comes from the shared CONNECTION_ERROR_TYPES set so this
# cannot drift out of sync with chart compilation's view of the same thing.
_DATASOURCE_ERROR_TYPES = (
    frozenset(
        {
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
            SupersetErrorType.FAILED_FETCHING_DATASOURCE_INFO_ERROR,
            SupersetErrorType.INVALID_SQL_ERROR,
            SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.RESULTS_BACKEND_ERROR,
            SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
            SupersetErrorType.SYNTAX_ERROR,
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            SupersetErrorType.TABLE_NOT_FOUND_ERROR,
            SupersetErrorType.UNKNOWN_DATASOURCE_TYPE_ERROR,
            SupersetErrorType.VIZ_GET_DF_ERROR,
        }
    )
    | CONNECTION_ERROR_TYPES
)

# Surfaced when a datasource failure carries no recognised SupersetErrorType.
# A fixed sentinel, never a Python class name: the reason is part of the
# client-facing message and must stay a closed, non-sensitive vocabulary.
_GENERIC_DATASOURCE_REASON = "DATASOURCE_QUERY_FAILED"

# Reasons where the *query* is at fault, not the datasource. For a
# SQL-authoring tool the query text is itself an argument, so telling the
# caller "your arguments were valid" would steer an agent away from fixing
# its own malformed SQL.
_QUERY_SYNTAX_REASONS = frozenset(
    {
        SupersetErrorType.INVALID_SQL_ERROR.value,
        SupersetErrorType.SYNTAX_ERROR.value,
    }
)

# Reasons that mean the connection to the analytics database is unhealthy —
# an operational problem worth paging on, unlike a missing table.
_CONNECTION_REASONS = frozenset(t.value for t in CONNECTION_ERROR_TYPES)


def _datasource_error_reason(error: Exception) -> str | None:
    """Return the enumerated reason for a datasource failure, if any.

    Only ``SupersetErrorType`` members are returned — they are a closed,
    non-sensitive vocabulary. Raw driver output (which can carry SQL, table
    contents, or connection strings) is never surfaced from here.
    """
    errors = getattr(error, "errors", None)
    single_error = getattr(error, "error", None)
    if isinstance(error, SupersetErrorsException) and errors:
        # SupersetErrorsException carries a list of SupersetError. Scan all of
        # them, not just the first: a datasource failure reported alongside
        # other errors would otherwise lose its specific reason.
        candidates = [getattr(err, "error_type", None) for err in errors]
    elif single_error is not None:
        # SupersetErrorException carries a single SupersetError.
        candidates = [getattr(single_error, "error_type", None)]
    else:
        # Plain SupersetException exposes error_type directly.
        candidates = [getattr(error, "error_type", None)]
    for error_type in candidates:
        if error_type in _DATASOURCE_ERROR_TYPES:
            return str(getattr(error_type, "value", error_type))
    return None


def _is_datasource_error(error: Exception) -> bool:
    """Classify a failure as coming from the datasource behind the tool.

    ``SupersetSecurityException`` subclasses ``SupersetErrorException``, so
    callers must check for permission failures *before* calling this.
    """
    return (
        isinstance(error, _DATASOURCE_ERROR_EXCEPTIONS)
        or _datasource_error_reason(error) is not None
    )


def _datasource_error_is_user_error(error: Exception) -> bool | None:
    """Severity for a datasource failure; ``None`` if it is not one.

    :func:`_is_user_error` keys on ``SupersetException.status``, but Superset
    raises a *bare* ``SupersetErrorException`` for most datasource failures,
    and that does not override ``SupersetException.status = 500``. A dropped
    table therefore logs at ERROR with a traceback and fires
    ``MCP_ERROR_HOOK``, paging on what is routine MCP traffic — an agent
    pointing at a chart whose table was renamed.

    Classify by what actually failed instead of by an inherited default: an
    unreachable or misconfigured *connection* is an operational problem worth
    paging on; a missing table, column, or schema is not.

    This only ever *de-escalates*. A sub-500 status is a deliberate judgement
    by the exception class that the caller is at fault, and is never
    overridden — otherwise the connection half of the allow-list would page
    on exactly the errors this function exists to stop paging on. The
    catch-all ``GENERIC_DB_ENGINE_ERROR`` makes that concrete: engines
    without specific ``CONNECTION_*`` regexes (BigQuery, Snowflake, Athena,
    Databricks, Trino) report a malformed adhoc column through it, carried by
    a status-400 ``SupersetGenericDBErrorException``. Genuine connection
    failures arrive as a bare status-500 ``SupersetErrorException`` and still
    page.

    Returns ``None`` when no recognised reason is available, leaving the
    existing status-based judgement in place.
    """
    reason = _datasource_error_reason(error)
    if reason is None:
        return None
    if getattr(error, "status", 500) < 500:
        return True
    return reason not in _CONNECTION_REASONS


# Errors caused by the LLM/user — expected in normal MCP operation.
# Agents send bad params, try tools they lack access to, request nonexistent
# resources. These are 400-class errors and should be logged at WARNING.
_USER_ERROR_TYPES = (
    ToolError,
    ValidationError,
    FastMCPValidationError,
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


def _sanitize_value(value: Any) -> Any:
    """Apply ``_sanitize_params`` recursively to any dict/list container."""
    if isinstance(value, dict):
        return _sanitize_params(value)
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    return value


def _sanitize_params(params: dict[str, Any]) -> dict[str, Any]:
    """Remove sensitive fields from params before logging.

    Recurses into nested containers, including lists of lists, so sensitive
    keys are redacted no matter which wrapper they arrive under
    (``arguments``, ``request``, etc.).
    """
    if not isinstance(params, dict):
        return params
    result: dict[str, Any] = {}
    for k, v in params.items():
        if k.lower() in _SENSITIVE_PARAM_KEYS:
            result[k] = "[REDACTED]"
        else:
            result[k] = _sanitize_value(v)
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
        instead of raising exceptions. These serialize to JSON with a
        populated "error_type" field. Success schemas also declare an
        optional "error_type" field (defaulting to null) for a uniform
        response shape, so its mere presence in the serialized JSON isn't
        a reliable signal -- only a truthy value is.
        """
        from superset.utils.json import loads as json_loads

        try:
            payload = json_loads(result.content[0].text)
        except (AttributeError, IndexError, TypeError, ValueError):
            return False
        return bool(isinstance(payload, dict) and payload.get("error_type"))

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
        params = getattr(context.message, "arguments", {}) or {}
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

    def _extract_output_ids(self, result: ToolResult) -> tuple[int | None, int | None]:
        """Extract dashboard/chart IDs created by the tool from its response.

        Create-style tools (generate_chart, generate_dashboard) don't take
        chart_id/dashboard_id as input, so _extract_context_info never sees
        them and every retry logs slice_id/dashboard_id=None even on the
        attempt that actually persisted the object. Look at the response
        body instead, since that's the only place the new ID appears.
        Supports both flat ("chart_id"/"dashboard_id") and nested
        ("chart"/"dashboard" objects with an "id" field) response shapes.
        """
        from superset.utils.json import loads as json_loads

        try:
            data = json_loads(result.content[0].text)
        except (AttributeError, IndexError, ValueError, TypeError):
            return None, None
        if not isinstance(data, dict):
            return None, None

        slice_id = None
        chart = data.get("chart")
        if isinstance(chart, dict):
            slice_id = chart.get("id")
        if slice_id is None:
            slice_id = data.get("chart_id")

        dashboard_id = None
        dashboard = data.get("dashboard")
        if isinstance(dashboard, dict):
            dashboard_id = dashboard.get("id")
        if dashboard_id is None:
            dashboard_id = data.get("dashboard_id")

        return dashboard_id, slice_id

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

    def _backfill_output_ids(
        self,
        success: bool,
        result: Any,
        dashboard_id: int | None,
        slice_id: int | None,
    ) -> tuple[int | None, int | None]:
        """Fill in missing ids from a create tool's response on success.

        Create-style tools (generate_chart, generate_dashboard) don't take
        the new object's ID as input, so it's missing from params. On a
        successful call, pull it from the response instead so retried
        creates are distinguishable.
        """
        if not success or not isinstance(result, ToolResult):
            return dashboard_id, slice_id
        output_dashboard_id, output_slice_id = self._extract_output_ids(result)
        if dashboard_id is None:
            dashboard_id = output_dashboard_id
        if slice_id is None:
            slice_id = output_slice_id
        return dashboard_id, slice_id

    @staticmethod
    def _build_call_tool_payload(
        *,
        mcp_call_id: str,
        tool_name: str | None,
        agent_id: str | None,
        params: Any,
        method: str,
        dashboard_id: int | None,
        slice_id: int | None,
        dataset_id: int | None,
        success: bool,
        mcp_tool: str | None,
        error_type: str | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "mcp_call_id": mcp_call_id,
            "tool": tool_name,
            "agent_id": agent_id,
            "params": _sanitize_params(params),
            "method": method,
            "dashboard_id": dashboard_id,
            "slice_id": slice_id,
            "dataset_id": dataset_id,
            "success": success,
        }
        if mcp_tool is not None:
            payload["mcp_tool"] = mcp_tool
        if error_type is not None:
            payload["error_type"] = error_type
        return payload

    def _log_call_tool_result(
        self,
        *,
        context: MiddlewareContext,
        tool_name: str | None,
        mcp_tool: str | None,
        mcp_call_id: str,
        agent_id: str | None,
        user_id: int | None,
        dashboard_id: int | None,
        slice_id: int | None,
        dataset_id: int | None,
        params: Any,
        success: bool,
        error_type: str | None,
        result: Any,
        start_time: float,
    ) -> None:
        duration_ms = int((time.time() - start_time) * 1000)
        dashboard_id, slice_id = self._backfill_output_ids(
            success, result, dashboard_id, slice_id
        )
        payload = self._build_call_tool_payload(
            mcp_call_id=mcp_call_id,
            tool_name=tool_name,
            agent_id=agent_id,
            params=params,
            method=context.method,
            dashboard_id=dashboard_id,
            slice_id=slice_id,
            dataset_id=dataset_id,
            success=success,
            mcp_tool=mcp_tool,
            error_type=error_type,
        )
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
            # A failing event logger or app-context setup must not mask the
            # tool result or prevent metrics and structured logs below.
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
        result: Any = None
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
            # Tool exceptions arrive wrapped in ToolError with the original
            # attached as __cause__; unwrap it so error_type and the
            # user/system classification reflect the real failure rather than
            # the ToolError wrapper.
            original = _unwrap_tool_error(exc)
            error_type = type(original).__name__
            raised_is_user_error = _is_user_error(original)
            success = False
            raise
        finally:
            # user_id was captured before call_next() ran the tool, i.e.
            # before the @tool auth decorator (superset/mcp_service/auth.py)
            # resolves the user. It sets g.user on a per-call app context
            # that _get_app_context_manager() pushes and pops around the
            # tool's execution (see its docstring), so g.user/get_user_id()
            # are back to their pre-call state by the time we get here —
            # re-reading get_user_id() would still yield the stale value.
            # _mcp_user_id_var is a plain ContextVar (not tied to that Flask
            # app-context lifecycle) that _setup_user_context() sets before
            # the context pops, so it survives to this point.
            resolved_user_id = _mcp_user_id_var.get(None)
            if resolved_user_id is not None:
                user_id = resolved_user_id
            # Reset so a later on_call_tool/on_message in the same asyncio
            # task (e.g. an unprotected tool or resource/prompt read that
            # never calls _setup_user_context()) doesn't inherit this call's
            # resolved user id.
            _mcp_user_id_var.set(None)
            duration_ms = int((time.time() - start_time) * 1000)
            # The audit write needs a metadata connection. Tool workers can hold
            # every pooled connection while they wait on this loop, so the loop
            # must never wait for one itself.
            await asyncio.to_thread(
                self._log_call_tool_result,
                context=context,
                tool_name=tool_name,
                mcp_tool=mcp_tool,
                mcp_call_id=mcp_call_id,
                agent_id=agent_id,
                user_id=user_id,
                dashboard_id=dashboard_id,
                slice_id=slice_id,
                dataset_id=dataset_id,
                params=params,
                success=success,
                error_type=error_type,
                result=result,
                start_time=start_time,
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
            return await call_next(context)
        finally:
            # See the matching comment in on_call_tool: g.user/get_user_id()
            # are stale here because the per-call app context has already
            # been popped. _mcp_user_id_var survives it.
            resolved_user_id = _mcp_user_id_var.get(None)
            if resolved_user_id is not None:
                user_id = resolved_user_id
            # See the matching reset in on_call_tool.
            _mcp_user_id_var.set(None)
            # See the matching audit write in on_call_tool.
            await asyncio.to_thread(
                self._log_message,
                context=context,
                agent_id=agent_id,
                user_id=user_id,
                dashboard_id=dashboard_id,
                slice_id=slice_id,
                dataset_id=dataset_id,
                params=params,
            )

    @staticmethod
    def _log_message(
        *,
        context: MiddlewareContext,
        agent_id: str | None,
        user_id: int | None,
        dashboard_id: int | None,
        slice_id: int | None,
        dataset_id: int | None,
        params: Any,
    ) -> None:
        """Record a non-tool message in the audit log."""
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


class ToolResultCompatibilityMiddleware(Middleware):
    """Gate structured results while providing a last-resort error boundary.

    FastMCP 3.x auto-generates ``outputSchema`` in tool definitions
    (``tools/list``) and ``structuredContent`` in tool call responses
    (``tools/call``) when the tool has a typed return annotation.

    Structured output is part of the MCP contract, but some transport bridges
    cannot encode it. When ``structured_output_enabled`` is false, this
    middleware preserves the legacy text-only contract by stripping both sides
    of that contract: ``outputSchema`` from discovery and ``structuredContent``
    from successful calls. It always converts exceptions that escape the inner
    error handler into a sanitized text result and returns an empty tool list if
    discovery itself fails.
    """

    def __init__(self, *, structured_output_enabled: bool = False) -> None:
        self.structured_output_enabled = structured_output_enabled

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
        if self.structured_output_enabled:
            return tools
        return [
            tool.model_copy(update={"output_schema": None})
            if tool.output_schema is not None
            else tool
            for tool in tools
        ]

    async def on_call_tool(
        self,
        context: MiddlewareContext[mt.CallToolRequestParams],
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
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
            # This is the documented "must never propagate" point. The
            # client-facing text must be SANITIZED — an exception that
            # bypasses GlobalErrorHandlerMiddleware could otherwise leak
            # raw internals (SQL fragments, connection strings, tokens) to
            # the caller; every other client-facing error path already
            # runs through _sanitize_error_for_logging. That call (and
            # str(e) inside it) can itself raise on a pathological
            # __str__, so guard it and fall back to the exception class
            # name, which never propagates.
            try:
                sanitized_message = _sanitize_error_for_logging(e)
            except Exception:  # noqa: BLE001
                sanitized_message = type(e).__name__
            error_text = f"Error: {sanitized_message}"
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
            # Flag the failure so clients can distinguish it from a
            # successful call. This still serializes to
            # CallToolResult(isError=True) (see ToolResult.to_mcp_result);
            # what keeps it encodable is that structured_content stays None
            # and only the boolean flips false->true, not the structured
            # payload implicated in transport-level encoding failures.
            return ToolResult(
                content=[mt.TextContent(type="text", text=error_text)],
                meta={"mcp_call_id": mcp_call_id} if mcp_call_id else None,
                is_error=True,
            )
        if (
            not self.structured_output_enabled
            and isinstance(result, ToolResult)
            and result.structured_content is not None
        ):
            return ToolResult(
                content=result.content,
                # A non-null meta value makes ToolResult.to_mcp_result() retain
                # the CallToolResult envelope. Without it, FastMCP returns a bare
                # content list and the MCP SDK rejects the missing structured
                # content against the live tool's outputSchema.
                meta=result.meta or {},
                is_error=result.is_error,
            )
        return result


class StructuredContentStripperMiddleware(ToolResultCompatibilityMiddleware):
    """Deprecated compatibility middleware that retains its stripping behavior."""

    def __init__(self) -> None:
        warnings.warn(
            "StructuredContentStripperMiddleware is deprecated; use "
            "ToolResultCompatibilityMiddleware(structured_output_enabled=False)",
            DeprecationWarning,
            stacklevel=2,
        )
        super().__init__(structured_output_enabled=False)


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
        # User and permission lookups need a metadata connection. Tool workers
        # can hold every pooled connection while they wait on this loop, so the
        # loop must never wait for one itself.
        return await asyncio.to_thread(self._visible_tools, tools)

    @staticmethod
    def _visible_tools(tools: list[Tool]) -> list[Tool]:
        """Return the tools the calling user may execute."""
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
        wrapped_error: Exception,
        context: MiddlewareContext,
        tool_name: str,
        duration_ms: int,
    ) -> None:
        """Handle different types of errors with appropriate responses.

        ``wrapped_error`` is what reached the middleware; ``error`` is the
        real failure. FastMCP re-raises everything a tool body throws as
        ``ToolError(...) from e`` before any middleware runs, so classifying
        the exception as received would funnel an RBAC denial, a dead table,
        and an internal bug into the same message. Every decision below —
        log severity, error-tracker capture, and the client-facing text — is
        therefore made on the unwrapped cause. See
        :func:`_unwrap_fastmcp_wrapped_error`.
        """
        error = _unwrap_fastmcp_wrapped_error(wrapped_error)

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
        # A datasource failure's severity follows what actually broke, not the
        # 500 status a bare SupersetErrorException inherits. See
        # _datasource_error_is_user_error.
        datasource_is_user = _datasource_error_is_user_error(error)
        if datasource_is_user is not None:
            is_user = datasource_is_user
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
                dashboard_id=None,
                duration_ms=duration_ms,
                slice_id=None,
                referrer=None,
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
            # A ToolError that survived _unwrap_fastmcp_wrapped_error was
            # raised deliberately by tool code (it carries no cause, or no
            # FastMCP wrapper prefix) and is already formatted for MCP.
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
        elif isinstance(error, FastMCPValidationError):
            # FastMCP's own ValidationError (e.g. malformed/missing tool
            # arguments) is not a pydantic ValidationError and has no
            # .errors() API -- its message is already a plain description.
            raise ToolError(f"Validation error in {tool_name}: {error}") from error
        elif isinstance(error, (OperationalError, TimeoutError)):
            # Database errors
            raise ToolError(
                f"Database error in {tool_name}: Service temporarily unavailable. "
                f"Please try again in a few moments."
            ) from error
        elif isinstance(error, HTTPException):
            # HTTP errors from screenshot endpoints or API calls
            raise ToolError(
                f"Service error in {tool_name}: {_sanitize_error_for_logging(error)}"
            ) from error
        elif isinstance(error, MCPPermissionDeniedError):
            # MCP RBAC permission denied. Rendered from the exception's own
            # structured fields ("Permission denied: <permission> on
            # <resource>") rather than through _sanitize_error_for_logging,
            # which flattens every PermissionError to "Access denied" and
            # would throw away the two facts that make the denial
            # actionable. Must come before the generic PermissionError
            # branch because MCPPermissionDeniedError inherits from it.
            raise ToolError(str(error)) from error
        elif isinstance(error, PermissionError):
            # Authorization failures that are not raised by the MCP RBAC
            # decorator still get the "Permission denied" shape, so callers
            # can tell a denial from a malformed call no matter which layer
            # refused them.
            raise ToolError(
                f"Permission denied for {tool_name}: "
                f"You don't have access to this resource."
            ) from error
        elif isinstance(error, ValueError):
            # Value/parameter errors from tool code
            raise ToolError(
                f"Invalid parameter in {tool_name}: "
                f"{_sanitize_error_for_logging(error)}"
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
        elif _is_datasource_error(error):
            # The query behind the tool failed. The caller must NOT be told to
            # re-check the tool schema — that advice fits an argument error and
            # sends them down the wrong path for a dropped table or a dead
            # connection. Only the enumerated SupersetErrorType is echoed; raw
            # driver output could carry SQL or connection details.
            reason = _datasource_error_reason(error) or _GENERIC_DATASOURCE_REASON
            if reason in _QUERY_SYNTAX_REASONS:
                # The datasource is fine; the query is malformed. For a
                # SQL-authoring tool that query is the caller's own argument,
                # so blaming the datasource would steer an agent away from
                # the one thing it can actually fix.
                raise ToolError(
                    f"Query error in {tool_name}: the datasource rejected the "
                    f"query as invalid ({reason}). Fix the query itself — the "
                    f"datasource is reachable."
                ) from error
            raise ToolError(
                f"Datasource error in {tool_name}: the query against the "
                f"underlying datasource failed ({reason}). The tool name and "
                f"arguments were valid — the datasource, table, or column it "
                f"reads may be missing, renamed, or unreachable."
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

    When a tool response exceeds the configured byte limit, this middleware
    intercepts it and returns a helpful error message with suggestions for
    reducing the response size.

    This is critical for protecting LLM clients like Claude Desktop which can
    crash or become unresponsive when receiving extremely large responses.

    Configuration via MCP_RESPONSE_SIZE_CONFIG in superset_config.py:
    - enabled: Toggle the guard on/off (default: True)
    - max_bytes: Maximum serialized response size in bytes (default: 50,000)
    - warn_threshold_pct: Log warnings above this % of limit (default: 80%)
    - max_list_items: Cap for list fields during dynamic truncation (default: 100)
    - excluded_tools: Tools to skip checking
    """

    def __init__(
        self,
        max_bytes: int = DEFAULT_MAX_RESPONSE_BYTES,
        warn_threshold_pct: int = DEFAULT_WARN_THRESHOLD_PCT,
        excluded_tools: list[str] | str | None = None,
        max_list_items: int = DEFAULT_MAX_LIST_ITEMS,
    ) -> None:
        self.max_bytes = max_bytes
        self.warn_threshold_pct = warn_threshold_pct
        self.warn_threshold = int(max_bytes * warn_threshold_pct / 100)
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
        actual_bytes: int,
        protected_keys: frozenset[str] = frozenset(),
    ) -> Any | None:
        """Attempt to dynamically truncate an info tool response to fit the limit.

        Returns the truncated response if successful, None otherwise.

        When the response is a ToolResult (the normal case — FastMCP wraps
        every tool return value), the actual data lives inside
        ``content[0].text`` as a JSON string.  We parse that string, run the
        truncation phases on the resulting dict, then re-wrap the result.

        ``protected_keys`` is forwarded to ``truncate_oversized_response`` so
        callers (e.g. committed-write tools) can keep an identifying field
        intact even through the final "clear everything" phase.
        """
        # Unwrap ToolResult so truncation operates on the real payload
        extracted = self._extract_payload_from_tool_result(response)
        if extracted is None and isinstance(response, ToolResult):
            # A ToolResult whose payload can't be parsed is opaque: truncating
            # it would model_dump() the wrapper itself and hand FastMCP a
            # plain dict, which then fails in to_mcp_result(). Decline instead
            # and let the caller fall through to its own fallback.
            logger.warning(
                "Cannot truncate %s: ToolResult payload is not a JSON object",
                tool_name,
            )
            return None

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
                self.max_bytes,
                max_list_items=self.max_list_items,
                protected_keys=protected_keys,
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

        truncated_bytes = get_response_size_bytes(truncated)
        if truncated_bytes > self.max_bytes:
            return None

        logger.warning(
            "Response for %s truncated from %d to %d bytes (limit: %d). Fields: %s",
            tool_name,
            actual_bytes,
            truncated_bytes,
            self.max_bytes,
            "; ".join(notes),
        )

        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_truncated",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": tool_name,
                    "original_bytes": actual_bytes,
                    "truncated_bytes": truncated_bytes,
                    "max_bytes": self.max_bytes,
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

    def _try_truncate_data_query_response(
        self,
        tool_name: str,
        response: Any,
        actual_bytes: int,
    ) -> Any | None:
        """Attempt to truncate a data-query tool response by dropping tail rows.

        Returns the truncated response if successful, None otherwise.
        """
        extracted = self._extract_payload_from_tool_result(response)
        if extracted is None and isinstance(response, ToolResult):
            # A ToolResult whose payload can't be parsed is opaque: truncating
            # it would model_dump() the wrapper itself and hand FastMCP a
            # plain dict, which then fails in to_mcp_result(). Decline instead
            # and let the caller fall through to its own fallback.
            logger.warning(
                "Cannot truncate %s: ToolResult payload is not a JSON object",
                tool_name,
            )
            return None

        truncation_target = extracted if extracted is not None else response

        try:
            truncated, was_truncated, notes = truncate_query_result(
                truncation_target, self.max_bytes, tool_name=tool_name
            )
        except Exception as trunc_error:  # noqa: BLE001
            logger.warning(
                "Query result truncation failed for %s due to %s: %s",
                tool_name,
                type(trunc_error).__name__,
                trunc_error,
            )
            return None

        if not was_truncated:
            return None

        # Mirror the info-tool path: if truncation couldn't bring the
        # response back under the limit (e.g. a single row/scalar field
        # alone exceeds it), fall back to the hard size-limit error instead
        # of shipping an over-budget response.
        truncated_bytes = get_response_size_bytes(truncated)
        if truncated_bytes > self.max_bytes:
            return None

        logger.warning(
            "Query result for %s truncated from %d to %d bytes (limit: %d). %s",
            tool_name,
            actual_bytes,
            truncated_bytes,
            self.max_bytes,
            "; ".join(notes),
        )

        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_truncated",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": tool_name,
                    "original_bytes": actual_bytes,
                    "truncated_bytes": truncated_bytes,
                    "max_bytes": self.max_bytes,
                    "truncation_notes": notes,
                },
            )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log truncation event: %s", log_error)

        if extracted is not None and isinstance(truncated, dict):
            return self._rewrap_as_tool_result(truncated, response)

        return truncated

    def _try_truncate_string_field_response(
        self,
        tool_name: str,
        response: Any,
        actual_bytes: int,
        field: str,
    ) -> Any | None:
        """Attempt to truncate a response by bisecting one oversized string field.

        Returns the truncated response if successful, None otherwise.
        """
        extracted = self._extract_payload_from_tool_result(response)
        if extracted is None and isinstance(response, ToolResult):
            # A ToolResult whose payload can't be parsed is opaque: truncating
            # it would model_dump() the wrapper itself and hand FastMCP a
            # plain dict, which then fails in to_mcp_result(). Decline instead
            # and let the caller fall through to its own fallback.
            logger.warning(
                "Cannot truncate %s: ToolResult payload is not a JSON object",
                tool_name,
            )
            return None

        truncation_target = extracted if extracted is not None else response

        try:
            truncated, was_truncated, notes = truncate_string_field_response(
                truncation_target, self.max_bytes, field
            )
        except Exception as trunc_error:  # noqa: BLE001
            logger.warning(
                "String field truncation failed for %s due to %s: %s",
                tool_name,
                type(trunc_error).__name__,
                trunc_error,
            )
            return None

        if not was_truncated:
            return None

        truncated_bytes = get_response_size_bytes(truncated)
        if truncated_bytes > self.max_bytes:
            return None

        logger.warning(
            "Response for %s truncated from %d to %d bytes (limit: %d). %s",
            tool_name,
            actual_bytes,
            truncated_bytes,
            self.max_bytes,
            "; ".join(notes),
        )

        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_truncated",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": tool_name,
                    "original_bytes": actual_bytes,
                    "truncated_bytes": truncated_bytes,
                    "max_bytes": self.max_bytes,
                    "truncation_notes": notes,
                },
            )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log truncation event: %s", log_error)

        if extracted is not None and isinstance(truncated, dict):
            return self._rewrap_as_tool_result(truncated, response)

        return truncated

    def _minimal_committed_write_response(
        self,
        tool_name: str,
        response: Any,
        actual_bytes: int,
    ) -> Any:
        """Build a guaranteed-small success response for a committed write.

        Last-resort fallback for COMMITTED_WRITE_TOOLS: reached only when
        even the nuclear phase of ``truncate_oversized_response`` can't bring
        the response under budget (in practice this should not happen, since
        the protected identifying fields alone are tiny). The underlying
        mutation already committed by the time this middleware runs, so this
        path must never raise -- it keeps only what confirms the write
        succeeded and drops everything else.
        """
        spec = COMMITTED_WRITE_SPECS[tool_name]
        if (extracted := self._extract_payload_from_tool_result(response)) is not None:
            payload = extracted
        elif isinstance(response, dict):
            payload = response
        else:
            payload = {}
        truncation_notes = [
            f"Response for {tool_name} exceeded the size limit even after "
            "truncation; non-essential fields were dropped. The tool call "
            "itself completed and was not rolled back by this size limit -- "
            f"re-read the {spec.resource} to see its full state."
        ]
        minimal = self._select_confirmation_fields(payload, spec)
        minimal["_response_truncated"] = True
        minimal["_truncation_notes"] = truncation_notes
        self._shrink_minimal_response(minimal, spec)
        logger.warning(
            "Response for %s could not fit under the size limit after full "
            "truncation (%d bytes, limit %d); returning a minimal write "
            "confirmation instead of blocking a completed write.",
            tool_name,
            actual_bytes,
            self.max_bytes,
        )
        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_truncated",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": tool_name,
                    "original_bytes": actual_bytes,
                    "max_bytes": self.max_bytes,
                    "truncation_notes": truncation_notes,
                },
            )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log truncation event: %s", log_error)

        # Rewrap whenever the tool returned a ToolResult, including the case
        # where its payload could not be parsed: returning a bare dict there
        # would blow up in FastMCP's ``result.to_mcp_result()`` and surface
        # the completed write as an internal error after all.
        if isinstance(response, ToolResult):
            return self._rewrap_as_tool_result(minimal, response)
        return minimal

    @staticmethod
    def _select_confirmation_fields(
        payload: dict[str, Any], spec: CommittedWriteSpec
    ) -> dict[str, Any]:
        """Keep only the payload keys that confirm the write happened.

        Selecting from the payload's *own* keys rather than a fixed list is
        what makes this work for every committed-write tool. A dashboard
        response has no ``chart``, ``explore_url`` or ``success`` to copy, and
        synthesizing them would put fields on the response that its model
        never declares. Conversely, the fields worth keeping differ per tool
        (``explore_url`` for charts, ``dashboard_url`` for dashboards), so
        keeping scalars names them without a per-tool list. Free-form strings
        are bounded by ``_shrink_minimal_response``. Short string lists such
        as ``changed_fields`` are also kept, bounded by item count and total
        character count.

        Other containers are dropped, except identifying fields and errors,
        which are reduced by ``_shrink_minimal_response`` if needed.
        """
        minimal: dict[str, Any] = {
            key: value
            for key, value in payload.items()
            if key in spec.identifying_fields
            or key == "error"
            or not isinstance(value, (list, dict))
            or (
                isinstance(value, list)
                and len(value) <= _MINIMAL_LIST_ITEMS
                and all(isinstance(item, str) for item in value)
                and sum(len(item) for item in value) <= _MINIMAL_FIELD_CHARS
            )
        }
        if spec.reports_success:
            # An unparseable payload yields nothing to copy, but a tool whose
            # schema has ``success`` must still say the write succeeded.
            # Assume a completed call succeeded if its payload cannot be parsed.
            minimal.setdefault("success", True)
        return minimal

    def _shrink_minimal_response(
        self, minimal: dict[str, Any], spec: CommittedWriteSpec
    ) -> None:
        """Force ``minimal`` under the byte limit, degrading fields in place.

        Every value here is copied from the *untruncated* payload, so a
        "minimal" response is only actually small once each unbounded field
        has been cut down:

        - each identifying field is a nested object (``chart``, ``dashboard``,
          ``metric``) that is reduced to identifying scalars -- including
          ``is_unsaved_state``, since update_chart defaults to
          ``generate_preview=True`` and then persists nothing, so that flag is
          the caller's only in-band way to tell a cached preview from a
          persisted write, and shrinking must not be what drops it;
        - those scalars (``slice_name``, ``dashboard_title``, ``url``) are
          themselves free-form strings, so they are clipped;
        - the remaining top-level values are scalars or bounded string lists
          (see ``_select_confirmation_fields``), but a scalar can still be a
          free-form string -- ``explore_url``, ``dashboard_url``, ``message``
          -- so every one of them is clipped too;
        - ``error`` is not a string at all in most of the shapes the tools
          return -- it is often a nested error model that arrives here as a
          dict -- so it gets the same identifying-scalars treatment as the
          identifying fields rather than a plain clip (see ``_clip_error``).

        Reducing every unbounded field is what makes the result bounded by
        construction: identifying scalars plus fixed-text notes. A failed
        measurement counts as "too big" so the payload is degraded rather
        than optimistically returned, and the written object's identity is
        never dropped just because the estimator errored -- surfacing what
        was written is the whole point of this fallback.

        With an extremely small ``max_bytes`` even the fully clipped form
        can exceed it. Returning it anyway is deliberate: this path exists so
        a completed write is never reported as a failure, and there is
        nothing further to give up without losing that confirmation.
        """
        if _fits(minimal, self.max_bytes):
            return

        # Clip proportionally under small budgets so the clipped fields do
        # not by themselves exceed the limit they are being shrunk to fit.
        max_chars = string_clip_chars(self.max_bytes, _MINIMAL_FIELD_CHARS)

        for field in sorted(spec.identifying_fields):
            if field not in minimal:
                continue
            value = minimal[field]
            if isinstance(value, dict):
                minimal[field] = {
                    key: _clip_string(value[key], max_chars)
                    for key in _MINIMAL_IDENTITY_FIELDS
                    if key in value
                }
                minimal["_truncation_notes"].append(
                    f"'{field}' reduced to identifying fields only."
                )
            elif isinstance(value, list):
                minimal[field] = []
                minimal["_truncation_notes"].append(
                    f"'{field}' list cleared to fit the size limit."
                )

        for key in list(minimal):
            if key in spec.identifying_fields or key.startswith("_"):
                continue
            current = minimal[key]
            clipped = (
                _clip_error(current, max_chars)
                if key == "error"
                else _clip_string(current, max_chars)
            )
            if clipped is not current:
                minimal[key] = clipped
                minimal["_truncation_notes"].append(
                    f"'{key}' was reduced to fit the size limit."
                )

        if not _fits(minimal, self.max_bytes):
            logger.warning(
                "Minimal write confirmation still estimates over the byte "
                "limit (%d) after full reduction; returning it anyway rather "
                "than reporting a completed write as a failure.",
                self.max_bytes,
            )

    def _handle_oversized_response(
        self,
        tool_name: str,
        response: Any,
        actual_bytes: int,
        params: dict[str, Any],
    ) -> Any:
        """Attempt truncation for known tool categories; block everything else.

        For info tools (``INFO_TOOLS``), committed-write tools
        (``COMMITTED_WRITE_TOOLS``), data-query tools (``DATA_QUERY_TOOLS``),
        and single-string-field tools (``STRING_FIELD_TRUNCATION_TOOLS``),
        tries dynamic truncation first and returns the truncated result if
        successful. Falls through to a hard ``ToolError`` for all other
        tools, or when truncation cannot reduce the response to fit the
        limit -- except for COMMITTED_WRITE_TOOLS, whose transaction already
        committed, so they degrade to a minimal success response instead of
        ever raising (see ``_minimal_committed_write_response``).

        Raises:
            ToolError: When the response exceeds the limit and cannot be
                truncated (never for COMMITTED_WRITE_TOOLS).
        """
        # Info tools and committed-write tools: field-level truncation
        # (strings, lists, dicts). Committed-write tools protect their own
        # identifying fields -- 'chart', 'dashboard', 'metric', or none at
        # all where the identity is top-level scalars the phases never drop
        # -- so write confirmation survives even the most aggressive phase.
        if tool_name in INFO_TOOLS or tool_name in COMMITTED_WRITE_TOOLS:
            spec = COMMITTED_WRITE_SPECS.get(tool_name)
            protected_keys = spec.identifying_fields if spec else frozenset()
            truncated = self._try_truncate_info_response(
                tool_name, response, actual_bytes, protected_keys=protected_keys
            )
            if truncated is not None:
                return truncated

        # Data-query tools: row-level truncation.
        if tool_name in DATA_QUERY_TOOLS:
            truncated = self._try_truncate_data_query_response(
                tool_name, response, actual_bytes
            )
            if truncated is not None:
                return truncated

        # Tools whose payload is dominated by one large string field with no
        # size-reduction lever (e.g. get_chart_sql's rendered SQL).
        if tool_name in STRING_FIELD_TRUNCATION_TOOLS:
            truncated = self._try_truncate_string_field_response(
                tool_name,
                response,
                actual_bytes,
                STRING_FIELD_TRUNCATION_TOOLS[tool_name],
            )
            if truncated is not None:
                return truncated

        if tool_name in COMMITTED_WRITE_TOOLS:
            # The mutation already committed -- never report it as a failed
            # call, no matter how badly truncation underperformed.
            return self._minimal_committed_write_response(
                tool_name, response, actual_bytes
            )

        # Log the blocked response (user-caused: requested too much data)
        logger.warning(
            "Response blocked for %s: %d bytes exceeds limit of %d",
            tool_name,
            actual_bytes,
            self.max_bytes,
        )

        try:
            user_id = get_user_id()
            event_logger.log(
                user_id=user_id,
                action="mcp_response_size_exceeded",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": tool_name,
                    "actual_bytes": actual_bytes,
                    "max_bytes": self.max_bytes,
                    "params": _sanitize_params(params),
                },
            )
        except Exception as log_error:  # noqa: BLE001
            logger.warning("Failed to log size exceeded event: %s", log_error)

        raise ToolError(
            format_size_limit_error(
                tool_name=tool_name,
                params=params,
                actual_bytes=actual_bytes,
                max_bytes=self.max_bytes,
                response=None,
            )
        )

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

        # When the response is a ToolResult, measure the size of the actual
        # payload inside content[0].text rather than the ToolResult wrapper
        # (which would double-serialize the JSON string).
        extracted = self._extract_payload_from_tool_result(response)
        estimation_target = extracted if extracted is not None else response

        # Never raises: a response that cannot be serialized measures as
        # UNMEASURABLE_RESPONSE_BYTES, which exceeds any limit and so takes
        # the oversized path below rather than slipping through unmeasured.
        actual_bytes = get_response_size_bytes(estimation_target)

        # Log warning if approaching limit
        if actual_bytes > self.warn_threshold:
            logger.warning(
                "Response size warning for %s: %d bytes (%.0f%% of %d limit)",
                tool_name,
                actual_bytes,
                (actual_bytes / self.max_bytes * 100) if self.max_bytes else 0,
                self.max_bytes,
            )

        if actual_bytes > self.max_bytes:
            params = getattr(context.message, "arguments", {}) or {}
            return self._handle_oversized_response(
                tool_name, response, actual_bytes, params
            )

        return response


def _clip_string(value: Any, max_chars: int = _MINIMAL_FIELD_CHARS) -> Any:
    """Clip an over-long string, returning non-strings and short strings as-is.

    Returning the original object unchanged (identity, not just equality) lets
    callers detect whether anything was actually clipped.
    """
    if isinstance(value, str) and len(value) > max_chars:
        return value[:max_chars] + "... [truncated]"
    return value


def _clip_error(value: Any, max_chars: int = _MINIMAL_FIELD_CHARS) -> Any:
    """Bound an ``error`` field of either shape it can arrive in.

    Tool responses type ``error`` as a nested model (``ChartGenerationError``),
    which reaches this middleware as a dict once the ToolResult payload is
    parsed -- so bounding only the plain-string shape would leave the shape the
    tools actually return untouched, and a large ``query_info`` or
    ``validation_errors`` would still push the confirmation over the limit.
    A dict is reduced to clipped identifying scalars; a string is clipped.

    Returns the original object unchanged (identity, not just equality) when
    nothing needed bounding, so callers can detect whether anything changed.
    """
    if isinstance(value, dict):
        reduced = {
            key: _clip_string(value[key], max_chars)
            for key in _MINIMAL_ERROR_FIELDS
            if key in value
        }
        return value if reduced == value else reduced
    return _clip_string(value, max_chars)


def _fits(payload: Any, max_bytes: int) -> bool:
    """Check that ``payload`` measures under ``max_bytes``.

    A measurement failure reads as "does not fit" (the helper reports it as
    ``UNMEASURABLE_RESPONSE_BYTES``), so callers degrade the payload further
    rather than optimistically returning something oversized.
    """
    return get_response_size_bytes(payload) <= max_bytes


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
            max_bytes=_safe_int_config(config, "max_bytes", DEFAULT_MAX_RESPONSE_BYTES),
            warn_threshold_pct=_safe_int_config(
                config, "warn_threshold_pct", DEFAULT_WARN_THRESHOLD_PCT
            ),
            excluded_tools=config.get("excluded_tools"),
            max_list_items=max_list_items,
        )

        logger.info(
            "Created ResponseSizeGuardMiddleware with max_bytes=%d",
            middleware.max_bytes,
        )
        return middleware

    except (ImportError, AttributeError, KeyError) as e:
        logger.error("Failed to create ResponseSizeGuardMiddleware: %s", e)
        return None
