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
"""Bounded, deadline-aware execution of MCP tools outside the transport loop.

The tool's coroutine runs on a worker-owned loop because its database APIs are
synchronous. Only transport notifications are marshalled back to the server
loop. Flask and SQLAlchemy lifetimes belong to the worker, not the waiting
request: a timed-out DBAPI call cannot outlive and reuse a torn-down session.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from typing import Any, Callable, Coroutine, Iterator, ParamSpec, TYPE_CHECKING, TypeVar
from weakref import WeakKeyDictionary

from fastmcp.exceptions import ToolError
from flask import current_app, g, has_app_context, has_request_context
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm.state import InstanceState
from sqlalchemy.pool import QueuePool

from superset.mcp_service.session_scope import _mcp_session_token

if TYPE_CHECKING:
    from flask import Flask

    from superset.models.core import Database

logger = logging.getLogger(__name__)
_active_call: ContextVar[WorkerCall | None] = ContextVar(
    "mcp_worker_call", default=None
)
_metadata_context_owned: ContextVar[bool] = ContextVar(
    "mcp_metadata_context_owned", default=False
)
_P = ParamSpec("_P")
_T = TypeVar("_T")
_pools_lock = threading.Lock()
_pools: WeakKeyDictionary[Flask, WorkerPool] = WeakKeyDictionary()


class WorkerDeadlineExceeded(BaseException):
    """Stop abandoned work without being swallowed by tool error handlers."""


BUSY_MESSAGE = "MCP server busy: all tool workers are occupied. Retry later."

# Tools that only read Superset's metadata database. They are admitted under a
# separate, larger bound so they keep answering while slow warehouse queries
# hold every warehouse slot. Anything that can reach a warehouse, a semantic
# layer or a screenshot service stays in the warehouse bound. A listed tool
# that does reach a warehouse must still take a warehouse slot first (see
# WorkerCall.admit_warehouse), so a wrong entry cannot overdraw the pool.
METADATA_ONLY_TOOLS = frozenset(
    {
        "find_users",
        "get_annotation_layer_info",
        "get_chart_info",
        "get_chart_type_schema",
        "get_dashboard_info",
        "get_database_info",
        "get_dataset_info",
        "get_instance_info",
        "get_layer_annotation_info",
        "get_query_info",
        "get_report_info",
        "get_rls_filter_info",
        "get_role_info",
        "get_saved_query_info",
        "get_schema",
        "get_tag_info",
        "get_task_info",
        "get_theme_info",
        "get_user_info",
        "health_check",
        "list_annotation_layers",
        "list_charts",
        "list_dashboards",
        "list_databases",
        "list_datasets",
        "list_layer_annotations",
        "list_queries",
        "list_reports",
        "list_rls_filters",
        "list_roles",
        "list_saved_queries",
        "list_tags",
        "list_tasks",
        "list_themes",
        "list_users",
    }
)


class WorkerPool:
    """Bound submissions, including abandoned work; never queue behind a query."""

    def __init__(
        self,
        size: int,
        metadata_size: int = 0,
        transport_size: int = 1,
    ) -> None:
        if size < 1:
            raise ValueError("MCP_TOOL_WORKERS must be positive")
        if metadata_size < 0:
            raise ValueError("MCP_METADATA_TOOL_WORKERS must not be negative")
        self.slots = threading.BoundedSemaphore(size)
        self.metadata_slots = (
            threading.BoundedSemaphore(metadata_size) if metadata_size else None
        )
        self.executor = ThreadPoolExecutor(
            size + metadata_size, thread_name_prefix="mcp-tool"
        )
        # Cancellation must not wait behind the warehouse work it is cancelling.
        # Only calls holding a warehouse slot register cancellation.
        self.cancel_slots = threading.BoundedSemaphore(size)
        self.cancellations = ThreadPoolExecutor(size, thread_name_prefix="mcp-cancel")
        # Transport-side metadata I/O (tools/list filtering, audit writes,
        # error hooks) is bounded too, so it cannot overdraw the connections
        # budgeted for tool workers. Callers wait for it on the event loop
        # without blocking it.
        self.transport = ThreadPoolExecutor(
            transport_size, thread_name_prefix="mcp-metadata"
        )

    def admission(self, metadata_only: bool) -> threading.BoundedSemaphore:
        """Choose the bound a call is admitted under."""
        if metadata_only and self.metadata_slots is not None:
            return self.metadata_slots
        return self.slots

    def submit(
        self,
        fn: Callable[[], Any],
        finished: Callable[[], None],
        slots: threading.BoundedSemaphore | None = None,
    ) -> Future[Any]:
        """Admit immediately or report overload without retaining a queued call."""
        slots = self.slots if slots is None else slots
        if not slots.acquire(blocking=False):
            raise ToolError(BUSY_MESSAGE)
        try:
            future = self.executor.submit(fn)
        except BaseException:
            slots.release()
            raise
        future.add_done_callback(lambda _: finished())
        return future

    def cancel(self, fn: Callable[[], None], finished: Callable[[], None]) -> bool:
        """Bound cancellation I/O separately so it cannot delay the caller."""
        if not self.cancel_slots.acquire(blocking=False):
            return False
        try:
            future = self.cancellations.submit(fn)
        except RuntimeError:
            self.cancel_slots.release()
            return False

        def completed(_: Future[None]) -> None:
            """Release cancellation capacity before admitting another tool call."""
            self.cancel_slots.release()
            finished()

        future.add_done_callback(completed)
        return True


DEFAULT_TOOL_WORKERS = 16
DEFAULT_METADATA_TOOL_WORKERS = 16
# Threads, and so metadata connections, for transport-side metadata I/O.
TRANSPORT_METADATA_THREADS = 1


def _metadata_pool_capacity(app: Flask) -> int | None:
    """Return how many metadata connections can be checked out at once.

    ``None`` means a checkout never waits for another holder to return one
    (e.g. ``NullPool``, per-thread pools, or unlimited overflow).
    """
    from superset import db

    with app.app_context():
        pool = db.engine.pool
    if not isinstance(pool, QueuePool):
        return None
    # SQLAlchemy has no public accessor for the configured overflow limit.
    max_overflow = pool._max_overflow  # pylint: disable=protected-access
    return None if max_overflow < 0 else pool.size() + max_overflow


def admission_counts(app: Flask) -> tuple[int, int]:
    """Split the metadata pool between warehouse and metadata-only calls.

    Every holder of a metadata connection is bounded and budgeted:

    - each warehouse-capable call can hold one for the whole of its warehouse
      I/O, and its cancellation needs another (``2 * workers``);
    - each metadata-only call holds at most one (``metadata_workers``);
    - transport-side metadata I/O runs on ``TRANSPORT_METADATA_THREADS``.

    ``2 * workers + metadata_workers + TRANSPORT_METADATA_THREADS`` never
    exceeds the pool's capacity, so with every slot admitted no checkout
    waits for another holder. Unless configured, warehouse calls get about
    two thirds of the remaining connections and metadata-only calls the
    rest, each up to 16. Explicit settings above the budget are reduced
    with a warning. ``0`` metadata-only workers admits those tools under
    the warehouse bound.

    Returns ``(workers, metadata_workers)``.
    """
    configured = app.config.get("MCP_TOOL_WORKERS")
    configured_metadata = app.config.get("MCP_METADATA_TOOL_WORKERS")
    if configured_metadata is not None and configured_metadata < 0:
        raise ValueError("MCP_METADATA_TOOL_WORKERS must not be negative")
    capacity = _metadata_pool_capacity(app)
    if capacity is None:
        return (
            DEFAULT_TOOL_WORKERS if configured is None else configured,
            DEFAULT_METADATA_TOOL_WORKERS
            if configured_metadata is None
            else configured_metadata,
        )
    available = capacity - TRANSPORT_METADATA_THREADS
    limit = available // 2
    if limit < 1:
        raise ValueError(
            f"The metadata database pool allows {capacity} connections; "
            "MCP tool execution needs at least "
            f"{2 + TRANSPORT_METADATA_THREADS}"
        )
    if configured is None:
        workers = min(DEFAULT_TOOL_WORKERS, max(1, available // 3))
    elif configured > limit:
        logger.warning(
            "MCP_TOOL_WORKERS=%s needs %s metadata database connections, but the "
            "pool allows %s; admitting %s concurrent tool calls. Raise the pool's "
            "pool_size/max_overflow in SQLALCHEMY_ENGINE_OPTIONS to admit more.",
            configured,
            2 * configured + TRANSPORT_METADATA_THREADS,
            capacity,
            limit,
        )
        workers = limit
    else:
        workers = configured
    remaining = available - 2 * workers
    if configured_metadata is None:
        metadata_workers = min(DEFAULT_METADATA_TOOL_WORKERS, remaining)
    elif configured_metadata > remaining:
        logger.warning(
            "MCP_METADATA_TOOL_WORKERS=%s exceeds the %s metadata database "
            "connections left after %s warehouse-capable tool calls; admitting "
            "%s metadata-only tool calls.",
            configured_metadata,
            remaining,
            workers,
            remaining,
        )
        metadata_workers = remaining
    else:
        metadata_workers = configured_metadata
    return workers, metadata_workers


def tool_worker_count(app: Flask) -> int:
    """Admit only as many warehouse-capable calls as the pool can always serve."""
    return admission_counts(app)[0]


def metadata_tool_worker_count(app: Flask) -> int:
    """Admit metadata-only calls from what warehouse calls leave of the pool."""
    return admission_counts(app)[1]


def _get_pool(app: Flask) -> WorkerPool:
    """Lazily create a pool for this application, without import-time threads."""
    with _pools_lock:
        if app not in _pools:
            size, metadata_size = admission_counts(app)
            logger.info(
                "MCP tool calls admitted concurrently: %s warehouse-capable, "
                "%s metadata-only; %s transport metadata thread(s)",
                size,
                metadata_size,
                TRANSPORT_METADATA_THREADS,
            )
            _pools[app] = WorkerPool(size, metadata_size, TRANSPORT_METADATA_THREADS)
        return _pools[app]


class WorkerCall:
    """Thread-safe deadline and cancellation registration for one tool call."""

    def __init__(
        self,
        app: Flask,
        pool: WorkerPool,
        seconds: float,
        metadata_only: bool = False,
    ) -> None:
        self.app = app
        self.pool = pool
        self.admitted = pool.admission(metadata_only)
        # Slots to release once query and cancellation I/O have both ended.
        self.held = [self.admitted]
        self.loop = asyncio.get_running_loop()
        self.seconds = seconds
        self.deadline = time.monotonic() + seconds
        from superset.mcp_service.middleware import _mcp_call_id_var

        self.call_id = _mcp_call_id_var.get() or uuid.uuid4().hex
        self.expired = threading.Event()
        self.lock = threading.RLock()
        self.pending = 1
        self.cancel_query: Callable[[], None] | None = None
        self.cancel_dispatched = False
        self.user_id: int | None = None

    def check(self) -> None:
        """Prevent an abandoned tool from starting more work or mutations."""
        if self.expired.is_set() or time.monotonic() >= self.deadline:
            # BaseException deliberately bypasses tools' broad Exception handlers.
            raise WorkerDeadlineExceeded()

    def dispatch_cancel(self) -> bool:
        """Dispatch at most once for the active cursor, including late handles."""
        with self.lock:
            if self.cancel_query is None or self.cancel_dispatched:
                return self.cancel_dispatched
            self.pending += 1
            self.cancel_dispatched = self.pool.cancel(self.cancel_query, self.finished)
            if not self.cancel_dispatched:
                self.pending -= 1
            return self.cancel_dispatched

    def admit_warehouse(self) -> None:
        """Hold a warehouse slot before any warehouse I/O can start.

        A call admitted as metadata-only must not hold a metadata connection
        across warehouse I/O outside the warehouse bound. Waiting for a slot
        while holding that connection would do exactly that, so fail fast.
        """
        with self.lock:
            if self.pool.slots in self.held:
                return
            if not self.pool.slots.acquire(blocking=False):
                raise ToolError(BUSY_MESSAGE)
            self.held.append(self.pool.slots)

    def finished(self) -> None:
        """Retain admission until both query and cancellation I/O have ended.

        A stuck cancellation therefore cannot consume the cancellation capacity
        needed by newly admitted queries: it retains its original tool slot.
        """
        with self.lock:
            self.pending -= 1
            if self.pending == 0:
                for slots in self.held:
                    slots.release()

    def abandon(self) -> None:
        """Signal abandonment and dispatch cancellation without blocking asyncio."""
        self.expired.set()
        dispatched = self.dispatch_cancel()
        logger.warning(
            "MCP call %s exceeded its deadline or disconnected; "
            "cancellation dispatched=%s; worker slot retained until completion",
            self.call_id,
            dispatched,
        )


class TransportContext:
    """Keep FastMCP's transport-bound async methods on their owning event loop."""

    def __init__(
        self, context: Any, loop: asyncio.AbstractEventLoop, call: WorkerCall
    ) -> None:
        self.context = context
        self.loop = loop
        self.call = call

    def __getattr__(self, name: str) -> Any:
        value = getattr(self.context, name)
        if not asyncio.iscoroutinefunction(value):
            return value

        @functools.wraps(value)
        async def forward(*args: Any, **kwargs: Any) -> Any:
            self.call.check()
            future = asyncio.run_coroutine_threadsafe(value(*args, **kwargs), self.loop)
            try:
                result = await asyncio.wait_for(
                    asyncio.wrap_future(future),
                    max(0, self.call.deadline - time.monotonic()),
                )
            except TimeoutError:
                raise WorkerDeadlineExceeded() from None
            self.call.check()
            return result

        return forward


