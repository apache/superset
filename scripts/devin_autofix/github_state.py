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
"""Shared helpers for reading and writing devin-autofix state on GitHub issues."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests

MARKER_PREFIX = "<!-- devin-autofix-run:"
MARKER_SUFFIX = "-->"
ACTIVE_STATUSES = frozenset({"in_progress", "waiting_review"})
REPO = os.environ.get("GITHUB_REPOSITORY", "vickyli1014/superset")
GITHUB_API = "https://api.github.com"


def _headers() -> dict[str, str]:
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


@dataclass
class RunMarker:
    """Parsed hidden marker from an issue comment."""

    schema_version: int = 1
    run_id: str = ""
    issue_number: int = 0
    trigger_comment_id: int = 0
    triggered_by: str = ""
    status: str = "in_progress"
    devin_session_id: str | None = None
    devin_session_url: str | None = None
    pr_number: int | None = None
    pr_url: str | None = None
    reviewer_login: str | None = None
    review_requested: bool = False
    pr_link_commented: bool = False
    acceptance_criteria_source: str = "ai_inferred"
    created_at: str = ""
    updated_at: str = ""
    review_request_error: str | None = None
    checks: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "run_id": self.run_id,
            "issue_number": self.issue_number,
            "trigger_comment_id": self.trigger_comment_id,
            "triggered_by": self.triggered_by,
            "status": self.status,
            "devin_session_id": self.devin_session_id,
            "devin_session_url": self.devin_session_url,
            "pr_number": self.pr_number,
            "pr_url": self.pr_url,
            "reviewer_login": self.reviewer_login,
            "review_requested": self.review_requested,
            "pr_link_commented": self.pr_link_commented,
            "acceptance_criteria_source": self.acceptance_criteria_source,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "review_request_error": self.review_request_error,
            "checks": self.checks,
        }

    def to_marker(self) -> str:
        self.updated_at = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(self.to_dict(), indent=2)
        return f"{MARKER_PREFIX}\n{payload}\n{MARKER_SUFFIX}"


def parse_marker(comment_body: str) -> RunMarker | None:
    """Extract the most recent marker JSON from a comment body."""
    pattern = re.compile(
        re.escape(MARKER_PREFIX) + r"\s*(\{.*?\})\s*" + re.escape(MARKER_SUFFIX),
        re.DOTALL,
    )
    match = pattern.search(comment_body)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    marker = RunMarker()
    for k, v in data.items():
        if hasattr(marker, k):
            setattr(marker, k, v)
    return marker


def get_issue_comments(issue_number: int) -> list[dict[str, Any]]:
    """Fetch all comments on an issue."""
    comments: list[dict[str, Any]] = []
    page = 1
    while True:
        resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/issues/{issue_number}/comments",
            headers=_headers(),
            params={"per_page": "100", "page": str(page)},
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        comments.extend(batch)
        page += 1
    return comments


def find_active_markers(issue_number: int) -> list[RunMarker]:
    """Return markers for runs whose latest status is still active.

    Multiple comments may reference the same ``run_id`` (e.g. a "run started"
    comment followed by a "returned to human" comment).  Only the **last**
    marker per ``run_id`` determines whether the run is active.
    """
    comments = get_issue_comments(issue_number)

    # Keep the last marker seen for each run_id (comments are chronological).
    latest_by_run: dict[str, RunMarker] = {}
    for comment in comments:
        marker = parse_marker(comment.get("body", ""))
        if marker and marker.run_id:
            latest_by_run[marker.run_id] = marker

    return [m for m in latest_by_run.values() if m.status in ACTIVE_STATUSES]


def find_all_markers(issue_number: int) -> list[RunMarker]:
    """Return all run markers for an issue (any status)."""
    comments = get_issue_comments(issue_number)
    markers: list[RunMarker] = []
    for comment in comments:
        marker = parse_marker(comment.get("body", ""))
        if marker:
            markers.append(marker)
    return markers


def post_comment(issue_number: int, body: str) -> dict[str, Any]:
    """Post a comment on an issue."""
    resp = requests.post(
        f"{GITHUB_API}/repos/{REPO}/issues/{issue_number}/comments",
        headers=_headers(),
        json={"body": body},
        timeout=30,
    )
    resp.raise_for_status()
    result: dict[str, Any] = resp.json()
    return result


def add_label(issue_number: int, label: str) -> None:
    """Add a label to an issue, creating it if needed."""
    resp = requests.post(
        f"{GITHUB_API}/repos/{REPO}/issues/{issue_number}/labels",
        headers=_headers(),
        json={"labels": [label]},
        timeout=30,
    )
    resp.raise_for_status()


def remove_label(issue_number: int, label: str) -> None:
    """Remove a label from an issue (no-op if absent)."""
    resp = requests.delete(
        f"{GITHUB_API}/repos/{REPO}/issues/{issue_number}/labels/{label}",
        headers=_headers(),
        timeout=30,
    )
    if resp.status_code != 404:
        resp.raise_for_status()


def get_issue(issue_number: int) -> dict[str, Any]:
    """Fetch a single issue."""
    resp = requests.get(
        f"{GITHUB_API}/repos/{REPO}/issues/{issue_number}",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    result: dict[str, Any] = resp.json()
    return result


def classify_issue_type(issue: dict[str, Any]) -> str:
    """Derive issue type from labels."""
    label_names = [lbl["name"].lower() for lbl in issue.get("labels", [])]
    for name in label_names:
        if "bug" in name:
            return "bug"
        if "feature" in name or "enhancement" in name:
            return "feature"
        if "refactor" in name:
            return "refactor"
        if "docs" in name or "documentation" in name:
            return "docs"
    return "unknown"


def detect_acceptance_criteria(issue_body: str | None) -> str:
    """Check whether the issue body contains explicit acceptance criteria."""
    if not issue_body:
        return "ai_inferred"
    lower = issue_body.lower()
    keywords = ["acceptance criteria", "expected behavior", "expected result", "should"]
    for kw in keywords:
        if kw in lower:
            return "issue"
    return "ai_inferred"


def get_issues_with_label(label: str, state: str = "open") -> list[dict[str, Any]]:
    """Fetch issues that have a given label.

    ``state`` can be ``"open"``, ``"closed"``, or ``"all"``.
    """
    issues: list[dict[str, Any]] = []
    page = 1
    while True:
        resp = requests.get(
            f"{GITHUB_API}/repos/{REPO}/issues",
            headers=_headers(),
            params={
                "labels": label,
                "state": state,
                "per_page": str(100),
                "page": str(page),
            },
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        issues.extend(batch)
        page += 1
    return issues


def get_open_issues_with_label(label: str) -> list[dict[str, Any]]:
    """Fetch open issues that have a given label."""
    return get_issues_with_label(label, state="open")
