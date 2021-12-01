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

from typing import Any, Dict, List, TYPE_CHECKING

from tests.integration_tests.base_tests import login
from tests.integration_tests.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_USERNAME,
    FILTER_SET_OWNER_USERNAME,
    REGULAR_USER,
)
from tests.integration_tests.dashboards.filter_sets.utils import (
    call_delete_filter_set,
    collect_all_ids,
    get_filter_set_by_name,
)

if TYPE_CHECKING:
    from flask.testing import FlaskClient

    from superset.models.filter_set import FilterSet


def assert_filterset_was_not_deleted(filter_set_dict: Dict[str, Any]) -> None:
    assert get_filter_set_by_name(filter_set_dict["name"]) is not None


def assert_filterset_deleted(filter_set_dict: Dict[str, Any]) -> None:
    assert get_filter_set_by_name(filter_set_dict["name"]) is None


class TestDeleteFilterSet:
    def test_with_dashboard_exists_filterset_not_exists__200(
        self,
        dashboard_id: int,
        filtersets: Dict[str, List[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        filter_set_id = max(collect_all_ids(filtersets)) + 1

        response = call_delete_filter_set(client, {"id": filter_set_id}, dashboard_id)
        # assert
        assert response.status_code == 200

    def test_with_dashboard_not_exists_filterset_not_exists__404(
        self,
        not_exists_dashboard: int,
        filtersets: Dict[str, List[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        filter_set_id = max(collect_all_ids(filtersets)) + 1

        response = call_delete_filter_set(
            client, {"id": filter_set_id}, not_exists_dashboard
        )
        # assert
        assert response.status_code == 404

    def test_with_dashboard_not_exists_filterset_exists__404(
        self,
        not_exists_dashboard: int,
        dashboard_based_filter_set_dict: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")

        # act
        response = call_delete_filter_set(
            client, dashboard_based_filter_set_dict, not_exists_dashboard
        )
        # assert
        assert response.status_code == 404
        assert_filterset_was_not_deleted(dashboard_based_filter_set_dict)

    def test_when_caller_is_admin_and_owner_type_is_user__200(
        self,
        test_users: Dict[str, int],
        user_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        # act
        response = call_delete_filter_set(client, user_based_filter_set_dict)

        # assert
        assert response.status_code == 200
        assert_filterset_deleted(user_based_filter_set_dict)

    def test_when_caller_is_admin_and_owner_type_is_dashboard__200(
        self,
        test_users: Dict[str, int],
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        # act
        response = call_delete_filter_set(client, dashboard_based_filter_set_dict)

        # assert
        assert response.status_code == 200
        assert_filterset_deleted(dashboard_based_filter_set_dict)

    def test_when_caller_is_dashboard_owner_and_owner_is_other_user_403(
        self,
        test_users: Dict[str, int],
        user_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)

        # act
        response = call_delete_filter_set(client, user_based_filter_set_dict)

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_deleted(user_based_filter_set_dict)

    def test_when_caller_is_dashboard_owner_and_owner_type_is_dashboard__200(
        self,
        test_users: Dict[str, int],
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)

        # act
        response = call_delete_filter_set(client, dashboard_based_filter_set_dict)

        # assert
        assert response.status_code == 200
        assert_filterset_deleted(dashboard_based_filter_set_dict)

    def test_when_caller_is_filterset_owner__200(
        self,
        test_users: Dict[str, int],
        user_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)

        # act
        response = call_delete_filter_set(client, user_based_filter_set_dict)

        # assert
        assert response.status_code == 200
        assert_filterset_deleted(user_based_filter_set_dict)

    def test_when_caller_is_regular_user_and_owner_type_is_user__403(
        self,
        test_users: Dict[str, int],
        user_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, REGULAR_USER)

        # act
        response = call_delete_filter_set(client, user_based_filter_set_dict)

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_deleted(user_based_filter_set_dict)

    def test_when_caller_is_regular_user_and_owner_type_is_dashboard__403(
        self,
        test_users: Dict[str, int],
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, REGULAR_USER)

        # act
        response = call_delete_filter_set(client, dashboard_based_filter_set_dict)

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_deleted(dashboard_based_filter_set_dict)
