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

import importlib
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.system.tool.generate_bug_report import _sanitize_text
from superset.utils import json

# Import the submodule via importlib so we can patch.object() on it. Going
# through `from ...tool import generate_bug_report` would resolve to the
# re-exported function in tool/__init__.py, not the submodule, and break
# attribute patching — same pitfall called out in test_get_current_user.py.
gbr_module = importlib.import_module(
    "superset.mcp_service.system.tool.generate_bug_report"
)


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


def test_sanitize_text_redacts_bearer_base64_padding():
    """Regression: base64-padded tokens must be fully consumed, no '==' tail."""
    redactions: set[str] = set()
    out = _sanitize_text("got 'Bearer AAAA==' from server", redactions)
    assert "AAAA" not in out
    assert "==" not in out  # padding tail must not leak
    assert "Bearer [REDACTED_TOKEN]" in out
    assert "token" in redactions


def test_sanitize_text_redacts_bearer_with_slash_and_plus():
    """Regression: base64 alphabet (+ / =) must be fully consumed."""
    redactions: set[str] = set()
    out = _sanitize_text("retry with 'Bearer abc+/=/xyz' header", redactions)
    assert "abc+/=/xyz" not in out
    assert "+/=/xyz" not in out  # no fragment of the token leaks
    assert "Bearer [REDACTED_TOKEN]" in out
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


def test_sanitize_text_jwt_keyword_does_not_double_match():
    """Regression: 'token <JWT>' must redact as JWT, not get re-matched as bearer.

    The wider \\S+ value matcher in _BEARER_RE would otherwise re-consume the
    already-redacted '[REDACTED_JWT]' placeholder, relabel it to TOKEN, and
    pollute redactions_applied with a spurious 'token' entry alongside 'jwt'.
    A negative lookahead in _BEARER_RE prevents that.
    """
    redactions: set[str] = set()
    jwt = (
        "eyJhbGciOiJIUzI1NiJ9."
        "eyJzdWIiOiIxMjM0NSJ9."
        "sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    out = _sanitize_text(f"got token {jwt} on retry", redactions)
    assert jwt not in out
    assert "[REDACTED_JWT]" in out
    assert "[REDACTED_TOKEN]" not in out  # JWT already redacted, no relabel
    assert "jwt" in redactions
    assert "token" not in redactions  # exactly one rule should fire on this input


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
        # Default neutral contact when MCP_BUG_REPORT_CONTACT is unset.
        assert "Apache Superset" in data["support_contact"]
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

    @pytest.mark.asyncio
    async def test_generate_bug_report_sanitizes_llm_used(self, mcp_server):
        """llm_used must be sanitized — defense in depth, consistent with schema."""
        with patch("flask.g") as mock_g:
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {
                        "request": {
                            # Pathological: someone pastes an account-tagged
                            # model path that includes an email.
                            "llm_used": "claude@account-alice@example.com",
                        }
                    },
                )

        data = json.loads(result.content[0].text)
        assert "alice@example.com" not in data["report"]
        assert "[REDACTED_EMAIL]" in data["report"]
        assert "email" in data["redactions_applied"]

    @pytest.mark.asyncio
    async def test_generate_bug_report_uses_configured_contact(self, mcp_server, app):
        """When MCP_BUG_REPORT_CONTACT is set, the response surfaces it verbatim."""
        configured = "Acme support (support@acme.example)"
        app.config["MCP_BUG_REPORT_CONTACT"] = configured
        try:
            with patch("flask.g") as mock_g:
                mock_g.user = None

                async with Client(mcp_server) as client:
                    result = await client.call_tool(
                        "generate_bug_report",
                        {"request": {}},
                    )

            data = json.loads(result.content[0].text)
            assert data["support_contact"] == configured
        finally:
            app.config.pop("MCP_BUG_REPORT_CONTACT", None)

    @pytest.mark.asyncio
    async def test_generate_bug_report_includes_mcp_call_id(self, mcp_server):
        """Bug report includes mcp_call_id when provided."""
        with patch("flask.g") as mock_g:
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {
                        "request": {
                            "tool_name": "health_check",
                            "mcp_call_id": "abc123def456",
                        }
                    },
                )

        data = json.loads(result.content[0].text)
        assert "abc123def456" in data["report"]
        assert "MCP Call ID" in data["report"]

    @pytest.mark.asyncio
    async def test_generate_bug_report_omits_mcp_call_id_when_absent(self, mcp_server):
        """Bug report omits MCP Call ID line when not provided."""
        with patch("flask.g") as mock_g:
            mock_g.user = None

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_bug_report",
                    {"request": {"tool_name": "health_check"}},
                )

        data = json.loads(result.content[0].text)
        assert "MCP Call ID" not in data["report"]


