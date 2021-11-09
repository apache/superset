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

from superset import db
from superset.models.key_value import KeyValue
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
        rows = db.session.query(KeyValue).all()
        for row in rows:
            db.session.delete(row)
        db.session.commit()

    def test_post(self):
        key = self.post()
        result = db.session.query(KeyValue).first()
        self.assertEqual(key, str(result.key))
        self.assertEqual(duration_ms, result.duration_ms)
        self.assertEqual(
            reset_duration_on_retrieval, result.reset_duration_on_retrieval
        )
        self.assertEqual(value, result.value)

    def test_get_not_found(self):
        key = self.post()
        resp = self.client.get(key)
        self.assertEqual(404, resp.status_code)

    def test_get(self):
        key = self.post()
        resp = self.client.get(f"api/v1/key_value_store/{key}/")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data.decode("utf-8"))
        self.assertEqual(duration_ms, data.get("duration_ms"))
        self.assertEqual(
            reset_duration_on_retrieval, data.get("reset_duration_on_retrieval")
        )
        self.assertEqual(value, data.get("value"))

    def test_get_retrieved_on(self):
        key = self.post()
        self.client.get(f"api/v1/key_value_store/{key}/")
        retrieved1 = db.session.query(KeyValue).first().retrieved_on
        self.client.get(f"api/v1/key_value_store/{key}/")
        retrieved2 = db.session.query(KeyValue).first().retrieved_on
        self.assertGreater(retrieved2, retrieved1)
