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
The Anthropic Messages API, behind an optional extra.

Two rules shape this module. The SDK is imported inside the functions that need
it, never at module scope, so that a deployment without the extra installed
still starts every Superset process. And every endpoint, credential and model
identifier arrives through configuration: there is no default base URL, no
default model and no default key here, because a value baked into this file is a
value a deployment cannot change without forking.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Iterable, Iterator
from dataclasses import dataclass, field
from typing import Any, ClassVar

from superset.ai.llm.base import (
    BaseLLMProvider,
    CompletionRequest,
    first_json_object,
    LLMConfigurationError,
    LLMError,
    LLMRequestError,
    LLMResponse,
    LLMTransportError,
    Message,
    ModelAlias,
    ProviderStreamEvent,
    StreamEventKind,
    ToolCall,
)
from superset.ai.types import MessageRole, TokenUsage

logger = logging.getLogger(__name__)

#: Output ceiling when neither the request nor the configuration names one. The
#: Messages API requires ``max_tokens``, so a number has to come from somewhere.
DEFAULT_MAX_OUTPUT_TOKENS = 4096

#: Sub-500 statuses worth another attempt. 409 is deliberately absent: a
#: conflict is still a conflict on the next attempt.
_RETRYABLE_STATUSES = frozenset({408, 429})

#: Vendor stop reasons mapped onto the three the provider contract names.
_STOP_REASONS = {
    "end_turn": "end_turn",
    "tool_use": "tool_use",
    "max_tokens": "max_tokens",
    "stop_sequence": "end_turn",
}


class AnthropicProvider(BaseLLMProvider):
    """
    Talks to the Messages API over the vendor's async client.

    Configuration, all through ``AI_LLM_PROVIDER_CONFIG``:

    ``models``
        Required. Maps a :class:`~superset.ai.llm.base.ModelAlias` value —
        ``default``, ``fast``, ``reasoning`` — to a model identifier. These are
        also the identifiers a request may pin explicitly; anything else is
        refused rather than quietly replaced.
    ``api_key``
        Omit to let the SDK read its own environment variable, which keeps the
        secret out of Superset's configuration file.
    ``base_url``
        Omit for the vendor default. Set it to reach a compatible endpoint.
    ``default_headers``
        Extra headers on every request, for an endpoint that authenticates
        differently.
    ``max_output_tokens``, ``timeout_seconds``
        Per-deployment ceilings.
    """

    name: ClassVar[str] = "anthropic"
    supports_streaming: ClassVar[bool] = True

    def __init__(self, **config: Any) -> None:
        super().__init__(**config)
        self._async_client: Any = None

    def resolve_model(self, alias: ModelAlias) -> str:
        models = {
            str(key): value for key, value in (self.config.get("models") or {}).items()
        }
        model = models.get(alias.value)
        if not model:
            raise LLMConfigurationError(
                f"No Anthropic model is configured for the {alias.value!r} tier. "
                f"Set AI_LLM_PROVIDER_CONFIG['models']['{alias.value}'] to a "
                f"model identifier."
            )
        return str(model)

    async def complete(self, request: CompletionRequest) -> LLMResponse:
        # Built before the try block so that a configuration problem surfaces as
        # itself rather than as a translated transport failure.
        payload = self._payload(request)
        client = self._client()
        try:
            message = await client.messages.create(**payload)
        except Exception as ex:
            raise _translate(_sdk(), ex) from ex

        text, thinking, tool_calls = _parse_content(message.content or ())
        return LLMResponse(
            text=text,
            thinking=thinking,
            tool_calls=tool_calls,
            usage=_usage(payload["model"], getattr(message, "usage", None)),
            stop_reason=_STOP_REASONS.get(
                getattr(message, "stop_reason", None) or "", "end_turn"
            ),
        )

    async def stream(
        self,
        request: CompletionRequest,
    ) -> AsyncIterator[ProviderStreamEvent]:
        """
        Emit the answer as it is generated.

        Only the socket lives here; every shape decision is in
        :func:`translate_stream`, which is where the behaviour is tested.
        """
        payload = self._payload(request)
        client = self._client()
        assembler = _StreamAssembler(payload["model"])
        try:
            raw_stream = await client.messages.create(**payload, stream=True)
            async for raw in raw_stream:
                for event in assembler.push(raw):
                    yield event
            for event in assembler.finish():
                yield event
        except LLMError:
            # Already in the contract's vocabulary — a malformed tool call, say.
            raise
        except Exception as ex:
            raise _translate(_sdk(), ex) from ex

    async def aclose(self) -> None:
        """
        Close the SDK client, which owns a connection pool bound to this loop.

        Cleared as well as closed, so a provider reused for another turn on a
        different loop builds a client belonging to that loop instead of reaching
        into a closed one.
        """
        client = self._async_client
        self._async_client = None
        if client is None:
            return
        try:
            await client.close()
        except Exception:  # pylint: disable=broad-except
            # The turn is over; a client that will not shut down cleanly is worth
            # a log line and nothing more.
            logger.debug("The Anthropic client did not close cleanly", exc_info=True)

    def _payload(self, request: CompletionRequest) -> dict[str, Any]:
        system, messages = _split_system(request)
        payload: dict[str, Any] = {
            # An explicit identifier on the request wins over the alias,
            # and an unrecognised one is refused rather than substituted.
            "model": self.select_model(request),
            "max_tokens": (
                request.max_output_tokens
                or self.config.get("max_output_tokens")
                or DEFAULT_MAX_OUTPUT_TOKENS
            ),
            "messages": messages,
        }
        if system:
            payload["system"] = system
        if request.tools:
            payload["tools"] = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.input_schema,
                }
                for tool in request.tools
            ]
        if request.thinking_budget_tokens:
            payload["thinking"] = {
                "type": "enabled",
                "budget_tokens": request.thinking_budget_tokens,
            }
        elif request.temperature is not None:
            # Extended thinking pins sampling, and the API rejects a request
            # that asks for both, so temperature only travels without it.
            payload["temperature"] = request.temperature
        return payload

    def _client(self) -> Any:
        if self._async_client is None:
            sdk = _sdk()
            options: dict[str, Any] = {
                # Retries belong to superset.ai.llm.retry, which can tell a
                # transport failure from a permanent one and owns the policy. A
                # second retry loop inside the SDK would multiply against it.
                "max_retries": 0,
            }
            for key in ("api_key", "base_url", "default_headers"):
                if self.config.get(key) is not None:
                    options[key] = self.config[key]
            if self.config.get("timeout_seconds") is not None:
                options["timeout"] = self.config["timeout_seconds"]
            try:
                self._async_client = sdk.AsyncAnthropic(**options)
            except Exception as ex:
                raise LLMConfigurationError(
                    f"The Anthropic client could not be created: {ex}. Set "
                    f"AI_LLM_PROVIDER_CONFIG['api_key'], or the environment "
                    f"variable the SDK reads when no key is passed."
                ) from ex
        return self._async_client


