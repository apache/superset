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

"""Tests for the generate_bug_report MCP tool."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.system.tool.generate_bug_report import _sanitize_text
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


# ---------------------------------------------------------------------------
# Unit tests: _sanitize_text (pure function, no Flask/MCP context required)
# ---------------------------------------------------------------------------


def test_sanitize_text_redacts_email():
    redactions: set[str] = set()
    out = _sanitize_text("reach me at alice@example.com please", redactions)
    assert "alice@example.com" not in out
    assert "[REDACTED_EMAIL]" in out
    assert "email" in redactions


def test_sanitize_text_does_not_redact_timestamps_as_ipv6():
    """Regression: '12:34:56' is a time, not an IPv6 address."""
    redactions: set[str] = set()
    msg = "failed at 12:34:56 and also 01:02:03:04 during retry"
    out = _sanitize_text(msg, redactions)
    assert "12:34:56" in out
    assert "01:02:03:04" in out
    assert "ip_address" not in redactions


def test_sanitize_text_redacts_real_ipv6_with_compression():
    redactions: set[str] = set()
    for addr in ("fe80::1", "::1", "2001:db8::1", "2001:db8:85a3::8a2e:370:7334"):
        redactions.clear()
        out = _sanitize_text(f"bound to {addr} before crash", redactions)
        # Full address consumed — no orphan ":370:7334"-style residue left over.
        assert out == "bound to [REDACTED_IP] before crash", (addr, out)
        assert "ip_address" in redactions


def test_sanitize_text_redacts_ipv6_with_hex_groups():
    """Full-form IPv6 with hex letters should redact."""
    redactions: set[str] = set()
    out = _sanitize_text("peer fe80:0:0:0:1:2:3:abcd refused", redactions)
    assert "fe80:0:0:0:1:2:3:abcd" not in out
    assert "ip_address" in redactions


def test_sanitize_text_redacts_ipv4():
    redactions: set[str] = set()
    out = _sanitize_text("failed connecting to 10.0.0.42 port 8088", redactions)
    assert "10.0.0.42" not in out
    assert "[REDACTED_IP]" in out
    assert "ip_address" in redactions


def test_sanitize_text_redacts_bearer_token():
    redactions: set[str] = set()
    out = _sanitize_text(
        "Authorization header was 'Bearer abc123.def456-ghi'", redactions
    )
    assert "abc123.def456-ghi" not in out
    assert "[REDACTED_TOKEN]" in out
    assert "token" in redactions


def test_sanitize_text_redacts_key_value_secret():
    redactions: set[str] = set()
    out = _sanitize_text("connected with password=hunter2 to db", redactions)
    assert "hunter2" not in out
    assert "password=[REDACTED_SECRET]" in out
    assert "secret" in redactions


def test_sanitize_text_preserves_original_separator():
    """password: foo stays 'password: [REDACTED_SECRET]' — don't rewrite to '='."""
    redactions: set[str] = set()
    out = _sanitize_text("header was password: hunter2 here", redactions)
    assert "hunter2" not in out
    assert "password: [REDACTED_SECRET]" in out
    assert "=" not in out.split("password", 1)[1].split("[REDACTED_SECRET]", 1)[0]


def test_sanitize_text_redacts_credentialed_url():
    redactions: set[str] = set()
    out = _sanitize_text(
        "driver://admin:s3cret@db.internal:5432/prod failed", redactions
    )
    assert "admin:s3cret@" not in out
    assert "[REDACTED_CREDENTIALS]" in out
    assert "url_credentials" in redactions


def test_sanitize_text_redacts_jwt():
    redactions: set[str] = set()
    jwt = (
        "eyJhbGciOiJIUzI1NiJ9."
        "eyJzdWIiOiIxMjM0NSJ9."
        "sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    out = _sanitize_text(f"got token {jwt} on retry", redactions)
    assert jwt not in out
    assert "[REDACTED_JWT]" in out
    assert "jwt" in redactions


def test_sanitize_text_redacts_long_hex_blob():
    redactions: set[str] = set()
    hex_blob = "a" * 40
    out = _sanitize_text(f"session id was {hex_blob} before crash", redactions)
    assert hex_blob not in out
    assert "[REDACTED_HEX]" in out
    assert "long_hex_token" in redactions


def test_sanitize_text_leaves_safe_text_alone():
    redactions: set[str] = set()
    safe = "generate_chart failed with KeyError on column 'revenue'"
    out = _sanitize_text(safe, redactions)
    assert out == safe
    assert redactions == set()


def test_sanitize_text_handles_empty():
    redactions: set[str] = set()
    assert _sanitize_text("", redactions) == ""
    assert redactions == set()


# ---------------------------------------------------------------------------
# Tool-level tests: generate_bug_report via MCP Client
# ---------------------------------------------------------------------------


class TestGenerateBugReportViaMCP:
    """Exercise the tool end-to-end through the MCP client."""

    @pytest.mark.asyncio
    async def test_generate_bug_report_builds_markdown_and_redacts(self, mcp_server):
        mock_user = Mock()
        mock_user.id = 42
        role = Mock()
        role.name = "Alpha"
        mock_user.roles = [role]

        with patch("flask.g") as mock_g:
            mock_g.user = mock_user

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {
                        "request": {
                            "tool_name": "generate_chart",
                            "error_message": (
                                "Failed talking to 10.0.0.7, "
                                "token was Bearer abc.def-ghi, "
                                "owner alice@example.com"
                            ),
                            "llm_used": "Claude Sonnet 4.6",
                            "steps_to_reproduce": "Ran generate_chart on dataset 5",
                            "additional_context": (
                                "driver://user:pw@db.internal/prod was the target"
                            ),
                        }
                    },
                )

        data = json.loads(result.content[0].text)

        assert "report" in data
        assert data["support_contact"].startswith("Preset support team")
        report = data["report"]

        # Structure
        assert "# Superset MCP Bug Report" in report
        assert "MCP tool:** generate_chart" in report
        assert "LLM / client:** Claude Sonnet 4.6" in report
        assert "User ID:** 42" in report
        assert "Roles:** Alpha" in report

        # PII/secrets are gone
        assert "10.0.0.7" not in report
        assert "alice@example.com" not in report
        assert "abc.def-ghi" not in report
        assert "user:pw@" not in report

        # Redaction categories surfaced to caller
        redactions = set(data["redactions_applied"])
        assert {"ip_address", "email", "token", "url_credentials"}.issubset(redactions)

    @pytest.mark.asyncio
    async def test_generate_bug_report_with_no_user_context(self, mcp_server):
        """Tool must still produce a report when g.user is unset."""
        with patch("flask.g") as mock_g:
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {"request": {"tool_name": "execute_sql"}},
                )

        data = json.loads(result.content[0].text)
        assert "User ID:** None" in data["report"]
        assert "Roles:** none" in data["report"]
        assert data["redactions_applied"] == []

    @pytest.mark.asyncio
    async def test_generate_bug_report_with_no_args(self, mcp_server):
        """All fields are optional — empty request still returns a usable report."""
        with patch("flask.g") as mock_g:
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {"request": {}},
                )

        data = json.loads(result.content[0].text)
        report = data["report"]
        assert "MCP tool:** not provided" in report
        assert "LLM / client:** not provided" in report
        assert "_not provided_" in report  # empty sections
