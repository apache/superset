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
Retry, backoff and circuit breaking for provider round trips.

Middleware, not magic. Nothing here reaches into a vendor client to replace one
of its methods: a wrapped SDK retries invisibly, compounds with the wrapper's
own attempts, and leaves nobody able to say how long a failing call will take.
This module is called explicitly instead, by whoever owns the round trip.

The distinction that makes it work lives in the provider contract rather than
here. Providers translate their vendor's failures into
:class:`~superset.ai.llm.base.LLMTransportError` for what a retry can fix and
:class:`~superset.ai.llm.base.LLMRequestError` for what it cannot, so this code
never inspects a vendor exception type.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable, Mapping
from contextvars import ContextVar
from types import MappingProxyType
from typing import TypeVar

from superset.ai.llm.base import (
    LLMConfigurationError,
    LLMError,
    LLMTransportError,
    RetryPolicy,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

#: Awaits a number of seconds. Injectable so a test can assert on the delays a
#: failing call *would* have slept instead of spending them.
Sleeper = Callable[[float], Awaitable[None]]


class CircuitOpenError(LLMError):
    """
    The breaker is open, so the call was never attempted.

    Not an :class:`~superset.ai.llm.base.LLMTransportError`, which would be
    self-defeating: the breaker exists to stop retrying, and a transport error
    is exactly what :func:`with_retries` retries.
    """


#: Consecutive-failure counts, keyed by breaker name.
#:
#: Context-local rather than a module global. Several runs share a worker
#: process, and a global counter lets one user's failing provider fail fast for
#: everybody else — including for a run pointed at a different provider
#: entirely. A ``ContextVar`` scopes the count to the run that earned it.
#:
#: The value is replaced, never mutated, because a ``ContextVar`` isolates the
#: binding and not the object it points at: mutating one shared dict in place
#: would leak straight through the isolation this looks like it has. One
#: consequence worth knowing — ``asyncio`` copies the context when it creates a
#: task, so failures recorded inside a task are invisible to its parent.
_FAILURE_COUNTS: ContextVar[Mapping[str, int]] = ContextVar(
    "superset_ai_llm_failure_counts",
    default=MappingProxyType({}),
)


class CircuitBreaker:
    """
    Fails fast once a provider has failed ``threshold`` times consecutively.

    Cheap insurance against the case where a provider is down and every request
    pays the whole retry budget before finding out. A single success closes it
    again, so recovery needs no timer and no half-open probe: the next caller
    through is the probe.

    Only failures a retry could have fixed are counted. A malformed request or a
    missing credential fails identically every time, and letting those trip the
    breaker would take a healthy provider offline because one caller sent
    nonsense.
    """

    def __init__(self, *, name: str = "default", threshold: int = 5) -> None:
        if threshold < 1:
            raise ValueError("CircuitBreaker threshold must be at least 1")
        self.name = name
        self.threshold = threshold

    @property
    def failure_count(self) -> int:
        """Consecutive failures recorded in the calling context."""
        return _FAILURE_COUNTS.get().get(self.name, 0)

    @property
    def is_open(self) -> bool:
        """Whether the next call would fail fast."""
        return self.failure_count >= self.threshold

    def check(self) -> None:
        """Raise :class:`CircuitOpenError` if the breaker is open."""
        if self.is_open:
            raise CircuitOpenError(
                f"Circuit breaker {self.name!r} is open after "
                f"{self.failure_count} consecutive failures."
            )

    def record_failure(self) -> None:
        """Count one retryable failure."""
        self._write(self.failure_count + 1)

    def record_success(self) -> None:
        """Close the breaker."""
        if self.failure_count:
            self._write(0)

    def reset(self) -> None:
        """Forget the count, whatever it was."""
        self._write(0)

    def _write(self, count: int) -> None:
        counts = dict(_FAILURE_COUNTS.get())
        counts[self.name] = count
        _FAILURE_COUNTS.set(MappingProxyType(counts))


def backoff_delay(attempt: int, policy: RetryPolicy) -> float:
    """
    Seconds to wait after 1-based ``attempt`` failed.

    Exponential growth, capped, then equal jitter: half the delay plus a random
    share of the other half. Full jitter can retry almost immediately and
    defeats the backoff; no jitter synchronises every worker that failed
    together onto the same instant and rebuilds the herd that took the provider
    down. Equal jitter keeps the curve and still spreads the arrivals.

    The cap applies before the jitter, so the configured maximum is a real
    ceiling on the wait rather than a ceiling on its midpoint.
    """
    exponential = policy.base_delay_seconds * 2 ** (attempt - 1)
    delay = min(exponential, policy.max_delay_seconds)
    return delay / 2 + random.uniform(0, delay / 2)  # noqa: S311


async def with_retries(
    fn: Callable[[], Awaitable[T]],
    policy: RetryPolicy | None = None,
    *,
    breaker: CircuitBreaker | None = None,
    sleep: Sleeper = asyncio.sleep,
) -> T:
    """
    Await ``fn`` until it succeeds or stops being worth trying.

    ``fn`` takes no arguments and is called afresh for each attempt, so it must
    be a factory for the coroutine rather than the coroutine itself: an
    awaitable can only be awaited once.

    Retries :class:`~superset.ai.llm.base.LLMTransportError` and nothing else.
    Everything else — a permanent request error, a configuration error, a
    cancellation, a bug — propagates from the first attempt, because a second
    attempt would fail the same way and only delay the report.
    """
    policy = policy or RetryPolicy()
    last_error: LLMTransportError | None = None

    for attempt in range(1, policy.max_attempts + 1):
        if breaker is not None:
            breaker.check()
        try:
            result = await fn()
        except LLMTransportError as ex:
            last_error = ex
            if breaker is not None:
                breaker.record_failure()
            if attempt == policy.max_attempts:
                break
            delay = backoff_delay(attempt, policy)
            logger.warning(
                "Provider call failed on attempt %d of %d, retrying in %.2fs: %s",
                attempt,
                policy.max_attempts,
                delay,
                ex,
            )
            await sleep(delay)
        else:
            if breaker is not None:
                breaker.record_success()
            return result

    if last_error is None:
        # Reachable only for a policy permitting no attempts at all, which would
        # otherwise fail with a bare "None is not an exception".
        raise LLMConfigurationError(
            f"RetryPolicy.max_attempts must be at least 1, got {policy.max_attempts}."
        )
    raise last_error
