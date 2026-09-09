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

"""Tests for health_check MCP tool."""

import importlib
from collections.abc import Iterator
from types import ModuleType
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP
from flask import Flask

from superset.mcp_service.app import mcp
from superset.mcp_service.system.schemas import HealthCheckResponse
from superset.utils import json

# Import the submodule directly so ``patch.object`` targets the module (not the
# ``health_check`` function that ``tool/__init__.py`` re-exports onto the
# package).
health_check_module: ModuleType = importlib.import_module(
    "superset.mcp_service.system.tool.health_check"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[MagicMock]:
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def test_health_check_response_schema():
    """Test that HealthCheckResponse has required fields."""
    response = HealthCheckResponse(
        status="healthy",
        timestamp="2025-11-10T19:00:00",
        service="Test MCP Service",
        version="4.0.0",
        python_version="3.11.0",
        platform="Darwin",
    )

    assert response.status == "healthy"
    assert response.service == "Test MCP Service"
    assert response.version == "4.0.0"
    assert response.python_version == "3.11.0"
    assert response.platform == "Darwin"
    assert response.timestamp is not None
    assert response.uptime_seconds is None  # Optional field


def test_health_check_response_with_uptime():
    """Test HealthCheckResponse with optional uptime field."""
    response = HealthCheckResponse(
        status="healthy",
        timestamp="2025-11-10T19:00:00",
        service="Test MCP Service",
        version="4.0.0",
        python_version="3.11.0",
        platform="Darwin",
        uptime_seconds=123.45,
    )

    assert response.uptime_seconds == 123.45


# ---------------------------------------------------------------------------
# Tool-level tests: health_check via MCP Client
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_check_success_via_client(mcp_server: FastMCP) -> None:
    """Happy path: tool returns a healthy status with real system info."""
    with patch.object(
        health_check_module,
        "get_version_metadata",
        return_value={"version_string": "4.1.0"},
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("health_check", {})

    data = json.loads(result.content[0].text)
    assert data["status"] == "healthy"
    assert data["service"] == "Superset MCP Service"
    assert data["version"] == "4.1.0"
    assert data["timestamp"] is not None
    assert data["uptime_seconds"] is not None
    assert data["uptime_seconds"] >= 0


@pytest.mark.asyncio
async def test_health_check_uses_configured_app_name(
    mcp_server: FastMCP, app: Flask
) -> None:
    """service name is derived from the APP_NAME config, not hardcoded."""
    had_app_name = "APP_NAME" in app.config
    original_app_name = app.config.get("APP_NAME")
    app.config["APP_NAME"] = "Acme Analytics"
    try:
        with patch.object(
            health_check_module,
            "get_version_metadata",
            return_value={"version_string": "4.1.0"},
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool("health_check", {})
    finally:
        if had_app_name:
            app.config["APP_NAME"] = original_app_name
        else:
            app.config.pop("APP_NAME", None)

    data = json.loads(result.content[0].text)
    assert data["service"] == "Acme Analytics MCP Service"


@pytest.mark.asyncio
async def test_health_check_returns_error_status_when_version_metadata_raises(
    mcp_server: FastMCP,
) -> None:
    """The except branch returns a degraded response instead of raising.

    get_version_metadata() is called inside the try block; when it raises,
    health_check must catch the exception and report status="error" with
    version="unknown" rather than propagating the failure to the client.
    """
    with patch.object(
        health_check_module,
        "get_version_metadata",
        side_effect=RuntimeError("version metadata unavailable"),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("health_check", {})

    data = json.loads(result.content[0].text)
    assert data["status"] == "error"
    assert data["version"] == "unknown"
    # uptime_seconds is only set on the success path.
    assert data["uptime_seconds"] is None
    # Fields computed before the try block are unaffected by the failure.
    assert data["service"] == "Superset MCP Service"
    assert data["python_version"]
    assert data["platform"]
    assert data["timestamp"] is not None


@pytest.mark.asyncio
async def test_health_check_returns_error_status_when_log_context_raises(
    mcp_server: FastMCP,
) -> None:
    """A failure inside the event_logger.log_context block also degrades gracefully."""
    with patch.object(
        health_check_module.event_logger,
        "log_context",
        side_effect=RuntimeError("logging backend unavailable"),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("health_check", {})

    data = json.loads(result.content[0].text)
    assert data["status"] == "error"
    assert data["version"] == "unknown"
    assert data["uptime_seconds"] is None
