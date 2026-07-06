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
"""
Email rendering and delivery for dashboard Excel exports.

Bodies use inline styles only (no external CSS, no logo) to match Superset's
existing report notification emails, and all user-controlled values (dashboard
title, chart names) are HTML-escaped to avoid injection.
"""

from __future__ import annotations

from datetime import datetime

from flask import current_app
from flask_babel import gettext as __, ngettext
from markupsafe import escape

from superset.utils.core import send_email_smtp

_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
_FOOTER_STYLE = "color:#888;font-size:12px;"
_BUTTON_STYLE = (
    "display:inline-block;padding:10px 16px;background:#20a7c9;color:#ffffff;"
    "text-decoration:none;border-radius:4px;"
)

# Reason keys under which the export task groups charts it could not export.
# The task classifies each omitted chart under one of these; the email renders a
# separate, labelled section per non-empty group with its own remediation text.
ERROR_NO_QUERY_CONTEXT = "no-query-context"
ERROR_TIMEOUT = "timeout"
ERROR_GENERAL = "general-exception"


def _fmt(dt: datetime) -> str:
    return dt.strftime(_DATETIME_FORMAT)


def _humanize_ttl(seconds: int) -> str:
    """Render a TTL as a human-readable, pluralized, translatable duration.

    Whole hours read as "24 hours"; sub-hour and non-hour values keep their
    minutes (e.g. "1 hour 30 minutes", "15 minutes") so the stated lifetime
    always matches the real pre-signed URL expiration.
    """
    hours, remainder = divmod(seconds, 3600)
    parts: list[str] = []
    if hours:
        parts.append(ngettext("%(num)d hour", "%(num)d hours", hours))
    if minutes := remainder // 60:
        parts.append(ngettext("%(num)d minute", "%(num)d minutes", minutes))
    if not parts:
        parts.append(ngettext("%(num)d second", "%(num)d seconds", seconds))
    return " ".join(parts)


def build_subject(dashboard_title: str, *, success: bool) -> str:
    """Build the email subject, prefixed with EMAIL_REPORTS_SUBJECT_PREFIX."""
    prefix = current_app.config["EMAIL_REPORTS_SUBJECT_PREFIX"]
    if success:
        return prefix + __(
            "Your dashboard export is ready: %(title)s", title=dashboard_title
        )
    return prefix + __(
        "Your dashboard export could not be completed: %(title)s",
        title=dashboard_title,
    )


def _errored_section(errored: dict[str, list[str]]) -> str:
    """Render one labelled, translated sub-list per non-empty error group.

    ``errored`` maps a reason key (see the ``ERROR_*`` constants) to the labels
    of the charts that were omitted for that reason. Known reasons are rendered
    first, in a stable order, each with its own remediation text; any unknown
    reason key falls back to a generic message so nothing is silently dropped.
    """
    if not errored:
        return ""
    notes = {
        ERROR_NO_QUERY_CONTEXT: __(
            "The following charts were omitted because they have no saved query "
            "context. To include them, open each chart in Explore and re-save."
        ),
        ERROR_TIMEOUT: __(
            "The following charts were omitted because they timed out before "
            "their data could be exported:"
        ),
        ERROR_GENERAL: __(
            "The following charts were omitted because an error occurred while "
            "exporting them:"
        ),
    }
    fallback = __("The following charts could not be exported:")
    ordered = [ERROR_NO_QUERY_CONTEXT, ERROR_TIMEOUT, ERROR_GENERAL]
    reasons = ordered + [reason for reason in errored if reason not in ordered]
    sections = []
    for reason in reasons:
        labels = errored.get(reason)
        if not labels:
            continue
        note = notes.get(reason, fallback)
        items = "".join(f"<li>{escape(label)}</li>" for label in labels)
        sections.append(f"<p>{note}</p><ul>{items}</ul>")
    return "".join(sections)


def build_success_email(
    dashboard_title: str,
    download_url: str,
    requested_at: datetime,
    expires_at: datetime,
    ttl_seconds: int,
    errored: dict[str, list[str]],
) -> str:
    """Render the success email body (HTML)."""
    title = escape(dashboard_title)
    url = escape(download_url)
    ready = __('Your export of "%(title)s" is ready.', title=title)
    button = __("Download Excel file")
    expiry = __(
        "This link expires in %(duration)s (%(when)s UTC).",
        duration=_humanize_ttl(ttl_seconds),
        when=_fmt(expires_at),
    )
    requested = __(
        "This export was requested on %(when)s UTC.", when=_fmt(requested_at)
    )
    disclaimer = __("If you did not request this, you can ignore this email.")
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f"<p>{ready}</p>"
        f'<p><a href="{url}" style="{_BUTTON_STYLE}">{button}</a></p>'
        f"<p>{expiry}</p>"
        f"{_errored_section(errored)}"
        "<hr/>"
        f'<p style="{_FOOTER_STYLE}">{requested}<br/>{disclaimer}</p>'
        "</body></html>"
    )


def build_failure_email(dashboard_title: str, requested_at: datetime) -> str:
    """Render the failure email body (HTML)."""
    title = escape(dashboard_title)
    failed = __('Your export of "%(title)s" could not be completed.', title=title)
    advice = __(
        "An error occurred while generating the file. Please try again, or "
        "contact your administrator if the problem persists."
    )
    requested = __(
        "This export was requested on %(when)s UTC.", when=_fmt(requested_at)
    )
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f"<p>{failed}</p>"
        f"<p>{advice}</p>"
        "<hr/>"
        f'<p style="{_FOOTER_STYLE}">{requested}</p>'
        "</body></html>"
    )


def send_export_email(to: str, subject: str, html_content: str) -> None:
    """Send an export email via the configured SMTP transport."""
    send_email_smtp(
        to=to,
        subject=subject,
        html_content=html_content,
        config=current_app.config,
    )
