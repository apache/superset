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
from unittest import mock

from scripts import change_detector

REPO = "apache/superset"


def test_resolve_workflow_run_files_pull_request(monkeypatch) -> None:
    """A workflow_run originating from a pull_request resolves the PR diff."""
    monkeypatch.setenv("WF_RUN_EVENT", "pull_request")
    monkeypatch.setenv("WF_RUN_PR_NUMBER", "123")

    with (
        mock.patch.object(
            change_detector,
            "fetch_changed_files_pr",
            return_value=["superset/foo.py"],
        ) as fetch_pr,
        mock.patch.object(change_detector, "fetch_changed_files_push") as fetch_push,
    ):
        files = change_detector.resolve_workflow_run_files(REPO, "deadbeef")

    assert files == ["superset/foo.py"]
    fetch_pr.assert_called_once_with(REPO, "123")
    fetch_push.assert_not_called()


def test_resolve_workflow_run_files_push(monkeypatch) -> None:
    """A workflow_run originating from a push resolves the push diff via head SHA."""
    monkeypatch.setenv("WF_RUN_EVENT", "push")
    monkeypatch.setenv("WF_RUN_HEAD_SHA", "abc123")

    with (
        mock.patch.object(
            change_detector,
            "fetch_changed_files_push",
            return_value=["superset-frontend/bar.tsx"],
        ) as fetch_push,
        mock.patch.object(change_detector, "fetch_changed_files_pr") as fetch_pr,
    ):
        files = change_detector.resolve_workflow_run_files(REPO, "fallback-sha")

    assert files == ["superset-frontend/bar.tsx"]
    # The originating head SHA wins over the (default-branch) fallback SHA.
    fetch_push.assert_called_once_with(REPO, "abc123")
    fetch_pr.assert_not_called()


def test_resolve_workflow_run_files_push_defaults_to_fallback_sha(
    monkeypatch,
) -> None:
    """Without WF_RUN_HEAD_SHA the push path falls back to the passed SHA."""
    monkeypatch.delenv("WF_RUN_EVENT", raising=False)
    monkeypatch.delenv("WF_RUN_HEAD_SHA", raising=False)

    with mock.patch.object(
        change_detector,
        "fetch_changed_files_push",
        return_value=[],
    ) as fetch_push:
        change_detector.resolve_workflow_run_files(REPO, "fallback-sha")

    fetch_push.assert_called_once_with(REPO, "fallback-sha")


def test_resolve_workflow_run_files_pr_missing_number(monkeypatch) -> None:
    """A fork PR without a resolvable number returns None (assume all changed)."""
    monkeypatch.setenv("WF_RUN_EVENT", "pull_request")
    monkeypatch.delenv("WF_RUN_PR_NUMBER", raising=False)

    with mock.patch.object(change_detector, "fetch_changed_files_pr") as fetch_pr:
        files = change_detector.resolve_workflow_run_files(REPO, "deadbeef")

    assert files is None
    fetch_pr.assert_not_called()


def test_resolve_workflow_run_files_pr_invalid_number(monkeypatch) -> None:
    """A non-integer PR number is treated as unresolvable and returns None."""
    monkeypatch.setenv("WF_RUN_EVENT", "pull_request")
    monkeypatch.setenv("WF_RUN_PR_NUMBER", "not-a-number")

    with mock.patch.object(change_detector, "fetch_changed_files_pr") as fetch_pr:
        files = change_detector.resolve_workflow_run_files(REPO, "deadbeef")

    assert files is None
    fetch_pr.assert_not_called()
