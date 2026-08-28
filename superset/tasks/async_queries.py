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
from __future__ import annotations

import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator, TYPE_CHECKING
from uuid import UUID

from flask import current_app
from flask_appbuilder.security.sqla.models import User
from superset_core.tasks.types import TaskOptions, TaskScope

from superset.common.query_serialization import (
    load_serialized_query,
    serialize_query,
    SerializedQuery,
)
from superset.constants import CacheRegion
from superset.exceptions import SupersetException
from superset.extensions import (
    security_manager,
)
from superset.tasks.ambient_context import get_context
from superset.tasks.decorators import task
from superset.tasks.query_cancel import cancel_chart_query, capture_cancel_id
from superset.utils.core import override_user

if TYPE_CHECKING:
    from superset_core.tasks.models import Task as CoreTask

    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.models.tasks import Task
    from superset.security.guest_token import GuestToken

logger = logging.getLogger(__name__)

# GTF task type for the chart-data fan-out. Each QueryObject runs as its own SHARED
# task keyed by its query_cache_key (safe cross-user dedup — the key encodes
# RLS/impersonation). The client polls /api/v1/task/status_changes (filtered to this
# type) and aggregates the tasks' statuses itself; GTF owns completion emission (there
# is no coordinator task). The atomic unit is a QueryObject, not chart-specific, so the
# type is versioned to allow the serialization/execution contract to evolve.
CHART_QUERY_TASK = "superset.query_object_v1"
CACHE_KEY_PAYLOAD_KEY = "cache_key"


def _resolve_user(user_id: int | None, guest_token: "GuestToken | None") -> User:
    """Resolve the acting user for an async chart-data task.

    The GTF executor does not impersonate on its own, so each task establishes the
    request user itself, which is what RLS and database impersonation key off.
    """
    if user_id:
        return security_manager.get_user_by_id(user_id)
    if guest_token:
        return security_manager.get_guest_user_from_token(guest_token)
    return security_manager.get_anonymous_user()


def _inject_contribution_totals(
    query_obj: "QueryObject", totals_cache_key: str
) -> None:
    """Inject ``contribution_totals`` from the cached totals query into ``query_obj``.

    A contribution query normalizes its metrics against column sums from a separate
    "totals" query. In the per-query task model the totals query runs as its own
    task (a ``depends_on`` prerequisite) and caches its dataframe; here we read that
    cached dataframe and inject the sums into this query's contribution
    post-processing before it runs — the same result the synchronous
    ``ensure_totals_available`` produces, but reading the cache the prerequisite
    populated instead of re-running the totals query. ``contribution_totals`` is
    stripped from the cache key, so this affects only the result, not the key.
    """
    from superset.common.utils.query_cache_manager import QueryCacheManager

    cache = QueryCacheManager.get(key=totals_cache_key, region=CacheRegion.DATA)
    if not cache.is_loaded or cache.df is None:
        # The depends_on prerequisite guarantees the totals task succeeded and wrote
        # this cache entry, so a miss is unexpected (e.g. it was evicted between the
        # totals task finishing and this task reading). Fail loudly rather than
        # caching a silently un-normalized result the client would then re-request:
        # this task's single query cannot reproduce the synchronous path's
        # ensure_totals_available (it has no totals query to run).
        raise SupersetException(
            f"Contribution totals not found in cache under {totals_cache_key}"
        )
    df = cache.df
    totals = {col: df[col].sum() for col in df.columns if df[col].dtype.kind in "biufc"}
    for post_processing in query_obj.post_processing or []:
        if post_processing.get("operation") == "contribution":
            post_processing.setdefault("options", {})["contribution_totals"] = totals


def _get_dependency_cache_key() -> str:
    """
    Return the cache key published by a prerequisite chart-data task.

    A dependent task reaches this point only after the scheduler's all-success
    dependency gate has passed, so prerequisite payloads are expected to contain
    any output metadata their task body committed.
    """
    for payload in get_context().get_dependency_payloads():
        cache_key = payload.get(CACHE_KEY_PAYLOAD_KEY)
        if isinstance(cache_key, str):
            return cache_key
    raise SupersetException("Prerequisite task did not publish a cache key")


