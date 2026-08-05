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
Tests for provider retry, backoff and circuit breaking.

Nothing here sleeps: the helper takes its sleep as an argument, so a test can
assert on the delays a failing call *would* have waited instead of spending
them.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

import pytest

from superset.ai.llm.base import (
    CompletionRequest,
    LLMConfigurationError,
    LLMRequestError,
    LLMTransportError,
    Message,
    RetryPolicy,
)
from superset.ai.llm.echo import EchoProvider, ScriptedTurn
from superset.ai.llm.retry import (
    backoff_delay,
    CircuitBreaker,
    CircuitOpenError,
    with_retries,
)
from superset.ai.types import MessageRole


def _recorder() -> tuple[list[float], Callable[[float], Awaitable[None]]]:
    """A sleep that records what it was asked to wait for."""
    slept: list[float] = []

    async def sleep(seconds: float) -> None:
        slept.append(seconds)

    return slept, sleep


def _plays(
    *outcomes: BaseException | str,
) -> tuple[list[str], Callable[[], Awaitable[str]]]:
    """
    A call that plays ``outcomes`` in order, raising or returning each in turn.

    Running past the end raises ``IndexError``, which is the report a test
    wants when the helper attempted more calls than the scenario described.
    """
    played: list[str] = []

    async def call() -> str:
        outcome = outcomes[len(played)]
        played.append(str(outcome))
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    return played, call


async def test_a_transport_error_is_retried_until_it_succeeds() -> None:
    slept, sleep = _recorder()
    played, call = _plays(LLMTransportError("reset"), LLMTransportError("reset"), "ok")

    result = await with_retries(call, RetryPolicy(max_attempts=4), sleep=sleep)

    assert result == "ok"
    assert len(played) == 3
    assert len(slept) == 2


async def test_backoff_doubles_stays_capped_and_keeps_half_its_delay() -> None:
    """Equal jitter: each wait is between half and all of the capped delay."""
    slept, sleep = _recorder()
    policy = RetryPolicy(max_attempts=5, base_delay_seconds=1.0, max_delay_seconds=4.0)
    played, call = _plays(*[LLMTransportError("reset")] * 5)

    with pytest.raises(LLMTransportError):
        await with_retries(call, policy, sleep=sleep)

    assert len(played) == 5
    # Doubling from the base, then pinned to the cap.
    for waited, ceiling in zip(slept, [1.0, 2.0, 4.0, 4.0], strict=True):
        assert ceiling / 2 <= waited <= ceiling


async def test_a_request_error_is_never_retried() -> None:
    """Permanent by definition, so a second attempt only delays the report."""
    slept, sleep = _recorder()
    played, call = _plays(LLMRequestError("malformed"), "never reached")

    with pytest.raises(LLMRequestError):
        await with_retries(call, sleep=sleep)

    assert len(played) == 1
    assert slept == []


async def test_a_configuration_error_is_never_retried() -> None:
    slept, sleep = _recorder()
    played, call = _plays(LLMConfigurationError("no credential"), "never reached")

    with pytest.raises(LLMConfigurationError):
        await with_retries(call, sleep=sleep)

    assert len(played) == 1
    assert slept == []


async def test_attempts_are_bounded_and_the_final_failure_is_the_one_raised() -> None:
    slept, sleep = _recorder()
    played, call = _plays(
        LLMTransportError("one"),
        LLMTransportError("two"),
        LLMTransportError("three"),
    )

    with pytest.raises(LLMTransportError, match="three"):
        await with_retries(call, RetryPolicy(max_attempts=3), sleep=sleep)

    assert len(played) == 3
    assert len(slept) == 2


async def test_a_policy_that_permits_no_attempts_is_a_configuration_error() -> None:
    _, call = _plays("never reached")

    with pytest.raises(LLMConfigurationError, match="at least 1"):
        await with_retries(call, RetryPolicy(max_attempts=0))


async def test_the_breaker_opens_and_the_provider_stops_being_called() -> None:
    slept, sleep = _recorder()
    breaker = CircuitBreaker(name="opens", threshold=2)
    played, call = _plays(LLMTransportError("a"), LLMTransportError("b"))

    with pytest.raises(CircuitOpenError):
        await with_retries(
            call, RetryPolicy(max_attempts=5), breaker=breaker, sleep=sleep
        )

    # The third attempt never left the process.
    assert len(played) == 2
    assert breaker.is_open


async def test_a_success_closes_the_breaker() -> None:
    """Recovery needs no timer: the next caller through is the probe."""
    breaker = CircuitBreaker(name="closes", threshold=3)
    breaker.record_failure()
    breaker.record_failure()
    _, call = _plays("ok")

    assert await with_retries(call, breaker=breaker) == "ok"
    assert breaker.failure_count == 0


async def test_breaker_state_does_not_leak_between_concurrent_runs() -> None:
    """
    Two runs sharing a worker keep separate counts.

    The count lives in a ``ContextVar`` and asyncio copies the context when it
    creates a task, so a provider failing for one user cannot fail fast for
    another — nor for the caller that started them both.
    """
    breaker = CircuitBreaker(name="shared", threshold=1)

    async def run() -> int:
        _, call = _plays(LLMTransportError("reset"))
        with pytest.raises(LLMTransportError):
            await with_retries(call, RetryPolicy(max_attempts=1), breaker=breaker)
        return breaker.failure_count

    counts = await asyncio.gather(
        asyncio.create_task(run()),
        asyncio.create_task(run()),
    )

    assert counts == [1, 1]
    assert breaker.failure_count == 0


def test_a_breaker_needs_a_positive_threshold() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        CircuitBreaker(threshold=0)


def test_backoff_delay_never_exceeds_the_cap_or_drops_below_half() -> None:
    policy = RetryPolicy(base_delay_seconds=1.0, max_delay_seconds=2.0)

    for attempt in range(1, 6):
        assert 0.5 <= backoff_delay(attempt, policy) <= 2.0


async def test_the_middleware_wraps_a_real_provider_call() -> None:
    """
    The intended call shape: the caller owns the round trip and hands it over as
    a factory, because an awaitable can only be awaited once.
    """
    provider = EchoProvider(
        [
            ScriptedTurn(error=LLMTransportError("upstream reset")),
            ScriptedTurn(text="Nine hundred rows."),
        ]
    )
    request = CompletionRequest(
        messages=[Message(role=MessageRole.USER, content="how many rows?")]
    )
    slept, sleep = _recorder()

    response = await with_retries(
        lambda: provider.complete(request),
        RetryPolicy(max_attempts=3),
        sleep=sleep,
    )

    assert response.text == "Nine hundred rows."
    assert len(provider.requests) == 2
    assert len(slept) == 1
