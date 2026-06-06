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
"""Generate analytics reports from GitHub metadata for devin-autofix runs.

Produces:
  - automation_report.html
  - automation_runs.csv
  - automation_runs.sqlite

Usage:
  python -m scripts.devin_autofix.report --output-dir ./report_output
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import pathlib
import sqlite3
from datetime import datetime, timezone
from typing import Any

import requests

from scripts.devin_autofix.github_state import (
    get_issue_comments,
    GITHUB_API,
    parse_marker,
    REPO,
    RunMarker,
)

AUTOFIX_LABELS = [
    "devin-autofix/in-progress",
    "devin-autofix/waiting-review",
    "devin-autofix/returned-human",
    "devin-autofix/merged",
    "devin-autofix/reverted",
    "devin-autofix/complete",
]


def _headers() -> dict[str, str]:
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _search_issues_with_autofix_labels() -> list[dict[str, Any]]:
    """Find all issues that have any devin-autofix label."""
    seen: set[int] = set()
    results: list[dict[str, Any]] = []

    for label in AUTOFIX_LABELS:
        page = 1
        while True:
            resp = requests.get(
                f"{GITHUB_API}/repos/{REPO}/issues",
                headers=_headers(),
                params={
                    "labels": label,
                    "state": "all",
                    "per_page": str(100),
                    "page": str(page),
                },
                timeout=30,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            for issue in batch:
                if issue["number"] not in seen and "pull_request" not in issue:
                    seen.add(issue["number"])
                    results.append(issue)
            page += 1

    return results


def _get_all_markers_for_issue(issue_number: int) -> list[RunMarker]:
    """Get the latest marker per run_id for an issue (captures retries)."""
    comments = get_issue_comments(issue_number)
    latest_by_run: dict[str, RunMarker] = {}
    for comment in comments:
        marker = parse_marker(comment.get("body", ""))
        if marker and marker.run_id:
            latest_by_run[marker.run_id] = marker
    return list(latest_by_run.values())


def _get_pr_details(pr_number: int) -> dict[str, Any] | None:
    """Fetch PR details."""
    try:
        resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        result: dict[str, Any] = resp.json()
        return result
    except requests.HTTPError:
        return None


def _get_pr_reviews(pr_number: int) -> list[dict[str, Any]]:
    """Fetch reviews for a PR."""
    try:
        resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}/reviews",
            headers=_headers(),
            params={"per_page": "100"},
            timeout=30,
        )
        resp.raise_for_status()
        result: list[dict[str, Any]] = resp.json()
        return result
    except requests.HTTPError:
        return []


def _get_pr_checks(pr_number: int) -> list[dict[str, str]]:
    """Fetch check runs for a PR head commit."""
    try:
        resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        pr = resp.json()
        head_sha = pr["head"]["sha"]

        checks_resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/commits/{head_sha}/check-runs",
            headers=_headers(),
            params={"per_page": "100"},
            timeout=30,
        )
        checks_resp.raise_for_status()
        check_runs = checks_resp.json().get("check_runs", [])
        return [
            {
                "name": cr["name"],
                "conclusion": cr.get("conclusion") or cr.get("status", "pending"),
            }
            for cr in check_runs
        ]
    except requests.HTTPError:
        return []


def _parse_iso(ts: str | None) -> datetime | None:
    """Parse an ISO timestamp string."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _seconds_between(start: datetime | None, end: datetime | None) -> int | None:
    if start and end:
        return int((end - start).total_seconds())
    return None


def _format_duration(seconds: int | None) -> str:
    """Format seconds into a human-readable duration with appropriate units."""
    if seconds is None:
        return "N/A"
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds / 60:.1f} min"
    if seconds < 86400:
        return f"{seconds / 3600:.1f} hr"
    if seconds < 604800:
        return f"{seconds / 86400:.1f} days"
    return f"{seconds / 604800:.1f} weeks"


def _resolve_status(marker: RunMarker, issue_labels: set[str]) -> str:
    """Determine final status from marker status and issue labels."""
    if "devin-autofix/merged" in issue_labels:
        return "merged"
    if "devin-autofix/complete" in issue_labels:
        return "merged"
    if "devin-autofix/reverted" in issue_labels:
        return "reverted"
    if marker.status == "complete":
        return "merged"
    return marker.status


