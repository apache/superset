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
"""Tool workers and the transport loop share the metadata connection pool."""

import asyncio
import sqlite3
import threading
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from fastmcp import Client, Context, FastMCP
from fastmcp.exceptions import ToolError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool, QueuePool

from superset.extensions import db
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.server import build_middleware_list
from superset.mcp_service.session_scope import install_mcp_session_scoping
from superset.utils import json

WORKERS = 2
# The smallest pool that admits WORKERS tool calls: one connection per tool
# worker, one per cancellation worker, one for transport-side metadata I/O and
# one for API-key lookups.
POOL_SIZE = 2 * WORKERS + 2


@pytest.fixture
def metadata_engine(app: Any, tmp_path: Path) -> Iterator[Engine]:
    """Bind the metadata session to a bounded pool, as in production."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'metadata.db'}",
        pool_size=POOL_SIZE,
        max_overflow=0,
        pool_timeout=4,
        connect_args={"check_same_thread": False},
    )
    previous = {
        key: app.config.get(key) for key in ("MCP_TOOL_WORKERS", "SQLLAB_TIMEOUT")
    }
    app.config["MCP_TOOL_WORKERS"] = WORKERS
    app.config["SQLLAB_TIMEOUT"] = 5
    install_mcp_session_scoping()
    db.session.remove()
    try:
        with (
            patch.object(
                type(db),
                "engines",
                new_callable=PropertyMock,
                return_value={None: engine},
            ),
            patch.object(
                type(db), "engine", new_callable=PropertyMock, return_value=engine
            ),
        ):
            yield engine
    finally:
        db.session.remove()
        engine.dispose()
        app.config.update(previous)


@pytest.mark.asyncio
async def test_saturated_workers_holding_metadata_pool_do_not_freeze_loop(
    metadata_engine: Engine,
) -> None:
    """Every tool worker waits on the loop while every connection is checked out.

    If the transport loop itself waits for a metadata connection (tools/list
    RBAC filtering, audit logging), neither side can progress until a pool or
    call timeout expires, and the whole server stops responding meanwhile.
    """
    holding = threading.Barrier(WORKERS + 1)
    notify = threading.Event()

    async def hold_and_notify(ctx: Context) -> str:
        """Keep a metadata transaction open while reporting progress."""
        db.session.execute(text("SELECT 1"))
        holding.wait(timeout=5)
        notify.wait(timeout=5)
        await ctx.info("progress")
        return "done"

    def user_lookup() -> None:
        """Resolve the caller for tools/list with a metadata query."""
        db.session.execute(text("SELECT 1"))

    mcp = FastMCP("metadata pool regression", middleware=build_middleware_list())
    with (
        patch("superset.mcp_service.auth._setup_user_context", return_value=None),
        patch(
            "superset.mcp_service.middleware.get_user_from_request",
            side_effect=user_lookup,
        ),
    ):
        mcp.tool(mcp_auth_hook(hold_and_notify), name="hold_and_notify")
        async with Client(mcp) as client:
            calls = [
                asyncio.create_task(client.call_tool("hold_and_notify", {}))
                for _ in range(WORKERS)
            ]
            await asyncio.to_thread(holding.wait, 5)
            # Other holders, such as cancellations, own the rest of the pool.
            held = [metadata_engine.connect() for _ in range(POOL_SIZE - WORKERS)]
            gaps = []

            async def heartbeat() -> None:
                """Measure how long the transport loop goes unscheduled."""
                last = time.monotonic()
                while True:
                    await asyncio.sleep(0.01)
                    now = time.monotonic()
                    gaps.append(now - last)
                    last = now

            beat = asyncio.create_task(heartbeat())
            started = time.monotonic()
            # tools/list needs metadata connections for its audit record and
            # RBAC filtering. Release the workers once it is waiting for one,
            # so their progress reports reach the loop while it waits.
            listing = asyncio.create_task(client.list_tools())
            threading.Timer(0.2, notify.set).start()
            try:
                await asyncio.sleep(0.05)
                pinged = time.monotonic()
                await client.ping()
                ping_latency = time.monotonic() - pinged
                results = await asyncio.gather(*calls)
                elapsed = time.monotonic() - started
            finally:
                for connection in held:
                    connection.close()
                beat.cancel()
            tools = await listing

    assert [result.content[0].text for result in results] == ["done"] * WORKERS
    assert [tool.name for tool in tools] == ["hold_and_notify"]
    assert ping_latency < 0.5
    assert elapsed < 1.5
    assert max(gaps) < 0.5


@pytest.mark.parametrize(
    ("pool_options", "configured", "configured_metadata", "expected"),
    [
        # SQLAlchemy's default QueuePool lends 5 + 10 connections.
        ({}, None, None, (4, 5)),
        ({}, 16, None, (6, 1)),
        ({}, 4, None, (4, 5)),
        ({}, None, 2, (4, 2)),
        ({}, None, 16, (4, 5)),
        ({}, 5, 0, (5, 0)),
        ({"pool_size": 20, "max_overflow": 20}, None, None, (12, 14)),
        ({"pool_size": 20, "max_overflow": 20}, 19, None, (19, 0)),
        ({"pool_size": 2, "max_overflow": 2}, None, None, (1, 0)),
        ({"max_overflow": -1}, 32, None, (32, 16)),
        ({"poolclass": NullPool}, None, None, (16, 16)),
    ],
)
def test_tool_workers_leave_metadata_connections_for_cancellation(
    app: Any,
    tmp_path: Path,
    pool_options: dict[str, Any],
    configured: int | None,
    configured_metadata: int | None,
    expected: tuple[int, int],
) -> None:
    """Every bounded holder of a metadata connection fits the pool at once.

    Each warehouse call and its cancellation, each metadata-only call, the
    transport-side metadata thread and the API-key lookup thread can hold one
    connection simultaneously.
    """
    from superset.mcp_service.worker import (
        admission_counts,
        METADATA_POOL_HEADROOM,
        metadata_tool_worker_count,
        tool_worker_count,
    )

    engine = create_engine(f"sqlite:///{tmp_path / 'metadata.db'}", **pool_options)
    try:
        with (
            patch.dict(
                app.config,
                {
                    "MCP_TOOL_WORKERS": configured,
                    "MCP_METADATA_TOOL_WORKERS": configured_metadata,
                },
            ),
            patch.object(
                type(db), "engine", new_callable=PropertyMock, return_value=engine
            ),
        ):
            workers, metadata_workers = admission_counts(app)
            assert (workers, metadata_workers) == expected
            assert tool_worker_count(app) == workers
            assert metadata_tool_worker_count(app) == metadata_workers
        if isinstance(engine.pool, QueuePool) and engine.pool._max_overflow >= 0:
            capacity = engine.pool.size() + engine.pool._max_overflow
            assert 2 * workers + metadata_workers + METADATA_POOL_HEADROOM <= capacity
    finally:
        engine.dispose()


def test_pool_logs_do_not_include_configuration_or_engine_values(app: Any) -> None:
    """Pool notices are static while admission still clamps both worker bounds."""
    from superset.mcp_service.worker import _get_pool

    with (
        patch.dict(
            app.config,
            {"MCP_TOOL_WORKERS": 20, "MCP_METADATA_TOOL_WORKERS": 30},
        ),
        patch("superset.mcp_service.worker._metadata_pool_capacity", return_value=15),
        patch("superset.mcp_service.worker._pools", {}),
        patch("superset.mcp_service.worker.WorkerPool") as pool_class,
        patch("superset.mcp_service.worker.logger") as logger,
    ):
        assert _get_pool(app) is pool_class.return_value

    pool_class.assert_called_once_with(6, 1, 1, 1, 32)
    assert logger.warning.call_count == 2
    logger.info.assert_called_once()
    for call in [*logger.warning.call_args_list, *logger.info.call_args_list]:
        assert len(call.args) == 1
        assert isinstance(call.args[0], str)
        assert "%s" not in call.args[0]
        assert not call.kwargs


def test_metadata_pool_too_small_for_cancellation_is_rejected(
    app: Any, tmp_path: Path
) -> None:
    """Refuse a pool where a call and its cancellation could take every slot."""
    from superset.mcp_service.worker import tool_worker_count

    engine = create_engine(
        f"sqlite:///{tmp_path / 'metadata.db'}", pool_size=2, max_overflow=0
    )
    with (
        patch.object(
            type(db), "engine", new_callable=PropertyMock, return_value=engine
        ),
        pytest.raises(ValueError, match="needs at least 4"),
    ):
        tool_worker_count(app)
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("strategy", ["bm25", "regex"])
@pytest.mark.parametrize("request_backed", [False, True])
async def test_threaded_search_returns_metadata_connection(
    app: Any, metadata_engine: Engine, strategy: str, request_backed: bool
) -> None:
    """An inherited Flask context must not bypass the search thread's cleanup."""
    from unittest.mock import AsyncMock, Mock

    from fastmcp.server.transforms.search.base import BaseSearchTransform
    from flask import g

    from superset.mcp_service.server import _create_search_transform
    from superset.mcp_service.session_scope import mcp_session_scopefunc

    sessions: dict[Any, Session] = {}

    def permission(tool: Any) -> bool:
        """Perform the metadata lookup used by database-backed RBAC."""
        sessions[mcp_session_scopefunc()] = db.session()
        db.session.execute(text("SELECT 1"))
        return True

    transform = _create_search_transform(
        strategy=strategy, kwargs={}, make_normalizing_call_tool=lambda _: None
    )
    tool = Mock()
    try:
        with app.test_request_context("/mcp/") if request_backed else app.app_context():
            g.user = Mock()
            with (
                patch.object(
                    BaseSearchTransform,
                    "_get_visible_tools",
                    new_callable=AsyncMock,
                    return_value=[tool],
                ),
                patch(
                    "superset.mcp_service.auth.is_tool_visible_to_current_user",
                    side_effect=permission,
                ),
            ):
                assert await transform._get_visible_tools(Mock()) == [tool]
            assert metadata_engine.pool.checkedout() == 0
        assert metadata_engine.pool.checkedout() == 0
        assert all(key not in db.session.registry.registry for key in sessions)
    finally:
        # Also clean up when run against the leaking implementation.
        for key, session in sessions.items():
            session.close()
            db.session.registry.registry.pop(key, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("audit_path", ["error", "response_size", "error_hook"])
async def test_error_audit_waiting_for_metadata_does_not_block_loop(
    app: Any, metadata_engine: Engine, audit_path: str
) -> None:
    """A timeout/busy error must not synchronously wait for an audit connection."""
    from unittest.mock import AsyncMock, Mock

    from fastmcp.exceptions import ToolError

    from superset.mcp_service.middleware import (
        GlobalErrorHandlerMiddleware,
        ResponseSizeGuardMiddleware,
        ToolResultCompatibilityMiddleware,
    )
    from superset.models.core import Log
    from superset.utils.log import DBEventLogger

    Log.__table__.create(metadata_engine)
    held = [metadata_engine.connect() for _ in range(POOL_SIZE)]
    heartbeat = asyncio.Event()

    async def beat() -> None:
        """Prove the transport can run while the audit checkout is blocked."""
        await asyncio.sleep(0.01)
        heartbeat.set()

    task = asyncio.create_task(beat())
    release = threading.Timer(0.3, held[-1].close)
    release.start()
    try:
        context = Mock(method="tools/call")
        context.message.name = "unknown_tool"
        context.message.arguments = {}
        event_logger = DBEventLogger()

        def error_hook(error: Exception, info: dict[str, Any]) -> None:
            """An operator hook may itself perform metadata I/O."""
            event_logger.log(
                user_id=None,
                action="test_error_hook",
                dashboard_id=None,
                duration_ms=None,
                slice_id=None,
                referrer=None,
                curated_payload={"tool": info["tool_name"]},
            )

        with (
            app.test_request_context("/mcp/"),
            patch("superset.mcp_service.middleware.event_logger", event_logger),
            patch(
                "superset.mcp_service.flask_singleton.get_flask_app", return_value=app
            ),
            patch.dict(app.config, {"MCP_ERROR_HOOK": error_hook}),
        ):
            if audit_path == "error":
                with pytest.raises(ToolError, match="server busy"):
                    await GlobalErrorHandlerMiddleware()._handle_error(
                        ToolError("MCP server busy"), context, "execute_sql", 0
                    )
            elif audit_path == "response_size":
                with pytest.raises(ToolError):
                    await ResponseSizeGuardMiddleware(max_bytes=10).on_call_tool(
                        context, AsyncMock(return_value={"data": "x" * 100})
                    )
            else:
                result = await ToolResultCompatibilityMiddleware().on_call_tool(
                    context, AsyncMock(side_effect=RuntimeError("failed"))
                )
                assert result.is_error
        assert heartbeat.is_set()
        assert metadata_engine.pool.checkedout() == POOL_SIZE - 1
    finally:
        release.join()
        for connection in held:
            connection.close()
        await task
    assert metadata_engine.pool.checkedout() == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("fail", [False, True])
async def test_metadata_thread_owns_user_context_and_session(
    app: Any, metadata_engine: Engine, fail: bool
) -> None:
    """Do not share even an expired request user or an inherited session token."""
    from contextlib import nullcontext

    from flask import g, request
    from flask_appbuilder.security.sqla.models import User
    from sqlalchemy import event

    from superset.mcp_service.session_scope import _mcp_session_token
    from superset.mcp_service.worker import (
        get_context_user_id,
        run_in_metadata_thread,
    )

    User.__table__.create(metadata_engine)
    with metadata_engine.begin() as connection:
        connection.execute(
            User.__table__.insert(),
            {
                "id": 42,
                "username": "metadata-user",
                "email": "metadata@example.com",
                "first_name": "Meta",
                "last_name": "Data",
            },
        )
    token = _mcp_session_token.set(object())
    threads: list[int] = []
    sessions: list[Session] = []
    main_thread = threading.get_ident()

    def record_thread(*args: Any) -> None:
        """Track all SQL, including implicit ORM refreshes."""
        threads.append(threading.get_ident())

    def lookup() -> None:
        """Read a reloaded user while owning fresh request globals and session."""
        assert g.user is not user
        assert g.user.username == "metadata-user"
        assert request.path == "/mcp/"
        assert g.routing_marker == "caller"
        g.routing_marker = "metadata"
        session = db.session()
        sessions.append(session)
        assert session is not parent_session
        session.execute(text("SELECT 1"))
        if fail:
            raise ValueError("metadata failed")

    try:
        with app.test_request_context("/mcp/"):
            parent_session = db.session()
            user = parent_session.get(User, 42)
            parent_session.commit()  # expire attributes and return the connection
            g.user = user
            g.routing_marker = "caller"
            event.listen(metadata_engine, "before_cursor_execute", record_thread)
            try:
                assert get_context_user_id() == 42
                with (
                    pytest.raises(ValueError, match="metadata failed")
                    if fail
                    else nullcontext()
                ):
                    await run_in_metadata_thread(lookup)
                assert g.user is user
                assert g.routing_marker == "caller"
                assert db.session() is parent_session
                assert threads
                assert main_thread not in threads
                assert metadata_engine.pool.checkedout() == 0
                assert all(
                    session not in db.session.registry.registry.values()
                    for session in sessions
                )
            finally:
                event.remove(metadata_engine, "before_cursor_execute", record_thread)
    finally:
        db.session.remove()
        _mcp_session_token.reset(token)


@pytest.mark.asyncio
async def test_cancelled_metadata_awaiter_leaves_cleanup_to_thread(
    metadata_engine: Engine,
) -> None:
    """A disconnect must neither tear down live I/O nor leak its connection."""
    from sqlalchemy import event

    from superset.mcp_service.worker import run_in_metadata_thread

    entered = threading.Event()
    release = threading.Event()
    returned = threading.Event()

    def checkin(*args: Any) -> None:
        """Signal teardown after the thread's metadata I/O has completed."""
        returned.set()

    def lookup() -> None:
        """Keep using the same live session after its awaiter disconnects."""
        db.session.execute(text("SELECT 1"))
        entered.set()
        release.wait(5)
        db.session.execute(text("SELECT 2"))

    event.listen(metadata_engine, "checkin", checkin)
    task = asyncio.create_task(run_in_metadata_thread(lookup))
    try:
        assert await asyncio.to_thread(entered.wait, 2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert metadata_engine.pool.checkedout() == 1
        assert not returned.is_set()
    finally:
        release.set()
        assert await asyncio.to_thread(returned.wait, 2)
        event.remove(metadata_engine, "checkin", checkin)
    assert metadata_engine.pool.checkedout() == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("configured", [False, True])
async def test_error_hook_does_not_require_metadata_user_reload(
    app: Any, metadata_engine: Engine, configured: bool
) -> None:
    """Error reporting survives metadata outages without sharing caller state."""
    from unittest.mock import Mock

    from flask import g
    from flask_appbuilder.security.sqla.models import User
    from sqlalchemy.orm import make_transient_to_detached

    from superset.mcp_service.middleware import _invoke_error_hook_off_loop

    main_thread = threading.get_ident()
    error = RuntimeError("tool failed")
    info = {"tool_name": "execute_sql", "user_id": 42}
    observations: list[tuple[int, Exception, dict[str, Any], User | None, Session]] = []

    with app.test_request_context("/mcp/"):
        user = User(id=42)
        make_transient_to_detached(user)
        g.user = user
        parent_session = db.session()

        def capture(exc: Exception, context: dict[str, Any]) -> None:
            """Capture errors without loading a user from the unavailable DB."""
            observations.append(
                (
                    threading.get_ident(),
                    exc,
                    context,
                    getattr(g, "user", None),
                    db.session(),
                )
            )

        hook = Mock(side_effect=capture)
        with (
            patch(
                "superset.mcp_service.flask_singleton.get_flask_app", return_value=app
            ),
            patch.dict(app.config, {"MCP_ERROR_HOOK": hook if configured else None}),
            patch.object(
                db.session, "get", side_effect=RuntimeError("metadata unavailable")
            ) as get_user,
        ):
            await _invoke_error_hook_off_loop(error, info)
            get_user.assert_not_called()
        if configured:
            hook.assert_called_once_with(error, info)
            assert len(observations) == 1
            thread_id, captured_error, context, hook_user, session = observations[0]
            assert thread_id != main_thread
            assert captured_error is error
            assert context == info
            assert hook_user is None
            assert session is not parent_session
            assert session not in db.session.registry.registry.values()
        else:
            hook.assert_not_called()
            assert not observations
        assert g.user is user
        assert db.session() is parent_session


def _add_sqlite_warehouse(engine: Engine) -> int:
    """Store a SQLite warehouse row in the bounded metadata database."""
    from superset.models.core import Database

    Database.metadata.create_all(engine)
    with engine.begin() as connection:
        # A Core insert skips the security manager's permission listeners.
        return connection.execute(
            Database.__table__.insert().values(
                database_name="warehouse", sqlalchemy_uri="sqlite://"
            )
        ).inserted_primary_key[0]


def _describe(database: Any) -> tuple[str, str, str] | Exception:
    """Read a loaded Database the way error handling and audit logging do."""
    try:
        return database.database_name, database.backend, database.db_engine_spec.engine
    except Exception as ex:  # noqa: BLE001
        return ex


@pytest.mark.asyncio
async def test_warehouse_error_reaches_caller_unchanged(
    metadata_engine: Engine,
) -> None:
    """An ordinary SQL mistake keeps its type and its caller's ORM rows usable.

    ``Database.get_sqla_engine`` wraps the warehouse I/O in ``check_for_oauth2``,
    whose handler reads the ``Database`` while the error unwinds. Discarding
    the metadata session at that point replaced the error with
    ``DetachedInstanceError``.
    """
    from superset.mcp_service.worker import run_in_worker
    from superset.models.core import Database

    _add_sqlite_warehouse(metadata_engine)
    observed: list[tuple[str, str, str] | Exception] = []

    async def query() -> None:
        """Query a missing warehouse table through the real chart-data path."""
        database = db.session.query(Database).one()
        try:
            database.get_df("SELECT * FROM table_that_does_not_exist")
        except Exception:
            observed.append(_describe(database))
            raise

    # get_df runs on a raw DBAPI cursor, so the driver's own error is expected.
    with pytest.raises(
        sqlite3.OperationalError, match="no such table: table_that_does_not_exist"
    ):
        await run_in_worker(query, (), {}, 5)
    assert observed == [("warehouse", "sqlite", "sqlite")]
    assert metadata_engine.pool.checkedout() == 0


@pytest.mark.asyncio
async def test_execute_sql_reports_missing_table_as_query_error(
    app: Any, metadata_engine: Engine
) -> None:
    """The real tool returns the warehouse message; no system error is raised."""
    from superset.mcp_service.sql_lab.tool.execute_sql import execute_sql

    database_id = _add_sqlite_warehouse(metadata_engine)
    hook = MagicMock()
    mcp = FastMCP("execute_sql regression", middleware=build_middleware_list())
    mcp.tool(execute_sql, name="execute_sql")
    with (
        patch("superset.mcp_service.auth._setup_user_context", return_value=None),
        patch(
            "superset.mcp_service.middleware.get_user_from_request", return_value=None
        ),
        patch("superset.security_manager.raise_for_access"),
        patch.dict(app.config, {"MCP_ERROR_HOOK": hook}),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "execute_sql",
                {
                    "request": {
                        "database_id": database_id,
                        "sql": "SELECT * FROM no_such_table",
                    }
                },
            )

    response = json.loads(result.content[0].text)
    assert result.is_error is False
    assert response["success"] is False
    assert response["error"] == "sqlite error: no such table: no_such_table"
    hook.assert_not_called()


@pytest.mark.parametrize(("configured", "expected"), [(None, 16), (3, 3), (0, 0)])
def test_metadata_only_bound_without_a_waiting_pool(
    app: Any, configured: int | None, expected: int
) -> None:
    """Pools that never make a checkout wait need no budget; negatives fail."""
    from superset.mcp_service.worker import metadata_tool_worker_count

    with patch.dict(app.config, {"MCP_METADATA_TOOL_WORKERS": configured}):
        assert metadata_tool_worker_count(app) == expected
    with (
        patch.dict(app.config, {"MCP_METADATA_TOOL_WORKERS": -1}),
        pytest.raises(ValueError, match="must not be negative"),
    ):
        metadata_tool_worker_count(app)


def test_app_without_metadata_database_gets_a_pool() -> None:
    """An app with no metadata engine has nothing to budget; it must not raise.

    The tool search filter runs on the transport thread, so a raise here made
    it fail open and surface tools the caller is not permitted to see.
    """
    from flask import Flask

    from superset.mcp_service.worker import (
        _get_pool,
        _metadata_pool_capacity,
        admission_counts,
        DEFAULT_METADATA_TOOL_WORKERS,
        DEFAULT_TOOL_WORKERS,
    )

    bare = Flask(__name__)
    assert _metadata_pool_capacity(bare) is None
    assert admission_counts(bare) == (
        DEFAULT_TOOL_WORKERS,
        DEFAULT_METADATA_TOOL_WORKERS,
    )
    pool = _get_pool(bare)
    try:
        assert pool.metadata_slots is not None
    finally:
        for executor in (pool.executor, pool.cancellations, pool.transport, pool.auth):
            executor.shutdown(wait=False)


def test_metadata_only_tools_are_registered_tools() -> None:
    """A renamed tool must not silently fall out of (or into) the fast bound."""
    from superset.mcp_service.app import mcp
    from superset.mcp_service.worker import METADATA_ONLY_TOOLS

    tools = {tool.name: tool for tool in asyncio.run(mcp.list_tools())}
    assert METADATA_ONLY_TOOLS <= set(tools)
    assert "execute_sql" not in METADATA_ONLY_TOOLS
    assert all(
        tools[name].annotations is not None and tools[name].annotations.readOnlyHint
        for name in METADATA_ONLY_TOOLS
    )


@pytest.fixture
def default_pool_engine(app: Any, tmp_path: Path) -> Iterator[Engine]:
    """SQLAlchemy's default 5 + 10 metadata pool, failing fast if exhausted."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'metadata.db'}",
        pool_size=5,
        max_overflow=10,
        # Any checkout that has to wait for another holder fails the test.
        pool_timeout=1,
        connect_args={"check_same_thread": False},
    )
    install_mcp_session_scoping()
    db.session.remove()
    try:
        with (
            patch.dict(
                app.config,
                {
                    "MCP_TOOL_WORKERS": None,
                    "MCP_METADATA_TOOL_WORKERS": None,
                    "SQLLAB_TIMEOUT": 10,
                },
            ),
            patch.object(
                type(db),
                "engines",
                new_callable=PropertyMock,
                return_value={None: engine},
            ),
            patch.object(
                type(db), "engine", new_callable=PropertyMock, return_value=engine
            ),
        ):
            yield engine
    finally:
        db.session.remove()
        engine.dispose()


@pytest.mark.asyncio
async def test_saturated_default_pool_never_waits_for_a_connection(
    app: Any, default_pool_engine: Engine
) -> None:
    """All warehouse slots, their cancellations, all metadata-only slots, the
    transport thread and the API-key lookup thread hold a connection at once
    without any checkout waiting, and admission refuses the next call instead
    of overdrawing.
    """
    from superset.mcp_service.worker import (
        admission_counts,
        API_KEY_CHECK_POOL_SIZE,
        METADATA_POOL_HEADROOM,
        run_api_key_lookup,
        run_in_metadata_thread,
        run_in_worker,
        TRANSPORT_METADATA_THREADS,
        WorkerPool,
    )

    workers, metadata_workers = admission_counts(app)
    assert (workers, metadata_workers) == (4, 5)
    holders = 2 * workers + metadata_workers + METADATA_POOL_HEADROOM
    assert holders == 15
    pool = WorkerPool(
        workers, metadata_workers, TRANSPORT_METADATA_THREADS, API_KEY_CHECK_POOL_SIZE
    )
    holding = threading.Barrier(workers + metadata_workers + 3)
    release = threading.Event()

    def hold() -> int:
        """Check out a metadata connection and keep it until released."""
        value = db.session.execute(text("SELECT 1")).scalar()
        holding.wait(timeout=5)
        release.wait(timeout=5)
        return value

    async def tool() -> int:
        """A tool call holding its connection, as across warehouse I/O."""
        return hold()

    try:
        with patch("superset.mcp_service.worker._get_pool", return_value=pool):
            calls = [
                asyncio.create_task(run_in_worker(tool, (), {}, 10))
                for _ in range(workers)
            ] + [
                asyncio.create_task(run_in_worker(tool, (), {}, 10, metadata_only=True))
                for _ in range(metadata_workers)
            ]
            calls.append(asyncio.create_task(run_in_metadata_thread(hold)))

            def lookup(token: str) -> int:
                """An API-key lookup, which owns its app context like FAB's."""
                with app.app_context():
                    try:
                        return hold()
                    finally:
                        db.session.remove()

            calls.append(asyncio.create_task(run_api_key_lookup(app, lookup, "k")))
            # What each warehouse call's cancellation can hold.
            cancellations = [default_pool_engine.connect() for _ in range(workers)]
            try:
                await asyncio.to_thread(holding.wait, 5)
                assert default_pool_engine.pool.checkedout() == holders
                for metadata_only in (False, True):
                    with pytest.raises(ToolError, match="server busy"):
                        await run_in_worker(
                            tool, (), {}, 10, metadata_only=metadata_only
                        )
            finally:
                release.set()
                for connection in cancellations:
                    connection.close()
            assert await asyncio.gather(*calls) == [1] * (len(calls))
    finally:
        pool.executor.shutdown()
        pool.cancellations.shutdown()
        pool.transport.shutdown()
        pool.auth.shutdown()
    assert default_pool_engine.pool.checkedout() == 0


@pytest.mark.asyncio
async def test_metadata_only_tools_answer_while_warehouse_bound_is_full(
    app: Any, default_pool_engine: Engine
) -> None:
    """Slow warehouse calls fill their bound; listing tools keep succeeding.

    Each warehouse call holds a metadata connection across its (blocked)
    warehouse I/O, as a real query does.
    """
    from superset.mcp_service.worker import admission_counts, WorkerPool

    workers, metadata_workers = admission_counts(app)
    pool = WorkerPool(workers, metadata_workers)
    holding = threading.Barrier(workers + 1)
    release = threading.Event()

    def slow_query() -> str:
        """Keep a metadata transaction open while the warehouse is busy."""
        db.session.execute(text("SELECT 1"))
        holding.wait(timeout=5)
        release.wait(timeout=5)
        return "slow"

    def list_charts() -> int:
        """Answer from the metadata database alone."""
        return db.session.execute(text("SELECT 1")).scalar()

    mcp = FastMCP("admission regression")
    with (
        patch("superset.mcp_service.auth._setup_user_context", return_value=None),
        patch("superset.mcp_service.worker._get_pool", return_value=pool),
    ):
        mcp.tool(mcp_auth_hook(slow_query, tool_name="slow_query"))
        mcp.tool(mcp_auth_hook(list_charts, tool_name="list_charts"))
        async with Client(mcp) as client:
            slow = [
                asyncio.create_task(client.call_tool("slow_query", {}))
                for _ in range(workers)
            ]
            try:
                await asyncio.to_thread(holding.wait, 5)
                with pytest.raises(ToolError, match="server busy"):
                    await client.call_tool("slow_query", {})
                listed = await asyncio.gather(
                    *(
                        client.call_tool("list_charts", {})
                        for _ in range(metadata_workers)
                    )
                )
            finally:
                release.set()
            assert [result.data for result in await asyncio.gather(*slow)] == [
                "slow"
            ] * workers

    assert [result.data for result in listed] == [1] * metadata_workers
    assert default_pool_engine.pool.checkedout() == 0
    pool.executor.shutdown()
    pool.cancellations.shutdown()


@pytest.mark.asyncio
async def test_metadata_only_call_takes_warehouse_slot_before_warehouse_io(
    metadata_engine: Engine,
) -> None:
    """A misclassified tool cannot hold metadata connections past the bound."""
    from superset.mcp_service.worker import run_in_worker, WorkerPool
    from superset.models.core import Database

    database_id = _add_sqlite_warehouse(metadata_engine)
    pool = WorkerPool(1, 2)
    entered = threading.Event()
    release = threading.Event()

    async def warehouse_call() -> None:
        """Occupy the only warehouse slot."""
        entered.set()
        release.wait(5)

    async def misclassified() -> list[Any]:
        """Reach the warehouse from a call admitted as metadata-only."""
        database = db.session.get(Database, database_id)
        with database.get_sqla_engine() as engine:
            with engine.connect() as connection:
                return connection.execute(text("SELECT 1")).all()

    try:
        with patch("superset.mcp_service.worker._get_pool", return_value=pool):
            blocked = asyncio.create_task(run_in_worker(warehouse_call, (), {}, 5))
            await asyncio.to_thread(entered.wait, 5)
            with pytest.raises(ToolError, match="server busy"):
                await run_in_worker(misclassified, (), {}, 5, metadata_only=True)
            release.set()
            await blocked
            # With a warehouse slot free, the same call is admitted and upgraded.
            assert await run_in_worker(
                misclassified, (), {}, 5, metadata_only=True
            ) == [(1,)]
        # Every slot, including the upgrade, is returned.
        assert pool.slots.acquire(blocking=False)
        assert pool.metadata_slots is not None
        assert pool.metadata_slots.acquire(blocking=False)
        assert pool.metadata_slots.acquire(blocking=False)
    finally:
        release.set()
        pool.executor.shutdown()
        pool.cancellations.shutdown()


def test_lazy_pool_creation_keeps_callers_session(
    app: Any, metadata_engine: Engine
) -> None:
    """Sizing the pool from transport-side code must not end its session."""
    from superset.mcp_service.worker import _get_pool, _pools

    with app.test_request_context("/mcp/"), patch.dict(_pools, clear=True):
        session = db.session()
        pool = _get_pool(app)
        try:
            assert db.session() is session
        finally:
            pool.executor.shutdown()
            pool.cancellations.shutdown()
            pool.transport.shutdown()
            pool.auth.shutdown()
