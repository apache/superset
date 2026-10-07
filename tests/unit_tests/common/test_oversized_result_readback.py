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
refresh whose follow-up carries the task's id as its ``force_nonce``. The
contribution tests run the real async task body for a totals task and the
contribution task that depends on it.
"""

from collections.abc import Iterator
from contextlib import nullcontext
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


def _processor(
    mocker: MockerFixture, rows: int, force: bool, cache_key: str = CACHE_KEY
) -> Any:
    """A processor whose datasource returns a ``rows``-row dataframe, cached
    under ``cache_key``."""
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
    mocker.patch.object(processor, "query_cache_key", return_value=cache_key)
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


def test_oversized_refresh_removes_older_cached_result(
    mocker: MockerFixture, data_cache: Cache
) -> None:
    """A result too large to cache removes the older cached copy under its key.

    A small result is cached, the data then grows past the cap, and a forced
    refresh computes the large result (which cannot be stored). The next ordinary
    load must recompute rather than serve the older, smaller cached result.
    """
    # 1. An ordinary load caches a small result.
    _processor(mocker, rows=10, force=False).get_df_payload_result(_query_object(None))
    assert data_cache.get(CACHE_KEY) is not None

    # 2-3. The data grows; a forced refresh (background task and its follow-up)
    # recomputes the full, now oversized, result.
    _run_task_then_follow_up(mocker, rows=2000, force=True)
    assert data_cache.get(CACHE_KEY) is None

    # 4. The next ordinary load recomputes instead of serving the old 10 rows.
    processor = _processor(mocker, rows=2000, force=False)
    payload = processor.get_df_payload_result(_query_object(None)).payload

    processor.get_query_result.assert_called_once()
    assert not payload["is_cached"]
    assert payload["rowcount"] == 2000


def _run_chart_task(
    mocker: MockerFixture,
    processor: Any,
    query_obj: Any,
    requires_totals: bool = False,
    dependency_payloads: list[dict[str, Any]] | None = None,
) -> MagicMock:
    """Run the real ``execute_chart_query`` task body for one query.

    Only the worker plumbing (user, task context, form data, cancellation hook) is
    stubbed; the query runs through ``processor`` against the real cache.

    :returns: the task context, whose ``update_task`` records the published payload
    """
    from superset.tasks.async_queries import execute_chart_query

    query_context = MagicMock()
    query_context.queries = [query_obj]
    query_context.get_df_payload_result.side_effect = processor.get_df_payload_result
    task_context = MagicMock(task_uuid=TASK_ID)
    task_context.get_dependency_payloads.return_value = dependency_payloads or []
    mocker.patch("superset.tasks.async_queries._resolve_user", return_value=MagicMock())
    mocker.patch("superset.tasks.async_queries.override_user")
    mocker.patch(
        "superset.tasks.async_queries.load_serialized_query",
        return_value=query_context,
    )
    mocker.patch("superset.tasks.async_queries.get_context", return_value=task_context)
    mocker.patch("superset.charts.data.form_data.set_query_context_form_data")
    mocker.patch(
        "superset.tasks.async_queries._capture_query_cancellation",
        return_value=nullcontext(),
    )
    execute_chart_query.func(
        {"datasource": {}, "query": {}},  # type: ignore[typeddict-item]
        user_id=7,
        requires_totals=requires_totals,
    )
    return task_context


def _contribution_query_object() -> Any:
    from superset.common.query_object import QueryObject

    query_obj = QueryObject(
        datasource=MagicMock(),
        columns=["name"],
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    query_obj.force_nonce = None
    return query_obj


@pytest.mark.parametrize(
    "totals_rows,totals_cached", [(2, True), (2000, False)], ids=["fits", "oversized"]
)
def test_contribution_task_after_totals_task(
    mocker: MockerFixture, data_cache: Cache, totals_rows: int, totals_cached: bool
) -> None:
    """The async totals task feeds the contribution task through the data cache.

    When the totals result fits, the contribution task reads it, runs, and
    publishes its own cache key. When the totals result is too large to cache, the
    contribution task must not fail: it leaves its query uncached and publishes
    nothing, so the client's synchronous follow-up request (which computes the
    totals itself in ``ensure_totals_available``) renders the chart.
    """
    totals = _processor(mocker, totals_rows, force=False, cache_key="totals-key")
    totals_task = _run_chart_task(mocker, totals, _query_object(None))
    published = totals_task.update_task.call_args.kwargs["payload"]
    assert published == {"cache_key": "totals-key"}
    assert (data_cache.get("totals-key") is not None) is totals_cached

    contribution = _processor(mocker, 2, force=False, cache_key="contribution-key")
    contribution_task = _run_chart_task(
        mocker,
        contribution,
        _contribution_query_object(),
        requires_totals=True,
        dependency_payloads=[published],
    )

    if totals_cached:
        contribution.get_query_result.assert_called_once()
        contribution_task.update_task.assert_called_once_with(
            payload={"cache_key": "contribution-key"}, immediate=True
        )
        assert data_cache.get("contribution-key") is not None
        return

    contribution.get_query_result.assert_not_called()
    contribution_task.update_task.assert_not_called()
    assert data_cache.get("contribution-key") is None
    # The synchronous follow-up misses the cache and computes the query.
    payload = contribution.get_df_payload_result(_contribution_query_object()).payload
    contribution.get_query_result.assert_called_once()
    assert payload["error"] is None
    assert payload["rowcount"] == 2
