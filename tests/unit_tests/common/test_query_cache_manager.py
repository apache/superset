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
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
from flask_caching import Cache

from superset.app import SupersetApp
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion
from superset.models.helpers import QueryResult


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

    def test_result_cache_hit_does_not_replay_semantic_cache_provenance(self) -> None:
        mock_cache: MagicMock = MagicMock()
        mock_cache.get.return_value = {
            "df": None,
            "query": "provider query",
            "semantic_cache_status": "HIT",
            "dttm": "2026-08-04T00:00:00+00:00",
        }

        with patch(
            "superset.common.utils.query_cache_manager._cache",
            {CacheRegion.DEFAULT: mock_cache},
        ):
            result: QueryCacheManager = QueryCacheManager.get(key="some-key")

        assert result.is_cached is True
        assert result.semantic_cache_status == "MISS"


def test_kept_big_integer_column_survives_cache_round_trip(
    app: SupersetApp, tmp_path: Path
) -> None:
    """Exact large integers (Python and NumPy scalars, nulls and NaN) in an object
    column come back from a real cache backend unchanged."""
    cache = Cache(
        config={"CACHE_TYPE": "FileSystemCache", "CACHE_DIR": str(tmp_path / "cache")}
    )
    cache.init_app(app)
    values = [2**62 + 1, None, np.int64(-(2**63)), float("nan"), np.int64(2**63 - 1)]
    df = pd.DataFrame({"value": pd.Series(values, dtype=object)})

    with patch(
        "superset.common.utils.query_cache_manager._cache",
        {CacheRegion.DEFAULT: cache, CacheRegion.DATA: cache},
    ):
        QueryCacheManager().set_query_result(
            key="exact-integers",
            query_result=QueryResult(df=df, query="", duration=timedelta(0)),
            timeout=300,
            region=CacheRegion.DATA,
        )
        loaded = QueryCacheManager.get(key="exact-integers", region=CacheRegion.DATA)

    assert loaded.is_cached
    assert loaded.df["value"].dtype == object
    assert [type(value) for value in loaded.df["value"]] == [type(v) for v in values]
    pd.testing.assert_frame_equal(loaded.df, df)
