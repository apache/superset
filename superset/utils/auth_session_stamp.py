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
"""Session stamp: invalidate all browser sessions when a user's password changes."""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import uuid4

from flask import Flask, has_request_context, session
from flask_login import current_user, logout_user
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from superset.extensions import db
from superset.utils.decorators import transaction

logger: logging.Logger = logging.getLogger(__name__)

SESSION_AUTH_STAMP_SESSION_KEY: str = "_auth_session_stamp"
SESSION_AUTH_STAMP_VALIDATED_AT_KEY: str = "_auth_session_stamp_validated_at"
SESSION_AUTH_STAMP_VALIDATED_DB_STAMP_KEY: str = (
    "_auth_session_stamp_validated_db_stamp"
)

_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})
_STAMP_CACHE_KEY_PREFIX: str = "auth_session_stamp:"
_DEFAULT_STAMP_CACHE_TIMEOUT_SECONDS: int = 300


def _stamp_cache_key(user_id: int) -> str:
    return f"{_STAMP_CACHE_KEY_PREFIX}{user_id}"


def _get_revalidation_seconds() -> int:
    """Return ``SESSION_AUTH_STAMP_REVALIDATION_SECONDS``, defaulting on bad config."""
    from flask import current_app

    raw = current_app.config.get("SESSION_AUTH_STAMP_REVALIDATION_SECONDS", 0)
    try:
        return int(raw)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid SESSION_AUTH_STAMP_REVALIDATION_SECONDS=%r; "
            "defaulting to 0 (check on every request)",
            raw,
        )
        return 0


def _stamp_cache_timeout_seconds() -> int:
    if (revalidation_seconds := _get_revalidation_seconds()) > 0:
        return revalidation_seconds
    return _DEFAULT_STAMP_CACHE_TIMEOUT_SECONDS


def _get_cached_user_session_stamp(user_id: int) -> str | None:
    try:
        from superset.extensions import cache_manager

        cached = cache_manager.cache.get(_stamp_cache_key(user_id))
    except Exception:  # noqa: BLE001
        logger.debug(
            "Unable to read session auth stamp cache for user_id=%s",
            user_id,
            exc_info=True,
        )
        return None
    return cached if isinstance(cached, str) else None


def _cache_user_session_stamp(user_id: int, stamp: str) -> None:
    try:
        from superset.extensions import cache_manager

        cache_manager.cache.set(
            _stamp_cache_key(user_id),
            stamp,
            timeout=_stamp_cache_timeout_seconds(),
        )
    except Exception:  # noqa: BLE001
        logger.debug(
            "Unable to write session auth stamp cache for user_id=%s",
            user_id,
            exc_info=True,
        )


def register_session_auth_stamp_hook(app: Flask) -> None:
    """Register request hooks that manage the per-user session stamp."""
    if getattr(app, "superset_session_auth_stamp_hook_registered", False):
        return
    app.superset_session_auth_stamp_hook_registered = True

    @app.before_request
    def _validate_user_session_auth_stamp() -> None:  # noqa: WPS430
        """Log out requests whose session cookie carries an outdated auth stamp."""
        validate_session_auth_stamp_for_request()


@transaction()
def ensure_user_session_stamp_value(user_id: int) -> str:
    """Return the stamp for ``user_id``, inserting a stable row if missing."""
    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    row = db.session.get(UserSessionAuthStamp, user_id)
    if row is not None:
        return row.stamp
    stamp = str(uuid4())
    try:
        with db.session.begin_nested():
            db.session.add(UserSessionAuthStamp(user_id=user_id, stamp=stamp))
        return stamp
    except IntegrityError:
        row = db.session.get(UserSessionAuthStamp, user_id)
        if row is None:
            logger.exception(
                "Failed to resolve session auth stamp after IntegrityError "
                "for user_id=%s",
                user_id,
            )
            raise
        return row.stamp


def clear_flask_login_remember_cookie() -> None:
    """
    Schedule deletion of any Flask-Login remember-me cookie on the HTTP response.

    Superset does not expose remember-me in the React login flow, but Flask-Login
    and FAB still support persistent cookies when ``remember=True``. After a
    password change, clear any existing remember token so it cannot
    re-establish a session without re-authentication.
    """
    if not has_request_context():
        return
    session["_remember"] = "clear"


