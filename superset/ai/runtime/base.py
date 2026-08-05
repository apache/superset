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
The runtime contract.

A runtime owns the loop between a user's question and a final answer: how many
times to call the model, when to run tools, and what to emit while it works.
Swapping it is a configuration change (``AI_AGENT_RUNTIME_CLASS``), which is
what lets a deployment host a different agent engine without touching the API,
the storage layer or the tool layer.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from superset.ai.events import StreamEvent
from superset.ai.llm.base import (
    BaseLLMProvider,
    Message,
    ModelAlias,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.policy import PolicyChain


@runtime_checkable
class ToolDispatcher(Protocol):
    """
    The slice of the tool layer a runtime needs.

    Expressed as a protocol rather than a concrete class so the runtime can be
    tested against a stub, and so the tool registry can evolve independently.
    """

    def definitions(self) -> list[ToolDefinition]:
        """Tools to offer the model this turn."""

    def dispatch(self, call: ToolCall) -> ToolResult:
        """Run one tool call and return its result."""


@runtime_checkable
class RichToolDispatcher(Protocol):
    """
    A dispatcher that also reports what a call did, for display.

    Kept separate from :class:`ToolDispatcher` so the minimum a runtime needs
    stays small: a stub in a test implements two methods, while the real
    registry additionally surfaces the timing and UI summary that the event
    stream and the stored transcript want.
    """

    def definitions(self) -> list[ToolDefinition]:
        """Tools to offer the model this turn."""

    def invoke(self, call: ToolCall) -> Any:
        """
        Run one tool call, returning an object exposing at least ``result``,
        ``display``, ``duration_ms`` and ``truncated``.
        """


@dataclass
class RunRequest:
    """Everything needed to answer one user turn."""

    #: Conversation so far, oldest first, already trimmed to the configured
    #: history budget by the caller.
    messages: list[Message]
    system_prompt: str
    tools: ToolDispatcher | None = None
    policies: PolicyChain | None = None
    model_alias: ModelAlias = ModelAlias.DEFAULT
    max_turns: int = 20
    timeout_seconds: float = 300.0
    #: Consulted between turns and around each tool call. Returning ``True``
    #: ends the run cleanly rather than abandoning it, so partial work is still
    #: reported and the transcript stays coherent.
    should_cancel: Callable[[], bool] | None = None


@dataclass
class RunResult:
    """Outcome of a run, for persistence and metrics."""

    #: The answer so far. Written as the run progresses rather than only at the
    #: end, so a run that is stopped part-way still has something to persist —
    #: a user who cancels should keep what had already been produced, not be
    #: left with an empty message.
    answer: str = ""
    #: Reasoning emitted so far, kept for the same reason.
    thoughts: str = ""
    tool_calls: list[dict[str, object]] = field(default_factory=list)
    turns: int = 0
    cancelled: bool = False
    timed_out: bool = False
    error: str | None = None

    @property
    def ok(self) -> bool:
        """Whether the run produced an answer without failing."""
        return self.error is None and not self.cancelled and not self.timed_out


class BaseAgentRuntime(ABC):
    """
    Drives one user turn to completion.

    Implementations are constructed with a provider and emit
    :class:`~superset.ai.events.StreamEvent` objects as they work, so the API
    layer stays ignorant of how an answer was produced.
    """

    def __init__(self, provider: BaseLLMProvider) -> None:
        self.provider = provider

    @abstractmethod
    def run(self, request: RunRequest) -> AsyncIterator[StreamEvent]:
        """
        Execute the turn, yielding events as they happen.

        Must not raise for ordinary failures: a provider outage, a tool error
        or a timeout is reported as an event and reflected in
        :attr:`result`, because the caller has already flushed response headers
        and cannot turn an exception into an HTTP status.
        """

    @property
    @abstractmethod
    def result(self) -> RunResult:
        """
        Outcome of the most recent :meth:`run`.

        Read after the event stream is exhausted; the caller persists this.
        """


def offered_tool_names(tools: ToolDispatcher | None) -> Sequence[str]:
    """Names of the tools a dispatcher exposes, for prompt validation."""
    if tools is None:
        return ()
    return [definition.name for definition in tools.definitions()]
