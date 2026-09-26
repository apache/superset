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
