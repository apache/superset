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
Backend-agnostic session invalidation.

Outstanding sessions are terminated by comparing the time a session was
authenticated (``session["_login_at"]``, stamped at login) against a per-user
invalidation epoch (``UserAttribute.sessions_invalidated_at``). When a session
predates the user's epoch it is forced to log out on its next request.

The epoch is stamped whenever an account is *disabled* (``active`` flips to
``False``), via a SQLAlchemy ``after_update`` listener so it fires regardless of
the code path that disabled the user (FAB admin UI, REST API, or CLI). This
works for both client-side cookie sessions and server-side session stores
without enumerating the store by user. A deleted user is already rejected by
Flask-Login's user loader, so deletion needs no epoch.

The mechanism is inert until an epoch is set: users that were never disabled
(NULL epoch) are never affected, so it is backwards compatible by default.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Optional

from flask import flash, session
from flask_babel import gettext as __
from flask_login import current_user, logout_user
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError
from werkzeug.wrappers import Response

logger = logging.getLogger(__name__)

#: Session key holding the epoch-seconds timestamp of when the session logged in.
SESSION_LOGIN_AT_KEY = "_login_at"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def stamp_login_time() -> None:
    """Record the current session's authentication time. Call on login."""
    session[SESSION_LOGIN_AT_KEY] = _utcnow().timestamp()


def _as_utc_timestamp(value: datetime) -> float:
    """Epoch seconds for ``value``, treating naive datetimes as UTC.

    The ``sessions_invalidated_at`` column is a naive ``DateTime`` storing a UTC
    instant; calling ``.timestamp()`` on a naive datetime would otherwise assume
    *local* time and skew the comparison by the local UTC offset.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


def is_session_invalidated(
    login_at: Optional[float], invalidated_at: Optional[datetime]
) -> bool:
    """
    Return True if a session authenticated at ``login_at`` is invalidated by an
    epoch of ``invalidated_at``.

    - No epoch (``invalidated_at is None``) ⇒ never invalidated (the common case
      and the reason the feature is inert/backwards compatible by default).
    - An epoch with no recorded login time ⇒ invalidated. A session old enough
      to predate the feature carries no ``_login_at``; if the user has since
      been disabled, fail closed.
    - Otherwise the session is invalidated iff it logged in before the epoch.
    """
    if invalidated_at is None:
        return False
    if login_at is None:
        return True
    return login_at < _as_utc_timestamp(invalidated_at)


def _get_user_invalidated_at(user: Any) -> Optional[datetime]:
    extra_attributes = getattr(user, "extra_attributes", None)
    if not extra_attributes:
        return None
    return extra_attributes[0].sessions_invalidated_at


def enforce_session_validity() -> Optional[Response]:
    """
    ``before_request`` hook: force logout of sessions invalidated by the user's
    epoch.

    Fails open — any error here logs a warning and allows the request rather
    than risk locking everyone out on a bug in the check.
    """
    try:
        user = current_user
        if not user or not getattr(user, "is_authenticated", False):
            return None
        # Guest (embedded) users are not FAB users and have their own
        # revocation mechanism; skip them.
        if getattr(user, "is_guest_user", False):
            return None
        invalidated_at = _get_user_invalidated_at(user)
        if invalidated_at is None:
            return None
        login_at = session.get(SESSION_LOGIN_AT_KEY)
        if not is_session_invalidated(login_at, invalidated_at):
            return None

        # Clear the authenticated session and let the request continue as
        # anonymous: each route's own decorator then responds correctly for its
        # type (401 for the REST API, redirect-to-login for HTML views) without
        # this hook needing to know the route kind.
        logout_user()
        session.clear()
        flash(__("Your session has ended. Please sign in again."), "warning")
        return None
    except Exception:  # noqa: BLE001  # pylint: disable=broad-except
        logger.warning(
            "Session-invalidation check failed; allowing request", exc_info=True
        )
        return None


def invalidate_user_sessions(connection: Any, user_id: int) -> None:
    """Stamp the invalidation epoch for ``user_id`` using ``connection``.

    Upserts the user's ``UserAttribute`` row so the mechanism works even for
    users that have no attribute row yet. ``user_attribute.user_id`` carries a
    unique constraint, so the insert is safe against a concurrent disable of the
    same user: the loser's insert raises ``IntegrityError``, which is caught and
    retried as an update rather than creating a duplicate row.
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.user_attributes import UserAttribute

    table = UserAttribute.__table__
    # Round the epoch up to the next whole second. Some backends (e.g. MySQL)
    # store ``DATETIME`` columns without sub-second precision and truncate the
    # value; a session that logged in earlier in the same wall-clock second
    # carries a fractional ``_login_at`` that would otherwise compare as >= the
    # truncated epoch and survive invalidation. Ceiling the stamp guarantees it
    # strictly exceeds any login time from the same second.
    now_epoch = _utcnow().timestamp()
    now = datetime.fromtimestamp(math.ceil(now_epoch), timezone.utc).replace(
        tzinfo=None
    )

    def _stamp_existing() -> int:
        return connection.execute(
            table.update()
            .where(table.c.user_id == user_id)
            .values(sessions_invalidated_at=now, changed_on=now)
        ).rowcount

    if _stamp_existing():
        return

    try:
        with connection.begin_nested():
            connection.execute(
                table.insert().values(
                    user_id=user_id,
                    sessions_invalidated_at=now,
                    created_on=now,
                    changed_on=now,
                )
            )
    except IntegrityError:
        # A concurrent disable inserted the row first; stamp it instead.
        _stamp_existing()


def _stamp_epoch_on_disable(_mapper: Any, connection: Any, target: Any) -> None:
    history = inspect(target).attrs.active.history
    # Only act when ``active`` actually changed to False — ignore the
    # last_login / login_count updates FAB writes on every login.
    if not history.has_changes() or target.active:
        return
    invalidate_user_sessions(connection, target.id)


def register_session_invalidation_events(user_model: Any) -> None:
    """Register the ``after_update`` listener that stamps the epoch on disable.

    Idempotent: safe to call on every app initialization (e.g. across tests).
    """
    if not event.contains(user_model, "after_update", _stamp_epoch_on_disable):
        event.listen(user_model, "after_update", _stamp_epoch_on_disable)