def _sdk() -> Any:
    """
    Import the vendor SDK on demand.

    At module scope this import would stop every Superset process — web, worker
    and CLI alike — from starting unless the extra were installed, which is the
    opposite of optional.
    """
    try:
        import anthropic
    except ModuleNotFoundError as ex:
        raise LLMConfigurationError(
            "The Anthropic provider requires the 'anthropic' package, which is "
            "not installed. Run `pip install anthropic`, or point "
            "AI_LLM_PROVIDER_CLASS at a provider whose dependencies are present."
        ) from ex
    return anthropic


def _split_system(request: CompletionRequest) -> tuple[str, list[dict[str, Any]]]:
    """
    Separate system prose from the conversation.

    The Messages API takes the system prompt as its own parameter and rejects a
    system entry inside ``messages``, so a system-role message in the history is
    folded onto the prompt rather than dropped on the floor.
    """
    system = [request.system] if request.system else []
    messages: list[dict[str, Any]] = []
    for message in request.messages:
        if message.role == MessageRole.SYSTEM:
            if message.content:
                system.append(message.content)
            continue
        blocks = _content_blocks(message)
        if blocks:
            role = "assistant" if message.role == MessageRole.ASSISTANT else "user"
            messages.append({"role": role, "content": blocks})
    return "\n\n".join(system), messages


def _content_blocks(message: Message) -> list[dict[str, Any]]:
    """
    Render one turn as content blocks.

    Tool results come first because the API requires the block answering a
    ``tool_use`` to open the very next turn. Nothing else in a turn competes for
    that position: a turn carries results or calls, never both.
    """
    blocks: list[dict[str, Any]] = [
        {
            "type": "tool_result",
            "tool_use_id": result.call_id,
            "content": result.content,
            "is_error": result.is_error,
        }
        for result in message.tool_results
    ]
    if message.content:
        blocks.append({"type": "text", "text": message.content})
    blocks.extend(
        {
            "type": "tool_use",
            "id": call.id,
            "name": call.name,
            "input": call.arguments,
        }
        for call in message.tool_calls
    )
    return blocks


