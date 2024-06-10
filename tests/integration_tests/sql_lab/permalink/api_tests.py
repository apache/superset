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

from superset import db
from superset.key_value.models import KeyValueEntry
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    GAMMA_SQLLAB_USERNAME,
)


class TestSqlLabPermalinkApi(SupersetTestCase):
    data = {
        "dbId": 1,
        "name": "Untitled Query 1",
        "schema": "main",
        "sql": "SELECT 'foo' as bar",
        "autorun": False,
        "templateParams": '{"param1": "value1"}',
    }

    def test_post(self):
        self.login(GAMMA_SQLLAB_USERNAME)
        resp = self.client.post("api/v1/sqllab/permalink", json=self.data)
        assert resp.status_code == 201
        data = resp.json
        key = data["key"]
        url = data["url"]
        assert key in url
        db.session.query(KeyValueEntry).filter_by(id=key).delete()
        db.session.commit()

    def test_post_access_denied(self):
        resp = self.client.post("api/v1/sqllab/permalink", json=self.data)
        assert resp.status_code == 401

    def test_post_invalid_schema(self):
        self.login(GAMMA_SQLLAB_USERNAME)
        resp = self.client.post(
            "api/v1/sqllab/permalink", json={"name": "Untitled Query 1", "sql": "Test"}
        )
        assert resp.status_code == 400

    def test_get(self):
        self.login(GAMMA_SQLLAB_USERNAME)
        resp = self.client.post("api/v1/sqllab/permalink", json=self.data)
        data = resp.json
        key = data["key"]
        resp = self.client.get(f"api/v1/sqllab/permalink/{key}")
        assert resp.status_code == 200
        result = json.loads(resp.data.decode("utf-8"))
        assert result == self.data
        db.session.query(KeyValueEntry).filter_by(id=key).delete()
        db.session.commit()