@contextmanager
def _capture_query_cancellation(query_context: "QueryContext") -> Iterator[None]:
    """Enable engine-level cancellation of this task's warehouse query.

    Captures the engine cancel id off the live cursor (for engines that expose
    one before execution) and registers an abort handler that kills the backend
    session over a fresh connection, unblocking the task's ``get_df``. Engines
    without cancel support capture nothing and the task stays non-abortable, so
    an abort/timeout simply frees the task without killing the (uncancellable)
    query — matching the pre-cancellation behavior for those engines.
    """
    database = getattr(query_context.datasource, "database", None)
    if database is None:
        yield
        return

    ctx = get_context()
    app = current_app._get_current_object()  # noqa: SLF001
    captured = False

    def _sink(cursor: Any) -> None:
        nonlocal captured
        if captured:
            return
        # query is unused by the explicit-id specs; the chart path has no Query.
        cancel_id = database.db_engine_spec.get_cancel_query_id(cursor, None)
        if cancel_id is None:
            return
        captured = True

        # Registering the first abort handler marks the task abortable and starts
        # the abort listener; on abort it cancels the query on a fresh connection.
        def _cancel() -> None:
            cancel_chart_query(database, cancel_id, app)

        ctx.on_abort(_cancel)

    with capture_cancel_id(_sink):
        yield


@task(name=CHART_QUERY_TASK, scope=TaskScope.SHARED)
def execute_chart_query(
    serialized_query: SerializedQuery,
    user_id: int | None = None,
    guest_token: "GuestToken | None" = None,
    requires_totals: bool = False,
) -> None:
    """Execute a single chart-data query and cache it under its query_cache_key.

    The atomic async unit: reconstruct the one query (canonical serialization),
    optionally inject contribution totals from a prerequisite totals task, then run
    the existing per-query execution/caching path so a re-request reads the same
    DATA-cache entry. The query runs under ``_capture_query_cancellation`` so an
    abort/timeout can cancel it on engines that support query cancellation.
    """
    with override_user(_resolve_user(user_id, guest_token), force=False):
        query_context = load_serialized_query(serialized_query)
        # Floor the result-cache TTL: async caches the result for a follow-up
        # request to read back (see get_cache_timeout).
        query_context.is_async_execution = True
        query_obj = query_context.queries[0]
        if requires_totals:
            _inject_contribution_totals(query_obj, _get_dependency_cache_key())
        # Executes on cache miss and writes CacheRegion.DATA under query_cache_key.
        with _capture_query_cancellation(query_context):
            result = query_context.get_df_payload_result(query_obj)
        if cache_key := result.payload.get(CACHE_KEY_PAYLOAD_KEY):
            # Write synchronously: a dependent contribution query reads this
            # cache key via get_dependency_payloads once the DAG gate releases,
            # so it must not sit in the throttle buffer.
            get_context().update_task(
                payload={CACHE_KEY_PAYLOAD_KEY: cache_key}, immediate=True
            )


def _query_task_cache_key(query_context: "QueryContext", index: int) -> str | None:
    """Compute a query's cache key exactly as its task will.

    ``execute_chart_query`` validates each query before keying (see
    ``get_df_payload_result``), so validate here too — otherwise the SHARED task's
    ``task_key`` (used for cross-user dedup) could diverge from the key the task
    actually caches under.
    """
    query_obj = query_context.queries[index]
    query_obj.validate()
    return query_context.query_cache_key(query_obj)


