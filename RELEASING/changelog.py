#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import csv as lib_csv
import json  # noqa: TID251 - standalone release script, not part of superset
import os
import re
import sys
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Optional, Union

import click
from click.core import Context

try:
    from github import (
        Auth,
        BadCredentialsException,
        Commit,
        Github,
        PullRequest,
        Repository,
        UnknownObjectException,
    )
except ModuleNotFoundError:
    print("PyGitHub is a required package for this script")
    exit(1)

SUPERSET_REPO = "apache/superset"
SUPERSET_PULL_REQUEST_TYPES = r"^(fix|feat|chore|refactor|docs|build|ci|/gmi)"
SUPERSET_RISKY_LABELS = r"^(blocking|risk|hold|revert|security vulnerability)"
# subject of a commit made with `git revert`, which unlike a merged revert PR has no
# PR number of its own
REVERT_SUBJECT = re.compile(r'^Revert "(.*)"$')
CHANGELOG_HEADER = """<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->"""


@dataclass
class GitLog:
    """
    Represents a git log entry
    """

    sha: str
    author: str
    time: str
    message: str
    pr_number: Union[int, None] = None
    author_email: str = ""
    is_revert: bool = False

    def __eq__(self, other: object) -> bool:
        """A log entry is considered equal if it has the same PR number"""
        if isinstance(other, self.__class__):
            return other.pr_number == self.pr_number
        return False

    def __repr__(self) -> str:
        return f"[{self.pr_number}]: {self.message} {self.time} {self.author}"


class GitChangeLog:
    """
    Helper class to output a list of logs entries on a superset changelog format

    Each PR is credited to its author's github login, for that we call github's API
    """

    def __init__(
        self,
        version: str,
        logs: list[GitLog],
        access_token: Optional[str] = None,
        risk: Optional[bool] = False,
        cache_file: Optional[str] = None,
    ) -> None:
        self._version = version
        self._logs = logs
        self._cache_file = cache_file
        self._pr_logs_with_details = self._load_cached_pull_request_details()
        self._wait = 10
        github_token = access_token or os.environ.get("GITHUB_TOKEN")
        self._github = Github(auth=Auth.Token(github_token) if github_token else None)
        self._show_risk = risk
        self._superset_repo: Repository = None

    def _load_cached_pull_request_details(self) -> dict[int, dict[str, Any]]:
        """
        Loads the PR details persisted by previous runs, so an interrupted run
        resumes where it left off instead of fetching everything from github again
        """
        details: dict[int, dict[str, Any]] = {}
        if not self._cache_file or not os.path.exists(self._cache_file):
            return details
        truncated = False
        with open(self._cache_file) as cache:
            for line in cache:
                try:
                    detail = json.loads(line)
                except json.JSONDecodeError:
                    truncated = True
                    continue
                details[detail["id"]] = detail
        if truncated:
            # a run killed mid-write leaves a truncated line behind, so rewrite the
            # cache without it to keep new records from being appended onto it
            with open(self._cache_file, "w") as cache:
                cache.writelines(
                    f"{json.dumps(detail)}\n" for detail in details.values()
                )
        print(
            f"Loaded {len(details)} cached pull requests from {self._cache_file}",
            file=sys.stderr,
        )
        return details

    def _cache_pull_request_details(self, detail: dict[str, Any]) -> None:
        self._pr_logs_with_details[detail["id"]] = detail
        if self._cache_file:
            with open(self._cache_file, "a") as cache:
                cache.write(f"{json.dumps(detail)}\n")

    def _fetch_github_pr(self, pr_number: int) -> Optional[PullRequest]:
        """
        Fetches a github PR info, or None if github no longer has the PR
        (e.g. it was deleted, or its author's account was suspended)
        """
        try:
            if self._superset_repo is None:
                self._superset_repo = self._github.get_repo(SUPERSET_REPO)
            pull_request = self._superset_repo.get_pull(pr_number)
        except UnknownObjectException:
            print(
                f"\nPR #{pr_number} not found on github, using its commit details",
                file=sys.stderr,
            )
            return None
        except BadCredentialsException:
            print(
                "Bad credentials to github provided"
                " use access_token parameter or set GITHUB_TOKEN"
            )
            sys.exit(1)

        return pull_request

    def _has_commit_migrations(self, commit: Commit) -> bool:
        return any(
            "superset/migrations/versions/" in file.filename for file in commit.files
        )

    def _get_pull_request_details(self, git_log: GitLog) -> dict[str, Any]:
        pr_number = git_log.pr_number
        if pr_number:
            detail = self._pr_logs_with_details.get(pr_number)
            if detail:
                return detail
            pr_info = self._fetch_github_pr(pr_number)

        commit = self._superset_repo.get_commit(sha=git_log.sha)
        has_migrations = self._has_commit_migrations(commit)
        if pr_info:
            title, login = pr_info.title, pr_info.user.login
        else:
            # github still serves the commit of a PR it no longer serves
            title = git_log.message.removesuffix(f" (#{pr_number})")
            login = commit.author.login if commit.author else None
        pr_type = re.match(SUPERSET_PULL_REQUEST_TYPES, title)
        if pr_type:
            pr_type = pr_type.group().strip('"')  # type: ignore

        pr_labels = pr_info.labels if pr_info else []
        labels = (" | ").join([label.name for label in pr_labels])
        is_risky = self._is_risk_pull_request(pr_labels)
        detail = {
            "id": pr_number,
            "login": login,
            "has_migrations": has_migrations,
            "labels": labels,
            "title": title,
            "type": pr_type,
            "is_risky": is_risky or has_migrations,
        }

        if pr_number:
            self._cache_pull_request_details(detail)

        return detail

    def _is_risk_pull_request(self, labels: list[Any]) -> bool:
        for label in labels:
            risk_label = re.match(SUPERSET_RISKY_LABELS, label.name)
            if risk_label is not None:
                return True
        return False

    def _get_changelog_version_head(self) -> str:
        if not len(self._logs):
            print(
                "No changes found between revisions. "
                "Make sure your branch is up to date."
            )
            sys.exit(1)
        return f"### {self._version} ({self._logs[0].time})"

    def _parse_change_log(
        self,
        changelog: dict[str, str],
        pr_info: dict[str, str],
        github_login: str,
    ) -> None:
        formatted_pr = (
            f"- [#{pr_info.get('id')}]"
            f"(https://github.com/{SUPERSET_REPO}/pull/{pr_info.get('id')}) "
            f"{pr_info.get('title')} (@{github_login})\n"
        )
        if pr_info.get("has_migrations"):
            changelog["Database Migrations"] += formatted_pr
        elif pr_info.get("type") == "fix":
            changelog["Fixes"] += formatted_pr
        elif pr_info.get("type") == "feat":
            changelog["Features"] += formatted_pr
        else:
            changelog["Others"] += formatted_pr

    def __repr__(self) -> str:
        result = f"\n{self._get_changelog_version_head()}\n"
        changelog = {
            "Database Migrations": "",
            "Features": "",
            "Fixes": "",
            "Others": "",
        }
        for i, log in enumerate(self._logs):
            pr_info = self._get_pull_request_details(log)
            github_login = pr_info["login"] or log.author

            if self._show_risk:
                if pr_info.get("is_risky"):
                    result += (
                        f"- [#{log.pr_number}]"
                        f"(https://github.com/{SUPERSET_REPO}/pull/{log.pr_number}) "
                        f"{pr_info.get('title')} (@{github_login})  "
                        f"{pr_info.get('labels')} \n"
                    )
            else:
                self._parse_change_log(changelog, pr_info, github_login)

            print(f"\r {i}/{len(self._logs)}", end="", flush=True, file=sys.stderr)
        print(file=sys.stderr)

        if self._show_risk:
            return result

        # the complete CHANGELOG/<version>.md file
        sections = "\n\n".join(
            f"**{key}**\n\n{entries}".rstrip() for key, entries in changelog.items()
        )
        return (
            f"{CHANGELOG_HEADER}\n\n## Change Log\n\n"
            f"{self._get_changelog_version_head()}\n\n{sections}"
        )

    def __iter__(self) -> Iterator[dict[str, Any]]:
        for log in self._logs:
            yield {
                "pr_number": log.pr_number,
                "pr_link": f"https://github.com/{SUPERSET_REPO}/pull/{log.pr_number}",
                "message": log.message,
                "time": log.time,
                "author": log.author,
                "email": log.author_email,
                "sha": log.sha,
            }


