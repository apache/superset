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
import pytest  # noqa: F401

from superset.extensions import cache_manager
from superset.utils.core import backend, DatasourceType  # noqa: F401
from tests.integration_tests.base_tests import SupersetTestCase


class UtilsCacheManagerTests(SupersetTestCase):
    def test_get_set_explore_form_data_cache(self):
        key = "12345"
        data = {"foo": "bar", "datasource_type": "query"}
        cache_manager.explore_form_data_cache.set(key, data)
        assert cache_manager.explore_form_data_cache.get(key) == data

    def test_get_same_context_twice(self):
        key = "12345"
        data = {"foo": "bar", "datasource_type": "query"}
        cache_manager.explore_form_data_cache.set(key, data)
        assert cache_manager.explore_form_data_cache.get(key) == data
        assert cache_manager.explore_form_data_cache.get(key) == data

    def test_get_set_explore_form_data_cache_no_datasource_type(self):
        key = "12345"
        data = {"foo": "bar"}
        cache_manager.explore_form_data_cache.set(key, data)
        # datasource_type should be added because it is not present
        assert cache_manager.explore_form_data_cache.get(key) == {
            "datasource_type": DatasourceType.TABLE,
            **data,
        }

    def test_get_explore_form_data_cache_invalid_key(self):
        assert cache_manager.explore_form_data_cache.get("foo") is None  # noqa: E711
