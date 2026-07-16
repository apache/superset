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
"""End-to-end smoke test for the real MCP ASGI/HTTP stack.

Every other test under ``tests/unit_tests/mcp_service/`` drives tools via
FastMCP's in-process ``Client(mcp)``, which talks to the bare ``FastMCP``
object through an in-memory transport (``FastMCPTransport``). That path
never serializes a JSON-RPC message over HTTP and never runs through the
Starlette ASGI app that ``superset.mcp_service.server.run_server()`` builds
via ``mcp_instance.http_app(...)`` -- so the FastMCP-level middleware stack
(``LoggingMiddleware``, ``GlobalErrorHandlerMiddleware``,
``StructuredContentStripperMiddleware``, etc., see
``build_middleware_list()`` in ``server.py``) is never actually exercised in
CI.

This module closes that gap with a single smoke test file that:

1. Builds the *real* ASGI app the way ``run_server()`` does --
   ``mcp.http_app(transport="streamable-http", stateless_http=True)`` --
   with the production FastMCP-level middleware list attached.
2. Serves it in-process over real MCP streamable-HTTP JSON-RPC using
   ``httpx.ASGITransport`` (no real TCP socket, no real network).
3. Drives it with FastMCP's own high-level ``Client``, proving the full
   request/response wire protocol (headers, session negotiation, JSON-RPC
   envelopes) round-trips correctly through the real transport.

Deliberately out of scope: the Starlette-level ``BrowserHelloMiddleware``
(added via ``_build_starlette_middleware()`` in ``server.py``) only
intercepts ``GET``/``HEAD`` requests carrying a browser ``Accept`` header
(see ``BrowserHelloMiddleware.dispatch`` in ``jwt_verifier.py``); it never
touches the ``POST /mcp`` JSON-RPC path this test exercises, and wiring it
up would require standing up real auth/config machinery for no additional
coverage here.

Global state note: the FastMCP middleware list lives on the *shared*
``superset.mcp_service.app.mcp`` singleton that every other test file also
imports (``mcp.middleware`` is a plain list mutated in place by
``add_middleware()``). The ``_real_asgi_client`` helper below snapshots and
restores that list so this file cannot leak middleware into other tests.
"""

import contextlib
from collections.abc import AsyncIterator, Iterator, Mapping
from typing import Any
from unittest.mock import Mock, patch

import anyio
import httpx
import pytest
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from starlette.applications import Starlette

from superset.mcp_service.app import mcp
from superset.mcp_service.server import build_middleware_list
from superset.utils import json

ASGIMessage = Mapping[str, Any]


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Make authentication deterministic for list and call requests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@contextlib.asynccontextmanager
async def _run_asgi_lifespan(app: Starlette) -> AsyncIterator[None]:
    """Manually drive the ASGI lifespan protocol for ``app``.

    FastMCP's streamable-HTTP app only creates its
    ``StreamableHTTPSessionManager`` (and starts its task group) inside the
    app's ``lifespan`` context manager -- see ``create_streamable_http_app``
    in ``fastmcp.server.http``. ``httpx.ASGITransport`` drives the ASGI
    ``http`` scope but never sends ``lifespan`` events, so without this
    helper every request would fail because the session manager was never
    started. This is the same protocol libraries like ``asgi-lifespan``
    implement; it's inlined here to avoid a new test-only dependency.
    """
    send_stream, receive_stream = anyio.create_memory_object_stream[ASGIMessage](4)
    startup_complete = anyio.Event()
    shutdown_complete = anyio.Event()
    startup_failure: list[str] = []
    shutdown_failure: list[str] = []

    async def receive() -> ASGIMessage:
        return await receive_stream.receive()

    async def send(message: ASGIMessage) -> None:
        if message["type"] == "lifespan.startup.complete":
            startup_complete.set()
        elif message["type"] == "lifespan.startup.failed":
            startup_failure.append(message.get("message", "startup failed"))
            startup_complete.set()
        elif message["type"] == "lifespan.shutdown.complete":
            shutdown_complete.set()
        elif message["type"] == "lifespan.shutdown.failed":
            shutdown_failure.append(message.get("message", "shutdown failed"))
            shutdown_complete.set()

    async with anyio.create_task_group() as task_group:
        task_group.start_soon(
            app, {"type": "lifespan", "asgi": {"version": "3.0"}}, receive, send
        )
        await send_stream.send({"type": "lifespan.startup"})
        await startup_complete.wait()
        if startup_failure:
            raise RuntimeError(f"ASGI app failed to start: {startup_failure[0]}")
        try:
            yield
        finally:
            await send_stream.send({"type": "lifespan.shutdown"})
            await shutdown_complete.wait()
            if shutdown_failure:
                raise RuntimeError(
                    f"ASGI app failed to shut down: {shutdown_failure[0]}"
                )


