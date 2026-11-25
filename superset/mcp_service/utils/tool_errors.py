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

"""Client-safe errors for MCP tool failures.

MCP tools follow the rule of the HTTP API's error handlers
(``superset/views/error_handling.py`` and ``/api/v1/chart/data``):

* An exception Superset raised (``SupersetException``, ``CommandException``)
  is reported with its ``message``. For a query that failed in the warehouse
  that is the engine's error text, which a signed-in user needs to fix the
  query. Embedded guest viewers get the generic message from
  ``sanitize_error_message`` instead, unless the ``SupersetErrorType`` is one
  Superset writes itself (``SAFE_ERROR_TYPES``).
* Any other exception (SQLAlchemy, a database driver, a semantic-layer provider,
  a library) gets a fixed message. Its text can carry SQL, bound parameters,
  connection strings or hostnames, so it only goes to the server log.

This applies to tool responses and also to ``ctx.error``/``ctx.warning``/
``ctx.info``/``ctx.debug``, which FastMCP sends to the client as log
notifications.

:func:`safe_error` is the single mapping. :func:`internal_error_response` and
:func:`report_tool_error` build on it for tool responses and ctx notifications.
``tests/unit_tests/mcp_service/test_tool_error_text.py`` scans the MCP service
for exception text that bypasses it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Literal, Protocol, TYPE_CHECKING, TypeVar

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import CommandException
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetException,
)
from superset.mcp_service.utils.error_sanitization import sanitize_for_log
from superset.utils.error_sanitization import (
    is_sanitization_required,
    sanitize_superset_error,
)

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


@dataclass(frozen=True)
class SafeError:
    """An error type and a message that may be sent to the current principal."""

    error_type: SupersetErrorType
    message: str


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


def safe_error(exc: BaseException) -> SafeError:
    """Map an exception to a ``SupersetErrorType`` and a client-safe message.

    Signed-in users get the message Superset attached to the exception, such as
    the engine error of a failed query, cut to ``MAX_MESSAGE_BYTES``. Embedded
    guests get a generic message unless the error type is one Superset writes
    itself. Exceptions Superset did not raise always get a fixed message.
    """
    error = sanitize_superset_error(
        _superset_error(exc), required=is_sanitization_required()
    )
    return SafeError(error_type=error.error_type, message=_bounded(str(error.message)))


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


def tool_error_message(summary: str, exc: BaseException) -> str:
    """Return ``"<summary>: <safe message>"`` plus the MCP call id, if any.

    ``summary`` is a fixed, host-written description of the operation, such as
    ``"Failed to get dataset info"``. It must never contain exception text.
    """
    message = f"{summary}: {safe_error(exc).message}"
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
    **fields: Any,
) -> ErrorModel:
    """Build a tool error model from :func:`safe_error`.

    ``factory`` is the error model class (or a ``create`` classmethod). The
    model gets ``error`` and ``error_type`` (the ``SupersetErrorType`` value);
    ``fields`` adds or overrides model fields, for example ``success=False`` or
    a tool-specific ``error_type``. Pass ``log=False`` when
    :func:`report_tool_error` already logged ``exc``.
    """
    if log:
        log_tool_exception(summary, exc)
    model_fields: dict[str, Any] = {
        "error": tool_error_message(summary, exc),
        "error_type": safe_error(exc).error_type.value,
    }
    model_fields.update(fields)
    return factory(**model_fields)


async def report_tool_error(
    ctx: Context,
    summary: str,
    exc: BaseException,
    *,
    level: Literal["error", "warning"] = "error",
    **context: Any,
) -> str:
    """Log ``exc`` server-side and send its client-safe message through ``ctx``.

    ``context`` holds request identifiers (never exception text). They go to
    the server log and, as ``key=value`` pairs, to the client notification.
    Returns the client message so the caller can reuse it in its response.
    """
    log_tool_exception(summary, exc, **context)
    message = tool_error_message(summary, exc)
    notification = message
    if context:
        fields = ", ".join(f"{key}={value}" for key, value in context.items())
        notification = f"{message} ({fields})"
    if level == "warning":
        await ctx.warning(notification)
    else:
        await ctx.error(notification)
    return message
