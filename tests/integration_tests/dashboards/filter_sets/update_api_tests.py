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
from typing import Any, Dict, List, TYPE_CHECKING

from superset.dashboards.filter_sets.consts import (
    DESCRIPTION_FIELD,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_TYPE_FIELD,
    PARAMS_PROPERTY,
)
from tests.integration_tests.base_tests import login
from tests.integration_tests.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_USERNAME,
    FILTER_SET_OWNER_USERNAME,
    REGULAR_USER,
)
from tests.integration_tests.dashboards.filter_sets.utils import (
    call_update_filter_set,
    collect_all_ids,
    get_filter_set_by_name,
)

if TYPE_CHECKING:
    from flask.testing import FlaskClient
    from superset.models.filter_set import FilterSet


def merge_two_filter_set_dict(
    first: Dict[Any, Any], second: Dict[Any, Any]
) -> Dict[Any, Any]:
    for d in [first, second]:
        if JSON_METADATA_FIELD in d:
            if PARAMS_PROPERTY not in d:
                d.setdefault(PARAMS_PROPERTY, json.loads(d[JSON_METADATA_FIELD]))
            d.pop(JSON_METADATA_FIELD)
    return {**first, **second}


def assert_filterset_was_not_updated(filter_set_dict: Dict[str, Any]) -> None:
    assert filter_set_dict == get_filter_set_by_name(filter_set_dict["name"]).to_dict()


def assert_filterset_updated(
    filter_set_dict_before: Dict[str, Any], data_updated: Dict[str, Any]
) -> None:
    expected_data = merge_two_filter_set_dict(filter_set_dict_before, data_updated)
    assert expected_data == get_filter_set_by_name(expected_data["name"]).to_dict()


class TestUpdateFilterSet:
    def test_with_dashboard_exists_filterset_not_exists__404(
        self,
        dashboard_id: int,
        filtersets: Dict[str, List[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        filter_set_id = max(collect_all_ids(filtersets)) + 1

        response = call_update_filter_set(
            client, {"id": filter_set_id}, {}, dashboard_id
        )
        # assert
        assert response.status_code == 404

    def test_with_dashboard_not_exists_filterset_not_exists__404(
        self,
        not_exists_dashboard: int,
        filtersets: Dict[str, List[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        filter_set_id = max(collect_all_ids(filtersets)) + 1

        response = call_update_filter_set(
            client, {"id": filter_set_id}, {}, not_exists_dashboard
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
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, {}, not_exists_dashboard
        )
        # assert
        assert response.status_code == 404
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_extra_field__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update["extra"] = "val"

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert response.json["message"]["extra"][0] == "Unknown field."
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_id_field__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update["id"] = 1

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert response.json["message"]["id"][0] == "Unknown field."
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_none_name__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[NAME_FIELD] = None

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_int_as_name__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[NAME_FIELD] = 4

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_without_name__200(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update.pop(NAME_FIELD, None)

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

    def test_with_none_description__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[DESCRIPTION_FIELD] = None

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_int_as_description__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[DESCRIPTION_FIELD] = 1

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_without_description__200(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update.pop(DESCRIPTION_FIELD, None)

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

    def test_with_invalid_json_metadata__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[DESCRIPTION_FIELD] = {}

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_json_metadata__200(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        valid_json_metadata: Dict[Any, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_json_metadata["nativeFilters"] = {"changed": "changed"}
        valid_filter_set_data_for_update[JSON_METADATA_FIELD] = json.dumps(
            valid_json_metadata
        )

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

    def test_with_invalid_owner_type__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[OWNER_TYPE_FIELD] = "OTHER_TYPE"

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_user_owner_type__400(
        self,
        dashboard_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[OWNER_TYPE_FIELD] = "User"

        # act
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 400
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)

    def test_with_dashboard_owner_type__200(
        self,
        user_based_filter_set_dict: Dict[str, Any],
        valid_filter_set_data_for_update: Dict[str, Any],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        valid_filter_set_data_for_update[OWNER_TYPE_FIELD] = "Dashboard"

        # act
        response = call_update_filter_set(
            client, user_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        user_based_filter_set_dict["owner_id"] = user_based_filter_set_dict[
            "dashboard_id"
        ]
        assert_filterset_updated(
            user_based_filter_set_dict, valid_filter_set_data_for_update
        )

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
        response = call_update_filter_set(
            client, user_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            user_based_filter_set_dict, valid_filter_set_data_for_update
        )

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
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

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
        response = call_update_filter_set(
            client, user_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_updated(user_based_filter_set_dict)

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
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

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
        response = call_update_filter_set(
            client, user_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 200
        assert_filterset_updated(
            user_based_filter_set_dict, valid_filter_set_data_for_update
        )

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
        response = call_update_filter_set(
            client, user_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_updated(user_based_filter_set_dict)

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
        response = call_update_filter_set(
            client, dashboard_based_filter_set_dict, valid_filter_set_data_for_update
        )

        # assert
        assert response.status_code == 403
        assert_filterset_was_not_updated(dashboard_based_filter_set_dict)
