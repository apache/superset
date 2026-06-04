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
"""Monitor active Devin autofix sessions and update GitHub state.

Polls the Devin API for each active run, detects PRs, comments PR links
on issues, requests reviewers, and updates labels/markers.

Usage:
  python -m scripts.devin_autofix.monitor_sessions
"""

from __future__ import annotations

import os
from typing import Any

import requests

from scripts.devin_autofix.github_state import (
    ACTIVE_STATUSES,
    add_label,
    get_issue_comments,
    get_open_issues_with_label,
    GITHUB_API,
    parse_marker,
    post_comment,
    remove_label,
    REPO,
    RunMarker,
)
from scripts.devin_autofix.reviewers import request_review

DEVIN_API = "https://api.devin.ai/v3"

TERMINAL_STATUSES = frozenset({"exit", "error"})
TERMINAL_DETAILS = frozenset(
    {
        "finished",
        "inactivity",
        "user_request",
        "usage_limit_exceeded",
    }
)


def _devin_headers() -> dict[str, str]:
    api_key = os.environ["DEVIN_API_KEY"]
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _github_headers() -> dict[str, str]:
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_devin_session(session_id: str) -> dict[str, Any]:
    """Fetch a Devin session by ID."""
    org_id = os.environ["DEVIN_ORG_ID"]
    devin_id = session_id if session_id.startswith("devin-") else f"devin-{session_id}"
    resp = requests.get(
        f"{DEVIN_API}/organizations/{org_id}/sessions/{devin_id}",
        headers=_devin_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    result: dict[str, Any] = resp.json()
    return result


def get_pr_checks(pr_number: int) -> list[dict[str, str]]:
    """Fetch check runs for a PR's head commit."""
    # Get PR details for head SHA
    resp = requests.get(
        f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}",
        headers=_github_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    pr = resp.json()
    head_sha = pr["head"]["sha"]

    # Fetch check runs
    checks_resp = requests.get(
        f"{GITHUB_API}/repos/{REPO}/commits/{head_sha}/check-runs",
        headers=_github_headers(),
        params={"per_page": "100"},
        timeout=30,
    )
    checks_resp.raise_for_status()
    check_runs = checks_resp.json().get("check_runs", [])

    results: list[dict[str, str]] = []
    for cr in check_runs:
        results.append(
            {
                "name": cr["name"],
                "conclusion": cr.get("conclusion") or cr.get("status", "pending"),
            }
        )
    return results


def _find_issues_with_active_runs() -> list[int]:
    """Find issue numbers that have active autofix runs."""
    issue_numbers: set[int] = set()

    for label in ["devin-autofix/in-progress", "devin-autofix/waiting-review"]:
        issues = get_open_issues_with_label(label)
        for issue in issues:
            # Skip pull requests (they also appear in issue search)
            if "pull_request" not in issue:
                issue_numbers.add(issue["number"])

    return sorted(issue_numbers)


def _get_latest_marker(issue_number: int) -> tuple[RunMarker | None, int | None]:
    """Get the latest active marker and its comment ID for an issue."""
    comments = get_issue_comments(issue_number)
    latest_marker: RunMarker | None = None
    latest_comment_id: int | None = None

    for comment in reversed(comments):
        marker = parse_marker(comment.get("body", ""))
        if marker and marker.status in ACTIVE_STATUSES:
            latest_marker = marker
            latest_comment_id = comment["id"]
            break

    return latest_marker, latest_comment_id


def _handle_returned_to_human(
    issue_number: int,
    marker: RunMarker,
    session: dict[str, Any],
) -> None:
    """Mark a run as returned-to-human when Devin finishes without a PR."""
    structured = session.get("structured_output")
    return_reason = "Devin session ended without opening a PR."
    if structured and isinstance(structured, dict):
        return_reason = structured.get("return_reason") or return_reason

    marker.status = "returned_to_human"
    body = (
        f"⚠️ **Devin Autofix** — returned to human\n\n"
        f"- **Reason:** {return_reason}\n"
        f"- **Session:** [link]({marker.devin_session_url})\n\n"
        f"{marker.to_marker()}"
    )
    post_comment(issue_number, body)
    remove_label(issue_number, "devin-autofix/in-progress")
    add_label(issue_number, "devin-autofix/returned-human")
    print(f"  Run {marker.run_id} returned to human: {return_reason}")


def _handle_new_pr(
    issue_number: int,
    marker: RunMarker,
    pull_requests: list[dict[str, Any]],
) -> None:
    """Link a newly detected PR to the issue and request review."""
    pr_info = pull_requests[0]
    pr_url = pr_info.get("url", "")
    pr_number = pr_info.get("number")

    if not pr_number and pr_url:
        parts = pr_url.rstrip("/").split("/")
        try:
            pr_number = int(parts[-1])
        except (ValueError, IndexError):
            pass

    if not pr_number:
        return

    marker.pr_number = pr_number
    marker.pr_url = pr_url
    marker.pr_link_commented = True

    pr_body = (
        f"🔗 **Devin Autofix** — PR opened\n\n"
        f"- **Pull Request:** [#{pr_number}]({pr_url})\n"
        f"- **Session:** [link]({marker.devin_session_url})\n\n"
        f"{marker.to_marker()}"
    )
    post_comment(issue_number, pr_body)

    review_result = request_review(
        pr_number=pr_number,
        triggered_by=marker.triggered_by,
    )
    marker.review_requested = review_result["review_requested"]
    marker.reviewer_login = review_result.get("reviewer_login")
    if review_result.get("error"):
        marker.review_request_error = review_result["error"]

    try:
        marker.checks = get_pr_checks(pr_number)
    except Exception as exc:
        print(f"  Error fetching checks for PR #{pr_number}: {exc}")

    remove_label(issue_number, "devin-autofix/in-progress")
    add_label(issue_number, "devin-autofix/waiting-review")
    marker.status = "waiting_review"

    print(
        f"  PR #{pr_number} linked to issue #{issue_number}, "
        f"review requested: {marker.review_requested}"
    )


def process_run(issue_number: int, marker: RunMarker) -> None:
    """Process a single active autofix run."""
    if not marker.devin_session_id:
        print(f"  No session ID for run {marker.run_id}, skipping")
        return

    try:
        session = get_devin_session(marker.devin_session_id)
    except requests.HTTPError as exc:
        print(f"  Error fetching session {marker.devin_session_id}: {exc}")
        return

    session_status = session.get("status", "")
    status_detail = session.get("status_detail", "")
    pull_requests = session.get("pull_requests", [])

    print(
        f"  Session {marker.devin_session_id}: "
        f"status={session_status}, detail={status_detail}, "
        f"PRs={len(pull_requests)}"
    )

    is_terminal = session_status in TERMINAL_STATUSES
    if is_terminal and not pull_requests and marker.status == "in_progress":
        _handle_returned_to_human(issue_number, marker, session)
        return

    if pull_requests and not marker.pr_link_commented:
        _handle_new_pr(issue_number, marker, pull_requests)
    elif marker.pr_number and marker.status == "waiting_review":
        try:
            checks = get_pr_checks(marker.pr_number)
            marker.checks = checks

            failed = [c for c in checks if c["conclusion"] == "failure"]
            if failed:
                check_names = ", ".join(c["name"] for c in failed[:5])
                check_body = (
                    f"⚠️ **Devin Autofix** — some checks failed\n\n"
                    f"- **Failed checks:** {check_names}\n"
                    f"- **PR:** [#{marker.pr_number}]({marker.pr_url})\n\n"
                    f"{marker.to_marker()}"
                )
                post_comment(issue_number, check_body)
        except Exception as exc:
            print(f"  Error updating checks for PR #{marker.pr_number}: {exc}")


def main() -> None:
    print("Scanning for active autofix runs...")
    issue_numbers = _find_issues_with_active_runs()
    print(f"Found {len(issue_numbers)} issues with active runs")

    for issue_number in issue_numbers:
        print(f"\nProcessing issue #{issue_number}")
        marker, _ = _get_latest_marker(issue_number)
        if not marker:
            print("  No active marker found, skipping")
            continue
        process_run(issue_number, marker)

    print("\nMonitor run complete.")


if __name__ == "__main__":
    main()