def _invalidate_stale_auth_session() -> None:
    """Log out, clear remember-me, and raise 401 for a stamp mismatch."""
    from werkzeug.exceptions import Unauthorized

    logout_user()
    session.clear()
    # ``session.clear()`` drops the remember marker; set it after so Flask-Login
    # still deletes any remember-me cookie on the response.
    session["_remember"] = "clear"
    raise Unauthorized("Session invalidated")


def sync_session_auth_stamp_on_login(user: Any) -> None:
    """Copy the DB stamp into the signed session cookie after a successful login."""
    if not has_request_context():
        return
    uid = getattr(user, "id", None)
    if uid is None:
        return
    user_id = int(uid)
    stamp = ensure_user_session_stamp_value(user_id)
    session[SESSION_AUTH_STAMP_SESSION_KEY] = stamp
    _mark_session_stamp_validated(stamp)
    _cache_user_session_stamp(user_id, stamp)


def cache_user_session_auth_stamp(user_id: int, stamp: str) -> None:
    """Write a validated session auth stamp into the shared cache."""
    _cache_user_session_stamp(user_id, stamp)


@transaction()
def bump_user_session_auth_stamp(user_id: int) -> str:
    """Assign a new stamp so every other session for this user becomes invalid."""
    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    new_stamp = str(uuid4())
    row = db.session.get(UserSessionAuthStamp, user_id)
    if row is None:
        try:
            with db.session.begin_nested():
                db.session.add(UserSessionAuthStamp(user_id=user_id, stamp=new_stamp))
            return new_stamp
        except IntegrityError:
            row = db.session.get(UserSessionAuthStamp, user_id)
            if row is None:
                logger.exception(
                    "Failed to resolve session auth stamp after IntegrityError "
                    "for user_id=%s",
                    user_id,
                )
                raise
    row.stamp = new_stamp
    return new_stamp


def _resolve_stamp_check_user_id() -> int | None:
    """Return the integer user id for the stamp check, or None to skip it."""
    from flask import current_app
    from flask_appbuilder.const import AUTH_DB
    from sqlalchemy.orm.exc import DetachedInstanceError

    if not has_request_context():
        return None
    # The stamp is only ever bumped on AUTH_DB password changes; skip the DB
    # hit for other auth backends where the stamp never changes after login.
    if current_app.config.get("AUTH_TYPE") != AUTH_DB:
        return None
    if not getattr(current_user, "is_authenticated", False):
        return None
    if getattr(current_user, "is_guest_user", False):
        return None
    try:
        raw_id = current_user.get_id()
    except DetachedInstanceError:
        # The user object was detached from the session (e.g. after a rollback
        # in a previous before_request hook). Fail open — Flask-Login will
        # reload the user on the next request.
        logger.warning(
            "Skipping session auth stamp check: current_user is detached",
            exc_info=True,
        )
        return None
    if raw_id is None:
        return None
    try:
        return int(raw_id)
    except (TypeError, ValueError):
        return None


def _should_skip_stamp_db_lookup(
    user_id: int, method: str, sess_stamp: str | None
) -> bool:
    """Return True when a recent DB check lets us skip another on read-only traffic."""
    if method not in _SAFE_METHODS or sess_stamp is None:
        return False

    revalidation_seconds = _get_revalidation_seconds()
    if revalidation_seconds <= 0:
        return False

    validated_at = session.get(SESSION_AUTH_STAMP_VALIDATED_AT_KEY)
    if validated_at is None:
        return False
    try:
        elapsed = time.time() - float(validated_at)
    except (TypeError, ValueError):
        return False
    if elapsed >= revalidation_seconds:
        return False

    # Only skip when this session still carries the stamp we last validated and
    # the shared cache agrees (so password rotation on another client is visible).
    if session.get(SESSION_AUTH_STAMP_VALIDATED_DB_STAMP_KEY) != sess_stamp:
        return False
    cached_stamp = _get_cached_user_session_stamp(user_id)
    return cached_stamp == sess_stamp


