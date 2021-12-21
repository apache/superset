#!/usr/bin/env python3
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
Manually cancel previous GitHub Action workflow runs in queue.

Example:
  # Set up
  export GITHUB_TOKEN={{ your personal github access token }}
  export GITHUB_REPOSITORY=apache/superset

  # cancel previous jobs for a PR, will even cancel the running ones
  ./cancel_github_workflows.py 1042

  # cancel previous jobs for a branch
  ./cancel_github_workflows.py my-branch

  # cancel all jobs of a PR, including the latest runs
  ./cancel_github_workflows.py 1024 --include-last
"""
import os
from typing import Any, Dict, Iterable, Iterator, List, Optional, Union

import click
import requests
from click.exceptions import ClickException
from dateutil import parser
from typing_extensions import Literal

github_token = os.environ.get("GITHUB_TOKEN")
github_repo = os.environ.get("GITHUB_REPOSITORY", "apache/superset")


def request(
    method: Literal["GET", "POST", "DELETE", "PUT"], endpoint: str, **kwargs: Any
) -> Dict[str, Any]:
    resp = requests.request(
        method,
        f"https://api.github.com/{endpoint.lstrip('/')}",
        headers={"Authorization": f"Bearer {github_token}"},
        **kwargs,
    ).json()
    if "message" in resp:
        raise ClickException(f"{endpoint} >> {resp['message']} <<")
    return resp


def list_runs(
    repo: str, params: Optional[Dict[str, str]] = None,
) -> Iterator[Dict[str, Any]]:
    """List all github workflow runs.
    Returns:
      An iterator that will iterate through all pages of matching runs."""
    if params is None:
        params = {}
    page = 1
    total_count = 10000
    while page * 100 < total_count:
        result = request(
            "GET",
            f"/repos/{repo}/actions/runs",
            params={**params, "per_page": 100, "page": page},
        )
        total_count = result["total_count"]
        for item in result["workflow_runs"]:
            yield item
        page += 1


def cancel_run(repo: str, run_id: Union[str, int]) -> Dict[str, Any]:
    return request("POST", f"/repos/{repo}/actions/runs/{run_id}/cancel")


def get_pull_request(repo: str, pull_number: Union[str, int]) -> Dict[str, Any]:
    return request("GET", f"/repos/{repo}/pulls/{pull_number}")


def get_runs(
    repo: str,
    branch: Optional[str] = None,
    user: Optional[str] = None,
    statuses: Iterable[str] = ("queued", "in_progress"),
    events: Iterable[str] = ("pull_request", "push"),
) -> List[Dict[str, Any]]:
    """Get workflow runs associated with the given branch"""
    return [
        item
        for event in events
        for status in statuses
        for item in list_runs(repo, {"event": event, "status": status})
        if (branch is None or (branch == item["head_branch"]))
        and (user is None or (user == item["head_repository"]["owner"]["login"]))
    ]


def print_commit(commit: Dict[str, Any], branch: str) -> None:
    """Print out commit message for verification"""
    indented_message = "    \n".join(commit["message"].split("\n"))
    date_str = (
        parser.parse(commit["timestamp"])
        .astimezone(tz=None)
        .strftime("%a, %d %b %Y %H:%M:%S")
    )
    print(
        f"""HEAD {commit["id"]} ({branch})
Author: {commit["author"]["name"]} <{commit["author"]["email"]}>
Date:   {date_str}

    {indented_message}
"""
    )


@click.command()
@click.option(
    "--repo",
    default=github_repo,
    help="The github repository name. For example, apache/superset.",
)
@click.option(
    "--event",
    type=click.Choice(["pull_request", "push", "issue"]),
    default=["pull_request", "push"],
    show_default=True,
    multiple=True,
)
@click.option(
    "--include-last/--skip-last",
    default=False,
    show_default=True,
    help="Whether to also cancel the lastest run.",
)
@click.option(
    "--include-running/--skip-running",
    default=True,
    show_default=True,
    help="Whether to also cancel running workflows.",
)
@click.argument("branch_or_pull", required=False)
def cancel_github_workflows(
    branch_or_pull: Optional[str],
    repo: str,
    event: List[str],
    include_last: bool,
    include_running: bool,
) -> None:
    """Cancel running or queued GitHub workflows by branch or pull request ID"""
    if not github_token:
        raise ClickException("Please provide GITHUB_TOKEN as an env variable")

    statuses = ("queued", "in_progress") if include_running else ("queued",)
    events = event
    pr = None

    if branch_or_pull is None:
        title = "all jobs" if include_last else "all duplicate jobs"
    elif branch_or_pull.isdigit():
        pr = get_pull_request(repo, pull_number=branch_or_pull)
        title = f"pull request #{pr['number']} - {pr['title']}"
    else:
        title = f"branch [{branch_or_pull}]"

    print(
        f"\nCancel {'active' if include_running else 'previous'} "
        f"workflow runs for {title}\n"
    )

    if pr:
        runs = get_runs(
            repo,
            statuses=statuses,
            events=event,
            branch=pr["head"]["ref"],
            user=pr["user"]["login"],
        )
    else:
        user = None
        branch = branch_or_pull
        if branch and ":" in branch:
            [user, branch] = branch.split(":", 2)
        runs = get_runs(
            repo, branch=branch, user=user, statuses=statuses, events=events,
        )

    # sort old jobs to the front, so to cancel older jobs first
    runs = sorted(runs, key=lambda x: x["created_at"])
    if runs:
        print(
            f"Found {len(runs)} potential runs of\n"
            f"   status: {statuses}\n   event: {events}\n"
        )
    else:
        print(f"No {' or '.join(statuses)} workflow runs found.\n")
        return

    if not include_last:
        # Keep the latest run for each workflow and cancel all others
        seen = set()
        dups = []
        for item in reversed(runs):
            key = f'{item["event"]}_{item["head_branch"]}_{item["workflow_id"]}'
            if key in seen:
                dups.append(item)
            else:
                seen.add(key)
        if not dups:
            print(
                "Only the latest runs are in queue. "
                "Use --include-last to force cancelling them.\n"
            )
            return
        runs = dups[::-1]

    last_sha = None

    print(f"\nCancelling {len(runs)} jobs...\n")
    for entry in runs:
        head_commit = entry["head_commit"]
        if head_commit["id"] != last_sha:
            last_sha = head_commit["id"]
            print("")
            print_commit(head_commit, entry["head_branch"])
        try:
            print(f"[{entry['status']}] {entry['name']}", end="\r")
            cancel_run(repo, entry["id"])
            print(f"[Canceled] {entry['name']}     ")
        except ClickException as error:
            print(f"[Error: {error.message}] {entry['name']}    ")
    print("")


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cancel_github_workflows()
