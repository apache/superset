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
"""Rate limiting of the password recovery endpoints.

Kept apart from ``test_password_recovery.py`` because Flask-Limiter reads
``RATELIMIT_ENABLED`` when the app is built, so it needs its own app.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest
from flask import Flask
from flask_appbuilder.security.manager import AUTH_DB
from flask_appbuilder.security.sqla.models import User
from werkzeug.security import generate_password_hash

from superset import db, security_manager
from superset.daos.key_value import KeyValueDAO
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource
from superset.models.core import Log
from superset.security import password_recovery
from superset.security.api import RECOVERY_EMAIL_THREAD_NAME

ADMIN_URL = "/api/v1/security/password_recovery/admin/"
RESOURCES = (
    KeyValueResource.PASSWORD_RECOVERY_TOKEN.value,
    KeyValueResource.PASSWORD_RECOVERY_THROTTLE.value,
)

APP_CONFIG = {
    "AUTH_TYPE": AUTH_DB,
    "RATELIMIT_ENABLED": True,
    "AUTH_PASSWORD_RECOVERY": {
        "enabled": True,
        "base_url": "https://superset.example.org/",
        "rate_limit": "2 per minute",
    },
}


@pytest.mark.parametrize("app", [APP_CONFIG], indirect=True)
def test_request_endpoint_is_rate_limited_per_client(app: Any) -> None:
    client = app.test_client()
    statuses = [
        client.post(
            "/api/v1/security/password_recovery/",
            json={"email": f"nobody{i}@example.org"},
        ).status_code
        for i in range(3)
    ]
    assert statuses == [200, 200, 429]

    KeyValueDAO.delete_expired_entries(KeyValueResource.PASSWORD_RECOVERY_THROTTLE)


@pytest.mark.parametrize("app", [APP_CONFIG], indirect=True)
def test_reset_endpoint_is_rate_limited_per_client(app: Any) -> None:
    client = app.test_client()
    statuses = [
        client.post(
            "/api/v1/security/password_recovery/reset/",
            json={"token": f"guess-{i}", "password": "Some-Guess-Passw0rd!"},
        ).status_code
        for i in range(3)
    ]
    # Each route has its own budget: the request endpoint's three calls above
    # must not count here, so an invalid token is still answered twice.
    assert statuses == [400, 400, 429]


@pytest.fixture(scope="module", autouse=True)
def admin_recovery_permission(app: Flask) -> None:
    """Create the admin endpoint's permission, as ``superset init`` does.

    The app is built with ``update_perms=False``, so the permission the
    admin endpoint needs is never created at startup; without it every
    admin request answers 403, even for the Admin role.
    """
    with app.app_context():
        pv = security_manager.add_permission_view_menu(
            "can_admin_request_password_recovery", "PasswordRecoveryRestApi"
        )
        admin = security_manager.find_role("Admin")
        security_manager.add_permission_role(admin, pv)


def _make_user(username: str, *, role_name: str | None = "Admin") -> User:
    roles = []
    if role_name is not None:
        roles = [
            db.session.query(security_manager.role_model)
            .filter_by(name=role_name)
            .one()
        ]
    user = User(
        first_name="RateLimit",
        last_name="Test",
        username=username,
        email=f"{username}@example.org",
        active=True,
        roles=roles,
        password=generate_password_hash("Original-Passw0rd!"),  # noqa: S106
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def admin_users() -> Iterator[dict[str, Any]]:
    """An admin plus six targets, so the exemption test never hits the
    per-address resend cooldown for one user."""
    created = {"admin": _make_user("ratelimit_admin_user")}
    created["targets"] = [
        _make_user(f"ratelimit_target_user_{i}", role_name=None) for i in range(6)
    ]
    ids = [user.id for user in [created["admin"], *created["targets"]]]

    yield created

    db.session.rollback()
    db.session.query(Log).filter(Log.user_id.in_(ids)).delete(synchronize_session=False)
    db.session.query(KeyValueEntry).filter(
        KeyValueEntry.resource.in_(RESOURCES)
    ).delete(synchronize_session=False)
    for user in db.session.query(User).filter(User.id.in_(ids)).all():
        db.session.delete(user)
    db.session.commit()


def _login_as(client: Any, user: User) -> None:
    with client.session_transaction() as session:
        session["_user_id"] = str(user.id)
        session["_fresh"] = True
        session["_login_at"] = time.time() - 5


def _close(response: Any) -> None:
    """Close ``response`` as a WSGI server would and wait for the email send."""
    response.close()
    for thread in threading.enumerate():
        if thread.name == RECOVERY_EMAIL_THREAD_NAME:
            thread.join(timeout=5)


@pytest.mark.parametrize("app", [APP_CONFIG], indirect=True)
def test_admin_endpoint_is_not_rate_limited_per_client(
    app: Any, admin_users: dict[str, Any]
) -> None:
    """A signed-in admin is exempt from the self-service per-address limit.

    The limit here is 2 per minute, so a sixth send would be a 429 if the
    admin endpoint were still limited. The resend cooldown still guards
    repeat sends to one address; each target here is used once.
    """
    client = app.test_client()
    _login_as(client, admin_users["admin"])

    with patch.object(password_recovery, "send_email"):
        statuses = []
        for target in admin_users["targets"]:
            response = client.post(ADMIN_URL, json={"user_id": target.id})
            _close(response)
            statuses.append(response.status_code)

    assert statuses == [200] * 6

    KeyValueDAO.delete_expired_entries(KeyValueResource.PASSWORD_RECOVERY_THROTTLE)