def _classify_ci(checks: list[dict[str, str]]) -> str:
    """Classify overall CI result from individual check conclusions."""
    if not checks:
        return "N/A"
    passed_conclusions = ("success", "skipped")
    failed = sum(1 for c in checks if c["conclusion"] == "failure")
    if failed > 0:
        return "failed"
    if all(c["conclusion"] in passed_conclusions for c in checks):
        return "passed"
    return "pending"


def _get_issue_type(issue: dict[str, Any]) -> str:
    """Extract issue type label."""
    type_labels = ("bug", "feature", "refactor", "docs")
    return next(
        (lbl["name"] for lbl in issue.get("labels", []) if lbl["name"] in type_labels),
        "unknown",
    )


def _build_row_for_marker(
    marker: RunMarker,
    issue: dict[str, Any],
    issue_labels: set[str],
) -> dict[str, Any]:
    """Build a single analytics row from one marker."""
    status = _resolve_status(marker, issue_labels)
    pr_number = marker.pr_number
    pr_url = marker.pr_url
    pr_created_at: str | None = None
    merged_at: str | None = None
    review_outcome: str | None = None

    if pr_number:
        pr_details = _get_pr_details(pr_number)
        if pr_details:
            pr_created_at = pr_details.get("created_at")
            merged_at = pr_details.get("merged_at")
            if pr_details.get("merged"):
                status = "merged"
        reviews = _get_pr_reviews(pr_number)
        for review in reversed(reviews):
            state = review.get("state", "")
            if state in (
                "APPROVED",
                "CHANGES_REQUESTED",
                "DISMISSED",
            ):
                review_outcome = state.lower()
                break
        if review_outcome is None and status == "merged":
            review_outcome = "approved"

    checks: list[dict[str, str]] = []
    if pr_number:
        checks = _get_pr_checks(pr_number)

    triggered_at = marker.created_at
    time_to_pr = _seconds_between(_parse_iso(triggered_at), _parse_iso(pr_created_at))
    time_to_merge = _seconds_between(_parse_iso(triggered_at), _parse_iso(merged_at))

    return {
        "run_id": marker.run_id,
        "issue_number": issue["number"],
        "issue_type": _get_issue_type(issue),
        "issue_title": issue.get("title", ""),
        "issue_url": issue["html_url"],
        "triggered_by": marker.triggered_by,
        "status": status,
        "devin_session_url": marker.devin_session_url,
        "pr_number": pr_number,
        "pr_url": pr_url,
        "acceptance_criteria_source": (marker.acceptance_criteria_source),
        "reviewer_login": marker.reviewer_login,
        "review_requested": 1 if marker.review_requested else 0,
        "checks_total": len(checks),
        "checks_passed": sum(1 for c in checks if c["conclusion"] == "success"),
        "checks_failed": sum(1 for c in checks if c["conclusion"] == "failure"),
        "ci_result": _classify_ci(checks),
        "review_outcome": review_outcome,
        "merged": 1 if status == "merged" else 0,
        "return_reason": (
            marker.review_request_error
            if marker.status == "returned_to_human"
            else None
        ),
        "triggered_at": triggered_at,
        "pr_created_at": pr_created_at,
        "merged_at": merged_at,
        "reverted_at": None,
        "time_to_pr_seconds": time_to_pr,
        "time_to_merge_seconds": time_to_merge,
    }


_STATUS_PRIORITY: dict[str, int] = {
    "merged": 0,
    "reverted": 1,
    "waiting_review": 2,
    "in_progress": 3,
    "returned_to_human": 4,
}


