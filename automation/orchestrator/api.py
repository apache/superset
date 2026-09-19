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
from typing import Any, NoReturn

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

IDEMPOTENT_METHODS = frozenset({"GET", "HEAD", "PUT", "DELETE"})
MIN_TIMEOUT = 1.0
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


class ResourceNotFoundError(PermanentError):
    """404 - resource not found"""


class AuthenticationError(PermanentError):
    """401 - authentication failed"""


class ValidationError(PermanentError):
    """422 - validation error"""


@dataclass
class CircuitBreaker:
    """Circuit breaker to prevent cascading failures after repeated errors."""

    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    failure_count: int = 0
    last_failure_time: float = 0.0
    state: str = "closed"  # closed, open, half-open

    def record_success(self) -> None:
        """Reset failure count on success."""
        self.failure_count = 0
        self.state = "closed"

    def record_failure(self) -> bool:
        """Record a failure; return ``True`` when this failure opens the circuit."""
        self.failure_count += 1
        self.last_failure_time = time.monotonic()
        if self.state != "open" and self.failure_count >= self.failure_threshold:
            self.state = "open"
            log.warning("Circuit breaker opened after %d failures", self.failure_count)
            return True
        return False

    def allow_request(self) -> bool:
        """Check if request should be allowed based on circuit state."""
        if self.state == "closed":
            return True
        if self.state == "open":
            if time.monotonic() - self.last_failure_time >= self.recovery_timeout:
                self.state = "half-open"
                log.info("Circuit breaker transitioning to half-open")
                return True
            return False
        # half-open: allow one request to test
        return True


@dataclass
class PullRequest:
    """Type-safe representation of a GitHub pull request."""

    number: int
    body: str
    head: dict[str, str]
    state: str
    merged_at: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PullRequest":
        """Create from API response."""
        return cls(
            number=int(data["number"]),
            body=data.get("body") or "",
            head=data["head"],
            state=data["state"],
            merged_at=data.get("merged_at"),
        )


@dataclass
class Session:
    """Type-safe representation of a Devin session."""

    title: str
    status: str
    session_id: str
    pull_request: dict[str, Any] | None = None
    pull_requests: list[dict[str, Any]] | None = None
    status_enum: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Session":
        """Create from API response."""
        return cls(
            title=data.get("title") or "",
            status=str(data.get("status") or data.get("status_enum") or ""),
            session_id=str(data.get("session_id") or data.get("id") or ""),
            pull_request=data.get("pull_request"),
            pull_requests=data.get("pull_requests"),
            status_enum=data.get("status_enum"),
        )

    def is_dead(self) -> bool:
        """Check if session is in a terminal failure state."""
        status = (self.status_enum or self.status).lower()
        return status in {"error", "terminated", "cancelled", "canceled"}

    def is_finished(self) -> bool:
        """Check if session is in a finished state."""
        status = (self.status_enum or self.status).lower()
        return status in {"finished", "completed", "blocked", "suspended"}

    def owns_issue(self) -> bool:
        """True while the session is running or once it has delivered a PR.

        A dead session, or a finished one without a pull request, counts as a
        failed attempt and must not suppress a fresh dispatch.
        """
        if self.is_dead():
            return False
        if self.is_finished():
            return self.get_pr_url() is not None
        return True

    def get_pr_url(self) -> str | None:
        """Extract PR URL from session data."""
        prs = []
        # Handle top-level pull_requests array (new format)
        if self.pull_requests:
            prs.extend(self.pull_requests)
        # Handle nested pull_requests under pull_request (mixed format)
        if self.pull_request:
            if "pull_requests" in self.pull_request:
                prs.extend(self.pull_request.get("pull_requests") or [])
            else:
                prs.append(self.pull_request)
        for pr in prs:
            if url := pr.get("pr_url") or pr.get("url"):
                return str(url)
        return None


@dataclass
class RetryPolicy:
    max_attempts: int = field(
        default_factory=lambda: _parse_int_env("RETRY_MAX_ATTEMPTS", 6)
    )
    initial: float = field(
        default_factory=lambda: _parse_float_env("RETRY_BASE_SECONDS", 2.0)
    )
    max_sleep: float = field(
        default_factory=lambda: _parse_float_env("RETRY_MAX_SLEEP", 120.0)
    )
    budget_seconds: float = field(
        default_factory=lambda: _parse_float_env("RETRY_BUDGET_SECONDS", 900.0)
    )
    timeout: float = field(
        default_factory=lambda: _parse_float_env("HTTP_TIMEOUT", 60.0)
    )