@contextmanager
def _worker_context(app: Flask) -> Iterator[None]:
    """Give a worker an independent app context and scoped metadata session."""
    from superset.mcp_service.auth import _remove_session_safe

    token = _mcp_session_token.set(object())
    try:
        with app.app_context():
            try:
                # Clean this scope before loading any ORM user into it.
                _remove_session_safe()
                yield
            finally:
                _remove_session_safe()
    finally:
        _mcp_session_token.reset(token)


def get_context_user_id() -> int | None:
    """Read the caller's identity without refreshing an expired ORM instance."""
    if not has_app_context():
        return None
    user = getattr(g, "user", None)
    state = sa_inspect(user, raiseerr=False)
    if isinstance(state, InstanceState):
        return state.identity[0] if state.identity else None
    return getattr(user, "id", None)


async def run_in_metadata_thread(
    fn: Callable[_P, _T], *args: _P.args, **kwargs: _P.kwargs
) -> _T:
    """Run transport metadata I/O with thread-owned Flask and session lifetimes.

    ``to_thread`` copies contextvars, including Flask contexts and MCP session
    tokens. Replace those owners, reload ORM users, and retain only request and
    routing data. Cleanup belongs to the thread even if its awaiter disconnects.
    This uses the metadata executor rather than admitted tool workers, which
    may themselves be waiting for transport notifications.
    """
    from contextlib import nullcontext

    from flask.globals import _cv_request

    if has_app_context():
        app = current_app._get_current_object()
        snapshot = dict(vars(g._get_current_object()))
    else:
        from superset.mcp_service.flask_singleton import get_flask_app

        app = get_flask_app()
        snapshot = {}
    user = snapshot.pop("user", None)
    state = sa_inspect(user, raiseerr=False)
    is_orm_user = isinstance(state, InstanceState)
    user_id = get_context_user_id() if is_orm_user else None
    request_context = _cv_request.get(None)
    request_copy = request_context.copy() if request_context is not None else None

    def execute() -> _T:
        """Own teardown rather than handing a live session back to asyncio."""
        from superset import db, security_manager
        from superset.sql.execution.cancellation import without_execution_hooks

        active_token = _active_call.set(None)
        owner_token = _metadata_context_owned.set(True)
        try:
            with without_execution_hooks(), _worker_context(app):
                vars(g._get_current_object()).update(snapshot)
                with request_copy if request_copy is not None else nullcontext():
                    if is_orm_user:
                        g.user = (
                            db.session.get(security_manager.user_model, user_id)
                            if user_id is not None
                            else None
                        )
                    elif user is not None:
                        g.user = user
                    return fn(*args, **kwargs)
        finally:
            _metadata_context_owned.reset(owner_token)
            _active_call.reset(active_token)

    return await _run_on_transport_thread(app, execute)


