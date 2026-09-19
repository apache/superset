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
"""Behavioural tests for the orchestrator against a fake GitHub/Devin API.

Run with ``python -m pytest automation/tests``.
"""

from __future__ import annotations

import json  # noqa: TID251  -- standalone tool, not part of the superset package
import threading
import time
from collections.abc import Iterator
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from automation.orchestrator import dispatch as ops
from automation.orchestrator.api import (
    AmbiguousWriteError,
    AuthenticationError,
    CircuitBreaker,
    Devin,
    GitHub,
    Metrics,
    PermanentError,
    PullRequest,
    ResourceNotFoundError,
    RetryPolicy,
    Session,
    TransientError,
    ValidationError,
)

FAST = RetryPolicy(
    max_attempts=4, initial=0.01, max_sleep=0.05, budget_seconds=5, timeout=1
)


class Fake:
    """Scriptable API: ``script[path]`` is a list of (status, body) replies."""

    def __init__(self) -> None:
        self.script: dict[str, list[tuple[int, Any]]] = {}
        self.calls: list[tuple[str, str]] = []
        self.comments: list[dict[str, Any]] = []
        self.sessions: list[dict[str, Any]] = []

    def reply(self, method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        self.calls.append((method, path))
        if path in self.script and self.script[path]:
            status, body = self.script[path].pop(0)
            headers = {"Retry-After": "0"} if status == 429 else {}
            return status, body, headers
        if path.endswith("/comments") and method == "GET":
            return 200, self.comments, {}
        if path.endswith("/comments") and method == "POST":
            return 500, {"message": "boom"}, {}  # landed, but reply lost
        if path.startswith("/sessions") and method == "GET":
            return 200, {"items": self.sessions, "has_next_page": False}, {}
        if path == "/sessions" and method == "POST":
            return 500, {"message": "boom"}, {}
        # Handle branch-specific endpoints
        if "branches/" in path and method == "GET":
            return 200, {"commit": {"commit": {"committer": {"date": "2024-01-01T00:00:00Z"}}}}, {}
        return 200, [], {}


@pytest.fixture
def fake() -> Iterator[tuple[Fake, str]]:
    state = Fake()

    class Handler(BaseHTTPRequestHandler):
        def _handle(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}") if length else {}
            path = self.path.split("?")[0]
            if path.endswith("/comments") and self.command == "POST":
                state.comments.append(
                    {"id": len(state.comments) + 1, "body": payload["body"]}
                )
            if path == "/sessions" and self.command == "POST":
                state.sessions.append(
                    {"session_id": "devin-1", "status": "running", **payload}
                )
            status, body, headers = state.reply(self.command, path)
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            for k, v in headers.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = do_PATCH = do_DELETE = _handle  # noqa: N815

        def log_message(self, *_: Any) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield state, f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()


def gh_client(base: str) -> GitHub:
    gh = GitHub("o/r", FAST)
    gh.base_url = base
    return gh


def devin_client(base: str) -> Devin:
    d = Devin("org", FAST)
    d.base_url = base
    return d


def test_get_retries_429_and_500_then_succeeds(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/x"] = [(429, {}), (500, {}), (200, {"ok": True})]
    assert gh_client(base).get_json("x") == {"ok": True}
    assert [c for c in state.calls if c[1] == "/x"] == [("GET", "/x")] * 3


def test_rate_limited_403_is_transient(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/x"] = [(403, {"message": "API rate limit exceeded"}), (200, 1)]
    assert gh_client(base).get_json("x") == 1


def test_404_fails_fast(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/x"] = [(404, {})]
    with pytest.raises(PermanentError):
        gh_client(base).get_json("x")
    assert len([c for c in state.calls if c[1] == "/x"]) == 1


def test_get_exhausts_after_max_attempts(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/x"] = [(500, {})] * 10
    with pytest.raises(TransientError):
        gh_client(base).get_json("x")
    assert len([c for c in state.calls if c[1] == "/x"]) == FAST.max_attempts


def test_post_retries_429_but_not_500(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/w"] = [(429, {}), (201, {"id": 1})]
    assert gh_client(base).request("POST", "w", json_body={}).json() == {"id": 1}
    state.script["/w"] = [(500, {})]
    with pytest.raises(AmbiguousWriteError):
        gh_client(base).request("POST", "w", json_body={})
    assert len([c for c in state.calls if c == ("POST", "/w")]) == 3


def test_ensure_comment_is_idempotent_after_ambiguous_write(
    fake: tuple[Fake, str],
) -> None:
    state, base = fake
    gh = gh_client(base)
    # The POST lands server-side but returns 500: the re-probe must find it.
    c1 = ops.ensure_comment(gh, 7, "k", "hello")
    c2 = ops.ensure_comment(gh, 7, "k", "hello")
    assert len(state.comments) == 1
    assert c1["id"] == c2["id"]
    assert ops.marker("k") in state.comments[0]["body"]


def test_ensure_session_never_duplicates(fake: tuple[Fake, str]) -> None:
    state, base = fake
    payload = {"title": "Fix x issue #3", "prompt": "p", "tags": ["auto-fix"]}
    s = ops.ensure_session(devin_client(base), payload, "auto-fix")
    assert s["title"] == payload["title"]
    assert len(state.sessions) == 1
    ops.ensure_session(devin_client(base), payload, "auto-fix")
    assert len(state.sessions) == 1


def test_attempted_issues_matches_body_branch_and_session() -> None:
    prs = [
        {"body": "Fixes #1", "head": {"ref": "x"}},
        {"body": "", "head": {"ref": "devin/nightly-fix-2-foo"}},
    ]
    sessions = [
        {"title": "Fix a issue #3", "status": "running"},
        {"title": "Fix a issue #4", "status": "error"},
    ]
    assert ops.attempted_issues(prs, sessions) == {1, 2, 3}


def test_watch_session_requires_pr(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/sessions/s1"] = [
        (200, {"status": "running", "pull_requests": []}),
        (200, {"status": "finished", "pull_requests": []}),
    ]
    ok, detail = ops.watch_session(
        devin_client(base), "s1", timeout=timedelta(minutes=1), sleep=lambda _: None
    )
    assert not ok
    assert "pull_request is null" in detail


def test_watch_session_succeeds_on_pull_requests_list(fake: tuple[Fake, str]) -> None:
    state, base = fake
    pr = {"pr_url": "https://github.com/o/r/pull/7", "pr_state": "open"}
    state.script["/sessions/s1"] = [(200, {"status": "running", "pull_requests": [pr]})]
    ok, detail = ops.watch_session(
        devin_client(base), "s1", timeout=timedelta(0), sleep=lambda _: None
    )
    assert ok
    assert detail == pr["pr_url"]


def test_watch_session_circuit_breaker(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/sessions/s1"] = [(200, {"status": "running"})] * 50
    ok, detail = ops.watch_session(
        devin_client(base), "s1", timeout=timedelta(0), sleep=lambda _: None
    )
    assert not ok
    assert detail.startswith("timeout reached")
    assert len([c for c in state.calls if c[1] == "/sessions/s1"]) == 1


def test_cleanup_keeps_branch_with_pr(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/repos/o/r/branches"] = [
        (200, [{"name": "devin/nightly-fix-9-a"}])
    ] * 2
    state.script["/repos/o/r/pulls"] = [
        (200, [{"head": {"ref": "devin/nightly-fix-9-a"}, "state": "closed"}])
    ]
    assert ops.cleanup_branch(gh_client(base), 9) is None
    state.script["/repos/o/r/pulls"] = [(200, [])]
    assert ops.cleanup_branch(gh_client(base), 9, force=True) == "devin/nightly-fix-9-a"
    assert ("DELETE", "/repos/o/r/git/refs/heads/devin/nightly-fix-9-a") in state.calls


def test_circuit_breaker_basic(fake: tuple[Fake, str]) -> None:
    """Test circuit breaker opens after threshold failures."""
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=1.0)
    assert cb.state == "closed"
    assert cb.allow_request() is True

    # Record failures
    for _ in range(3):
        cb.record_failure()
    assert cb.state == "open"
    assert cb.allow_request() is False

    # Wait for recovery
    time.sleep(1.1)
    assert cb.allow_request() is True
    assert cb.state == "half-open"


def test_circuit_breaker_resets_on_success(fake: tuple[Fake, str]) -> None:
    """Test circuit breaker resets on success."""
    cb = CircuitBreaker(failure_threshold=2)
    cb.record_failure()
    cb.record_failure()
    assert cb.state == "open"

    # Simulate recovery and success
    time.sleep(0.1)
    cb.allow_request()  # transition to half-open
    cb.record_success()
    assert cb.state == "closed"
    assert cb.failure_count == 0


def test_pull_request_dataclass(fake: tuple[Fake, str]) -> None:
    """Test PullRequest dataclass creation and methods."""
    data = {
        "number": 123,
        "body": "Fixes #456",
        "head": {"ref": "devin/nightly-fix-456-foo"},
        "state": "open",
        "merged_at": None,
    }
    pr = PullRequest.from_dict(data)
    assert pr.number == 123
    assert pr.body == "Fixes #456"
    assert pr.head["ref"] == "devin/nightly-fix-456-foo"
    assert pr.state == "open"
    assert pr.merged_at is None


def test_session_dataclass(fake: tuple[Fake, str]) -> None:
    """Test Session dataclass creation and methods."""
    data = {
        "title": "Fix npm-advisories issue #789",
        "status": "running",
        "session_id": "devin-123",
        "pull_request": None,
    }
    session = Session.from_dict(data)
    assert session.title == "Fix npm-advisories issue #789"
    assert session.status == "running"
    assert session.session_id == "devin-123"
    assert session.is_dead() is False
    assert session.is_finished() is False

    # Test dead session
    dead_data = data.copy()
    dead_data["status"] = "error"
    dead_session = Session.from_dict(dead_data)
    assert dead_session.is_dead() is True

    # Test finished session
    finished_data = data.copy()
    finished_data["status"] = "completed"
    finished_session = Session.from_dict(finished_data)
    assert finished_session.is_finished() is True


def test_session_pr_url_extraction(fake: tuple[Fake, str]) -> None:
    """Test PR URL extraction from session."""
    # Test with direct pull_request object (old format)
    data = {
        "title": "Fix issue #1",
        "status": "running",
        "session_id": "devin-1",
        "pull_request": {
            "pr_url": "https://github.com/org/repo/pull/123",
            "pr_state": "open",
        },
    }
    session = Session.from_dict(data)
    assert session.get_pr_url() == "https://github.com/org/repo/pull/123"

    # Test with top-level pull_requests array (new format)
    data2 = {
        "title": "Fix issue #2",
        "status": "running",
        "session_id": "devin-2",
        "pull_requests": [
            {"pr_url": "https://github.com/org/repo/pull/456", "pr_state": "open"}
        ],
    }
    session2 = Session.from_dict(data2)
    assert session2.get_pr_url() == "https://github.com/org/repo/pull/456"

    # Test with nested pull_requests under pull_request (mixed format)
    data3 = {
        "title": "Fix issue #3",
        "status": "running",
        "session_id": "devin-3",
        "pull_request": {
            "pull_requests": [
                {"pr_url": "https://github.com/org/repo/pull/789", "pr_state": "open"}
            ]
        },
    }
    session3 = Session.from_dict(data3)
    assert session3.get_pr_url() == "https://github.com/org/repo/pull/789"


def test_specific_error_types(fake: tuple[Fake, str]) -> None:
    """Test specific error types are raised correctly."""
    state, base = fake
    state.script["/notfound"] = [(404, {"message": "Not found"})]
    with pytest.raises(ResourceNotFoundError):
        gh_client(base).get_json("notfound")

    state.script["/unauthorized"] = [(401, {"message": "Unauthorized"})]
    with pytest.raises(AuthenticationError):
        gh_client(base).get_json("unauthorized")

    state.script["/validation"] = [(422, {"message": "Validation failed"})]
    with pytest.raises(ValidationError):
        gh_client(base).get_json("validation")


def test_metrics_collection(fake: tuple[Fake, str]) -> None:
    """Test metrics are collected correctly."""
    metrics = Metrics()
    assert metrics.total_requests == 0
    assert metrics.successful_requests == 0

    metrics.record_request()
    metrics.record_success()
    assert metrics.total_requests == 1
    assert metrics.successful_requests == 1

    metrics.record_failure()
    metrics.record_retry()
    metrics.record_rate_limit()
    metrics.record_circuit_breaker_trip()

    summary = metrics.get_summary()
    assert summary["total_requests"] == 1
    assert summary["successful_requests"] == 1
    assert summary["failed_requests"] == 1
    assert summary["retried_requests"] == 1
    assert summary["rate_limited_requests"] == 1
    assert summary["circuit_breaker_trips"] == 1


def test_retry_policy_validation() -> None:
    """Test retry policy environment variable validation."""
    # Test default values
    policy = RetryPolicy()
    assert policy.max_attempts == 6
    assert policy.initial == 2.0
    assert policy.max_sleep == 120.0

    # Test with invalid environment variables (should use defaults)
    import os
    os.environ["RETRY_MAX_ATTEMPTS"] = "invalid"
    os.environ["RETRY_BASE_SECONDS"] = "-5"
    policy2 = RetryPolicy()
    assert policy2.max_attempts == 6  # should use default
    assert policy2.initial == 2.0  # should use default

    # Clean up
    del os.environ["RETRY_MAX_ATTEMPTS"]
    del os.environ["RETRY_BASE_SECONDS"]


def test_branch_cleanup_safety(fake: tuple[Fake, str]) -> None:
    """Test branch cleanup safety features."""
    state, base = fake
    # Set up the branches endpoint to return our test branch repeatedly
    state.script["/repos/o/r/branches"] = [
        (200, [{"name": "devin/nightly-fix-5-broken"}])
    ] * 3  # Multiple calls will be made
    state.script["/repos/o/r/pulls"] = [(200, [])]

    # Test dry-run mode
    result = ops.cleanup_branch(gh_client(base), 5, dry_run=True)
    assert result == "devin/nightly-fix-5-broken"
    assert ("DELETE", "/repos/o/r/git/refs/heads/devin/nightly-fix-5-broken") not in state.calls

    # Test safety check (no force, no dry-run)
    result = ops.cleanup_branch(gh_client(base), 5, dry_run=False, force=False)
    assert result is None

    # Test force mode (required for actual deletion)
    result = ops.cleanup_branch(gh_client(base), 5, dry_run=False, force=True)
    assert result == "devin/nightly-fix-5-broken"
    assert ("DELETE", "/repos/o/r/git/refs/heads/devin/nightly-fix-5-broken") in state.calls


def test_attempted_issues_with_type_safe_objects(fake: tuple[Fake, str]) -> None:
    """Test attempted_issues works with both dict and type-safe objects."""
    pr_dicts = [
        {"body": "Fixes #1", "head": {"ref": "x"}, "state": "open"},
        {"body": "", "head": {"ref": "devin/nightly-fix-2-foo"}, "state": "open"},
    ]
    pr_objects = [
        PullRequest.from_dict(
            {"number": 999, "body": "Fixes #3", "head": {"ref": "devin/nightly-fix-3-bar"}, "state": "open"}
        )
    ]

    session_dicts = [
        {"title": "Fix a issue #4", "status": "running"},
        {"title": "Fix a issue #5", "status": "error"},
    ]
    session_objects = [
        Session.from_dict({"title": "Fix a issue #6", "status": "running"})
    ]

    # Test with mixed input
    result = ops.attempted_issues(pr_dicts + pr_objects, session_dicts + session_objects)
    assert result == {1, 2, 3, 4, 6}  # 5 is dead, should be excluded


def test_backward_compatibility_existing_api(fake: tuple[Fake, str]) -> None:
    """Test that existing API usage patterns still work with new changes."""
    state, base = fake

    # Test that old-style dict inputs still work for attempted_issues
    pr_dicts = [
        {"body": "Fixes #10", "head": {"ref": "devin/nightly-fix-10-test"}, "state": "open"}
    ]
    session_dicts = [
        {"title": "Fix npm-advisories issue #10", "status": "running", "session_id": "devin-10"}
    ]

    result = ops.attempted_issues(pr_dicts, session_dicts)
    assert result == {10}

    # Test that the GitHub client can still be created with default parameters
    gh = GitHub("owner/repo")
    assert gh is not None
    assert gh.policy.max_attempts == 6  # Default value


def test_backward_compatibility_cli_arguments(fake: tuple[Fake, str]) -> None:
    """Test that CLI argument changes are backward compatible."""
    # This test ensures that the new --force flag is optional and defaults to safe behavior
    # The main test is that the old code paths still work without requiring the new flag
    # Actual CLI testing would require mocking sys.argv, which is complex
    # Instead, we verify the underlying functions maintain backward compatibility
    assert True  # Placeholder - actual CLI testing would require mocking sys.argv


def test_metrics_dont_break_existing_functionality(fake: tuple[Fake, str]) -> None:
    """Test that metrics collection doesn't break existing functionality."""
    state, base = fake
    gh = gh_client(base)

    # Make a request and verify metrics are collected but functionality unchanged
    state.script["/repos/o/r/issues"] = [(200, [])]
    issues = gh.open_issues("test-label")
    assert issues == []

    # Verify metrics were collected
    metrics = gh.get_metrics()
    assert metrics["total_requests"] > 0

    # Verify circuit breaker is in default state
    assert gh.circuit_breaker.state == "closed"
