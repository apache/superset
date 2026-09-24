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
"""Real blocking SQL at the MCP boundary must not monopolize its event loop."""

import asyncio
import sqlite3
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError
from flask import current_app, g
from pydantic import BaseModel
from sqlalchemy import text

from superset.extensions import db
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.session_scope import install_mcp_session_scoping


class SleepRequest(BaseModel):
    """Small tool contract used to exercise the production auth/runtime wrapper."""

    timeout: float = 0.2
    delay: float = 1.0


@pytest.fixture(params=["chart", "sql_lab", "sync_chart", "sync_sql_lab"])
def server(app: Any, request: pytest.FixtureRequest) -> Iterator[FastMCP]:
    """Use the real transport and auth wrapper, mocking only user resolution."""
    app.config["MCP_TOOL_WORKERS"] = 2
    install_mcp_session_scoping()
    mcp = FastMCP("worker regression")

    path = request.param.removeprefix("sync_")

    def sleep_query(request: SleepRequest) -> str:
        """Exercise the real chart/SQL Lab executor with a sleeping SQL function."""
        from superset.models.core import Database
        from superset.sql.execution.executor import SQLExecutor
        from superset.sql.parse import SQLScript

        database = Database(database_name="worker-test", sqlalchemy_uri="sqlite://")

        @contextmanager
        def connection(**kwargs: Any) -> Iterator[sqlite3.Connection]:
            """Create and close the warehouse connection on its owning thread."""
            conn = sqlite3.connect(":memory:")
            try:
                conn.create_function("sleep", 1, time.sleep)
                yield conn
            finally:
                conn.close()

        with patch.object(database, "get_raw_connection", side_effect=connection):
            sql = f"SELECT sleep({request.delay})"
            if path == "chart":
                database.get_df(sql)
            else:
                script = SQLScript(sql, "sqlite")
                SQLExecutor(database)._execute_statements(
                    script, script, None, None, Mock(progress=0, schema=None)
                )
        return "finished"

    async def async_sleep_query(request: SleepRequest) -> str:
        """Exercise an async tool that calls synchronous warehouse APIs."""
        return sleep_query(request)

    async def quick_query() -> str:
        """A second request must finish while the first is inside DBAPI."""
        return "quick"

    with patch("superset.mcp_service.auth._setup_user_context", return_value=None):
        query = sleep_query if request.param.startswith("sync_") else async_sleep_query
        mcp.tool(mcp_auth_hook(query), name="sleep_query")
        mcp.tool(mcp_auth_hook(quick_query))
        yield mcp


@pytest.mark.asyncio
async def test_sleeping_query_returns_at_tool_deadline(server: FastMCP) -> None:
    """On master the call succeeds only after the whole one-second SQL sleep."""
    async with Client(server) as client:
        started = time.monotonic()
        with pytest.raises(ToolError, match="timed out after 0.2 seconds"):
            await client.call_tool("sleep_query", {"request": {}})
        assert 0.15 <= time.monotonic() - started < 0.7
    # Let the abandoned DBAPI call finish before fixture/context teardown.
    await asyncio.sleep(1.05)


@pytest.mark.asyncio
async def test_second_request_finishes_during_sleeping_query(server: FastMCP) -> None:
    """On master the sleep blocks even scheduling the second request."""
    async with Client(server) as client:
        started = time.monotonic()
        slow = asyncio.create_task(
            client.call_tool("sleep_query", {"request": {"timeout": 2}})
        )
        await asyncio.sleep(0.05)
        result = await client.call_tool("quick_query", {})
        elapsed = time.monotonic() - started
        await slow
        assert result.data == "quick"
        assert elapsed < 0.7


@pytest.mark.asyncio
async def test_full_pool_fails_fast_and_retains_abandoned_slot(app: Any) -> None:
    """A caller timeout cannot admit extra work while its driver is still busy."""
    from superset.mcp_service.worker import run_in_worker, WorkerPool

    pool = WorkerPool(1)
    entered = threading.Event()
    release = threading.Event()

    async def blocked() -> None:
        """Simulate an uncancellable warehouse connection."""
        entered.set()
        release.wait(3)

    try:
        with patch("superset.mcp_service.worker._get_pool", return_value=pool):
            with pytest.raises(ToolError, match="timed out"):
                await run_in_worker(blocked, (), {}, 0.1)
            assert entered.is_set()
            started = time.monotonic()
            with pytest.raises(ToolError, match="server busy"):
                await run_in_worker(blocked, (), {}, 0.1)
            assert time.monotonic() - started < 0.1
    finally:
        release.set()
        await asyncio.to_thread(pool.executor.shutdown)
        pool.cancellations.shutdown()


