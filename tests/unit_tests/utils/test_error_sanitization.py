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
from __future__ import annotations

from typing import Iterator, TYPE_CHECKING
from unittest.mock import patch

import pytest

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.error_sanitization import (
    GENERIC_ACCESS_MESSAGE,
    GENERIC_ERROR_MESSAGE,
    is_sanitization_required,
    sanitize_error_dicts,
    sanitize_error_message,
    sanitize_superset_error,
    sanitize_superset_errors,
)

if TYPE_CHECKING:
    from superset.app import SupersetApp

DB_ERROR = "syntax error at or near mydb.myschema.mytable"


@pytest.fixture
def guest() -> Iterator[None]:
    with patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        return_value=True,
    ):
        yield


@pytest.fixture
def not_guest() -> Iterator[None]:
    with patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        return_value=False,
    ):
        yield


def test_message_is_kept_for_regular_users(app: SupersetApp, not_guest: None) -> None:
    assert sanitize_error_message(DB_ERROR) == DB_ERROR


def test_message_is_replaced_for_guest_users(app: SupersetApp, guest: None) -> None:
    assert sanitize_error_message(DB_ERROR) == str(GENERIC_ERROR_MESSAGE)


def test_db_error_is_replaced_for_guest_users(app: SupersetApp, guest: None) -> None:
    sanitized = sanitize_superset_error(
        SupersetError(
            message=DB_ERROR,
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
            extra={"engine_name": "BigQuery"},
        )
    )
    assert sanitized.message == str(GENERIC_ERROR_MESSAGE)
    assert sanitized.error_type == SupersetErrorType.GENERIC_BACKEND_ERROR
    assert sanitized.level == ErrorLevel.ERROR
    assert "engine_name" not in (sanitized.extra or {})


def test_safe_error_types_survive_for_guest_users(
    app: SupersetApp, guest: None
) -> None:
    error = SupersetError(
        message="You don't have access to this datasource",
        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )
    assert sanitize_superset_error(error) == error


def test_errors_are_untouched_for_regular_users(
    app: SupersetApp, not_guest: None
) -> None:
    errors = [
        SupersetError(
            message=DB_ERROR,
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
        )
    ]
    assert sanitize_superset_errors(errors) == errors


def test_serialized_errors_are_replaced_for_guest_users(
    app: SupersetApp, guest: None
) -> None:
    sanitized = sanitize_error_dicts(
        [
            {
                "message": DB_ERROR,
                "error_type": SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                "level": ErrorLevel.ERROR,
                "extra": {"engine_name": "BigQuery"},
            }
        ]
    )
    assert sanitized[0]["message"] == str(GENERIC_ERROR_MESSAGE)
    assert sanitized[0]["error_type"] == SupersetErrorType.GENERIC_BACKEND_ERROR
    assert "engine_name" not in sanitized[0]["extra"]


def test_untyped_serialized_errors_are_replaced_for_guest_users(
    app: SupersetApp, guest: None
) -> None:
    """Async jobs report plain strings and bare ``{"message": ...}`` dicts."""
    sanitized = sanitize_error_dicts([DB_ERROR, {"message": DB_ERROR}])
    assert [error["message"] for error in sanitized] == [str(GENERIC_ERROR_MESSAGE)] * 2


def test_allowlisted_error_keeps_only_safe_extra_keys(
    app: SupersetApp, guest: None
) -> None:
    """
    ``OAuth2TokenRefreshError`` carries the upstream provider's response body in
    ``extra["error"]`` under an allowlisted type, so an allowlisted type alone
    can't vouch for everything hanging off it.
    """
    sanitized = sanitize_superset_error(
        SupersetError(
            message="OAuth2 token refresh failed, re-authentication required.",
            error_type=SupersetErrorType.OAUTH2_REDIRECT,
            level=ErrorLevel.WARNING,
            extra={"error": "invalid_grant: token revoked by admin@example.com"},
        )
    )
    assert (
        sanitized.message == "OAuth2 token refresh failed, re-authentication required."
    )
    assert sanitized.error_type == SupersetErrorType.OAUTH2_REDIRECT
    assert "error" not in (sanitized.extra or {})


