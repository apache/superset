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

import pytest

from superset import app, db  # noqa: F401
from superset.common.db_query_status import QueryStatus
from superset.extensions import cache_manager
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


class TestCache(SupersetTestCase):
    def setUp(self):
        self.login(ADMIN_USERNAME)
        cache_manager.cache.clear()
        cache_manager.data_cache.clear()

    def tearDown(self):
        cache_manager.cache.clear()
        cache_manager.data_cache.clear()
        super().tearDown()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_no_data_cache(self):
        data_cache_config = app.config["DATA_CACHE_CONFIG"]
        app.config["DATA_CACHE_CONFIG"] = {"CACHE_TYPE": "NullCache"}
        cache_manager.init_app(app)

        slc = self.get_slice("Top 10 Girl Name Share")
        json_endpoint = "/superset/explore_json/{}/{}/".format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_json_resp(
            json_endpoint, {"form_data": json.dumps(slc.viz.form_data)}
        )
        resp_from_cache = self.get_json_resp(
            json_endpoint, {"form_data": json.dumps(slc.viz.form_data)}
        )
        # restore DATA_CACHE_CONFIG
        app.config["DATA_CACHE_CONFIG"] = data_cache_config
        self.assertFalse(resp["is_cached"])
        self.assertFalse(resp_from_cache["is_cached"])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_data_cache(self):
        # Override cache config
        data_cache_config = app.config["DATA_CACHE_CONFIG"]
        cache_default_timeout = app.config["CACHE_DEFAULT_TIMEOUT"]
        app.config["CACHE_DEFAULT_TIMEOUT"] = 100
        app.config["DATA_CACHE_CONFIG"] = {
            "CACHE_TYPE": "SimpleCache",
            "CACHE_DEFAULT_TIMEOUT": 10,
        }
        cache_manager.init_app(app)

        slc = self.get_slice("Top 10 Girl Name Share")
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
        # should fallback to default cache timeout
        self.assertEqual(resp_from_cache["cache_timeout"], 10)
        self.assertEqual(resp_from_cache["status"], QueryStatus.SUCCESS)
        self.assertEqual(resp["data"], resp_from_cache["data"])
        self.assertEqual(resp["query"], resp_from_cache["query"])
        # should exists in `data_cache`
        self.assertEqual(
            cache_manager.data_cache.get(resp_from_cache["cache_key"])["query"],
            resp_from_cache["query"],
        )
        # should not exists in `cache`
        self.assertIsNone(cache_manager.cache.get(resp_from_cache["cache_key"]))

        # reset cache config
        app.config["DATA_CACHE_CONFIG"] = data_cache_config
        app.config["CACHE_DEFAULT_TIMEOUT"] = cache_default_timeout
        cache_manager.init_app(app)
