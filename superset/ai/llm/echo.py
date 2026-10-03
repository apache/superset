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
A provider that answers from a script instead of from a network.

Two audiences. A deployment that wants to see the assistant work end to end
without holding a credential points ``AI_LLM_PROVIDER_CLASS`` here and gets an
echo bot. A test hands it a list of :class:`ScriptedTurn` — each one prose, a
set of tool calls, or a failure — and drives the agent loop through as many
turns as it likes with no network, no clock and no randomness.

Scripting is what makes multi-turn tool use testable at all. Asserting that the
runtime dispatched a tool and fed the result back needs a model that asks for
that tool on turn one and stops on turn two, every time, and no real model does
that.

The provider also records what it was asked, so a test can assert on the
prompt, the tool catalogue and the message history the runtime assembled —
usually the thing under test, rather than the reply.
"""

from __future__ import annotations

import copy
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, ClassVar

from superset.ai.llm.base import (
    BaseLLMProvider,
    CompletionRequest,
    LLMResponse,
    Message,
    ModelAlias,
    ProviderStreamEvent,
    StreamEventKind,
    ToolCall,
    ToolDefinition,
)
from superset.ai.types import MessageRole, TokenUsage

#: Prefix on an unscripted reply, so a test can tell an echo apart from a
#: script it forgot to install.
ECHO_PREFIX = "echo: "

#: Unscripted reply when the conversation carries no user prose at all.
EMPTY_REPLY = "echo: nothing to echo"

#: Characters per streamed text chunk. Small enough that an ordinary sentence
#: arrives in several events, because a single-chunk stream exercises none of
#: the reassembly a consumer has to get right.
DEFAULT_CHUNK_SIZE = 20


class EchoScriptExhaustedError(AssertionError):
    """
    The caller asked for more turns than the script provides.

    An :class:`AssertionError` rather than an ``LLMError`` on purpose: an
    unplanned extra round trip is a defect in the caller, and dressing it up as
    a provider failure lets the runtime's own error handling swallow it and
    report something tidier than the truth.
    """


@dataclass(frozen=True)
class ScriptedTurn:
    """One prepared reply. Leave the fields that do not apply at their defaults."""

    text: str = ""
    thinking: str = ""
    tool_calls: tuple[ToolCall, ...] = ()
    #: Raised instead of replying. Any exception type, so a test can cover what
    #: the runtime does with something the provider contract does not describe.
    error: Exception | None = None


@dataclass(frozen=True)
class RecordedRequest:
    """
    A snapshot of one thing the caller asked for.

    Deep-copied on the way in. A tool-use loop grows and mutates a single
    message list in place across round trips, so a test holding a reference to
    the live list would find every recorded turn looking identical — like the
    end of the run.
    """

    system: str
    #: The model the request actually ran against, after any explicit override
    #: won out over the alias. This is what a selection test asserts on: the
    #: alias alone cannot tell you whether the override took effect.
    model: str
    model_alias: ModelAlias
    tools: tuple[ToolDefinition, ...]
    messages: tuple[Message, ...]
    max_output_tokens: int | None = None
    temperature: float | None = None
    thinking_budget_tokens: int | None = None

    @property
    def tool_names(self) -> tuple[str, ...]:
        """Names of the tools offered, in the order they were offered."""
        return tuple(tool.name for tool in self.tools)

    @property
    def tool_result_ids(self) -> tuple[str, ...]:
        """
        Call ids the caller returned results for.

        The usual assertion in a tool-loop test: the runtime answered the calls
        the model actually made, and answered each of them once.
        """
        return tuple(
            result.call_id
            for message in self.messages
            for result in message.tool_results
        )


class EchoProvider(BaseLLMProvider):
    """
    A deterministic provider with no vendor SDK and no socket.

    Unscripted it echoes the last user message, so a smoke test needs no setup.
    Scripted it replays turns in order across successive :meth:`complete` and
    :meth:`stream` calls, which share one cursor — a runtime that streams one
    turn and completes the next still walks the script.
    """

    name: ClassVar[str] = "echo"
    supports_streaming: ClassVar[bool] = True

    def __init__(
        self,
        script: Sequence[ScriptedTurn] | None = None,
        *,
        stream_chunk_size: int = DEFAULT_CHUNK_SIZE,
        **config: Any,
    ) -> None:
        super().__init__(**config)
        #: Every request received, oldest first.
        self.requests: list[RecordedRequest] = []
        self._script = tuple(script or ())
        self._cursor = 0
        self._chunk_size = max(1, stream_chunk_size)

    @property
    def remaining_turns(self) -> int:
        """
        Scripted turns not yet played.

        Assert this is zero to catch a runtime that stopped early: a loop that
        bailed after one turn passes most other assertions.
        """
        return len(self._script) - self._cursor

    def resolve_model(self, alias: ModelAlias) -> str:
        """
        Stable fake ids: ``echo-default``, ``echo-fast``, ``echo-reasoning``.

        Those three are also what :meth:`available_models` reports, since the
        inherited implementation derives the picker from this method.
        """
        return f"echo-{alias.value}"

    async def complete(self, request: CompletionRequest) -> LLMResponse:
        # Selection first: a request naming a model this provider does not have
        # is rejected before it counts as a round trip.
        model = self.select_model(request)
        turn = self._next_turn(request, model)
        if turn.error is not None:
            raise turn.error
        return LLMResponse(
            text=turn.text,
            thinking=turn.thinking,
            tool_calls=list(turn.tool_calls),
            usage=self._usage(request, turn, model),
            stop_reason="tool_use" if turn.tool_calls else "end_turn",
        )

    async def stream(
        self,
        request: CompletionRequest,
    ) -> AsyncIterator[ProviderStreamEvent]:
        """
        Replay a turn as a sequence of chunks.

        Deliberately not the inherited single-shot fallback: a consumer that
        accumulates deltas, orders thinking against answer text and closes on
        ``STOP`` is only exercised by a stream that arrives in pieces.
        """
        model = self.select_model(request)
        turn = self._next_turn(request, model)
        if turn.error is not None:
            raise turn.error
        for chunk in split_into_chunks(turn.thinking, self._chunk_size):
            yield ProviderStreamEvent(kind=StreamEventKind.THINKING, text=chunk)
        for chunk in split_into_chunks(turn.text, self._chunk_size):
            yield ProviderStreamEvent(kind=StreamEventKind.TEXT, text=chunk)
        for call in turn.tool_calls:
            yield ProviderStreamEvent(kind=StreamEventKind.TOOL_USE, tool_call=call)
        yield ProviderStreamEvent(
            kind=StreamEventKind.USAGE,
            usage=self._usage(request, turn, model),
        )
        yield ProviderStreamEvent(kind=StreamEventKind.STOP)

    def _next_turn(self, request: CompletionRequest, model: str) -> ScriptedTurn:
        self.requests.append(self._record(request, model))
        if not self._script:
            return ScriptedTurn(text=_echo(request.messages))
        if self._cursor >= len(self._script):
            raise EchoScriptExhaustedError(
                f"EchoProvider was scripted with {len(self._script)} turn(s) but "
                f"has been asked for {len(self.requests)}."
            )
        turn = self._script[self._cursor]
        self._cursor += 1
        return turn

    def _record(self, request: CompletionRequest, model: str) -> RecordedRequest:
        return RecordedRequest(
            system=request.system,
            model=model,
            model_alias=request.model_alias,
            tools=tuple(request.tools),
            messages=tuple(copy.deepcopy(message) for message in request.messages),
            max_output_tokens=request.max_output_tokens,
            temperature=request.temperature,
            thinking_budget_tokens=request.thinking_budget_tokens,
        )

    def _usage(
        self,
        request: CompletionRequest,
        turn: ScriptedTurn,
        model: str,
    ) -> TokenUsage:
        return TokenUsage(
            model=model,
            input_tokens=_fake_tokens(_prompt_text(request)),
            output_tokens=_fake_tokens(turn.thinking + turn.text),
            requests=1,
        )


def split_into_chunks(text: str, size: int) -> list[str]:
    """
    Cut text into chunks that concatenate back to the original exactly.

    Split points prefer a space inside the window so a consumer rendering each
    chunk verbatim never shows a word torn in half. Only the split points move,
    so joining the chunks still reproduces the input byte for byte, which is the
    invariant a streaming test asserts.
    """
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            pivot = text.rfind(" ", start + 1, end + 1)
            if pivot > start:
                end = pivot + 1
        chunks.append(text[start:end])
        start = end
    return chunks


def _echo(messages: Sequence[Message]) -> str:
    for message in reversed(messages):
        if message.role == MessageRole.USER and message.content:
            return f"{ECHO_PREFIX}{message.content}"
    return EMPTY_REPLY


def _prompt_text(request: CompletionRequest) -> str:
    """
    Everything the model would have read.

    Tool output is included so input token counts grow turn over turn the way
    they do in a real loop, which is what a usage-accounting test needs.
    """
    parts = [request.system]
    for message in request.messages:
        parts.append(message.content)
        parts.extend(result.content for result in message.tool_results)
    return "".join(parts)


def _fake_tokens(text: str) -> int:
    """
    A quarter of the character count, rounded up.

    Wrong in the way every heuristic is wrong, and stable, which is the only
    property an assertion can rely on.
    """
    return -(-len(text) // 4)
