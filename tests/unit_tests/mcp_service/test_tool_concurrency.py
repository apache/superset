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
"""
Tests for the admission limit on concurrent async MCP tool calls.

Each call holds a connection for its whole duration, so more calls in flight
than the pool can serve means a task waits inside the connection checkout —
blocking the event loop the other calls need to release theirs. The limit
moves that queue onto an await the loop can service.
"""

import asyncio
from unittest.mock import patch

import pytest

from superset.mcp_service import tool_concurrency
from superset.mcp_service.tool_concurrency import (
    bounded_tool_call,
    max_concurrent_tool_calls,
)


class _FakeApp:
    def __init__(self, **config):
        self.config = config


@pytest.fixture(autouse=True)
def _clear_limiters():
    tool_concurrency._limiters.clear()
    yield
    tool_concurrency._limiters.clear()


def test_limit_defaults_to_the_pool_size() -> None:
    """No explicit setting, no engine options: SQLAlchemy's own 5 + 10."""
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(),
    ):
        assert max_concurrent_tool_calls() == 15


def test_limit_follows_the_configured_pool() -> None:
    """A pool sized for the workload raises the limit with it."""
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(
            SQLALCHEMY_ENGINE_OPTIONS={"pool_size": 20, "max_overflow": 20}
        ),
    ):
        assert max_concurrent_tool_calls() == 40


def test_explicit_setting_wins_over_the_pool() -> None:
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(
            MCP_MAX_CONCURRENT_TOOL_CALLS=3,
            SQLALCHEMY_ENGINE_OPTIONS={"pool_size": 20, "max_overflow": 20},
        ),
    ):
        assert max_concurrent_tool_calls() == 3


async def _peak_concurrency(calls: int) -> int:
    """Run `calls` bounded bodies at once, return the highest overlap seen."""
    in_flight = 0
    peak = 0

    async def body() -> None:
        nonlocal in_flight, peak
        async with bounded_tool_call():
            in_flight += 1
            peak = max(peak, in_flight)
            await asyncio.sleep(0)  # let every admitted call pile up
            in_flight -= 1

    await asyncio.gather(*(body() for _ in range(calls)))
    return peak


async def test_calls_beyond_the_limit_wait_instead_of_running() -> None:
    """Twenty calls against a limit of four never overlap more than four."""
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(MCP_MAX_CONCURRENT_TOOL_CALLS=4),
    ):
        assert await _peak_concurrency(20) == 4


async def test_every_call_still_completes() -> None:
    """The limit queues calls, it does not drop them."""
    completed = 0

    async def body() -> None:
        nonlocal completed
        async with bounded_tool_call():
            await asyncio.sleep(0)
            completed += 1

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(MCP_MAX_CONCURRENT_TOOL_CALLS=2),
    ):
        await asyncio.gather(*(body() for _ in range(10)))

    assert completed == 10


async def test_zero_removes_the_limit() -> None:
    """0 is the documented escape hatch: everything runs at once."""
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(MCP_MAX_CONCURRENT_TOOL_CALLS=0),
    ):
        assert await _peak_concurrency(20) == 20


async def test_a_nested_pass_reuses_the_outer_slot() -> None:
    """The call_tool search proxy runs the middleware chain twice per call.

    Tool search is enabled by default, and the proxy reaches its target
    through ``FastMCP.call_tool()``, which runs the chain again. If each pass
    took a slot, every call would hold one while waiting for a second — a
    deadlock as soon as the limit is reached. Here the limit is one.
    """
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(MCP_MAX_CONCURRENT_TOOL_CALLS=1),
    ):

        async def proxy_then_target() -> str:
            async with bounded_tool_call():  # the call_tool proxy
                async with bounded_tool_call():  # the target tool
                    return "done"

        assert await asyncio.wait_for(proxy_then_target(), timeout=2) == "done"
        # and the slot is handed back, so the next call still gets in
        assert await asyncio.wait_for(proxy_then_target(), timeout=2) == "done"


async def test_a_failing_call_releases_its_slot() -> None:
    """An exception must not leak admission, or the server wedges."""
    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=_FakeApp(MCP_MAX_CONCURRENT_TOOL_CALLS=1),
    ):
        for _ in range(3):
            with pytest.raises(RuntimeError):
                async with bounded_tool_call():
                    raise RuntimeError("tool blew up")

        assert await _peak_concurrency(2) == 1
