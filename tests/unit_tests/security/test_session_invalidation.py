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

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

from flask import session
from flask_jwt_extended.exceptions import NoAuthorizationError
from sqlalchemy.exc import IntegrityError

from superset.security.session_invalidation import (
    _as_utc_timestamp,
    _FLASK_LOGIN_USER_KEY,
    enforce_session_validity,
    invalidate_user_sessions,
    is_session_invalidated,
    SESSION_LOGIN_AT_KEY,
)


def test_no_epoch_is_never_invalidated() -> None:
    """A user that was never disabled (NULL epoch) is never invalidated."""
    assert is_session_invalidated(login_at=None, invalidated_at=None) is False
    assert is_session_invalidated(login_at=1_000.0, invalidated_at=None) is False


def test_epoch_with_no_login_time_fails_closed() -> None:
    """A pre-feature session (no _login_at) on a disabled user is invalidated."""
    epoch = datetime.now(timezone.utc)
    assert is_session_invalidated(login_at=None, invalidated_at=epoch) is True


def test_session_before_epoch_is_invalidated() -> None:
    epoch = datetime.now(timezone.utc)
    before = (epoch - timedelta(minutes=5)).timestamp()
    assert is_session_invalidated(login_at=before, invalidated_at=epoch) is True


def test_session_after_epoch_is_valid() -> None:
    """A fresh login after a disable+re-enable must not be invalidated."""
    epoch = datetime.now(timezone.utc)
    after = (epoch + timedelta(minutes=5)).timestamp()
    assert is_session_invalidated(login_at=after, invalidated_at=epoch) is False


def test_login_exactly_at_epoch_is_valid() -> None:
    epoch = datetime.now(timezone.utc)
    assert (
        is_session_invalidated(login_at=epoch.timestamp(), invalidated_at=epoch)
        is False
    )


def test_naive_epoch_is_treated_as_utc() -> None:
    """
    The DB column is a naive UTC ``DateTime``; the comparison must treat it as
    UTC, not local time (otherwise it skews by the local offset).
    """
    aware = datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)
    naive = aware.replace(tzinfo=None)
    assert _as_utc_timestamp(naive) == aware.timestamp()

    just_before = aware.timestamp() - 1
    just_after = aware.timestamp() + 1
    assert is_session_invalidated(login_at=just_before, invalidated_at=naive) is True
    assert is_session_invalidated(login_at=just_after, invalidated_at=naive) is False


MODULE = "superset.security.session_invalidation"


def _user(*, authenticated: bool = True, guest: bool = False) -> SimpleNamespace:
    return SimpleNamespace(is_authenticated=authenticated, is_guest_user=guest)


def test_enforce_skips_unauthenticated_user() -> None:
    """No authenticated user ⇒ nothing to enforce, request proceeds."""
    with (
        patch(f"{MODULE}.current_user", _user(authenticated=False)),
        patch(f"{MODULE}.logout_user") as logout,
    ):
        assert enforce_session_validity() is None
        logout.assert_not_called()


def test_enforce_skips_health_check_before_resolving_user(app: Any) -> None:
    """Health probes must not resolve current_user or touch metadata."""
    rules = [str(r) for r in app.url_map.iter_rules() if r.endpoint == "health.health"]
    assert rules, "no health probe routes registered"
    for rule in rules:
        with app.test_request_context(rule):
            with (
                patch(f"{MODULE}.current_user") as current,
                patch(f"{MODULE}.logger.warning") as warning,
                patch(f"{MODULE}.logout_user") as logout,
            ):
                assert enforce_session_validity() is None
                current.__bool__.assert_not_called()
                warning.assert_not_called()
                logout.assert_not_called()


def test_enforce_skips_request_without_session_login(app: Any) -> None:
    """
    A request carrying no session login has no session to invalidate, so the
    hook must return without resolving ``current_user``.
    """
    with app.test_request_context("/superset/welcome/"):
        with (
            patch(f"{MODULE}.current_user") as current,
            patch(f"{MODULE}.logger.warning") as warning,
            patch(f"{MODULE}.logout_user") as logout,
        ):
            assert enforce_session_validity() is None
            current.__bool__.assert_not_called()
            warning.assert_not_called()
            logout.assert_not_called()


def test_enforce_runs_for_request_with_session_login(app: Any) -> None:
    """A session login is enforced: the user's epoch is looked up."""
    with app.test_request_context("/superset/welcome/"):
        session[_FLASK_LOGIN_USER_KEY] = "1"
        with (
            patch(f"{MODULE}.current_user", _user()),
            patch(f"{MODULE}._get_user_invalidated_at", return_value=None) as get_epoch,
            patch(f"{MODULE}.logout_user") as logout,
        ):
            assert enforce_session_validity() is None
            get_epoch.assert_called_once()
            logout.assert_not_called()


def test_enforce_runs_for_remember_me_cookie(app: Any) -> None:
    """
    Flask-Login restores a "remember me" login while resolving ``current_user``,
    after this hook runs, so the cookie alone must keep the check enabled.
    """
    with app.test_request_context(
        "/superset/welcome/", headers={"Cookie": "remember_token=abc"}
    ):
        with (
            patch(f"{MODULE}.current_user", _user()),
            patch(f"{MODULE}._get_user_invalidated_at", return_value=None) as get_epoch,
        ):
            assert enforce_session_validity() is None
            get_epoch.assert_called_once()


