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

from superset.commands.explore.form_data.state import TemporaryExploreState
from superset.connectors.sqla.models import SqlaTable
from superset.explore.exceptions import DatasetAccessDeniedError
from superset.extensions import cache_manager
from superset.models.slice import Slice
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app

FORM_DATA_KEY = "form_data_key"
FORM_DATA = {"test": "test value"}


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
def dataset() -> int:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        dataset = (
            session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )
        return dataset


@pytest.fixture(autouse=True)
def cache(chart_id, admin_id, dataset):
    entry: TemporaryExploreState = {
        "owner": admin_id,
        "datasource_id": dataset.id,
        "datasource_type": dataset.type,
        "chart_id": chart_id,
        "form_data": json.dumps(FORM_DATA),
    }
    cache_manager.explore_form_data_cache.set(FORM_DATA_KEY, entry)


# partially match the dataset using the most important attributes
def assert_dataset(result, dataset_id):
    dataset = result["dataset"]
    assert dataset["id"] == dataset_id
    assert dataset["datasource_name"] == "wb_health_population"
    assert dataset["is_sqllab_view"] == False
    assert dataset["main_dttm_col"] == "year"
    assert dataset["sql"] == None
    assert dataset["type"] == "table"
    assert dataset["uid"] == f"{dataset_id}__table"


# partially match the slice using the most important attributes
def assert_slice(result, chart_id, dataset_id):
    slice = result["slice"]
    assert slice["edit_url"] == f"/chart/edit/{chart_id}"
    assert slice["is_managed_externally"] == False
    assert slice["slice_id"] == chart_id
    assert slice["slice_name"] == "World's Population"
    assert slice["form_data"]["datasource"] == f"{dataset_id}__table"
    assert slice["form_data"]["viz_type"] == "big_number"


def test_no_params_provided(test_client, login_as_admin):
    resp = test_client.get(f"api/v1/explore/")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert result["dataset"]["name"] == "[Missing Dataset]"
    assert result["form_data"]["datasource"] == "None__table"
    assert result["message"] == None
    assert result["slice"] == None


def test_get_from_cache(test_client, login_as_admin, dataset):
    resp = test_client.get(
        f"api/v1/explore/?form_data_key={FORM_DATA_KEY}&datasource_id={dataset.id}&datasource_type={dataset.type}"
    )
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert_dataset(result, dataset.id)
    assert result["form_data"]["datasource"] == f"{dataset.id}__table"
    assert result["form_data"]["test"] == "test value"
    assert result["message"] == None
    assert result["slice"] == None


def test_get_from_cache_unknown_key_chart_id(
    test_client, login_as_admin, chart_id, dataset
):
    unknown_key = "unknown_key"
    resp = test_client.get(
        f"api/v1/explore/?form_data_key={unknown_key}&slice_id={chart_id}"
    )
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert_dataset(result, dataset.id)
    assert_slice(result, chart_id, dataset.id)
    assert result["form_data"]["datasource"] == f"{dataset.id}__table"
    assert (
        result["message"]
        == "Form data not found in cache, reverting to chart metadata."
    )


def test_get_from_cache_unknown_key_dataset(test_client, login_as_admin, dataset):
    unknown_key = "unknown_key"
    resp = test_client.get(
        f"api/v1/explore/?form_data_key={unknown_key}&datasource_id={dataset.id}&datasource_type={dataset.type}"
    )
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert_dataset(result, dataset.id)
    assert result["form_data"]["datasource"] == f"{dataset.id}__table"
    assert (
        result["message"]
        == "Form data not found in cache, reverting to dataset metadata."
    )
    assert result["slice"] == None


def test_get_from_cache_unknown_key_no_extra_parameters(test_client, login_as_admin):
    unknown_key = "unknown_key"
    resp = test_client.get(f"api/v1/explore/?form_data_key={unknown_key}")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert result["dataset"]["name"] == "[Missing Dataset]"
    assert result["form_data"]["datasource"] == "None__table"
    assert result["message"] == None
    assert result["slice"] == None


def test_get_from_permalink(test_client, login_as_admin, chart_id, dataset):
    form_data = {
        "chart_id": chart_id,
        "datasource": f"{dataset.id}__{dataset.type}",
        **FORM_DATA,
    }
    resp = test_client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    data = json.loads(resp.data.decode("utf-8"))
    permalink_key = data["key"]
    resp = test_client.get(f"api/v1/explore/?permalink_key={permalink_key}")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")
    assert_dataset(result, dataset.id)
    assert result["form_data"]["datasource"] == f"{dataset.id}__table"
    assert result["form_data"]["test"] == "test value"
    assert result["message"] == None
    assert result["slice"] == None


def test_get_from_permalink_unknown_key(test_client, login_as_admin):
    unknown_key = "unknown_key"
    resp = test_client.get(f"api/v1/explore/?permalink_key={unknown_key}")
    assert resp.status_code == 404


@patch("superset.security.SupersetSecurityManager.can_access_datasource")
def test_get_dataset_access_denied(
    mock_can_access_datasource, test_client, login_as_admin, dataset
):
    message = "Dataset access denied"
    mock_can_access_datasource.side_effect = DatasetAccessDeniedError(
        message=message, datasource_id=dataset.id, datasource_type=dataset.type
    )
    resp = test_client.get(
        f"api/v1/explore/?form_data_key={FORM_DATA_KEY}&datasource_id={dataset.id}&datasource_type={dataset.type}"
    )
    data = json.loads(resp.data.decode("utf-8"))
    assert resp.status_code == 403
    assert data["datasource_id"] == dataset.id
    assert data["datasource_type"] == dataset.type
    assert data["message"] == message


@patch("superset.daos.datasource.DatasourceDAO.get_datasource")
def test_wrong_endpoint(mock_get_datasource, test_client, login_as_admin, dataset):
    dataset.default_endpoint = "another_endpoint"
    mock_get_datasource.return_value = dataset
    resp = test_client.get(
        f"api/v1/explore/?datasource_id={dataset.id}&datasource_type={dataset.type}"
    )
    data = json.loads(resp.data.decode("utf-8"))
    assert resp.status_code == 302
    assert data["redirect"] == dataset.default_endpoint


def test_get_url_params(test_client, login_as_admin, chart_id):
    resp = test_client.get(f"api/v1/explore/?slice_id={chart_id}&foo=bar")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    result = data.get("result")

    assert result["form_data"]["url_params"] == {
        "foo": "bar",
        "slice_id": str(chart_id),
    }