@contextlib.asynccontextmanager
async def _real_asgi_client() -> AsyncIterator[Client]:
    """A FastMCP ``Client`` wired to the real ASGI app over real HTTP semantics.

    Builds the app the way ``run_server()`` does for the multi-pod/http_app
    path (``server.py:938``): FastMCP-level middleware from
    ``build_middleware_list()`` attached to the shared ``mcp`` instance, then
    ``mcp.http_app(transport="streamable-http", stateless_http=True)``.

    The request/response cycle is driven over ``httpx.ASGITransport`` (no
    real socket) using FastMCP's own ``StreamableHttpTransport`` so the
    client speaks genuine MCP streamable-HTTP JSON-RPC -- initialize
    handshake, session headers, and message envelopes -- rather than the
    in-process ``FastMCPTransport`` every other test in this package uses.

    Deliberately a plain ``@asynccontextmanager`` used directly by each test
    (``async with _real_asgi_client() as client:``) rather than a
    yield-based pytest fixture: the anyio task group started inside
    ``_run_asgi_lifespan`` enforces that its cancel scope is entered and
    exited from the *same* asyncio Task, and pytest-asyncio does not
    guarantee that a fixture's pre-yield and post-yield halves run in the
    same Task. Keeping setup and teardown inside the test function's own
    task sidesteps that entirely.
    """
    original_middleware = list(mcp.middleware)
    for middleware in build_middleware_list():
        mcp.add_middleware(middleware)

    try:
        asgi_app = mcp.http_app(transport="streamable-http", stateless_http=True)

        def httpx_client_factory(**kwargs: Any) -> httpx.AsyncClient:
            return httpx.AsyncClient(
                transport=httpx.ASGITransport(app=asgi_app),
                base_url="http://testserver",
                **kwargs,
            )

        transport = StreamableHttpTransport(
            "http://testserver/mcp", httpx_client_factory=httpx_client_factory
        )

        async with _run_asgi_lifespan(asgi_app):
            async with Client(transport) as client:
                yield client
    finally:
        # Restore the shared FastMCP singleton's middleware list in place
        # (not by reassignment) so this file cannot leak state into other
        # mcp_service tests, even if something else holds a reference to
        # the original list object.
        mcp.middleware[:] = original_middleware


@pytest.mark.asyncio
async def test_tools_list_over_real_asgi_transport() -> None:
    """``tools/list`` round-trips over the real ASGI app + JSON-RPC wire protocol.

    This alone proves the full stack boots: the Starlette app built by
    ``http_app()``, the FastMCP-level middleware chain (Logging,
    GlobalErrorHandler, StructuredContentStripper, RBAC visibility), the
    streamable-HTTP session manager, and real JSON-RPC (de)serialization --
    none of which the in-process ``Client(mcp)`` tests elsewhere in this
    package exercise.
    """
    async with _real_asgi_client() as client:
        tools = await client.list_tools()

    assert len(tools) > 0
    tool_names = {tool.name for tool in tools}
    assert "health_check" in tool_names


@pytest.mark.asyncio
async def test_tools_call_health_check_over_real_asgi_transport() -> None:
    """A real ``tools/call`` for ``health_check`` over the real ASGI transport.

    ``health_check`` is ``@tool(protect=True)`` by default (auth wraps every
    tool unless ``protect=False`` is explicit), so authentication is mocked
    the same way every other MCP tool test does it: patching
    ``get_user_from_request`` via the module-level autouse fixture. That function
    is called directly from ``_setup_user_context()`` regardless of how the
    request arrived (in-process client vs. real HTTP transport), so the same
    mock works unmodified here.
    """
    async with _real_asgi_client() as client:
        result = await client.call_tool("health_check", {})

    data = json.loads(result.content[0].text)
    assert data["status"] == "healthy"
    assert data["service"] == "Superset MCP Service"
