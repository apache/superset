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
from typing import Any, Dict, Iterator
from uuid import uuid3

import pytest
from sqlalchemy.orm import Session

from superset import db
from superset.explore.permalink.schemas import ExplorePermalinkSchema
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource, MarshmallowKeyValueCodec
from superset.key_value.utils import decode_permalink_id, encode_permalink_key
from superset.models.slice import Slice
from superset.utils.core import DatasourceType
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app


@pytest.fixture
def chart(app_context, load_world_bank_dashboard_with_slices) -> Slice:
    session: Session = app_context.app.appbuilder.get_session
    chart = session.query(Slice).filter_by(slice_name="World's Population").one()
    return chart


@pytest.fixture
def form_data(chart) -> Dict[str, Any]:
    datasource = f"{chart.datasource.id}__{chart.datasource.type}"
    return {
        "chart_id": chart.id,
        "datasource": datasource,
    }


@pytest.fixture
def permalink_salt() -> Iterator[str]:
    from superset.key_value.shared_entries import get_permalink_salt, get_uuid_namespace
    from superset.key_value.types import SharedKey

    key = SharedKey.EXPLORE_PERMALINK_SALT
    salt = get_permalink_salt(key)
    yield salt
    namespace = get_uuid_namespace(salt)
    db.session.query(KeyValueEntry).filter_by(
        resource=KeyValueResource.APP,
        uuid=uuid3(namespace, key),
    )
    db.session.commit()


def test_post(
    test_client, login_as_admin, form_data: Dict[str, Any], permalink_salt: str
):
    resp = test_client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    assert resp.status_code == 201
    data = json.loads(resp.data.decode("utf-8"))
    key = data["key"]
    url = data["url"]
    assert key in url
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()


def test_post_access_denied(test_client, login_as, form_data):
    login_as("gamma")
    resp = test_client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    assert resp.status_code == 403


def test_get_missing_chart(
    test_client, login_as_admin, chart, permalink_salt: str
) -> None:
    from superset.key_value.models import KeyValueEntry

    chart_id = 1234
    entry = KeyValueEntry(
        resource=KeyValueResource.EXPLORE_PERMALINK,
        value=MarshmallowKeyValueCodec(ExplorePermalinkSchema()).encode(
            {
                "chartId": chart_id,
                "datasourceId": chart.datasource.id,
                "datasourceType": DatasourceType.TABLE.value,
                "state": {
                    "urlParams": [["foo", "bar"]],
                    "formData": {
                        "slice_id": chart_id,
                        "datasource": f"{chart.datasource.id}__{chart.datasource.type}",
                    },
                },
            }
        ),
    )
    db.session.add(entry)
    db.session.commit()
    key = encode_permalink_key(entry.id, permalink_salt)
    resp = test_client.get(f"api/v1/explore/permalink/{key}")
    assert resp.status_code == 404
    db.session.delete(entry)
    db.session.commit()


def test_post_invalid_schema(test_client, login_as_admin) -> None:
    resp = test_client.post(f"api/v1/explore/permalink", json={"abc": 123})
    assert resp.status_code == 400


def test_get(
    test_client, login_as_admin, form_data: Dict[str, Any], permalink_salt: str
) -> None:
    resp = test_client.post(f"api/v1/explore/permalink", json={"formData": form_data})
    data = json.loads(resp.data.decode("utf-8"))
    key = data["key"]
    resp = test_client.get(f"api/v1/explore/permalink/{key}")
    assert resp.status_code == 200
    result = json.loads(resp.data.decode("utf-8"))
    assert result["state"]["formData"] == form_data
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()
