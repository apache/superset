from __future__ import annotations
from typing import TYPE_CHECKING, Dict
import pytest
from flask import Response
from tests.test_app import app
from superset.dashboards.filter_sets.consts import NAME_FIELD, DESCRIPTION_FIELD, \
    JSON_METADATA_FIELD, OWNER_ID_FIELD, OWNER_TYPE_FIELD, USER_OWNER_TYPE, DASHBOARD_OWNER_TYPE
from superset.models.dashboard import Dashboard
from superset.models.filter_set import FilterSet
if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from flask_appbuilder.security.sqla.models import Role
    from flask_appbuilder.security.manager import BaseSecurityManager
from tests.base_tests import login
from tests.dashboards.superset_factory_util import create_database, create_datasource_table, create_slice, create_dashboard
from superset import security_manager as sm

security_manager: BaseSecurityManager = sm

CREATE_FILTER_SET_URI = "api/v1/dashboard/{dashboard_id}/filtersets"

ADMIN_USERNAME_FOR_TEST = 'admin@filterset.com'
DASHBOARD_OWNER_USERNAME = 'dash_owner_user@filterset.com'
FILTER_SET_OWNER_USERNAME = 'fs_owner_user@filterset.com'


@pytest.fixture(autouse=True, scope='module')
def test_users():
    usernames = [ADMIN_USERNAME_FOR_TEST, DASHBOARD_OWNER_USERNAME, FILTER_SET_OWNER_USERNAME]
    with app.app_context() as ctx:
        filter_set_role: Role = security_manager.add_role('filter_set_role')
        filterset_view_name = security_manager.find_view_menu('FilterSets')
        all_datasource_view_name =  security_manager.find_view_menu('all_datasource_access')
        pvms = security_manager.find_permissions_view_menu(filterset_view_name) + security_manager.find_permissions_view_menu(all_datasource_view_name)
        for pvm in pvms:
            security_manager.add_permission_role(filter_set_role, pvm)
        users = []
        admin_role = security_manager.find_role('Admin')

        for username in usernames:
            roles_to_add = [admin_role] if username == ADMIN_USERNAME_FOR_TEST else [filter_set_role]
            user = security_manager.add_user(username, 'test', 'test', username, roles_to_add, password='general')
            users.append(user)
        users = {user.username: user.id for user in users}
    yield users
    with app.app_context() as ctx:
        session = ctx.app.appbuilder.get_session
        for username in users.keys():
            session.delete(security_manager.find_user(username))
        session.commit()



def call_create_filter_set(client, dashboard_id, data) -> Response:
    uri = CREATE_FILTER_SET_URI.format(dashboard_id=dashboard_id)
    return client.post(uri, json=data)


@pytest.fixture
def client():
    with app.test_client() as client:
        yield client


@pytest.fixture
def dashboard_id() -> Dashboard:
    dashboard_id = None
    dashboard = None
    slice = None,
    datasource = None
    database = None
    try:
        with app.app_context() as ctx:
            dashboard_owner_user = security_manager.find_user(DASHBOARD_OWNER_USERNAME)
            database = create_database('test_database')
            datasource = create_datasource_table(name='test_datasource', database=database, owners=[dashboard_owner_user])
            slice = create_slice(datasource=datasource, name='test_slice', owners=[dashboard_owner_user])
            dashboard = create_dashboard(dashboard_title='test_dashboard', published=True, slices=[slice], owners=[dashboard_owner_user])
            session = ctx.app.appbuilder.get_session
            session.add(dashboard)
            session.commit()
            dashboard_id = dashboard.id
        yield dashboard_id
    except Exception as ex:
        print(str(ex))
    finally:
        with app.app_context() as ctx:
            session = ctx.app.appbuilder.get_session
            if dashboard_id is not None:
                dashboard = Dashboard.get(str(dashboard_id))
                for fs in dashboard._filter_sets:
                    session.delete(fs)
            session.delete(dashboard)
            session.delete(slice)
            session.delete(datasource)
            session.delete(database)
            session.commit()


@pytest.fixture
def valid_json_metadata() -> Dict:
    return {
        "nativeFilters": {}
    }


@pytest.fixture
def exists_user_id():
    return 1


@pytest.fixture
def valid_filter_set_data(dashboard_id: int, valid_json_metadata: Dict, exists_user_id: int) -> Dict:
    name = 'test_filter_set_of_dashboard_' + str(dashboard_id)
    return {
        NAME_FIELD: name,
        DESCRIPTION_FIELD: 'description of ' + name,
        JSON_METADATA_FIELD: valid_json_metadata,
        OWNER_TYPE_FIELD: USER_OWNER_TYPE,
        OWNER_ID_FIELD: exists_user_id
    }


