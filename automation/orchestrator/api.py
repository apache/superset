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
"""HTTP clients for GitHub and the Devin API with a shared retry policy.

Retry contract
--------------
* ``429`` and rate-limited ``403`` (primary/secondary/abuse) are retried for
  every method: the server rejected the request, nothing happened.
* ``5xx`` and transport errors (timeouts, resets) are retried for idempotent
  methods (GET/HEAD/PUT/DELETE). For POST/PATCH they raise
  :class:`AmbiguousWriteError` so the caller probes for the resource before
  writing again -- this is what keeps retries idempotent.
* Other ``4xx`` raise :class:`PermanentError` immediately.
* Waits use exponential backoff with full jitter (tenacity), capped per
  attempt and by a total budget, and honour ``Retry-After`` /
  ``X-RateLimit-Reset`` when present.

Secrets are only ever placed in request headers; they are never logged.
"""

from __future__ import annotations

import email.utils
import logging
import os
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any

import requests
from tenacity import (
    retry_if_exception_type,
    RetryCallState,
    Retrying,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
)

log = logging.getLogger("automation.api")

IDEMPOTENT_METHODS = frozenset({"GET", "PUT", "DELETE"})
RATE_LIMIT_MARKERS = ("rate limit", "abuse detection", "too many requests")


