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
  - automation_report.md
  - automation_runs.csv
  - automation_runs.sqlite

Usage:
  python -m scripts.devin_autofix.report --output-dir ./report_output
"""

from __future__ import annotations

import argparse
import csv
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


def _get_latest_marker_for_issue(issue_number: int) -> RunMarker | None:
    """Get the most recent marker for an issue."""
    comments = get_issue_comments(issue_number)
    latest: RunMarker | None = None
    for comment in comments:
        marker = parse_marker(comment.get("body", ""))
        if marker:
            latest = marker
    return latest


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


def build_run_rows(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build analytics rows from issue metadata."""
    rows: list[dict[str, Any]] = []

    for issue in issues:
        issue_number = issue["number"]
        marker = _get_latest_marker_for_issue(issue_number)
        if not marker:
            continue

        # Determine final status
        issue_labels = {lbl["name"] for lbl in issue.get("labels", [])}
        status = marker.status
        if "devin-autofix/merged" in issue_labels:
            status = "merged"
        elif "devin-autofix/reverted" in issue_labels:
            status = "reverted"

        # PR details
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

            # Reviews
            reviews = _get_pr_reviews(pr_number)
            for review in reversed(reviews):
                state = review.get("state", "")
                if state in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED"):
                    review_outcome = state.lower()
                    break

        # Checks
        checks: list[dict[str, str]] = []
        if pr_number:
            checks = _get_pr_checks(pr_number)

        checks_total = len(checks)
        checks_passed = sum(1 for c in checks if c["conclusion"] == "success")
        checks_failed = sum(1 for c in checks if c["conclusion"] == "failure")

        # Timing
        triggered_at = marker.created_at
        time_to_pr = _seconds_between(
            _parse_iso(triggered_at), _parse_iso(pr_created_at)
        )
        time_to_merge = _seconds_between(
            _parse_iso(triggered_at), _parse_iso(merged_at)
        )

        rows.append(
            {
                "run_id": marker.run_id,
                "issue_number": issue_number,
                "issue_type": next(
                    (
                        lbl["name"]
                        for lbl in issue.get("labels", [])
                        if lbl["name"] in ("bug", "feature", "refactor", "docs")
                    ),
                    "unknown",
                ),
                "issue_title": issue.get("title", ""),
                "issue_url": issue["html_url"],
                "triggered_by": marker.triggered_by,
                "status": status,
                "devin_session_url": marker.devin_session_url,
                "pr_number": pr_number,
                "pr_url": pr_url,
                "acceptance_criteria_source": marker.acceptance_criteria_source,
                "reviewer_login": marker.reviewer_login,
                "review_requested": 1 if marker.review_requested else 0,
                "checks_total": checks_total,
                "checks_passed": checks_passed,
                "checks_failed": checks_failed,
                "review_outcome": review_outcome,
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
        )

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

    total_checks = sum(r.get("checks_total") or 0 for r in rows)
    passed_checks = sum(r.get("checks_passed") or 0 for r in rows)
    check_pass_rate = (
        f"{passed_checks / total_checks * 100:.1f}%" if total_checks > 0 else "N/A"
    )

    req_count = sum(1 for r in rows if r.get("review_requested"))
    approved = sum(1 for r in rows if r.get("review_outcome") == "approved")
    approval_rate = f"{approved / req_count * 100:.1f}%" if req_count > 0 else "N/A"

    merge_rate = f"{merged / total * 100:.1f}%" if total > 0 else "N/A"
    revert_rate = f"{reverted / merged * 100:.1f}%" if merged > 0 else "N/A"

    pr_times = [r["time_to_pr_seconds"] for r in rows if r.get("time_to_pr_seconds")]
    avg_to_pr = f"{sum(pr_times) / len(pr_times) / 60:.1f} min" if pr_times else "N/A"

    merge_times = [
        r["time_to_merge_seconds"] for r in rows if r.get("time_to_merge_seconds")
    ]
    avg_to_merge = (
        f"{sum(merge_times) / len(merge_times) / 60:.1f} min" if merge_times else "N/A"
    )

    return {
        "total": total,
        "active": active,
        "check_pass_rate": check_pass_rate,
        "approval_rate": approval_rate,
        "merge_rate": merge_rate,
        "revert_rate": revert_rate,
        "avg_to_pr": avg_to_pr,
        "avg_to_merge": avg_to_merge,
    }


def _render_checks_and_reviews(rows: list[dict[str, Any]]) -> list[str]:
    """Render check-failure and review-outcome sections."""
    lines: list[str] = []

    failed_check_rows = [r for r in rows if (r.get("checks_failed") or 0) > 0]
    if failed_check_rows:
        lines.extend(
            [
                "## Check Failures",
                "",
                "| Issue | PR | Failed | Total |",
                "|-------|-----|--------|-------|",
            ]
        )
        for r in failed_check_rows:
            lines.append(
                f"| [#{r['issue_number']}]({r['issue_url']}) "
                f"| [#{r['pr_number']}]({r['pr_url']}) "
                f"| {r['checks_failed']} | {r['checks_total']} |"
            )
        lines.append("")

    reviewed_rows = [r for r in rows if r.get("review_outcome")]
    if reviewed_rows:
        lines.extend(
            [
                "## Review Outcomes",
                "",
                "| Issue | PR | Reviewer | Outcome |",
                "|-------|-----|----------|---------|",
            ]
        )
        for r in reviewed_rows:
            lines.append(
                f"| [#{r['issue_number']}]({r['issue_url']}) "
                f"| [#{r['pr_number']}]({r['pr_url']}) "
                f"| {r.get('reviewer_login') or '—'} "
                f"| {r['review_outcome']} |"
            )
        lines.append("")

    return lines


def _render_detail_sections(
    rows: list[dict[str, Any]],
) -> list[str]:
    """Render the per-section markdown tables for the report."""
    lines: list[str] = []

    # Active workflows
    active_rows = [r for r in rows if r["status"] in ("in_progress", "waiting_review")]
    if active_rows:
        lines.extend(
            [
                "## Active Workflows",
                "",
                "| Issue | Status | Session | PR |",
                "|-------|--------|---------|-----|",
            ]
        )
        for r in active_rows:
            pr_link = (
                f"[#{r['pr_number']}]({r['pr_url']})" if r.get("pr_number") else "—"
            )
            session_link = (
                f"[link]({r['devin_session_url']})"
                if r.get("devin_session_url")
                else "—"
            )
            lines.append(
                f"| [#{r['issue_number']}]({r['issue_url']}) "
                f"| {r['status']} | {session_link} | {pr_link} |"
            )
        lines.append("")

    # Completed workflows
    completed_rows = [r for r in rows if r["status"] == "merged"]
    if completed_rows:
        lines.extend(
            [
                "## Completed Workflows",
                "",
                "| Issue | PR | Time to PR | Time to Merge |",
                "|-------|-----|------------|---------------|",
            ]
        )
        for r in completed_rows:
            ttp = (
                f"{r['time_to_pr_seconds'] / 60:.1f} min"
                if r.get("time_to_pr_seconds")
                else "—"
            )
            ttm = (
                f"{r['time_to_merge_seconds'] / 60:.1f} min"
                if r.get("time_to_merge_seconds")
                else "—"
            )
            lines.append(
                f"| [#{r['issue_number']}]({r['issue_url']}) "
                f"| [#{r['pr_number']}]({r['pr_url']}) | {ttp} | {ttm} |"
            )
        lines.append("")

    # Returned to human
    returned_rows = [r for r in rows if r["status"] == "returned_to_human"]
    if returned_rows:
        lines.extend(
            [
                "## Returned to Human",
                "",
                "| Issue | Reason | Session |",
                "|-------|--------|---------|",
            ]
        )
        for r in returned_rows:
            session_link = (
                f"[link]({r['devin_session_url']})"
                if r.get("devin_session_url")
                else "—"
            )
            lines.append(
                f"| [#{r['issue_number']}]({r['issue_url']}) "
                f"| {r.get('return_reason') or '—'} | {session_link} |"
            )
        lines.append("")

    lines.extend(_render_checks_and_reviews(rows))

    # Caveats
    lines.extend(
        [
            "## Known Caveats",
            "",
            "- Report is generated from GitHub metadata and Devin session markers.",
            "- Check pass rates reflect the latest head SHA at report time.",
            "- Timing metrics use ISO timestamps from markers and GitHub API.",
            "- Revert detection relies on the `devin-autofix/reverted` label.",
            "",
        ]
    )
    return lines


def write_markdown(rows: list[dict[str, Any]], output_path: pathlib.Path) -> None:
    """Generate a markdown analytics report."""
    md_path = output_path / "automation_report.md"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    kpi = _compute_kpis(rows)

    lines = [
        "# Devin Autofix Analytics Report",
        "",
        f"Generated: {now}",
        "",
        "## Summary KPIs",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Total attempts | {kpi['total']} |",
        f"| Active attempts | {kpi['active']} |",
        f"| Check pass rate | {kpi['check_pass_rate']} |",
        f"| Review approval rate | {kpi['approval_rate']} |",
        f"| Merge rate | {kpi['merge_rate']} |",
        f"| Revert rate | {kpi['revert_rate']} |",
        f"| Avg trigger→PR | {kpi['avg_to_pr']} |",
        f"| Avg trigger→merge | {kpi['avg_to_merge']} |",
        "",
    ]

    lines.extend(_render_detail_sections(rows))
    md_path.write_text("\n".join(lines))
    print(f"Markdown report written to {md_path}")


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
    write_markdown(rows, output_path)

    print(f"\nReport artifacts written to {output_path}/")


if __name__ == "__main__":
    main()
