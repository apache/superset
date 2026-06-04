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
"""Start a Devin autofix session for a GitHub issue.

Usage:
  python -m scripts.devin_autofix.start_session \
    --issue-number 123 \
    --trigger-comment-id 456789 \
    --triggered-by vickyli1014 \
    --run-url "https://github.com/.../actions/runs/999"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import requests

from scripts.devin_autofix.github_state import (
    add_label,
    classify_issue_type,
    detect_acceptance_criteria,
    find_active_markers,
    get_issue,
    post_comment,
    REPO,
    RunMarker,
)

DEVIN_API = "https://api.devin.ai/v3"

STRUCTURED_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "issue_number": {"type": "integer"},
        "issue_type": {"type": "string"},
        "summary": {"type": "string"},
        "status": {
            "type": "string",
            "enum": [
                "pr_opened",
                "waiting_review",
                "returned_to_human",
                "failed",
            ],
        },
        "acceptance_criteria_source": {
            "type": "string",
            "enum": ["issue", "ai_inferred", "none"],
        },
        "reproduction_result": {
            "type": "string",
            "enum": [
                "reproduced",
                "validated_by_code_inspection",
                "not_reproduced",
                "not_attempted",
            ],
        },
        "test_commit": {"type": ["string", "null"]},
        "implementation_commit": {"type": ["string", "null"]},
        "pr_url": {"type": ["string", "null"]},
        "checks_run": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "conclusion": {"type": "string"},
                },
                "required": ["name", "conclusion"],
            },
        },
        "return_reason": {"type": ["string", "null"]},
        "docs_updated": {"type": "boolean"},
    },
    "required": [
        "issue_number",
        "issue_type",
        "summary",
        "status",
        "acceptance_criteria_source",
        "reproduction_result",
        "pr_url",
        "return_reason",
        "docs_updated",
    ],
}


def build_prompt(issue_number: int, issue_url: str, issue_body: str | None) -> str:
    """Build the Devin session prompt."""
    return f"""You are resolving GitHub issue {issue_url} in repo {REPO}.

Rules:
- Diagnose the issue before editing.
- Reproduce or validate the issue when practical.
- If acceptance criteria are present in the issue, use them.
- If not present, infer minimal acceptance criteria and mark them as AI-inferred.
- Create focused failing tests first.
- Commit test-only changes.
- Make an implementation plan.
- Implement the plan without modifying the tests committed in the test-only commit.
- Commit implementation changes separately.
- Run focused validation.
- Open a PR using the repo PR template.
- Link the PR to the issue using Fixes #{issue_number}.
- Do not request reviewers yourself; the orchestrator will request review.
- Do not comment the PR link on the issue; the monitor workflow owns updates.
- Update docs only if the change affects user-facing behavior.
- Return structured JSON matching the requested schema.

