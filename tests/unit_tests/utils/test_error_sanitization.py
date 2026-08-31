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
