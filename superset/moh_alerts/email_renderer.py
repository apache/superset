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
"""Per-recipient HTML email rendering (Section 10 of the design spec).

Builds a dependency-free, HTML-escaped digest for one recipient listing only
the failing facilities inside that recipient's org-unit subtree.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone
from email.utils import format_datetime
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.models.moh_alert import MohAlert


def _cell(value: Any) -> str:
    """HTML-escape a value for display in a table cell."""
    if value is None:
        return ""
    return html.escape(str(value))


def default_subject(alert_name: str) -> str:
    """Default email subject when no template is configured."""
    return f"[MoH Alert] {alert_name}"


def render_subject(alert: MohAlert, extra: dict[str, Any]) -> str:
    if alert.subject_template:
        return alert.subject_template.format(
            alert_name=alert.name,
            period=extra.get("period_col", ""),
        )
    return default_subject(alert.name)


def render_alert_email(
    alert: MohAlert,
    extra: dict[str, Any],
    rows: list[Any],
    deep_link: str | None,
    email_cap: int = 50,
) -> str:
    """Render the HTML digest for a single recipient.

    ``rows`` are the in-scope failing-facility rows (already scoped by the
    caller). Only the first ``email_cap`` rows are listed.
    """
    facility_col = extra.get("facility_name_col", "org_unit_name")
    name_cols = [
        c for c in ("l7name", "l6name", "l5name", "l4name") if c in row_keys(rows)
    ]
    metric_cols = [
        c
        for c in extra.get("metric_cols", ["value", "baseline_value", "change_pct"])
        if c in row_keys(rows)
    ]
    period_col = extra.get("period_col", "period")

    table = _build_table(
        rows, facility_col, name_cols, metric_cols, period_col, email_cap
    )
    generated = format_datetime(datetime.now(tz=timezone.utc))

    link_html = (
        '<p style="margin:16px 0">'
        f'<a style="color:#1a5cff" href="{html.escape(deep_link)}">'
        "Open the dashboard filtered to your area &rarr;</a></p>"
        if deep_link
        else ""
    )

    lines = [
        '<div style="font-family:Segoe UI,Arial,sans-serif;'
        'max-width:640px;margin:0 auto;color:#222">',
        f'<h2 style="color:#12346b;margin:0 0 4px">{html.escape(alert.name)}</h2>',
        f'<p style="margin:0 0 4px;color:#444">Period: '
        f"<b>{html.escape(period_col)}</b> &mdash; generated {generated}</p>",
        '<p style="margin:0 0 12px;color:#444">Below are the facilities in '
        "<b>your area</b> that triggered this alert.</p>",
        table,
        link_html,
        '<hr style="border:none;border-top:1px solid #ddd;margin:18px 0">',
        '<p style="color:#888;font-size:12px;margin:0">You received this because '
        "you are assigned to an org unit at this facility or an overseeing level. "
        "Contact your administrator to change who receives alerts.</p>",
        "</div>",
    ]
    return "\n".join(lines)


def row_keys(rows: list[Any]) -> set[str]:
    keys: set[str] = set()
    for row in rows:
        keys.update(str(k) for k in row.keys())
    return keys


def _build_table(
    rows: list[Any],
    facility_col: str,
    name_cols: list[str],
    metric_cols: list[str],
    period_col: str,
    email_cap: int,
) -> str:
    headers = ["Facility"] + [
        c for c in ("Woreda", "Zone", "Region") if _has_col(rows, c)
    ]
    headers += list(metric_cols)
    header_row = "".join(
        f"<th style='text-align:left;padding:6px 10px;background:#eef2f8'>{h}</th>"
        for h in headers
    )

    body_rows: list[str] = []
    total = len(rows)
    shown = min(total, email_cap)
    for row in rows[:shown]:
        cells = [_cell(row.get(facility_col, ""))]
        cells += [
            _cell(row.get(c, ""))
            for c in ("woreda", "zone", "region")
            if _has_col(rows, c)
        ]
        cells += [_cell(row.get(metric, "")) for metric in metric_cols]
        body_rows.append(
            "<tr>"
            + "".join(
                f"<td style='border-top:1px solid #e5e5e5;padding:5px 10px'>{c}</td>"
                for c in cells
            )
            + "</tr>"
        )

    overflow = ""
    if shown < total:
        overflow = (
            f"<tr><td style='padding:6px 10px;color:#888' colspan='{len(headers)}'>"
            f"&hellip; and {total - shown} more</td></tr>"
        )

    return (
        f"<table style='border-collapse:collapse;width:100%;font-size:13px'>"
        f"<thead><tr>{header_row}</tr></thead>"
        f"<tbody>{''.join(body_rows)}{overflow}</tbody></table>"
    )


def _has_col(rows: list[Any], name: str) -> bool:
    return name in row_keys(rows)
