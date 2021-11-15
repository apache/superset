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
# isort:skip_file
import json
from datetime import datetime
from freezegun import freeze_time
from superset import db
from superset.models.key_value import KeyValueEntry
from tests.integration_tests.base_tests import SupersetTestCase

duration_ms = 10000
reset_duration_on_retrieval = True
value = "test"


class KeyValueTests(SupersetTestCase):
    def post(self):
        payload = {
            "duration_ms": duration_ms,
            "reset_duration_on_retrieval": reset_duration_on_retrieval,
            "value": value,
        }
        resp = self.client.post("api/v1/key_value_store/", json=payload)
        data = json.loads(resp.data.decode("utf-8"))
        return data.get("key")

    def setUp(self):
        self.login(username="admin")
        rows = db.session.query(KeyValueEntry).all()
        for row in rows:
            db.session.delete(row)
        db.session.commit()

    def test_post(self):
        key = self.post()
        result = db.session.query(KeyValueEntry).first()
        assert key == str(result.key)
        assert duration_ms == result.duration_ms
        assert reset_duration_on_retrieval == result.reset_duration_on_retrieval
        assert value == result.value

    def test_get_not_found(self):
        key = self.post()
        resp = self.client.get(key)
        assert resp.status_code == 404

    def test_get(self):
        key = self.post()
        resp = self.client.get(f"api/v1/key_value_store/{key}/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        assert value == data.get("value")

    def test_get_retrieved_on(self):
        with freeze_time("2021-01-01"):
            key = self.post()
            self.client.get(f"api/v1/key_value_store/{key}/")
            retrieved1 = db.session.query(KeyValueEntry).first().retrieved_on
            assert datetime.now() == retrieved1

    def test_retrieved_on_elapses(self):
        with freeze_time("2021-01-01") as frozenTime:
            key = self.post()
            self.client.get(f"api/v1/key_value_store/{key}/")
            retrieved1 = db.session.query(KeyValueEntry).first().retrieved_on
            frozenTime.tick()
            self.client.get(f"api/v1/key_value_store/{key}/")
            retrieved2 = db.session.query(KeyValueEntry).first().retrieved_on
            assert retrieved2 > retrieved1
