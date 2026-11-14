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
"""Machine-minted sessions and the per-user session-invalidation epoch.

``MachineAuthProvider.get_auth_cookies`` builds the session cookie used by
report execution (CSV/XLSX chart-data fetches and browser screenshots). That
cookie is replayed against the real application, so it has to pass the
``enforce_session_validity`` ``before_request`` hook for users whose
``UserAttribute.sessions_invalidated_at`` epoch is set (for example after a
password change). These tests drive the real hook; nothing in
``superset.security.session_invalidation`` is mocked.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from flask import g
from flask_appbuilder.security.sqla.models import User
from flask_login import current_user
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset import db, security_manager
from superset.models.user_attributes import UserAttribute
from superset.security.session_invalidation import (
    invalidate_sessions_for_user,
    SESSION_LOGIN_AT_KEY,
)
from superset.utils.machine_auth import MachineAuthProvider
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401

# A route that requires an authenticated user and accepts a browser session
# cookie answers 401 to an anonymous request and 200 to an authenticated one.
AUTHENTICATED_ENDPOINT = "/api/v1/me/"


@pytest.fixture(autouse=True)
def grant_permissions_to_authenticated_users(mocker: MockerFixture) -> None:
    """Grant every permission to authenticated users and none to anonymous ones.

    The unit-test metadata database has no synced permissions, which would
    otherwise turn every authenticated request into a 403. Authentication itself
    (the session cookie and ``enforce_session_validity``) is left untouched: an
    anonymous request still falls through to the JWT check and gets a 401.
    """
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda *_args, **_kwargs: current_user.is_authenticated,
    )


def _epoch_timestamp(user_id: int) -> float:
    attribute = db.session.query(UserAttribute).filter_by(user_id=user_id).one()
    return attribute.sessions_invalidated_at.replace(tzinfo=timezone.utc).timestamp()


def _invalidate_sessions_in_the_past(user_id: int) -> None:
    """Stamp the user's epoch as of a few minutes ago, via the real stamping path."""
    with freeze_time(datetime.now(timezone.utc) - timedelta(minutes=5)):
        invalidate_sessions_for_user(user_id)


def _replay(app: Any, client: Any, cookies: dict[str, str]) -> Any:
    """Send the machine-minted cookies to the app as a browser would.

    Flask-Login caches the resolved user on ``g``, and the unit-test app context
    (shared with ``get_auth_cookies``) outlives each request. Drop that cache so
    the request authenticates from the replayed cookie alone.
    """
    g.pop("_login_user", None)
    for name, value in cookies.items():
        client.set_cookie(name, value, domain=app.config["SERVER_NAME"])
    return client.get(AUTHENTICATED_ENDPOINT)


def test_machine_auth_cookie_authenticates_without_epoch(
    app: Any,
    client: Any,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """Control: with no invalidation epoch the machine-minted cookie is accepted."""
    cookies = MachineAuthProvider.get_auth_cookies(admin_user)

    response = _replay(app, client, cookies)

    assert response.status_code == 200


def test_machine_auth_cookie_survives_epoch(
    app: Any,
    client: Any,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """A report executor whose password changed must still get a usable session.

    Changing a password stamps the user's invalidation epoch. A session minted
    for report execution *after* that change is a fresh authentication, so it
    must carry a login time that the epoch does not invalidate.

    The epoch is stamped in the past because ``invalidate_user_sessions`` rounds
    it up to the next whole second, which would otherwise reject any session
    minted within that same second regardless of its login time.
    """
    _invalidate_sessions_in_the_past(admin_user.id)

    cookies = MachineAuthProvider.get_auth_cookies(admin_user)
    response = _replay(app, client, cookies)

    assert response.status_code == 200, (
        "machine-minted session was rejected by enforce_session_validity "
        f"(status {response.status_code}); the session carries no "
        f"{SESSION_LOGIN_AT_KEY!r}, so it is treated as older than the epoch"
    )


def test_session_stamped_after_epoch_authenticates(
    client: Any,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """Control: a session whose login time is after the epoch is accepted."""
    invalidate_sessions_for_user(admin_user.id)
    epoch = _epoch_timestamp(admin_user.id)

    with client.session_transaction() as flask_session:
        flask_session["_user_id"] = str(admin_user.id)
        flask_session[SESSION_LOGIN_AT_KEY] = epoch + 1

    assert client.get(AUTHENTICATED_ENDPOINT).status_code == 200


def test_session_stamped_before_epoch_is_rejected(
    client: Any,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """Control: invalidation still ends sessions that predate the epoch."""
    invalidate_sessions_for_user(admin_user.id)
    epoch = _epoch_timestamp(admin_user.id)

    with client.session_transaction() as flask_session:
        flask_session["_user_id"] = str(admin_user.id)
        flask_session[SESSION_LOGIN_AT_KEY] = epoch - 60

    assert client.get(AUTHENTICATED_ENDPOINT).status_code == 401


def test_machine_auth_refuses_inactive_user(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """An inactive user gets no cookies, so callers can report missing auth."""
    admin_user.active = False
    db.session.flush()

    assert MachineAuthProvider.get_auth_cookies(admin_user) == {}
