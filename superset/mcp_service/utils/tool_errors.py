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

"""Public error classification shared by MCP query tools."""

from sqlalchemy.exc import SQLAlchemyError
from superset_core.semantic_layers.errors import (
    SemanticBackendError,
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
    SemanticResultCompletenessError as ProviderResultCompletenessError,
)
from superset_core.semantic_layers.transport import ProviderRequestError

from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.db_engine_specs.exceptions import SupersetDBAPIError
from superset.errors import SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryObjectValidationError,
    SemanticResultCompletenessError,
    SupersetErrorException,
)
from superset.mcp_service.chart.response_preflight import bounded_exception_message
from superset.semantic_layers.exceptions import (
    is_provider_fault,
    rejection_message,
    SemanticLayerExecutionError,
    SemanticLayerQueryRejectedError,
)
from superset.utils.error_sanitization import (
    GENERIC_ERROR_MESSAGE,
    SAFE_ERROR_TYPES,
    sanitize_error_message,
    sanitize_superset_error,
)


def _causal_chain(exc: Exception) -> list[BaseException]:
    """Walk explicit causes without following implicit exception contexts."""
    chain: list[BaseException] = []
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        chain.append(current)
        current = current.__cause__
    return chain


def contains_provider_fault(exc: Exception) -> bool:
    """Identify provider-origin text anywhere in an explicit error chain."""
    return any(is_provider_fault(error) for error in _causal_chain(exc))


def _superset_exception_error(
    error: SupersetErrorException, *, semantic: bool
) -> tuple[str, str, str]:
    """Classify a Superset exception without trusting unsafe provider text."""
    error_type: SupersetErrorType = error.error.error_type
    if error_type in SAFE_ERROR_TYPES:
        return error_type.value, bounded_exception_message(error), "QueryError"
    if not semantic:
        sanitized: SupersetError = sanitize_superset_error(error.error)
        # Keep the MCP response budget after applying HTTP's guest rule.
        return (
            sanitized.error_type.value,
            bounded_exception_message(Exception(str(sanitized.message))),
            "QueryError",
        )
    return (
        SupersetErrorType.GENERIC_BACKEND_ERROR.value,
        str(GENERIC_ERROR_MESSAGE),
        "QueryError",
    )


def _translated_completeness_error(
    chain: list[BaseException],
) -> tuple[str, str, str] | None:
    """Keep fixed host guidance produced from a provider completeness signal."""
    for error in chain:
        if (
            type(error) is SemanticResultCompletenessError
            and isinstance(error.__cause__, ProviderResultCompletenessError)
            and not is_provider_fault(error)
        ):
            return (
                SemanticQueryErrorCode.INVALID_QUERY.value,
                bounded_exception_message(error),
                "ValidationError",
            )
    return None


def public_query_error(
    exc: Exception, *, semantic: bool = False
) -> tuple[str, str, str]:
    """Return a safe error code, message, and MCP type for a failed query.

    A provider can raise a host exception class. Its provenance marker takes
    priority over that class, so its text cannot become a host-owned message.
    Dataset engine errors follow the same guest rule as the HTTP chart API.
    """
    chain: list[BaseException] = _causal_chain(exc)

    if semantic and (completeness := _translated_completeness_error(chain)) is not None:
        return completeness

    if semantic and contains_provider_fault(exc):
        return (
            SupersetErrorType.GENERIC_BACKEND_ERROR.value,
            str(GENERIC_ERROR_MESSAGE),
            "QueryError",
        )

    for error in chain:
        if isinstance(
            error, (SemanticLayerQueryRejectedError, SemanticQueryRejectedError)
        ):
            code: SemanticQueryErrorCode = error.code
            return code.value, rejection_message(code), "QueryValidationError"
        if isinstance(error, (SemanticLayerExecutionError, SemanticBackendError)):
            return (
                SupersetErrorType.GENERIC_BACKEND_ERROR.value,
                str(GENERIC_ERROR_MESSAGE),
                "QueryError",
            )
        if isinstance(error, QueryObjectValidationError):
            # Transport normalization uses ``raise ... from None`` and keeps
            # its typed transport exception as the implicit context.
            transport_failure: bool = isinstance(
                error.__context__, ProviderRequestError
            )
            return (
                (
                    SupersetErrorType.GENERIC_BACKEND_ERROR.value
                    if transport_failure
                    else SemanticQueryErrorCode.INVALID_QUERY.value
                ),
                (
                    bounded_exception_message(error)
                    if semantic
                    else sanitize_error_message(bounded_exception_message(error))
                ),
                "QueryError" if transport_failure else "ValidationError",
            )
        if isinstance(error, SupersetErrorException):
            return _superset_exception_error(error, semantic=semantic)

    if semantic:
        return (
            SupersetErrorType.GENERIC_BACKEND_ERROR.value,
            str(GENERIC_ERROR_MESSAGE),
            "QueryError",
        )
    if any(
        isinstance(
            error, (ChartDataQueryFailedError, SupersetDBAPIError, SQLAlchemyError)
        )
        for error in chain
    ):
        return (
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR.value,
            sanitize_error_message(bounded_exception_message(exc)),
            "QueryError",
        )
    return (
        SupersetErrorType.GENERIC_BACKEND_ERROR.value,
        str(GENERIC_ERROR_MESSAGE),
        "QueryError",
    )