class GitLogs:
    """
    Manages git log entries from a specific branch/tag

    Can compare git log entries by PR number
    """

    def __init__(self, git_ref: str) -> None:
        self._git_ref = git_ref
        self._logs: list[GitLog] = []

    @property
    def git_ref(self) -> str:
        return self._git_ref

    @property
    def logs(self) -> list[GitLog]:
        return self._logs

    def fetch(self) -> None:
        self._logs = list(map(self._parse_log, self._git_logs()))[::-1]

    @property
    def pull_request_logs(self) -> list[GitLog]:
        """
        The latest commit of each PR in effect at this git ref, oldest first. PRs
        reverted on the branch itself are left out, and PRs merged more than once
        are listed once
        """
        pull_requests: dict[int, GitLog] = {}
        for log in self._logs:
            if not log.pr_number:
                continue
            pull_requests.pop(log.pr_number, None)
            if not log.is_revert:
                pull_requests[log.pr_number] = log
        return list(pull_requests.values())

    def diff(self, git_logs: "GitLogs") -> list[GitLog]:
        pr_numbers = {log.pr_number for log in self.pull_request_logs}
        return [
            log for log in git_logs.pull_request_logs if log.pr_number not in pr_numbers
        ]

    def __repr__(self) -> str:
        return f"{self._git_ref}, Log count:{len(self._logs)}"

    @staticmethod
    def _git_get_current_head() -> str:
        output = os.popen("git status | head -1").read()  # noqa: S605, S607
        match = re.match("(?:HEAD detached at|On branch) (.*)", output)
        if not match:
            return ""
        return match.group(1)

    def _git_checkout(self, git_ref: str) -> None:
        os.popen(f"git checkout {git_ref}").read()  # noqa: S605
        current_head = self._git_get_current_head()
        if current_head != git_ref:
            print(f"Could not checkout {git_ref}")
            sys.exit(1)

    def _git_logs(self) -> list[str]:
        # let's get current git ref so we can revert it back
        current_git_ref = self._git_get_current_head()
        self._git_checkout(self._git_ref)
        output = (
            os.popen('git --no-pager log --pretty=format:"%h|%an|%ae|%ad|%s|"')  # noqa: S605, S607
            .read()
            .split("\n")
        )
        # revert to git ref, let's be nice
        self._git_checkout(current_git_ref)
        return output

    @staticmethod
    def _parse_log(log_item: str) -> GitLog:
        pr_number = None
        split_log_item = log_item.split("|")
        # a revert's subject wraps the reverted commit's, so unwrap it to find the
        # reverted PR; reverting a revert lands that PR again
        subject, reverts = split_log_item[4], 0
        while revert := REVERT_SUBJECT.match(subject):
            subject, reverts = revert.group(1), reverts + 1
        # parse the PR number from the log message
        match = re.match(r".*\(\#(\d*)\)", subject)
        if match:
            pr_number = int(match.group(1))
        return GitLog(
            sha=split_log_item[0],
            author=split_log_item[1],
            author_email=split_log_item[2],
            time=split_log_item[3],
            message=split_log_item[4],
            pr_number=pr_number,
            is_revert=reverts % 2 == 1,
        )


