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
The default runtime: a plain tool-use loop over the provider's message API.

Chosen as the default because it needs nothing beyond an HTTP call — no agent
engine subprocess, no working directory, no bundled binary — so it works with
whatever provider a deployment configures.
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from superset.ai.events import (
    assistant_delta_event,
    checkpoint_event,
    error_event,
    final_event,
    GENERIC_ERROR_MESSAGE,
    StreamEvent,
    thinking_event,
    thoughts_event,
)
from superset.ai.llm.base import (
    CompletionRequest,
    LLMError,
    LLMResponse,
    Message,
    StreamEventKind,
    ToolCall,
    ToolResult,
)
from superset.ai.runtime.base import BaseAgentRuntime, RunRequest, RunResult
from superset.ai.telemetry import (
    current_run,
    POLICY_DENIED,
    RunRecorder,
    TOOL_UNAVAILABLE,
)
from superset.ai.types import MessageRole, ProgressStage, TokenUsage

logger = logging.getLogger(__name__)

#: How much of a tool's output is kept on the persisted message. The model
#: still sees the whole thing; this is the audit copy.
_RECORDED_OUTPUT_LIMIT = 2_000

#: Size of the chunks the finished answer is delivered in.
_DELIVERY_CHUNK_SIZE = 512

#: How much reasoning is kept on the result. Reasoning can run several times
#: longer than the answer, and this is persisted next to it.
_RECORDED_THOUGHTS_LIMIT = 8_000

_NO_ANSWER = (
    "I wasn't able to reach an answer for that. Try narrowing the question, "
    "or naming the dataset you have in mind."
)


