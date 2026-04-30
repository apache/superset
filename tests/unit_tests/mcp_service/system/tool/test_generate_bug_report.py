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

"""Unit tests for generate_bug_report tool."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.system.schemas import GenerateBugReportRequest
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for client-based tool tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


_BASE_REQUEST = {
    "summary": "Test bug",
    "steps_to_reproduce": "1. Do X",
    "expected_behavior": "Y should happen",
    "actual_behavior": "Z happened",
}


@pytest.mark.asyncio
async def test_generates_report_with_mcp_call_id(mcp_server):
    """Bug report includes mcp_call_id when provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "generate_bug_report",
            {
                "request": {
                    **_BASE_REQUEST,
                    "mcp_call_id": "abc123def456",
                }
            },
        )
        data = json.loads(result.content[0].text)

    assert "abc123def456" in data["report"]
    assert "MCP Call ID" in data["report"]
    assert data["mcp_call_id"] == "abc123def456"


@pytest.mark.asyncio
async def test_generates_report_without_mcp_call_id(mcp_server):
    """Bug report omits MCP Call ID line when not provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "generate_bug_report",
            {"request": _BASE_REQUEST},
        )
        data = json.loads(result.content[0].text)

    assert "MCP Call ID" not in data["report"]
    assert data["mcp_call_id"] is None


@pytest.mark.asyncio
async def test_report_contains_system_info(mcp_server):
    """Bug report includes system metadata."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "generate_bug_report",
            {"request": _BASE_REQUEST},
        )
        data = json.loads(result.content[0].text)

    report = data["report"]
    assert "## Bug Report" in report
    assert "Superset Version" in report
    assert "Python Version" in report
    assert "Platform" in report
    assert "### Summary" in report
    assert "Test bug" in report


def test_schema_rejects_extra_fields():
    """GenerateBugReportRequest forbids extra fields."""
    with pytest.raises(ValidationError, match="unknown_field"):
        GenerateBugReportRequest(
            summary="bug",
            steps_to_reproduce="steps",
            expected_behavior="expected",
            actual_behavior="actual",
            unknown_field="value",
        )


def test_schema_mcp_call_id_optional():
    """mcp_call_id defaults to None."""
    req = GenerateBugReportRequest(
        summary="bug",
        steps_to_reproduce="steps",
        expected_behavior="expected",
        actual_behavior="actual",
    )
    assert req.mcp_call_id is None
