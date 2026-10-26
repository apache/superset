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

"""Host-owned provider HTTP policy with shared deadline enforcement."""

from __future__ import annotations

import heapq
import logging
import os
import socket
import time
from collections.abc import Callable, Mapping
from contextvars import Token
from dataclasses import dataclass, field
from io import BytesIO
from threading import Condition, Lock, Thread
from typing import Any, TYPE_CHECKING
from urllib.parse import SplitResult, urljoin, urlsplit

import requests
from flask import current_app, has_app_context
from superset_core.semantic_layers.transport import (
    ProviderRequestError,
    ProviderRequestFailure as Failure,
    ProviderResponse,
    ProviderTransport,
    RequestBudget,
)
from urllib3.exceptions import HTTPError

from superset.utils.network import (
    ConnectionDeadline,
    NonPublicAddressError,
    PinnedHTTPAdapter,
    PROVIDER_DEADLINE,
)

if TYPE_CHECKING:
    from requests.sessions import _Settings

logger: logging.Logger = logging.getLogger(__name__)
MAX_REDIRECTS: int = 3
_CHUNK_BYTES: int = 65536


class HostProviderTransport(ProviderTransport):
    """Fix operator policy at construction; keep budgets and sockets call-local."""

    def __init__(self, *, allow_internal_hosts: bool = False) -> None:
        self._allow_internal: bool = allow_internal_hosts

    def request(
        self,
        provider: str,
        method: str,
        url: str,
        *,
        budget: RequestBudget,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, Any] | None = None,
        json: Any = None,
        consume: Callable[[int], None] | None = None,
    ) -> ProviderResponse:
        # Do not coerce arbitrary objects while handling a URL-bearing failure.
        provider = provider if isinstance(provider, str) else "Provider"
        bound: _Deadline = _Deadline(budget.deadline)
        token: Token[ConnectionDeadline | None] = PROVIDER_DEADLINE.set(bound)
        try:
            bound.remaining()  # No parsing, resolution or socket work after expiry.
            self._validated_url(url)
            with _DirectSession(allow_environment_ca=self._allow_internal) as session:
                adapter: PinnedHTTPAdapter = PinnedHTTPAdapter(
                    public_only=not self._allow_internal
                )
                session.mount("https://", adapter)
                session.mount("http://", adapter)
                hop: int
                for hop in range(MAX_REDIRECTS + 1):
                    with session.request(
                        method,
                        url,
                        headers={**(headers or {}), "Accept-Encoding": "identity"},
                        params=params,
                        json=json,
                        timeout=bound.remaining(),
                        stream=True,
                        allow_redirects=False,
                    ) as response:
                        target: str | None = (
                            self._next_redirect(method, response)
                            if hop < MAX_REDIRECTS
                            else None
                        )
                        if target is not None:
                            url, params = target, None
                            continue  # Context closes the unread redirect body.
                        if not 200 <= response.status_code < 300:
                            raise ProviderRequestError(
                                Failure.HTTP_STATUS, status=response.status_code
                            )
                        if (
                            response.headers.get("Content-Encoding", "identity").lower()
                            != "identity"
                        ):
                            raise ProviderRequestError(Failure.UNSUPPORTED_ENCODING)
                        body: bytes = self._read_body(
                            response, bound, budget.max_bytes, consume
                        )
                        result: ProviderResponse = ProviderResponse(
                            response.status_code, response.headers, body, response.url
                        )
                        bound.remaining()
                        return result
                raise AssertionError("Redirect loop must return or fail")
        except (
            requests.RequestException,
            HTTPError,
            OSError,
            ProviderRequestError,
        ) as exc:
            failure: ProviderRequestError = self._failure_for(exc, budget.deadline)
            error: ProviderRequestError = ProviderRequestError(
                failure.failure, status=failure.status, provider=provider
            )
            logger.warning(
                "%s request failed: category=%s status=%s",
                error.provider,
                error.failure.value,
                error.status,
            )
            raise error from None
        finally:
            PROVIDER_DEADLINE.reset(token)
            bound.close()

    @staticmethod
    def _check_url_characters(url: str) -> None:
        """Refuse characters URL parsers can discard or interpret differently."""
        if any(
            char == "\\" or char.isspace() or ord(char) < 32 or ord(char) == 127
            for char in url
        ):
            raise ProviderRequestError(Failure.INVALID_URL)

    @classmethod
    def _prepared_url(cls, url: str) -> SplitResult:
        """Compare destinations using the same URL preparation as Requests."""
        cls._check_url_characters(url)
        try:
            prepared: requests.PreparedRequest = requests.PreparedRequest()
            prepared.prepare_url(url, None)
            if prepared.url is None:
                raise ProviderRequestError(Failure.INVALID_URL)
            parts: SplitResult = urlsplit(prepared.url)
            parts.port  # noqa: B018  Validate malformed ports before any I/O.
        except (ValueError, requests.RequestException):
            raise ProviderRequestError(Failure.INVALID_URL) from None
        if not parts.hostname:
            raise ProviderRequestError(Failure.INVALID_URL)
        return parts

    def _validated_url(self, url: str) -> SplitResult:
        parts: SplitResult = self._prepared_url(url)
        if parts.scheme not in (
            {"https", "http"} if self._allow_internal else {"https"}
        ):
            raise ProviderRequestError(Failure.REFUSED)
        return parts

    def _next_redirect(self, method: str, response: requests.Response) -> str | None:
        if (
            method.upper() != "GET"
            or response.status_code not in {301, 302, 303, 307, 308}
            or not response.headers.get("Location")
        ):
            return None
        before: SplitResult = self._validated_url(response.url)
        self._check_url_characters(response.headers["Location"])
        try:
            target: str = urljoin(response.url, response.headers["Location"])
            after: SplitResult = self._prepared_url(target)
            if after.username is not None or after.password is not None:
                raise ProviderRequestError(Failure.INVALID_URL)
        except ValueError:
            raise ProviderRequestError(Failure.INVALID_URL) from None

        def origin(parts: SplitResult) -> tuple[str, str | None, int]:
            return (
                parts.scheme,
                parts.hostname,
                parts.port
                if parts.port is not None
                else (443 if parts.scheme == "https" else 80),
            )

        return after.geturl() if origin(before) == origin(after) else None

    @staticmethod
    def _read_body(
        response: requests.Response,
        bound: _Deadline,
        cap: int,
        consume: Callable[[int], None] | None,
    ) -> bytes:
        body: BytesIO = BytesIO()
        while True:
            bound.remaining()
            chunk: bytes = response.raw.read1(_CHUNK_BYTES, decode_content=False)
            bound.remaining()  # Shutdown can look like EOF; refuse partial bytes.
            if not chunk:
                return body.getvalue()
            if consume is not None:
                consume(len(chunk))
            if body.tell() + len(chunk) > cap:
                raise ProviderRequestError(Failure.TOO_LARGE)
            body.write(chunk)

    @staticmethod
    def _failure_for(exc: Exception, deadline: float) -> ProviderRequestError:
        if time.monotonic() >= deadline or isinstance(
            exc, (TimeoutError, requests.Timeout)
        ):
            return ProviderRequestError(Failure.TIMEOUT)
        if isinstance(exc, ProviderRequestError):
            return exc
        pending: list[BaseException] = [exc]
        seen: set[int] = set()
        while pending:
            cause: BaseException = pending.pop()
            if id(cause) in seen:
                continue
            seen.add(id(cause))
            if isinstance(cause, NonPublicAddressError):
                return ProviderRequestError(Failure.REFUSED)
            pending.extend(
                item
                for item in (
                    *cause.args,
                    cause.__cause__,
                    getattr(cause, "reason", None),
                )
                if isinstance(item, BaseException)
            )
        return ProviderRequestError(
            Failure.INVALID_URL if isinstance(exc, ValueError) else Failure.UNREACHABLE
        )


