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
"""Unit tests for Superset with caching"""
import json

from superset import cache, db
from superset.utils.core import QueryStatus

from .base_tests import SupersetTestCase


class CacheTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(CacheTests, self).__init__(*args, **kwargs)

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_cache_value(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        json_endpoint = "/superset/explore_json/{}/{}/".format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_json_resp(
            json_endpoint, {"form_data": json.dumps(slc.viz.form_data)}
        )
        resp_from_cache = self.get_json_resp(
            json_endpoint, {"form_data": json.dumps(slc.viz.form_data)}
        )
        self.assertFalse(resp["is_cached"])
        self.assertTrue(resp_from_cache["is_cached"])
        self.assertEqual(resp_from_cache["status"], QueryStatus.SUCCESS)
        self.assertEqual(resp["data"], resp_from_cache["data"])
        self.assertEqual(resp["query"], resp_from_cache["query"])