# Errors of any MCP tool.
#
# MCP tools follow the rule of the HTTP API's error handlers
# (``superset/views/error_handling.py`` and ``/api/v1/chart/data``):
#
# * A query that failed in the warehouse is classified by
#   :func:`public_query_error`: a signed-in user gets the engine's error text,
#   which they need to fix the query, and an embedded guest gets the generic
#   message from ``sanitize_error_message``.
# * Any other exception Superset raised (``SupersetException``,
#   ``CommandException``) is reported with its ``message``, which embedded
#   guests only see when the ``SupersetErrorType`` is one Superset writes itself
#   (``SAFE_ERROR_TYPES``). So is a ValueError raised by one of Superset's
#   validators of the caller's arguments (``MCPValidationError`` or the
#   legacy ``HOST_VALUE_ERROR_MODULES``).
# * Any other exception (SQLAlchemy, a database driver, a library) gets a fixed
#   message. Its text can carry SQL, bound parameters, connection strings or
#   hostnames, so it only goes to the server log.
#
# This applies to tool responses and also to ``ctx.error``/``ctx.warning``,
# which FastMCP sends to the client as log notifications.
# ``tests/unit_tests/mcp_service/test_tool_error_text.py`` scans the MCP service
# for exception text that bypasses these helpers.

import logging  # noqa: E402
from dataclasses import dataclass  # noqa: E402
from typing import Any, Literal, Protocol, TYPE_CHECKING, TypeVar  # noqa: E402

from superset.commands.exceptions import CommandException  # noqa: E402
from superset.errors import ErrorLevel  # noqa: E402
from superset.exceptions import (  # noqa: E402
    SupersetErrorsException,
    SupersetException,
)
from superset.mcp_service.utils.error_sanitization import (  # noqa: E402
    sanitize_for_log,
)
from superset.utils import error_sanitization  # noqa: E402

if TYPE_CHECKING:
    from fastmcp import Context

logger = logging.getLogger(__name__)

DATABASE_ERROR_MESSAGE = (
    "A database error occurred. The details were logged on the server."
)
UNEXPECTED_ERROR_MESSAGE = (
    "An unexpected error occurred. The details were logged on the server."
)
# Engine errors can be long; responses carry a bounded prefix.
MAX_MESSAGE_BYTES = 512

# Modules whose own ``raise ValueError(...)`` describes the caller's arguments,
# such as a reversed time range or a chart config a plugin rejects. A
# ValueError raised anywhere else (a driver, pandas, a library) can carry data
# and gets the fixed message.
HOST_VALUE_ERROR_MODULES: tuple[str, ...] = (
    "superset.utils.date_parser",
    "superset.mcp_service.common.time_range_validation",
    "superset.mcp_service.chart.chart_helpers",
    "superset.mcp_service.chart.chart_utils",
    "superset.mcp_service.chart.plugins.",
)


class MCPValidationError(ValueError):
    """Intentional, host-written guidance for the caller.

    It describes the caller's input, credentials or tool availability. Only
    use it for messages composed by Superset, never for text from a caught
    exception, query engine, or provider. Signed-in callers may see this text;
    embedded guests still follow the shared sanitization policy.
    """


@dataclass(frozen=True)
class SafeError:
    """An error code and a message that may be sent to the current principal.

    ``code`` is a ``SupersetErrorType`` value, or a ``SemanticQueryErrorCode``
    value for a query a semantic layer or Superset rejected as invalid.
    """

    code: str
    message: str


