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
from markupsafe import escape

from superset.utils.core import send_email_smtp

_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
_FOOTER_STYLE = "color:#888;font-size:12px;"
_BUTTON_STYLE = (
    "display:inline-block;padding:10px 16px;background:#20a7c9;color:#ffffff;"
    "text-decoration:none;border-radius:4px;"
)


def _fmt(dt: datetime) -> str:
    return dt.strftime(_DATETIME_FORMAT)


def build_subject(dashboard_title: str, *, success: bool) -> str:
    """Build the email subject, prefixed with EMAIL_REPORTS_SUBJECT_PREFIX."""
    prefix = current_app.config["EMAIL_REPORTS_SUBJECT_PREFIX"]
    if success:
        return f"{prefix}Your dashboard export is ready: {dashboard_title}"
    return f"{prefix}Your dashboard export could not be completed: {dashboard_title}"


def _skipped_section(skipped_charts: list[str]) -> str:
    if not skipped_charts:
        return ""
    items = "".join(f"<li>{escape(label)}</li>" for label in skipped_charts)
    return (
        "<p>Note: the following charts were omitted because they have no saved "
        "query context. To include them, open each chart in Explore and re-save."
        f"</p><ul>{items}</ul>"
    )


def build_success_email(
    dashboard_title: str,
    download_url: str,
    requested_at: datetime,
    expires_at: datetime,
    ttl_seconds: int,
    skipped_charts: list[str],
) -> str:
    """Render the success email body (HTML)."""
    title = escape(dashboard_title)
    url = escape(download_url)
    hours = ttl_seconds // 3600
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f'<p>Your export of "{title}" is ready.</p>'
        f'<p><a href="{url}" style="{_BUTTON_STYLE}">Download Excel file</a></p>'
        f"<p>This link expires in {hours} hours ({_fmt(expires_at)} UTC).</p>"
        f"{_skipped_section(skipped_charts)}"
        "<hr/>"
        f'<p style="{_FOOTER_STYLE}">This export was requested on '
        f"{_fmt(requested_at)} UTC.<br/>"
        "If you did not request this, you can ignore this email.</p>"
        "</body></html>"
    )


def build_failure_email(dashboard_title: str, requested_at: datetime) -> str:
    """Render the failure email body (HTML)."""
    title = escape(dashboard_title)
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f'<p>Your export of "{title}" could not be completed.</p>'
        "<p>An error occurred while generating the file. Please try again, or "
        "contact your administrator if the problem persists.</p>"
        "<hr/>"
        f'<p style="{_FOOTER_STYLE}">This export was requested on '
        f"{_fmt(requested_at)} UTC.</p>"
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
