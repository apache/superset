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

import argparse
import json
import os
import re
import subprocess
from typing import List
from urllib.request import Request, urlopen

# Define patterns for each group of files you're interested in
PATTERNS = {
    "python": [
        r"^\.github/workflows/.*python",
        r"^tests/",
        r"^superset/",
        r"^scripts/",
        r"^setup\.py",
        r"^requirements/.+\.txt",
        r"^.pylintrc",
    ],
    "frontend": [
        r"^\.github/workflows/.*(bashlib|frontend|e2e)",
        r"^superset-frontend/",
    ],
    "docker": [
        r"^Dockerfile$",
        r"^docker/",
    ],
    "docs": [
        r"^docs/",
    ],
}
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")


def fetch_files_github_api(url: str):  # type: ignore
    """Fetches data using GitHub API."""
    req = Request(url)
    req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")

    print(f"Fetching from {url}")
    with urlopen(req) as response:
        body = response.read()
        return json.loads(body)


def fetch_changed_files_pr(repo: str, pr_number: str) -> List[str]:
    """Fetches files changed in a PR using the GitHub API."""
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    files = fetch_files_github_api(url)
    return [file_info["filename"] for file_info in files]


def fetch_changed_files_push(repo: str, sha: str) -> List[str]:
    """Fetches files changed in the last commit for push events using GitHub API."""
    # Fetch commit details to get the parent SHA
    commit_url = f"https://api.github.com/repos/{repo}/commits/{sha}"
    commit_data = fetch_files_github_api(commit_url)
    if "parents" not in commit_data or len(commit_data["parents"]) < 1:
        raise RuntimeError("No parent commit found for comparison.")
    parent_sha = commit_data["parents"][0]["sha"]
    # Compare the current commit against its parent
    compare_url = f"https://api.github.com/repos/{repo}/compare/{parent_sha}...{sha}"
    comparison_data = fetch_files_github_api(compare_url)
    return [file["filename"] for file in comparison_data["files"]]


def detect_changes(files: List[str], check_patterns: List) -> bool:  # type: ignore
    """Detects if any of the specified files match the provided patterns."""
    for file in files:
        for pattern in check_patterns:
            if re.match(pattern, file):
                return True
    return False


def print_files(files: List[str]) -> None:
    print("\n".join([f"- {s}" for s in files]))


def main(event_type: str, sha: str, repo: str) -> None:
    """Main function to check for file changes based on event context."""
    print("SHA:", sha)
    print("EVENT_TYPE", event_type)
    if event_type == "pull_request":
        pr_number = os.getenv("GITHUB_REF", "").split("/")[-2]
        files = fetch_changed_files_pr(repo, pr_number)
        print("PR files:")
        print_files(files)

    elif event_type == "push":
        files = fetch_changed_files_push(repo, sha)
        print("Files touched since previous commit:")
        print_files(files)

    elif event_type == "workflow_dispatch":
        print("Workflow dispatched, assuming all changed")

    else:
        raise ValueError("Unsupported event type")

    changes_detected = {}
    for group, regex_patterns in PATTERNS.items():
        patterns_compiled = [re.compile(p) for p in regex_patterns]
        changes_detected[group] = event_type == "workflow_dispatch" or detect_changes(
            files, patterns_compiled
        )

    # Output results
    output_path = os.getenv("GITHUB_OUTPUT") or "/tmp/GITHUB_OUTPUT.txt"
    with open(output_path, "a") as f:
        for check, changed in changes_detected.items():
            if changed:
                print(f"{check}={str(changed).lower()}", file=f)
                print(f"Triggering group: {check}")


def get_git_sha() -> str:
    return os.getenv("GITHUB_SHA") or subprocess.check_output(
        ["git", "rev-parse", "HEAD"]
    ).strip().decode("utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Detect file changes based on event context"
    )
    parser.add_argument(
        "--event-type",
        default=os.getenv("GITHUB_EVENT_NAME") or "push",
        help="The type of event that triggered the workflow",
    )
    parser.add_argument(
        "--sha",
        default=get_git_sha(),
        help="The commit SHA for push events or PR head SHA",
    )
    parser.add_argument(
        "--repo",
        default=os.getenv("GITHUB_REPOSITORY") or "apache/superset",
        help="GitHub repository in the format owner/repo",
    )
    args = parser.parse_args()

    main(args.event_type, args.sha, args.repo)