Return to human if:
- The issue is security-sensitive.
- The issue cannot be reproduced or validated enough to design a test.
- Required secrets or external systems are unavailable.
- The fix requires a DB migration or large architectural change.
- Focused validation remains failing after reasonable attempts.
"""


def create_devin_session(
    issue_number: int,
    issue_url: str,
    issue_body: str | None,
    run_id: str,
) -> dict[str, str]:
    """Call the Devin API to create an autofix session.

    Returns dict with ``session_id`` and ``url``.
    """
    api_key = os.environ["DEVIN_API_KEY"]
    org_id = os.environ["DEVIN_ORG_ID"]

    prompt = build_prompt(issue_number, issue_url, issue_body)

    payload = {
        "prompt": prompt,
        "title": f"Autofix issue #{issue_number}",
        "repos": [REPO],
        "tags": [
            "autofix",
            f"repo:{REPO}",
            f"issue:{issue_number}",
            f"run:{run_id}",
        ],
        "structured_output_schema": STRUCTURED_OUTPUT_SCHEMA,
    }

    resp = requests.post(
        f"{DEVIN_API}/organizations/{org_id}/sessions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "session_id": data["session_id"],
        "url": data.get("url", f"https://app.devin.ai/sessions/{data['session_id']}"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Start a Devin autofix session")
    parser.add_argument("--issue-number", type=int, required=True)
    parser.add_argument("--trigger-comment-id", type=int, required=True)
    parser.add_argument("--triggered-by", required=True)
    parser.add_argument("--run-url", required=True)
    args = parser.parse_args()

    issue_number: int = args.issue_number
    trigger_comment_id: int = args.trigger_comment_id
    triggered_by: str = args.triggered_by
    run_url: str = args.run_url

    # Validate issue is open
    issue = get_issue(issue_number)
    if issue.get("state") != "open":
        print(f"::error::Issue #{issue_number} is not open")
        sys.exit(1)

    # Check for duplicate active runs
    if active := find_active_markers(issue_number):
        post_comment(
            issue_number,
            f"⚠️ Cannot start a new autofix run — there is already an active run "
            f"(`{active[0].run_id}`) on this issue. Wait for it to complete or be "
            f"returned to human before retrying.",
        )
        print(f"::error::Duplicate active run found: {active[0].run_id}")
        sys.exit(1)

    # Classify issue
    issue_type = classify_issue_type(issue)
    ac_source = detect_acceptance_criteria(issue.get("body"))
    now = datetime.now(timezone.utc)
    run_id = f"issue-{issue_number}-{now.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    # Post initial comment
    marker = RunMarker(
        run_id=run_id,
        issue_number=issue_number,
        trigger_comment_id=trigger_comment_id,
        triggered_by=triggered_by,
        status="in_progress",
        acceptance_criteria_source=ac_source,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )

    initial_body = (
        f"🤖 **Devin Autofix** — run started\n\n"
        f"- **Issue type:** {issue_type}\n"
        f"- **Acceptance criteria:** {ac_source}\n"
        f"- **Triggered by:** @{triggered_by}\n"
        f"- **Workflow run:** [link]({run_url})\n\n"
        f"Devin is working on this issue. A PR will be opened when ready.\n\n"
        f"{marker.to_marker()}"
    )
    post_comment(issue_number, initial_body)

    # Start Devin session
    try:
        session = create_devin_session(
            issue_number,
            issue["html_url"],
            issue.get("body"),
            run_id,
        )
    except Exception as exc:
        error_body = (
            f"❌ **Devin Autofix** — failed to start session\n\n"
            f"Error: `{exc}`\n\n"
            f"Returning this issue to human review.\n\n"
        )
        marker.status = "returned_to_human"
        error_body += marker.to_marker()
        post_comment(issue_number, error_body)
        add_label(issue_number, "devin-autofix/returned-human")
        print(f"::error::Failed to create Devin session: {exc}")
        sys.exit(1)

    # Update marker with session info
    marker.devin_session_id = session["session_id"]
    marker.devin_session_url = session["url"]

    update_body = (
        f"🤖 **Devin Autofix** — session created\n\n"
        f"- **Devin session:** [link]({session['url']})\n"
        f"- **Run ID:** `{run_id}`\n\n"
        f"{marker.to_marker()}"
    )
    post_comment(issue_number, update_body)
    add_label(issue_number, "devin-autofix/in-progress")

    # Write outputs for workflow
    if github_output := os.environ.get("GITHUB_OUTPUT", ""):
        with open(github_output, "a") as f:
            f.write(f"run_id={run_id}\n")
            f.write(f"devin_session_id={session['session_id']}\n")
            f.write(f"devin_session_url={session['url']}\n")

    print(f"Session created: {session['session_id']}")
    print(f"URL: {session['url']}")
    print(f"Run ID: {run_id}")

    # Set output as JSON for the workflow
    output = {
        "run_id": run_id,
        "devin_session_id": session["session_id"],
        "devin_session_url": session["url"],
        "issue_type": issue_type,
        "acceptance_criteria_source": ac_source,
    }
    print(f"::set-output name=result::{json.dumps(output)}")


if __name__ == "__main__":
    main()
