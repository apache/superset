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

from flask import current_app, has_request_context, request
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
    Whether the current request's error details should be redacted.

    Error details are redacted for embedded guest viewers. This runs inside
    Flask's HTTP error handler, which has no handler of its own: if resolving the
    principal raises, Flask discards the intended status and returns a bare 500.
    The lookup can raise in more than one way -- a Flask-Login user loader (e.g.
    a JWT request loader) may raise rather than fall back to an anonymous user;
    resolving a *valid* guest token itself does a metadata-DB round trip
    (``find_role``) and consults the ``EMBEDDED_SUPERSET`` feature hook, either of
    which can raise on a request whose DB session is already broken -- and a
    broken session is exactly the state the handler for a ``SQLAlchemyError`` runs
    in. The lookup below must therefore never be allowed to propagate.

    When it does raise the principal is unknown, so this makes a deliberate
    availability-over-confidentiality trade-off rather than guessing "not a
    guest". Inside a request context it falls back to whether the request even
    carries a guest token: reading headers and form fields cannot raise, anyone
    presenting a token is redacted (failing closed for the only principal whose
    errors are redacted), and a genuinely anonymous request keeps its error so
    ordinary failures are not over-sanitized. Outside a request context (e.g. a
    Celery worker, where a guest principal may be active via ``override_user`` and
    the error is delivered to the embedded viewer) there is no token to read and
    no handler-of-a-handler concern, so it fails closed and redacts.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    try:
        return security_manager.is_guest_user()
    except Exception:  # pylint: disable=broad-except
        # Never let identifying the principal break the error handler itself.
        logger.warning(
            "Could not resolve the request principal while deciding whether to "
            "sanitize an error response; falling back to the presence of a guest "
            "token.",
            exc_info=True,
        )
        if not has_request_context():
            # No request to inspect (e.g. a Celery worker running under
            # ``override_user``). Fail closed: a guest principal may be active
            # and the redacted payload is delivered to the embedded viewer.
            return True
        # Reading the token header and form field cannot raise, so this fallback
        # is itself incapable of breaking the error handler. ``.get`` on the
        # config keeps that guarantee even if the key is somehow absent.
        header_name = current_app.config.get("GUEST_TOKEN_HEADER_NAME")
        return bool(
            (header_name and request.headers.get(header_name))
            or request.form.get("guest_token")
        )


def sanitize_error_message(
    message: str, status: int | None = None, required: bool | None = None
) -> str:
    """
    Replace an error message with a generic one for embedded guest viewers.

    A message is never kept on the strength of its status alone: an unstructured
    string carries no error type, so there is no way to tell an authorization
    denial from an engine error that happens to be reported as a 404. `status`
    only selects which generic message reads correctly.

    `required` lets a caller that has already resolved the sanitization decision
    thread it in so the principal is not looked up again (``None`` computes it).
    """
    if required is None:
        required = is_sanitization_required()
    if not required:
        return message
    if status in ACCESS_STATUSES:
        return str(GENERIC_ACCESS_MESSAGE)
    return str(GENERIC_ERROR_MESSAGE)


def sanitize_superset_error(
    error: SupersetError, required: bool | None = None
) -> SupersetError:
    """
    Replace a ``SupersetError`` with a generic one for embedded guest viewers.

    ``extra`` is dropped along with the message: it carries engine names and, for
    some error types, the offending SQL. An allowlisted error keeps its message
    and type, but its ``extra`` is still filtered to `SAFE_EXTRA_KEYS` -- an
    allowlisted type is not a promise that everything hanging off it is safe.

    `required` lets a caller that has already resolved the sanitization decision
    thread it in so the principal is not looked up again (``None`` computes it).
    """
    if required is None:
        required = is_sanitization_required()
    if not required:
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


def sanitize_superset_errors(
    errors: list[SupersetError], required: bool | None = None
) -> list[SupersetError]:
    """
    Replace each leaky ``SupersetError`` with a generic one for guest viewers.

    The sanitization decision is resolved once and threaded into the per-error
    calls, so the principal is looked up a single time for the whole list rather
    than once per error.
    """
    if required is None:
        required = is_sanitization_required()
    if not required:
        return errors
    return [sanitize_superset_error(error, required=required) for error in errors]


def sanitize_error_dicts(errors: list[Any], required: bool | None = None) -> list[Any]:
    """
    Same as :func:`sanitize_superset_errors`, for already serialized errors.

    Entries that aren't ``SupersetError`` shaped — a bare string, or a dict with
    only a message — are treated as leaky and replaced wholesale.

    The sanitization decision is resolved once and threaded into the per-error
    calls, so the principal is looked up a single time for the whole list.
    """
    if required is None:
        required = is_sanitization_required()
    if not required:
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
                    ),
                    required=required,
                )
            )
        )
    return sanitized