def build_provider_transport() -> ProviderTransport:
    """Fail closed outside app context; read only the provider-specific setting."""
    return HostProviderTransport(
        allow_internal_hosts=has_app_context()
        and current_app.config.get("SEMANTIC_LAYER_ALLOW_INTERNAL_HOSTS", False) is True
    )


class _DirectSession(requests.Session):
    def __init__(self, *, allow_environment_ca: bool = False) -> None:
        super().__init__()
        self.trust_env = False  # Never discover credentials from netrc.
        self._allow_environment_ca: bool = allow_environment_ca

    def merge_environment_settings(self, *args: Any, **kwargs: Any) -> _Settings:
        settings: _Settings = super().merge_environment_settings(*args, **kwargs)
        if self._allow_environment_ca and settings["verify"] is True:
            settings["verify"] = (
                os.environ.get("REQUESTS_CA_BUNDLE")
                or os.environ.get("CURL_CA_BUNDLE")
                or settings["verify"]
            )
        settings["proxies"] = {}
        return settings

    def get_redirect_target(self, resp: requests.Response) -> None:
        # Requests otherwise reads redirect bodies despite allow_redirects=False.
        return None


@dataclass(eq=False)
class _Deadline:
    at: float
    sockets: list[socket.socket] = field(default_factory=list)
    closed: bool = False
    expired: bool = False

    def remaining(self) -> float:
        seconds: float = self.at - time.monotonic()
        if seconds <= 0:
            raise TimeoutError
        return seconds

    def watch(self, sock: socket.socket) -> None:
        _scheduler().register(self, sock)

    def close(self) -> None:
        # A request rejected before connecting need not start a scheduler.
        if _SCHEDULER is not None:
            _SCHEDULER.close(self)


