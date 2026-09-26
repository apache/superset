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
import threading
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import patch, PropertyMock

import pytest
from fastmcp import Client, Context, FastMCP
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from superset.extensions import db
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.server import build_middleware_list
from superset.mcp_service.session_scope import install_mcp_session_scoping

WORKERS = 2
# The smallest pool that admits WORKERS tool calls: one connection per tool
# worker, one per cancellation worker, and one for transport-side lookups.
POOL_SIZE = 2 * WORKERS + 1


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
    ("pool_options", "configured", "expected"),
    [
        # SQLAlchemy's default QueuePool lends 5 + 10 connections.
        ({}, None, 7),
        ({}, 16, 7),
        ({}, 4, 4),
        ({"pool_size": 20, "max_overflow": 20}, None, 16),
        ({"pool_size": 20, "max_overflow": 20}, 19, 19),
        ({"max_overflow": -1}, 32, 32),
        ({"poolclass": NullPool}, None, 16),
    ],
)
def test_tool_workers_leave_metadata_connections_for_cancellation(
    app: Any,
    tmp_path: Path,
    pool_options: dict[str, Any],
    configured: int | None,
    expected: int,
) -> None:
    """Each call and its cancellation get a connection, with one to spare."""
    from superset.mcp_service.worker import tool_worker_count

    engine = create_engine(f"sqlite:///{tmp_path / 'metadata.db'}", **pool_options)
    previous = app.config.get("MCP_TOOL_WORKERS")
    app.config["MCP_TOOL_WORKERS"] = configured
    try:
        with patch.object(
            type(db), "engine", new_callable=PropertyMock, return_value=engine
        ):
            assert tool_worker_count(app) == expected
    finally:
        app.config["MCP_TOOL_WORKERS"] = previous
        engine.dispose()


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
        pytest.raises(ValueError, match="needs at least 3"),
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
