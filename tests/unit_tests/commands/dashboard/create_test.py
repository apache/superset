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
from __future__ import annotations

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture

from superset.commands.dashboard.create import CreateDashboardCommand
from superset.extensions import security_manager
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401


def test_validate_custom_role_class(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    class CustomRoleModel(Role):
        __tablename__ = "ab_role"

    monkeypatch.setattr(security_manager, "role_model", CustomRoleModel)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    owner_ids = [admin_user.id]
    role_ids = [role.id for role in admin_user.roles]

    command = CreateDashboardCommand(data={"owners": owner_ids, "roles": role_ids})
    command.validate()

    for role in command._properties["roles"]:
        assert isinstance(role, CustomRoleModel)


def test_validate_custom_user_class(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    class CustomUserModel(User):
        __tablename__ = "ab_user"

    monkeypatch.setattr(security_manager, "user_model", CustomUserModel)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    owner_ids = [admin_user.id]
    role_ids = [role.id for role in admin_user.roles]

    command = CreateDashboardCommand(data={"owners": owner_ids, "roles": role_ids})
    command.validate()

    for owner in command._properties["owners"]:
        assert isinstance(owner, CustomUserModel)


def test_validate_custom_role_and_user_class(
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    class CustomRoleModel(Role):
        __tablename__ = "ab_role"

    class CustomUserModel(User):
        __tablename__ = "ab_user"

    monkeypatch.setattr(security_manager, "role_model", CustomRoleModel)
    monkeypatch.setattr(security_manager, "user_model", CustomUserModel)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    owner_ids = [admin_user.id]
    role_ids = [role.id for role in admin_user.roles]

    command = CreateDashboardCommand(data={"owners": owner_ids, "roles": role_ids})
    command.validate()

    for role in command._properties["roles"]:
        assert isinstance(role, CustomRoleModel)

    for owner in command._properties["owners"]:
        assert isinstance(owner, CustomUserModel)