class ApiError(Exception):
    """Base class for API failures."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class TransientError(ApiError):
    """Safe to retry: the request was rejected or the read failed."""

    def __init__(
        self, message: str, status: int | None = None, retry_after: float | None = None
    ) -> None:
        super().__init__(message, status)
        self.retry_after = retry_after


class AmbiguousWriteError(ApiError):
    """A write may or may not have landed; probe before repeating it."""


class PermanentError(ApiError):
    """Client error that will not succeed on retry (401/404/422...)."""


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = int(os.environ.get("RETRY_MAX_ATTEMPTS", "6"))
    initial: float = float(os.environ.get("RETRY_BASE_SECONDS", "2"))
    max_sleep: float = float(os.environ.get("RETRY_MAX_SLEEP", "120"))
    budget_seconds: float = float(os.environ.get("RETRY_BUDGET_SECONDS", "900"))
    timeout: float = float(os.environ.get("HTTP_TIMEOUT", "60"))


def _wait(policy: RetryPolicy) -> Callable[[RetryCallState], float]:
    """Exponential backoff with full jitter, overridden by a server hint."""
    jitter = wait_exponential_jitter(initial=policy.initial, max=policy.max_sleep)

    def wait(state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, TransientError) and exc.retry_after is not None:
            return min(max(exc.retry_after, 0.0), policy.max_sleep)
        return float(jitter(state))

    return wait


def _retry_after_seconds(headers: Any) -> float | None:
    """Parse Retry-After (seconds or HTTP-date) or X-RateLimit-Reset (epoch)."""
    if raw := headers.get("Retry-After"):
        try:
            return float(raw)
        except ValueError:
            parsed = email.utils.parsedate_to_datetime(raw)
            return max(parsed.timestamp() - time.time(), 0.0)
    reset = headers.get("X-RateLimit-Reset")
    remaining = headers.get("X-RateLimit-Remaining")
    if reset and remaining == "0":
        try:
            return max(float(reset) - time.time(), 0.0)
        except ValueError:
            return None
    return None


def _log_retry(policy: RetryPolicy) -> Callable[[RetryCallState], None]:
    def before_sleep(state: RetryCallState) -> None:
        log.warning(
            "%s. Attempt %d/%d failed, retrying in %.1fs",
            state.outcome.exception() if state.outcome else "",
            state.attempt_number,
            policy.max_attempts,
            state.next_action.sleep if state.next_action else 0.0,
        )

    return before_sleep


@dataclass
class BaseClient:
    """A ``requests`` session with the shared retry policy applied."""

    base_url: str
    token_env: str
    policy: RetryPolicy = field(default_factory=RetryPolicy)
    user_agent: str = "superset-automation-orchestrator"
    session: requests.Session = field(default_factory=requests.Session)

    def _headers(self) -> dict[str, str]:
        headers = {"User-Agent": self.user_agent, "Accept": "application/json"}
        if token := os.environ.get(self.token_env):
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _classify(self, resp: requests.Response, method: str, context: str) -> None:
        status = resp.status_code
        if status < 400:
            return
        body = resp.text[:300]
        snippet = f"HTTP {status} {resp.reason}: {body}"
        if status == 429 or (
            status == 403
            and (
                resp.headers.get("X-RateLimit-Remaining") == "0"
                or any(m in body.lower() for m in RATE_LIMIT_MARKERS)
            )
        ):
            raise TransientError(
                f"{context} rate limited ({snippet})",
                status,
                _retry_after_seconds(resp.headers),
            )
        if status >= 500:
            if method in IDEMPOTENT_METHODS:
                raise TransientError(f"{context} {snippet}", status)
            raise AmbiguousWriteError(f"{context} {snippet}", status)
        raise PermanentError(f"{context} {snippet}", status)

    def _once(
        self,
        method: str,
        path: str,
        context: str,
        params: dict[str, Any] | None,
        json_body: Any,
    ) -> requests.Response:
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        try:
            resp = self.session.request(
                method,
                url,
                headers=self._headers(),
                params=params,
                json=json_body,
                timeout=self.policy.timeout,
            )
        except (requests.ConnectionError, requests.Timeout) as exc:
            reason = f"{context} {type(exc).__name__}"
            if method in IDEMPOTENT_METHODS:
                raise TransientError(reason) from exc
            raise AmbiguousWriteError(reason) from exc
        self._classify(resp, method, context)
        return resp

    def request(
        self,
        method: str,
        path: str,
        *,
        context: str = "",
        params: dict[str, Any] | None = None,
        json_body: Any = None,
    ) -> requests.Response:
        """Perform one logical request under the retry contract."""
        method = method.upper()
        context = context or f"{method} {path}"
        retrying = Retrying(
            retry=retry_if_exception_type(TransientError),
            wait=_wait(self.policy),
            stop=(
                stop_after_attempt(self.policy.max_attempts)
                | stop_after_delay(self.policy.budget_seconds)
            ),
            before_sleep=_log_retry(self.policy),
            reraise=True,
        )
        return retrying(self._once, method, path, context, params, json_body)

    def get_json(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs).json()


class GitHub(BaseClient):
    """GitHub REST client bound to one repository."""

    def __init__(self, repo: str, policy: RetryPolicy | None = None) -> None:
        super().__init__(
            base_url=os.environ.get("GITHUB_API", "https://api.github.com"),
            token_env="GH_TOKEN",  # noqa: S106 -- env var name, not a secret
            policy=policy or RetryPolicy(),
        )
        self.repo = repo

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        headers["X-GitHub-Api-Version"] = "2022-11-28"
        headers["Accept"] = "application/vnd.github+json"
        return headers

    def paginate(self, path: str, **params: Any) -> Iterator[dict[str, Any]]:
        params.setdefault("per_page", 100)
        url: str | None = f"repos/{self.repo}/{path}"
        while url:
            resp = self.request("GET", url, params=params)
            yield from resp.json()
            url = resp.links.get("next", {}).get("url")
            params = {}

    def open_issues(self, label: str) -> list[dict[str, Any]]:
        return [
            i
            for i in self.paginate("issues", state="open", labels=label)
            if "pull_request" not in i
        ]

    def pulls(self, state: str = "all") -> list[dict[str, Any]]:
        return list(self.paginate("pulls", state=state))

    def branch_commit_date(self, name: str) -> str:
        data = self.get_json(f"repos/{self.repo}/branches/{name}")
        return str(data["commit"]["commit"]["committer"]["date"])

    def delete_branch(self, name: str) -> None:
        self.request(
            "DELETE",
            f"repos/{self.repo}/git/refs/heads/{name}",
            context=f"delete branch {name}",
        )

    def comments(self, issue: int) -> list[dict[str, Any]]:
        return list(self.paginate(f"issues/{issue}/comments"))

    def create_comment(self, issue: int, body: str) -> dict[str, Any]:
        return self.request(
            "POST",
            f"repos/{self.repo}/issues/{issue}/comments",
            context=f"[Issue #{issue}] create comment",
            json_body={"body": body},
        ).json()

    def update_comment(self, comment_id: int, body: str) -> dict[str, Any]:
        return self.request(
            "PATCH",
            f"repos/{self.repo}/issues/comments/{comment_id}",
            context=f"update comment {comment_id}",
            json_body={"body": body},
        ).json()


class Devin(BaseClient):
    """Devin v3 organization API client."""

    def __init__(self, org_id: str, policy: RetryPolicy | None = None) -> None:
        super().__init__(
            base_url=os.environ.get(
                "DEVIN_API", f"https://api.devin.ai/v3/organizations/{org_id}"
            ),
            token_env="DEVIN_API_KEY",  # noqa: S106 -- env var name, not a secret
            policy=policy or RetryPolicy(),
        )

    def list_sessions(self, tag: str) -> Iterator[dict[str, Any]]:
        after: str | None = None
        while True:
            params: dict[str, Any] = {"tags": tag, "limit": 100}
            if after:
                params["after"] = after
            page = self.get_json("sessions", params=params)
            yield from page.get("items") or page.get("sessions") or []
            if not page.get("has_next_page"):
                return
            after = page.get("end_cursor")
            if not after:
                return

    def get_session(self, session_id: str) -> dict[str, Any]:
        return self.get_json(f"sessions/{session_id}")

    def create_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.request(
            "POST",
            "sessions",
            context=f"create session {payload.get('title', '')!r}",
            json_body=payload,
        ).json()


def session_url(session: dict[str, Any]) -> str:
    sid = str(session.get("session_id") or session.get("id") or "")
    return str(
        session.get("url")
        or f"https://app.devin.ai/sessions/{sid.removeprefix('devin-')}"
    )
