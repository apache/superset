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

"""Generate a copy-pasteable bug report for the Preset support team.

The tool collects a minimal, safe snapshot of the MCP service environment and
combines it with user-supplied context (tool that failed, error seen, LLM /
client in use, free-text notes). Free-text fields are sanitized so emails,
IP addresses, tokens, bearer auth headers, credentialed URLs and similar
secrets never make it into the final report.
"""

from __future__ import annotations

import datetime
import logging
import platform
import re
from typing import Any, Callable

import flask
from flask import current_app
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.system.schemas import (
    GenerateBugReportRequest,
    GenerateBugReportResponse,
)
from superset.utils.version import get_version_metadata

logger = logging.getLogger(__name__)

DEFAULT_SUPPORT_CONTACT = (
    "your Superset administrator or the Apache Superset community "
    "(https://github.com/apache/superset/issues)"
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
# IPv6: two forms, both require signals that distinguish them from timestamps
# like "12:34:56" (3 numeric groups, 2 colons) which the naive pattern matches.
#   1. "::" compression — real IPv6 shorthand, e.g. ::1, fe80::1, 2001:db8::1
#   2. Full-ish form: at least 4 colon-separated groups (3+ colons) AND at
#      least one group containing a hex letter, e.g. fe80:0:0:0:1:2:3:4. This
#      trades coverage of the rare all-numeric IPv6 (e.g. 2001:0:0:0:0:0:0:1)
#      for not shredding every stack trace that contains a timestamp.
_IPV6_RE = re.compile(
    r"(?:"
    # "::" compression, optionally with groups on either side. The trailing
    # group list greedily consumes any remaining "(:hex){1,6}:hex" so we
    # don't leave orphan ":370:7334"-style residue in the redacted output.
    r"\b(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*)?"
    r"|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b"
    r"|\b(?=[0-9a-fA-F:]*[a-fA-F])"  # must have a hex letter somewhere
    r"(?:[0-9a-fA-F]{1,4}:){3,7}[0-9a-fA-F]{1,4}\b"
    r")"
)
# Header-style "Bearer <value>" tokens. The value matcher is \S+ rather than a
# narrower character class so base64-encoded tokens with =/+// characters
# (e.g. "Bearer AAAA==") are fully consumed instead of leaking trailing
# padding. The leading \b…\s+ prevents over-matching across whitespace.
_BEARER_RE = re.compile(r"(?i)\b(bearer|token|api[_-]?key)\s+\S+")
_KEY_VALUE_SECRET_RE = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|"
    r"auth[_-]?token|authorization|bearer|session[_-]?id)"
    r"(\s*[:=]\s*)\"?([^\"\s,;]+)\"?"
)
_URL_CREDENTIALS_RE = re.compile(r"(\b\w+://)[^\s/@]+:[^\s/@]+@")
_LONG_HEX_RE = re.compile(r"\b[A-Fa-f0-9]{32,}\b")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b")

_DEFAULT_BUG_REPORT_REQUEST = GenerateBugReportRequest()


def _sanitize_text(text: str, redactions: set[str]) -> str:
    """Redact common PII / secret patterns from free-text input.

    Tracks every category that actually matched in ``redactions`` so the
    caller can surface that list to the user.
    """
    if not text:
        return text

    def _sub(
        pattern: re.Pattern[str],
        replacement: str | Callable[[re.Match[str]], str],
        category: str,
        value: str,
    ) -> str:
        new_value, count = pattern.subn(replacement, value)
        if count:
            redactions.add(category)
        return new_value

    # Order matters: strip JWTs / credentialed URLs before generic hex/email
    # patterns get a chance to partially match their substrings.
    text = _sub(_JWT_RE, "[REDACTED_JWT]", "jwt", text)
    text = _sub(
        _URL_CREDENTIALS_RE, r"\1[REDACTED_CREDENTIALS]@", "url_credentials", text
    )
    # _BEARER_RE must run BEFORE _KEY_VALUE_SECRET_RE: both cover the
    # "bearer" keyword and the replacement "Bearer [REDACTED_TOKEN]" contains
    # no ':' / '=' separator, so the kv regex can't re-match it. Reordering
    # would leak the secret through the less-specific pattern.
    text = _sub(_BEARER_RE, r"\1 [REDACTED_TOKEN]", "token", text)
    text = _sub(
        _KEY_VALUE_SECRET_RE,
        lambda m: f"{m.group(1)}{m.group(2)}[REDACTED_SECRET]",
        "secret",
        text,
    )
    text = _sub(_EMAIL_RE, "[REDACTED_EMAIL]", "email", text)
    text = _sub(_IPV6_RE, "[REDACTED_IP]", "ip_address", text)
    text = _sub(_IPV4_RE, "[REDACTED_IP]", "ip_address", text)
    text = _sub(_LONG_HEX_RE, "[REDACTED_HEX]", "long_hex_token", text)
    return text


def _safe_str(value: Any) -> str:
    try:
        return str(value)
    except Exception:  # noqa: BLE001 — fallback, never fail a bug report
        return "<unavailable>"


