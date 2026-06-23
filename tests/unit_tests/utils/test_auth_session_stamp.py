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

from flask import session
from sqlalchemy.exc import IntegrityError

from superset.app import SupersetApp
from superset.utils.auth_session_stamp import (
    bump_user_session_auth_stamp,
    clear_flask_login_remember_cookie,
)


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
