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

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from flask import session
from flask_appbuilder.const import AUTH_DB
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.app import SupersetApp
from superset.utils.auth_session_stamp import (
    bump_user_session_auth_stamp,
    clear_flask_login_remember_cookie,
    ensure_user_session_stamp_value,
    validate_session_auth_stamp_for_request,
)
from werkzeug.exceptions import Unauthorized


@contextmanager
def _mock_db_session(mock_session: MagicMock):
    with (
        patch("superset.utils.auth_session_stamp.db.session", mock_session),
        patch("superset.db.session", mock_session),
    ):
        yield


def test_clear_flask_login_remember_cookie(app: SupersetApp) -> None:
    with app.test_request_context():
        clear_flask_login_remember_cookie()
        assert session["_remember"] == "clear"


def test_clear_flask_login_remember_cookie_noop_without_request_context() -> None:
    clear_flask_login_remember_cookie()


def test_bump_user_session_auth_stamp_commits_session(app: SupersetApp) -> None:
    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_session.get.return_value = mock_row

    with app.test_request_context(), _mock_db_session(mock_session):
        bump_user_session_auth_stamp(42)

    mock_session.get.assert_called_once()
    assert mock_row.stamp is not None
    mock_session.commit.assert_called_once()


def test_bump_user_session_auth_stamp_inserts_when_missing(app: SupersetApp) -> None:
    mock_session = MagicMock()
    mock_session.get.return_value = None
    nested = MagicMock()
    mock_session.begin_nested.return_value = nested

    with app.test_request_context(), _mock_db_session(mock_session):
        bump_user_session_auth_stamp(42)

    mock_session.add.assert_called_once()
    mock_session.begin_nested.assert_called_once()
    mock_session.commit.assert_called_once()


def test_bump_user_session_auth_stamp_retries_update_after_integrity_error(
    app: SupersetApp,
) -> None:
    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_session.get.side_effect = [None, mock_row]
    nested = MagicMock()
    nested.__enter__ = MagicMock(side_effect=IntegrityError("insert", {}, None))
    nested.__exit__ = MagicMock(return_value=False)
    mock_session.begin_nested.return_value = nested

    with app.test_request_context(), _mock_db_session(mock_session):
        bump_user_session_auth_stamp(42)

    assert mock_row.stamp is not None
    mock_session.commit.assert_called_once()


def test_validate_stamp_skips_when_current_user_is_detached(
    app: SupersetApp,
) -> None:
    """Fail open rather than 500 when current_user is a detached SQLAlchemy object."""
    app.config["AUTH_TYPE"] = AUTH_DB
    mock_user = MagicMock()
    mock_user.is_authenticated = True
    mock_user.is_guest_user = False
    mock_user.get_id.side_effect = DetachedInstanceError()

    with (
        app.test_request_context(),
        patch("superset.utils.auth_session_stamp.current_user", mock_user),
    ):
        validate_session_auth_stamp_for_request()

    mock_user.get_id.assert_called_once()


def test_validate_stamp_uses_savepoint_on_db_error(app: SupersetApp) -> None:
    """A DB error during the stamp query must not roll back the outer session."""
    app.config["AUTH_TYPE"] = AUTH_DB
    mock_user = MagicMock()
    mock_user.is_authenticated = True
    mock_user.is_guest_user = False
    mock_user.get_id.return_value = "42"

    mock_session = MagicMock()
    nested = MagicMock()
    nested.__enter__ = MagicMock(side_effect=SQLAlchemyError("no such table"))
    nested.__exit__ = MagicMock(return_value=False)
    mock_session.begin_nested.return_value = nested

    with (
        app.test_request_context(),
        patch("superset.utils.auth_session_stamp.current_user", mock_user),
        _mock_db_session(mock_session),
    ):
        validate_session_auth_stamp_for_request()

    mock_session.begin_nested.assert_called_once()
    mock_session.rollback.assert_not_called()


def test_ensure_user_session_stamp_value_returns_existing(app: SupersetApp) -> None:
    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_row.stamp = "existing-stamp"
    mock_session.get.return_value = mock_row

    with app.test_request_context(), _mock_db_session(mock_session):
        result = ensure_user_session_stamp_value(7)

    assert result == "existing-stamp"
    mock_session.add.assert_not_called()


def test_ensure_user_session_stamp_value_retries_insert_after_integrity_error(
    app: SupersetApp,
) -> None:
    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_row.stamp = "race-winner-stamp"
    mock_session.get.side_effect = [None, mock_row]
    nested = MagicMock()
    nested.__enter__ = MagicMock(side_effect=IntegrityError("insert", {}, None))
    nested.__exit__ = MagicMock(return_value=False)
    mock_session.begin_nested.return_value = nested

    with app.test_request_context(), _mock_db_session(mock_session):
        result = ensure_user_session_stamp_value(7)

    assert result == "race-winner-stamp"
    mock_session.commit.assert_called_once()


def test_validate_stamp_adopts_missing_session_stamp(app: SupersetApp) -> None:
    """Adopt the DB stamp when the signed session cookie omits it."""
    app.config["AUTH_TYPE"] = AUTH_DB
    mock_user = MagicMock()
    mock_user.is_authenticated = True
    mock_user.is_guest_user = False
    mock_user.get_id.return_value = "42"

    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_row.stamp = "db-stamp"
    mock_session.get.return_value = mock_row
    nested = MagicMock()
    mock_session.begin_nested.return_value = nested

    with (
        app.test_request_context(),
        patch("superset.utils.auth_session_stamp.current_user", mock_user),
        _mock_db_session(mock_session),
    ):
        validate_session_auth_stamp_for_request()
        assert session["_auth_session_stamp"] == "db-stamp"


def test_validate_stamp_invalidates_outdated_session_stamp(app: SupersetApp) -> None:
    """Reject sessions that still carry a stamp rotated by a password change."""
    app.config["AUTH_TYPE"] = AUTH_DB
    mock_user = MagicMock()
    mock_user.is_authenticated = True
    mock_user.is_guest_user = False
    mock_user.get_id.return_value = "42"

    mock_session = MagicMock()
    mock_row = MagicMock()
    mock_row.stamp = "new-db-stamp"
    mock_session.get.return_value = mock_row
    nested = MagicMock()
    mock_session.begin_nested.return_value = nested

    with (
        app.test_request_context("/api/v1/me/"),
        patch("superset.utils.auth_session_stamp.current_user", mock_user),
        patch("superset.utils.auth_session_stamp.logout_user") as mock_logout,
        _mock_db_session(mock_session),
    ):
        session["_auth_session_stamp"] = "old-session-stamp"
        with pytest.raises(Unauthorized, match="Session invalidated"):
            validate_session_auth_stamp_for_request()

    mock_logout.assert_called_once()