@pytest.fixture
def not_exists_dashboard(dashboard_id):
    return dashboard_id + 1


def get_filter_set_by_name(name):
    with app.app_context() as ctx:
        return FilterSet.get_by_name(name)


def get_filter_set_by_dashboard_id(dashboard_id):
    with app.app_context() as ctx:
        return FilterSet.get_by_dashboard_id(dashboard_id)


@pytest.fixture
def not_exists_user_id():
    return 99999


@pytest.mark.ofek
class TestFilterSetsApi:

    class TestCreate:
        def test_with_extra_field__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data['extra'] = 'val'

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert response.json['message']['extra'][0] == 'Unknown field.'
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_with_id_field__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data['id'] = 1

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert response.json['message']['id'][0] == 'Unknown field.'
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_with_dashboard_not_exists__404(self, not_exists_dashboard: int, valid_filter_set_data: Dict, client):
            # act
            login(client, 'admin')
            response = call_create_filter_set(client, not_exists_dashboard, valid_filter_set_data)

            # assert
            assert response.status_code == 404
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_name__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data.pop(NAME_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_dashboard_id(dashboard_id) == []

        def test_with_none_name__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[NAME_FIELD] = None

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_with_int_as_name__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[NAME_FIELD] = 4

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_description__201(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data.pop(DESCRIPTION_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_with_none_description__201(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[DESCRIPTION_FIELD] = None

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_with_int_as_description__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[DESCRIPTION_FIELD] = 1

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_json_metadata__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data.pop(JSON_METADATA_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_with_invalid_json_metadata__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[DESCRIPTION_FIELD] = {}

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_owner_type__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data.pop(OWNER_TYPE_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_with_invalid_owner_type__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = 'OTHER_TYPE'

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_owner_id_when_owner_type_is_user__400(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data.pop(OWNER_ID_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_without_owner_id_when_owner_type_is_dashboard__201(self, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
            valid_filter_set_data.pop(OWNER_ID_FIELD, None)

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_with_not_exists_owner__400(self, dashboard_id: int, valid_filter_set_data: Dict, not_exists_user_id: int, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = not_exists_user_id

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 400
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

        def test_when_caller_is_admin_and_owner_is_admin__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[ADMIN_USERNAME_FOR_TEST]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_admin_and_owner_is_dashboard_owner__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[DASHBOARD_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id,
                                              valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_admin_and_owner_is_regular_user__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[FILTER_SET_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id,valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_admin_and_owner_type_is_dashboard__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, 'admin')
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = dashboard_id

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_dashboard_owner_and_owner_is_admin__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, DASHBOARD_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[ADMIN_USERNAME_FOR_TEST]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_dashboard_owner_and_owner_is_dashboard_owner__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, DASHBOARD_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[DASHBOARD_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_dashboard_owner_and_owner_is_regular_user__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, DASHBOARD_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[FILTER_SET_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_dashboard_owner_and_owner_type_is_dashboard__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, DASHBOARD_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = dashboard_id

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None


        def test_when_caller_is_regular_user_and_owner_is_admin__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, FILTER_SET_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[ADMIN_USERNAME_FOR_TEST]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_regular_user_and_owner_is_dashboard_owner__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, FILTER_SET_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[DASHBOARD_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_regular_user_and_owner_is_regular_user__201(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, FILTER_SET_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = USER_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = test_users[FILTER_SET_OWNER_USERNAME]

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 201
            assert get_filter_set_by_name(valid_filter_set_data['name']) is not None

        def test_when_caller_is_regular_user_and_owner_type_is_dashboard__403(self, test_users, dashboard_id: int, valid_filter_set_data: Dict, client):
            # arrange
            login(client, FILTER_SET_OWNER_USERNAME)
            valid_filter_set_data[OWNER_TYPE_FIELD] = DASHBOARD_OWNER_TYPE
            valid_filter_set_data[OWNER_ID_FIELD] = dashboard_id

            # act
            response = call_create_filter_set(client, dashboard_id, valid_filter_set_data)

            # assert
            assert response.status_code == 403
            assert get_filter_set_by_name(valid_filter_set_data['name']) is None

    class TestGetFilterSets:
        pass

    class TestUpdateFilterSet:
        pass

    class TestDeleteFilterSet:
        pass
