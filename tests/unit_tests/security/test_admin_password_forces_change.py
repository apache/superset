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
"""A password an administrator sets through ``SupersetUserApi`` is temporary.

With ``ENABLE_FORCE_PASSWORD_CHANGE`` on, creating a user with a password
(``POST /api/v1/security/users/``) or setting another user's password from the
Users list edit modal (``PUT /api/v1/security/users/<pk>``) raises the
``password_must_change`` flag, so the account owner has to choose their own at
next login. Before this, nothing in the tree ever raised the flag, so turning
the setting on enforced nothing.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.manager import AUTH_DB, AUTH_OAUTH
from flask_appbuilder.security.sqla.models import User

from superset import db, security_manager
from superset.security.manager import SupersetUserApi
from superset.security.password_change import password_change_required
from tests.unit_tests.fixtures.common import after_each  # noqa: F401


@pytest.fixture
def force_password_change(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(app.config, "ENABLE_FORCE_PASSWORD_CHANGE", True)
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_DB)


def _user(username: str, persisted: bool = True) -> User:
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="Target",
        last_name="User",
        email=f"{username}@example.org",
        username=username,
        roles=[role],
        password="irrelevant-pre-hash-value",  # noqa: S106
    )
    if persisted:
        db.session.add(user)
        db.session.flush()
    return user


def _api(acting_user_id: int | None = None) -> SupersetUserApi:
    """A ``SupersetUserApi`` acting as ``acting_user_id``, or as a separate
    admin when omitted (FAB stamps the actor into ``changed_by_fk``, so it has
    to be a real row)."""
    if acting_user_id is None:
        acting_user_id = _user("acting_admin").id
    api = SupersetUserApi()
    api.datamodel = SQLAInterface(User, db.session)
    api.appbuilder = SimpleNamespace(
        sm=SimpleNamespace(current_user=SimpleNamespace(id=acting_user_id))
    )
    return api


def test_admin_setting_a_password_requires_a_change(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_admin_put")

    _api().pre_update(user, {"password": "AdminSetPassw0rd!"})

    assert password_change_required(user)


def test_admin_creating_a_user_requires_a_change(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_admin_post", persisted=False)

    _api().pre_add(user)

    assert password_change_required(user)


def test_admin_editing_their_own_password_does_not_require_a_change(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_self_edit")

    _api(acting_user_id=user.id).pre_update(user, {"password": "MyOwnPassw0rd!"})

    assert not password_change_required(user)


def test_admin_editing_their_own_password_clears_a_pending_change(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_self_clear")
    _api().pre_update(user, {"password": "AdminSetPassw0rd!"})
    assert password_change_required(user)

    _api(acting_user_id=user.id).pre_update(user, {"password": "MyOwnPassw0rd!"})

    assert not password_change_required(user)


def test_flag_is_not_raised_for_non_db_auth(
    app: Flask,
    after_each: None,  # noqa: F811
    force_password_change: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Under OAuth/LDAP/remote-user auth users never sign in with this
    password, so making them change it would only lock them out."""
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_OAUTH)
    user = _user("forced_change_oauth", persisted=False)

    _api().pre_add(user)

    assert not password_change_required(user)


def test_edit_without_a_password_does_not_require_a_change(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_rename")

    _api().pre_update(user, {"first_name": "Renamed"})

    assert not password_change_required(user)


def test_flag_is_not_raised_while_the_setting_is_off(
    app: Flask,
    after_each: None,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(app.config, "ENABLE_FORCE_PASSWORD_CHANGE", False)
    user = _user("forced_change_setting_off")

    _api().pre_update(user, {"password": "AdminSetPassw0rd!"})

    assert not password_change_required(user)


def test_flag_rides_fabs_commit_instead_of_committing_early(
    after_each: None,  # noqa: F811
    force_password_change: None,
) -> None:
    user = _user("forced_change_no_early_commit")

    commit = MagicMock(wraps=db.session.commit)
    with patch.object(db.session, "commit", commit):
        _api().pre_update(user, {"password": "AdminSetPassw0rd!"})

    assert commit.call_count == 0
    assert password_change_required(user)
