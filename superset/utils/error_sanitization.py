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
Redaction of error details for embedded (guest token) viewers.

Errors raised while running a query are relayed verbatim to the client so chart
authors can fix them. For an embedded viewer that detail is both unusable and
sensitive: engine errors routinely quote catalog, schema, table and column
names of the underlying warehouse. Guest responses therefore carry a generic
message unless the error is one Superset authored itself.
"""

from __future__ import annotations

import dataclasses
import logging
from typing import Any

from flask_babel import lazy_gettext as _

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

logger = logging.getLogger(__name__)

GENERIC_ERROR_MESSAGE = _("An error occurred while fetching the data.")
GENERIC_ACCESS_MESSAGE = _("You don't have permission to access this resource.")

# Error types Superset raises on its own, describing an access decision, a
# malformed payload or a client-side condition. Their messages are written by
# Superset rather than echoed from the database, so they survive redaction.
SAFE_ERROR_TYPES = frozenset(
    {
        SupersetErrorType.FRONTEND_CSRF_ERROR,
        SupersetErrorType.FRONTEND_NETWORK_ERROR,
        SupersetErrorType.FRONTEND_TIMEOUT_ERROR,
        SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
        SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR,
        SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
        SupersetErrorType.MISSING_OWNERSHIP_ERROR,
        SupersetErrorType.USER_ACTIVITY_SECURITY_ACCESS_ERROR,
        SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
        SupersetErrorType.CHART_SECURITY_ACCESS_ERROR,
        SupersetErrorType.OAUTH2_REDIRECT,
        SupersetErrorType.OAUTH2_REDIRECT_ERROR,
        SupersetErrorType.BACKEND_TIMEOUT_ERROR,
        SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
        SupersetErrorType.RESULT_TOO_LARGE_ERROR,
        SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
        SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
        SupersetErrorType.MARSHMALLOW_ERROR,
    }
)

# Keys an allowlisted error may keep. ``issue_codes`` is Superset's own generic
# guidance; the OAuth2 trio drives the redirect dance in
# ``OAuth2RedirectMessage.tsx``. Everything else is dropped -- notably the
# upstream provider response ``OAuth2TokenRefreshError`` stores under
# ``extra["error"]``, which reaches the client under an allowlisted type.
SAFE_EXTRA_KEYS = frozenset({"issue_codes", "url", "tab_id", "redirect_uri"})

# Statuses reporting an authentication or authorization decision. The message is
# still replaced, but with one that reads as a denial rather than a data error.
ACCESS_STATUSES = frozenset({401, 403})


def is_sanitization_required() -> bool:
    """
    Whether the principal of the current request is an embedded guest viewer.

    This runs inside Flask's HTTP error handler, which has no handler of its own:
    if resolving the principal raises, Flask discards the intended status and
    returns a bare 500. Some Flask-Login user loaders (e.g. a JWT request loader)
    raise rather than fall back to an anonymous user when a request carries no
    valid credential, so the lookup below must never be allowed to propagate. A
    request whose principal cannot be resolved is by definition not an embedded
    guest viewer, so there is nothing to redact and ``False`` is the safe answer.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    try:
        return security_manager.is_guest_user()
    except Exception:  # pylint: disable=broad-except
        # Never let identifying the principal break the error handler itself.
        logger.warning(
            "Could not resolve the request principal while deciding whether to "
            "sanitize an error response; treating it as a non-guest request.",
            exc_info=True,
        )
        return False


def sanitize_error_message(message: str, status: int | None = None) -> str:
    """
    Replace an error message with a generic one for embedded guest viewers.

    A message is never kept on the strength of its status alone: an unstructured
    string carries no error type, so there is no way to tell an authorization
    denial from an engine error that happens to be reported as a 404. `status`
    only selects which generic message reads correctly.
    """
    if not is_sanitization_required():
        return message
    if status in ACCESS_STATUSES:
        return str(GENERIC_ACCESS_MESSAGE)
    return str(GENERIC_ERROR_MESSAGE)


def sanitize_superset_error(error: SupersetError) -> SupersetError:
    """
    Replace a ``SupersetError`` with a generic one for embedded guest viewers.

    ``extra`` is dropped along with the message: it carries engine names and, for
    some error types, the offending SQL. An allowlisted error keeps its message
    and type, but its ``extra`` is still filtered to `SAFE_EXTRA_KEYS` -- an
    allowlisted type is not a promise that everything hanging off it is safe.
    """
    if not is_sanitization_required():
        return error
    if error.error_type in SAFE_ERROR_TYPES:
        if not error.extra:
            return error
        extra = {k: v for k, v in error.extra.items() if k in SAFE_EXTRA_KEYS}
        if extra == error.extra:
            return error
        return SupersetError(
            message=error.message,
            error_type=error.error_type,
            level=error.level,
            extra=extra or None,
        )
    return SupersetError(
        message=str(GENERIC_ERROR_MESSAGE),
        error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
        level=error.level,
    )


def sanitize_superset_errors(errors: list[SupersetError]) -> list[SupersetError]:
    """
    Replace each leaky ``SupersetError`` with a generic one for guest viewers.
    """
    if not is_sanitization_required():
        return errors
    return [sanitize_superset_error(error) for error in errors]


def sanitize_error_dicts(errors: list[Any]) -> list[Any]:
    """
    Same as :func:`sanitize_superset_errors`, for already serialized errors.

    Entries that aren't ``SupersetError`` shaped — a bare string, or a dict with
    only a message — are treated as leaky and replaced wholesale.
    """
    if not is_sanitization_required():
        return errors

    sanitized = []
    for error in errors:
        payload: dict[str, Any] = (
            error if isinstance(error, dict) else {"message": str(error)}
        )
        # An unrecognized type is treated as leaky rather than raising.
        try:
            error_type = SupersetErrorType(payload["error_type"])
            level = ErrorLevel(payload.get("level", ErrorLevel.ERROR))
        except (KeyError, ValueError):
            error_type = SupersetErrorType.GENERIC_BACKEND_ERROR
            level = ErrorLevel.ERROR
        sanitized.append(
            dataclasses.asdict(
                sanitize_superset_error(
                    SupersetError(
                        message=payload.get("message", ""),
                        error_type=error_type,
                        level=level,
                        extra=payload.get("extra"),
                    )
                )
            )
        )
    return sanitized
