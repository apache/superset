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
"""In-process bridge to the Superset MCP service.

Tool listing and invocation go through the in-memory FastMCP transport
(``fastmcp.Client(mcp)``), which exercises the full MCP middleware chain:
authentication hook, RBAC permission checks, per-user tool visibility
filtering, response size guards and error handling. The bridge adds gateway
policy on top: the ``ALLOWED_MCP_TOOLS`` allowlist, impact classification,
output truncation and identity alignment.

``fastmcp`` is an optional dependency shipped as a pip extra, so every import
is guarded and the gateway degrades to a chat-only assistant when the extra is
not installed.

This is the one place the extension reaches past ``apache-superset-core``
into the host: ``superset.mcp_service.app``. That package exposes decorators
for *contributing* MCP tools, not a client for *calling* the server the host
already runs, and standing up a second server would mean a second copy of the
middleware chain the bridge exists to go through. The imports are lazy and
already guarded by :func:`is_mcp_available`, so an incompatible host version
costs tool use rather than the whole assistant.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, TYPE_CHECKING

from enx_dev.ai_chat.exceptions import AiChatIdentityMismatchError
from enx_dev.ai_chat.settings import get_ai_chat_config
from enx_dev.ai_chat.tool_policy import classify_tool
from enx_dev.ai_chat.types import ToolExecution, ToolSpec
from flask import current_app

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

logger = logging.getLogger(__name__)

TRUNCATION_MARKER = "\n…[output truncated by the AI chat gateway]"


def is_mcp_available() -> bool:
    """Whether the MCP service and its dependencies are importable."""
    try:
        import fastmcp  # noqa: F401  pylint: disable=unused-import

        return True
    except ImportError:
        return False


def allowed_tool_names() -> frozenset[str]:
    """Operator allowlist. An empty set means the model gets no tools."""
    config = get_ai_chat_config()
    return frozenset(config.get("ALLOWED_MCP_TOOLS") or [])


def assert_identity_alignment(user: User) -> None:
    """Fail closed when MCP would resolve tools to a different principal.

    The MCP authentication chain checks ``MCP_DEV_USERNAME`` before falling
    back to ``g.user``. When that config names a user other than the
    authenticated web user, executing tools would impersonate the configured
    user, so the gateway refuses rather than proceeds.
    """
    dev_username = current_app.config.get("MCP_DEV_USERNAME")
    if dev_username and getattr(user, "username", None) != dev_username:
        logger.warning(
            "AI chat refused MCP execution: MCP_DEV_USERNAME is set and does "
            "not match the authenticated user"
        )
        raise AiChatIdentityMismatchError()


async def list_allowed_tools() -> list[ToolSpec]:
    """List tools visible to the current user, filtered by the allowlist.

    RBAC visibility filtering happens inside the MCP middleware under the
    current user's identity, and the gateway then intersects that with the
    operator's allowlist so the model never sees tools outside it.
    """
    allowed = allowed_tool_names()
    if not allowed or not is_mcp_available():
        return []

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    specs: list[ToolSpec] = []
    async with Client(mcp) as client:
        tools = await client.list_tools()
    for tool in tools:
        if tool.name not in allowed:
            continue
        annotations = None
        if tool.annotations is not None:
            annotations = (
                tool.annotations.model_dump()
                if hasattr(tool.annotations, "model_dump")
                else dict(tool.annotations)
            )
        specs.append(
            ToolSpec(
                name=tool.name,
                description=tool.description or "",
                input_schema=tool.inputSchema or {},
                classification=classify_tool(annotations),
                title=(annotations or {}).get("title"),
            )
        )
    specs.sort(key=lambda spec: spec.name)
    return specs


async def call_tool(name: str, arguments: dict[str, Any]) -> ToolExecution:
    """Invoke one MCP tool under the current user's authorization context.

    Callers own the allowlist and approval checks, while this function only
    executes and normalizes the result. Output is truncated to
    ``MAX_TOOL_OUTPUT_CHARS`` so unbounded tool responses cannot flood the
    model context or the browser.
    """
    config = get_ai_chat_config()
    max_chars = int(config.get("MAX_TOOL_OUTPUT_CHARS") or 50_000)
    timeout = int(config.get("REQUEST_TIMEOUT_SECONDS") or 120)

    from fastmcp import Client
    from fastmcp.exceptions import ToolError

    from superset.mcp_service.app import mcp

    try:
        async with Client(mcp) as client:
            result = await asyncio.wait_for(
                client.call_tool(name, arguments), timeout=timeout
            )
    except ToolError as ex:
        # The MCP error middleware produces ToolError messages, which are
        # already safe to show and carry no tracebacks.
        logger.info("AI chat tool %s failed: %s", name, ex)
        return ToolExecution(ok=False, error=str(ex))
    except asyncio.TimeoutError:
        logger.warning("AI chat tool %s timed out after %ss", name, timeout)
        return ToolExecution(ok=False, error=f"Tool timed out after {timeout}s.")
    except Exception:  # pylint: disable=broad-except
        # Never propagate internals or tracebacks to the model or browser
        logger.exception("AI chat tool %s raised unexpectedly", name)
        return ToolExecution(ok=False, error="Tool execution failed unexpectedly.")

    parts = [
        block.text
        for block in result.content or []
        if getattr(block, "type", None) == "text" and getattr(block, "text", None)
    ]
    content = "\n".join(parts)
    truncated = False
    if len(content) > max_chars:
        content = content[:max_chars] + TRUNCATION_MARKER
        truncated = True
    return ToolExecution(ok=True, content=content, truncated=truncated)
