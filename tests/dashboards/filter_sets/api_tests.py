from __future__ import annotations
from typing import TYPE_CHECKING, Dict
import pytest
from flask import Response
from tests.test_app import app
from superset.dashboards.filter_sets.consts import NAME_FIELD, DESCRIPTION_FIELD, \
    JSON_METADATA_FIELD, DASHBOARD_ID_FIELD, OWNER_ID_FIELD, OWNER_TYPE_FIELD, USER_OWNER_TYPE, DASHBOARD_OWNER_TYPE
from superset.models.dashboard import Dashboard
if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
from tests.base_tests import logged_in_admin, login

CREATE_FILTER_SET_URI = "api/v1/dashboard/{dashboard_id}/filtersets"


def call_create_filter_set(client, dashboard_id, data) -> Response:
    uri = CREATE_FILTER_SET_URI.format(dashboard_id=dashboard_id)
    return client.post(uri, json=data)


@pytest.fixture
def client():
    with app.test_client() as client:
        yield client


@pytest.fixture
def dashboard() -> Dashboard:
    return Dashboard(id=1)


@pytest.fixture
def valid_json_metadata() -> Dict:
    return {
        "nativeFilters": {}
    }


@pytest.fixture
def exists_user_id():
    return 1


@pytest.fixture
def valid_filter_set_data(dashboard: Dashboard, valid_json_metadata: Dict, exists_user_id: int) -> Dict:
    dashboard_id = dashboard.id
    name = 'test_filter_set_of_dashboard_' + str(dashboard_id)
    return {
        NAME_FIELD: name,
        DESCRIPTION_FIELD: 'description of ' + name,
        JSON_METADATA_FIELD: valid_json_metadata,
        OWNER_TYPE_FIELD: USER_OWNER_TYPE,
        OWNER_ID_FIELD: exists_user_id
    }


class TestFilterSetsApi:
    class TestCreate:
        @pytest.mark.ofek
        def test_with_extra_field__400(self, client, dashboard: Dashboard, valid_filter_set_data: Dict):

            # arrange
            login(client, 'admin')
            valid_filter_set_data['extra'] = 'val'

            # act
            response = call_create_filter_set(client, dashboard.id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert response.json['message']['extra'][0] == 'Unknown field.'

        def test_with_id_field__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data['id'] = 1

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status_code == 400

        def test_with_dashboard_not_exists__404(self, not_exists_dashboard: int, valid_filter_set_data: Dict):
            # act
            response = call_create_filter_set(not_exists_dashboard, valid_filter_set_data)

            # assert
            assert response.status == 404

        def test_without_name__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(NAME_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_with_none_name__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[NAME_FIELD] = None

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_with_int_as_name__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[NAME_FIELD] = 4

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_without_description__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(DESCRIPTION_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_with_none_description__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[DESCRIPTION_FIELD] = None

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_with_int_as_description__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[DESCRIPTION_FIELD] = 1

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_without_json_metadata__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(JSON_METADATA_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_with_invalid_json_metadata__400(self, dashboard: Dashboard, valid_filter_set_data: Dict, invalid_json_metadata: Dict):
            # arrange
            valid_filter_set_data[DESCRIPTION_FIELD] = invalid_json_metadata

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_without_dashboard_id_and_owner_type_is_user__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(DASHBOARD_ID_FIELD, None)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_without_dashboard_id_and_owner_type_is_dashboard__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(DASHBOARD_ID_FIELD, None)
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_with_dashboard_id_not_same_as_uri__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[DASHBOARD_ID_FIELD] = dashboard.id + 1

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_with_dashboard_id_same_as_uri_and_owner_type_is_user__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_with_dashboard_id_same_as_uri_and_owner_type_is_dashboard__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_without_owner_type__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data.pop(OWNER_TYPE_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_with_invalid_owner_type__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = 'OTHER_TYPE'

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_without_owner_id_when_owner_type_is_user__400(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data.pop(OWNER_ID_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 400

        def test_without_owner_id_when_owner_type_is_dashboard__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
            valid_filter_set_data.pop(OWNER_ID_FIELD, None)

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 201

        def test_with_not_exists_owner__403(self, dashboard: Dashboard, valid_filter_set_data: Dict, not_exists_user_id: int):
            # arrange
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = not_exists_user_id

            # act
            response = call_create_filter_set(dashboard.id, valid_filter_set_data)

            # assert
            assert response.status == 403

        def test_when_caller_is_admin_and_owner_is_admin__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_admin_and_owner_is_dashboard_owner__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_admin_and_owner_is_regular_user__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_admin_and_owner_type_is_dashboard__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_dashboard_owner_and_owner_is_admin__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_dashboard_owner_and_owner_is_dashboard_owner__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_dashboard_owner_and_owner_is_regular_user__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_dashboard_owner_and_owner_type_is_dashboard__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_regular_user_and_owner_is_admin__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_regular_user_and_owner_is_dashboard_owner__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_regular_user_and_owner_is_regular_user__201(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

        def test_when_caller_is_regular_user_and_owner_type_is_dashboard__403(self, dashboard: Dashboard, valid_filter_set_data: Dict):
            pass

    class TestGetFilterSets:
        pass

    class TestUpdateFilterSet:
        pass

    class TestDeleteFilterSet:
        pass
