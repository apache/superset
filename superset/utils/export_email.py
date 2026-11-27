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
Shared rendering helpers for the emails that announce a background export.

Bodies use inline styles only (no external CSS, no logo) to match Superset's
existing report notification emails, and every user-controlled value must be
HTML-escaped by the caller that interpolates it.
"""

from __future__ import annotations

from datetime import datetime

from flask_babel import gettext as __, ngettext

DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
FOOTER_STYLE = "color:#888;font-size:12px;"
BUTTON_STYLE = (
    "display:inline-block;padding:10px 16px;background:#20a7c9;color:#ffffff;"
    "text-decoration:none;border-radius:4px;"
)


def format_datetime(value: datetime) -> str:
    """Render a timestamp the way every export email labels them."""
    return value.strftime(DATETIME_FORMAT)


def humanize_ttl(seconds: int) -> str:
    """Render a TTL as a human-readable, pluralized, translatable duration.

    Whole hours read as "24 hours"; sub-hour and non-hour values keep their
    minutes (e.g. "1 hour 30 minutes", "15 minutes") so the stated lifetime
    always matches the link's real expiration.
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


def humanize_row_count(rows: int) -> str:
    """Render an exported row count, pluralized and thousands-separated.

    The count picks the plural form positionally and is interpolated
    separately, under a name other than ``num``: passing ``num`` as a variable
    too would collide with the positional argument of the same name.
    """
    return ngettext("%(count)s row", "%(count)s rows", rows, count=f"{rows:,}")


def footer(requested_at: datetime, *, include_disclaimer: bool) -> str:
    """Render the shared footer: when the export was asked for, and (for a
    success email, which carries a clickable link) the ignore-this note."""
    requested = __(
        "This export was requested on %(when)s UTC.",
        when=format_datetime(requested_at),
    )
    if not include_disclaimer:
        return f'<p style="{FOOTER_STYLE}">{requested}</p>'
    disclaimer = __("If you did not request this, you can ignore this email.")
    return f'<p style="{FOOTER_STYLE}">{requested}<br/>{disclaimer}</p>'