@pytest.mark.asyncio
async def test_worker_owns_context_session_and_transport_loop(app: Any) -> None:
    """No shared g/Session, and ctx notifications stay on the transport loop."""
    from superset.mcp_service.worker import run_in_worker

    install_mcp_session_scoping()
    parent_session = db.session()
    parent_g = g._get_current_object()
    loop_thread = threading.get_ident()
    sessions = []
    contexts = []

    async def notify(message: str) -> None:
        """Assert the notification is on the server thread."""
        assert message == "worker"
        assert threading.get_ident() == loop_thread

    ctx = Mock()
    ctx.info = notify

    async def query(ctx: Any) -> int:
        """Use real scoped sessions on sequential worker calls."""
        assert threading.get_ident() != loop_thread
        assert current_app._get_current_object() is app
        assert g._get_current_object() is not parent_g
        session = db.session()
        sessions.append(session)
        contexts.append(g._get_current_object())
        assert session is not parent_session
        assert session.execute(text("SELECT 1")).scalar() == 1
        await ctx.info("worker")
        return 1

    assert await run_in_worker(query, (), {"ctx": ctx}, 2) == 1
    assert await run_in_worker(query, (), {"ctx": ctx}, 2) == 1
    assert sessions[0] is not sessions[1]
    assert contexts[0] is not contexts[1]
    assert db.session() is parent_session
    assert all(
        session not in db.session.registry.registry.values() for session in sessions
    )


@pytest.mark.asyncio
async def test_timeout_dispatches_engine_cancellation_off_loop(app: Any) -> None:
    """Use existing cancellation hooks, without sharing ORM/session objects."""
    from superset.mcp_service.worker import run_in_worker
    from superset.sql.execution.cancellation import cancellable_cursor

    entered = threading.Event()
    cancelled = threading.Event()
    finished = threading.Event()
    database = Mock(id=42)
    database.db_engine_spec.has_implicit_cancel.return_value = False
    database.db_engine_spec.has_query_id_before_execute = True
    cursor = Mock()
    server_thread = threading.get_ident()
    worker_session = []

    async def query() -> None:
        """Block until the separate engine cancellation connection releases us."""
        try:
            worker_session.append(db.session())
            with cancellable_cursor(database, cursor, "catalog", "schema"):
                entered.set()
                cancelled.wait(3)
        finally:
            finished.set()

    def cancel(target: Any, cancel_id: str, **kwargs: Any) -> bool:
        """Verify the cancellation thread has a distinct metadata session."""
        assert threading.get_ident() != server_thread
        assert db.session() is not worker_session[0]
        assert target is database
        assert cancel_id == "warehouse-handle"
        assert kwargs == {"catalog": "catalog", "schema": "schema"}
        cancelled.set()
        return True

    with (
        patch(
            "superset.tasks.query_cancel.capture_cancel_query_id",
            return_value="warehouse-handle",
        ),
        patch(
            "superset.tasks.query_cancel.cancel_chart_query", side_effect=cancel
        ) as cancellation,
        patch.object(db.session, "get", return_value=database),
    ):
        with pytest.raises(ToolError, match="timed out"):
            await run_in_worker(query, (), {}, 0.15)
        assert entered.is_set()
        assert await asyncio.to_thread(finished.wait, 2)
        cancellation.assert_called_once()
        assert cancelled.is_set()


@pytest.mark.asyncio
async def test_late_cancel_handle_is_used_after_deadline(app: Any) -> None:
    """An async driver's handle may arrive only after the caller has timed out."""
    from superset.mcp_service.worker import run_in_worker
    from superset.sql.execution.cancellation import cancellable_cursor, query_executed

    database = Mock(id=42)
    database.db_engine_spec.has_implicit_cancel.return_value = False
    database.db_engine_spec.has_query_id_before_execute = False
    cancelled = threading.Event()
    finished = threading.Event()

    async def query() -> None:
        """Publish the handle after the request's deadline has expired."""
        try:
            with cancellable_cursor(database, Mock()):
                time.sleep(0.25)
                query_executed()
                pytest.fail("An expired call must not proceed to fetch results")
        finally:
            finished.set()

    with (
        patch(
            "superset.tasks.query_cancel.capture_cancel_query_id",
            side_effect=[None, "late-handle"],
        ),
        patch(
            "superset.tasks.query_cancel.cancel_chart_query",
            side_effect=lambda *args, **kwargs: cancelled.set(),
        ) as cancellation,
        patch.object(db.session, "get", return_value=database),
    ):
        with pytest.raises(ToolError, match="timed out"):
            await run_in_worker(query, (), {}, 0.1)
        assert await asyncio.to_thread(finished.wait, 2)
        assert await asyncio.to_thread(cancelled.wait, 2)
        assert cancellation.call_args.args[1] == "late-handle"


