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
"""Reviewer request logic for devin-autofix PRs."""

from __future__ import annotations

import os
from typing import Any

import requests

from scripts.devin_autofix.github_state import GITHUB_API, REPO


def _headers() -> dict[str, str]:
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def request_review(
    pr_number: int,
    triggered_by: str,
) -> dict[str, Any]:
    """Request a review from the trigger commenter on a PR.

    Returns a dict with:
      - review_requested: bool
      - reviewer_login: str | None
      - error: str | None
    """
    # Get PR to check author
    resp = requests.get(
        f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    pr = resp.json()
    pr_author = pr["user"]["login"]

    # Skip if trigger commenter is the PR author
    if triggered_by == pr_author:
        print(
            f"  Skipping reviewer request: trigger commenter "
            f"({triggered_by}) is the PR author"
        )
        return {
            "review_requested": False,
            "reviewer_login": None,
            "error": None,
        }

    # Request review
    try:
        review_resp = requests.post(
            f"{GITHUB_API}/repos/{REPO}/pulls/{pr_number}/requested_reviewers",
            headers=_headers(),
            json={"reviewers": [triggered_by]},
            timeout=30,
        )
        review_resp.raise_for_status()
        print(f"  Review requested from {triggered_by} on PR #{pr_number}")
        return {
            "review_requested": True,
            "reviewer_login": triggered_by,
            "error": None,
        }
    except requests.HTTPError as exc:
        error_msg = f"Failed to request review from {triggered_by}: {exc}"
        print(f"  {error_msg}")

        # Post a best-effort comment on the PR
        try:
            comment_body = (
                f"⚠️ **Devin Autofix** — could not request review\n\n"
                f"Attempted to request review from @{triggered_by} but "
                f"the request failed: `{exc}`\n\n"
                f"Please review this PR manually."
            )
            requests.post(
                f"{GITHUB_API}/repos/{REPO}/issues/{pr_number}/comments",
                headers=_headers(),
                json={"body": comment_body},
                timeout=30,
            )
        except Exception as comment_exc:
            print(f"  Failed to post fallback comment: {comment_exc}")

        return {
            "review_requested": False,
            "reviewer_login": triggered_by,
            "error": error_msg,
        }
