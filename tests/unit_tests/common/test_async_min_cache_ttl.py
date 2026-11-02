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
from unittest.mock import MagicMock

from flask import current_app
from pytest_mock import MockerFixture

from superset.common.query_context_processor import QueryContextProcessor


def _processor(
    *, is_async: bool, resolved_timeout: int | None
) -> QueryContextProcessor:
    """A processor over a stub context whose slice/datasource timeout is fixed."""
    query_context = MagicMock()
    query_context.custom_cache_timeout = None
    query_context.form_data = {}
    query_context.get_cache_timeout.return_value = resolved_timeout
    query_context.is_async_execution = is_async
    return QueryContextProcessor(query_context)


def test_async_execution_floors_short_cache_timeout(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(current_app.config, {"GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL": 300})
    # 60s < 300s floor → raised to the floor so the result survives until re-fetch.
    assert _processor(is_async=True, resolved_timeout=60).get_cache_timeout() == 300


def test_async_execution_keeps_longer_cache_timeout(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(current_app.config, {"GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL": 300})
    # A longer configured timeout is not lowered.
    assert _processor(is_async=True, resolved_timeout=3600).get_cache_timeout() == 3600


def test_async_execution_leaves_zero_timeout_untouched(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(current_app.config, {"GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL": 300})
    # 0 means "cache forever" (flask-caching), already above any floor.
    assert _processor(is_async=True, resolved_timeout=0).get_cache_timeout() == 0


def test_sync_execution_is_not_floored(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.dict(current_app.config, {"GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL": 300})
    # The floor applies only to async execution; a sync request keeps its timeout
    # even when GLOBAL_ASYNC_QUERIES is enabled.
    assert _processor(is_async=False, resolved_timeout=60).get_cache_timeout() == 60