@dataclass
class _PendingTool:
    """A tool call arriving in fragments, held until its content block closes."""

    id: str = ""
    name: str = ""
    json_fragments: list[str] = field(default_factory=list)
    #: A complete arguments object, when the endpoint sent one on the opening
    #: event rather than only as fragments. Preferred over the fragments.
    input: dict[str, Any] | None = None


class _StreamAssembler:
    """
    Turns one vendor event stream into provider events.

    Stateful by necessity. Text and reasoning pass straight through as they
    arrive, which is the whole point of streaming, but a tool call's arguments
    are split across ``input_json_delta`` events and are only valid JSON once
    concatenated — so nothing can be emitted for a call until its block closes.

    Deliberately ignorant of the SDK: it reads attributes off whatever it is
    given. That is what lets the translation be tested against recorded event
    shapes instead of a live connection.
    """

    def __init__(self, model: str = "") -> None:
        self._model = model
        self._tools: dict[int, _PendingTool] = {}
        self._input_tokens = 0
        self._output_tokens = 0
        self._closed = False

    def push(self, raw: Any) -> list[ProviderStreamEvent]:
        """Translate one vendor event into zero or more provider events."""
        kind = getattr(raw, "type", "")
        if kind == "message_start":
            self._read_usage(getattr(getattr(raw, "message", None), "usage", None))
        elif kind == "content_block_start":
            self._open_block(raw)
        elif kind == "content_block_delta":
            return self._delta(raw)
        elif kind == "content_block_stop":
            return self._close_block(raw)
        elif kind == "message_delta":
            self._read_usage(getattr(raw, "usage", None))
        elif kind == "message_stop":
            return self.finish()
        # Anything else — a keep-alive ping, an event kind the vendor adds later
        # — is skipped. A stream is no place to fail over an event nobody asked
        # about.
        return []

    def finish(self) -> list[ProviderStreamEvent]:
        """
        Close the stream, emitting usage and the terminal event exactly once.

        A tool block still open here belongs to a truncated stream and holds
        incomplete JSON, so it is dropped rather than turned into a call the
        model never finished asking for.
        """
        if self._closed:
            return []
        self._closed = True
        return [
            ProviderStreamEvent(kind=StreamEventKind.USAGE, usage=self._usage()),
            ProviderStreamEvent(kind=StreamEventKind.STOP),
        ]

    def _open_block(self, raw: Any) -> None:
        block = getattr(raw, "content_block", None)
        if getattr(block, "type", "") == "tool_use":
            supplied = getattr(block, "input", None)
            self._tools[_index(raw)] = _PendingTool(
                id=getattr(block, "id", "") or "",
                name=getattr(block, "name", "") or "",
                # The vendor opens the block with an empty object and streams the
                # rest; a gateway may send it already filled in. Only a non-empty
                # one is worth keeping.
                input=(
                    dict(supplied) if isinstance(supplied, dict) and supplied else None
                ),
            )

    def _delta(self, raw: Any) -> list[ProviderStreamEvent]:
        delta = getattr(raw, "delta", None)
        kind = getattr(delta, "type", "")
        if kind == "text_delta":
            return [
                ProviderStreamEvent(
                    kind=StreamEventKind.TEXT,
                    text=getattr(delta, "text", "") or "",
                )
            ]
        if kind == "thinking_delta":
            return [
                ProviderStreamEvent(
                    kind=StreamEventKind.THINKING,
                    text=getattr(delta, "thinking", "") or "",
                )
            ]
        if kind == "input_json_delta":
            pending = self._tools.get(_index(raw))
            if pending is not None:
                pending.json_fragments.append(getattr(delta, "partial_json", "") or "")
        # A signature or citation delta carries nothing the provider contract
        # can express.
        return []

    def _close_block(self, raw: Any) -> list[ProviderStreamEvent]:
        pending = self._tools.pop(_index(raw), None)
        if pending is None:
            return []
        return [
            ProviderStreamEvent(
                kind=StreamEventKind.TOOL_USE,
                tool_call=_assemble_tool(pending),
            )
        ]

    def _read_usage(self, raw: Any) -> None:
        # Input tokens arrive on the opening event and output tokens on the
        # closing one, so both are folded in as they appear rather than read off
        # a single event.
        self._input_tokens = (
            int(getattr(raw, "input_tokens", 0) or 0) or self._input_tokens
        )
        self._output_tokens = (
            int(getattr(raw, "output_tokens", 0) or 0) or self._output_tokens
        )

    def _usage(self) -> TokenUsage:
        return TokenUsage(
            model=self._model,
            input_tokens=self._input_tokens,
            output_tokens=self._output_tokens,
            requests=1,
        )


