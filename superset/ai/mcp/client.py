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
Talking to an external MCP server, behind an optional extra.

Two rules shape this module, borrowed from the model providers. The ``mcp`` SDK
is imported inside the functions that need it, never at module scope, so a
deployment without the extra installed still starts every Superset process. And
every endpoint and credential arrives through configuration: nothing here has a
default URL or a default header, because a value baked into this file is a value
a deployment cannot change without forking.

Two further decisions are worth stating.

*The surface is synchronous.* Tools run inside a thread that already has a
running event loop, so a coroutine cannot simply be awaited or handed to
``asyncio.run``. Each call therefore runs on its own short-lived thread with its
own loop, joined with a bounded wait so a hung transport cannot pin the worker
serving the turn.

*A session lasts one operation.* Listing tools opens a connection and closes it;
so does calling one. Holding a session open across a turn would mean sharing
mutable transport state between requests and, in worker mode, across process
boundaries. The cost is a connect per operation, which is small beside the model
round trip that prompted it.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from collections.abc import AsyncIterator, Callable, Coroutine
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, cast, TypeVar

from superset.ai.mcp.config import (
    MCPServerConfig,
    TRANSPORT_SSE,
    TRANSPORT_STREAMABLE_HTTP,
)

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

#: Extra wait on top of a server's own timeout before the calling thread gives
#: up on the worker thread. Covers the cancellation and connection teardown that
#: follow an expired timeout; past this the thread is abandoned rather than
#: waited on, because a transport that will not unwind must not take a web
#: worker with it.
_JOIN_GRACE_SECONDS = 5.0

#: Placeholder for a content block that is not text. An image or an audio blob
#: is of no use to a text tool result and would spend the whole response budget
#: on base64, so the block's existence is reported and its bytes are not.
_NON_TEXT_BLOCK = "[non-text content block of type {kind!r} omitted]"


class MCPClientError(Exception):
    """
    A call to an external server did not produce a result.

    Callers turn this into an error tool result or drop the server from
    discovery. It is never raised into the runtime, because an unreachable
    third-party server is a normal operating condition, not a failed turn.
    """


class MCPNotInstalledError(MCPClientError):
    """The ``mcp`` SDK is required by configuration but is not installed."""


class MCPTimeoutError(MCPClientError):
    """A server did not answer within its configured timeout."""


@dataclass(frozen=True)
class RemoteTool:
    """
    One tool a server says it offers.

    Everything here is server-supplied and therefore untrusted:
    :mod:`superset.ai.mcp.tools` decides what is safe to show the model.
    """

    name: str
    description: str = ""
    input_schema: dict[str, Any] = field(default_factory=dict)


def list_tools(server: MCPServerConfig) -> list[RemoteTool]:
    """
    Ask a server what it offers.

    Raises :class:`MCPClientError` for anything that goes wrong, including a
    missing SDK. Discovery is best-effort at the layer above: a server that
    cannot be reached contributes no tools and the agent keeps its built-ins.
    """
    return _run_sync(lambda: _alist_tools(server), server.timeout_seconds)


def call_tool(
    server: MCPServerConfig,
    tool_name: str,
    arguments: dict[str, Any] | None = None,
    max_bytes: int | None = None,
) -> list[str]:
    """
    Invoke one remote tool and return its content blocks as text.

    ``max_bytes`` bounds what is accumulated in memory. The registry bounds the
    result again on the way to the model, but that happens after the bytes have
    already been read, so a server answering with a gigabyte would exhaust the
    worker before the registry ever saw it.
    """
    return _run_sync(
        lambda: _acall_tool(server, tool_name, arguments or {}, max_bytes),
        server.timeout_seconds,
    )


def transport_options(server: MCPServerConfig) -> dict[str, Any]:
    """
    The keyword arguments handed to the SDK's transport factory.

    Split out from the call path so that what goes on the wire is assertable in
    a test without a socket. Note what is absent: Superset's session cookie, its
    CSRF token and any authentication header of its own. The only headers are the
    ones configured for this server, copied so that neither the SDK nor a caller
    can mutate the configuration.
    """
    return {
        "url": server.url,
        "headers": dict(server.headers),
        "timeout": server.timeout_seconds,
    }


@dataclass(frozen=True)
class _ClientSDK:
    """The handful of SDK entry points this module uses."""

    client_session: Any
    transports: dict[str, Any]


def _sdk() -> _ClientSDK:
    """
    Import the SDK on demand.

    At module scope this would stop every Superset process — web, worker and
    CLI alike — from starting unless the extra were installed, which is the
    opposite of optional.
    """
    try:
        from mcp import ClientSession
        from mcp.client.sse import sse_client
        from mcp.client.streamable_http import streamablehttp_client
    except ModuleNotFoundError as ex:
        raise MCPNotInstalledError(
            "Connecting to an external MCP server requires the 'mcp' package, "
            "which is not installed. Run `pip install mcp`, or remove the "
            "server from AI_AGENT_MCP_SERVERS."
        ) from ex
    return _ClientSDK(
        client_session=ClientSession,
        transports={
            TRANSPORT_STREAMABLE_HTTP: streamablehttp_client,
            TRANSPORT_SSE: sse_client,
        },
    )