@pytest.mark.asyncio
async def test_implicit_cursor_cancellation(app: Any) -> None:
    """Presto/Hive-style engines cancel the live cursor instead of another one."""
    from superset.mcp_service.worker import run_in_worker
    from superset.sql.execution.cancellation import cancellable_cursor

    database = Mock(id=42)
    database.db_engine_spec.has_implicit_cancel.return_value = True
    cursor = Mock()
    cancelled = threading.Event()
    finished = threading.Event()
    cursor.cancel.side_effect = cancelled.set

    async def query() -> None:
        """Wait for the same driver hook used by the engine's handle_cursor."""
        try:
            with cancellable_cursor(database, cursor):
                cancelled.wait(2)
        finally:
            finished.set()

    with patch(
        "superset.tasks.query_cancel.capture_cancel_query_id", return_value=None
    ):
        with pytest.raises(ToolError, match="timed out"):
            await run_in_worker(query, (), {}, 0.1)
        assert await asyncio.to_thread(finished.wait, 2)
        cursor.cancel.assert_called_once()


@pytest.mark.asyncio
async def test_failed_warehouse_discards_metadata_session(app: Any) -> None:
    """A failed query cannot hand its metadata session to the next worker call."""
    from sqlalchemy_continuum import versioning_manager

    from superset.mcp_service.worker import run_in_worker, WorkerPool
    from superset.sql.execution.cancellation import cancellable_cursor

    pool = WorkerPool(1)
    database = Mock(id=42)
    database.db_engine_spec.has_implicit_cancel.return_value = False
    sessions = []
    threads = []

    async def failed() -> None:
        """The real Session is invalidated before error handling continues."""
        session = db.session()
        sessions.append(session)
        threads.append(threading.get_ident())
        session.execute(text("SELECT 1"))
        # Continuum's rollback listener inspects other tracked connections.
        # Keep one present to reproduce failure during Session.invalidate().
        with (
            db.engine.connect() as other_connection,
            patch.dict(versioning_manager.units_of_work, {other_connection: Mock()}),
            patch.object(session, "invalidate", wraps=session.invalidate) as invalidate,
        ):
            with pytest.raises(RuntimeError, match="warehouse failed"):
                with cancellable_cursor(database, Mock()):
                    raise RuntimeError("warehouse failed")
            invalidate.assert_called_once()
            assert db.session.execute(text("SELECT 1")).scalar() == 1

    async def healthy() -> None:
        """The same executor thread must receive an entirely new Session."""
        sessions.append(db.session())
        threads.append(threading.get_ident())
        assert db.session.execute(text("SELECT 1")).scalar() == 1

    try:
        with (
            patch("superset.mcp_service.worker._get_pool", return_value=pool),
            patch(
                "superset.tasks.query_cancel.capture_cancel_query_id", return_value=None
            ),
        ):
            await run_in_worker(failed, (), {}, 2)
            await run_in_worker(healthy, (), {}, 2)
        assert threads[0] == threads[1]
        assert sessions[0] is not sessions[1]
        assert all(
            session not in db.session.registry.registry.values() for session in sessions
        )
    finally:
        pool.executor.shutdown()
        pool.cancellations.shutdown()


@pytest.mark.asyncio
async def test_sqlalchemy_warehouse_queries_register_cancellation(app: Any) -> None:
    """Metadata discovery also uses the engine hooks, not just chart/SQL Lab SQL."""
    from superset.mcp_service.worker import run_in_worker
    from superset.models.core import Database

    async def discover() -> None:
        """Exercise real engine listeners; exclude the metadata DB connection."""
        database = Database(database_name="worker-test", sqlalchemy_uri="sqlite://")
        with database.get_sqla_engine() as engine:
            with engine.connect() as connection:
                assert connection.execute(text("SELECT 1")).scalar() == 1
                assert db.session.execute(text("SELECT 2")).scalar() == 2

    with patch(
        "superset.tasks.query_cancel.capture_cancel_query_id", return_value=None
    ) as capture:
        await run_in_worker(discover, (), {}, 2)
        capture.assert_called_once()


@pytest.mark.asyncio
async def test_worker_audit_identity_reaches_caller(app: Any) -> None:
    """ContextVars set in the worker's asyncio task do not propagate implicitly."""
    from superset.mcp_service.auth import _mcp_user_id_var

    user = Mock(id=7, username="worker-user", is_active=True)

    async def identify() -> int:
        """The auth hook has resolved the acting user inside the worker."""
        assert g.user is user
        return g.user.id

    with patch("superset.mcp_service.auth.get_user_from_request", return_value=user):
        wrapped = mcp_auth_hook(identify)
        assert await wrapped() == 7
    assert _mcp_user_id_var.get() == 7