def raised_by_host_validation(exc: BaseException) -> bool:
    """Whether ``exc`` carries intentional host-owned validation guidance.

    Tools opt in with ``MCPValidationError``. Legacy validators are identified
    by the innermost traceback frame, where the exception was raised.
    """
    if isinstance(exc, MCPValidationError):
        return True
    if not isinstance(exc, ValueError) or exc.__traceback__ is None:
        return False
    tb = exc.__traceback__
    while tb.tb_next is not None:
        tb = tb.tb_next
    module = str(tb.tb_frame.f_globals.get("__name__", ""))
    return any(
        module == prefix or (prefix.endswith(".") and module.startswith(prefix))
        for prefix in HOST_VALUE_ERROR_MODULES
    )


def _superset_error(exc: BaseException) -> SupersetError:
    """Describe ``exc`` the way the HTTP API's error handlers do."""
    if isinstance(exc, SupersetErrorException):
        return exc.error
    if isinstance(exc, SupersetErrorsException) and exc.errors:
        return exc.errors[0]
    if isinstance(exc, SupersetException):
        error_type = exc.error_type or (
            SupersetErrorType.GENERIC_COMMAND_ERROR
            if isinstance(exc, CommandException)
            else SupersetErrorType.GENERIC_BACKEND_ERROR
        )
        return SupersetError(
            message=str(exc.message),
            error_type=error_type,
            level=ErrorLevel.WARNING if exc.status < 500 else ErrorLevel.ERROR,
        )
    if raised_by_host_validation(exc):
        return SupersetError(
            message=str(exc),
            error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
            level=ErrorLevel.WARNING,
        )
    if isinstance(exc, SQLAlchemyError):
        return SupersetError(
            message=DATABASE_ERROR_MESSAGE,
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
        )
    return SupersetError(
        message=UNEXPECTED_ERROR_MESSAGE,
        error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
        level=ErrorLevel.ERROR,
    )


# Failures of the data query itself, which :func:`public_query_error` classifies.
_QUERY_FAILURES: tuple[type[BaseException], ...] = (
    ChartDataQueryFailedError,
    SupersetDBAPIError,
    QueryObjectValidationError,
    SemanticLayerQueryRejectedError,
    SemanticQueryRejectedError,
    SemanticLayerExecutionError,
    SemanticBackendError,
)


_SAFE_CODES: frozenset[str] = frozenset(
    error_type.value for error_type in SAFE_ERROR_TYPES
)


def _is_query_failure(exc: Exception) -> bool:
    return any(isinstance(error, _QUERY_FAILURES) for error in _causal_chain(exc))


def safe_error(
    exc: BaseException,
    *,
    query: bool = False,
    semantic: bool = False,
    guest: bool = False,
) -> SafeError:
    """Map an exception to an error code and a client-safe message.

    With ``query=True`` the exception was raised while running a data query.
    A failure of the query itself, or any failure of a semantic-view query, is
    classified by :func:`public_query_error` (``semantic`` is passed through):
    engine text for a signed-in user, the generic message for an embedded
    guest, as in the chart-data API. An exception raised inside a semantic
    provider call is classified the same way with ``semantic=True`` whatever
    ``query`` says, so provider text never reaches the client.

    Anything else follows the general rule: signed-in users get the message
    Superset attached to the exception, cut to ``MAX_MESSAGE_BYTES``; embedded
    guests get a generic message unless the error type is one Superset writes
    itself. That includes a ValueError Superset raised about the caller's
    arguments (see :func:`raised_by_host_validation`). Other exceptions always
    get a fixed message.

    The principal is the current request's. ``guest=True`` marks a call that
    resolved to an embedded guest although the request no longer holds it, as
    when a middleware renders the response after the tool's context is gone.
    """
    # Read through the module, like sanitize_error_message, so both rules see
    # the same principal.
    required = guest or error_sanitization.is_sanitization_required()
    if isinstance(exc, Exception):
        # Provenance comes first: a provider can call a host validator, and the
        # host-validation exemption must not turn its text into host guidance.
        provider_fault = any(is_provider_fault(error) for error in _causal_chain(exc))
        if provider_fault or (
            not raised_by_host_validation(exc)
            and query
            and (semantic or _is_query_failure(exc))
        ):
            code, message, _ = public_query_error(
                exc, semantic=semantic or provider_fault
            )
            # Like /api/v1/chart/data, an embedded guest gets the generic
            # message unless Superset wrote the text itself, also for a
            # semantic query.
            if code not in _SAFE_CODES and required:
                message = str(GENERIC_ERROR_MESSAGE)
            return SafeError(code=code, message=_bounded(message))
    error = sanitize_superset_error(_superset_error(exc), required=required)
    return SafeError(code=error.error_type.value, message=_bounded(str(error.message)))


