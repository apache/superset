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
"""Exercise retry behavior through the production runtime, not only middleware."""

import asyncio
from collections.abc import AsyncIterator
from typing import ClassVar

import pytest

from superset.ai.events import StreamEvent
from superset.ai.llm.base import (
    CompletionRequest, LLMRequestError, LLMTransportError, Message,
    ProviderStreamEvent, RetryPolicy, StreamEventKind,
)
from superset.ai.llm.echo import EchoProvider, ScriptedTurn
from superset.ai.runtime.base import RunRequest
from superset.ai.runtime.messages import MessagesApiRuntime
from superset.ai.types import MessageRole, StreamEventType


class RetryingEcho(EchoProvider):
    closed = 0

    def retry_policy(self) -> RetryPolicy:
        return RetryPolicy(max_attempts=2, base_delay_seconds=0, max_delay_seconds=0)

    async def stream(self, request: CompletionRequest) -> AsyncIterator[ProviderStreamEvent]:
        try:
            async for event in super().stream(request):
                yield event
        finally:
            self.closed += 1


class RetryingComplete(RetryingEcho):
    supports_streaming: ClassVar[bool] = False


def drive(provider: EchoProvider) -> tuple[MessagesApiRuntime, list[StreamEvent]]:
    runtime = MessagesApiRuntime(provider)

    async def collect() -> list[StreamEvent]:
        return [event async for event in runtime.run(RunRequest(
            messages=[Message(role=MessageRole.USER, content="question")],
            system_prompt="Test",
        ))]

    return runtime, asyncio.run(collect())


@pytest.mark.parametrize("provider_type", [RetryingEcho, RetryingComplete])
def test_transient_failure_retries_before_output(provider_type: type[RetryingEcho]) -> None:
    provider = provider_type([
        ScriptedTurn(error=LLMTransportError("temporary")), ScriptedTurn(text="answer")
    ])
    runtime, events = drive(provider)
    assert runtime.result.ok
    assert len(provider.requests) == 2
    if provider.supports_streaming:
        assert provider.closed == 2
    assert "".join(e.payload["delta"] for e in events if e.type is StreamEventType.ASSISTANT_DELTA) == "answer"


@pytest.mark.parametrize("provider_type", [RetryingEcho, RetryingComplete])
@pytest.mark.parametrize("error,attempts", [(LLMRequestError("invalid"), 1), (LLMTransportError("down"), 2)])
def test_failed_calls_respect_retry_policy(
    provider_type: type[RetryingEcho], error: Exception, attempts: int,
) -> None:
    provider = provider_type([ScriptedTurn(error=error) for _ in range(3)])
    runtime, events = drive(provider)
    assert not runtime.result.ok
    assert len(provider.requests) == attempts
    assert not any(e.type is StreamEventType.FINAL for e in events)


def test_partial_stream_is_not_replayed_and_is_closed() -> None:
    class Partial(RetryingEcho):
        attempts = 0
        closed = 0

        async def stream(self, request: CompletionRequest) -> AsyncIterator[ProviderStreamEvent]:
            self.attempts += 1
            try:
                yield ProviderStreamEvent(kind=StreamEventKind.TEXT, text="partial")
                raise LLMTransportError("disconnected")
            finally:
                self.closed += 1

    provider = Partial()
    runtime, events = drive(provider)
    assert not runtime.result.ok
    assert provider.attempts == provider.closed == 1
    assert [e.payload["delta"] for e in events if e.type is StreamEventType.ASSISTANT_DELTA] == ["partial"]


def test_circuit_breaker_caps_attempts_within_a_run() -> None:
    class Persistent(RetryingComplete):
        def retry_policy(self) -> RetryPolicy:
            return RetryPolicy(max_attempts=10, base_delay_seconds=0, max_delay_seconds=0)

    provider = Persistent([ScriptedTurn(error=LLMTransportError("down")) for _ in range(10)])
    runtime, _ = drive(provider)
    assert not runtime.result.ok
    assert len(provider.requests) == 5

    healthy = Persistent([ScriptedTurn(text="recovered")])
    runtime, _ = drive(healthy)
    assert runtime.result.ok