@dataclass
class BaseParameters:
    previous_logs: GitLogs
    current_logs: GitLogs


def print_title(message: str) -> None:
    print(f"{50 * '-'}")
    print(message)
    print(f"{50 * '-'}")


@click.group()
@click.pass_context
@click.option("--previous_version", help="The previous release version", required=True)
@click.option("--current_version", help="The current release version", required=True)
def cli(ctx: Context, previous_version: str, current_version: str) -> None:
    """Welcome to change log generator"""
    previous_logs = GitLogs(previous_version)
    current_logs = GitLogs(current_version)
    previous_logs.fetch()
    current_logs.fetch()
    base_parameters = BaseParameters(previous_logs, current_logs)
    ctx.obj = base_parameters


@cli.command("compare")
@click.pass_obj
def compare(base_parameters: BaseParameters) -> None:
    """Compares both versions (by PR)"""
    previous_logs = base_parameters.previous_logs
    current_logs = base_parameters.current_logs
    print_title(
        f"Pull requests from {current_logs.git_ref} not in {previous_logs.git_ref}"
    )
    previous_diff_logs = previous_logs.diff(current_logs)
    for diff_log in previous_diff_logs:
        print(f"{diff_log}")

    print_title(
        f"Pull requests from {previous_logs.git_ref} not in {current_logs.git_ref}"
    )
    current_diff_logs = current_logs.diff(previous_logs)
    for diff_log in current_diff_logs:
        print(f"{diff_log}")


@cli.command("changelog")
@click.option(
    "--csv",
    help="The csv filename to export the changelog to",
)
@click.option(
    "--access_token",
    help="The github access token,"
    " if not provided will try to fetch from GITHUB_TOKEN env var",
)
@click.option("--risk", is_flag=True, help="show all pull requests with risky labels")
@click.option(
    "--cache_file",
    default=os.path.join(tempfile.gettempdir(), "superset_changelog_cache.jsonl"),
    show_default=True,
    help="File that caches the pull request details fetched from github, so an"
    " interrupted run resumes where it left off. Delete it to fetch everything again",
)
@click.option(
    "--release_version",
    envvar="SUPERSET_VERSION",
    help="The version to name in the changelog heading (e.g. 1.5.0),"
    " if not provided will try SUPERSET_VERSION env var, then --current_version",
)
@click.pass_obj
def change_log(
    base_parameters: BaseParameters,
    csv: str,
    access_token: str,
    risk: bool,
    cache_file: str,
    release_version: Optional[str],
) -> None:
    """Outputs a changelog (by PR)"""
    previous_logs = base_parameters.previous_logs
    current_logs = base_parameters.current_logs
    previous_diff_logs = previous_logs.diff(current_logs)
    logs = GitChangeLog(
        release_version or current_logs.git_ref,
        previous_diff_logs[::-1],
        access_token=access_token,
        risk=risk,
        cache_file=cache_file,
    )
    if csv:
        with open(csv, "w") as csv_file:
            log_items = list(logs)
            field_names = log_items[0].keys()
            writer = lib_csv.DictWriter(
                csv_file,
                delimiter=",",
                quotechar='"',
                quoting=lib_csv.QUOTE_ALL,
                fieldnames=field_names,
            )
            writer.writeheader()
            for log in logs:
                writer.writerow(log)
    else:
        print("Fetching github usernames, this may take a while:", file=sys.stderr)
        print(logs)


cli()
