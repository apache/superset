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
Email rendering and delivery for full data exports.

Bodies use inline styles only (no external CSS, no logo) to match Superset's
existing report notification emails, and the chart or query name -- the one
user-controlled value -- is HTML-escaped to avoid injection.

The email carries a link, never the file: an uncapped export has no size
bound, so attaching it would mean building something no mail server would
accept.
"""

from __future__ import annotations

from datetime import datetime

from flask import current_app
from flask_babel import gettext as __
from markupsafe import escape

from superset.utils.core import send_email_smtp
from superset.utils.export_email import (
    BUTTON_STYLE,
    footer,
    format_datetime,
    humanize_row_count,
    humanize_ttl,
)


def build_subject(label: str, *, success: bool) -> str:
    """Build the email subject, prefixed with EMAIL_REPORTS_SUBJECT_PREFIX."""
    prefix = current_app.config["EMAIL_REPORTS_SUBJECT_PREFIX"]
    if success:
        return prefix + __("Your data export is ready: %(label)s", label=label)
    return prefix + __(
        "Your data export could not be completed: %(label)s", label=label
    )


def build_success_email(  # pylint: disable=too-many-arguments
    *,
    label: str,
    download_url: str,
    row_count: int,
    requested_at: datetime,
    expires_at: datetime,
    ttl_seconds: int,
    partial_note: str | None = None,
) -> str:
    """Render the success email body (HTML).

    :param partial_note: an already-translated sentence about what the file
        does *not* contain, when the export could not cover everything the
        source would show on screen
    """
    ready = __(
        'Your export of "%(label)s" is ready, with %(rows)s.',
        label=escape(label),
        rows=humanize_row_count(row_count),
    )
    button = __("Download CSV file")
    expiry = __(
        "This link expires in %(duration)s (%(when)s UTC).",
        duration=humanize_ttl(ttl_seconds),
        when=format_datetime(expires_at),
    )
    note = f"<p>{partial_note}</p>" if partial_note else ""
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f"<p>{ready}</p>"
        f'<p><a href="{escape(download_url)}" style="{BUTTON_STYLE}">{button}</a></p>'
        f"<p>{expiry}</p>"
        f"{note}"
        "<hr/>"
        f"{footer(requested_at, include_disclaimer=True)}"
        "</body></html>"
    )


def build_failure_email(
    label: str, requested_at: datetime, reason: str | None = None
) -> str:
    """Render the failure email body (HTML).

    :param reason: an already-translated sentence naming what went wrong when
        it is something the requester can act on; omitted for internal errors,
        which get the generic advice instead
    """
    failed = __(
        'Your export of "%(label)s" could not be completed.', label=escape(label)
    )
    advice = reason or __(
        "An error occurred while generating the file. Please try again, or "
        "contact your administrator if the problem persists."
    )
    return (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f"<p>{failed}</p>"
        f"<p>{advice}</p>"
        "<hr/>"
        f"{footer(requested_at, include_disclaimer=False)}"
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
