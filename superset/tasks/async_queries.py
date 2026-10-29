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
import threading
from contextlib import contextmanager
from typing import Any, cast, Iterator, TYPE_CHECKING
from uuid import UUID

from flask import current_app
from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as _
from superset_core.tasks.types import TaskOptions, TaskScope

from superset.common.db_query_status import QueryStatus
from superset.common.query_serialization import (
    load_serialized_query,
    serialize_query,
    SerializedQuery,
)
from superset.constants import CacheRegion
from superset.exceptions import (
    QueryObjectValidationError,
    QueryObjectValidationMessage,
    SemanticResultCompletenessError,
    SupersetException,
)
from superset.extensions import (
    security_manager,
)
from superset.tasks.ambient_context import get_context
from superset.tasks.decorators import task
from superset.tasks.query_cancel import (
    cancel_chart_query,
    capture_cancel_id,
    capture_cancel_query_id,
    ChartQueryAbortedError,
    CursorPhase,
)
from superset.tasks.subscription import get_request_tab_id, TaskSubscriptionPolicy
from superset.tasks.utils import (
    floored_status_cursor,
    SUBSCRIPTION_PRIVATE_NAMESPACE,
)
from superset.utils.core import override_user

if TYPE_CHECKING:
    from superset_core.tasks.models import Task as CoreTask

    from superset.common.chart_data_timing import QueryAcquisitionResult
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.models.core import Database
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

# Key under ``private["task"]`` holding the chart-data consumer list (see
# ``ChartQueryConsumerPolicy``).
CONSUMERS_PRIVATE_KEY = "consumers"


class ChartQueryConsumerPolicy(TaskSubscriptionPolicy):
    """Ref-count the browser tabs watching a shared chart-data task.

    A chart-data task is ``SHARED`` and deduplicated across every request for the
    same ``query_cache_key``, so one user viewing the same chart in two tabs is a
    single principal with a single subscriber row. Treating either tab's cancel
    (an explicit cancel, or the navigate-away teardown that cancels unwaited
    tasks) as *the* principal leaving would abort the shared task and kill the
    other tab's still-pending query.

    This policy keeps a list of ``"<principal>:<tab_id>"`` entries in the task's
    ``private["subscription"]`` namespace (policy-owned, debug-gated). On
    subscribe it adds the calling tab; on unsubscribe it removes the calling tab
    and reports whether the principal has any tab left, so the framework aborts
    the task only once the principal's last tab is gone. Both hooks run under the
    submit/cancel lock, so the read-modify-write on the list is race-free against
    other submits/cancels; the executor, which does not hold that lock, writes
    the task's properties while it runs, so the list is written through
    ``TaskDAO.merge_subscription_state`` (a row-locked merge) and the executor's
    whole-blob writes preserve this namespace rather than replacing it with their
    pickup-time snapshot. Otherwise a tab joining mid-execution would be dropped
    and the other tab's detach would abort work it still awaits.

    A request without a ``tab_id`` (a non-interactive or legacy caller) is a
    no-op on subscribe and proceeds (principal-grain) on unsubscribe; in practice
    the chart-data client always supplies a stable per-tab id.
    """

    @staticmethod
    def _consumers(task: "CoreTask") -> list[str]:
        private = task.properties_dict.get("private") or {}
        subscription = private.get(SUBSCRIPTION_PRIVATE_NAMESPACE) or {}
        consumers = subscription.get(CONSUMERS_PRIVATE_KEY) or []
        return [entry for entry in consumers if isinstance(entry, str)]

    @staticmethod
    def _write_consumers(task: "CoreTask", consumers: list[str]) -> None:
        from superset.daos.tasks import TaskDAO

        TaskDAO.merge_subscription_state(
            cast("Task", task), {CONSUMERS_PRIVATE_KEY: consumers}
        )

    def on_subscribe(
        self, task: "CoreTask", *, principal: str, client_ref: str | None
    ) -> None:
        if client_ref is None:
            return
        entry = f"{principal}:{client_ref}"
        if entry not in (consumers := self._consumers(task)):
            self._write_consumers(task, [*consumers, entry])

    def on_unsubscribe(
        self, task: "CoreTask", *, principal: str, client_ref: str | None
    ) -> bool:
        consumers = self._consumers(task)
        prefix = f"{principal}:"
        if client_ref is None:
            # Principal-grain unsubscribe (no tab id): the whole principal is
            # leaving, so drop ALL of its recorded tab entries. Otherwise a later
            # status transition would still route to this principal's tab
            # channels (via routing_channels) after it unsubscribed.
            remaining = [c for c in consumers if not c.startswith(prefix)]
        else:
            entry = f"{principal}:{client_ref}"
            remaining = [c for c in consumers if c != entry]
        if remaining != consumers:
            self._write_consumers(task, remaining)
        # Proceed to unsubscribe the principal only once it has no tab left on
        # this task; a surviving tab of the same principal keeps it subscribed.
        return not any(c.startswith(prefix) for c in remaining)

    def routing_channels(self, task: "CoreTask") -> list[str] | None:
        # The consumer entries are exactly the per-tab realtime routing keys
        # (`"<principal>:<tab_id>"`), so a task-status message reaches only the
        # tabs watching this task. Empty -> None so a chart task with no recorded
        # tab (all detached, or a no-tab caller) falls back to principal-grain
        # fanout instead of dropping it.
        return self._consumers(task) or None


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
    from superset.common.query_context_processor import is_summable
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
    totals = {col: df[col].sum() for col in df.columns if is_summable(df[col])}
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


