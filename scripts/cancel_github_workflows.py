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
  export GITHUB_TOKEN=394ba3b48494ab8f930fbc93
  export GITHUB_REPOSITORY=apache/superset

  # cancel previous jobs for a PR
  ./cancel_github_workflows.py 1042

  # cancel previous jobs for a branch
  ./cancel_github_workflows.py my-branch

  # cancel all jobs
  ./cancel_github_workflows.py 1024 --include-last
"""
import os
from typing import Iterable, List, Optional, Union

import click
import requests
from click.exceptions import ClickException
from dateutil import parser
from typing_extensions import Literal

github_token = os.environ.get("GITHUB_TOKEN")
github_repo = os.environ.get("GITHUB_REPOSITORY", "apache/superset")


def request(method: Literal["GET", "POST", "DELETE", "PUT"], endpoint: str, **kwargs):
    resp = requests.request(
        method,
        f"https://api.github.com/{endpoint.lstrip('/')}",
        headers={"Authorization": f"Bearer {github_token}"},
        **kwargs,
    ).json()
    if "message" in resp:
        raise ClickException(f"{endpoint} >> {resp['message']} <<")
    return resp


def list_runs(repo: str, params=None):
    return request("GET", f"/repos/{repo}/actions/runs", params=params)


def cancel_run(repo: str, run_id: Union[str, int]):
    return request("POST", f"/repos/{repo}/actions/runs/{run_id}/cancel")


def get_pull_request(repo: str, pull_number: Union[str, int]):
    return request("GET", f"/repos/{repo}/pulls/{pull_number}")


def get_runs_by_branch(
    repo: str,
    branch: str,
    user: Optional[str] = None,
    statuses: Iterable[str] = ("queued", "in_progress"),
    events: Iterable[str] = ("pull_request", "push"),
):
    """Get workflow runs associated with the given branch"""
    return [
        item
        for event in events
        for status in statuses
        for item in list_runs(
            repo, {"event": event, "status": status, "per_page": 100}
        )["workflow_runs"]
        if item["head_branch"] == branch
        and (user is None or (user == item["head_repository"]["owner"]["login"]))
    ]


def print_commit(commit):
    """Print out commit message for verification"""
    indented_message = "    \n".join(commit["message"].split("\n"))
    date_str = (
        parser.parse(commit["timestamp"])
        .astimezone(tz=None)
        .strftime("%a, %d %b %Y %H:%M:%S")
    )
    print(
        f"""HEAD {commit["id"]}
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
@click.argument("branch_or_pull")
def cancel_github_workflows(
    branch_or_pull: str,
    repo,
    event: List[str],
    include_last: bool,
    include_running: bool,
):
    """Cancel running or queued GitHub workflows by branch or pull request ID"""
    if not github_token:
        raise ClickException("Please provide GITHUB_TOKEN as an env variable")

    statuses = ("queued", "in_progress") if include_running else ("queued",)
    pr = None

    if branch_or_pull.isdigit():
        pr = get_pull_request(repo, pull_number=branch_or_pull)
        target_type = "pull request"
        title = f"#{pr['number']} - {pr['title']}"
    else:
        target_type = "branch"
        title = branch_or_pull

    print(
        f"\nCancel {'active' if include_running else 'previous'} "
        f"workflow runs for {target_type}\n\n    {title}\n"
    )

    if pr:
        # full branch name
        runs = get_runs_by_branch(
            repo,
            statuses=statuses,
            events=event,
            branch=pr["head"]["ref"],
            user=pr["user"]["login"],
        )
    else:
        user = None
        branch = branch_or_pull
        if ":" in branch:
            [user, branch] = branch.split(":", 2)
        runs = get_runs_by_branch(
            repo, statuses=statuses, events=event, branch=branch_or_pull, user=user
        )

    runs = sorted(runs, key=lambda x: x["created_at"])
    if not runs:
        print(f"No {' or '.join(statuses)} workflow runs found.\n")
        return

    if not include_last:
        # Only keep one item for each workflow
        seen = set()
        dups = []
        for item in reversed(runs):
            if item["workflow_id"] in seen:
                dups.append(item)
            else:
                seen.add(item["workflow_id"])
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
            print_commit(head_commit)
        try:
            print(f"[{entry['status']}] {entry['name']}", end="\r")
            cancel_run(repo, entry["id"])
            print(f"[Cancled] {entry['name']}     ")
        except ClickException as error:
            print(f"[Error: {error.message}] {entry['name']}    ")
    print("")


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cancel_github_workflows()
