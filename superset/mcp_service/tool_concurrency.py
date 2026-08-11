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
"""Bounded concurrency for async MCP tool calls.

Each tool call holds its own SQLAlchemy session, hence its own connection, for
the duration of the call. Tool bodies do blocking database work on the event
loop, so once the pool is empty the task that waits for a connection blocks the
only thread there is — including the tasks holding the connections, which can
no longer reach their app context teardown to release them. Nothing moves until
the pool timeout fires, tens of seconds later.

Admitting at most ``pool_size + max_overflow`` calls at a time keeps that from
happening: the queue forms on an ``await`` the loop can service, instead of
inside the connection checkout that it cannot.

The sync tool path needs none of this — it already runs on a bounded thread
pool, where each worker waits on its own without stopping the others.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import AsyncGenerator, MutableMapping, Optional
from weakref import WeakKeyDictionary

logger = logging.getLogger(__name__)

# SQLAlchemy's own QueuePool defaults, used when SQLALCHEMY_ENGINE_OPTIONS
# does not set them.
_DEFAULT_POOL_SIZE = 5
_DEFAULT_MAX_OVERFLOW = 10

_limiters: MutableMapping[asyncio.AbstractEventLoop, asyncio.Semaphore] = (
    WeakKeyDictionary()
)

# Tool calls nest: with tool search enabled (the default), a client calls the
# ``call_tool`` proxy, which calls the target tool through
# ``FastMCP.call_tool()`` — and that runs the middleware chain again. Both
# passes are the same call holding the same connection, so only the outer one
# takes a slot. Taking one per pass would have every call hold a slot while
# waiting for a second, which deadlocks the moment the limit is reached.
_admitted: ContextVar[bool] = ContextVar("mcp_tool_call_admitted", default=False)


def max_concurrent_tool_calls() -> int:
    """How many async tool calls may run at once. 0 means unbounded."""
    from superset.mcp_service.flask_singleton import get_flask_app  # noqa: PLC0415

    config = get_flask_app().config
    if (configured := config.get("MCP_MAX_CONCURRENT_TOOL_CALLS")) is not None:
        return max(0, int(configured))

    engine_options = config.get("SQLALCHEMY_ENGINE_OPTIONS") or {}
    return int(
        engine_options.get("pool_size", _DEFAULT_POOL_SIZE)
        + engine_options.get("max_overflow", _DEFAULT_MAX_OVERFLOW)
    )


def _limiter() -> Optional[asyncio.Semaphore]:
    """The running loop's semaphore, created on first use. None if unbounded."""
    loop = asyncio.get_running_loop()
    if (limiter := _limiters.get(loop)) is not None:
        return limiter

    limit = max_concurrent_tool_calls()
    if limit <= 0:
        return None

    limiter = asyncio.Semaphore(limit)
    _limiters[loop] = limiter
    logger.info("MCP async tool calls limited to %d concurrent", limit)
    return limiter


@asynccontextmanager
async def bounded_tool_call() -> AsyncGenerator[None, None]:
    """Admit one async tool call, waiting on the loop rather than on the pool.

    Re-entrant: a nested pass for the same call (the ``call_tool`` search
    proxy invoking its target) runs inside the slot the outer pass took.
    """
    if _admitted.get() or (limiter := _limiter()) is None:
        yield
        return

    token = _admitted.set(True)
    try:
        async with limiter:
            yield
    finally:
        _admitted.reset(token)
