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
from collections.abc import Iterator
from typing import Any
from uuid import uuid3

import pytest

from superset import db
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource
from superset.key_value.utils import decode_permalink_id
from tests.integration_tests.constants import (
    GAMMA_SQLLAB_USERNAME,
)


@pytest.fixture
def tab_state_data() -> dict[str, Any]:
    return {
        "dbId": 1,
        "name": "Untitled Query 1",
        "schema": "main",
        "sql": "SELECT 'foo' as bar",
        "autorun": False,
        "templateParams": '{"param1": "value1"}',
    }


@pytest.fixture
def permalink_salt(app_context) -> Iterator[str]:
    from superset.key_value.shared_entries import get_permalink_salt, get_uuid_namespace
    from superset.key_value.types import SharedKey

    key = SharedKey.SQLLAB_PERMALINK_SALT
    salt = get_permalink_salt(key)
    yield salt
    namespace = get_uuid_namespace(salt)
    db.session.query(KeyValueEntry).filter_by(
        resource=KeyValueResource.APP,
        uuid=uuid3(namespace, key),
    )
    db.session.commit()


def test_sqllab_user_can_access_shared_query(
    tab_state_data: dict[str, Any], permalink_salt: str, test_client, login_as
):
    login_as(GAMMA_SQLLAB_USERNAME)

    resp = test_client.post("api/v1/sqllab/permalink", json=tab_state_data)
    assert resp.status_code == 201, "Failed to create permalink"

    data = resp.json
    key = data["key"]

    resp = test_client.get(f"api/v1/sqllab/permalink/{key}")
    assert resp.status_code == 200, "SQL Lab user access expected"

    result = json.loads(resp.data.decode("utf-8"))
    assert result == tab_state_data, "Query data mismatch"

    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()


def test_post(
    tab_state_data: dict[str, Any], permalink_salt: str, test_client, login_as
):
    login_as(GAMMA_SQLLAB_USERNAME)
    resp = test_client.post("api/v1/sqllab/permalink", json=tab_state_data)
    assert resp.status_code == 201
    data = resp.json
    key = data["key"]
    url = data["url"]
    assert key in url
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()


def test_post_access_denied(tab_state_data: dict[str, Any], test_client, login_as):
    resp = test_client.post("api/v1/sqllab/permalink", json=tab_state_data)
    assert resp.status_code == 401


def test_post_invalid_schema(test_client, login_as):
    login_as(GAMMA_SQLLAB_USERNAME)
    resp = test_client.post(
        "api/v1/sqllab/permalink", json={"name": "Untitled Query 1", "sql": "Test"}
    )
    assert resp.status_code == 400


def test_get(
    tab_state_data: dict[str, Any], permalink_salt: str, test_client, login_as
):
    login_as(GAMMA_SQLLAB_USERNAME)
    resp = test_client.post("api/v1/sqllab/permalink", json=tab_state_data)
    data = resp.json
    key = data["key"]
    resp = test_client.get(f"api/v1/sqllab/permalink/{key}")
    assert resp.status_code == 200
    result = json.loads(resp.data.decode("utf-8"))
    assert result == tab_state_data
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()
