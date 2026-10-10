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
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture

from superset.commands.dashboard.create import CreateDashboardCommand
from superset.extensions import security_manager
from superset.subjects.models import Subject
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401


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

    editor_ids = [admin_user.id]

    command = CreateDashboardCommand(data={"editors": editor_ids})
    command.validate()

    # editors should be Subject instances
    for editor in command._properties["editors"]:
        assert isinstance(editor, Subject)


def test_validate_absent_slug_stays_none(
    mocker: MockerFixture,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """An absent slug must reach the uniqueness check as ``None``, not ``""``.

    ``DashboardDAO.validate_slug_uniqueness`` deliberately checks empty
    strings (only ``None`` skips the check), so defaulting an absent slug to
    ``""`` would run the check as ``slug == ""`` — and once any dashboard row
    carries an empty-string slug, every slugless create would fail with
    ``DashboardSlugExistsValidationError``. An explicitly provided empty
    string, by contrast, must still be checked verbatim.
    """
    from superset.daos.dashboard import DashboardDAO

    mocker.patch.object(security_manager, "is_admin", return_value=True)
    validate_slug = mocker.patch.object(
        DashboardDAO, "validate_slug_uniqueness", return_value=True
    )

    CreateDashboardCommand(data={"editors": [admin_user.id]}).validate()
    validate_slug.assert_called_once_with(None)

    validate_slug.reset_mock()
    CreateDashboardCommand(data={"editors": [admin_user.id], "slug": ""}).validate()
    validate_slug.assert_called_once_with("")