def submit_chart_data_query_tasks(
    query_context: "QueryContext",
    user_id: int | None,
) -> dict[str, Any]:
    """Fan a chart-data request out into one GTF task per ``QueryObject``.

    Each ``QueryObject`` runs as its own SHARED task keyed by its ``query_cache_key``
    (safe cross-user dedup — the key encodes RLS/impersonation), writing the per-query
    DATA cache a later re-request reads back. A contribution query ``depends_on`` the
    totals query's task and reads its cached result to normalize.

    There is no coordinator task: the client polls ``/api/v1/task/status_changes`` and
    aggregates the query tasks' own honest statuses itself (all ``SUCCESS`` → re-issue
    the request, now served entirely from the per-query cache; any terminal non-success
    → error). Completion is emitted per task by GTF (via the coordination service), so
    that is also what the websocket transport subscribes to.

    Returns the HTTP 202 body ``{"task_ids": [...], "cursor": "..."}`` — the query
    tasks' UUIDs, in query order, plus the server-issued polling cursor. The client
    uses those values to poll through the GTF task API. Client aborts may unsubscribe
    from shared work or abort pending work; engine-level query cancellation is outside
    this chart async path.
    """
    guest_user = security_manager.get_current_guest_user_if_guest()
    guest_token = guest_user.guest_token if guest_user else None

    # Capture a status-poll cursor BEFORE any task is created. Because it
    # predates every task's creation (and therefore every terminal transition),
    # the client can poll `status_changes` from it and is guaranteed to observe
    # each task's completion — closing the race where a task finishes before the
    # client's waiter/poll is established. Returned in the 202 (one small value,
    # unlike echoing every task id back).
    poll_cursor = datetime.now()

    queries = query_context.queries
    # Contribution queries normalize against a shared totals row. Identify the coupling
    # (this also clears the totals query's row_limit so its cache key matches the entry
    # its dependents read).
    needs_totals, totals_idx = query_context.prepare_contribution_totals()

    query_cache_keys = [
        _query_task_cache_key(query_context, index) for index in range(len(queries))
    ]
    serialized_queries = [
        serialize_query(query_context, index) for index in range(len(queries))
    ]

    def _needs_prerequisite_totals(index: int) -> bool:
        return totals_idx is not None and index != totals_idx and index in needs_totals

    def _task_name(index: int) -> str | None:
        """A human-friendly Task List label from the in-memory QueryContext.

        Prefer the chart (slice) name, falling back to the dataset name — both are
        already loaded on the QueryContext, so this adds no metastore round trip.
        A multi-query chart (e.g. contribution + totals) disambiguates with a
        ``(1)``/``(2)`` suffix. Returns ``None`` when neither is available,
        leaving the task_key hash.
        """
        name: str | None = (
            query_context.slice_.slice_name if query_context.slice_ else None
        )
        if not name:
            # ``Explorable`` does not declare a display name; the implementations
            # that have one (SQL datasets, semantic views) expose it as ``name``.
            name = getattr(query_context.datasource, "name", None)
        if not name:
            return None
        return f"{name} ({index + 1})" if len(queries) > 1 else name

    def _schedule(
        index: int,
        depends_on: "list[CoreTask | UUID | str] | None" = None,
    ) -> "Task":
        return execute_chart_query.schedule(
            serialized_queries[index],
            user_id,
            guest_token,
            _needs_prerequisite_totals(index),
            options=TaskOptions(
                task_key=query_cache_keys[index],
                task_name=_task_name(index),
                depends_on=depends_on,
                # Abort the query after this many seconds; for cancellable
                # engines the abort handler kills the warehouse query too.
                # None (default) leaves it unbounded.
                timeout=current_app.config.get("GLOBAL_ASYNC_QUERIES_QUERY_TIMEOUT"),
            ),
        )

    # Schedule the totals query first so contribution queries can depend on it.
    tasks: dict[int, "Task"] = {}
    if totals_idx is not None and needs_totals:
        tasks[totals_idx] = _schedule(totals_idx)
    for index in range(len(queries)):
        if index not in tasks:
            depends_on: "list[CoreTask | UUID | str] | None" = None
            if totals_idx is not None and _needs_prerequisite_totals(index):
                depends_on = [tasks[totals_idx]]
            tasks[index] = _schedule(index, depends_on=depends_on)

    return {
        "task_ids": [str(tasks[index].uuid) for index in range(len(queries))],
        "cursor": poll_cursor.isoformat(),
    }
