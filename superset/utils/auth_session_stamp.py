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
from typing import Any
from uuid import uuid4

from flask import Flask, has_request_context, session
from flask_login import current_user, logout_user
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from superset.extensions import db
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

SESSION_AUTH_STAMP_SESSION_KEY = "_auth_session_stamp"


def register_session_auth_stamp_hook(app: Flask) -> None:
    """Register login and request hooks that manage the per-user session stamp."""
    if getattr(app, "superset_session_auth_stamp_hook_registered", False):
        return
    app.superset_session_auth_stamp_hook_registered = True

    from flask_login import user_logged_in

    if not getattr(app, "superset_session_auth_stamp_login_connected", False):
        app.superset_session_auth_stamp_login_connected = True

        @user_logged_in.connect
        def _sync_stamp_after_login(
            sender: Flask, user: Any, **extra: Any
        ) -> None:  # noqa: ARG001
            """Copy the DB stamp into the session after Flask-Login finalizes it."""
            sync_session_auth_stamp_on_login(user)

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


def sync_session_auth_stamp_on_login(user: Any) -> None:
    """Copy the DB stamp into the signed session cookie after a successful login."""
    if not has_request_context():
        return
    uid = getattr(user, "id", None)
    if uid is None:
        return
    stamp = ensure_user_session_stamp_value(int(uid))
    session[SESSION_AUTH_STAMP_SESSION_KEY] = stamp
    session.modified = True


@transaction()
def bump_user_session_auth_stamp(user_id: int) -> None:
    """Assign a new stamp so every other session for this user becomes invalid."""
    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    new_stamp = str(uuid4())
    row = db.session.get(UserSessionAuthStamp, user_id)
    if row is None:
        try:
            with db.session.begin_nested():
                db.session.add(UserSessionAuthStamp(user_id=user_id, stamp=new_stamp))
            return
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


def validate_session_auth_stamp_for_request() -> None:
    """Drop login when the session cookie carries an outdated stamp for this user."""
    from flask import request as flask_request

    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    user_id = _resolve_stamp_check_user_id()
    if user_id is None:
        logger.debug(
            "Stamp validation skipped: no user_id for %s %s",
            flask_request.method,
            flask_request.path,
        )
        return

    # Read the stamp as a plain Python string inside the savepoint so the
    # comparison never touches an expired SQLAlchemy attribute.  In SQLAlchemy
    # 1.4, releasing a savepoint (exiting begin_nested) can expire all loaded
    # ORM objects when expire_on_commit is True; accessing row.stamp after the
    # block would force a reload whose result depends on the outer transaction
    # state.  Capturing it as a local string avoids that entirely.
    db_stamp: str | None = None
    try:
        # Use a savepoint so a DB failure (e.g. missing table during a rolling
        # deploy) only rolls back the nested transaction, not the outer one.
        # Rolling back the outer session expires every object in it — including
        # the current_user — and causes DetachedInstanceError in later hooks.
        with db.session.begin_nested():
            row = db.session.get(UserSessionAuthStamp, user_id)
            db_stamp = row.stamp if row is not None else None
    except SQLAlchemyError:
        # Fail open: skip the check rather than turning every authenticated
        # request into a 500.
        logger.warning(
            "Skipping session auth stamp check due to a database error",
            exc_info=True,
        )
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

    # A missing stamp means the session predates stamp tracking (or was never
    # stamped). Once a DB stamp row exists, adopting it silently would let such
    # a session survive a password change, so treat a missing stamp as invalid.
    sess_stamp = session.get(SESSION_AUTH_STAMP_SESSION_KEY)
    logger.debug(
        "Validating session stamp for user_id=%s on %s %s: sess_stamp=%s, db_stamp=%s",
        user_id,
        flask_request.method,
        flask_request.path,
        sess_stamp,
        db_stamp,
    )
    if sess_stamp is None or sess_stamp != db_stamp:
        # Sessions authenticated before stamp tracking, or a login that did not
        # persist the stamp into the signed cookie, carry no sess stamp. Adopt
        # the current DB value so the request can proceed; password rotation
        # still invalidates sessions that carry an outdated non-null stamp.
        if sess_stamp is None and db_stamp is not None:
            session[SESSION_AUTH_STAMP_SESSION_KEY] = db_stamp
            session.modified = True
            return
        logger.info(
            "Session stamp mismatch for user_id=%s on %s %s: invalidating session",
            user_id,
            flask_request.method,
            flask_request.path,
        )
        logout_user()
        session.clear()
        # Immediately return 401 Unauthorized to reject the request with
        # an invalid session, rather than relying on the @protect() decorator
        from werkzeug.exceptions import Unauthorized

        raise Unauthorized("Session invalidated")
