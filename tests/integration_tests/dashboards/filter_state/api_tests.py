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
from unittest.mock import patch  # noqa: F401

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session  # noqa: F401

from superset import db
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,  # noqa: F401
)
from superset.commands.temporary_cache.entry import Entry
from superset.extensions import cache_manager
from superset.models.dashboard import Dashboard
from superset.temporary_cache.utils import cache_key
from superset.utils import json
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.test_app import app  # noqa: F401

KEY = "test-key"
INITIAL_VALUE = json.dumps({"test": "initial value"})
UPDATED_VALUE = json.dumps({"test": "updated value"})


@pytest.fixture
def dashboard_id(app_context: AppContext, load_world_bank_dashboard_with_slices) -> int:  # noqa: F811
    dashboard = db.session.query(Dashboard).filter_by(slug="world_health").one()
    return dashboard.id


@pytest.fixture
def admin_id(app_context: AppContext) -> int:
    admin = db.session.query(User).filter_by(username="admin").one_or_none()
    return admin.id


@pytest.fixture(autouse=True)
def cache(dashboard_id, admin_id):
    entry: Entry = {"owner": admin_id, "value": INITIAL_VALUE}
    cache_manager.filter_state_cache.set(cache_key(dashboard_id, KEY), entry)


def test_post(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state",
        json={
            "value": INITIAL_VALUE,
        },
    )
    assert resp.status_code == 201


def test_post_bad_request_non_string(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state",
        json={
            "value": 1234,
        },
    )
    assert resp.status_code == 400


def test_post_bad_request_non_json_string(
    test_client, login_as_admin, dashboard_id: int
):
    payload = {
        "value": "foo",
    }
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
    )
    assert resp.status_code == 400


def test_post_access_denied(test_client, login_as, dashboard_id: int):
    login_as("gamma")
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
    )
    assert resp.status_code == 404


def test_post_same_key_for_same_tab_id(test_client, login_as_admin, dashboard_id: int):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key == second_key


def test_post_different_key_for_different_tab_id(
    test_client, login_as_admin, dashboard_id: int
):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state?tab_id=2", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key != second_key


def test_post_different_key_for_no_tab_id(
    test_client, login_as_admin, dashboard_id: int
):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key != second_key


def test_put(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}",
        json={
            "value": UPDATED_VALUE,
        },
    )
    assert resp.status_code == 200


def test_put_same_key_for_same_tab_id(test_client, login_as_admin, dashboard_id: int):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key == second_key


def test_put_different_key_for_different_tab_id(
    test_client, login_as_admin, dashboard_id: int
):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}?tab_id=1", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}?tab_id=2", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key != second_key


def test_put_different_key_for_no_tab_id(
    test_client, login_as_admin, dashboard_id: int
):
    payload = {
        "value": INITIAL_VALUE,
    }
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    first_key = data.get("key")
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}", json=payload
    )
    data = json.loads(resp.data.decode("utf-8"))
    second_key = data.get("key")
    assert first_key != second_key


def test_put_bad_request_non_string(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}",
        json={
            "value": 1234,
        },
    )
    assert resp.status_code == 400


def test_put_bad_request_non_json_string(
    test_client, login_as_admin, dashboard_id: int
):
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}",
        json={
            "value": "foo",
        },
    )
    assert resp.status_code == 400


def test_put_access_denied(test_client, login_as, dashboard_id: int):
    login_as("gamma")
    resp = test_client.put(
        f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}",
        json={
            "value": UPDATED_VALUE,
        },
    )
    assert resp.status_code == 404


def test_get_key_not_found(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.get(f"api/v1/dashboard/{dashboard_id}/filter_state/unknown-key/")
    assert resp.status_code == 404


def test_get_dashboard_not_found(test_client, login_as_admin):
    resp = test_client.get(f"api/v1/dashboard/{-1}/filter_state/{KEY}")
    assert resp.status_code == 404


def test_get_dashboard_filter_state(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.get(f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    assert INITIAL_VALUE == data.get("value")


def test_get_access_denied(test_client, login_as, dashboard_id):
    login_as("gamma")
    resp = test_client.get(f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}")
    assert resp.status_code == 404


def test_delete(test_client, login_as_admin, dashboard_id: int):
    resp = test_client.delete(f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}")
    assert resp.status_code == 200


def test_delete_access_denied(test_client, login_as, dashboard_id: int):
    login_as("gamma")
    resp = test_client.delete(f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}")
    assert resp.status_code == 404


def test_delete_not_owner(test_client, login_as, dashboard_id: int):
    login_as("gamma")
    resp = test_client.delete(f"api/v1/dashboard/{dashboard_id}/filter_state/{KEY}")
    assert resp.status_code == 404
