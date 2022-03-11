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

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset import db
from superset.key_value.models import KeyValueEntry
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.integration_tests.base_tests import login
from tests.integration_tests.fixtures.client import client
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app


@pytest.fixture
def chart(load_world_bank_dashboard_with_slices) -> Slice:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        chart = session.query(Slice).filter_by(slice_name="World's Population").one()
        return chart


@pytest.fixture
def form_data(chart):
    datasource = f"{chart.datasource.id}__{chart.datasource.type}"
    return {
        "chart_id": chart.id,
        "datasource": datasource,
    }


def test_post(client, form_data):
    login(client, "admin")
    resp = client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    assert resp.status_code == 201
    data = json.loads(resp.data.decode("utf-8"))
    key = data["key"]
    url = data["url"]
    assert key in url
    db.session.query(KeyValueEntry).filter_by(uuid=key).delete()
    db.session.commit()


def test_get(client, form_data):
    login(client, "admin")
    resp = client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    data = json.loads(resp.data.decode("utf-8"))
    key = data["key"]
    resp = client.get(f"api/v1/explore/permalink/{key}")
    assert resp.status_code == 200
    result = json.loads(resp.data.decode("utf-8"))
    assert result["state"]["formData"] == form_data
    db.session.query(KeyValueEntry).filter_by(uuid=key).delete()
    db.session.commit()
