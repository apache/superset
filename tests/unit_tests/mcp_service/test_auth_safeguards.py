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
"""Tests for MCP tool auth safeguards (#39395).

The race-condition fix in #39385 only protects tools that go through
``mcp_auth_hook``. These tests pin the three structural safeguards that
enforce that invariant:

1. ``mcp_auth_hook`` stamps ``_mcp_auth_protected = True`` on the wrapper.
2. ``assert_all_tools_protected`` raises if any tool lacks the marker.
3. ``create_tool_decorator`` fails fast instead of returning the unwrapped
   function when registration errors.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest

from superset.mcp_service.app import assert_all_tools_protected
from superset.mcp_service.auth import mcp_auth_hook


def _fake_mcp_with_tools(tools_by_name: dict[str, Any]) -> SimpleNamespace:
    """Build a minimal FastMCP stand-in exposing ``local_provider._components``.

    FastMCP 3.x keys components as ``"<kind>:<name>@"`` — tools, prompts and
    resources all share the dict. ``assert_all_tools_protected`` filters to the
    ``tool:`` entries, so the fake mirrors that shape.
    """
    components = {f"tool:{name}@": tool for name, tool in tools_by_name.items()}
    return SimpleNamespace(
        local_provider=SimpleNamespace(_components=components),
    )


def test_mcp_auth_hook_stamps_protection_marker() -> None:
    """``mcp_auth_hook`` must mark its wrapper so the startup assertion can
    verify the tool went through it."""

    def sample_tool(request: dict[str, Any]) -> dict[str, Any]:
        """A tool that does nothing useful — only the wrapping matters."""
        return request

    wrapped = mcp_auth_hook(sample_tool)
    assert getattr(wrapped, "_mcp_auth_protected", False) is True


def test_assert_all_tools_protected_passes_when_every_tool_is_marked() -> None:
    """Happy path: every tool went through ``mcp_auth_hook`` — no raise."""

    def protected_fn() -> None:
        pass

    protected_fn._mcp_auth_protected = True  # type: ignore[attr-defined]
    mcp = _fake_mcp_with_tools(
        {
            "list_charts": SimpleNamespace(name="list_charts", fn=protected_fn),
            "get_chart_info": SimpleNamespace(name="get_chart_info", fn=protected_fn),
        }
    )

    # Should not raise.
    assert_all_tools_protected(mcp)


def test_assert_all_tools_protected_raises_on_unprotected_tool() -> None:
    """An unwrapped tool (the three bypass paths in #39395) must blow up at
    startup rather than silently serve unprotected traffic."""

    def unprotected_fn() -> None:
        pass  # no ``_mcp_auth_protected`` attribute

    mcp = _fake_mcp_with_tools(
        {"sneaky_tool": SimpleNamespace(name="sneaky_tool", fn=unprotected_fn)}
    )

    with pytest.raises(RuntimeError, match="sneaky_tool.*without mcp_auth_hook"):
        assert_all_tools_protected(mcp)


def test_assert_all_tools_protected_respects_allowlist() -> None:
    """Tools explicitly listed in ``ALLOWED_UNPROTECTED`` are skipped — the
    allowlist is the only legitimate path to a public tool."""

    def unprotected_fn() -> None:
        pass

    mcp = _fake_mcp_with_tools(
        {
            "public_health_probe": SimpleNamespace(
                name="public_health_probe", fn=unprotected_fn
            )
        }
    )

    # Replace the module-level set so the function under test sees a
    # deterministic allowlist regardless of which real tools exist.
    with patch(
        "superset.mcp_service.app.ALLOWED_UNPROTECTED",
        {"public_health_probe"},
    ):
        # Should not raise — the tool is allowlisted.
        assert_all_tools_protected(mcp)


def test_create_tool_decorator_fails_fast_on_registration_error() -> None:
    """When ``mcp_auth_hook`` raises during decoration the decorator must
    propagate the error instead of returning the unwrapped function — that
    silent-return path was the bug #39395 closes."""
    from superset.core.mcp.core_mcp_injection import create_tool_decorator

    def sample_tool() -> None:
        pass

    # Make Tool.from_function raise — simulates any registration-time failure
    # in the path after mcp_auth_hook returns. Previously this would log an
    # error and return ``func`` unwrapped; now it must re-raise.
    from typing import Callable

    decorator: Callable[..., Any] = create_tool_decorator()
    with patch("fastmcp.tools.Tool.from_function", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError, match="boom"):
            decorator(sample_tool)
