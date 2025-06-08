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
import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import Role, User

from superset import db, security_manager
from tests.integration_tests.constants import GAMMA_SQLLAB_NO_DATA_USERNAME


def create_role_with_permissions(role_name: str, permissions: list[tuple[str, str]]):
    pvm_list = [
        security_manager.add_permission_view_menu(p[0], p[1]) for p in permissions
    ]
    return security_manager.add_role(role_name, pvm_list)


def create_user_and_group(
    group_name: str,
    username: str,
    roles: list[Role],
    password: str = "password1",  # noqa: S107
):
    group = security_manager.add_group(group_name, "", "", roles=roles)
    user = security_manager.add_user(
        username,
        "gamma",
        "user",
        username,
        password=password,  # noqa: S106
        role=[],
        groups=[group],
    )
    return user, group


def cleanup(user, group):
    security_manager.get_session.delete(user)
    security_manager.get_session.delete(group)
    security_manager.get_session.commit()


@pytest.fixture
def create_gamma_user_group(app_context: AppContext):
    gamma_role = security_manager.find_role("Gamma")
    user, group = create_user_and_group("group1", "gamma_with_groups", [gamma_role])
    yield
    cleanup(user, group)


@pytest.fixture
def create_user_group_with_dar(app_context: AppContext):
    dar_role = create_role_with_permissions(
        "dar", [("datasource_access", "[examples].[birth_names](id:1)]")]
    )
    user, group = create_user_and_group("group1", "gamma_with_groups", [dar_role])
    yield
    cleanup(user, group)


@pytest.fixture
def create_gamma_user_group_with_dar(app_context: AppContext):
    dar_role = create_role_with_permissions(
        "dar",
        [
            ("datasource_access", "[examples].[birth_names](id:1)]"),
            ("all_database_access", "all_database_access"),
        ],
    )
    gamma_role = security_manager.find_role("Gamma")
    user, group = create_user_and_group(
        "group1", "gamma_with_groups", [dar_role, gamma_role]
    )
    yield
    cleanup(user, group)


@pytest.fixture
def create_gamma_user_group_with_all_database(app_context: AppContext):
    dar_role = create_role_with_permissions(
        "dar", [("all_database_access", "all_database_access")]
    )
    gamma_role = security_manager.find_role("Gamma")
    user, group = create_user_and_group(
        "group1", "gamma_with_groups", [dar_role, gamma_role]
    )
    yield
    cleanup(user, group)


@pytest.fixture
def create_gamma_sqllab_no_data(app_context: AppContext):
    gamma_role = db.session.query(Role).filter(Role.name == "Gamma").one_or_none()
    sqllab_role = db.session.query(Role).filter(Role.name == "sql_lab").one_or_none()

    security_manager.add_user(
        GAMMA_SQLLAB_NO_DATA_USERNAME,
        "gamma_sqllab_no_data",
        "gamma_sqllab_no_data",
        "gamma_sqllab_no_data@apache.org",
        [gamma_role, sqllab_role],
        password="general",  # noqa: S106
    )

    yield
    user = (
        db.session.query(User)
        .filter(User.username == GAMMA_SQLLAB_NO_DATA_USERNAME)
        .one_or_none()
    )
    db.session.delete(user)
    db.session.commit()
