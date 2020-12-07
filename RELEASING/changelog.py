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
#
# pylint: disable=no-value-for-parameter

import csv as lib_csv
import json
import os
import re
import sys
from dataclasses import dataclass
from time import sleep
from typing import Any, Dict, Iterator, List, Optional, Union
from urllib import request
from urllib.error import HTTPError

import click


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

    def __eq__(self, other: object) -> bool:
        """ A log entry is considered equal if it has the same PR number """
        if isinstance(other, self.__class__):
            return other.pr_number == self.pr_number
        return False

    def __repr__(self) -> str:
        return f"[{self.pr_number}]: {self.message} {self.time} {self.author}"


class GitChangeLog:
    """
    Helper class to output a list of logs entries on a superset changelog format

    We want to map a git author to a github login, for that we call github's API
    """

    def __init__(self, version: str, logs: List[GitLog]) -> None:
        self._version = version
        self._logs = logs
        self._github_login_cache: Dict[str, Optional[str]] = {}
        self._wait = 10

    def _wait_github_rate_limit(self) -> None:
        """
        Waits for available rate limit slots on the github API
        """
        while True:
            rate_limit_payload = self._fetch_github_rate_limit()
            if rate_limit_payload["rate"]["remaining"] > 1:
                break
            print(".", end="", flush=True)
            sleep(self._wait)
        print()

    @staticmethod
    def _fetch_github_rate_limit() -> Dict[str, Any]:
        """
        Fetches current github rate limit info
        """
        with request.urlopen("https://api.github.com/rate_limit") as response:
            payload = json.loads(response.read())
        return payload

    def _fetch_github_pr(self, pr_number: int) -> Dict[str, Any]:
        """
        Fetches a github PR info
        """
        payload = {}
        try:
            self._wait_github_rate_limit()
            with request.urlopen(
                "https://api.github.com/repos/apache/incubator-superset/pulls/"
                f"{pr_number}"
            ) as response:
                payload = json.loads(response.read())
        except HTTPError as ex:
            print(f"{ex}", flush=True)
        return payload

    def _get_github_login(self, git_log: GitLog) -> Optional[str]:
        """
        Tries to fetch a github login (username) from a git author
        """
        author_name = git_log.author
        github_login = self._github_login_cache.get(author_name)
        if github_login:
            return github_login
        if git_log.pr_number:
            pr_info = self._fetch_github_pr(git_log.pr_number)
            if pr_info:
                github_login = pr_info["user"]["login"]
            else:
                github_login = author_name
        # set cache
        self._github_login_cache[author_name] = github_login
        return github_login

    def _get_changelog_version_head(self) -> str:
        return f"### {self._version} ({self._logs[0].time})"

    def __repr__(self) -> str:
        result = f"\n{self._get_changelog_version_head()}\n"
        for i, log in enumerate(self._logs):
            github_login = self._get_github_login(log)
            if not github_login:
                github_login = log.author
            result = result + (
                f"- [#{log.pr_number}]"
                f"(https://github.com/apache/incubator-superset/pull/{log.pr_number}) "
                f"{log.message} (@{github_login})\n"
            )
            print(f"\r {i}/{len(self._logs)}", end="", flush=True)
        return result

    def __iter__(self) -> Iterator[Dict[str, Any]]:
        for log in self._logs:
            yield {
                "pr_number": log.pr_number,
                "pr_link": f"https://github.com/apache/incubator-superset/pull/"
                f"{log.pr_number}",
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
        self._logs: List[GitLog] = []

    @property
    def git_ref(self) -> str:
        return self._git_ref

    @property
    def logs(self) -> List[GitLog]:
        return self._logs

    def fetch(self) -> None:
        self._logs = list(map(self._parse_log, self._git_logs()))[::-1]

    def diff(self, git_logs: "GitLogs") -> List[GitLog]:
        return [log for log in git_logs.logs if log not in self._logs]

    def __repr__(self) -> str:
        return f"{self._git_ref}, Log count:{len(self._logs)}"

    @staticmethod
    def _git_get_current_head() -> str:
        output = os.popen("git status | head -1").read()
        match = re.match("(?:HEAD detached at|On branch) (.*)", output)
        if not match:
            return ""
        return match.group(1)

    def _git_checkout(self, git_ref: str) -> None:
        os.popen(f"git checkout {git_ref}").read()
        current_head = self._git_get_current_head()
        if current_head != git_ref:
            print(f"Could not checkout {git_ref}")
            sys.exit(1)

    def _git_logs(self) -> List[str]:
        # let's get current git ref so we can revert it back
        current_git_ref = self._git_get_current_head()
        self._git_checkout(self._git_ref)
        output = (
            os.popen('git --no-pager log --pretty=format:"%h|%an|%ae|%ad|%s|"')
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
        # parse the PR number from the log message
        match = re.match(r".*\(\#(\d*)\)", split_log_item[4])
        if match:
            pr_number = int(match.group(1))
        return GitLog(
            sha=split_log_item[0],
            author=split_log_item[1],
            author_email=split_log_item[2],
            time=split_log_item[3],
            message=split_log_item[4],
            pr_number=pr_number,
        )


@dataclass
class BaseParameters:
    previous_logs: GitLogs
    current_logs: GitLogs


def print_title(message: str) -> None:
    print(f"{50*'-'}")
    print(message)
    print(f"{50*'-'}")


@click.group()
@click.pass_context
@click.option("--previous_version", help="The previous release version", required=True)
@click.option("--current_version", help="The current release version", required=True)
def cli(ctx, previous_version: str, current_version: str) -> None:
    """ Welcome to change log generator  """
    previous_logs = GitLogs(previous_version)
    current_logs = GitLogs(current_version)
    previous_logs.fetch()
    current_logs.fetch()
    base_parameters = BaseParameters(previous_logs, current_logs)
    ctx.obj = base_parameters


@cli.command("compare")
@click.pass_obj
def compare(base_parameters: BaseParameters) -> None:
    """ Compares both versions (by PR) """
    previous_logs = base_parameters.previous_logs
    current_logs = base_parameters.current_logs
    print_title(
        f"Pull requests from " f"{current_logs.git_ref} not in {previous_logs.git_ref}"
    )
    previous_diff_logs = previous_logs.diff(current_logs)
    for diff_log in previous_diff_logs:
        print(f"{diff_log}")

    print_title(
        f"Pull requests from " f"{previous_logs.git_ref} not in {current_logs.git_ref}"
    )
    current_diff_logs = current_logs.diff(previous_logs)
    for diff_log in current_diff_logs:
        print(f"{diff_log}")


@cli.command("changelog")
@click.option(
    "--csv", help="The csv filename to export the changelog to",
)
@click.pass_obj
def change_log(base_parameters: BaseParameters, csv: str) -> None:
    """ Outputs a changelog (by PR) """
    previous_logs = base_parameters.previous_logs
    current_logs = base_parameters.current_logs
    previous_diff_logs = previous_logs.diff(current_logs)
    logs = GitChangeLog(current_logs.git_ref, previous_diff_logs[::-1])
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
        print("Fetching github usernames, this may take a while:")
        print(logs)


cli()