class _QueryCancellation:
    """Cancel the warehouse operation a chart-data task is running when it aborts.

    Used as the task's cursor sink (see ``superset.tasks.query_cancel``). It keeps
    the cancel id of the operation running on the task's own database. Cursors on
    other databases (e.g. an annotation layer's source chart) never replace it,
    since their id would be cancelled against the wrong database.

    Where the id is read depends on ``has_query_id_before_execute``:

    - True (e.g. PostgreSQL, MySQL): the id names the cursor's session, so it is
      read once per cursor, when the cursor opens. Reading it after execution
      would run SQL on the live cursor (``SELECT pg_backend_pid()``) and replace
      the rows the chart is about to fetch.
    - False (Impala): the id names a single operation, so it is read after each
      statement is submitted, and retired before the next one. Until then the
      cursor's last operation is a finished one, such as the ``USE`` that impyla
      runs when the URL names a database.

    The task registers a single abort handler. For engines read after submission
    it is registered when the cursor opens, so an abort while a statement is
    being submitted (Impala plans it then) is accepted. Other engines register
    at their first id, since there is nothing to cancel without one. Abort
    handlers run once, so the handler records the abort and cancels the published
    id; when the worker publishes an id after that, it cancels the id itself.
    Either way the worker stops before the next fetch or statement. A lock
    guards the state shared with the handler's thread, which never touches the
    live cursor.

    The handle is also persisted for the orphan reaper, and replaced or cleared
    as the running operation changes, so the reaper never cancels an operation
    the task is done with.
    """

    def __init__(self, database: "Database") -> None:
        self._database = database
        self._database_id = database.id
        self._after_submission = not database.db_engine_spec.has_query_id_before_execute
        self._ctx = get_context()
        self._app = current_app._get_current_object()  # noqa: SLF001
        self._lock = threading.Lock()
        # Shared with the abort handler's thread; guarded by ``_lock``.
        self._active_id: str | None = None
        self._abort_requested = False
        # Worker thread only.
        self._registered = False
        self._persisted_id: str | None = None

    def __call__(self, cursor: Any, database: "Database", phase: CursorPhase) -> None:
        own = database.id == self._database.id
        if phase == CursorPhase.OPENED:
            if own:
                self._opened(cursor)
        elif phase == CursorPhase.SUBMITTING:
            if own and self._after_submission:
                # The previous statement is over: its id must not be cancelled,
                # or reaped, in place of the one about to be submitted.
                self._publish(None)
            # Checked after the retire, so an abort accepted at any point before
            # this check stops the statement from being submitted.
            self._raise_if_aborted()
        elif phase == CursorPhase.SUBMITTED:
            try:
                if own and self._after_submission:
                    self._submitted(cursor)
            finally:
                # Even if publishing or cancelling the id failed, an accepted
                # abort must stop the worker before it fetches.
                self._raise_if_aborted()
        else:
            if own:
                self._publish(None)
            if phase == CursorPhase.FAILED:
                # Once aborting, the failure is the cancel's doing: report the
                # abort, not a failed query whose empty result could be cached.
                self._raise_if_aborted()

    def _opened(self, cursor: Any) -> None:
        if self._after_submission:
            self._register()
            return
        cancel_id = self._capture(cursor)
        if cancel_id is None or self._registered:
            self._publish(cancel_id)
            return
        with self._lock:
            self._active_id = cancel_id
        # Registering the first abort handler flushes the whole property cache,
        # persisting the handle in that write.
        self._ctx.set_cancellation(self._database.id, cancel_id)
        self._persisted_id = cancel_id
        self._register()

    def _submitted(self, cursor: Any) -> None:
        cancel_id = self._capture(cursor)
        if self._publish(cancel_id) and cancel_id is not None:
            # The abort arrived while the statement was being submitted, when
            # the handler had nothing to cancel, and the handler does not run
            # again.
            cancel_chart_query(self._database, cancel_id, self._app)

    def _capture(self, cursor: Any) -> str | None:
        try:
            return capture_cancel_query_id(self._database, cursor)
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            logger.warning("Cancel-id capture failed", exc_info=True)
            return None

    def _publish(self, cancel_id: str | None) -> bool:
        """Make ``cancel_id`` the id an abort cancels.

        :returns: whether an abort was requested before it was published
        """
        with self._lock:
            self._active_id = cancel_id
            abort_requested = self._abort_requested
        if cancel_id != self._persisted_id:
            try:
                self._ctx.persist_cancellation(self._database.id, cancel_id)
                self._persisted_id = cancel_id
            except Exception:  # noqa: BLE001 pylint: disable=broad-except
                # Only the orphan reaper reads the persisted handle; the abort
                # handler uses the in-memory one.
                logger.warning("Failed to persist the cancel id", exc_info=True)
        return abort_requested

    def _raise_if_aborted(self) -> None:
        with self._lock:
            abort_requested = self._abort_requested
        if abort_requested:
            raise ChartQueryAbortedError()

    def _register(self) -> None:
        if self._registered:
            return
        self._registered = True
        # Registering the first abort handler marks the task abortable and
        # starts the abort listener.
        self._ctx.on_abort(self._on_abort)

    def _on_abort(self) -> None:
        """The task's abort handler: runs once, usually on another thread."""
        with self._lock:
            self._abort_requested = True
            cancel_id = self._active_id
        if cancel_id is not None:
            cancel_chart_query(self._handler_database(), cancel_id, self._app)

    def _handler_database(self) -> "Database":
        """The task's database, loaded in the handler thread's own session.

        The worker's metastore writes expire its ``Database`` instance, and
        reloading that instance from this thread would use the worker's session
        while the worker uses it. Falls back to the worker's instance when the
        metastore cannot be read (e.g. a self-fence).
        """
        from superset import db
        from superset.models.core import Database

        try:
            return db.session.get(Database, self._database_id) or self._database
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            # Leave this thread's session usable after the failed read.
            db.session.rollback()  # pylint: disable=consider-using-transaction
            return self._database


