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
The provider contract.

Superset core never names a model vendor. A deployment points
``AI_LLM_PROVIDER_CLASS`` at an implementation of :class:`BaseLLMProvider`,
which is the single place where an API shape, a base URL, an authentication
scheme or a hosting arrangement is allowed to appear. That keeps a private
gateway, a self-hosted model, or a different vendor a configuration change
rather than a fork.

Nothing here imports a vendor SDK, so this module is safe to import in any
process regardless of which optional extras are installed.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from typing import Any, ClassVar

from superset.ai.types import MessageRole, TokenUsage
from superset.utils import json
from superset.utils.backports import StrEnum


class ModelAlias(StrEnum):
    """
    What a caller asks for, rather than which model it gets.

    Profiles and prompts refer to capability tiers; the provider maps them to
    concrete model identifiers. This is what stops vendor model names from
    leaking into prompts, profiles and configuration defaults.
    """

    #: Balanced default for interactive use.
    DEFAULT = "default"
    #: Cheapest and quickest; short classifications and titles.
    FAST = "fast"
    #: Most capable; multi-step analysis.
    REASONING = "reasoning"


class StreamEventKind(StrEnum):
    """Kinds of chunk a provider may yield while streaming."""

    TEXT = "text"
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    USAGE = "usage"
    STOP = "stop"