def _bounded(text: str) -> str:
    """Cut ``text`` to ``MAX_MESSAGE_BYTES`` UTF-8 bytes."""
    encoded = text.encode("utf-8", errors="replace")
    if len(encoded) <= MAX_MESSAGE_BYTES:
        return text
    return encoded[:MAX_MESSAGE_BYTES].decode("utf-8", errors="ignore") + "..."


def _mcp_call_id() -> str | None:
    """Return the id of the current MCP call, set by the logging middleware."""
    # Imported lazily: the middleware module imports MCP utilities.
    from superset.mcp_service.middleware import _mcp_call_id_var

    return _mcp_call_id_var.get(None)


def tool_error_message(
    summary: str, exc: BaseException, *, query: bool = False, semantic: bool = False
) -> str:
    """Return ``"<summary>: <safe message>"`` plus the MCP call id, if any.

    ``summary`` is a fixed, host-written description of the operation, such as
    ``"Failed to get dataset info"``. It must never contain exception text.
    ``query`` and ``semantic`` are passed to :func:`safe_error`.
    """
    safe = safe_error(exc, query=query, semantic=semantic)
    message = f"{summary}: {safe.message}"
    if call_id := _mcp_call_id():
        message = f"{message} (Error ID: {call_id})"
    return message


def _exception_text(exc: BaseException) -> str:
    """Render an exception for the server log, tolerating a failing __str__."""
    try:
        return sanitize_for_log(exc)
    except Exception:  # noqa: BLE001 - logging must not raise
        return "<unprintable exception>"


def log_tool_exception(summary: str, exc: BaseException, **context: Any) -> None:
    """Log the full exception server-side; this text never goes to a client.

    Failures Superset raised on purpose are logged without a traceback, at
    WARNING when they are the caller's (status below 500). Anything else is
    logged at ERROR with its traceback.
    """
    fields = ", ".join(
        f"{key}={sanitize_for_log(value)}" for key, value in context.items()
    )
    expected = isinstance(exc, SupersetException)
    level = (
        logging.WARNING
        if expected and getattr(exc, "status", 500) < 500
        else logging.ERROR
    )
    logger.log(
        level,
        "%s: call_id=%s%s, error_type=%s, error=%s",
        summary,
        _mcp_call_id(),
        f", {fields}" if fields else "",
        type(exc).__name__,
        _exception_text(exc),
        exc_info=None if expected else (type(exc), exc, exc.__traceback__),
    )


ErrorModel = TypeVar("ErrorModel")
_ErrorModelCo = TypeVar("_ErrorModelCo", covariant=True)


class _ErrorModelFactory(Protocol[_ErrorModelCo]):
    def __call__(self, **kwargs: Any) -> _ErrorModelCo: ...


def internal_error_response(
    factory: _ErrorModelFactory[ErrorModel],
    summary: str,
    exc: BaseException,
    *,
    log: bool = True,
    query: bool = False,
    semantic: bool = False,
    **fields: Any,
) -> ErrorModel:
    """Build a tool error model from :func:`safe_error`.

    ``factory`` is the error model class (or a ``create`` classmethod). The
    model gets ``error`` and ``error_type`` (the error code); ``fields`` adds or
    overrides model fields, for example ``success=False`` or a tool-specific
    ``error_type``. Pass ``log=False`` when :func:`report_tool_error` already
    logged ``exc``. ``query`` and ``semantic`` are passed to :func:`safe_error`.
    """
    if log:
        log_tool_exception(summary, exc)
    model_fields: dict[str, Any] = {
        "error": tool_error_message(summary, exc, query=query, semantic=semantic),
        "error_type": safe_error(exc, query=query, semantic=semantic).code,
    }
    model_fields.update(fields)
    return factory(**model_fields)


async def report_tool_error(
    ctx: "Context",
    summary: str,
    exc: BaseException,
    *,
    level: Literal["error", "warning"] = "error",
    query: bool = False,
    semantic: bool = False,
    **context: Any,
) -> str:
    """Log ``exc`` server-side and send its client-safe message through ``ctx``.

    ``context`` holds request identifiers (never exception text). They go to
    the server log and, as ``key=value`` pairs, to the client notification.
    ``query`` and ``semantic`` are passed to :func:`safe_error`. Returns the
    client message so the caller can reuse it in its response.
    """
    log_tool_exception(summary, exc, **context)
    message = tool_error_message(summary, exc, query=query, semantic=semantic)
    notification = message
    if context:
        fields = ", ".join(f"{key}={value}" for key, value in context.items())
        notification = f"{message} ({fields})"
    if level == "warning":
        await ctx.warning(notification)
    else:
        await ctx.error(notification)
    return message
