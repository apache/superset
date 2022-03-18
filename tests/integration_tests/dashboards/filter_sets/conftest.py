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

import json
from typing import Any, Dict, Generator, List, TYPE_CHECKING

import pytest

from superset import db, security_manager as sm
from superset.dashboards.filter_sets.consts import (
    DESCRIPTION_FIELD,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
    USER_OWNER_TYPE,
)
from superset.models.dashboard import Dashboard
from superset.models.filter_set import FilterSet
from tests.integration_tests.dashboards.filter_sets.consts import (
    ADMIN_USERNAME_FOR_TEST,
    DASHBOARD_OWNER_USERNAME,
    FILTER_SET_OWNER_USERNAME,
    REGULAR_USER,
)
from tests.integration_tests.dashboards.superset_factory_util import (
    create_dashboard,
    create_database,
    create_datasource_table,
    create_slice,
)
from tests.integration_tests.test_app import app

if TYPE_CHECKING:
    from flask.ctx import AppContext
    from flask.testing import FlaskClient
    from flask_appbuilder.security.manager import BaseSecurityManager
    from flask_appbuilder.security.sqla.models import (
        PermissionView,
        Role,
        User,
        ViewMenu,
    )
    from sqlalchemy.orm import Session

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice


security_manager: BaseSecurityManager = sm


@pytest.fixture(autouse=True, scope="module")
def test_users() -> Generator[Dict[str, int], None, None]:
    usernames = [
        ADMIN_USERNAME_FOR_TEST,
        DASHBOARD_OWNER_USERNAME,
        FILTER_SET_OWNER_USERNAME,
        REGULAR_USER,
    ]
    with app.app_context():
        filter_set_role = build_filter_set_role()
        admin_role: Role = security_manager.find_role("Admin")
        usernames_to_ids = create_test_users(admin_role, filter_set_role, usernames)
        yield usernames_to_ids
        delete_users(usernames_to_ids)


def delete_users(usernames_to_ids: Dict[str, int]) -> None:
    for username in usernames_to_ids.keys():
        db.session.delete(security_manager.find_user(username))
    db.session.commit()


def create_test_users(
    admin_role: Role, filter_set_role: Role, usernames: List[str]
) -> Dict[str, int]:
    users: List[User] = []
    for username in usernames:
        user = build_user(username, filter_set_role, admin_role)
        users.append(user)
    return {user.username: user.id for user in users}


def build_user(username: str, filter_set_role: Role, admin_role: Role) -> User:
    roles_to_add = (
        [admin_role] if username == ADMIN_USERNAME_FOR_TEST else [filter_set_role]
    )
    user: User = security_manager.add_user(
        username, "test", "test", username, roles_to_add, password="general"
    )
    if not user:
        user = security_manager.find_user(username)
        if user is None:
            raise Exception("Failed to build the user {}".format(username))
    return user


def build_filter_set_role() -> Role:
    filter_set_role: Role = security_manager.add_role("filter_set_role")
    filterset_view_name: ViewMenu = security_manager.find_view_menu("FilterSets")
    all_datasource_view_name: ViewMenu = security_manager.find_view_menu(
        "all_datasource_access"
    )
    pvms: List[PermissionView] = security_manager.find_permissions_view_menu(
        filterset_view_name
    ) + security_manager.find_permissions_view_menu(all_datasource_view_name)
    for pvm in pvms:
        security_manager.add_permission_role(filter_set_role, pvm)
    return filter_set_role


@pytest.fixture
def client() -> Generator[FlaskClient[Any], None, None]:
    with app.test_client() as client:
        yield client


@pytest.fixture
def dashboard(app_context) -> Generator[Dashboard, None, None]:
    dashboard_owner_user = security_manager.find_user(DASHBOARD_OWNER_USERNAME)
    database = create_database("test_database_filter_sets")
    datasource = create_datasource_table(
        name="test_datasource", database=database, owners=[dashboard_owner_user]
    )
    slice_ = create_slice(
        datasource=datasource, name="test_slice", owners=[dashboard_owner_user]
    )
    dashboard = create_dashboard(
        dashboard_title="test_dashboard",
        published=True,
        slices=[slice_],
        owners=[dashboard_owner_user],
    )
    db.session.add(dashboard)
    db.session.commit()

    yield dashboard

    db.session.delete(dashboard)
    db.session.delete(slice_)
    db.session.delete(datasource)
    db.session.delete(database)
    db.session.commit()