@dataclass(frozen=True)
class ToolDefinition:
    """
    A tool offered to the model, in provider-neutral form.

    ``input_schema`` is a JSON Schema object. Providers translate this into
    whatever their API expects.
    """

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class ToolCall:
    """A model's request to invoke a tool."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolResult:
    """The outcome of a tool invocation, fed back to the model."""

    call_id: str
    content: str
    is_error: bool = False


@dataclass
class Message:
    """
    One conversational turn as the provider sees it.

    Distinct from the persisted :class:`~superset.models.ai.AIChatMessage`:
    this is transport shape, including tool traffic that is never a row.
    """

    role: MessageRole
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)


@dataclass
class CompletionRequest:
    """Everything a provider needs for one round trip."""

    messages: list[Message]
    system: str = ""
    model_alias: ModelAlias = ModelAlias.DEFAULT
    #: An exact model identifier, overriding ``model_alias`` when set. This is
    #: how a caller pins a specific model — a user picking one in the UI, or an
    #: evaluation comparing two. A provider must reject an identifier it does
    #: not recognise rather than substituting a default, so that cost and answer
    #: quality stay attributable to the model actually used.
    model: str | None = None
    tools: Sequence[ToolDefinition] = ()
    max_output_tokens: int | None = None
    temperature: float | None = None
    #: Extra thinking budget, when the provider supports it. ``None`` leaves
    #: the provider default alone.
    thinking_budget_tokens: int | None = None


@dataclass
class LLMResponse:
    """A single completed round trip."""

    text: str = ""
    thinking: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    usage: TokenUsage = field(default_factory=lambda: TokenUsage())
    #: Provider-reported reason the turn ended, normalised where possible to
    #: one of ``end_turn``, ``tool_use``, ``max_tokens``.
    stop_reason: str = "end_turn"

    @property
    def wants_tools(self) -> bool:
        """Whether the model asked to call tools and expects results back."""
        return bool(self.tool_calls)


@dataclass(frozen=True)
class ProviderStreamEvent:
    """One chunk yielded by :meth:`BaseLLMProvider.stream`."""

    kind: StreamEventKind
    text: str = ""
    tool_call: ToolCall | None = None
    usage: TokenUsage | None = None


@dataclass(frozen=True)
class RetryPolicy:
    """
    How to retry a failed round trip.

    Defaults are exponential backoff with equal jitter, which spreads a
    thundering herd after a provider outage instead of synchronising every
    worker onto the same retry instant.
    """

    max_attempts: int = 4
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 8.0


class LLMError(Exception):
    """Base class for provider failures."""


class LLMTransportError(LLMError):
    """
    A failure that may succeed if retried.

    Rate limits, timeouts, connection resets and server-side errors.
    """


class LLMRequestError(LLMError):
    """
    A failure that will never succeed if retried.

    Malformed requests, authentication failures, unknown models.
    """


class LLMConfigurationError(LLMError):
    """The provider is not usable as configured, e.g. a missing credential."""


def first_json_object(raw: str) -> tuple[Any, str]:
    """
    Decode the first complete JSON object in ``raw``, returning what followed it.

    Tool arguments arrive as concatenated fragments, and a gateway that repeats the
    fragment stream produces a buffer holding the same object twice. A strict parse
    rejects that as "Extra data" — failing a run over a duplicate of the very
    arguments being requested — so the first object is taken and the remainder
    handed back for the caller to log.

    Scans for the matching brace rather than using a streaming decoder, because the
    repository bans the standard library's ``json`` in favour of
    ``superset.utils.json``, which exposes no incremental decoder. Quotes and
    escapes are tracked so a brace inside a string value does not end the object
    early.

    :param raw: The accumulated argument text
    :returns: The parsed value, and any text following the first object
    :raises ValueError: If the text does not parse at all
    """
    text = raw.strip()
    end = _object_end(text)
    if end is None:
        # Not an object, or never balanced. Either way the decoder's own error on
        # the whole string is the most informative one.
        return json.loads(text), ""
    return json.loads(text[:end]), text[end:].strip()


def _object_end(text: str) -> int | None:
    """
    Index just past the first balanced ``{...}``, or ``None`` if there is none.

    Quotes and escapes are tracked so a brace inside a string value does not end
    the object early.
    """
    if not text.startswith("{"):
        return None
    depth = 0
    # Tracks whether the cursor is inside a string literal, and whether the
    # previous character escaped this one, so a brace or quote in a value cannot
    # end the object early.
    state = {"in_string": False, "escaped": False}
    for index, char in enumerate(text):
        if _consumed_by_string(char, state):
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index + 1
    return None


def _consumed_by_string(char: str, state: dict[str, bool]) -> bool:
    """Advance the string/escape state, reporting whether ``char`` was inside one."""
    if state["in_string"]:
        if state["escaped"]:
            state["escaped"] = False
        elif char == "\\":
            state["escaped"] = True
        elif char == '"':
            state["in_string"] = False
        return True
    if char == '"':
        state["in_string"] = True
        return True
    return False


class BaseLLMProvider(ABC):
    """
    A deployment's model provider.

    Selected with ``AI_LLM_PROVIDER_CLASS`` and constructed with
    ``AI_LLM_PROVIDER_CONFIG`` as keyword arguments.
    """

    #: Human-readable name, used in logs and error messages only.
    name: ClassVar[str] = "unnamed"

    #: Whether this provider can stream. A non-streaming provider still works;
    #: the runtime falls back to emitting the answer once it is complete.
    supports_streaming: ClassVar[bool] = True

    def __init__(self, **config: Any) -> None:
        self.config = config

    @abstractmethod
    def resolve_model(self, alias: ModelAlias) -> str:
        """
        Map a capability tier to a concrete model identifier.

        Raise :class:`LLMConfigurationError` if the deployment has not
        configured a model for the requested tier. Never invent an identifier:
        a vendor default baked into Superset would silently change what a
        deployment is paying for.
        """

    def available_models(self) -> list[str]:
        """
        Concrete model identifiers this deployment has configured.

        Used to offer a picker and to validate a requested model before a round
        trip. The default reports whatever the three tiers resolve to.
        """
        models: list[str] = []
        for alias in ModelAlias:
            try:
                resolved = self.resolve_model(alias)
            except LLMConfigurationError:
                continue
            if resolved not in models:
                models.append(resolved)
        return models

    def select_model(self, request: CompletionRequest) -> str:
        """
        Decide which model a request runs against.

        An explicit identifier wins over the alias, and is checked against the
        configured set so a typo fails loudly instead of quietly running on
        something else.
        """
        if request.model is None:
            return self.resolve_model(request.model_alias)
        if request.model not in self.available_models():
            raise LLMRequestError(
                f"Model {request.model!r} is not configured for this deployment."
            )
        return request.model

    @abstractmethod
    async def complete(self, request: CompletionRequest) -> LLMResponse:
        """
        Perform one non-streaming round trip.

        Raise :class:`LLMTransportError` for retryable failures and
        :class:`LLMRequestError` for permanent ones, so the retry middleware
        can tell them apart without inspecting vendor exception types.
        """

    async def stream(
        self,
        request: CompletionRequest,
    ) -> AsyncIterator[ProviderStreamEvent]:
        """
        Perform one streaming round trip.

        The default implementation degrades to :meth:`complete` and yields the
        result as a single text chunk, so a provider that cannot stream needs
        to implement only one method.
        """
        response = await self.complete(request)
        if response.thinking:
            yield ProviderStreamEvent(
                kind=StreamEventKind.THINKING,
                text=response.thinking,
            )
        if response.text:
            yield ProviderStreamEvent(
                kind=StreamEventKind.TEXT,
                text=response.text,
            )
        for call in response.tool_calls:
            yield ProviderStreamEvent(
                kind=StreamEventKind.TOOL_USE,
                tool_call=call,
            )
        yield ProviderStreamEvent(
            kind=StreamEventKind.USAGE,
            usage=response.usage,
        )
        yield ProviderStreamEvent(kind=StreamEventKind.STOP)

    async def aclose(self) -> None:  # noqa: B027
        """
        Release anything bound to the running event loop.

        A provider holding an async HTTP client must close it here. A turn runs on
        a loop of its own — the API layer is synchronous — and a client left open
        is finalised by the garbage collector after that loop has closed, which
        surfaces as ``RuntimeError: Event loop is closed`` from deep inside the
        transport and leaves sockets to be reaped by the OS.

        Called after every run, so it must tolerate being called when nothing was
        ever opened. Deliberately concrete and empty rather than abstract: a
        provider that holds no connection should not have to implement it.
        """

    def retry_policy(self) -> RetryPolicy:
        """Retry behaviour for this provider. Override to tune."""
        return RetryPolicy()

    def subprocess_env(self, model: str) -> dict[str, str]:
        """
        Environment for a runtime that hosts an external engine process.

        Empty by default. This exists so that a deployment routing through a
        gateway can supply the environment that engine needs without Superset
        core containing any knowledge of it.
        """
        return {}
