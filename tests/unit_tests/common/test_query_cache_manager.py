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
from unittest.mock import MagicMock, patch

from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion


class TestQueryCacheManagerGet:
    def test_get_cache_miss(self):
        """A regular cache miss returns an empty, non-loaded QueryCacheManager."""
        mock_cache = MagicMock()
        mock_cache.get.return_value = None

        with patch(
            "superset.common.utils.query_cache_manager._cache",
            {CacheRegion.DEFAULT: mock_cache},
        ):
            result = QueryCacheManager.get(key="some-key")

        assert result.is_loaded is False
        assert result.cache_value is None

    def test_get_cache_backend_error_fails_open(self):
        """
        If the cache backend raises on read (e.g. a Redis connection or
        timeout error), QueryCacheManager.get() should not propagate the
        exception. It should behave exactly like a cache miss so callers
        fall back to querying live data.
        """
        mock_cache = MagicMock()
        mock_cache.get.side_effect = ConnectionError("connection refused")

        with patch(
            "superset.common.utils.query_cache_manager._cache",
            {CacheRegion.DEFAULT: mock_cache},
        ):
            result = QueryCacheManager.get(key="some-key")

        miss_result = QueryCacheManager()
        assert result.is_loaded == miss_result.is_loaded
        assert result.cache_value == miss_result.cache_value
        assert result.status == miss_result.status