def _parse_int_env(name: str, default: int) -> int:
    """Parse integer environment variable with validation."""
    value = os.environ.get(name, str(default))
    try:
        parsed = int(value)
        if parsed <= 0:
            log.warning("%s must be positive, using default %d", name, default)
            return default
        return parsed
    except ValueError:
        log.warning("Invalid %s value '%s', using default %d", name, value, default)
        return default


def _parse_float_env(name: str, default: float) -> float:
    """Parse float environment variable with validation."""
    value = os.environ.get(name, str(default))
    try:
        parsed = float(value)
        if parsed <= 0:
            log.warning("%s must be positive, using default %f", name, default)
            return default
        return parsed
    except ValueError:
        log.warning("Invalid %s value '%s', using default %f", name, value, default)
        return default


def _wait(
    policy: RetryPolicy, deadline: float | None = None
) -> Callable[[RetryCallState], float]:
    """Exponential backoff with full jitter, overridden by a server hint.

    With a monotonic ``deadline`` the sleep is clamped so it never crosses it.
    """
    jitter = wait_exponential_jitter(initial=policy.initial, max=policy.max_sleep)

    def wait(state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, TransientError) and exc.retry_after is not None:
            seconds = min(max(exc.retry_after, 0.0), policy.max_sleep)
        else:
            seconds = float(jitter(state))
        if deadline is not None:
            seconds = min(seconds, max(deadline - time.monotonic(), 0.0))
        return seconds

    return wait


def _stop_at(deadline: float) -> Callable[[RetryCallState], bool]:
    def stop(_: RetryCallState) -> bool:
        return time.monotonic() >= deadline

    return stop


def _retry_after_seconds(headers: Any) -> float | None:
    """Parse Retry-After (seconds or HTTP-date) or X-RateLimit-Reset (epoch)."""
    if raw := headers.get("Retry-After"):
        try:
            return float(raw)
        except ValueError:
            try:
                parsed = email.utils.parsedate_to_datetime(raw)
                return max(parsed.timestamp() - time.time(), 0.0)
            except (TypeError, ValueError, OverflowError):
                return None
    reset = headers.get("X-RateLimit-Reset")
    remaining = headers.get("X-RateLimit-Remaining")
    if reset and remaining == "0":
        try:
            return max(float(reset) - time.time(), 0.0)
        except ValueError:
            return None
    return None


def _log_retry(
    policy: RetryPolicy, metrics: Metrics
) -> Callable[[RetryCallState], None]:
    def before_sleep(state: RetryCallState) -> None:
        metrics.record_retry()
        log.warning(
            "%s. Attempt %d/%d failed, retrying in %.1fs",
            state.outcome.exception() if state.outcome else "",
            state.attempt_number,
            policy.max_attempts,
            state.next_action.sleep if state.next_action else 0.0,
        )

    return before_sleep


@dataclass
class Metrics:
    """Simple metrics collection for monitoring."""

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    retried_requests: int = 0
    rate_limited_requests: int = 0
    circuit_breaker_trips: int = 0
    circuit_breaker_blocked: int = 0

    def record_request(self) -> None:
        """Record a request attempt."""
        self.total_requests += 1

    def record_success(self) -> None:
        """Record a successful request."""
        self.successful_requests += 1

    def record_failure(self) -> None:
        """Record a failed request."""
        self.failed_requests += 1

    def record_retry(self) -> None:
        """Record a retried request."""
        self.retried_requests += 1

    def record_rate_limit(self) -> None:
        """Record a rate-limited request."""
        self.rate_limited_requests += 1

    def record_circuit_breaker_trip(self) -> None:
        """Record the breaker transitioning to open."""
        self.circuit_breaker_trips += 1

    def record_circuit_breaker_blocked(self) -> None:
        """Record a request rejected while the breaker is open."""
        self.circuit_breaker_blocked += 1

    def get_summary(self) -> dict[str, int]:
        """Get metrics summary as dict."""
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "retried_requests": self.retried_requests,
            "rate_limited_requests": self.rate_limited_requests,
            "circuit_breaker_trips": self.circuit_breaker_trips,
            "circuit_breaker_blocked": self.circuit_breaker_blocked,
        }