class DeadlineScheduler:
    """One lazy worker interrupts I/O through owned duplicate descriptors."""

    def __init__(self) -> None:
        self._condition: Condition = Condition()
        self._heap: list[tuple[float, int, _Deadline]] = []
        self._tokens: set[_Deadline] = set()
        self._worker: Thread = Thread(
            target=self._run, name="provider-deadlines", daemon=True
        )
        self._worker.start()

    def register(self, bound: _Deadline, sock: socket.socket) -> None:
        with self._condition:
            if bound.closed:
                return
            bound.sockets.append(sock.dup())
            if bound.expired or bound.at <= time.monotonic():
                self._expire(bound)
            elif bound not in self._tokens:
                self._tokens.add(bound)
                heapq.heappush(self._heap, (bound.at, id(bound), bound))
                self._condition.notify()

    def close(self, bound: _Deadline) -> None:
        with self._condition:
            bound.closed = True
            self._tokens.discard(bound)
            for sock in bound.sockets:
                sock.close()
            bound.sockets.clear()
            self._condition.notify()

    @staticmethod
    def _expire(bound: _Deadline) -> None:
        bound.expired = True
        for sock in bound.sockets:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    def _run(self) -> None:
        with self._condition:
            while True:
                if not self._heap:
                    self._condition.wait()
                    continue
                deadline: float
                bound: _Deadline
                deadline, _, bound = self._heap[0]
                if bound.closed:
                    heapq.heappop(self._heap)
                    continue
                remaining: float = deadline - time.monotonic()
                if remaining > 0:
                    self._condition.wait(remaining)
                else:
                    heapq.heappop(self._heap)
                    self._expire(bound)


_SCHEDULER: DeadlineScheduler | None = None
_SCHEDULER_LOCK: Lock = Lock()


def _scheduler() -> DeadlineScheduler:
    global _SCHEDULER  # pylint: disable=global-statement
    with _SCHEDULER_LOCK:
        if _SCHEDULER is None:
            _SCHEDULER = DeadlineScheduler()
        return _SCHEDULER


def _reset_scheduler_after_fork() -> None:
    """A child cannot reuse the parent's worker or potentially held lock."""
    global _SCHEDULER, _SCHEDULER_LOCK  # pylint: disable=global-statement
    _SCHEDULER = None
    _SCHEDULER_LOCK = Lock()


if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_scheduler_after_fork)