@pytest.mark.asyncio
async def test_request_worker_reloads_user_and_preserves_request_context(
    app: Any,
) -> None:
    """External middleware's identity is reloaded, while request routing survives."""
    from superset.mcp_service.worker import run_in_worker

    original_user = Mock(id=7)
    worker_user = Mock(id=7)

    async def inspect_request() -> None:
        """Use a worker-owned g and Session, not the parent's ORM user."""
        from flask import request

        assert g.user is worker_user
        assert g.routing_marker == "request-route"
        assert request.path == "/mcp/"
        g.routing_marker = "worker-route"

    with app.test_request_context("/mcp/"):
        g.user = original_user
        g.routing_marker = "request-route"
        with patch.object(db.session, "get", return_value=worker_user):
            await run_in_worker(inspect_request, (), {}, 2)
        assert g.user is original_user
        assert g.routing_marker == "request-route"


@pytest.mark.asyncio
async def test_stuck_cancellation_retains_admission_slot(app: Any) -> None:
    """Old cancellation I/O must not starve cancellation for newly admitted work."""
    from superset.mcp_service.worker import _active_call, run_in_worker, WorkerPool

    pool = WorkerPool(1)
    cancelled = threading.Event()
    release = threading.Event()
    worker_done = threading.Event()

    def cancel() -> None:
        """Simulate a cancellation connection that releases SQL but hangs itself."""
        cancelled.set()
        release.wait(3)

    async def query() -> None:
        """Finish SQL before the cancellation request's connection has closed."""
        call = _active_call.get()
        assert call is not None
        with call.lock:
            call.cancel_query = cancel
        cancelled.wait(2)
        worker_done.set()

    try:
        with patch("superset.mcp_service.worker._get_pool", return_value=pool):
            with pytest.raises(ToolError, match="timed out"):
                await run_in_worker(query, (), {}, 0.1)
            assert await asyncio.to_thread(worker_done.wait, 2)
            with pytest.raises(ToolError, match="server busy"):
                await run_in_worker(query, (), {}, 0.1)
    finally:
        release.set()
        await asyncio.to_thread(pool.executor.shutdown)
        await asyncio.to_thread(pool.cancellations.shutdown)
    assert pool.slots.acquire(blocking=False)


@pytest.mark.asyncio
async def test_prequery_registers_cancellation_before_blocking(app: Any) -> None:
    """A raw connect-event cursor must be cancellable before engine statements."""
    from sqlalchemy import create_engine

    from superset.mcp_service.worker import run_in_worker, WorkerPool
    from superset.models.core import Database

    pool = WorkerPool(1)
    entered = threading.Event()
    cancelled = threading.Event()
    closed = threading.Event()
    statements = []

    class Cursor(sqlite3.Cursor):
        """A DBAPI prequery that blocks until driver cancellation arrives."""

        def execute(self, sql: str, parameters: Any = ()) -> Any:
            """Record whether a subsequent prequery escapes the deadline."""
            statements.append(sql)
            if sql == "SELECT 42":
                entered.set()
                cancelled.wait(3)
            return super().execute(sql, parameters)

        def cancel(self) -> None:
            """Emulate a driver's implicit cancellation hook."""
            cancelled.set()

        def close(self) -> None:
            """Signal cursor cleanup after the abandoned prequery returns."""
            super().close()
            closed.set()

    class Connection(sqlite3.Connection):
        """Provide a cancellable cursor for the connect-event prequeries."""

        def cursor(self, factory: Any = Cursor) -> Any:
            """Use the blocking driver cursor for this warehouse connection."""
            return super().cursor(factory)

    async def connect() -> None:
        """Open a real SQLAlchemy engine through the production model path."""
        database = Database(database_name="prequery-test", sqlalchemy_uri="sqlite://")
        engine = create_engine(
            "sqlite://",
            creator=lambda: sqlite3.connect(":memory:", factory=Connection),
        )
        with (
            patch.object(database, "_get_sqla_engine", return_value=engine),
            patch.object(
                database.db_engine_spec,
                "get_prequeries",
                return_value=["SELECT 42", "SELECT 43"],
            ),
            patch.object(
                database.db_engine_spec, "has_implicit_cancel", return_value=True
            ),
            database.get_sqla_engine() as warehouse,
            warehouse.connect(),
        ):
            pytest.fail("An expired prequery must not proceed to the main query")

    try:
        with (
            patch("superset.mcp_service.worker._get_pool", return_value=pool),
            patch(
                "superset.tasks.query_cancel.capture_cancel_query_id", return_value=None
            ),
        ):
            with pytest.raises(ToolError, match="timed out"):
                await run_in_worker(connect, (), {}, 0.15)
            assert entered.is_set()
            assert await asyncio.to_thread(cancelled.wait, 1)
            await asyncio.to_thread(pool.executor.shutdown)
            assert closed.is_set()
            assert "SELECT 43" not in statements
    finally:
        cancelled.set()
        await asyncio.to_thread(pool.executor.shutdown)
        await asyncio.to_thread(pool.cancellations.shutdown)
