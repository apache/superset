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

        slc = self.get_slice("Pivot Table v2")

        # Get chart metadata
        metadata = self.get_json_resp(f"api/v1/chart/{slc.id}")
        query_context = json.loads(metadata.get("result").get("query_context"))
        query_context["form_data"] = slc.form_data

        # Request chart for the first time
        resp = self.get_json_resp(
            "api/v1/chart/data",
            json_=query_context,
        )

        # Request chart for the second time
        resp_from_cache = self.get_json_resp(
            "api/v1/chart/data",
            json_=query_context,
        )

        # restore DATA_CACHE_CONFIG
        app.config["DATA_CACHE_CONFIG"] = data_cache_config
        assert resp.get("result")[0].get("cached_dttm") is None
        assert resp_from_cache.get("result")[0].get("cached_dttm") is None

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

        slc = self.get_slice("Pivot Table v2")

        # Get chart metadata
        metadata = self.get_json_resp(f"api/v1/chart/{slc.id}")
        query_context = json.loads(metadata.get("result").get("query_context"))
        query_context["form_data"] = slc.form_data

        # Request chart for the first time
        resp = self.get_json_resp(
            "api/v1/chart/data",
            json_=query_context,
        )

        # Request chart for the second time
        resp_from_cache = self.get_json_resp(
            "api/v1/chart/data",
            json_=query_context,
        )

        result = resp.get("result")[0]
        cached_result = resp_from_cache.get("result")[0]

        assert result.get("cached_dttm") is None
        assert cached_result.get("cached_dttm") is not None

        # should fallback to default cache timeout
        assert cached_result["cache_timeout"] == 10
        assert cached_result["status"] == QueryStatus.SUCCESS
        assert result["data"] == cached_result["data"]
        assert result["query"] == cached_result["query"]

        # should exists in `data_cache`
        assert (
            cache_manager.data_cache.get(cached_result["cache_key"])["query"]
            == cached_result["query"]
        )

        # should not exists in `cache`
        assert cache_manager.cache.get(cached_result["cache_key"]) is None

        # reset cache config
        app.config["DATA_CACHE_CONFIG"] = data_cache_config
        app.config["CACHE_DEFAULT_TIMEOUT"] = cache_default_timeout
        cache_manager.init_app(app)