class MessagesApiRuntime(BaseAgentRuntime):
    """
    Alternates model calls and tool calls until the model stops asking.

    Two behaviours are worth understanding before changing this class.

    First, prose the model emits *before* a tool call is treated as reasoning,
    not answer: it becomes a ``thoughts`` event and is dropped from the answer.
    A model narrating "the orders table looks right, let me check" is stating a
    hypothesis it may abandon, and appending that to the answer produces a
    reply that contradicts itself.

    Second, the loop always terminates and never raises for an operational
    failure. By the time it runs, response headers have been flushed and an
    exception can no longer become an HTTP status, so every failure is an event.
    """

    def __init__(self, provider: Any) -> None:
        super().__init__(provider)
        self._result = RunResult()
        #: Set when the model signals it has finished answering.
        self._finished = False
        #: The most recent round trip's response, or ``None`` if it failed. The
        #: turn methods are generators and cannot return a value.
        self._last_response: LLMResponse | None = None
        #: Whether any answer text has already been sent as it was generated. The
        #: finished answer is only replayed in chunks when it has not.
        self._streamed_text = False

    @property
    def result(self) -> RunResult:
        return self._result

    async def run(self, request: RunRequest) -> AsyncIterator[StreamEvent]:
        self._result = RunResult()
        self._finished = False
        self._last_response = None
        self._streamed_text = False
        answer_parts: list[str] = []

        yield thinking_event(ProgressStage.START, "Working on your question")

        # The provider's connection pool belongs to the loop this run is driven
        # on, and the caller closes that loop as soon as the run ends. Closing
        # here — inside the loop, however the run finishes, including when the
        # generator is abandoned mid-way by a user pressing stop — is what keeps
        # a client from being finalised against a dead loop.
        try:
            async for event in self._turn_loop(request, answer_parts):
                yield event

            # A run that failed or was abandoned has already said so; emitting an
            # answer as well would contradict it.
            if self._result.error is not None or self._result.cancelled:
                return

            answer = "\n\n".join(part for part in answer_parts if part).strip()
            self._result.answer = answer or _NO_ANSWER

            # Only replayed when nothing was streamed — a provider without
            # streaming support still gets to deliver its answer progressively.
            # Replaying after live text would show the answer twice.
            if not self._streamed_text:
                for chunk in _chunk(self._result.answer):
                    yield assistant_delta_event(chunk)
            yield final_event(self._result.answer)
        finally:
            await self.provider.aclose()

    async def _turn_loop(
        self,
        request: RunRequest,
        answer_parts: list[str],
    ) -> AsyncIterator[StreamEvent]:
        """
        Alternate model and tool calls until the model stops or a budget runs out.

        Appends to ``answer_parts`` rather than returning the answer, because an
        async generator cannot both yield events and return a value.
        """
        deadline = time.monotonic() + request.timeout_seconds
        conversation = list(request.messages)

        for turn in range(1, request.max_turns + 1):
            self._result.turns = turn

            if self._should_stop(request, deadline):
                if self._result.timed_out:
                    yield thinking_event(
                        ProgressStage.FALLBACK,
                        "Taking longer than expected — answering with what I have",
                    )
                return

            async for event in self._safe_turn(request, conversation, turn):
                yield event
            response = self._last_response
            if response is None:
                yield error_event()
                return

            async for event in self._consume(
                request, response, conversation, answer_parts
            ):
                yield event

            if self._finished or self._result.cancelled:
                return

        # Budget exhausted without the model choosing to stop.
        yield thinking_event(
            ProgressStage.FALLBACK,
            "Reached the step limit — answering with what I have",
        )

    async def _consume(
        self,
        request: RunRequest,
        response: LLMResponse,
        conversation: list[Message],
        answer_parts: list[str],
    ) -> AsyncIterator[StreamEvent]:
        """Act on one model response, running any tools it asked for."""
        if response.thinking:
            self._record_thoughts(response.thinking)
            yield thoughts_event(response.thinking)

        if not response.wants_tools:
            self._finished = True
            if response.text:
                answer_parts.append(response.text)
                # Recorded as it arrives, not just at the end, so a run stopped
                # after this point still persists what the user already saw.
                self._result.answer = "\n\n".join(
                    part for part in answer_parts if part
                ).strip()
            return

        # Prose accompanying a tool call is reasoning, not answer.
        if response.text:
            self._record_thoughts(response.text)
            yield thoughts_event(response.text)

        conversation.append(
            Message(
                role=MessageRole.ASSISTANT,
                content=response.text,
                tool_calls=list(response.tool_calls),
            )
        )

        results: list[ToolResult] = []
        async for event in self._run_tools(request, response.tool_calls, results):
            yield event

        conversation.append(Message(role=MessageRole.USER, tool_results=results))

    async def _run_tools(
        self,
        request: RunRequest,
        calls: list[ToolCall],
        results: list[ToolResult],
    ) -> AsyncIterator[StreamEvent]:
        """Execute this turn's tool calls, appending outcomes to ``results``."""
        for call in calls:
            if self._cancelled(request):
                self._result.cancelled = True
                return

            yield thinking_event(
                ProgressStage.TOOL,
                f"Running {call.name}",
                {"tool_name": call.name},
            )
            result, detail = self._invoke_tool(request, call)
            results.append(result)
            record = self._record_call(call, result, detail)

            # The frame carries the same record that is persisted, rather than a
            # subset assembled separately. The subset was missing the arguments
            # and the output, so a step expanded during a run showed nothing at
            # all unless its tool happened to supply a display — and then filled
            # itself in on reload, which looked like the detail arrived late.
            # Sharing one record makes that class of drift impossible.
            yield checkpoint_event(
                f"{'Failed' if result.is_error else 'Finished'} {call.name}",
                # ``tool_name`` as well as ``name``: the progress frames use that
                # key, so a consumer reading either finds what it expects.
                {"tool_name": call.name, **record},
            )

    async def _safe_turn(
        self,
        request: RunRequest,
        conversation: list[Message],
        turn: int,
    ) -> AsyncIterator[StreamEvent]:
        """
        One model round trip, converting failure into a ``None`` response.

        A generator rather than a coroutine so the answer can reach the client as
        the model produces it. The response is handed back on
        :attr:`_last_response` because an async generator cannot both yield events
        and return a value — the same reason ``_turn_loop`` writes into
        ``answer_parts``.

        The failure detail goes to the log; the caller emits a message that cannot
        leak a URL, a credential or a fragment of someone else's query.
        """
        recorder = current_run()
        started = time.monotonic()
        self._last_response = None
        try:
            async for event in self._one_turn(request, conversation):
                yield event
        except LLMError as ex:
            logger.warning("AI provider error on turn %s: %s", turn, ex)
            self._result.error = str(ex)
            self._trace_model_call(recorder, request, turn, started, error=ex)
            self._last_response = None
            return
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Unexpected error in AI runtime on turn %s", turn)
            self._result.error = GENERIC_ERROR_MESSAGE
            self._trace_model_call(recorder, request, turn, started, error=ex)
            self._last_response = None
            return
        self._trace_model_call(
            recorder, request, turn, started, response=self._last_response
        )

    def _trace_model_call(
        self,
        recorder: RunRecorder,
        request: RunRequest,
        turn: int,
        started: float,
        response: LLMResponse | None = None,
        error: BaseException | None = None,
    ) -> None:
        """
        Report one round trip to telemetry.

        Content is passed as-is; whether any of it survives into a trace is the
        redaction policy's decision, made in one place rather than here.
        """
        if not recorder.enabled:
            return
        usage = response.usage if response is not None else TokenUsage()
        recorder.model_call(
            turn=turn,
            # The concrete identifier when the provider reported one, and the
            # capability tier otherwise, so a trace can always be grouped by
            # what the run asked for.
            model=usage.get("model") or request.model_alias.value,
            duration_ms=int((time.monotonic() - started) * 1000),
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
            stop_reason=response.stop_reason if response is not None else None,
            error_type=type(error).__name__ if error is not None else None,
            system_prompt=request.system_prompt,
            response_text=response.text if response is not None else None,
        )
        if error is not None:
            recorder.error(error)

    async def _one_turn(
        self,
        request: RunRequest,
        conversation: list[Message],
    ) -> AsyncIterator[StreamEvent]:
        """
        Call the model once, yielding answer text as the model produces it.

        Streaming is used when the provider supports it. The assembled response
        is left on :attr:`_last_response` rather than returned, because a
        generator cannot do both; it has the same shape either way, so callers do
        not branch on which path ran.
        """
        completion = CompletionRequest(
            messages=conversation,
            system=request.system_prompt,
            model_alias=request.model_alias,
            tools=tuple(request.tools.definitions()) if request.tools else (),
        )

        if not self.provider.supports_streaming:
            self._last_response = await self.provider.complete(completion)
            return

        text_parts: list[str] = []
        thinking_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        usage = None

        async for event in self.provider.stream(completion):
            if event.kind is StreamEventKind.TEXT:
                text_parts.append(event.text)
                # Forwarded as it arrives. Text is buffered as well, because the
                # turn is only known to be an answer once the model stops without
                # asking for a tool — prose before a tool call is reasoning, and
                # is re-routed as such in ``_consume``. A reader that has already
                # seen it replaces its copy on the ``final`` frame.
                if event.text:
                    self._streamed_text = True
                    yield assistant_delta_event(event.text)
            elif event.kind is StreamEventKind.THINKING:
                thinking_parts.append(event.text)
            elif event.kind is StreamEventKind.TOOL_USE and event.tool_call:
                tool_calls.append(event.tool_call)
            elif event.kind is StreamEventKind.USAGE:
                usage = event.usage

        self._last_response = LLMResponse(
            text="".join(text_parts),
            thinking="".join(thinking_parts),
            tool_calls=tool_calls,
            usage=usage or {},
            stop_reason="tool_use" if tool_calls else "end_turn",
        )

    def _invoke_tool(
        self,
        request: RunRequest,
        call: ToolCall,
    ) -> tuple[ToolResult, dict[str, Any]]:
        """
        Run one tool call, through the policy chain first.

        Returns the model-facing result plus a display dict for the UI. A denial
        is handed back to the model as an error result rather than raised,
        because the reason text is what steers it towards an acceptable
        alternative. A tool that raises is treated the same way: one broken tool
        should not end an otherwise productive turn.

        Every exit reports a telemetry span, so a refusal and a failure are as
        visible to a monitoring system as a success is.
        """
        if request.policies is not None:
            denial = request.policies.check(call.name, call.arguments)
            if denial is not None:
                return self._traced(
                    call,
                    ToolResult(call_id=call.id, content=denial.reason, is_error=True),
                    {"denied": True},
                    error_type=POLICY_DENIED,
                )

        if request.tools is None:
            return self._traced(
                call,
                ToolResult(
                    call_id=call.id,
                    content=f"No tool named {call.name} is available.",
                    is_error=True,
                ),
                {},
                error_type=TOOL_UNAVAILABLE,
            )

        try:
            result, detail = self._dispatch(request.tools, call)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("AI tool %s failed", call.name)
            # The model is told the tool failed but not why, for the same reason
            # the user is not: exception text is not a safe channel.
            return self._traced(
                call,
                ToolResult(
                    call_id=call.id,
                    content=f"{call.name} failed and returned no result.",
                    is_error=True,
                ),
                {},
                error_type=type(ex).__name__,
            )
        return self._traced(call, result, detail)

    def _traced(
        self,
        call: ToolCall,
        result: ToolResult,
        detail: dict[str, Any],
        error_type: str | None = None,
    ) -> tuple[ToolResult, dict[str, Any]]:
        """
        Report one tool invocation and hand the outcome back unchanged.

        Placed on the return path of :meth:`_invoke_tool` so that a denial, an
        unknown tool and a raising tool are each reported once, with the failure
        class the caller could not have reconstructed from the result alone.
        """
        recorder = current_run()
        if recorder.enabled:
            recorder.tool_call(
                tool_name=call.name,
                # The dispatcher already timed the work. Timing it again here
                # would report the same milliseconds twice under two names.
                duration_ms=int(detail.get("duration_ms") or 0),
                ok=not result.is_error,
                error_type=error_type,
                truncated=bool(detail.get("truncated")),
                arguments=call.arguments,
                output=result.content,
            )
        return result, detail

    def _dispatch(
        self,
        tools: Any,
        call: ToolCall,
    ) -> tuple[ToolResult, dict[str, Any]]:
        """
        Call the dispatcher, preferring the richer interface when offered.

        A dispatcher that only implements ``dispatch`` still works — it simply
        contributes no display detail — which keeps the minimum a test stub has
        to implement small.
        """
        invoke = getattr(tools, "invoke", None)
        if invoke is None:
            return tools.dispatch(call), {}

        invocation = invoke(call)
        detail: dict[str, Any] = {"duration_ms": getattr(invocation, "duration_ms", 0)}
        if getattr(invocation, "truncated", False):
            detail["truncated"] = True
        if display := getattr(invocation, "display", None):
            detail["display"] = display
        return invocation.result, detail

    def _record_thoughts(self, text: str) -> None:
        """
        Keep reasoning on the result as it is produced.

        Bounded, because reasoning on a long run can outgrow the answer several
        times over and this is persisted alongside it.
        """
        combined = f"{self._result.thoughts}\n\n{text}".strip()
        self._result.thoughts = combined[-_RECORDED_THOUGHTS_LIMIT:]

    def _record_call(
        self,
        call: ToolCall,
        result: ToolResult,
        detail: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Keep a bounded audit trail of what the run did, and return the record.

        Persisted on the assistant message, which is what lets the transcript
        still show the SQL a run executed after the page is reloaded. Returned so
        the caller can put the identical record on the wire, keeping the live view
        and the reloaded one in step.
        """
        record: dict[str, Any] = {
            "name": call.name,
            "arguments": call.arguments,
            "ok": not result.is_error,
            "output": result.content[:_RECORDED_OUTPUT_LIMIT],
        }
        # A failure's text is its error, not its output. Recorded under both keys
        # because they are read by different things, and a reader that shows the
        # error under "Returned" is mislabelling it.
        if result.is_error:
            record["error"] = result.content[:_RECORDED_OUTPUT_LIMIT]
        if detail:
            record.update(detail)
        self._result.tool_calls.append(record)
        return record

    def _should_stop(self, request: RunRequest, deadline: float) -> bool:
        """Whether a budget has run out, recording which one on the result."""
        if self._cancelled(request):
            self._result.cancelled = True
            return True
        if time.monotonic() >= deadline:
            self._result.timed_out = True
            return True
        return False

    def _cancelled(self, request: RunRequest) -> bool:
        """Whether the caller has asked the run to stop."""
        return request.should_cancel is not None and request.should_cancel()


def _chunk(text: str, size: int = _DELIVERY_CHUNK_SIZE) -> list[str]:
    """
    Split the finished answer for delivery.

    The answer is already complete here, so this is only so that a very long
    reply arrives in usable pieces rather than as one frame.
    """
    if not text:
        return []
    return [text[index : index + size] for index in range(0, len(text), size)]
