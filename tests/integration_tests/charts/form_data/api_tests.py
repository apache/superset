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
import json
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset.connectors.sqla.models import SqlaTable
from superset.datasets.commands.exceptions import DatasetAccessDeniedError
from superset.extensions import cache_manager
from superset.key_value.commands.entry import Entry
from superset.key_value.utils import cache_key
from superset.models.slice import Slice
from tests.integration_tests.base_tests import login
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app

key = "test-key"
value = "test"


@pytest.fixture
def client():
    with app.test_client() as client:
        with app.app_context():
            yield client


@pytest.fixture
def chart_id(load_world_bank_dashboard_with_slices) -> int:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        chart = session.query(Slice).filter_by(slice_name="World's Population").one()
        return chart.id


@pytest.fixture
def admin_id() -> int:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        admin = session.query(User).filter_by(username="admin").one()
        return admin.id


@pytest.fixture
def dataset_id() -> int:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        dataset = (
            session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )
        return dataset.id


@pytest.fixture(autouse=True)
def cache(chart_id, admin_id, dataset_id):
    app.config["CHART_FORM_DATA_CACHE_CONFIG"] = {"CACHE_TYPE": "SimpleCache"}
    cache_manager.init_app(app)
    entry: Entry = {"owner": admin_id, "value": value}
    cache_manager.chart_form_data_cache.set(cache_key(chart_id, key), entry)
    cache_manager.chart_form_data_cache.set(cache_key(dataset_id, key), entry)


def test_post(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    payload = {
        "value": value,
    }
    resp = client.post(
        f"api/v1/chart/{chart_id}/form_data?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 201


def test_post_bad_request(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    payload = {
        "value": 1234,
    }
    resp = client.post(
        f"api/v1/chart/{chart_id}/form_data?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 400


def test_post_access_denied(client, chart_id: int, dataset_id: int):
    login(client, "gamma")
    payload = {
        "value": value,
    }
    resp = client.post(
        f"api/v1/chart/{chart_id}/form_data?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 404


def test_put(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    payload = {
        "value": "new value",
    }
    resp = client.put(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 200


def test_put_bad_request(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    payload = {
        "value": 1234,
    }
    resp = client.put(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 400


def test_put_access_denied(client, chart_id: int, dataset_id: int):
    login(client, "gamma")
    payload = {
        "value": "new value",
    }
    resp = client.put(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 404


def test_put_not_owner(client, chart_id: int, dataset_id: int):
    login(client, "gamma")
    payload = {
        "value": "new value",
    }
    resp = client.put(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}", json=payload
    )
    assert resp.status_code == 404


def test_get_key_not_found(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    resp = client.get(
        f"api/v1/chart/{chart_id}/form_data/unknown-key?dataset_id={dataset_id}"
    )
    assert resp.status_code == 404


def test_get_chart_not_found(client, dataset_id: int):
    login(client, "admin")
    resp = client.get(f"api/v1/chart/-1/form_data/{key}?dataset_id={dataset_id}")
    assert resp.status_code == 404


def test_get(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    resp = client.get(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}"
    )
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    assert value == data.get("value")


def test_get_access_denied(client, chart_id: int, dataset_id: int):
    login(client, "gamma")
    resp = client.get(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}"
    )
    assert resp.status_code == 404


def test_get_no_dataset(client):
    login(client, "admin")
    resp = client.get(f"api/v1/chart/0/form_data/{key}")
    assert resp.status_code == 404


def test_get_dataset(client, dataset_id: int):
    login(client, "admin")
    resp = client.get(f"api/v1/chart/0/form_data/{key}?dataset_id={dataset_id}")
    assert resp.status_code == 200


def test_get_dataset_not_found(client):
    login(client, "admin")
    resp = client.get(f"api/v1/chart/0/form_data/{key}?dataset_id=-1")
    assert resp.status_code == 404


@patch("superset.security.SupersetSecurityManager.can_access_datasource")
def test_get_dataset_access_denied(mock_can_access_datasource, client, dataset_id):
    mock_can_access_datasource.side_effect = DatasetAccessDeniedError()
    login(client, "admin")
    resp = client.get(f"api/v1/chart/0/form_data/{key}?dataset_id={dataset_id}")
    assert resp.status_code == 403


def test_delete(client, chart_id: int, dataset_id: int):
    login(client, "admin")
    resp = client.delete(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}"
    )
    assert resp.status_code == 200


def test_delete_access_denied(client, chart_id: int, dataset_id: int):
    login(client, "gamma")
    resp = client.delete(
        f"api/v1/chart/{chart_id}/form_data/{key}?dataset_id={dataset_id}"
    )
    assert resp.status_code == 404


def test_delete_not_owner(client, chart_id: int, dataset_id: int, admin_id: int):
    another_key = "another_key"
    another_owner = admin_id + 1
    entry: Entry = {"owner": another_owner, "value": value}
    cache_manager.chart_form_data_cache.set(cache_key(chart_id, another_key), entry)
    login(client, "admin")
    resp = client.delete(
        f"api/v1/chart/{chart_id}/form_data/{another_key}?dataset_id={dataset_id}"
    )
    assert resp.status_code == 403