@asynccontextmanager
async def _session(server: MCPServerConfig) -> AsyncIterator[Any]:
    """Open an initialised session, and close it on the way out."""
    sdk = _sdk()
    transport = sdk.transports.get(server.transport)
    if transport is None:
        # Unreachable through validated configuration; guarded so that adding a
        # transport name to the config vocabulary without wiring it here fails
        # loudly rather than connecting to the wrong thing.
        raise MCPClientError(
            f"MCP server {server.name!r} names transport {server.transport!r}, "
            f"which this client cannot open."
        )

    async with transport(**transport_options(server)) as streams:
        # Both transports yield (read, write) first and may append their own
        # extras, so the pair is taken positionally rather than unpacked.
        read_stream, write_stream = streams[0], streams[1]
        async with sdk.client_session(
            read_stream,
            write_stream,
            read_timeout_seconds=timedelta(seconds=server.timeout_seconds),
        ) as session:
            await session.initialize()
            yield session


async def _alist_tools(server: MCPServerConfig) -> list[RemoteTool]:
    async with _session(server) as session:
        listing = await session.list_tools()
    return [_remote_tool(raw) for raw in getattr(listing, "tools", None) or []]


async def _acall_tool(
    server: MCPServerConfig,
    tool_name: str,
    arguments: dict[str, Any],
    max_bytes: int | None,
) -> list[str]:
    async with _session(server) as session:
        result = await session.call_tool(tool_name, arguments or None)

    if getattr(result, "isError", False):
        # The server's own error text is not repeated: it is attacker-controlled
        # prose that would reach the model outside the untrusted-content wrapper
        # the successful path applies.
        raise MCPClientError(
            f"MCP server {server.name!r} reported an error running {tool_name!r}."
        )
    return _text_blocks(getattr(result, "content", None) or [], max_bytes)


def _remote_tool(raw: Any) -> RemoteTool:
    """
    Read one advertised tool off whatever the SDK handed back.

    Attribute reads rather than a typed model, so a server sending a field the
    SDK models differently degrades to a missing description instead of an
    exception during discovery.
    """
    schema = getattr(raw, "inputSchema", None)
    return RemoteTool(
        name=str(getattr(raw, "name", "") or ""),
        description=str(getattr(raw, "description", "") or ""),
        input_schema=schema if isinstance(schema, dict) else {},
    )


def _text_blocks(blocks: Any, max_bytes: int | None) -> list[str]:
    """
    Flatten a tool result into text, stopping at ``max_bytes``.

    A block that is not text is reported by type rather than decoded: its bytes
    would consume the response budget without telling the model anything.
    """
    texts: list[str] = []
    budget = max_bytes if max_bytes and max_bytes > 0 else None
    used = 0
    for block in blocks:
        text = getattr(block, "text", None)
        if not isinstance(text, str):
            kind = str(getattr(block, "type", None) or type(block).__name__)
            text = _NON_TEXT_BLOCK.format(kind=kind)
        if budget is not None:
            remaining = budget - used
            if remaining <= 0:
                logger.info("Stopped reading MCP content at the %d byte bound", budget)
                break
            encoded = text.encode("utf-8")
            if len(encoded) > remaining:
                text = encoded[:remaining].decode("utf-8", "ignore")
            used += len(text.encode("utf-8"))
        texts.append(text)
    return texts


def _run_sync(
    factory: Callable[[], Coroutine[Any, Any, _T]],
    timeout: float,
) -> _T:
    """
    Run one coroutine to completion from synchronous, already-async-hosted code.

    ``factory`` rather than a coroutine so the coroutine is created on the thread
    that will run it. The thread is a daemon and is joined with a bounded wait:
    if the transport has not unwound by then it is abandoned, because the
    alternative is a web worker held open by a third party's socket.
    """
    outcome: dict[str, Any] = {}

    def target() -> None:
        try:
            outcome["value"] = asyncio.run(_awaited(factory(), timeout))
        except BaseException as ex:  # pylint: disable=broad-except # noqa: BLE001
            # Carried back to the calling thread rather than handled: the caller
            # is the one that knows whether this failure means "no tools" or
            # "error result".
            outcome["error"] = ex

    thread = threading.Thread(target=target, name="superset-ai-mcp", daemon=True)
    thread.start()
    thread.join(timeout + _JOIN_GRACE_SECONDS)

    if thread.is_alive():
        raise MCPTimeoutError(
            f"An external MCP server did not answer within {timeout:g}s."
        )
    if "error" in outcome:
        error = outcome["error"]
        if isinstance(error, MCPClientError):
            raise error
        if not isinstance(error, Exception):
            # A KeyboardInterrupt or a SystemExit is about the process, not about
            # this server. Translating it into "the call failed" would let a
            # shutdown look like a third party being unreachable.
            raise error
        # The detail goes to the log. The message a caller may show the model
        # says only that the call failed, because SDK exception text can quote a
        # URL, a header value or the server's own prose.
        logger.warning(
            "An external MCP call failed: %s: %s", type(error).__name__, error
        )
        raise MCPClientError("The external MCP server call failed.") from error
    return cast("_T", outcome["value"])


async def _awaited(coro: Coroutine[Any, Any, _T], timeout: float) -> _T:
    """Await ``coro`` under a timeout, in the vocabulary of this module."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except (asyncio.TimeoutError, TimeoutError) as ex:
        raise MCPTimeoutError(
            f"An external MCP server did not answer within {timeout:g}s."
        ) from ex
