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
    """Register a before_request handler that enforces the per-user session stamp."""
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


def sync_session_auth_stamp_on_login(user: Any) -> None:
    """Copy the DB stamp into the signed session cookie after a successful login."""
    if not has_request_context():
        return
    uid = getattr(user, "id", None)
    if uid is None:
        return
    stamp = ensure_user_session_stamp_value(int(uid))
    session[SESSION_AUTH_STAMP_SESSION_KEY] = stamp


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


def validate_session_auth_stamp_for_request() -> None:
    """Drop login when the session cookie carries an outdated stamp for this user."""
    from superset.models.user_session_auth_stamp import UserSessionAuthStamp

    if not has_request_context():
        return
    if not getattr(current_user, "is_authenticated", False):
        return
    if getattr(current_user, "is_guest_user", False):
        return
    raw_id = current_user.get_id()
    if raw_id is None:
        return
    try:
        user_id = int(raw_id)
    except (TypeError, ValueError):
        return

    try:
        row = db.session.get(UserSessionAuthStamp, user_id)
        if row is None:
            stamp = ensure_user_session_stamp_value(user_id)
            session[SESSION_AUTH_STAMP_SESSION_KEY] = stamp
            return
    except SQLAlchemyError:
        # Fail open: a database error (for example a missing table during a
        # rolling deploy or migration mismatch) must not turn every
        # authenticated request into a 500. Skip the check for this request.
        logger.warning(
            "Skipping session auth stamp check due to a database error",
            exc_info=True,
        )
        db.session.rollback()  # pylint: disable=consider-using-transaction
        return

    # A missing stamp means the session predates stamp tracking (or was never
    # stamped). Once a DB stamp row exists, adopting it silently would let such
    # a session survive a password change, so treat a missing stamp as invalid.
    sess_stamp = session.get(SESSION_AUTH_STAMP_SESSION_KEY)
    if sess_stamp is None or sess_stamp != row.stamp:
        logout_user()
        session.clear()
