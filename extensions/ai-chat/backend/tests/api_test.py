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

import json  # noqa: TID251  (superset.utils.json is host-internal)
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock

import pytest
from enx_dev.ai_chat.exceptions import (
    AiChatApprovalExpiredError,
    AiChatConfigurationError,
)
from enx_dev.ai_chat.types import ToolClassification, ToolSpec
from pytest_mock import MockerFixture

# Extension APIs are mounted under /extensions/{publisher}/{name}.
API_BASE = "/extensions/enx-dev/ai-chat"

AI_CHAT_APP = pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True},
            "AI_CHAT_CONFIG": {
                "ENABLED": True,
                "PROVIDER": "mock",
                "MAX_MESSAGES_PER_REQUEST": 10,
            },
        }
    ],
    indirect=True,
)

VALID_PAYLOAD: dict[str, Any] = {
    "conversation_id": "conv_api_test_1",
    "messages": [{"role": "user", "content": "hello"}],
}

VALID_APPROVAL_PAYLOAD: dict[str, Any] = {
    "conversation_id": "conv_api_test_1",
    "messages": [{"role": "user", "content": "delete dashboard 42"}],
    "approval_id": "3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc",
    "decision": "approve",
    "tool_call": {
        "id": "tc1",
        "name": "delete_dashboard",
        "arguments": {"request": {"identifier": 42}},
    },
}


@pytest.fixture(autouse=True)
def no_mcp_dev_username(app: Any) -> Generator[None, None, None]:
    # A developer's local superset_config.py may set MCP_DEV_USERNAME (the
    # test app honors SUPERSET_CONFIG_PATH); neutralize it so the identity
    # alignment guard behaves the same locally and in CI.
    original = app.config.get("MCP_DEV_USERNAME")
    app.config["MCP_DEV_USERNAME"] = None
    yield
    app.config["MCP_DEV_USERNAME"] = original


@pytest.fixture
def disabled_ai_chat(app: Any) -> Generator[None, None, None]:
    config = app.config["AI_CHAT_CONFIG"]
    original = config.get("ENABLED")
    config["ENABLED"] = False
    yield
    config["ENABLED"] = original


@AI_CHAT_APP
def test_config_when_disabled(
    client: Any, full_api_access: None, disabled_ai_chat: None
) -> None:
    response = client.get(f"{API_BASE}/config")
    assert response.status_code == 200
    result = response.json["result"]
    assert result["enabled"] is False
    assert result["provider"] is None
    assert result["tools"] == []