def _pick_best_row(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Pick the most representative row for an issue.

    Prefers merged > reverted > waiting_review > in_progress > returned_to_human.
    """
    return min(
        rows,
        key=lambda r: (
            _STATUS_PRIORITY.get(r["status"], 99),
            0 if r.get("pr_number") else 1,
        ),
    )


def build_run_rows(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build analytics rows from issue metadata.

    Returns one row per issue, picking the most representative run.
    """
    rows: list[dict[str, Any]] = []

    for issue in issues:
        issue_number = issue["number"]
        markers = _get_all_markers_for_issue(issue_number)
        if not markers:
            continue

        issue_labels = {lbl["name"] for lbl in issue.get("labels", [])}

        candidate_rows = [
            _build_row_for_marker(marker, issue, issue_labels) for marker in markers
        ]
        rows.append(_pick_best_row(candidate_rows))

    return rows


def write_sqlite(rows: list[dict[str, Any]], output_path: pathlib.Path) -> None:
    """Write rows to a SQLite database."""
    schema_path = pathlib.Path(__file__).parent / "schema.sql"
    schema_sql = schema_path.read_text()

    db_path = output_path / "automation_runs.sqlite"
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.executescript(schema_sql)

    columns = [
        "run_id",
        "issue_number",
        "issue_type",
        "issue_title",
        "issue_url",
        "triggered_by",
        "status",
        "devin_session_url",
        "pr_number",
        "pr_url",
        "acceptance_criteria_source",
        "reviewer_login",
        "review_requested",
        "checks_total",
        "checks_passed",
        "checks_failed",
        "review_outcome",
        "return_reason",
        "triggered_at",
        "pr_created_at",
        "merged_at",
        "reverted_at",
        "time_to_pr_seconds",
        "time_to_merge_seconds",
    ]

    placeholders = ", ".join(["?"] * len(columns))
    col_names = ", ".join(columns)

    # Columns are hardcoded above, not from user input
    stmt = "INSERT OR REPLACE INTO automation_runs (%s) VALUES (%s)"  # noqa: S608
    stmt = stmt % (col_names, placeholders)
    for row in rows:
        values = [row.get(col) for col in columns]
        cursor.execute(stmt, values)

    conn.commit()
    conn.close()
    print(f"SQLite database written to {db_path}")


def write_csv(rows: list[dict[str, Any]], output_path: pathlib.Path) -> None:
    """Write rows to a CSV file."""
    csv_path = output_path / "automation_runs.csv"
    if not rows:
        csv_path.write_text("")
        return

    fieldnames = list(rows[0].keys())
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"CSV written to {csv_path}")


