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
"""End-to-end contract tests: mock provider through the real MCP stack.

These tests exercise the full request path — REST API → orchestrator →
deterministic mock provider → in-memory FastMCP client → real MCP tool with
its middleware — with only the DAO layer and MCP authentication mocked. No
external AI API is ever called.
"""

from __future__ import annotations

from collections.abc import Generator, Iterator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from enx_dev.ai_chat.approvals import RESOURCE
from pytest_mock import MockerFixture
from superset_core.common import models as core_models


def _e2e_app(**ai_chat: Any) -> Any:
    return pytest.mark.parametrize(
        "app",
        [
            {
                "FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True},
                "AI_CHAT_CONFIG": {
                    "ENABLED": True,
                    "PROVIDER": "mock",
                    "ALLOWED_MCP_TOOLS": ["list_dashboards", "delete_dashboard"],
                    **ai_chat,
                },
                # Tool-level RBAC is covered by the MCP service's own suite;
                # the e2e flow here focuses on the gateway contract.
                "MCP_RBAC_ENABLED": False,
            }
        ],
        indirect=True,
    )


#: The approval flow needs a mode that gates something.
AI_CHAT_E2E_APP = _e2e_app(TOOL_APPROVAL_MODE="mutations_only")

#: Deliberately says nothing about approval, so what it exercises is the
#: default an operator gets by enabling the assistant and nothing else.
AI_CHAT_E2E_DEFAULT_APP = _e2e_app()


@pytest.fixture(autouse=True)
def no_mcp_dev_username(app: Any) -> Generator[None, None, None]:
    original = app.config.get("MCP_DEV_USERNAME")
    app.config["MCP_DEV_USERNAME"] = None
    yield
    app.config["MCP_DEV_USERNAME"] = original


@pytest.fixture(autouse=True)
def web_user(mocker: MockerFixture) -> Mock:
    # The unit-test client is unauthenticated (authorization is patched by
    # full_api_access); give the gateway a real-shaped session user.
    user = Mock()
    user.id = 1
    user.username = "admin"
    user.roles = []
    g_mock = mocker.patch("enx_dev.ai_chat.api.g")
    g_mock.user = user
    return user


@pytest.fixture(autouse=True)
def mock_mcp_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def cleanup_approvals(app: Any) -> Generator[None, None, None]:
    yield

    with app.app_context():
        core_models.get_session().query(core_models.KeyValue).filter(
            core_models.KeyValue.resource == RESOURCE
        ).delete()
        core_models.get_session().commit()


# Extension APIs are mounted under /extensions/{publisher}/{name}.
API_BASE = "/extensions/enx-dev/ai-chat"


def _dashboard_mock() -> Mock:
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = "test-dashboard"
    dashboard.url = "/dashboard/1"
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.editors = []
    dashboard.slices = []
    dashboard.description = None
    dashboard.css = None
    dashboard.embedded = []
    dashboard.charts = []
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.deleted_at = None
    dashboard.json_metadata = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = "test-dashboard-uuid-1"
    dashboard.thumbnail_url = None
    dashboard._mapping = {  # pylint: disable=protected-access
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "editors": dashboard.editors,
        "charts": [],
    }
    return dashboard


@AI_CHAT_E2E_APP
def test_read_only_flow_executes_real_mcp_tool(
    client: Any, full_api_access: None
) -> None:
    with patch(
        "superset.daos.dashboard.DashboardDAO.list",
        return_value=([_dashboard_mock()], 1),
    ):
        response = client.post(
            f"{API_BASE}/chat",
            json={
                "conversation_id": "conv_e2e_read",
                "messages": [{"role": "user", "content": "list my dashboards please"}],
            },
        )
    assert response.status_code == 200
    events = response.json["result"]["events"]
    types = [event["type"] for event in events]
    assert types == [
        "tool.running",
        "tool.completed",
        "message.completed",
        "request.completed",
    ]
    completed = events[1]
    assert completed["tool"] == "list_dashboards"
    assert "Test Dashboard" in completed["result"]
    # The mock provider summarized the real tool output.
    assert "list_dashboards" in events[2]["content"]


def _approval_rows(app: Any) -> int:
    with app.app_context():
        return (
            core_models.get_session()
            .query(core_models.KeyValue)
            .filter(core_models.KeyValue.resource == RESOURCE)
            .count()
        )


@AI_CHAT_E2E_DEFAULT_APP
def test_default_flow_executes_a_mutation_without_any_approval(
    app: Any, client: Any, full_api_access: None
) -> None:
    """Enabling the assistant and configuring nothing else runs tools directly.

    The dashboard is made not to exist, so nothing is deleted; what matters
    is that the tool was reached at all, through the RBAC-enforcing bridge.
    """
    assert _approval_rows(app) == 0

    with patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=None
    ) as mock_find:
        response = client.post(
            f"{API_BASE}/chat",
            json={
                "conversation_id": "conv_e2e_direct",
                "messages": [{"role": "user", "content": "delete dashboard 42"}],
            },
        )
        # The tool really ran: MCP looked the dashboard up under this user.
        mock_find.assert_called()

    assert response.status_code == 200
    types = [event["type"] for event in response.json["result"]["events"]]
    assert "tool.running" in types
    assert "tool.approval_required" not in types
    # Nothing was persisted, so there is nothing to replay, expire or tamper
    # with: in this mode the gateway keeps no server-side state at all.
    assert _approval_rows(app) == 0