def test_allowlisted_error_keeps_the_oauth2_redirect_payload(
    app: SupersetApp, guest: None
) -> None:
    """The redirect dance in OAuth2RedirectMessage.tsx needs these three."""
    extra = {
        "url": "https://accounts.example.com/o/oauth2/v2/auth?...",
        "tab_id": "tab-123",
        "redirect_uri": "https://superset.example.com/oauth2/redirect",
    }
    sanitized = sanitize_superset_error(
        SupersetError(
            message="You don't have permission to access the data.",
            error_type=SupersetErrorType.OAUTH2_REDIRECT,
            level=ErrorLevel.WARNING,
            extra=dict(extra),
        )
    )
    assert sanitized.extra == extra


def test_access_status_selects_the_denial_message(
    app: SupersetApp, guest: None
) -> None:
    assert sanitize_error_message("Forbidden", 403) == str(GENERIC_ACCESS_MESSAGE)
    assert sanitize_error_message(DB_ERROR, 404) == str(GENERIC_ERROR_MESSAGE)


def test_unresolvable_anonymous_principal_is_not_redacted(app: SupersetApp) -> None:
    """
    ``is_sanitization_required`` runs inside the HTTP error handler, which has no
    handler of its own: a raising user loader (e.g. a JWT request loader that
    raises when no credential is present) would otherwise turn every error
    response into a bare 500. The lookup must swallow the failure -- but instead
    of guessing "not a guest" it falls back to whether the request carries a
    guest token. A genuinely anonymous request (no token) is left untouched, so
    ordinary failures are not over-sanitized. This is a deliberate
    availability-over-confidentiality trade-off, not a definitional truth: an
    unresolvable principal is not "by definition" a non-guest.
    """
    is_guest_user = patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        side_effect=RuntimeError("no valid credential on request"),
    )
    with app.test_request_context("/"), is_guest_user as mock_is_guest_user:
        assert is_sanitization_required() is False
        assert sanitize_error_message(DB_ERROR) == DB_ERROR
        assert mock_is_guest_user.called


def test_unresolvable_principal_with_guest_token_is_redacted(app: SupersetApp) -> None:
    """
    Locks the fail-closed direction: a request that *carries* a guest token whose
    resolution raises (e.g. ``find_role`` hitting a broken DB session while
    resolving a valid token, or the ``EMBEDDED_SUPERSET`` feature hook raising)
    must still be redacted. Reading the token header cannot raise, so the guard
    fails closed for the one principal whose errors it exists to protect rather
    than disclosing the raw engine error to a genuine embedded guest.
    """
    header = app.config["GUEST_TOKEN_HEADER_NAME"]
    is_guest_user = patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        side_effect=RuntimeError("find_role on a broken session"),
    )
    with (
        app.test_request_context("/", headers={header: "a.guest.token"}),
        is_guest_user as mock_is_guest_user,
    ):
        assert is_sanitization_required() is True
        assert sanitize_error_message(DB_ERROR) == str(GENERIC_ERROR_MESSAGE)
        assert mock_is_guest_user.called


def test_unresolvable_principal_with_form_guest_token_is_redacted(
    app: SupersetApp,
) -> None:
    """The token can also arrive in the ``guest_token`` form field, not a header."""
    is_guest_user = patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        side_effect=RuntimeError("find_role on a broken session"),
    )
    with (
        app.test_request_context(
            "/", method="POST", data={"guest_token": "a.guest.token"}
        ),
        is_guest_user as mock_is_guest_user,
    ):
        assert is_sanitization_required() is True
        assert sanitize_error_message(DB_ERROR) == str(GENERIC_ERROR_MESSAGE)
        assert mock_is_guest_user.called


def test_unresolvable_principal_without_request_context_fails_closed(
    app: SupersetApp,
) -> None:
    """
    In a Celery worker there is no request context: ``sanitize_error_dicts`` runs
    inside ``override_user`` while writing the async job payload delivered to the
    embedded viewer. There is no token to read and no handler-of-a-handler
    concern, so an unresolvable principal fails closed and redacts.
    """
    is_guest_user = patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        side_effect=RuntimeError("no request context in a worker"),
    )
    with app.app_context(), is_guest_user as mock_is_guest_user:
        assert is_sanitization_required() is True
        assert sanitize_error_message(DB_ERROR) == str(GENERIC_ERROR_MESSAGE)
        assert mock_is_guest_user.called