def translate_stream(
    raw_events: Iterable[Any],
    model: str = "",
) -> Iterator[ProviderStreamEvent]:
    """
    Map a vendor event stream onto provider events.

    Pure: no SDK import, no socket, no clock. The same assembler drives
    :meth:`AnthropicProvider.stream`, so exercising this function against
    recorded event shapes exercises the real translation.
    """
    assembler = _StreamAssembler(model)
    for raw in raw_events:
        yield from assembler.push(raw)
    yield from assembler.finish()


def _assemble_tool(pending: _PendingTool) -> ToolCall:
    """
    Parse the JSON a tool's arguments arrived in.

    The block's own ``input`` wins when the endpoint supplied a complete one:
    some gateways in front of the vendor API send both a finished ``input`` and
    the fragment stream, and the finished object is the one that is certainly
    whole.

    Otherwise the fragments are concatenated and the *first* complete object is
    taken, rather than requiring the whole buffer to be exactly one object. A
    gateway that repeats the fragment stream produces a buffer holding the same
    object twice, which a strict parse rejects as "Extra data" — failing a run
    over a duplicated copy of the very arguments being asked for. Trailing bytes
    are logged, because they mean something upstream is misbehaving.

    Arguments that are not a JSON object at all describe a call nobody can
    dispatch, which is a request error rather than a transport one: another
    attempt would produce a differently broken call, not a working one.
    """
    if isinstance(pending.input, dict) and pending.input:
        return ToolCall(id=pending.id, name=pending.name, arguments=pending.input)

    raw = "".join(pending.json_fragments).strip() or "{}"
    try:
        arguments, trailing = first_json_object(raw)
    except (TypeError, ValueError) as ex:
        raise LLMRequestError(
            f"The streamed call to {pending.name!r} carried arguments that are "
            f"not a JSON object: {ex}"
        ) from ex
    if not isinstance(arguments, dict):
        raise LLMRequestError(
            f"The streamed call to {pending.name!r} carried arguments that are "
            f"not a JSON object: got {type(arguments).__name__}"
        )
    if trailing:
        logger.warning(
            "Ignoring %s trailing bytes after the arguments for %r; the stream "
            "appears to repeat or concatenate tool-call fragments",
            len(trailing),
            pending.name,
        )
    return ToolCall(id=pending.id, name=pending.name, arguments=dict(arguments))


def _index(raw: Any) -> int:
    """Which content block an event belongs to; absent means the first."""
    return int(getattr(raw, "index", 0) or 0)


def _parse_content(blocks: Iterable[Any]) -> tuple[str, str, list[ToolCall]]:
    """Pull answer text, reasoning and tool calls out of a reply's blocks."""
    texts: list[str] = []
    thoughts: list[str] = []
    calls: list[ToolCall] = []
    for block in blocks:
        kind = getattr(block, "type", "")
        if kind == "text":
            texts.append(block.text)
        elif kind == "thinking":
            thoughts.append(getattr(block, "thinking", ""))
        elif kind == "tool_use":
            calls.append(
                ToolCall(
                    id=block.id,
                    name=block.name,
                    arguments=dict(block.input or {}),
                )
            )
    return "".join(texts), "".join(thoughts), calls


def _usage(model: str, raw: Any) -> TokenUsage:
    return TokenUsage(
        model=model,
        input_tokens=int(getattr(raw, "input_tokens", 0) or 0),
        output_tokens=int(getattr(raw, "output_tokens", 0) or 0),
        requests=1,
    )


def _translate(sdk: Any, ex: Exception) -> LLMError:
    """
    Classify a vendor failure as retryable or permanent.

    A reset connection or a timeout deserves another attempt. A rejected request
    does not, and retrying it turns one bad request into four.
    """
    if isinstance(ex, sdk.APIConnectionError):
        # APITimeoutError subclasses this, so both land here.
        return LLMTransportError(f"Anthropic transport failure: {ex}")
    status = _status_code(ex)
    if status is None:
        # Neither a transport failure nor an HTTP response: a client-side error
        # or a bug, and another attempt cannot change either.
        return LLMRequestError(f"The Anthropic call failed: {ex}")
    if status in _RETRYABLE_STATUSES or status >= 500:
        return LLMTransportError(f"Anthropic returned HTTP {status}: {ex}")
    return LLMRequestError(f"Anthropic rejected the request, HTTP {status}: {ex}")


def _status_code(ex: Exception) -> int | None:
    """The HTTP status behind an exception, from wherever the SDK put it."""
    status = getattr(ex, "status_code", None)
    if status is None:
        status = getattr(getattr(ex, "response", None), "status_code", None)
    return status if isinstance(status, int) else None