def _compute_kpis(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute summary KPIs from run rows."""
    total = len(rows)
    active = sum(1 for r in rows if r["status"] in ("in_progress", "waiting_review"))
    merged = sum(1 for r in rows if r["status"] == "merged")
    reverted = sum(1 for r in rows if r["status"] == "reverted")
    returned = sum(1 for r in rows if r["status"] == "returned_to_human")

    total_checks = sum(r.get("checks_total") or 0 for r in rows)
    passed_checks = sum(r.get("checks_passed") or 0 for r in rows)
    check_pass_rate = (
        round(passed_checks / total_checks * 100, 1) if total_checks > 0 else None
    )

    with_pr = sum(1 for r in rows if r.get("pr_number"))
    approved = sum(1 for r in rows if r.get("review_outcome") == "approved")
    approval_rate = round(approved / with_pr * 100, 1) if with_pr > 0 else None

    merge_rate = round(merged / total * 100, 1) if total > 0 else None
    revert_rate = round(reverted / merged * 100, 1) if merged > 0 else None

    pr_times = [r["time_to_pr_seconds"] for r in rows if r.get("time_to_pr_seconds")]
    avg_to_pr_seconds = int(sum(pr_times) / len(pr_times)) if pr_times else None

    merge_times = [
        r["time_to_merge_seconds"] for r in rows if r.get("time_to_merge_seconds")
    ]
    avg_to_merge_seconds = (
        int(sum(merge_times) / len(merge_times)) if merge_times else None
    )

    return {
        "total": total,
        "active": active,
        "merged": merged,
        "reverted": reverted,
        "returned": returned,
        "check_pass_rate": check_pass_rate,
        "approval_rate": approval_rate,
        "merge_rate": merge_rate,
        "revert_rate": revert_rate,
        "avg_to_pr": _format_duration(avg_to_pr_seconds),
        "avg_to_merge": _format_duration(avg_to_merge_seconds),
    }


def _build_status_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    """Count rows by status for charting."""
    counts: dict[str, int] = {}
    for r in rows:
        s = r["status"]
        counts[s] = counts.get(s, 0) + 1
    return counts


def write_html(rows: list[dict[str, Any]], output_path: pathlib.Path) -> None:
    """Generate an HTML analytics report with charts and filterable table."""
    html_path = output_path / "automation_report.html"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    kpi = _compute_kpis(rows)
    status_counts = _build_status_counts(rows)

    # Prepare table data as JSON for JavaScript filtering
    table_rows = []
    for r in rows:
        table_rows.append(
            {
                "issue_type": r.get("issue_type", "unknown"),
                "issue_title": r.get("issue_title", ""),
                "issue_url": r.get("issue_url", ""),
                "issue_number": r.get("issue_number"),
                "pr_url": r.get("pr_url", ""),
                "pr_number": r.get("pr_number"),
                "status": r.get("status", ""),
                "ci_result": r.get("ci_result", "N/A"),
                "review_outcome": r.get("review_outcome") or "N/A",
                "merged": bool(r.get("merged")),
                "triggered_at": r.get("triggered_at", ""),
            }
        )

    table_json = json.dumps(table_rows)
    status_json = json.dumps(status_counts)

    # Reviewer outcome counts for chart
    review_counts: dict[str, int] = {}
    for r in rows:
        outcome = r.get("review_outcome") or "pending"
        review_counts[outcome] = review_counts.get(outcome, 0) + 1
    review_labels_json = json.dumps(list(review_counts.keys()))
    review_values_json = json.dumps(list(review_counts.values()))

    # KPI values for Chart.js
    kpi_labels = json.dumps(["Merged", "Reverted", "Returned", "Active", "Other"])
    other_count = kpi["total"] - (
        kpi["merged"] + kpi["reverted"] + kpi["returned"] + kpi["active"]
    )
    kpi_values = json.dumps(
        [
            kpi["merged"],
            kpi["reverted"],
            kpi["returned"],
            kpi["active"],
            max(other_count, 0),
        ]
    )

    check_pass_rate = (
        kpi["check_pass_rate"] if kpi["check_pass_rate"] is not None else 0
    )
    approval_rate = kpi["approval_rate"] if kpi["approval_rate"] is not None else 0
    merge_rate = kpi["merge_rate"] if kpi["merge_rate"] is not None else 0

    # Pre-compute display strings to keep template lines short
    merge_rate_display = f"{merge_rate}%" if kpi["merge_rate"] is not None else "N/A"
    ci_rate_display = (
        f"{check_pass_rate}%" if kpi["check_pass_rate"] is not None else "N/A"
    )
    approval_display = (
        f"{approval_rate}%" if kpi["approval_rate"] is not None else "N/A"
    )
    revert_display = (
        f"{kpi['revert_rate']}%" if kpi["revert_rate"] is not None else "N/A"
    )

    content = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Devin Autofix Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa;
    color: #1a1a2e;
    padding: 24px;
  }}
  h1 {{
    font-size: 1.8rem;
    margin-bottom: 4px;
  }}
  .subtitle {{
    color: #6b7280;
    font-size: 0.9rem;
    margin-bottom: 24px;
  }}
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }}
  .kpi-card {{
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    text-align: center;
  }}
  .kpi-card .value {{
    font-size: 2rem;
    font-weight: 700;
    color: #2563eb;
  }}
  .kpi-card .label {{
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .charts-row {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-bottom: 32px;
  }}
  .chart-card {{
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }}
  .chart-card h3 {{
    font-size: 1rem;
    margin-bottom: 16px;
    color: #374151;
  }}
  .chart-card canvas {{
    max-height: 260px;
  }}
  .table-section {{
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }}
  .table-section h2 {{
    font-size: 1.2rem;
    margin-bottom: 16px;
  }}
  .filters {{
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }}
  .filters select {{
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    background: #fff;
  }}
  .table-wrap {{
    overflow-x: auto;
    max-height: 600px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }}
  thead {{
    position: sticky;
    top: 0;
    background: #f9fafb;
    z-index: 1;
  }}
  th, td {{
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
  }}
  th {{
    font-weight: 600;
    color: #374151;
  }}
  tr:hover {{
    background: #f3f4f6;
  }}
  a {{
    color: #2563eb;
    text-decoration: none;
  }}
  a:hover {{
    text-decoration: underline;
  }}
  .badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }}
  .badge-merged {{ background: #d1fae5; color: #065f46; }}
  .badge-reverted {{ background: #fee2e2; color: #991b1b; }}
  .badge-active {{ background: #dbeafe; color: #1e40af; }}
  .badge-returned {{ background: #fef3c7; color: #92400e; }}
  .badge-passed {{ background: #d1fae5; color: #065f46; }}
  .badge-failed {{ background: #fee2e2; color: #991b1b; }}
  .badge-pending {{ background: #e5e7eb; color: #374151; }}
  .badge-na {{ background: #f3f4f6; color: #6b7280; }}
  @media (max-width: 768px) {{
    .charts-row {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
<h1>Devin Autofix Analytics Report</h1>
<p class="subtitle">Generated: {now}</p>

<div class="kpi-grid">
  <div class="kpi-card">
    <div class="value">{kpi["total"]}</div>
    <div class="label">Total Attempts</div>
  </div>
  <div class="kpi-card">
    <div class="value">{kpi["merged"]}</div>
    <div class="label">Merged</div>
  </div>
  <div class="kpi-card">
    <div class="value">{merge_rate_display}</div>
    <div class="label">Merge Rate</div>
  </div>
  <div class="kpi-card">
    <div class="value">{ci_rate_display}</div>
    <div class="label">CI Pass Rate</div>
  </div>
  <div class="kpi-card">
    <div class="value">{approval_display}</div>
    <div class="label">Approval Rate</div>
  </div>
  <div class="kpi-card">
    <div class="value">{revert_display}</div>
    <div class="label">Revert Rate</div>
  </div>
  <div class="kpi-card">
    <div class="value">{kpi["avg_to_pr"]}</div>
    <div class="label">Avg Trigger &rarr; PR</div>
  </div>
  <div class="kpi-card">
    <div class="value">{kpi["avg_to_merge"]}</div>
    <div class="label">Avg Trigger &rarr; Merge</div>
  </div>
</div>

<div class="charts-row">
  <div class="chart-card">
    <h3>Run Outcomes</h3>
    <canvas id="outcomeChart"></canvas>
  </div>
  <div class="chart-card">
    <h3>Success Rates</h3>
    <canvas id="ratesChart"></canvas>
  </div>
  <div class="chart-card">
    <h3>Reviewer Outcomes</h3>
    <canvas id="reviewChart"></canvas>
  </div>
</div>

<div class="table-section">
  <h2>Last 7 Days Activity</h2>
  <div class="filters">
    <select id="filter-status">
      <option value="">All Statuses</option>
    </select>
    <select id="filter-issue-type">
      <option value="">All Issue Types</option>
    </select>
    <select id="filter-ci">
      <option value="">All CI Results</option>
    </select>
    <select id="filter-review">
      <option value="">All Review Outcomes</option>
    </select>
    <select id="filter-merged">
      <option value="">All Merged</option>
      <option value="true">Merged</option>
      <option value="false">Not Merged</option>
    </select>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Issue Type</th>
          <th>Summary</th>
          <th>Issue</th>
          <th>PR</th>
          <th>Status</th>
          <th>CI Result</th>
          <th>Reviewer Outcome</th>
          <th>Merged</th>
        </tr>
      </thead>
      <tbody id="activity-table"></tbody>
    </table>
  </div>
</div>

<script>
const ALL_ROWS = {table_json};
const STATUS_COUNTS = {status_json};

// --- Charts ---
const outcomeCtx = document.getElementById('outcomeChart').getContext('2d');
new Chart(outcomeCtx, {{
  type: 'doughnut',
  data: {{
    labels: {kpi_labels},
    datasets: [{{
      data: {kpi_values},
      backgroundColor: ['#10b981','#ef4444','#f59e0b','#3b82f6','#9ca3af'],
    }}]
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ position: 'bottom' }}
    }}
  }}
}});

const ratesCtx = document.getElementById('ratesChart').getContext('2d');
new Chart(ratesCtx, {{
  type: 'bar',
  data: {{
    labels: ['CI Pass Rate', 'Approval Rate', 'Merge Rate'],
    datasets: [{{
      label: '%',
      data: [{check_pass_rate}, {approval_rate}, {merge_rate}],
      backgroundColor: ['#6366f1','#8b5cf6','#10b981'],
      borderRadius: 6,
    }}]
  }},
  options: {{
    responsive: true,
    scales: {{
      y: {{ beginAtZero: true, max: 100 }}
    }},
    plugins: {{
      legend: {{ display: false }}
    }}
  }}
}});

const reviewCtx = document.getElementById('reviewChart').getContext('2d');
new Chart(reviewCtx, {{
  type: 'doughnut',
  data: {{
    labels: {review_labels_json},
    datasets: [{{
      data: {review_values_json},
      backgroundColor: [
        '#10b981','#ef4444','#f59e0b','#6366f1','#9ca3af'
      ],
    }}]
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ position: 'bottom' }}
    }}
  }}
}});

// --- Table Filtering ---
const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const sevenDaysAgo = new Date(Date.now() - msPerWeek);
const recentRows = ALL_ROWS.filter(r =>
  !r.triggered_at || r.triggered_at >= sevenDaysAgo.toISOString()
);

function populateFilterOptions() {{
  const sets = {{
    status: new Set(),
    issue_type: new Set(),
    ci_result: new Set(),
    review_outcome: new Set(),
  }};
  recentRows.forEach(r => {{
    sets.status.add(r.status);
    sets.issue_type.add(r.issue_type);
    sets.ci_result.add(r.ci_result);
    sets.review_outcome.add(r.review_outcome);
  }});
  const addOpts = (id, vals) => {{
    const sel = document.getElementById(id);
    [...vals].sort().forEach(v => {{
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }});
  }};
  addOpts('filter-status', sets.status);
  addOpts('filter-issue-type', sets.issue_type);
  addOpts('filter-ci', sets.ci_result);
  addOpts('filter-review', sets.review_outcome);
}}

function badgeClass(s) {{
  const map = {{
    merged: 'badge-merged', passed: 'badge-merged',
    approved: 'badge-merged',
    reverted: 'badge-failed', failed: 'badge-failed',
    changes_requested: 'badge-failed',
    in_progress: 'badge-active',
    waiting_review: 'badge-active',
    returned_to_human: 'badge-returned',
    pending: 'badge-pending',
  }};
  return map[s] || 'badge-na';
}}

function renderTable() {{
  const fStatus = document.getElementById('filter-status').value;
  const fType = document.getElementById('filter-issue-type').value;
  const fCI = document.getElementById('filter-ci').value;
  const fReview = document.getElementById('filter-review').value;
  const fMerged = document.getElementById('filter-merged').value;

  const filtered = recentRows.filter(r => {{
    if (fStatus && r.status !== fStatus) return false;
    if (fType && r.issue_type !== fType) return false;
    if (fCI && r.ci_result !== fCI) return false;
    if (fReview && r.review_outcome !== fReview) return false;
    if (fMerged === 'true' && !r.merged) return false;
    if (fMerged === 'false' && r.merged) return false;
    return true;
  }});

  const tbody = document.getElementById('activity-table');
  const trunc = (s, n) => s.length > n ? s.slice(0, n) + '...' : s;
  const prLink = r => r.pr_url
    ? `<a href="${{r.pr_url}}" target="_blank">#${{r.pr_number}}</a>`
    : '\u2014';
  const badge = (v) =>
    `<span class="badge ${{badgeClass(v)}}">${{v}}</span>`;
  tbody.innerHTML = filtered.map(r => `<tr>
    <td>${{r.issue_type}}</td>
    <td>${{trunc(r.issue_title, 60)}}</td>
    <td><a href="${{r.issue_url}}" target="_blank">#${{r.issue_number}}</a></td>
    <td>${{prLink(r)}}</td>
    <td>${{badge(r.status)}}</td>
    <td>${{badge(r.ci_result)}}</td>
    <td>${{badge(r.review_outcome)}}</td>
    <td>${{r.merged ? 'Yes' : 'No'}}</td>
  </tr>`).join('');
}}

populateFilterOptions();
renderTable();

document.querySelectorAll('.filters select').forEach(sel => {{
  sel.addEventListener('change', renderTable);
}});
</script>
</body>
</html>
"""

    html_path.write_text(content)
    print(f"HTML report written to {html_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate autofix analytics report")
    parser.add_argument(
        "--output-dir",
        default="report_output",
        help="Directory to write report artifacts",
    )
    args = parser.parse_args()

    output_path = pathlib.Path(args.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("Fetching issues with autofix labels...")
    issues = _search_issues_with_autofix_labels()
    print(f"Found {len(issues)} issues")

    print("Building run data...")
    rows = build_run_rows(issues)
    print(f"Built {len(rows)} run rows")

    write_sqlite(rows, output_path)
    write_csv(rows, output_path)
    write_html(rows, output_path)

    print(f"\nReport artifacts written to {output_path}/")


if __name__ == "__main__":
    main()
