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
MCP service test configuration.

Disables RBAC permission checks for integration tests.
RBAC logic is tested directly in test_auth_rbac.py.
"""

import copy
from collections.abc import Iterator
from contextvars import Token
from dataclasses import dataclass
from typing import Any

import pytest
from fastmcp.server.middleware import dereference
from fastmcp.tools.base import Tool

from superset.mcp_service.auth import _mcp_user_id_var


@dataclass(frozen=True)
class _DereferencedTool:
    """One tool's dereferenced schemas and the inputs they were derived from."""

    parameters: dict[str, Any]
    output_schema: dict[str, Any] | None
    updates: dict[str, Any]


@pytest.fixture(scope="session")
def _dereferenced_tools() -> dict[str, _DereferencedTool]:
    """Per-worker cache shared by every MCP test module."""
    return {}


@pytest.fixture(scope="module", autouse=True)
def reuse_dereferenced_tool_schemas(
    _dereferenced_tools: dict[str, _DereferencedTool],
) -> Iterator[None]:
    """Dereference each tool's JSON schemas once instead of on every listing.

    Most MCP tests open a new ``Client(mcp)``, and the client's first
    ``call_tool`` lists the tools to learn their output schemas. fastmcp's
    ``DereferenceRefsMiddleware`` then inlines the ``$ref``s of every registered
    tool on each listing: about 0.3s per new client under coverage (0.4s on
    CI), paid by roughly 2,000 tests per suite run. The result depends only on
    the tool and its two schemas, so it is reused, keyed by tool name so the
    cache stays bounded, while the tool carries schemas equal to the ones it was
    derived from, and deep copies keep a test that mutates a listed schema from
    changing the cached one. Installed with ``raising=True`` so that a fastmcp
    release which renames the helper fails here instead of silently losing the
    cache.
    """
    dereference_tool = dereference._dereference_tool  # noqa: SLF001

    def cached_dereference_tool(tool: Tool) -> Tool:
        cached = _dereferenced_tools.get(tool.name)
        if (
            cached is None
            or cached.parameters != tool.parameters
            or cached.output_schema != tool.output_schema
        ):
            dereferenced = dereference_tool(tool)
            cached = _DereferencedTool(
                parameters=copy.deepcopy(tool.parameters),
                output_schema=copy.deepcopy(tool.output_schema),
                updates={
                    field: copy.deepcopy(getattr(dereferenced, field))
                    for field in ("parameters", "output_schema")
                    if getattr(dereferenced, field) is not getattr(tool, field)
                },
            )
            _dereferenced_tools[tool.name] = cached
            return dereferenced
        if not cached.updates:
            return tool
        return tool.model_copy(update=copy.deepcopy(cached.updates))

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(
            dereference, "_dereference_tool", cached_dereference_tool, raising=True
        )
        yield


@pytest.fixture(autouse=True)
def isolate_mcp_user_id_var() -> Iterator[None]:
    """Reset the ``_mcp_user_id_var`` ContextVar around every MCP test.

    ``_setup_user_context()`` sets the var and relies on ``on_call_tool``'s
    ``finally`` to clear it. Tests that call ``_setup_user_context()`` (or set
    the var) directly, without going through the middleware, leave it set in
    the thread's base context, and pytest-asyncio copies that context into
    every later async test's task -- so a resolved user id leaks into
    unrelated tests. In a serial run a middleware-exercising test file that
    sorts between the leaking file and its victim happened to clear the var;
    under pytest-xdist the files land on different workers and the leak
    surfaces as a flake. Scoping the var to each test removes the ordering
    dependence.
    """
    token: Token[int | None] = _mcp_user_id_var.set(None)
    try:
        yield
    finally:
        _mcp_user_id_var.reset(token)


@pytest.fixture(autouse=True)
def disable_mcp_rbac(app):
    """Disable RBAC permission checks for MCP integration tests.

    The RBAC permission logic is tested directly in test_auth_rbac.py.
    Integration tests use mock users that do not have real FAB roles,
    so we disable RBAC to let them exercise tool logic.
    """
    app.config["MCP_RBAC_ENABLED"] = False
    yield
    app.config.pop("MCP_RBAC_ENABLED", None)
