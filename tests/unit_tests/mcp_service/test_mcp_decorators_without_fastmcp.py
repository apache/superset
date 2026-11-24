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
"""MCP decorators in a process where ``fastmcp`` isn't installed."""

from collections.abc import Callable
from types import ModuleType
from typing import Any
from unittest.mock import patch

import pytest

from superset.core.mcp import core_mcp_injection


def double(value: int) -> int:
    """Doubles the input value."""
    return value * 2


@pytest.fixture
def decorators(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    """superset_core's decorators, put back as they were once the test ends."""
    import superset_core.mcp.decorators as module

    monkeypatch.setattr(module, "tool", module.tool)
    monkeypatch.setattr(module, "prompt", module.prompt)
    monkeypatch.setattr(module, "resource", module.resource)
    monkeypatch.setattr(module, "content_version", module.content_version)
    return module


@pytest.mark.parametrize(
    "apply",
    [
        lambda d: d.tool(double),
        lambda d: d.tool()(double),
        lambda d: d.tool("doubler", tags=["extension"])(double),
        lambda d: d.tool(name="doubler", class_permission_name="Chart")(double),
        lambda d: d.prompt(double),
        lambda d: d.prompt("doubler", title="Doubler")(double),
    ],
    ids=["tool", "tool()", "tool(name)", "tool(kwargs)", "prompt", "prompt(name)"],
)
def test_without_fastmcp_a_decorator_keeps_the_function(
    decorators: ModuleType, apply: Callable[[ModuleType], Any]
) -> None:
    with patch.object(core_mcp_injection, "_fastmcp_available", return_value=False):
        core_mcp_injection.initialize_core_mcp_decorators()

    assert apply(decorators) is double


def test_with_fastmcp_the_host_installs_its_own_decorators(
    decorators: ModuleType,
) -> None:
    with patch.object(core_mcp_injection, "_fastmcp_available", return_value=True):
        core_mcp_injection.initialize_core_mcp_decorators()

    assert decorators.tool is core_mcp_injection.create_tool_decorator
    assert decorators.prompt is core_mcp_injection.create_prompt_decorator


def viewer() -> str:
    """A View's page."""
    return "<html></html>"


def test_without_fastmcp_a_view_keeps_the_function_and_its_uri(
    decorators: ModuleType,
) -> None:
    with patch.object(core_mcp_injection, "_fastmcp_available", return_value=False):
        core_mcp_injection.initialize_core_mcp_decorators()

    version = decorators.content_version("<html></html>")
    kept = decorators.resource("viewer", version=version)(viewer)

    assert kept is viewer
    assert kept.uri == f"ui://superset/viewer/{version}"
    assert version.startswith("v1-")
