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

# pylint: disable=import-outside-toplevel, unused-argument

from pytest_mock import MockerFixture


def test_memoized_func(mocker: MockerFixture) -> None:
    """
    Test the ``memoized_func`` decorator.
    """
    from superset.utils.cache import memoized_func

    cache = mocker.MagicMock()

    decorator = memoized_func("db:{self.id}:schema:{schema}:view_list", cache)
    decorated = decorator(lambda self, schema, cache=False: 42)

    self = mocker.MagicMock()
    self.id = 1

    # skip cache
    result = decorated(self, "public", cache=False)
    assert result == 42
    cache.get.assert_not_called()

    # check cache, no cached value
    cache.get.return_value = None
    result = decorated(self, "public", cache=True)
    assert result == 42
    cache.get.assert_called_with("db:1:schema:public:view_list")

    # check cache, cached value
    cache.get.return_value = 43
    result = decorated(self, "public", cache=True)
    assert result == 43


def test_set_and_log_cache_reports_backend_outcome(mocker: MockerFixture) -> None:
    from superset.common.chart_data_timing import CacheWriteOutcome
    from superset.utils.cache import (
        set_and_log_cache,
        set_and_log_cache_with_outcome,
    )

    cache = mocker.MagicMock()
    cache.cache = object()
    cache.set.return_value = True
    mock_app = mocker.patch("superset.utils.cache.app")
    mock_app.config = {
        "CACHE_DEFAULT_TIMEOUT": 300,
        "STATS_LOGGER": mocker.MagicMock(),
        "STORE_CACHE_KEYS_IN_METADATA_DB": False,
    }

    assert (
        set_and_log_cache_with_outcome(cache, "key", {"value": 1})
        == CacheWriteOutcome.SUCCEEDED
    )
    assert set_and_log_cache(cache, "key", {"value": 1}) is True

    cache.set.return_value = False
    assert (
        set_and_log_cache_with_outcome(cache, "key", {"value": 1})
        == CacheWriteOutcome.FAILED
    )
    assert set_and_log_cache(cache, "key", {"value": 1}) is False


def test_set_and_log_cache_distinguishes_skipped_and_failed_writes(
    mocker: MockerFixture,
) -> None:
    from flask_caching.backends import NullCache

    from superset.common.chart_data_timing import CacheWriteOutcome
    from superset.constants import CACHE_DISABLED_TIMEOUT
    from superset.utils.cache import set_and_log_cache_with_outcome

    cache = mocker.MagicMock()
    cache.cache = NullCache()
    assert (
        set_and_log_cache_with_outcome(cache, "key", {"value": 1})
        == CacheWriteOutcome.SKIPPED
    )

    cache.cache = object()
    assert (
        set_and_log_cache_with_outcome(
            cache,
            "key",
            {"value": 1},
            cache_timeout=CACHE_DISABLED_TIMEOUT,
        )
        == CacheWriteOutcome.SKIPPED
    )

    cache.set.side_effect = RuntimeError("cache unavailable")
    mock_app = mocker.patch("superset.utils.cache.app")
    mock_app.config = {
        "CACHE_DEFAULT_TIMEOUT": 300,
        "STATS_LOGGER": mocker.MagicMock(),
        "STORE_CACHE_KEYS_IN_METADATA_DB": False,
    }
    assert (
        set_and_log_cache_with_outcome(cache, "key", {"value": 1})
        == CacheWriteOutcome.FAILED
    )


def test_cache_metadata_failure_does_not_change_write_outcome(
    mocker: MockerFixture,
) -> None:
    from superset.utils.cache import set_and_log_cache

    cache = mocker.MagicMock()
    cache.cache = object()
    cache.set.return_value = True
    mock_app = mocker.patch("superset.utils.cache.app")
    mock_app.config = {
        "CACHE_DEFAULT_TIMEOUT": 300,
        "STATS_LOGGER": mocker.MagicMock(),
        "STORE_CACHE_KEYS_IN_METADATA_DB": True,
    }
    mocker.patch(
        "superset.utils.cache.db.session.add",
        side_effect=RuntimeError("metadata unavailable"),
    )

    assert (
        set_and_log_cache(
            cache,
            "key",
            {"value": 1},
            datasource_uid="1__table",
        )
        is True
    )
