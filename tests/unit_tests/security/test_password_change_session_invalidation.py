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
"""Password-change paths and the session-invalidation epoch.

``UserAttribute.sessions_invalidated_at`` (see
``superset.security.session_invalidation``) is the only mechanism that forces
outstanding sessions to log out; it is currently stamped exclusively by the
``after_update`` listener that fires when an account's ``active`` flag flips
to ``False``. These tests document that none of the password-change paths --
self-service reset, admin-initiated reset, or the ``PUT /api/v1/me/``
self-service update -- stamp that epoch, so a session stolen before a
password change remains valid after it.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import User

from superset import db, security_manager
from superset.daos.user import UserDAO
from superset.models.user_attributes import UserAttribute
from superset.views.users.api import CurrentUserRestApi
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401


def _invalidated_at(user_id: int):
    attr = db.session.query(UserAttribute).filter_by(user_id=user_id).one_or_none()
    return attr.sessions_invalidated_at if attr else None


@pytest.fixture
def two_admins() -> Iterator[tuple[User, User]]:
    """Two admin-role users for the reset_password tests below.

    ``SupersetSecurityManager.reset_password`` -> FAB's ``update_user``
    hard-commits the session (``commit=True`` by default), so the rollback
    the shared ``after_each``/``admin_user`` fixtures rely on can't undo it.
    This fixture creates its own users and deletes them again on teardown so
    a committed reset doesn't leak rows into later tests.
    """
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    target = User(
        first_name="Target",
        last_name="User",
        email="session_invalidation_target@example.org",
        username="session_invalidation_target",
        roles=[role],
    )
    actor = User(
        first_name="Acting",
        last_name="Admin",
        email="session_invalidation_actor@example.org",
        username="session_invalidation_actor",
        roles=[role],
    )
    db.session.add_all([target, actor])
    db.session.commit()

    yield target, actor

    db.session.query(UserAttribute).filter(
        UserAttribute.user_id.in_([target.id, actor.id])
    ).delete(synchronize_session=False)
    db.session.query(User).filter(User.id.in_([target.id, actor.id])).delete(
        synchronize_session=False
    )
    db.session.commit()


def test_self_service_password_reset_does_not_invalidate_other_sessions(
    two_admins: tuple[User, User],
) -> None:
    """``SupersetSecurityManager.reset_password`` used for a self-service
    reset (acting user resets their own password) leaves the session epoch
    untouched, so any other outstanding session for the account keeps working
    after the password changes.
    """
    target, _actor = two_admins

    with patch("superset.security.manager.g") as mock_g:
        mock_g.user = target
        security_manager.reset_password(target.id, "BrandNewPassw0rd!")

    assert _invalidated_at(target.id) is None


def test_admin_password_reset_does_not_invalidate_target_sessions(
    two_admins: tuple[User, User],
) -> None:
    """An admin-initiated reset of *another* user's password -- the closest
    existing action to "terminate that user's sessions" -- also leaves the
    epoch untouched. There is no admin action that forces a target user's
    outstanding sessions to log out short of disabling their account.
    """
    target, actor = two_admins

    with patch("superset.security.manager.g") as mock_g:
        mock_g.user = actor  # differs from target: an admin-initiated reset
        security_manager.reset_password(target.id, "TemporaryPassw0rd!")

    assert _invalidated_at(target.id) is None


def test_update_me_password_change_does_not_invalidate_other_sessions(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """The ``PUT /api/v1/me/`` self-service password change (``pre_update`` +
    ``UserDAO.update`` in ``CurrentUserRestApi.update_me``) also never stamps
    the session-invalidation epoch.
    """
    api = CurrentUserRestApi()
    data = {"password": "BrandNewPassw0rd!"}

    with patch("superset.views.users.api.g") as mock_g:
        mock_g.user = admin_user
        api.pre_update(admin_user, data)
        UserDAO.update(item=admin_user, attributes=data)
    db.session.flush()

    assert _invalidated_at(admin_user.id) is None
