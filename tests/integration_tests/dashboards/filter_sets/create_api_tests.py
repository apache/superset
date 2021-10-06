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

from typing import Any, Dict, TYPE_CHECKING

from superset.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_TYPE,
    DESCRIPTION_FIELD,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
    USER_OWNER_TYPE,
)
from tests.integration_tests.base_tests import login
from tests.integration_tests.dashboards.filter_sets.consts import (
    ADMIN_USERNAME_FOR_TEST,
    DASHBOARD_OWNER_USERNAME,
    FILTER_SET_OWNER_USERNAME,
)
from tests.integration_tests.dashboards.filter_sets.utils import (
    call_create_filter_set,
    get_filter_set_by_dashboard_id,
    get_filter_set_by_name,
)

if TYPE_CHECKING:
    from flask.testing import FlaskClient


def assert_filterset_was_not_created(filter_set_data: Dict[str, Any]) -> None:
    assert get_filter_set_by_name(str(filter_set_data["name"])) is None


def assert_filterset_was_created(filter_set_data: Dict[str, Any]) -> None:
    assert get_filter_set_by_name(filter_set_data["name"]) is not None


class TestCreateFilterSetsApi:
    def test_with_extra_field__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create["extra"] = "val"

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert response.json["message"]["extra"][0] == "Unknown field."
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_with_id_field__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create["id"] = 1

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert response.json["message"]["id"][0] == "Unknown field."
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_with_dashboard_not_exists__404(
        self,
        not_exists_dashboard: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # act
        login(client, "admin")
        response = call_create_filter_set(
            client, not_exists_dashboard, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 404
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_name__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create.pop(NAME_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert get_filter_set_by_dashboard_id(dashboard_id) == []

    def test_with_none_name__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[NAME_FIELD] = None

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_with_int_as_name__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[NAME_FIELD] = 4

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_description__201(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create.pop(DESCRIPTION_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_with_none_description__201(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[DESCRIPTION_FIELD] = None

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_with_int_as_description__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[DESCRIPTION_FIELD] = 1

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_json_metadata__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create.pop(JSON_METADATA_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_with_invalid_json_metadata__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[DESCRIPTION_FIELD] = {}

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_owner_type__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create.pop(OWNER_TYPE_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_with_invalid_owner_type__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = "OTHER_TYPE"

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_owner_id_when_owner_type_is_user__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create.pop(OWNER_ID_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_without_owner_id_when_owner_type_is_dashboard__201(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
        valid_filter_set_data_for_create.pop(OWNER_ID_FIELD, None)

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_with_not_exists_owner__400(
        self,
        dashboard_id: int,
        valid_filter_set_data_for_create: Dict[str, Any],
        not_exists_user_id: int,
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = not_exists_user_id

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_created(valid_filter_set_data_for_create)

    def test_when_caller_is_admin_and_owner_is_admin__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            ADMIN_USERNAME_FOR_TEST
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_admin_and_owner_is_dashboard_owner__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            DASHBOARD_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_admin_and_owner_is_regular_user__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            FILTER_SET_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_admin_and_owner_type_is_dashboard__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = dashboard_id

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_dashboard_owner_and_owner_is_admin__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            ADMIN_USERNAME_FOR_TEST
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_dashboard_owner_and_owner_is_dashboard_owner__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            DASHBOARD_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_dashboard_owner_and_owner_is_regular_user__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            FILTER_SET_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_dashboard_owner_and_owner_type_is_dashboard__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = dashboard_id

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_regular_user_and_owner_is_admin__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            ADMIN_USERNAME_FOR_TEST
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_regular_user_and_owner_is_dashboard_owner__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            DASHBOARD_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_regular_user_and_owner_is_regular_user__201(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = test_users[
            FILTER_SET_OWNER_USERNAME
        ]

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 201
        assert_filterset_was_created(valid_filter_set_data_for_create)

    def test_when_caller_is_regular_user_and_owner_type_is_dashboard__403(
        self,
        dashboard_id: int,
        test_users: Dict[str, int],
        valid_filter_set_data_for_create: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)
        valid_filter_set_data_for_create[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
        valid_filter_set_data_for_create[OWNER_ID_FIELD] = dashboard_id

        # act
        response = call_create_filter_set(
            client, dashboard_id, valid_filter_set_data_for_create
        )

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_created(valid_filter_set_data_for_create)