@pytest.fixture
def dashboard_id(dashboard: Dashboard) -> Generator[int, None, None]:
    yield dashboard.id


@pytest.fixture
def filtersets(
    dashboard_id: int, test_users: Dict[str, int], dumped_valid_json_metadata: str
) -> Generator[Dict[str, List[FilterSet]], None, None]:
    first_filter_set = FilterSet(
        name="filter_set_1_of_" + str(dashboard_id),
        dashboard_id=dashboard_id,
        json_metadata=dumped_valid_json_metadata,
        owner_id=dashboard_id,
        owner_type="Dashboard",
    )
    second_filter_set = FilterSet(
        name="filter_set_2_of_" + str(dashboard_id),
        json_metadata=dumped_valid_json_metadata,
        dashboard_id=dashboard_id,
        owner_id=dashboard_id,
        owner_type="Dashboard",
    )
    third_filter_set = FilterSet(
        name="filter_set_3_of_" + str(dashboard_id),
        json_metadata=dumped_valid_json_metadata,
        dashboard_id=dashboard_id,
        owner_id=test_users[FILTER_SET_OWNER_USERNAME],
        owner_type="User",
    )
    fourth_filter_set = FilterSet(
        name="filter_set_4_of_" + str(dashboard_id),
        json_metadata=dumped_valid_json_metadata,
        dashboard_id=dashboard_id,
        owner_id=test_users[FILTER_SET_OWNER_USERNAME],
        owner_type="User",
    )
    db.session.add(first_filter_set)
    db.session.add(second_filter_set)
    db.session.add(third_filter_set)
    db.session.add(fourth_filter_set)
    db.session.commit()

    yield {
        "Dashboard": [first_filter_set, second_filter_set],
        FILTER_SET_OWNER_USERNAME: [third_filter_set, fourth_filter_set],
    }

    db.session.delete(first_filter_set)
    db.session.delete(second_filter_set)
    db.session.delete(third_filter_set)
    db.session.delete(fourth_filter_set)
    db.session.commit()


@pytest.fixture
def filterset_id(filtersets: Dict[str, List[FilterSet]]) -> int:
    return filtersets["Dashboard"][0].id


@pytest.fixture
def valid_json_metadata() -> Dict[str, Any]:
    return {"nativeFilters": {}}


@pytest.fixture
def dumped_valid_json_metadata(valid_json_metadata: Dict[str, Any]) -> str:
    return json.dumps(valid_json_metadata)


@pytest.fixture
def exists_user_id() -> int:
    return 1


@pytest.fixture
def valid_filter_set_data_for_create(
    dashboard_id: int, dumped_valid_json_metadata: str, exists_user_id: int
) -> Dict[str, Any]:
    name = "test_filter_set_of_dashboard_" + str(dashboard_id)
    return {
        NAME_FIELD: name,
        DESCRIPTION_FIELD: "description of " + name,
        JSON_METADATA_FIELD: dumped_valid_json_metadata,
        OWNER_TYPE_FIELD: USER_OWNER_TYPE,
        OWNER_ID_FIELD: exists_user_id,
    }


@pytest.fixture
def valid_filter_set_data_for_update(
    dashboard_id: int, dumped_valid_json_metadata: str, exists_user_id: int
) -> Dict[str, Any]:
    name = "name_changed_test_filter_set_of_dashboard_" + str(dashboard_id)
    return {
        NAME_FIELD: name,
        DESCRIPTION_FIELD: "changed description of " + name,
        JSON_METADATA_FIELD: dumped_valid_json_metadata,
    }


@pytest.fixture
def not_exists_dashboard_id(dashboard_id: int) -> Generator[int, None, None]:
    yield dashboard_id + 1


@pytest.fixture
def not_exists_user_id() -> int:
    return 99999


@pytest.fixture()
def dashboard_based_filter_set_dict(
    filtersets: Dict[str, List[FilterSet]]
) -> Dict[str, Any]:
    return filtersets["Dashboard"][0].to_dict()


@pytest.fixture()
def user_based_filter_set_dict(
    filtersets: Dict[str, List[FilterSet]]
) -> Dict[str, Any]:
    return filtersets[FILTER_SET_OWNER_USERNAME][0].to_dict()