@AI_CHAT_E2E_DEFAULT_APP
def test_default_mode_refuses_a_forged_approval(
    app: Any, client: Any, full_api_access: None
) -> None:
    """A browser cannot talk its way onto the approval path: the endpoint
    refuses outright, without looking the crafted id up."""
    with patch("superset.daos.dashboard.DashboardDAO.find_by_id") as mock_find:
        response = client.post(
            f"{API_BASE}/tool_approval",
            json={
                "conversation_id": "conv_e2e_forged",
                "messages": [{"role": "user", "content": "delete dashboard 42"}],
                "approval_id": "3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc",
                "decision": "approve",
                "tool_call": {
                    "id": "tc1",
                    "name": "delete_dashboard",
                    "arguments": {"request": {"identifier": 42}},
                },
            },
        )
        mock_find.assert_not_called()
    assert response.status_code == 400
    assert response.json["error_code"] == "AI_CHAT_APPROVAL_EXPIRED"
    assert _approval_rows(app) == 0


@AI_CHAT_E2E_DEFAULT_APP
def test_default_mode_is_reported_by_the_config_endpoint(
    client: Any, full_api_access: None
) -> None:
    response = client.get(f"{API_BASE}/config")
    assert response.status_code == 200
    assert response.json["result"]["tool_approval_mode"] == "disabled"


@AI_CHAT_E2E_APP
def test_mutation_flow_requires_and_honors_rejection(
    client: Any, full_api_access: None
) -> None:
    # Step 1: the mutation is proposed, not executed.
    response = client.post(
        f"{API_BASE}/chat",
        json={
            "conversation_id": "conv_e2e_mut",
            "messages": [{"role": "user", "content": "delete dashboard 42"}],
        },
    )
    assert response.status_code == 200
    events = response.json["result"]["events"]
    approval_event = events[-1]
    assert approval_event["type"] == "tool.approval_required"
    assert approval_event["tool"] == "delete_dashboard"
    assert approval_event["classification"] == "destructive"
    assert approval_event["arguments"] == {"request": {"identifier": 42}}
    approval_id = approval_event["approval_id"]

    # Step 2: rejection never executes and burns the approval.
    with patch("superset.daos.dashboard.DashboardDAO.find_by_id") as mock_find:
        response = client.post(
            f"{API_BASE}/tool_approval",
            json={
                "conversation_id": "conv_e2e_mut",
                "messages": [{"role": "user", "content": "delete dashboard 42"}],
                "approval_id": approval_id,
                "decision": "reject",
                "tool_call": {
                    "id": approval_event["id"],
                    "name": "delete_dashboard",
                    "arguments": {"request": {"identifier": 42}},
                },
            },
        )
        mock_find.assert_not_called()
    assert response.status_code == 200
    types = [event["type"] for event in response.json["result"]["events"]]
    assert types[0] == "tool.rejected"
    assert "request.completed" in types

    # Step 3: the burned approval cannot be replayed as an approval.
    response = client.post(
        f"{API_BASE}/tool_approval",
        json={
            "conversation_id": "conv_e2e_mut",
            "messages": [{"role": "user", "content": "delete dashboard 42"}],
            "approval_id": approval_id,
            "decision": "approve",
            "tool_call": {
                "id": approval_event["id"],
                "name": "delete_dashboard",
                "arguments": {"request": {"identifier": 42}},
            },
        },
    )
    assert response.status_code == 400
    assert response.json["error_code"] == "AI_CHAT_APPROVAL_EXPIRED"


@AI_CHAT_E2E_APP
def test_mutation_approval_with_tampered_arguments_rejected(
    client: Any, full_api_access: None
) -> None:
    response = client.post(
        f"{API_BASE}/chat",
        json={
            "conversation_id": "conv_e2e_tamper",
            "messages": [{"role": "user", "content": "delete dashboard 42"}],
        },
    )
    approval_event = response.json["result"]["events"][-1]
    assert approval_event["type"] == "tool.approval_required"

    # Approving with different arguments must fail and must not execute.
    with patch("superset.daos.dashboard.DashboardDAO.find_by_id") as mock_find:
        response = client.post(
            f"{API_BASE}/tool_approval",
            json={
                "conversation_id": "conv_e2e_tamper",
                "messages": [{"role": "user", "content": "delete dashboard 42"}],
                "approval_id": approval_event["approval_id"],
                "decision": "approve",
                "tool_call": {
                    "id": approval_event["id"],
                    "name": "delete_dashboard",
                    "arguments": {"request": {"identifier": 43}},
                },
            },
        )
        mock_find.assert_not_called()
    assert response.status_code == 400
    assert response.json["error_code"] == "AI_CHAT_APPROVAL_MISMATCH"