def test_enforce_logs_raising_request_loader_at_debug(app: Any) -> None:
    """
    Deployments can install a Flask-Login ``request_loader`` that raises rather
    than returning the anonymous user. That is an ordinary unauthenticated
    request: allow it, and do not log it as a failure.
    """

    class _RaisingUser:
        def __bool__(self) -> bool:
            raise NoAuthorizationError("Missing JWT in headers or cookies")

    with app.test_request_context("/superset/welcome/"):
        session[_FLASK_LOGIN_USER_KEY] = "1"
        with (
            patch(f"{MODULE}.current_user", _RaisingUser()),
            patch(f"{MODULE}.logger") as logger,
            patch(f"{MODULE}.logout_user") as logout,
        ):
            assert enforce_session_validity() is None
            logger.warning.assert_not_called()
            logger.debug.assert_called_once()
            logout.assert_not_called()


def test_enforce_skips_guest_user() -> None:
    """Guest (embedded) users have their own revocation path and are skipped."""
    with (
        patch(f"{MODULE}.current_user", _user(guest=True)),
        patch(f"{MODULE}._get_user_invalidated_at") as get_epoch,
        patch(f"{MODULE}.logout_user") as logout,
    ):
        assert enforce_session_validity() is None
        get_epoch.assert_not_called()
        logout.assert_not_called()


def test_enforce_no_epoch_leaves_session_alone() -> None:
    """A user with no invalidation epoch is never logged out."""
    with (
        patch(f"{MODULE}.current_user", _user()),
        patch(f"{MODULE}._get_user_invalidated_at", return_value=None),
        patch(f"{MODULE}.logout_user") as logout,
    ):
        assert enforce_session_validity() is None
        logout.assert_not_called()


def test_enforce_valid_session_is_not_logged_out() -> None:
    """A session that logged in after the epoch stays authenticated."""
    epoch = datetime.now(timezone.utc)
    after = (epoch + timedelta(minutes=5)).timestamp()
    fake_session = MagicMock()
    fake_session.get.return_value = after
    with (
        patch(f"{MODULE}.current_user", _user()),
        patch(f"{MODULE}._get_user_invalidated_at", return_value=epoch),
        patch(f"{MODULE}.session", fake_session),
        patch(f"{MODULE}.logout_user") as logout,
    ):
        assert enforce_session_validity() is None
        fake_session.get.assert_called_once_with(SESSION_LOGIN_AT_KEY)
        logout.assert_not_called()


def test_enforce_invalidated_session_is_logged_out() -> None:
    """A session predating the epoch is cleared and flashed a warning."""
    epoch = datetime.now(timezone.utc)
    before = (epoch - timedelta(minutes=5)).timestamp()
    fake_session = MagicMock()
    fake_session.get.return_value = before
    with (
        patch(f"{MODULE}.current_user", _user()),
        patch(f"{MODULE}._get_user_invalidated_at", return_value=epoch),
        patch(f"{MODULE}.session", fake_session),
        patch(f"{MODULE}.logout_user") as logout,
        patch(f"{MODULE}.flash") as flash,
    ):
        assert enforce_session_validity() is None
        logout.assert_called_once()
        fake_session.clear.assert_called_once()
        flash.assert_called_once()


def test_enforce_fails_open_on_error() -> None:
    """Any error in the check logs a warning and allows the request."""
    # A real (non-guest, authenticated) user so the check reaches the epoch
    # lookup, which then raises — exercising the fail-open handler.
    user = SimpleNamespace(is_authenticated=True, is_guest_user=False)
    with (
        patch(f"{MODULE}.current_user", user),
        patch(f"{MODULE}._get_user_invalidated_at", side_effect=RuntimeError("boom")),
        patch(f"{MODULE}.logout_user") as logout,
        patch(f"{MODULE}.logger") as logger,
    ):
        assert enforce_session_validity() is None
        logout.assert_not_called()
        logger.warning.assert_called_once()


def test_invalidate_updates_existing_row() -> None:
    """When a row already exists, the upsert updates it and skips the insert."""
    connection = MagicMock()
    connection.execute.return_value.rowcount = 1
    invalidate_user_sessions(connection, user_id=7)
    # Single UPDATE, no INSERT / SAVEPOINT.
    assert connection.execute.call_count == 1
    connection.begin_nested.assert_not_called()


def test_invalidate_inserts_when_missing() -> None:
    """When no row exists, the upsert inserts one inside a SAVEPOINT."""
    connection = MagicMock()
    # First execute is the UPDATE (rowcount 0); second is the INSERT.
    connection.execute.return_value.rowcount = 0
    invalidate_user_sessions(connection, user_id=7)
    assert connection.execute.call_count == 2
    connection.begin_nested.assert_called_once()


def test_invalidate_retries_as_update_on_race() -> None:
    """If a concurrent disable wins the insert, the IntegrityError is caught
    and the row is stamped via UPDATE instead of duplicating it."""
    connection = MagicMock()
    update_result = SimpleNamespace(rowcount=0)
    retry_result = SimpleNamespace(rowcount=1)

    calls: list[str] = []

    def execute(statement, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        compiled = str(statement).strip().upper()
        if compiled.startswith("UPDATE"):
            calls.append("update")
            # First UPDATE finds nothing; the retry UPDATE succeeds.
            return retry_result if len(calls) > 1 else update_result
        calls.append("insert")
        raise IntegrityError("insert", {}, Exception())

    connection.execute.side_effect = execute
    invalidate_user_sessions(connection, user_id=7)
    # update (miss) -> insert (race loses) -> update (retry succeeds)
    assert calls == ["update", "insert", "update"]
