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
from collections.abc import Iterator
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from automation.orchestrator import dispatch as ops
from automation.orchestrator.api import (
    AmbiguousWriteError,
    Devin,
    GitHub,
    PermanentError,
    RetryPolicy,
    TransientError,
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
        (200, {"status": "running", "pull_request": None}),
        (200, {"status": "finished", "pull_request": None}),
    ]
    ok, detail = ops.watch_session(
        devin_client(base), "s1", timeout=timedelta(minutes=1), sleep=lambda _: None
    )
    assert not ok
    assert "pull_request is null" in detail


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
    assert ops.cleanup_branch(gh_client(base), 9) == "devin/nightly-fix-9-a"
    assert ("DELETE", "/repos/o/r/git/refs/heads/devin/nightly-fix-9-a") in state.calls