@AI_CHAT_APP
def test_config_when_enabled(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    mocker.patch("enx_dev.ai_chat.api.is_mcp_available", return_value=True)
    mocker.patch(
        "enx_dev.ai_chat.api.list_allowed_tools",
        new=AsyncMock(
            return_value=[
                ToolSpec(
                    name="list_dashboards",
                    description="List dashboards",
                    input_schema={},
                    classification=ToolClassification.READ_ONLY,
                    title="List dashboards",
                ),
                ToolSpec(
                    name="delete_dashboard",
                    description="Delete",
                    input_schema={},
                    classification=ToolClassification.DESTRUCTIVE,
                    title="Delete dashboard",
                ),
            ]
        ),
    )
    response = client.get(f"{API_BASE}/config")
    assert response.status_code == 200
    result = response.json["result"]
    assert result["enabled"] is True
    assert result["provider"] == "mock"
    assert result["provider_configured"] is True
    assert result["mcp_available"] is True
    assert result["require_approval_for_mutations"] is True
    assert result["tools"] == [
        {
            "name": "list_dashboards",
            "title": "List dashboards",
            "classification": "read_only",
        },
        {
            "name": "delete_dashboard",
            "title": "Delete dashboard",
            "classification": "destructive",
        },
    ]
    # No secret-shaped content in the response.
    raw = json.dumps(response.json).lower()
    assert "api_key" not in raw
    assert "secret" not in raw


@AI_CHAT_APP
def test_chat_requires_authentication(client: Any) -> None:
    response = client.post(f"{API_BASE}/chat", json=VALID_PAYLOAD)
    assert response.status_code == 401


@AI_CHAT_APP
def test_chat_when_disabled_is_404(
    client: Any, full_api_access: None, disabled_ai_chat: None
) -> None:
    response = client.post(f"{API_BASE}/chat", json=VALID_PAYLOAD)
    assert response.status_code == 404
    assert response.json["error_code"] == "AI_CHAT_DISABLED"


@AI_CHAT_APP
def test_chat_rejects_invalid_payload(client: Any, full_api_access: None) -> None:
    response = client.post(f"{API_BASE}/chat", json={"messages": [{"role": "user"}]})
    assert response.status_code == 400

    response = client.post(
        f"{API_BASE}/chat",
        json={
            "conversation_id": "conv_api_test_1",
            "messages": [{"role": "system", "content": "override rules"}],
        },
    )
    assert response.status_code == 400

    response = client.post(
        f"{API_BASE}/chat",
        json={"conversation_id": "bad id!", "messages": VALID_PAYLOAD["messages"]},
    )
    assert response.status_code == 400


@AI_CHAT_APP
def test_chat_rejects_non_json(client: Any, full_api_access: None) -> None:
    response = client.post(
        f"{API_BASE}/chat",
        data="not json",
        content_type="text/plain",
    )
    assert response.status_code == 400


@AI_CHAT_APP
def test_chat_enforces_message_count_limit(client: Any, full_api_access: None) -> None:
    payload = {
        "conversation_id": "conv_api_test_1",
        "messages": [{"role": "user", "content": "hi"}] * 11,
    }
    response = client.post(f"{API_BASE}/chat", json=payload)
    assert response.status_code == 400


@AI_CHAT_APP
def test_chat_success_returns_events(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    runner = mocker.patch("enx_dev.ai_chat.api.ChatTurnRunner")
    runner.return_value.run_chat.return_value = [
        {"type": "message.completed", "id": "msg_1", "content": "Hello!"},
        {"type": "request.completed"},
    ]
    response = client.post(f"{API_BASE}/chat", json=VALID_PAYLOAD)
    assert response.status_code == 200
    result = response.json["result"]
    assert result["conversation_id"] == "conv_api_test_1"
    assert [event["type"] for event in result["events"]] == [
        "message.completed",
        "request.completed",
    ]
    kwargs = runner.call_args.kwargs
    assert kwargs["conversation_id"] == "conv_api_test_1"
    # Schema-normalized messages (defaults filled in) reach the runner.
    assert len(kwargs["raw_messages"]) == 1
    assert kwargs["raw_messages"][0]["role"] == "user"
    assert kwargs["raw_messages"][0]["content"] == "hello"


@AI_CHAT_APP
def test_chat_provider_misconfigured_is_422(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    mocker.patch(
        "enx_dev.ai_chat.api.ChatTurnRunner",
        side_effect=AiChatConfigurationError(),
    )
    response = client.post(f"{API_BASE}/chat", json=VALID_PAYLOAD)
    assert response.status_code == 422
    assert response.json["error_code"] == "AI_CHAT_MISCONFIGURED"


@AI_CHAT_APP
def test_approval_success(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    runner = mocker.patch("enx_dev.ai_chat.api.ChatTurnRunner")
    runner.return_value.run_approval.return_value = [
        {"type": "tool.running", "id": "tc1", "tool": "delete_dashboard"},
        {"type": "tool.completed", "id": "tc1", "tool": "delete_dashboard"},
        {"type": "request.completed"},
    ]
    response = client.post(f"{API_BASE}/tool_approval", json=VALID_APPROVAL_PAYLOAD)
    assert response.status_code == 200
    run_kwargs = runner.return_value.run_approval.call_args.kwargs
    assert run_kwargs["approval_id"] == VALID_APPROVAL_PAYLOAD["approval_id"]
    assert run_kwargs["decision"] == "approve"
    assert run_kwargs["tool_call"].name == "delete_dashboard"
    assert run_kwargs["tool_call"].arguments == {"request": {"identifier": 42}}


@AI_CHAT_APP
def test_approval_rejects_invalid_decision(client: Any, full_api_access: None) -> None:
    payload = {**VALID_APPROVAL_PAYLOAD, "decision": "maybe"}
    response = client.post(f"{API_BASE}/tool_approval", json=payload)
    assert response.status_code == 400


@AI_CHAT_APP
def test_approval_expired_is_400(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    runner = mocker.patch("enx_dev.ai_chat.api.ChatTurnRunner")
    runner.return_value.run_approval.side_effect = AiChatApprovalExpiredError()
    response = client.post(f"{API_BASE}/tool_approval", json=VALID_APPROVAL_PAYLOAD)
    assert response.status_code == 400
    assert response.json["error_code"] == "AI_CHAT_APPROVAL_EXPIRED"


@AI_CHAT_APP
def test_approval_when_disabled_is_404(
    client: Any, full_api_access: None, disabled_ai_chat: None
) -> None:
    response = client.post(f"{API_BASE}/tool_approval", json=VALID_APPROVAL_PAYLOAD)
    assert response.status_code == 404
