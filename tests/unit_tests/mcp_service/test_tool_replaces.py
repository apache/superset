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
"""Tests for the ``replaces`` parameter on the MCP ``@tool`` decorator.

``replaces`` lets an extension swap out a host tool while keeping the same
name visible to the LLM: the original tool is removed from the registry and
the decorated function is registered under the replaced name, bypassing the
usual extension-namespace prefixing.
"""

import logging
from typing import Any, Callable
from unittest.mock import MagicMock, patch

import pytest

from superset.core.mcp.core_mcp_injection import (
    _remove_tool_for_replacement,
    _resolve_tool_name,
    create_tool_decorator,
)
from superset.mcp_service.app import mcp as real_mcp

_CONTEXT_PATCH_TARGET = (
    "superset.core.mcp.core_mcp_injection.get_current_extension_context"
)


# ---------------------------------------------------------------------------
# _resolve_tool_name
# ---------------------------------------------------------------------------


def test_resolve_tool_name_without_replaces_uses_prefixed_id() -> None:
    """With no ``replaces``, the existing prefixing behavior is unchanged."""
    with patch(_CONTEXT_PATCH_TARGET, return_value=None):
        tool_name, context_type = _resolve_tool_name("my_tool", None)

    assert tool_name == "my_tool"
    assert context_type == "host"


def test_resolve_tool_name_with_replaces_bypasses_extension_prefix() -> None:
    """``replaces`` is used verbatim even inside an active extension context,
    so the decorated function overrides the host tool name rather than being
    registered under an extension-namespaced name."""
    mock_context = MagicMock()
    mock_context.manifest.publisher = "acme"
    mock_context.manifest.name = "analytics"

    with patch(_CONTEXT_PATCH_TARGET, return_value=mock_context):
        tool_name, context_type = _resolve_tool_name("my_tool", "get_instance_info")

    assert tool_name == "get_instance_info"
    assert context_type == "host"


# ---------------------------------------------------------------------------
# _remove_tool_for_replacement
# ---------------------------------------------------------------------------


def test_remove_tool_for_replacement_removes_existing_tool() -> None:
    """The named tool is removed from the registry via ``mcp.remove_tool``."""
    mock_mcp = MagicMock()

    _remove_tool_for_replacement(mock_mcp, "get_instance_info")

    mock_mcp.remove_tool.assert_called_once_with("get_instance_info")


# ---------------------------------------------------------------------------
# create_tool_decorator(replaces=...)
# ---------------------------------------------------------------------------


def _custom_instance_info() -> dict[str, Any]:
    """Custom replacement tool."""
    return {}


def _brand_new_tool() -> dict[str, Any]:
    """A normal, non-replacing tool."""
    return {}


def test_create_tool_decorator_with_replaces_removes_old_tool_first() -> None:
    """Decorating with ``replaces`` removes the original tool before the
    replacement is registered."""
    decorator: Callable[..., Any] = create_tool_decorator(replaces="get_instance_info")

    with (
        patch.object(real_mcp, "remove_tool") as mock_remove,
        patch.object(real_mcp, "add_tool") as mock_add,
    ):
        decorator(_custom_instance_info)

    mock_remove.assert_called_once_with("get_instance_info")
    mock_add.assert_called_once()


def test_create_tool_decorator_with_replaces_registers_under_replaced_name() -> None:
    """The new tool is registered under the ``replaces`` name, not the
    decorated function's own name."""
    decorator: Callable[..., Any] = create_tool_decorator(replaces="get_instance_info")

    with (
        patch.object(real_mcp, "remove_tool"),
        patch.object(real_mcp, "add_tool") as mock_add,
    ):
        decorator(_custom_instance_info)

    registered_tool = mock_add.call_args.args[0]
    assert registered_tool.name == "get_instance_info"


def test_create_tool_decorator_without_replaces_does_not_remove_anything() -> None:
    """Without ``replaces``, no removal call is made — only additive
    registration, matching pre-existing behavior."""
    decorator: Callable[..., Any] = create_tool_decorator()

    with (
        patch.object(real_mcp, "remove_tool") as mock_remove,
        patch.object(real_mcp, "add_tool"),
    ):
        decorator(_brand_new_tool)

    mock_remove.assert_not_called()


def test_create_tool_decorator_replaces_survives_missing_original_tool(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """If the tool being replaced was never registered, ``create_tool_decorator``
    still registers the replacement instead of failing the whole decoration."""
    decorator: Callable[..., Any] = create_tool_decorator(replaces="missing")

    with (
        patch.object(
            real_mcp, "remove_tool", side_effect=KeyError("missing")
        ) as mock_remove,
        patch.object(real_mcp, "add_tool") as mock_add,
        caplog.at_level(logging.WARNING, logger="superset.core.mcp.core_mcp_injection"),
    ):
        decorator(_custom_instance_info)

    mock_remove.assert_called_once_with("missing")
    mock_add.assert_called_once()
    assert "missing" in caplog.text
