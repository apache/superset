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
# pylint: disable=unused-argument
from __future__ import annotations

import asyncio
import sys
from collections.abc import Generator
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from enx_dev.ai_chat.exceptions import AiChatIdentityMismatchError
from enx_dev.ai_chat.mcp_bridge import (
    assert_identity_alignment,
    call_tool,
    list_allowed_tools,
    TRUNCATION_MARKER,
)
from enx_dev.ai_chat.types import ToolClassification
from flask.ctx import AppContext
from pytest_mock import MockerFixture


@pytest.fixture(autouse=True)
def controlled_config(app_context: AppContext) -> Generator[dict[str, Any], None, None]:
    from flask import current_app

    original_ai = current_app.config["AI_CHAT_CONFIG"]
    original_dev = current_app.config.get("MCP_DEV_USERNAME")
    current_app.config["AI_CHAT_CONFIG"] = {**original_ai}
    current_app.config["MCP_DEV_USERNAME"] = None
    yield current_app.config["AI_CHAT_CONFIG"]
    current_app.config["AI_CHAT_CONFIG"] = original_ai
    current_app.config["MCP_DEV_USERNAME"] = original_dev


@pytest.fixture
def fake_mcp_module(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid importing the real (heavy) MCP app inside bridge unit tests."""
    monkeypatch.setitem(
        sys.modules,
        "superset.mcp_service.app",
        SimpleNamespace(mcp=object()),
    )


class FakeClient:
    """Async-context-manager stand-in for fastmcp.Client."""

    list_tools_result: list[Any] = []
    call_tool_result: Any = None
    call_tool_error: Exception | None = None

    def __init__(self, _mcp: object) -> None:
        pass

    async def __aenter__(self) -> FakeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def list_tools(self) -> list[Any]:
        return type(self).list_tools_result

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        error = type(self).call_tool_error
        if error is not None:
            raise error
        return type(self).call_tool_result


def _fake_tool(
    name: str, read_only: bool | None, destructive: bool | None
) -> SimpleNamespace:
    annotations = None
    if read_only is not None or destructive is not None:
        annotations = MagicMock()
        annotations.model_dump.return_value = {
            "readOnlyHint": read_only,
            "destructiveHint": destructive,
            "title": name.replace("_", " ").title(),
        }
    return SimpleNamespace(
        name=name,
        description=f"{name} description",
        inputSchema={"type": "object"},
        annotations=annotations,
    )


def test_identity_alignment_without_dev_username(app_context: AppContext) -> None:
    user = MagicMock()
    user.username = "alice"
    assert_identity_alignment(user)  # must not raise


def test_identity_alignment_matching_dev_username(
    app_context: AppContext, controlled_config: dict[str, Any]
) -> None:
    from flask import current_app

    current_app.config["MCP_DEV_USERNAME"] = "alice"
    user = MagicMock()
    user.username = "alice"
    assert_identity_alignment(user)  # must not raise


def test_identity_alignment_mismatch_fails_closed(
    app_context: AppContext, controlled_config: dict[str, Any]
) -> None:
    from flask import current_app

    current_app.config["MCP_DEV_USERNAME"] = "admin"
    user = MagicMock()
    user.username = "alice"
    with pytest.raises(AiChatIdentityMismatchError):
        assert_identity_alignment(user)


def test_empty_allowlist_exposes_no_tools(
    app_context: AppContext, controlled_config: dict[str, Any]
) -> None:
    controlled_config["ALLOWED_MCP_TOOLS"] = []
    assert asyncio.run(list_allowed_tools()) == []


def test_list_tools_intersects_allowlist_and_classifies(
    app_context: AppContext,
    controlled_config: dict[str, Any],
    fake_mcp_module: None,
    mocker: MockerFixture,
) -> None:
    controlled_config["ALLOWED_MCP_TOOLS"] = [
        "list_dashboards",
        "delete_dashboard",
        "mystery_tool",
    ]
    FakeClient.list_tools_result = [
        _fake_tool("list_dashboards", read_only=True, destructive=False),
        _fake_tool("delete_dashboard", read_only=False, destructive=True),
        _fake_tool("generate_chart", read_only=False, destructive=False),
        _fake_tool("mystery_tool", read_only=None, destructive=None),
    ]
    mocker.patch("fastmcp.Client", FakeClient)

    specs = asyncio.run(list_allowed_tools())
    by_name = {spec.name: spec for spec in specs}
    # generate_chart is visible to the user but not allowlisted.
    assert set(by_name) == {"list_dashboards", "delete_dashboard", "mystery_tool"}
    assert by_name["list_dashboards"].classification == (ToolClassification.READ_ONLY)
    assert by_name["delete_dashboard"].classification == (
        ToolClassification.DESTRUCTIVE
    )
    # Unannotated tools default to the most cautious class.
    assert by_name["mystery_tool"].classification == ToolClassification.UNKNOWN


def test_call_tool_truncates_oversized_output(
    app_context: AppContext,
    controlled_config: dict[str, Any],
    fake_mcp_module: None,
    mocker: MockerFixture,
) -> None:
    controlled_config["MAX_TOOL_OUTPUT_CHARS"] = 100
    FakeClient.call_tool_error = None
    FakeClient.call_tool_result = SimpleNamespace(
        content=[SimpleNamespace(type="text", text="y" * 500)]
    )
    mocker.patch("fastmcp.Client", FakeClient)

    execution = asyncio.run(call_tool("list_dashboards", {}))
    assert execution.ok is True
    assert execution.truncated is True
    assert execution.content == "y" * 100 + TRUNCATION_MARKER


def test_call_tool_converts_tool_errors(
    app_context: AppContext,
    controlled_config: dict[str, Any],
    fake_mcp_module: None,
    mocker: MockerFixture,
) -> None:
    from fastmcp.exceptions import ToolError

    FakeClient.call_tool_error = ToolError("Permission denied for list_users")
    mocker.patch("fastmcp.Client", FakeClient)

    execution = asyncio.run(call_tool("list_users", {}))
    assert execution.ok is False
    assert execution.error is not None
    assert "Permission denied" in execution.error
    FakeClient.call_tool_error = None


def test_call_tool_sanitizes_unexpected_exceptions(
    app_context: AppContext,
    controlled_config: dict[str, Any],
    fake_mcp_module: None,
    mocker: MockerFixture,
) -> None:
    FakeClient.call_tool_error = RuntimeError(
        "secret traceback detail that must not leak"
    )
    mocker.patch("fastmcp.Client", FakeClient)

    execution = asyncio.run(call_tool("list_dashboards", {}))
    assert execution.ok is False
    assert execution.error is not None
    assert "secret" not in execution.error
    FakeClient.call_tool_error = None


def test_call_tool_timeout(
    app_context: AppContext,
    controlled_config: dict[str, Any],
    fake_mcp_module: None,
    mocker: MockerFixture,
) -> None:
    controlled_config["REQUEST_TIMEOUT_SECONDS"] = 1

    class SlowClient(FakeClient):
        async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
            await asyncio.sleep(5)

    mocker.patch("fastmcp.Client", SlowClient)
    execution = asyncio.run(call_tool("list_dashboards", {}))
    assert execution.ok is False
    assert execution.error is not None
    assert "timed out" in execution.error