def _current_app() -> Flask:
    """Resolve the application for work started on the transport loop."""
    if has_app_context():
        return current_app._get_current_object()
    from superset.mcp_service.flask_singleton import get_flask_app

    return get_flask_app()


def transport_executor(app: Flask) -> ThreadPoolExecutor:
    """Bounded threads for transport-side metadata I/O, within the pool budget."""
    return _get_pool(app).transport


async def _run_on_transport_thread(app: Flask, fn: Callable[[], _T]) -> _T:
    """Run blocking transport-side work on the bounded metadata threads.

    Like ``asyncio.to_thread``, contextvars are copied and the work keeps
    running if its awaiter is cancelled.
    """
    context = copy_context()
    return await asyncio.get_running_loop().run_in_executor(
        transport_executor(app), context.run, fn
    )


async def run_in_transport_thread(
    fn: Callable[_P, _T], *args: _P.args, **kwargs: _P.kwargs
) -> _T:
    """Run code that owns its own Flask context on a transport metadata thread."""
    return await _run_on_transport_thread(
        _current_app(), functools.partial(fn, *args, **kwargs)
    )


async def run_in_worker(
    fn: Callable[..., Coroutine[Any, Any, Any]],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    seconds: float,
    metadata_only: bool = False,
) -> Any:
    """Run a complete tool lifecycle in a bounded, independently owned worker.

    ``metadata_only`` admits the call under the metadata-only bound; it still
    takes a warehouse slot if it reaches a warehouse.
    """
    if active := _active_call.get():
        # Composed tools share the outer deadline and worker/session ownership.
        # A nested auth hook can inject the original transport Context again.
        nested_kwargs = dict(kwargs)
        if "ctx" in nested_kwargs and not isinstance(
            nested_kwargs["ctx"], TransportContext
        ):
            nested_kwargs["ctx"] = TransportContext(
                nested_kwargs["ctx"], active.loop, active
            )
        active.check()
        return await fn(*args, **nested_kwargs)

    if has_app_context():
        app = current_app._get_current_object()
    else:
        from superset.mcp_service.flask_singleton import get_flask_app

        app = get_flask_app()
    pool = _get_pool(app)
    call = WorkerCall(app, pool, seconds, metadata_only)
    loop = asyncio.get_running_loop()
    worker_kwargs = dict(kwargs)
    if "ctx" in worker_kwargs:
        worker_kwargs["ctx"] = TransportContext(worker_kwargs["ctx"], loop, call)
    # Copy contextvars (token, tenant routing), but never share Flask g or a
    # metadata Session. Request-backed middleware's user is reloaded by id.
    from flask.globals import _cv_request

    request_context = _cv_request.get(None)
    request_copy = request_context.copy() if request_context is not None else None
    globals_snapshot = dict(vars(g._get_current_object())) if has_app_context() else {}
    user = globals_snapshot.pop("user", None) if has_request_context() else None
    globals_snapshot.pop("user", None)
    # An expired ORM user's .id can issue metadata I/O on the transport loop.
    # The identity key is available without loading any attributes.
    user_state = sa_inspect(user, raiseerr=False)
    user_id = (
        user_state.identity[0]
        if isinstance(user_state, InstanceState) and user_state.identity
        else getattr(user, "id", None)
    )
    guest = user if getattr(user, "is_guest_user", False) else None
    context = copy_context()

    def execute() -> Any:
        """Own context teardown even when the caller stops waiting."""
        from contextlib import nullcontext

        from superset import db, security_manager
        from superset.sql.execution.cancellation import (
            before_warehouse_access,
            cursor_scope,
        )

        _active_call.set(call)
        cursor_scope.set(warehouse_cursor)
        before_warehouse_access.set(call.admit_warehouse)
        with _worker_context(app):
            vars(g._get_current_object()).update(globals_snapshot)
            with request_copy if request_copy is not None else nullcontext():
                if user_id is not None:
                    g.user = db.session.get(security_manager.user_model, user_id)
                elif guest is not None:
                    g.user = guest
                call.check()
                result = asyncio.run(fn(*args, **worker_kwargs))
                call.check()
                return result

    future = pool.submit(lambda: context.run(execute), call.finished, call.admitted)
    wrapped = asyncio.wrap_future(future)
    try:
        # Shield the future: cancellation must not release its pool slot early.
        return await asyncio.wait_for(
            asyncio.shield(wrapped), timeout=max(0, call.deadline - time.monotonic())
        )
    except (TimeoutError, WorkerDeadlineExceeded, asyncio.CancelledError) as exc:
        call.abandon()
        # Retrieve late exceptions, including worker CancelledError, without
        # retaining a task on the transport loop after the request has ended.
        wrapped.add_done_callback(
            lambda done: None if done.cancelled() else done.exception()
        )
        if isinstance(exc, asyncio.CancelledError):
            raise
        raise ToolError(
            f"MCP tool timed out after {seconds:g} seconds. "
            "Warehouse cancellation was requested where supported. "
            f"Call id: {call.call_id}"
        ) from None
    finally:
        from superset.mcp_service.auth import _mcp_user_id_var

        _mcp_user_id_var.set(call.user_id)


