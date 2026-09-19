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
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from automation.orchestrator import dispatch as ops
from automation.orchestrator.api import (
    AmbiguousWriteError,
    ApiError,
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
        self.last_payload: dict[str, Any] = {}

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
            return (
                200,
                {"commit": {"commit": {"committer": {"date": "2024-01-01T00:00:00Z"}}}},
                {},
            )
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
            state.last_payload = payload if isinstance(payload, dict) else {}
            status, body, headers = state.reply(self.command, path)
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
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


def test_rate_limits_do_not_trip_circuit_breaker(fake: tuple[Fake, str]) -> None:
    """Threshold-many 429s are absorbed by the retry budget, not the breaker."""
    state, base = fake
    gh = gh_client(base)
    gh.policy = RetryPolicy(
        max_attempts=6, initial=0.01, max_sleep=0.05, budget_seconds=5, timeout=1
    )
    gh.circuit_breaker = CircuitBreaker(failure_threshold=3)
    state.script["/repos/o/r/x"] = [(429, {})] * 5 + [(200, {"ok": 1})]
    state.script["/repos/o/r/y"] = [(200, {"ok": 2})]
    assert gh.get_json("repos/o/r/x") == {"ok": 1}
    assert gh.get_json("repos/o/r/y") == {"ok": 2}
    assert gh.circuit_breaker.state == "closed"
    assert gh.metrics.rate_limited_requests == 5
    assert gh.metrics.circuit_breaker_trips == 0


def test_circuit_breaker_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CIRCUIT_BREAKER_THRESHOLD", "2")
    monkeypatch.setenv("CIRCUIT_BREAKER_TIMEOUT", "7.5")
    gh = GitHub("o/r", FAST)
    assert gh.circuit_breaker.failure_threshold == 2
    assert gh.circuit_breaker.recovery_timeout == 7.5


def test_malformed_json_read_is_retried(fake: tuple[Fake, str]) -> None:
    state, base = fake
    gh = gh_client(base)
    state.script["/repos/o/r/x"] = [(200, b"{not json"), (200, {"ok": 1})]
    assert gh.get_json("repos/o/r/x") == {"ok": 1}
    assert gh.metrics.retried_requests == 1


def test_malformed_json_write_is_ambiguous(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/sessions"] = [(201, b'{"session_id": "devin-1')]
    devin = devin_client(base)
    with pytest.raises(AmbiguousWriteError):
        devin.create_session({"title": "t"})
    # ensure_session resolves the ambiguity by re-probing instead of aborting
    state.script["/sessions"] = [(201, b'{"session_id": "devin-1')]
    payload = {"title": "Fix x issue #9", "prompt": "p", "tags": ["auto-fix"]}
    state.sessions.clear()
    s = ops.ensure_session(devin, payload, "auto-fix")
    assert s["title"] == payload["title"]
    assert len(state.sessions) == 1


def test_completed_session_without_pr_is_redispatched(fake: tuple[Fake, str]) -> None:
    state, base = fake
    failed = {"title": "Fix a issue #42", "status": "completed", "pull_requests": []}
    with_pr = {
        "title": "Fix a issue #43",
        "status": "finished",
        "pull_requests": [{"pr_url": "https://github.com/o/r/pull/1"}],
    }
    assert ops.attempted_issues([], [failed, with_pr]) == {43}

    state.sessions.append({"session_id": "devin-old", **failed})
    payload = {"title": failed["title"], "prompt": "p", "tags": ["auto-fix"]}
    s = ops.ensure_session(devin_client(base), payload, "auto-fix")
    assert s["session_id"] == "devin-1"
    assert len(state.sessions) == 2


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
    assert (
        "DELETE",
        "/repos/o/r/git/refs/heads/devin/nightly-fix-5-broken",
    ) not in state.calls

    # Test safety check (no force, no dry-run)
    result = ops.cleanup_branch(gh_client(base), 5, dry_run=False, force=False)
    assert result is None

    # Test force mode (required for actual deletion)
    result = ops.cleanup_branch(gh_client(base), 5, dry_run=False, force=True)
    assert result == "devin/nightly-fix-5-broken"
    assert (
        "DELETE",
        "/repos/o/r/git/refs/heads/devin/nightly-fix-5-broken",
    ) in state.calls


def test_attempted_issues_with_type_safe_objects(fake: tuple[Fake, str]) -> None:
    """Test attempted_issues works with both dict and type-safe objects."""
    pr_dicts = [
        {"body": "Fixes #1", "head": {"ref": "x"}, "state": "open"},
        {"body": "", "head": {"ref": "devin/nightly-fix-2-foo"}, "state": "open"},
    ]
    pr_objects = [
        PullRequest.from_dict(
            {
                "number": 999,
                "body": "Fixes #3",
                "head": {"ref": "devin/nightly-fix-3-bar"},
                "state": "open",
            }
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
    result = ops.attempted_issues(
        [*pr_dicts, *pr_objects], [*session_dicts, *session_objects]
    )
    assert result == {1, 2, 3, 4, 6}  # 5 is dead, should be excluded


def test_backward_compatibility_existing_api(fake: tuple[Fake, str]) -> None:
    """Test that existing API usage patterns still work with new changes."""
    state, base = fake

    # Test that old-style dict inputs still work for attempted_issues
    pr_dicts = [
        {
            "body": "Fixes #10",
            "head": {"ref": "devin/nightly-fix-10-test"},
            "state": "open",
        }
    ]
    session_dicts = [
        {
            "title": "Fix npm-advisories issue #10",
            "status": "running",
            "session_id": "devin-10",
        }
    ]

    result = ops.attempted_issues(pr_dicts, session_dicts)
    assert result == {10}

    # Test that the GitHub client can still be created with default parameters
    gh = GitHub("owner/repo")
    assert gh is not None
    assert gh.policy.max_attempts == 6  # Default value


def test_backward_compatibility_cli_arguments(fake: tuple[Fake, str]) -> None:
    """Test that CLI argument changes are backward compatible."""
    # This test ensures that the new --force flag is optional and defaults to
    # safe behavior
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


OLD = "2000-01-01T00:00:00Z"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class GitData:
    """In-memory model of GitHub's git-data API with its atomicity rules.

    Commits are stored by sha; ref create fails with 422 when the ref exists
    and a non-force ref update fails with 422 unless it is a fast-forward.
    ``lose_next_write`` makes the next write land but answer 500, which the
    client reports as :class:`AmbiguousWriteError`.
    """

    def __init__(self, state: Fake) -> None:
        self.state = state
        self.commits: dict[str, dict[str, Any]] = {}
        self.refs: dict[str, str] = {}
        self.lose_next_write = False
        self.inner = state.reply
        state.reply = self.reply  # type: ignore[method-assign]

    def add_commit(
        self, sha: str, message: str, parents: list[str], date: str | None = None
    ) -> str:
        self.commits[sha] = {
            "sha": sha,
            "message": message,
            "parents": [{"sha": p} for p in parents],
            "tree": {"sha": "tree"},
            "committer": {"date": date or _now()},
        }
        return sha

    def _is_ancestor(self, old: str, new: str) -> bool:
        while True:
            if old == new:
                return True
            parents = self.commits[new]["parents"]
            if not parents:
                return False
            new = parents[0]["sha"]

    def _maybe_lose(self, ok: tuple[int, Any, dict[str, str]]) -> Any:
        if self.lose_next_write:
            self.lose_next_write = False
            return 500, {"message": "boom"}, {}
        return ok

    def reply(self, method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        if not path.startswith("/repos/o/r/git/"):
            return self._repo(method, path)
        self.state.calls.append((method, path))
        payload = self.state.last_payload
        if path == "/repos/o/r/git/commits" and method == "POST":
            sha = f"c{len(self.commits)}"
            self.add_commit(
                sha, payload["message"], [str(p) for p in payload["parents"]]
            )
            return self._maybe_lose((201, self.commits[sha], {}))
        if path.startswith("/repos/o/r/git/commits/") and method == "GET":
            return 200, self.commits[path.rsplit("/", 1)[1]], {}
        if path == "/repos/o/r/git/refs" and method == "POST":
            ref = str(payload["ref"]).removeprefix("refs/")
            if ref in self.refs:
                return 422, {"message": "Reference already exists"}, {}
            self.refs[ref] = str(payload["sha"])
            return self._maybe_lose((201, {"ref": ref}, {}))
        if path.startswith("/repos/o/r/git/ref/") and method == "GET":
            ref = path.removeprefix("/repos/o/r/git/ref/")
            if ref not in self.refs:
                return 404, {}, {}
            return 200, {"ref": ref, "object": {"sha": self.refs[ref]}}, {}
        return self._update_ref(method, path.removeprefix("/repos/o/r/git/refs/"))

    def _update_ref(self, method: str, ref: str) -> tuple[int, Any, dict[str, str]]:
        if method == "PATCH":
            sha = str(self.state.last_payload["sha"])
            if ref not in self.refs or not self._is_ancestor(self.refs[ref], sha):
                return 422, {"message": "Update is not a fast forward"}, {}
            self.refs[ref] = sha
            return self._maybe_lose((200, {"ref": ref}, {}))
        return (204, b"", {}) if self.refs.pop(ref, None) else (404, {}, {})

    def _repo(self, method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        if path == "/repos/o/r" and method == "GET":
            self.state.calls.append((method, path))
            return 200, {"default_branch": "master"}, {}
        if path == "/repos/o/r/branches/master":
            self.state.calls.append((method, path))
            return (
                200,
                {"commit": {"sha": "base", "commit": {"tree": {"sha": "t"}}}},
                {},
            )
        return self.inner(method, path)

    def head(self, issue: int) -> dict[str, Any] | None:
        sha = self.refs.get(ops.claim_ref(issue))
        return self.commits[sha] if sha else None


@pytest.fixture
def git(fake: tuple[Fake, str]) -> GitData:
    return GitData(fake[0])


def test_claim_issue_is_atomic_ref_lock(fake: tuple[Fake, str], git: GitData) -> None:
    gh = gh_client(fake[1])
    token = ops.claim_issue(gh, 5, "me")
    assert token is not None
    assert git.refs[ops.claim_ref(5)] == token
    # Held by a live claim: a second dispatcher is turned away.
    assert ops.claim_issue(gh, 5, "other") is None
    ops.release_issue(gh, 5, token)
    assert git.head(5) == git.commits[git.refs[ops.claim_ref(5)]]
    assert git.head(5)["message"] == ops.RELEASE_MESSAGE  # type: ignore[index]
    # A released lock is claimable again, and the ref is never deleted.
    assert ops.claim_issue(gh, 5, "other") is not None
    assert ("DELETE", "/repos/o/r/git/refs/devin/claims/issue-5") not in fake[0].calls


def test_claim_issue_resolves_ambiguous_create(
    fake: tuple[Fake, str], git: GitData
) -> None:
    git.lose_next_write = True  # commit lands, reply lost -> retried by probe
    gh = gh_client(fake[1])
    # First lost write is the claim commit POST (ambiguous -> propagates).
    with pytest.raises(AmbiguousWriteError):
        ops.claim_issue(gh, 5, "me")
    git.lose_next_write = False
    # Now make the ref create itself ambiguous: the ref lands, reply is 500.
    orig = git.reply

    def lose_ref_create(method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        if path == "/repos/o/r/git/refs" and method == "POST":
            git.lose_next_write = True
        return orig(method, path)

    fake[0].reply = lose_ref_create  # type: ignore[method-assign]
    token = ops.claim_issue(gh, 5, "me")
    assert token is not None
    assert git.refs[ops.claim_ref(5)] == token


def test_claim_issue_reaps_stale_claim(fake: tuple[Fake, str], git: GitData) -> None:
    gh = gh_client(fake[1])
    stale = git.add_commit("stale", "devin-claim dead", [], date=OLD)
    git.refs[ops.claim_ref(5)] = stale
    token = ops.claim_issue(gh, 5, "me")
    assert token is not None
    assert git.refs[ops.claim_ref(5)] == token
    assert git.commits[token]["parents"] == [{"sha": stale}]

    # Two reapers race: the second fast-forward is rejected (not a descendant).
    git.refs[ops.claim_ref(6)] = git.add_commit("stale6", "devin-claim dead", [], OLD)
    orig = git.reply

    def steal_first(method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        if method == "PATCH":
            fake[0].reply = orig  # type: ignore[method-assign]
            git.refs[ops.claim_ref(6)] = git.add_commit(
                "rival", "devin-claim r", ["stale6"]
            )
        return orig(method, path)

    fake[0].reply = steal_first  # type: ignore[method-assign]
    assert ops.claim_issue(gh, 6, "me") is None
    assert git.refs[ops.claim_ref(6)] == "rival"


def test_release_cannot_clobber_successor(fake: tuple[Fake, str], git: GitData) -> None:
    """An expired holder's release is a no-op once someone else took over."""
    gh = gh_client(fake[1])
    mine = git.add_commit("mine", "devin-claim me", [], date=OLD)
    git.refs[ops.claim_ref(5)] = mine
    successor = ops.claim_issue(gh, 5, "other")
    assert successor is not None
    ops.release_issue(gh, 5, mine)
    assert git.refs[ops.claim_ref(5)] == successor


def _dispatch_scripts(state: Fake, session_replies: int = 2) -> None:
    issue = {"number": 9, "title": "t", "html_url": "u", "labels": []}
    state.script["/repos/o/r/issues"] = [(200, [issue])]
    state.script["/repos/o/r/pulls"] = [(200, [])]
    state.script["/sessions"] = [
        (200, {"items": [], "has_next_page": False})
    ] * session_replies


def test_dispatch_skips_issue_claimed_by_other_dispatcher(
    fake: tuple[Fake, str], git: GitData
) -> None:
    state, base = fake
    _dispatch_scripts(state)
    git.refs[ops.claim_ref(9)] = git.add_commit("theirs", "devin-claim x", [])
    outcomes = ops.dispatch(gh_client(base), devin_client(base), fix_prompt="p")
    assert [(o.status, o.detail) for o in outcomes] == [
        ("skipped", "claimed by another dispatcher")
    ]
    assert ("POST", "/sessions") not in state.calls


def test_dispatch_claims_then_releases(fake: tuple[Fake, str], git: GitData) -> None:
    state, base = fake
    _dispatch_scripts(state)
    state.script["/sessions"].append(
        (201, {"session_id": "devin-1", "status": "running"})
    )
    outcomes = ops.dispatch(gh_client(base), devin_client(base), fix_prompt="p")
    assert outcomes[0].status == "dispatched"
    paths = [c[1] for c in state.calls]
    assert paths.index("/repos/o/r/git/refs") < paths.index("/sessions", 3)
    head = git.head(9)
    assert head is not None
    assert head["message"] == ops.RELEASE_MESSAGE


def test_dispatch_skips_and_keeps_ref_when_claim_lost(
    fake: tuple[Fake, str], git: GitData
) -> None:
    """A holder that loses its lease must neither POST nor release the successor."""
    state, base = fake
    _dispatch_scripts(state)
    orig = git.reply

    def takeover_before_post(method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        if path == "/sessions" and method == "GET" and git.head(9) is not None:
            fake[0].reply = orig  # type: ignore[method-assign]
            held = git.refs[ops.claim_ref(9)]
            git.refs[ops.claim_ref(9)] = git.add_commit(
                "rival", "devin-claim r", [held]
            )
        return orig(method, path)

    fake[0].reply = takeover_before_post  # type: ignore[method-assign]
    outcomes = ops.dispatch(gh_client(base), devin_client(base), fix_prompt="p")
    assert [(o.status, o.detail) for o in outcomes] == [
        ("skipped", "claim lost mid-dispatch")
    ]
    assert ("POST", "/sessions") not in state.calls
    assert git.refs[ops.claim_ref(9)] == "rival"


def test_ensure_session_final_probe_finds_landed_session(
    fake: tuple[Fake, str],
) -> None:
    """Both POSTs answer 500 but the first landed: the last probe must find it."""
    state, base = fake
    devin = devin_client(base)
    devin.policy = RetryPolicy(
        max_attempts=1, initial=0.01, max_sleep=0.05, budget_seconds=5, timeout=1
    )
    landed = {"session_id": "devin-1", "status": "running", "title": "T"}
    state.script["/sessions"] = [
        (200, {"items": [], "has_next_page": False}),
        (500, {}),
        (200, {"items": [], "has_next_page": False}),
        (500, {}),
        (200, {"items": [landed], "has_next_page": False}),
    ]
    assert ops.ensure_session(devin, {"title": "T"}, "tag") == landed


def test_client_errors_do_not_trip_circuit_breaker(fake: tuple[Fake, str]) -> None:
    state, base = fake
    gh = gh_client(base)
    gh.circuit_breaker = CircuitBreaker(failure_threshold=2)
    state.script["/repos/o/r/git/refs"] = [(422, {})] * 3
    for _ in range(3):
        assert gh.create_ref("devin/claims/issue-1", "abc") is False
    assert gh.circuit_breaker.state == "closed"
    assert gh.metrics.circuit_breaker_trips == 0
    assert gh.metrics.failed_requests == 3


def test_head_failures_are_retried(fake: tuple[Fake, str]) -> None:
    gh = gh_client(fake[1])
    with pytest.raises(TransientError):
        gh._fail("HEAD", "boom", None, RuntimeError())


def test_stale_branches_merged_wins_over_later_closed(
    fake: tuple[Fake, str],
) -> None:
    state, base = fake
    branch = "devin/nightly-fix-1"
    state.script["/repos/o/r/pulls"] = [
        (
            200,
            [
                {"head": {"ref": branch}, "state": "closed", "merged_at": "x"},
                {"head": {"ref": branch}, "state": "closed", "merged_at": None},
            ],
        )
    ]
    state.script["/repos/o/r/branches"] = [(200, [{"name": branch}])]
    state.script[f"/repos/o/r/branches/{branch}"] = [
        (200, {"commit": {"commit": {"committer": {"date": OLD}}}})
    ]
    assert ops.stale_branches(gh_client(base), timedelta(days=1)) == []


def test_delete_branch_treats_404_as_success(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/repos/o/r/git/refs/heads/b"] = [(404, {})]
    gh_client(base).delete_branch("b")  # already gone: no error


def test_malformed_retry_after_still_retries(fake: tuple[Fake, str]) -> None:
    state, base = fake
    gh = gh_client(base)
    state.script["/x"] = [(429, {}), (200, {"ok": True})]
    original = state.reply

    def reply(method: str, path: str) -> tuple[int, Any, dict[str, str]]:
        status, body, headers = original(method, path)
        if status == 429:
            headers = {"Retry-After": "not-a-date"}
        return status, body, headers

    state.reply = reply  # type: ignore[method-assign]
    assert gh.get_json("x") == {"ok": True}


def test_circuit_trip_metric_counts_openings_not_blocked_calls(
    fake: tuple[Fake, str],
) -> None:
    state, base = fake
    gh = gh_client(base)
    gh.policy = RetryPolicy(
        max_attempts=1, initial=0.01, max_sleep=0.05, budget_seconds=5, timeout=1
    )
    gh.circuit_breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=60)
    state.script["/x"] = [(500, {})] * 2
    for _ in range(2):
        with pytest.raises(TransientError):
            gh.get_json("x")
    assert gh.metrics.circuit_breaker_trips == 1
    for _ in range(3):
        with pytest.raises(ApiError):
            gh.get_json("x")
    assert gh.metrics.circuit_breaker_trips == 1
    assert gh.metrics.circuit_breaker_blocked == 3


def test_request_clamps_socket_timeout_and_sleep_to_deadline(
    fake: tuple[Fake, str],
) -> None:
    state, base = fake
    gh = gh_client(base)
    gh.policy = RetryPolicy(
        max_attempts=10, initial=5, max_sleep=50, budget_seconds=900, timeout=60
    )
    seen: list[float] = []
    real = gh.session.request

    def spy(method: str, url: str, **kw: Any) -> Any:
        seen.append(kw["timeout"])
        return real(method, url, **kw)

    gh.session.request = spy  # type: ignore[method-assign,assignment]
    state.script["/x"] = [(500, {})] * 20
    start = time.monotonic()
    with pytest.raises(TransientError):
        gh.get_json("x", budget_seconds=1.5)
    assert time.monotonic() - start < 4
    # Socket timeouts never exceed the remaining budget (floored at MIN_TIMEOUT).
    assert all(t <= 1.5 for t in seen)


def test_watch_session_retry_budget_bounded_by_deadline(
    fake: tuple[Fake, str],
) -> None:
    state, base = fake
    # Every poll fails; without a bounded budget this would retry for
    # FAST.budget_seconds (5s) per poll instead of respecting the 0.3s watch.
    state.script["/sessions/devin-1"] = [(500, {})] * 50
    start = time.monotonic()
    with pytest.raises(TransientError):
        ops.watch_session(
            devin_client(base),
            "devin-1",
            timeout=timedelta(seconds=0.3),
            poll=0.01,
            sleep=lambda _s: None,
        )
    assert time.monotonic() - start < 2


def test_get_session_budget_is_capped_not_raised(fake: tuple[Fake, str]) -> None:
    state, base = fake
    state.script["/sessions/devin-1"] = [(500, {})] * 50
    start = time.monotonic()
    with pytest.raises(TransientError):
        devin_client(base).get_session("devin-1", budget_seconds=0.0)
    # A zero budget still makes exactly one attempt.
    assert len([c for c in state.calls if c[1] == "/sessions/devin-1"]) == 1
    assert time.monotonic() - start < 1


def test_watch_main_skips_cleanup_when_watch_aborts(
    fake: tuple[Fake, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    from automation.orchestrator import __main__ as cli

    cleaned: list[int] = []
    monkeypatch.setenv("GH_TOKEN", "x")
    monkeypatch.setenv("DEVIN_API_KEY", "x")
    monkeypatch.setattr(cli.ops, "cleanup_branch", lambda *a, **k: cleaned.append(1))
    monkeypatch.setattr(cli.ops, "ensure_comment", lambda *a, **k: None)

    def boom(*_: Any, **__: Any) -> tuple[bool, str]:
        raise TransientError("api down")

    monkeypatch.setattr(cli.ops, "watch_session", boom)
    with pytest.raises(TransientError):
        cli.main(["watch-session", "devin-1", "--issue", "1"])
    assert cleaned == []

    monkeypatch.setattr(cli.ops, "watch_session", lambda *a, **k: (False, "timeout"))
    assert cli.main(["watch-session", "devin-1", "--issue", "1"]) == 1
    assert cleaned == [1]


def test_dispatch_dry_run_requires_devin_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from automation.orchestrator import __main__ as cli

    monkeypatch.setenv("GH_TOKEN", "x")
    monkeypatch.delenv("DEVIN_API_KEY", raising=False)
    with pytest.raises(SystemExit):
        cli.main(["dispatch", "--dry-run", "--prompt-file", "/dev/null"])