@dataclass
class BaseClient:
    """A ``requests`` session with the shared retry policy applied."""

    base_url: str
    token_env: str
    policy: RetryPolicy = field(default_factory=RetryPolicy)
    user_agent: str = "superset-automation-orchestrator"
    session: requests.Session = field(default_factory=requests.Session)
    metrics: Metrics = field(default_factory=Metrics)
    circuit_breaker: CircuitBreaker = field(
        default_factory=lambda: CircuitBreaker(
            failure_threshold=_parse_int_env("CIRCUIT_BREAKER_THRESHOLD", 5),
            recovery_timeout=_parse_float_env("CIRCUIT_BREAKER_TIMEOUT", 60.0),
        )
    )

    def _headers(self) -> dict[str, str]:
        headers = {"User-Agent": self.user_agent, "Accept": "application/json"}
        if token := os.environ.get(self.token_env):
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _fail(
        self, method: str, reason: str, status: int | None, cause: Exception
    ) -> NoReturn:
        """Record a failure and raise it as transient or ambiguous by method."""
        self._record_failure()
        if method in IDEMPOTENT_METHODS:
            raise TransientError(reason, status) from cause
        raise AmbiguousWriteError(reason, status) from cause

    def _record_failure(self) -> None:
        self.metrics.record_failure()
        if self.circuit_breaker.record_failure():
            self.metrics.record_circuit_breaker_trip()

    def _classify(
        self, resp: requests.Response, method: str, context: str, decode_json: bool
    ) -> None:
        status = resp.status_code
        if status < 400:
            if decode_json:
                try:
                    resp.json()
                except ValueError as exc:
                    reason = f"{context} HTTP {status}: malformed JSON body"
                    self._fail(method, reason, status, exc)
            self.metrics.record_success()
            self.circuit_breaker.record_success()
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
            # Throttling is handled by the retry budget; it says nothing about
            # the availability of the service, so it must not trip the breaker.
            self.metrics.record_rate_limit()
            raise TransientError(
                f"{context} rate limited ({snippet})",
                status,
                _retry_after_seconds(resp.headers),
            )
        if status >= 500:
            self._record_failure()
            if method in IDEMPOTENT_METHODS:
                raise TransientError(f"{context} {snippet}", status)
            raise AmbiguousWriteError(f"{context} {snippet}", status)
        # 4xx is the server answering about this request (missing resource,
        # conflict, bad input); it says nothing about availability, so it
        # counts as a failed request but never trips the breaker.
        self.metrics.record_failure()
        if status == 404:
            raise ResourceNotFoundError(f"{context} {snippet}", status)
        if status == 401:
            raise AuthenticationError(f"{context} {snippet}", status)
        if status == 422:
            raise ValidationError(f"{context} {snippet}", status)
        raise PermanentError(f"{context} {snippet}", status)

    def _once(
        self,
        method: str,
        path: str,
        context: str,
        params: dict[str, Any] | None,
        json_body: Any,
        decode_json: bool,
        deadline: float | None,
    ) -> requests.Response:
        if not self.circuit_breaker.allow_request():
            self.metrics.record_circuit_breaker_blocked()
            raise ApiError("Circuit breaker is open, request blocked")
        self.metrics.record_request()
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        timeout = self.policy.timeout
        if deadline is not None:
            # Keep the socket timeout inside the caller's deadline, with a
            # small floor so an attempt started at the deadline still runs.
            timeout = max(min(timeout, deadline - time.monotonic()), MIN_TIMEOUT)
        try:
            resp = self.session.request(
                method,
                url,
                headers=self._headers(),
                params=params,
                json=json_body,
                timeout=timeout,
            )
        except (requests.ConnectionError, requests.Timeout) as exc:
            self._fail(method, f"{context} {type(exc).__name__}", None, exc)
        self._classify(resp, method, context, decode_json)
        return resp

    def request(
        self,
        method: str,
        path: str,
        *,
        context: str = "",
        params: dict[str, Any] | None = None,
        json_body: Any = None,
        decode_json: bool = False,
        budget_seconds: float | None = None,
    ) -> requests.Response:
        """Perform one logical request under the retry contract.

        With ``decode_json`` a 2xx reply whose body is not valid JSON is
        classified like a transport failure (retried for idempotent methods,
        :class:`AmbiguousWriteError` for writes) instead of escaping as a
        bare decoding exception. ``budget_seconds`` sets an absolute deadline
        for this call: retries stop at it, retry sleeps are clamped to it and
        each attempt's socket timeout is clamped to it (down to
        ``MIN_TIMEOUT``). A zero budget still makes exactly one attempt.
        """
        method = method.upper()
        context = context or f"{method} {path}"
        budget = self.policy.budget_seconds
        deadline: float | None = None
        if budget_seconds is not None:
            budget = max(min(budget, budget_seconds), 0.0)
            deadline = time.monotonic() + budget
        stop = stop_after_attempt(self.policy.max_attempts) | stop_after_delay(budget)
        if deadline is not None:
            stop = stop | _stop_at(deadline)
        retrying = Retrying(
            retry=retry_if_exception_type(TransientError),
            wait=_wait(self.policy, deadline),
            stop=stop,
            before_sleep=_log_retry(self.policy, self.metrics),
            reraise=True,
        )
        return retrying(
            self._once,
            method,
            path,
            context,
            params,
            json_body,
            decode_json,
            deadline,
        )

    def request_json(self, method: str, path: str, **kwargs: Any) -> Any:
        """Perform a request and return its decoded JSON body."""
        return self.request(method, path, decode_json=True, **kwargs).json()

    def get_json(self, path: str, **kwargs: Any) -> Any:
        return self.request_json("GET", path, **kwargs)

    def get_metrics(self) -> dict[str, int]:
        """Get current metrics summary."""
        return self.metrics.get_summary()


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
            resp = self.request("GET", url, params=params, decode_json=True)
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
        """Delete a branch; a 404 means it is already gone, which is success."""
        self.delete_ref(f"heads/{name}", context=f"delete branch {name}")

    def default_branch_commit(self) -> dict[str, Any]:
        branch = str(self.get_json(f"repos/{self.repo}")["default_branch"])
        return self.get_json(f"repos/{self.repo}/branches/{branch}")["commit"]

    def create_commit(
        self, message: str, tree: str, parents: list[str]
    ) -> dict[str, Any]:
        """Create a (possibly dangling) commit object; ambiguity propagates."""
        return self.request_json(
            "POST",
            f"repos/{self.repo}/git/commits",
            context="create commit",
            json_body={"message": message, "tree": tree, "parents": parents},
        )

    def get_commit(self, sha: str) -> dict[str, Any]:
        return self.get_json(f"repos/{self.repo}/git/commits/{sha}")

    def get_ref(self, ref: str) -> dict[str, Any] | None:
        try:
            return self.get_json(f"repos/{self.repo}/git/ref/{ref}")
        except ResourceNotFoundError:
            return None

    def create_ref(self, ref: str, sha: str) -> bool:
        """Create ``refs/<ref>`` atomically; ``False`` if it already exists.

        GitHub rejects the POST with 422 when the name is taken, which makes
        ref creation usable as a distributed lock. An
        :class:`AmbiguousWriteError` propagates: the caller must probe.
        """
        try:
            self.request(
                "POST",
                f"repos/{self.repo}/git/refs",
                context=f"create ref {ref}",
                json_body={"ref": f"refs/{ref}", "sha": sha},
            )
        except ValidationError:
            return False
        return True

    def fast_forward_ref(self, ref: str, sha: str) -> bool:
        """Move ``refs/<ref>`` to ``sha`` without force: a compare-and-swap.

        Succeeds only if the ref's current target is an ancestor of ``sha``,
        so it fails (``False``) when someone else moved the ref first.
        """
        try:
            self.request(
                "PATCH",
                f"repos/{self.repo}/git/refs/{ref}",
                context=f"fast-forward ref {ref}",
                json_body={"sha": sha, "force": False},
            )
        except ValidationError:
            return False
        return True

    def delete_ref(self, ref: str, context: str = "") -> None:
        try:
            self.request(
                "DELETE",
                f"repos/{self.repo}/git/refs/{ref}",
                context=context or f"delete ref {ref}",
            )
        except ResourceNotFoundError:
            pass

    def comments(self, issue: int) -> list[dict[str, Any]]:
        return list(self.paginate(f"issues/{issue}/comments"))

    def create_comment(self, issue: int, body: str) -> dict[str, Any]:
        return self.request_json(
            "POST",
            f"repos/{self.repo}/issues/{issue}/comments",
            context=f"[Issue #{issue}] create comment",
            json_body={"body": body},
        )

    def update_comment(self, comment_id: int, body: str) -> dict[str, Any]:
        return self.request_json(
            "PATCH",
            f"repos/{self.repo}/issues/comments/{comment_id}",
            context=f"update comment {comment_id}",
            json_body={"body": body},
        )


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

    def get_session(
        self, session_id: str, budget_seconds: float | None = None
    ) -> dict[str, Any]:
        return self.get_json(f"sessions/{session_id}", budget_seconds=budget_seconds)

    def create_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.request_json(
            "POST",
            "sessions",
            context=f"create session {payload.get('title', '')!r}",
            json_body=payload,
        )


def session_url(session: dict[str, Any]) -> str:
    sid = str(session.get("session_id") or session.get("id") or "")
    return str(
        session.get("url")
        or f"https://app.devin.ai/sessions/{sid.removeprefix('devin-')}"
    )