@contextmanager
def _capture_query_cancellation(query_context: "QueryContext") -> Iterator[None]:
    """Enable engine-level cancellation of this task's warehouse queries.

    Follows the operation the task is running and registers an abort handler
    that cancels it over a fresh connection, unblocking the task's ``get_df``
    (see ``_QueryCancellation``). Engines without cancel support capture nothing
    and the task stays non-abortable, so an abort/timeout simply frees the task
    without killing the (uncancellable) query — matching the pre-cancellation
    behavior for those engines.
    """
    database = getattr(query_context.datasource, "database", None)
    if database is None:
        yield
        return

    with capture_cancel_id(_QueryCancellation(database)):
        yield


@task(
    name=CHART_QUERY_TASK,
    scope=TaskScope.SHARED,
    subscription_policy=ChartQueryConsumerPolicy(),
)
def execute_chart_query(
    serialized_query: SerializedQuery,
    user_id: int | None = None,
    guest_token: "GuestToken | None" = None,
    requires_totals: bool = False,
    is_totals_prerequisite: bool = False,
) -> None:
    """Execute a single chart-data query and cache it under its query_cache_key.

    The atomic async unit: reconstruct the one query (canonical serialization),
    optionally inject contribution totals from a prerequisite totals task, then run
    the existing per-query execution/caching path so a re-request reads the same
    DATA-cache entry. The query runs under ``_capture_query_cancellation`` so an
    abort/timeout can cancel it on engines that support query cancellation.
    Typed validation failures and failed totals prerequisites fail before advertising
    a cache key; ordinary SQL engine errors retain structured-error readback.
    """
    from superset.charts.data.form_data import set_query_context_form_data

    with override_user(_resolve_user(user_id, guest_token), force=False):
        query_context = load_serialized_query(serialized_query)
        # Re-establish ``g.form_data`` from the serialized payload. There is no
        # request context in the worker, and Jinja helpers (``filter_values``,
        # ``url_param``, ``get_filters``) resolve form data from ``g`` via
        # ``get_form_data()``. That fallback reads query-level filters/columns/
        # url_params from ``g.form_data["queries"][0]``, so ``g.form_data`` must be
        # the full *body*-shaped dict, not just the top-level slice ``form_data``.
        # ``set_query_context_form_data`` builds exactly that shape (datasource +
        # per-query fields + form_data). Without it, a templated dataset renders
        # empty filter values — executing/caching the wrong SQL AND computing a
        # ``query_cache_key`` that diverges from the submit-time ``task_key`` (so
        # the client's re-request never reads back the cache the task wrote).
        set_query_context_form_data(
            query_context,
            int(query_context.datasource.id),
            query_context.datasource.type,
        )
        # Floor the result-cache TTL: async caches the result for a follow-up
        # request to read back (see get_cache_timeout).
        query_context.is_async_execution = True
        query_obj = query_context.queries[0]
        # Stamp this query with the executing task's UUID as its forced-refresh
        # nonce. A forced async refresh recomputes and records a marker keyed by
        # (task_uuid, cache_key); the client's synchronous read-back carries the
        # same task_id (from the 202) per query, so it reads the warmed result
        # instead of recomputing — and a concurrent refresh joining this SHARED
        # task reads back under the same id. Only consulted when force is true.
        query_obj.force_nonce = str(get_context().task_uuid)
        if requires_totals:
            _inject_contribution_totals(query_obj, _get_dependency_cache_key())
        # Executes on cache miss and writes CacheRegion.DATA under query_cache_key.
        try:
            with _capture_query_cancellation(query_context):
                result: QueryAcquisitionResult = query_context.get_df_payload_result(
                    query_obj
                )
        except SemanticResultCompletenessError as error:
            # Task details remain subscriber-authorized. Publish only a closed
            # reason code so clients never need to display raw worker errors.
            get_context().update_task(
                payload={"semantic_result_error": error.reason}, immediate=True
            )
            raise
        validation_error: object = result.payload.get("error")
        if result.payload.get("status") == QueryStatus.FAILED and isinstance(
            validation_error, QueryObjectValidationMessage
        ):
            raise QueryObjectValidationError(
                _("Error: %(error)s", error=validation_error)
            ) from validation_error.cause
        if (
            is_totals_prerequisite
            and result.payload.get("status") == QueryStatus.FAILED
        ):
            raise SupersetException(result.payload["error"])
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

    There is no coordinator task: the client learns each query task's own honest
    status and aggregates them itself (all ``SUCCESS`` → re-issue the request, now
    served entirely from the per-query cache; any terminal non-success → error).
    How it learns them depends on the client's transport: with the realtime
    websocket enabled it waits for pushed ``task.status`` messages (reconciling via
    a one-shot ``/api/v1/task/status_changes`` catch-up on connect/reconnect), and
    otherwise it polls that endpoint. Completion is emitted per task by GTF (via the
    coordination service), which is also what the websocket transport delivers.

    Returns the HTTP 202 body ``{"task_ids": [...], "cursor": "...", "tab_id": ...}``
    — the query tasks' UUIDs in query order, the server-captured pre-task status
    cursor (the recovery watermark for polling/catch-up), and the tab id the
    subscription policy recorded for this request (echoed so a later cancel detaches
    exactly this tab; omitted when the caller supplied none). Client aborts may
    unsubscribe from shared work or abort pending work; a running query is also
    cancelled at the engine level on engines that expose a cancel id (see
    ``_capture_query_cancellation``).
    """
    guest_user = security_manager.get_current_guest_user_if_guest()
    guest_token = guest_user.guest_token if guest_user else None

    # Capture a status-poll cursor BEFORE any task is created. Because it
    # predates every task's creation (and therefore every terminal transition),
    # the client can poll `status_changes` from it and is guaranteed to observe
    # each task's completion — closing the race where a task finishes before the
    # client's waiter/poll is established. Returned in the 202 (one small value,
    # unlike echoing every task id back). Floored to whole seconds via the shared
    # helper so it can't sit after a same-second change under the metastore's
    # ``changed_on`` precision (see floored_status_cursor).
    poll_cursor = floored_status_cursor()

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
        is_totals_prerequisite: bool = index == totals_idx and bool(needs_totals)
        # Task dedup ignores arguments; keep the two failure policies distinct.
        task_key: str | None = (
            f"totals:{query_cache_keys[index]}"
            if is_totals_prerequisite and query_cache_keys[index] is not None
            else query_cache_keys[index]
        )
        return execute_chart_query.schedule(
            serialized_queries[index],
            user_id,
            guest_token,
            _needs_prerequisite_totals(index),
            **({"is_totals_prerequisite": True} if is_totals_prerequisite else {}),
            options=TaskOptions(
                task_key=task_key,
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
        # Echo back the tab id the subscription policy recorded as this tab's
        # consumer entry, so a later cancel detaches exactly that entry. Returning
        # the server-recorded value (rather than the client re-reading its tab id
        # at cancel time) closes the window where a tab-id reassignment between the
        # POST and the 202 would target the wrong subscription. Omitted when the
        # caller supplied no (valid) tab id.
        **({"tab_id": tab_id} if (tab_id := get_request_tab_id()) else {}),
    }