class QueryCancellation:
    """Bridge engine cancellation to a separate, freshly scoped metadata session."""

    def __init__(
        self,
        call: WorkerCall,
        database: Database,
        cursor: Any,
        catalog: str | None,
        schema: str | None,
    ) -> None:
        self.call = call
        self.database = database
        self.database_id = database.id
        self.spec = database.db_engine_spec
        self.cursor = cursor
        self.catalog = catalog
        self.schema = schema
        self.cancel_id: str | None = None
        self.context = copy_context()

    def capture(self) -> None:
        """Capture an engine handle without making unsupported drivers fail."""
        from superset.tasks.query_cancel import capture_cancel_query_id

        try:
            self.cancel_id = capture_cancel_query_id(self.database, self.cursor)
        except Exception:
            logger.warning(
                "MCP call %s: cancel-id capture failed",
                self.call.call_id,
                exc_info=True,
            )

    def register(self) -> None:
        """Publish a usable handle, including one obtained after the deadline."""
        with self.call.lock:
            if self.spec.has_implicit_cancel():
                self.call.cancel_query = self.cancel_live_cursor
            elif self.cancel_id is not None:
                self.call.cancel_query = lambda: self.context.run(self.cancel)
            else:
                self.call.cancel_query = None
        if self.call.expired.is_set():
            self.call.dispatch_cancel()

    def refresh(self) -> None:
        """Capture post-execute handles before result fetching can block."""
        if not self.spec.has_query_id_before_execute:
            self.capture()
            self.register()
        self.call.check()

    def cancel_live_cursor(self) -> None:
        """Use the same implicit driver cancellation as engine handle_cursor."""
        try:
            self.cursor.cancel()
        except Exception:
            logger.warning(
                "MCP call %s: cursor cancellation failed",
                self.call.call_id,
                exc_info=True,
            )

    def cancel(self) -> None:
        """Resolve a fresh Database and acting user on the cancellation worker."""
        from superset import db, security_manager
        from superset.models.core import Database
        from superset.sql.execution.cancellation import without_execution_hooks
        from superset.tasks.query_cancel import cancel_chart_query

        active_token = _active_call.set(None)
        try:
            with without_execution_hooks(), _worker_context(self.call.app):
                if self.call.user_id is not None:
                    g.user = db.session.get(
                        security_manager.user_model, self.call.user_id
                    )
                target = db.session.get(Database, self.database_id)
                if target is not None and self.cancel_id is not None:
                    cancel_chart_query(
                        target, self.cancel_id, catalog=self.catalog, schema=self.schema
                    )
        except Exception:
            logger.warning(
                "MCP call %s: cancellation failed", self.call.call_id, exc_info=True
            )
        finally:
            _active_call.reset(active_token)


@contextmanager
def warehouse_cursor(
    database: Database, cursor: Any, catalog: str | None, schema: str | None
) -> Iterator[None]:
    """Register Superset's engine cancellation hook for an MCP warehouse call."""
    call = _active_call.get()
    if call is None:
        yield
        return
    from superset.sql.execution.cancellation import after_execute, check_deadline

    call.check()
    call.admit_warehouse()
    cancellation = QueryCancellation(call, database, cursor, catalog, schema)
    with call.lock:
        call.cancel_dispatched = False
    cancellation.capture()
    cancellation.register()
    deadline_token = check_deadline.set(call.check)
    execute_token = after_execute.set(cancellation.refresh)
    # A failed or abandoned call keeps its metadata session until the tool has
    # handled the error: engine wrappers such as check_for_oauth2 read ORM rows
    # while it unwinds. _worker_context then rolls it back and removes it.
    try:
        call.check()
        yield
        call.check()
    finally:
        after_execute.reset(execute_token)
        check_deadline.reset(deadline_token)
        with call.lock:
            call.cancel_query = None
