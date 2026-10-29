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

"""Unit tests for get_user_role_names."""

import logging
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.mcp_service.utils.permissions_utils import get_user_role_names


def _role(name: Any) -> SimpleNamespace:
    """Build a stand-in role with ``name``."""
    return SimpleNamespace(name=name)


def _group(*roles: Any) -> SimpleNamespace:
    """Build a stand-in group holding ``roles``."""
    return SimpleNamespace(roles=list(roles))


def _user(roles: Any = (), groups: Any = ()) -> SimpleNamespace:
    """Build a stand-in user with direct ``roles`` and ``groups``."""
    return SimpleNamespace(roles=list(roles), groups=groups)


class _DetachedRole:
    @property
    def name(self) -> str:
        raise DetachedInstanceError()


class _UserWithDetachedGroups:
    roles = [_role("Admin")]

    @property
    def groups(self) -> list[Any]:
        raise DetachedInstanceError()


def test_direct_roles() -> None:
    """Roles assigned to the user come back in order."""
    assert get_user_role_names(_user([_role("Admin"), _role("Alpha")])) == [
        "Admin",
        "Alpha",
    ]


def test_roles_granted_only_through_groups() -> None:
    """A group grants its roles to a user who holds none directly."""
    user = _user(groups=[_group(_role("editor"), _role("sql_lab"))])

    assert get_user_role_names(user) == ["editor", "sql_lab"]


def test_direct_roles_come_first_and_names_are_kept_once() -> None:
    """Direct roles lead, and a role reached twice is listed once."""
    user = _user(
        roles=[_role("Admin")],
        groups=[_group(_role("Admin"), _role("editor")), _group(_role("editor"))],
    )

    assert get_user_role_names(user) == ["Admin", "editor"]


def test_user_without_roles_or_groups() -> None:
    """A user with neither relationship yields no names."""
    assert get_user_role_names(SimpleNamespace()) == []


def test_non_iterable_roles() -> None:
    """Roles that cannot be iterated yield no names rather than raising."""
    assert get_user_role_names(SimpleNamespace(roles=42)) == []


def test_non_iterable_groups_keep_direct_roles() -> None:
    """Groups that cannot be iterated leave the direct roles in place."""
    assert get_user_role_names(_user([_role("Admin")], groups=object())) == ["Admin"]


def test_detached_groups_keep_direct_roles() -> None:
    """A detached ``groups`` relationship leaves the direct roles in place."""
    assert get_user_role_names(_UserWithDetachedGroups()) == ["Admin"]


def test_unreadable_role_names_are_skipped() -> None:
    """A role with no readable string name is skipped, the rest are kept."""
    user = _user(
        roles=[_role("Admin"), _DetachedRole(), _role(None), SimpleNamespace()],
        groups=[_group(_DetachedRole(), _role("editor"))],
    )

    assert get_user_role_names(user) == ["Admin", "editor"]


class _GroupWithDetachedRoles:
    @property
    def roles(self) -> list[Any]:
        raise DetachedInstanceError()


def test_group_with_unreadable_roles_does_not_drop_later_groups() -> None:
    """One unreadable group does not hide the groups after it."""
    user = _user(
        roles=[_role("Gamma")],
        groups=[_GroupWithDetachedRoles(), _group(_role("editor"))],
    )

    assert get_user_role_names(user) == ["Gamma", "editor"]


def test_skipped_roles_are_logged(caplog: pytest.LogCaptureFixture) -> None:
    """A skip under-reports the user's roles, so it must leave a trace."""
    user = _user(
        roles=[_role("Admin"), _DetachedRole()],
        groups=[_GroupWithDetachedRoles()],
    )

    with caplog.at_level(
        logging.DEBUG, logger="superset.mcp_service.utils.permissions_utils"
    ):
        assert get_user_role_names(user) == ["Admin"]

    messages = [record.getMessage() for record in caplog.records]
    assert "Skipping a role whose name cannot be read" in messages
    assert "Skipping the roles of a group whose roles cannot be read" in messages


def _persisted_user(session: Session) -> Any:
    from flask_appbuilder.security.sqla.models import Group, Role, User

    User.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    editor = Role(name="editor")
    user = User(
        first_name="Ana",
        last_name="Lyst",
        username="analyst",
        email="analyst@example.com",
        active=True,
        roles=[Role(name="Gamma"), editor],
        groups=[Group(name="analysts", roles=[editor, Role(name="sql_lab")])],
    )
    session.add(user)
    session.flush()
    return user


def test_matches_security_manager_roles(app_context: None, session: Session) -> None:
    """The reported names are the roles RBAC evaluates, each once."""
    from superset import security_manager

    user = _persisted_user(session)

    names = get_user_role_names(user)

    assert names == ["Gamma", "editor", "sql_lab"]
    assert set(names) == {role.name for role in security_manager.get_user_roles(user)}


def test_detached_user_keeps_roles_loaded_before_detaching(
    app_context: None, session: Session
) -> None:
    user = _persisted_user(session)
    session.expire(user, ["groups"])
    session.expunge(user)
    with pytest.raises(DetachedInstanceError):
        _ = user.groups

    assert get_user_role_names(user) == ["Gamma", "editor"]


def test_detached_user_with_nothing_loaded(app_context: None, session: Session) -> None:
    user = _persisted_user(session)
    session.expire(user)
    session.expunge(user)
    with pytest.raises(DetachedInstanceError):
        _ = user.roles

    assert get_user_role_names(user) == []
