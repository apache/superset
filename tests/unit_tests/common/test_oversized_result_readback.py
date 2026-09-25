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
"""An oversized chart result is recomputed on the follow-up request.

With async chart queries, a background task runs the query and the client then
re-sends the same request synchronously. When the result is larger than
``DATA_CACHE_MAX_VALUE_SIZE`` it is not stored, so that follow-up request finds
nothing in the cache and runs the query again. These tests drive
``get_df_payload_result`` twice against a real in-memory cache -- once as the
background task, once as the follow-up -- for a normal load and for a forced
refresh whose follow-up carries the task's id as its ``force_nonce``.
"""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from flask import current_app
from flask_caching import Cache
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus
from superset.common.query_context_processor import QueryContextProcessor
from superset.constants import CacheRegion

CACHE_KEY = "chart-result-key"
TASK_ID = "task-uuid-1"


@pytest.fixture
def data_cache(mocker: MockerFixture) -> Iterator[Cache]:
    """A real in-memory data cache wired into the query cache manager, the
    forced-refresh marker lookups, and ``set_and_log_cache``."""
    cache = Cache()
    cache.init_app(current_app, config={"CACHE_TYPE": "SimpleCache"})
    mocker.patch.dict(
        "superset.common.utils.query_cache_manager._cache",
        {CacheRegion.DATA: cache},
    )
    mocker.patch(
        "superset.common.query_context_processor.cache_manager",
        MagicMock(data_cache=cache),
    )
    mocker.patch.dict(
        current_app.config,
        {"DATA_CACHE_MAX_VALUE_SIZE": 2048, "STATS_LOGGER": MagicMock()},
    )
    yield cache
    cache.clear()


def _processor(mocker: MockerFixture, rows: int, force: bool) -> Any:
    """A processor whose datasource returns a ``rows``-row dataframe."""
    query_context = MagicMock()
    query_context.force = force
    query_context.force_nonce = None
    processor = QueryContextProcessor(query_context)
    processor._qc_datasource = MagicMock(column_names=["name"], uid="1__table")

    query_result = MagicMock()
    query_result.status = QueryStatus.SUCCESS
    query_result.df = pd.DataFrame({"name": [f"row-{i:06d}" for i in range(rows)]})
    query_result.error_message = None
    query_result.applied_template_filters = []
    query_result.applied_filter_columns = []
    query_result.rejected_filter_columns = []
    query_result.sql_rowcount = rows
    query_result.query = "SELECT name FROM t"
    mocker.patch.object(processor, "get_query_result", return_value=query_result)
    mocker.patch.object(processor, "get_annotation_data", return_value={})
    mocker.patch.object(processor, "query_cache_key", return_value=CACHE_KEY)
    mocker.patch.object(processor, "get_cache_timeout", return_value=300)
    return processor


def _query_object(force_nonce: str | None) -> Any:
    from superset.common.query_object import QueryObject

    query_obj = QueryObject(datasource=MagicMock(), columns=["name"])
    query_obj.force_nonce = force_nonce
    return query_obj


def _run_task_then_follow_up(
    mocker: MockerFixture, rows: int, force: bool
) -> tuple[Any, dict[str, Any], dict[str, Any]]:
    processor = _processor(mocker, rows, force)
    # The background task stamps the query with its own id as the nonce.
    task_payload = processor.get_df_payload_result(_query_object(TASK_ID)).payload
    # The client's synchronous re-send carries the task id only when forcing.
    follow_up_nonce = TASK_ID if force else None
    follow_up_payload = processor.get_df_payload_result(
        _query_object(follow_up_nonce)
    ).payload
    return processor, task_payload, follow_up_payload


@pytest.mark.parametrize("force", [False, True], ids=["normal", "forced"])
def test_oversized_result_is_recomputed_on_follow_up(
    mocker: MockerFixture, data_cache: Cache, force: bool
) -> None:
    processor, task_payload, follow_up_payload = _run_task_then_follow_up(
        mocker, rows=2000, force=force
    )

    # Too large to store, and no forced-refresh marker claiming it was stored.
    assert data_cache.get(CACHE_KEY) is None
    assert data_cache.get(f"gtf-force-nonce:{TASK_ID}:{CACHE_KEY}") is None
    # The follow-up re-ran the query and returned the full result.
    assert processor.get_query_result.call_count == 2
    for payload in (task_payload, follow_up_payload):
        assert payload["error"] is None
        assert payload["status"] == QueryStatus.SUCCESS
        assert not payload["is_cached"]
        assert payload["rowcount"] == 2000


@pytest.mark.parametrize("force", [False, True], ids=["normal", "forced"])
def test_normal_size_result_is_read_from_cache_on_follow_up(
    mocker: MockerFixture, data_cache: Cache, force: bool
) -> None:
    processor, _, follow_up_payload = _run_task_then_follow_up(
        mocker, rows=2, force=force
    )

    assert data_cache.get(CACHE_KEY) is not None
    assert processor.get_query_result.call_count == 1
    assert follow_up_payload["is_cached"] is True
    assert follow_up_payload["rowcount"] == 2
