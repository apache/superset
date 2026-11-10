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
"""The fail-closed backstop covers MCP, not only Flask requests (D2).

``CHANGE_MANAGEMENT`` on with no review gate installed is the state the
backstop exists for. The Flask hook answers it with a 503 on REST, but it is
a ``before_request`` hook and an MCP tool call never enters Flask's request
dispatch: FastMCP runs it under an app context alone, and under stdio there
is no HTTP at all. So in that state every MCP write went through live, with
no change request and no sign to the author, while the module's docstring
said MCP was covered.

These tests drive a real FastMCP server through the middleware list the
server really builds, rather than the middleware on its own, because the
claim being repaired is about the dispatch path.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError
from mcp.types import ToolAnnotations

from superset import change_management
from superset.mcp_service.middleware import (
    ChangeManagementBackstopMiddleware,
    GlobalErrorHandlerMiddleware,
    LoggingMiddleware,
)
from superset.mcp_service.server import build_middleware_list

pytestmark = pytest.mark.usefixtures("app")


@pytest.fixture
def review_promised(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(change_management, "_feature_on", lambda: True)
    monkeypatch.setattr(change_management, "_gate", None)


@pytest.fixture
def server() -> tuple[FastMCP, list[str]]:
    """A server with one tool of each kind, recording what actually ran."""
    ran: list[str] = []
    mcp = FastMCP("backstop", middleware=build_middleware_list())

    def record(name: str) -> Callable[[], str]:
        def tool() -> str:
            ran.append(name)
            return f"{name} ran"

        tool.__name__ = name
        return tool

    mcp.tool(
        record("read_chart"),
        annotations=ToolAnnotations(readOnlyHint=True),
    )
    mcp.tool(
        record("update_chart"),
        annotations=ToolAnnotations(readOnlyHint=False),
    )
    # No annotations at all: nothing says it only reads.
    mcp.tool(record("unannotated_tool"))
    return mcp, ran


async def _call(mcp: FastMCP, name: str) -> str:
    async with Client(mcp) as client:
        result = await client.call_tool(name, {})
    return result.content[0].text  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_a_write_is_refused_when_nothing_enforces_review(
    server: tuple[FastMCP, list[str]], review_promised: None
) -> None:
    mcp, ran = server

    with pytest.raises(ToolError, match="CHANGE_MANAGEMENT_UNENFORCED"):
        await _call(mcp, "update_chart")

    assert ran == [], "the write ran anyway"


@pytest.mark.asyncio
async def test_the_refusal_says_what_the_rest_api_says(
    server: tuple[FastMCP, list[str]], review_promised: None
) -> None:
    """One predicate and one message, so the two doors cannot disagree."""
    mcp, _ = server
    wanted = change_management.unenforced_message()["errors"][0]["message"]

    with pytest.raises(ToolError) as refused:
        await _call(mcp, "update_chart")

    assert wanted in str(refused.value)


@pytest.mark.asyncio
async def test_a_tool_that_does_not_say_it_only_reads_is_refused(
    server: tuple[FastMCP, list[str]], review_promised: None
) -> None:
    """The Flask hook lets three methods by and refuses the rest."""
    mcp, ran = server

    with pytest.raises(ToolError, match="CHANGE_MANAGEMENT_UNENFORCED"):
        await _call(mcp, "unannotated_tool")

    assert ran == []


@pytest.mark.asyncio
async def test_a_read_still_works_while_the_gate_is_missing(
    server: tuple[FastMCP, list[str]], review_promised: None
) -> None:
    """A viewer must keep seeing the live version of what is already there."""
    mcp, ran = server

    assert await _call(mcp, "read_chart") == "read_chart ran"
    assert ran == ["read_chart"]


@pytest.mark.asyncio
async def test_a_write_passes_once_a_gate_has_registered(
    server: tuple[FastMCP, list[str]], review_promised: None
) -> None:
    mcp, ran = server
    change_management.register_write_gate("test.gate")

    assert await _call(mcp, "update_chart") == "update_chart ran"
    assert ran == ["update_chart"]


@pytest.mark.asyncio
async def test_a_write_passes_with_the_feature_off(
    server: tuple[FastMCP, list[str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Nothing was promised, so nothing is withheld."""
    monkeypatch.setattr(change_management, "_feature_on", lambda: False)
    monkeypatch.setattr(change_management, "_gate", None)
    mcp, ran = server

    assert await _call(mcp, "update_chart") == "update_chart ran"
    assert ran == ["update_chart"]


@pytest.mark.asyncio
async def test_a_tool_that_cannot_be_resolved_is_treated_as_a_write(
    review_promised: None,
) -> None:
    """If the registry cannot say what a tool does, assume the worst."""

    class _Fastmcp:
        async def get_tool(self, name: str) -> None:
            raise RuntimeError("registry unavailable")

    class _Context:
        fastmcp_context = type("C", (), {"fastmcp": _Fastmcp()})()

    refusal = await ChangeManagementBackstopMiddleware._refusal(  # noqa: SLF001
        _Context(),  # type: ignore[arg-type]
        "anything",
    )

    assert refusal is not None
    assert refusal["errors"][0]["error_type"] == "CHANGE_MANAGEMENT_UNENFORCED"


def test_the_server_builds_the_backstop_into_its_middleware() -> None:
    """The check lives in the list every transport is started with.

    Inside logging, so a refusal is logged and counted; outside the error
    handler, so it reaches the caller as written rather than as "Internal
    error".
    """
    kinds = [type(middleware) for middleware in build_middleware_list()]

    backstop = kinds.index(ChangeManagementBackstopMiddleware)
    assert kinds.index(LoggingMiddleware) < backstop
    assert backstop < kinds.index(GlobalErrorHandlerMiddleware)