def _collect_environment() -> dict[str, str]:
    """Collect non-sensitive environment metadata for the report."""
    env: dict[str, str] = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "superset_version": "unknown",
        "service": "Superset MCP Service",
    }

    try:
        version_metadata = get_version_metadata()
        env["superset_version"] = _safe_str(
            version_metadata.get("version_string", "unknown")
        )
    except Exception:  # noqa: BLE001
        logger.warning("bug_report: unable to read Superset version", exc_info=True)

    try:
        app_name = current_app.config.get("APP_NAME", "Superset")
        env["service"] = f"{app_name} MCP Service"
    except Exception:  # noqa: BLE001
        # current_app may be unavailable outside a Flask context
        logger.debug("bug_report: no Flask app context for APP_NAME", exc_info=True)

    return env


def _collect_user_context() -> dict[str, Any]:
    """Collect a minimal, PII-free user context.

    Only the numeric user id and role names are included — usernames, emails,
    and full names are intentionally omitted.
    """
    ctx: dict[str, Any] = {"user_id": None, "roles": []}
    try:
        user = getattr(flask.g, "user", None)
    except Exception:  # noqa: BLE001
        user = None

    if user is None:
        return ctx

    ctx["user_id"] = getattr(user, "id", None)
    raw_roles = getattr(user, "roles", None) or []
    try:
        ctx["roles"] = [r.name for r in raw_roles if hasattr(r, "name")]
    except TypeError:
        ctx["roles"] = []
    return ctx


def _resolve_support_contact() -> str:
    """Read MCP_BUG_REPORT_CONTACT from app config or fall back to default."""
    try:
        configured = current_app.config.get("MCP_BUG_REPORT_CONTACT")
    except Exception:  # noqa: BLE001
        # current_app unavailable outside a Flask context — fall through
        configured = None
    if isinstance(configured, str) and configured.strip():
        return configured
    return DEFAULT_SUPPORT_CONTACT


def _format_report(
    sanitized: dict[str, str | None],
    environment: dict[str, str],
    user_context: dict[str, Any],
    timestamp: str,
) -> str:
    """Render the final markdown report."""
    lines: list[str] = [
        "# Superset MCP Bug Report",
        "",
        f"- **Timestamp (UTC):** {timestamp}",
        f"- **Service:** {environment['service']}",
        f"- **Superset version:** {environment['superset_version']}",
        f"- **Python version:** {environment['python_version']}",
        f"- **Platform:** {environment['platform']}",
        f"- **User ID:** {user_context['user_id']}",
        f"- **Roles:** {', '.join(user_context['roles']) or 'none'}",
        "",
        "## What the user was doing",
        f"- **MCP tool:** {sanitized.get('tool_name') or 'not provided'}",
        f"- **LLM / client:** {sanitized.get('llm_used') or 'not provided'}",
        "",
        "## Error / unexpected behavior",
        sanitized.get("error_message") or "_not provided_",
        "",
        "## Steps to reproduce",
        sanitized.get("steps_to_reproduce") or "_not provided_",
        "",
        "## Additional context",
        sanitized.get("additional_context") or "_not provided_",
        "",
        "---",
        (
            "_This report was generated by the Superset MCP service. "
            "Emails, IPs, tokens, credentialed URLs and other common "
            "secrets are redacted automatically — please double-check "
            "before sending._"
        ),
    ]
    return "\n".join(lines)


@tool(
    tags=["core"],
    protect=False,
    annotations=ToolAnnotations(
        title="Generate bug report",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def generate_bug_report(
    request: GenerateBugReportRequest = _DEFAULT_BUG_REPORT_REQUEST,
) -> GenerateBugReportResponse:
    """Generate a copy-pasteable bug report for whoever runs this MCP.

    Use this tool when something goes wrong with the MCP service and the
    user wants to report it. The tool collects a safe snapshot of the
    environment, combines it with the context the user provides (tool
    that failed, error seen, LLM / client in use, optional free-text
    notes) and returns a markdown report the user can paste into their
    support channel.

    PII and secrets are redacted from every user-supplied field before
    they are written to the report (emails, IP addresses, bearer tokens,
    API keys, credentialed URLs, JWTs, long hex blobs, key/value
    secrets). The response lists every category that was actually
    redacted so the user can spot-check.

    The support contact in the response is configurable via the
    ``MCP_BUG_REPORT_CONTACT`` setting in ``superset_config.py`` so each
    deployment can point users at the right channel. The default points
    at the user's Superset administrator and the Apache Superset issue
    tracker.

    All request fields are optional — the tool still produces a useful
    report when the user only remembers part of what happened.
    """
    with event_logger.log_context(action="mcp.generate_bug_report"):
        redactions: set[str] = set()
        # Every user-supplied free-text field goes through the redactor —
        # even tool_name and llm_used, where secrets are unlikely but cheap
        # to defend against (defense in depth, consistency with the schema's
        # "PII is redacted from free-text fields" promise).
        sanitized = {
            "tool_name": _sanitize_text(request.tool_name or "", redactions) or None,
            "llm_used": _sanitize_text(request.llm_used or "", redactions) or None,
            "error_message": _sanitize_text(request.error_message or "", redactions)
            or None,
            "steps_to_reproduce": _sanitize_text(
                request.steps_to_reproduce or "", redactions
            )
            or None,
            "additional_context": _sanitize_text(
                request.additional_context or "", redactions
            )
            or None,
        }

        environment = _collect_environment()
        user_context = _collect_user_context()
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        support_contact = _resolve_support_contact()

        report = _format_report(
            sanitized=sanitized,
            environment=environment,
            user_context=user_context,
            timestamp=timestamp,
        )

    return GenerateBugReportResponse(
        report=report,
        redactions_applied=sorted(redactions),
        support_contact=support_contact,
    )
