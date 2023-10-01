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
# isort:skip_file
"""Unit tests for Superset"""
import unittest
from typing import Optional

import pytest
from flask.ctx import AppContext
from pytest_mock import MockFixture
from sqlalchemy import inspect

from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,
    load_energy_table_data,
)
from tests.integration_tests.test_app import app  # isort:skip
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from superset.utils.core import get_user_id, get_username, override_user
from superset.utils.database import get_example_database

from .base_tests import SupersetTestCase

ROLE_TABLES_PERM_DATA = {
    "role_name": "override_me",
    "database": [
        {
            "datasource_type": "table",
            "name": "examples",
            "schema": [{"name": "", "datasources": ["birth_names"]}],
        }
    ],
}

ROLE_ALL_PERM_DATA = {
    "role_name": "override_me",
    "database": [
        {
            "datasource_type": "table",
            "name": "examples",
            "schema": [{"name": "", "datasources": ["birth_names"]}],
        },
    ],
}

EXTEND_ROLE_REQUEST = (
    "/superset/approve?datasource_type={}&datasource_id={}&"
    "created_by={}&role_to_extend={}"
)
GRANT_ROLE_REQUEST = (
    "/superset/approve?datasource_type={}&datasource_id={}&"
    "created_by={}&role_to_grant={}"
)
TEST_ROLE_1 = "test_role1"
TEST_ROLE_2 = "test_role2"
DB_ACCESS_ROLE = "db_access_role"
SCHEMA_ACCESS_ROLE = "schema_access_role"


class TestRequestAccess(SupersetTestCase):
    @classmethod
    def setUpClass(cls):
        with app.app_context():
            security_manager.add_role("override_me")
            security_manager.add_role(TEST_ROLE_1)
            security_manager.add_role(TEST_ROLE_2)
            security_manager.add_role(DB_ACCESS_ROLE)
            security_manager.add_role(SCHEMA_ACCESS_ROLE)
            db.session.commit()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            override_me = security_manager.find_role("override_me")
            db.session.delete(override_me)
            db.session.delete(security_manager.find_role(TEST_ROLE_1))
            db.session.delete(security_manager.find_role(TEST_ROLE_2))
            db.session.delete(security_manager.find_role(DB_ACCESS_ROLE))
            db.session.delete(security_manager.find_role(SCHEMA_ACCESS_ROLE))
            db.session.commit()

    def setUp(self):
        self.login("admin")

    def tearDown(self):
        self.logout()
        override_me = security_manager.find_role("override_me")
        override_me.permissions = []
        db.session.commit()
        db.session.close()


@pytest.mark.parametrize(
    "username,user_id",
    [
        (None, None),
        ("alpha", 5),
        ("gamma", 2),
    ],
)
def test_get_user_id(
    app_context: AppContext,
    mocker: MockFixture,
    username: Optional[str],
    user_id: Optional[int],
) -> None:
    mock_g = mocker.patch("superset.utils.core.g", spec={})
    mock_g.user = security_manager.find_user(username)
    assert get_user_id() == user_id


@pytest.mark.parametrize(
    "username",
    [
        None,
        "alpha",
        "gamma",
    ],
)
def test_get_username(
    app_context: AppContext,
    mocker: MockFixture,
    username: Optional[str],
) -> None:
    mock_g = mocker.patch("superset.utils.core.g", spec={})
    mock_g.user = security_manager.find_user(username)
    assert get_username() == username


@pytest.mark.parametrize("username", [None, "alpha", "gamma"])
@pytest.mark.parametrize("force", [False, True])
def test_override_user(
    app_context: AppContext,
    mocker: MockFixture,
    username: str,
    force: bool,
) -> None:
    mock_g = mocker.patch("superset.utils.core.g", spec={})
    admin = security_manager.find_user(username="admin")
    user = security_manager.find_user(username)

    with override_user(user, force):
        assert mock_g.user == user

    assert not hasattr(mock_g, "user")

    mock_g.user = None

    with override_user(user, force):
        assert mock_g.user == user

    assert mock_g.user is None

    mock_g.user = admin

    with override_user(user, force):
        assert mock_g.user == user if force else admin

    assert mock_g.user == admin


if __name__ == "__main__":
    unittest.main()