# ---------------------------------------------------------------------------
# Schema-level tests: max_length caps
# ---------------------------------------------------------------------------


def test_request_rejects_oversized_error_message():
    """error_message has a 4000-char cap to bound regex work on adversarial input."""
    from pydantic import ValidationError

    from superset.mcp_service.system.schemas import GenerateBugReportRequest

    with pytest.raises(ValidationError):
        GenerateBugReportRequest(error_message="x" * 4001)


def test_request_rejects_oversized_tool_name():
    """tool_name has a tighter 200-char cap (it's an identifier, not free text)."""
    from pydantic import ValidationError

    from superset.mcp_service.system.schemas import GenerateBugReportRequest

    with pytest.raises(ValidationError):
        GenerateBugReportRequest(tool_name="x" * 201)


# ---------------------------------------------------------------------------
# Fallback coverage: the "never fail the bug report" contract
# ---------------------------------------------------------------------------


def test_collect_environment_falls_back_when_version_unavailable():
    """If get_version_metadata raises, the env block stays valid."""
    with patch.object(
        gbr_module,
        "get_version_metadata",
        side_effect=RuntimeError("no version file"),
    ):
        env = gbr_module._collect_environment()

    assert env["superset_version"] == "unknown"
    # Other fields still populated from platform / current_app.
    assert env["python_version"]
    assert env["platform"]


def test_collect_user_context_with_no_flask_g():
    """If flask.g.user access raises, we get the empty default.

    Replace flask.g with an object whose ``user`` property raises, so
    the ``getattr(flask.g, "user", None)`` call inside
    ``_collect_user_context`` hits the except branch.
    """

    class _Boom:
        @property
        def user(self):
            raise RuntimeError("no app context")

    with patch.object(gbr_module.flask, "g", _Boom()):
        ctx = gbr_module._collect_user_context()

    assert ctx == {"user_id": None, "roles": []}


def test_collect_user_context_handles_role_typeerror():
    """If user.roles is unexpectedly non-iterable, roles fall back to []."""
    from superset.mcp_service.system.tool.generate_bug_report import (
        _collect_user_context,
    )

    bad_user = Mock()
    bad_user.id = 7
    # An object that has .name but isn't iterable — for-loop raises TypeError.
    bad_user.roles = 42

    with patch("flask.g") as mock_g:
        mock_g.user = bad_user
        ctx = _collect_user_context()

    assert ctx["user_id"] == 7
    assert ctx["roles"] == []


def test_resolve_support_contact_returns_default_when_unset(app):
    """Without MCP_BUG_REPORT_CONTACT, the neutral default wins."""
    from superset.mcp_service.system.tool.generate_bug_report import (
        _resolve_support_contact,
        DEFAULT_SUPPORT_CONTACT,
    )

    app.config.pop("MCP_BUG_REPORT_CONTACT", None)
    assert _resolve_support_contact() == DEFAULT_SUPPORT_CONTACT


def test_resolve_support_contact_ignores_blank_override(app):
    """Whitespace-only overrides fall back to the default."""
    from superset.mcp_service.system.tool.generate_bug_report import (
        _resolve_support_contact,
        DEFAULT_SUPPORT_CONTACT,
    )

    app.config["MCP_BUG_REPORT_CONTACT"] = "   "
    try:
        assert _resolve_support_contact() == DEFAULT_SUPPORT_CONTACT
    finally:
        app.config.pop("MCP_BUG_REPORT_CONTACT", None)
