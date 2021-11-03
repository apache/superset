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
from superset.models.core import KeyValuePair
from tests.integration_tests.base_tests import SupersetTestCase

uuid = "0740d9ab-0074-46d1-a9f8-d7dff7cf5b66"
value = "test"

class KeyValueTests(SupersetTestCase):

    def post(self):
        data = json.dumps({"uuid": uuid, "value": value})
        return self.client.post("/key_value_store/", data=dict(data=data))

    def setUp(self):
        self.login(username="admin")
        rows = db.session.query(KeyValuePair).all()
        for row in rows:
            db.session.delete(row)
        db.session.commit()

    def test_post(self):
        resp = self.post()
        self.assertEqual(resp.status_code, 200)
        result = db.session.query(KeyValuePair).first()
        self.assertEqual(uuid, str(result.uuid))
        self.assertEqual(value, result.value)

    def test_get_not_found(self):
        resp = self.client.get(uuid)
        self.assertEqual(404, resp.status_code)

    def test_get(self):
        resp = self.post()
        resp = self.client.get(f"/key_value_store/{uuid}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(value, resp.data.decode("utf-8"))

    def test_get_retrieved(self):
        self.post()
        self.client.get(f"/key_value_store/{uuid}/")
        retrieved1 = db.session.query(KeyValuePair).first().retrieved
        self.client.get(f"/key_value_store/{uuid}/")
        retrieved2 = db.session.query(KeyValuePair).first().retrieved
        self.assertGreater(retrieved2, retrieved1)
