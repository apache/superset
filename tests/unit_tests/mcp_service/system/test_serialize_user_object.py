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

from typing import Any
from unittest.mock import MagicMock

import pytest

from superset.mcp_service.system.schemas import serialize_user_object


def test_returns_none_for_none_user() -> None:
    assert serialize_user_object(None) is None


def test_returns_none_for_falsy_user() -> None:
    assert serialize_user_object(0) is None
    assert serialize_user_object("") is None


def test_extracts_basic_fields() -> None:
    user = MagicMock()
    user.id = 1
    user.username = "admin"
    user.first_name = "Ad"
    user.last_name = "Min"
    user.email = "admin@example.com"
    user.active = True
    user.roles = []

    result = serialize_user_object(user)

    assert result is not None
    assert result.id == 1
    assert result.username == "admin"
    assert result.first_name == "Ad"
    assert result.last_name == "Min"
    assert result.email == "admin@example.com"
    assert result.active is True
    assert result.roles == []


def _role(name: str) -> MagicMock:
    role = MagicMock()
    role.name = name
    return role


def _user(roles: list[Any], groups: list[Any] | None = None) -> MagicMock:
    user = MagicMock()
    user.id = 1
    user.username = "u"
    user.first_name = "U"
    user.last_name = "Ser"
    user.email = "u@example.com"
    user.active = True
    user.roles = roles
    user.groups = groups if groups is not None else []
    return user


def test_includes_roles_granted_through_groups() -> None:
    """A user whose access comes from a group is not role-less."""
    group = MagicMock()
    group.roles = [_role("editor"), _role("sql_lab")]

    result = serialize_user_object(_user(roles=[], groups=[group]))

    assert result is not None
    assert result.roles == ["editor", "sql_lab"]


def test_merges_direct_and_group_roles_without_duplicates() -> None:
    group = MagicMock()
    group.roles = [_role("Admin"), _role("editor")]

    result = serialize_user_object(_user(roles=[_role("Admin")], groups=[group]))

    assert result is not None
    assert result.roles == ["Admin", "editor"]


def test_keeps_direct_roles_when_groups_are_not_iterable() -> None:
    """A user object without a usable groups relationship still reports its
    own roles."""
    user = _user(roles=[_role("Admin")])
    user.groups = object()

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == ["Admin"]


def test_extracts_role_names_from_orm_objects() -> None:
    """The original bug: SQLAlchemy Role objects must be converted to strings."""
    role_admin = MagicMock()
    role_admin.name = "Admin"
    role_alpha = MagicMock()
    role_alpha.name = "Alpha"

    user = MagicMock()
    user.id = 1
    user.username = "admin"
    user.first_name = "Ad"
    user.last_name = "Min"
    user.email = "admin@example.com"
    user.active = True
    user.roles = [role_admin, role_alpha]

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == ["Admin", "Alpha"]


def test_handles_user_without_roles_attribute() -> None:
    user = MagicMock(
        spec=["id", "username", "first_name", "last_name", "email", "active"]
    )
    user.id = 1
    user.username = "noroles"
    user.first_name = "No"
    user.last_name = "Roles"
    user.email = "no@roles.com"
    user.active = True

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == []


def _make_user(**overrides: object) -> MagicMock:
    """Helper to create a fully-populated mock user."""
    defaults = {
        "id": 1,
        "username": "testuser",
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "active": True,
        "roles": [],
    }
    defaults.update(overrides)
    user = MagicMock()
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def test_handles_non_iterable_roles() -> None:
    user = _make_user(roles=42)

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == []


def test_skips_roles_without_name_attribute() -> None:
    role_good = MagicMock()
    role_good.name = "Admin"

    user = _make_user(roles=[role_good])

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == ["Admin"]


def test_handles_none_roles() -> None:
    user = _make_user(roles=None)

    result = serialize_user_object(user)

    assert result is not None
    assert result.roles == []


@pytest.mark.parametrize(
    "missing_field",
    ["id", "username", "first_name", "last_name", "email", "active"],
)
def test_missing_fields_default_to_none(missing_field: str) -> None:
    """Fields not present on the user object should default to None."""
    attrs = {
        "id": 1,
        "username": "test",
        "first_name": "T",
        "last_name": "U",
        "email": "t@e.com",
        "active": True,
        "roles": [],
    }
    # Remove the field under test
    del attrs[missing_field]
    user = MagicMock(spec=list(attrs.keys()))
    for k, v in attrs.items():
        setattr(user, k, v)

    result = serialize_user_object(user)

    assert result is not None
    assert getattr(result, missing_field) is None