def _mark_session_stamp_validated(db_stamp: str | None = None) -> None:
    session[SESSION_AUTH_STAMP_VALIDATED_AT_KEY] = time.time()
    if db_stamp is not None:
        session[SESSION_AUTH_STAMP_VALIDATED_DB_STAMP_KEY] = db_stamp
    session.modified = True


def _load_db_stamp_for_user(
    user_id: int, *, use_cache: bool = True
) -> tuple[str | None, bool]:
    """
    Return ``(stamp, db_error)``.

    ``db_error`` is True when the database lookup failed and the check should
    fail open. ``stamp`` is None when no row exists.
    """
    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    if use_cache:
        cached_stamp = _get_cached_user_session_stamp(user_id)
        if cached_stamp is not None:
            return cached_stamp, False

    try:
        with db.session.begin_nested():
            row = db.session.get(UserSessionAuthStamp, user_id)
            db_stamp = row.stamp if row is not None else None
    except SQLAlchemyError:
        logger.warning(
            "Skipping session auth stamp check due to a database error",
            exc_info=True,
        )
        return None, True

    if db_stamp is not None:
        _cache_user_session_stamp(user_id, db_stamp)
    return db_stamp, False


def validate_session_auth_stamp_for_request() -> None:
    """Drop login when the session cookie carries an outdated stamp for this user."""
    from flask import request as flask_request

    user_id = _resolve_stamp_check_user_id()
    if user_id is None:
        logger.debug(
            "Stamp validation skipped: no user_id for %s %s",
            flask_request.method,
            flask_request.path,
        )
        return

    sess_stamp = session.get(SESSION_AUTH_STAMP_SESSION_KEY)
    if _should_skip_stamp_db_lookup(user_id, flask_request.method, sess_stamp):
        logger.debug(
            "Session auth stamp DB check skipped (recently validated) for user_id=%s "
            "on %s %s",
            user_id,
            flask_request.method,
            flask_request.path,
        )
        return

    db_stamp, db_error = _load_db_stamp_for_user(
        user_id,
        use_cache=(
            flask_request.method in _SAFE_METHODS and _get_revalidation_seconds() > 0
        ),
    )
    if db_error:
        return

    if db_stamp is None:
        # No stamp row means the session predates stamp tracking. Allow the
        # request without a check — sync_session_auth_stamp_on_login creates
        # the row on every login, so this only occurs for sessions that
        # pre-date the feature or whose row was removed independently.
        # Committing inside a before_request hook would expire SQLAlchemy
        # objects loaded by earlier hooks and can cause DetachedInstanceError
        # in route handlers, so we never create the row here.
        logger.debug(
            "Session auth stamp check skipped: no DB stamp row for user_id=%s on %s %s",
            user_id,
            flask_request.method,
            flask_request.path,
        )
        return

    # Compare the session cookie stamp against the authoritative DB value.
    logger.debug(
        "Validating session stamp for user_id=%s on %s %s: sess_stamp=%s, db_stamp=%s",
        user_id,
        flask_request.method,
        flask_request.path,
        sess_stamp,
        db_stamp,
    )
    if sess_stamp is None or sess_stamp != db_stamp:
        # Fresh interactive logins may omit the stamp during rollout (or right
        # after ``login_user`` before ``on_user_login`` syncs it). Adopt the DB
        # value only for those sessions. Non-fresh sessions — typically
        # restored from a remember-me cookie — must not adopt after a password
        # change, or a lingering remember token would re-authenticate without
        # credentials.
        if sess_stamp is None and db_stamp is not None and session.get("_fresh"):
            session[SESSION_AUTH_STAMP_SESSION_KEY] = db_stamp
            _mark_session_stamp_validated(db_stamp)
            _cache_user_session_stamp(user_id, db_stamp)
            return
        logger.info(
            "Session stamp mismatch for user_id=%s on %s %s: invalidating session",
            user_id,
            flask_request.method,
            flask_request.path,
        )
        _invalidate_stale_auth_session()

    _mark_session_stamp_validated(db_stamp)
