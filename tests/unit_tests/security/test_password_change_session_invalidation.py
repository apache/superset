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
``superset.security.session_invalidation``) is the mechanism that forces
outstanding sessions to log out. Originally it was stamped exclusively by the
``after_update`` listener that fires when an account's ``active`` flag flips
to ``False``; these tests now cover the additional password-change paths --
self-service reset, admin-initiated reset, and the ``PUT /api/v1/me/``
self-service update -- which also stamp that epoch, so a session authenticated
before a password change stops working after it.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User

from superset import db, security_manager
from superset.daos.user import UserDAO
from superset.models.user_attributes import UserAttribute
from superset.security.manager import SupersetUserApi
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


def test_self_service_password_reset_invalidates_other_sessions(
    two_admins: tuple[User, User],
) -> None:
    """``SupersetSecurityManager.reset_password`` used for a self-service
    reset (acting user resets their own password) stamps the session epoch,
    so any other outstanding session for the account stops working after the
    password changes.
    """
    target, _actor = two_admins

    with patch("superset.security.manager.g") as mock_g:
        mock_g.user = target
        security_manager.reset_password(target.id, "BrandNewPassw0rd!")

    assert _invalidated_at(target.id) is not None


def test_admin_password_reset_invalidates_target_sessions(
    two_admins: tuple[User, User],
) -> None:
    """An admin-initiated reset of *another* user's password also stamps the
    epoch, so the target's outstanding sessions stop working -- this is the
    closest existing action to an explicit "terminate that user's sessions",
    short of disabling the account.
    """
    target, actor = two_admins

    with patch("superset.security.manager.g") as mock_g:
        mock_g.user = actor  # differs from target: an admin-initiated reset
        security_manager.reset_password(target.id, "TemporaryPassw0rd!")

    assert _invalidated_at(target.id) is not None


def test_update_me_password_change_invalidates_other_sessions(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """The ``PUT /api/v1/me/`` self-service password change (``pre_update`` +
    ``UserDAO.update`` in ``CurrentUserRestApi.update_me``) also stamps the
    session-invalidation epoch. ``admin_user`` starts with no password set, so
    no ``current_password`` proof is required for this change to go through.
    """
    api = CurrentUserRestApi()
    data = {"password": "BrandNewPassw0rd!"}

    with patch("superset.views.users.api.g") as mock_g:
        mock_g.user = admin_user
        api.pre_update(admin_user, data)
        UserDAO.update(item=admin_user, attributes=data)
    db.session.flush()

    assert _invalidated_at(admin_user.id) is not None


def test_admin_edit_user_password_via_put_invalidates_target_sessions(
    after_each: None,  # noqa: F811
) -> None:
    """An admin editing another user's password via ``PUT
    /api/v1/security/users/<pk>`` (``SupersetUserApi.pre_update``, which FAB's
    ``UserApi.put`` calls before its own commit) must also stamp the target's
    session-invalidation epoch, the same as the self-service ``/me/`` path and
    the two password-reset views -- otherwise this admin path is the one way
    to change a user's password that leaves their other sessions alive.
    """
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="Target",
        last_name="User",
        email="admin_edit_password_target@example.org",
        username="admin_edit_password_target",
        roles=[role],
    )
    db.session.add(user)
    db.session.commit()

    api = SupersetUserApi()
    api.datamodel = SQLAInterface(User, db.session)
    api.appbuilder = SimpleNamespace(
        sm=SimpleNamespace(current_user=SimpleNamespace(id=1))
    )

    api.pre_update(user, {"password": "AdminSetPassw0rd!"})

    assert _invalidated_at(user.id) is not None

    db.session.query(UserAttribute).filter_by(user_id=user.id).delete(
        synchronize_session=False
    )
    db.session.query(User).filter_by(id=user.id).delete(synchronize_session=False)
    db.session.commit()


def test_admin_edit_user_without_password_change_does_not_invalidate_sessions(
    after_each: None,  # noqa: F811
) -> None:
    """Editing a user through the same endpoint *without* touching the
    password (e.g. renaming them) must not stamp the epoch -- only an actual
    password change should force other sessions to log out.
    """
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="Target",
        last_name="User",
        email="admin_edit_no_password_target@example.org",
        username="admin_edit_no_password_target",
        roles=[role],
    )
    db.session.add(user)
    db.session.commit()

    api = SupersetUserApi()
    api.datamodel = SQLAInterface(User, db.session)
    api.appbuilder = SimpleNamespace(
        sm=SimpleNamespace(current_user=SimpleNamespace(id=1))
    )

    api.pre_update(user, {"first_name": "Renamed"})

    assert _invalidated_at(user.id) is None

    db.session.query(User).filter_by(id=user.id).delete(synchronize_session=False)
    db.session.commit()


def _make_api_for_target(user: User) -> SupersetUserApi:
    """A ``SupersetUserApi`` instance wired to a fake ``datamodel`` that
    resolves any pk lookup to ``user`` -- enough to exercise
    ``terminate_sessions`` without going through HTTP/auth plumbing, mirroring
    the pattern used in ``test_superset_user_api_subject_sync.py``.
    """
    api = SupersetUserApi()
    api.datamodel = SimpleNamespace(
        session=db.session,
        obj=User,
        get=lambda pk, base_filters=None: user,
    )
    api._base_filters = None
    return api


def test_terminate_sessions_action_stamps_target_epoch_without_disabling_account(
    after_each: None,  # noqa: F811
) -> None:
    """``SupersetUserApi.terminate_sessions`` -- the direct, explicit
    "terminate this user's sessions" admin action -- stamps the epoch for the
    target user without flipping ``active`` or otherwise touching the account,
    unlike the only other action that has this effect (disabling the user).
    """
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="Target",
        last_name="User",
        email="terminate_sessions_target@example.org",
        username="terminate_sessions_target",
        roles=[role],
    )
    db.session.add(user)
    db.session.flush()

    with patch.object(security_manager, "has_access", return_value=True):
        response = _make_api_for_target(user).terminate_sessions(user.id)

    assert response.status_code == 200
    assert _invalidated_at(user.id) is not None
    assert user.active


def test_terminate_sessions_action_404s_for_unknown_user(
    after_each: None,  # noqa: F811
) -> None:
    """A pk that doesn't resolve to a user (or is filtered out by
    ``base_filters``) 404s rather than stamping anything.
    """
    api = SupersetUserApi()
    api.datamodel = SimpleNamespace(
        session=db.session,
        obj=User,
        get=lambda pk, base_filters=None: None,
    )
    api._base_filters = None

    with patch.object(security_manager, "has_access", return_value=True):
        response = api.terminate_sessions(999999)

    assert response.status_code == 404
