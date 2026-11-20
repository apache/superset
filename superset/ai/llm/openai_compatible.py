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
Any endpoint that speaks the OpenAI chat-completions protocol.

Which is most of them: the vendor's own service, a self-hosted inference server,
a proxy in front of either. The protocol is the contract, so this provider names
no vendor beyond the client library it borrows — every endpoint, credential and
model identifier arrives through configuration.

The SDK is imported inside the functions that need it, never at module scope, so
a deployment without the extra installed still starts every Superset process.
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
    ToolResult,
)
from superset.ai.types import MessageRole, TokenUsage
from superset.utils import json

logger = logging.getLogger(__name__)

#: Sub-500 statuses worth another attempt. 409 is deliberately absent: a
#: conflict is still a conflict on the next attempt.
_RETRYABLE_STATUSES = frozenset({408, 429})

#: Vendor finish reasons mapped onto the three the provider contract names.
_STOP_REASONS = {
    "stop": "end_turn",
    "tool_calls": "tool_use",
    "function_call": "tool_use",
    "length": "max_tokens",
}


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Talks chat completions over the vendor's async client.

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
        Required for anything other than the vendor's own service.
    ``default_headers``
        Extra headers on every request, for an endpoint that authenticates
        differently.
    ``max_output_tokens``, ``timeout_seconds``
        Per-deployment ceilings.
    ``max_tokens_param``
        Which field carries the output ceiling. Defaults to ``max_tokens``,
        which almost every compatible server accepts; set it to
        ``max_completion_tokens`` for a server that has retired the older name.
    ``stream_usage``
        Whether to ask a streamed completion for token counts, which is the only
        way to get them. Defaults to on; turn it off for a server that rejects
        the whole request over an option it does not recognise.
    """

    name: ClassVar[str] = "openai_compatible"
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
                f"No model is configured for the {alias.value!r} tier. Set "
                f"AI_LLM_PROVIDER_CONFIG['models']['{alias.value}'] to a model "
                f"identifier."
            )
        return str(model)

    async def complete(self, request: CompletionRequest) -> LLMResponse:
        # Built before the try block so that a configuration problem surfaces as
        # itself rather than as a translated transport failure.
        payload = self._payload(request)
        client = self._client()
        try:
            completion = await client.chat.completions.create(**payload)
        except Exception as ex:
            raise _translate(_sdk(), ex) from ex

        if not completion.choices:
            raise LLMRequestError(
                "The endpoint returned a completion with no choices, which "
                "carries no answer and no reason for its absence."
            )
        choice = completion.choices[0]
        message = choice.message
        return LLMResponse(
            text=message.content or "",
            # Servers that expose a reasoning trace put it here. Absent on the
            # ones that do not, which is why it is read defensively.
            thinking=getattr(message, "reasoning_content", None) or "",
            tool_calls=_parse_tool_calls(getattr(message, "tool_calls", None) or ()),
            usage=_usage(payload["model"], getattr(completion, "usage", None)),
            stop_reason=_STOP_REASONS.get(
                getattr(choice, "finish_reason", None) or "", "end_turn"
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
        payload["stream"] = True
        if self.config.get("stream_usage", True):
            payload["stream_options"] = {"include_usage": True}
        client = self._client()
        assembler = _StreamAssembler(payload["model"])
        try:
            chunks = await client.chat.completions.create(**payload)
            async for chunk in chunks:
                for event in assembler.push(chunk):
                    yield event
            for event in assembler.finish():
                yield event
        except LLMError:
            # Already in the contract's vocabulary — a malformed tool call, say.
            raise
        except Exception as ex:
            raise _translate(_sdk(), ex) from ex

    def _payload(self, request: CompletionRequest) -> dict[str, Any]:
        payload: dict[str, Any] = {
            # An explicit identifier on the request wins over the alias,
            # and an unrecognised one is refused rather than substituted.
            "model": self.select_model(request),
            "messages": _encode_messages(request),
        }
        max_tokens = request.max_output_tokens or self.config.get("max_output_tokens")
        if max_tokens:
            param = self.config.get("max_tokens_param") or "max_tokens"
            payload[param] = max_tokens
        if request.tools:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema,
                    },
                }
                for tool in request.tools
            ]
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        # ``thinking_budget_tokens`` has no counterpart in this protocol and the
        # per-server extensions that approximate it disagree with each other, so
        # it is ignored rather than guessed at.
        return payload

    async def aclose(self) -> None:
        """
        Close the SDK client, which owns a connection pool bound to this loop.

        Cleared as well as closed, so a provider reused for another turn on a
        different loop builds a client belonging to that loop instead of reaching
        into a closed one. Without this the client is finalised by the garbage
        collector after the turn's loop has gone, which surfaces as
        ``RuntimeError: Event loop is closed`` from inside the transport.
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
            logger.debug("The model client did not close cleanly", exc_info=True)

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
                self._async_client = sdk.AsyncOpenAI(**options)
            except Exception as ex:
                raise LLMConfigurationError(
                    f"The client could not be created: {ex}. Set "
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
        import openai
    except ModuleNotFoundError as ex:
        raise LLMConfigurationError(
            "The OpenAI-compatible provider requires the 'openai' package, "
            "which is not installed. Run `pip install openai`, or point "
            "AI_LLM_PROVIDER_CLASS at a provider whose dependencies are present."
        ) from ex
    return openai


def _encode_messages(request: CompletionRequest) -> list[dict[str, Any]]:
    """Render the request as the flat message list the protocol expects."""
    messages: list[dict[str, Any]] = []
    if request.system:
        messages.append({"role": "system", "content": request.system})
    for message in request.messages:
        messages.extend(_encode_message(message))
    return messages


def _encode_message(message: Message) -> list[dict[str, Any]]:
    """
    Render one turn, which is not always one message.

    Tool output is a message per result in this protocol, rather than blocks
    inside a turn, so a single conversational turn can expand into several.
    """
    if message.role == MessageRole.SYSTEM:
        return [{"role": "system", "content": message.content}]
    if message.role == MessageRole.ASSISTANT:
        return [_encode_assistant(message)]
    # Tool output goes ahead of any user prose: the protocol requires every
    # ``tool`` message to follow the assistant turn that asked for it with
    # nothing in between.
    encoded: list[dict[str, Any]] = [
        {
            "role": "tool",
            "tool_call_id": result.call_id,
            "content": _result_content(result),
        }
        for result in message.tool_results
    ]
    if message.content:
        encoded.append({"role": "user", "content": message.content})
    return encoded


def _encode_assistant(message: Message) -> dict[str, Any]:
    payload: dict[str, Any] = {"role": "assistant", "content": message.content or None}
    if message.tool_calls:
        payload["tool_calls"] = [
            {
                "id": call.id,
                "type": "function",
                "function": {
                    "name": call.name,
                    "arguments": json.dumps(call.arguments),
                },
            }
            for call in message.tool_calls
        ]
    return payload


def _result_content(result: ToolResult) -> str:
    """
    Flatten a tool result into text.

    A ``tool`` message has no field for "this failed", so a failure has to say so
    in its content or the model reads the error as the answer.
    """
    return f"Error: {result.content}" if result.is_error else result.content


@dataclass
class _PendingToolCall:
    """A tool call arriving in fragments, keyed by the index that ties them."""

    id: str = ""
    name: str = ""
    argument_fragments: list[str] = field(default_factory=list)


class _StreamAssembler:
    """
    Turns one stream of completion chunks into provider events.

    Stateful by necessity, and this protocol is the harder of the two: a tool
    call's identifier and name arrive only on its first fragment and its
    arguments in pieces after that, with nothing but ``index`` to tie them
    together. A translator that reads each fragment as a whole call yields a
    stream of nameless calls carrying truncated arguments.

    Deliberately ignorant of the SDK: it reads attributes off whatever it is
    given. That is what lets the translation be tested against recorded chunk
    shapes instead of a live connection.
    """

    def __init__(self, model: str = "") -> None:
        self._model = model
        self._tools: dict[int, _PendingToolCall] = {}
        self._input_tokens = 0
        self._output_tokens = 0
        self._flushed = False
        self._closed = False

    def push(self, chunk: Any) -> list[ProviderStreamEvent]:
        """Translate one completion chunk into zero or more provider events."""
        self._read_usage(getattr(chunk, "usage", None))
        choices = getattr(chunk, "choices", None) or ()
        if not choices:
            # The trailing usage-only chunk, which carries no content. Also what
            # a keep-alive looks like.
            return []
        choice = choices[0]
        events = self._delta(getattr(choice, "delta", None))
        if getattr(choice, "finish_reason", None):
            # The only signal that a tool call is complete: this protocol has no
            # per-call stop event.
            events.extend(self._flush())
        return events

    def finish(self) -> list[ProviderStreamEvent]:
        """
        Close the stream, emitting usage and the terminal event exactly once.

        Tool calls are flushed here too, for a server that ends a stream without
        ever sending a finish reason. Since arguments complete at exactly that
        point, this is a rescue rather than a duplicate: :meth:`_flush` runs once.
        """
        if self._closed:
            return []
        self._closed = True
        events = self._flush()
        events.append(
            ProviderStreamEvent(kind=StreamEventKind.USAGE, usage=self._usage())
        )
        events.append(ProviderStreamEvent(kind=StreamEventKind.STOP))
        return events

    def _delta(self, delta: Any) -> list[ProviderStreamEvent]:
        events: list[ProviderStreamEvent] = []
        if text := getattr(delta, "content", None):
            events.append(ProviderStreamEvent(kind=StreamEventKind.TEXT, text=text))
        # Servers that expose a reasoning trace put it here; absent on the ones
        # that do not, which is why it is read defensively.
        if reasoning := getattr(delta, "reasoning_content", None):
            events.append(
                ProviderStreamEvent(kind=StreamEventKind.THINKING, text=reasoning)
            )
        for fragment in getattr(delta, "tool_calls", None) or ():
            self._absorb(fragment)
        return events

    def _absorb(self, fragment: Any) -> None:
        """Fold one fragment into the call it belongs to, keyed by its index."""
        pending = self._tools.setdefault(
            int(getattr(fragment, "index", 0) or 0),
            _PendingToolCall(),
        )
        # Each field is read through getattr and kept only when it carries
        # something: every one of them is absent on most fragments, and an empty
        # value from a later fragment must not erase what the first one set.
        if identifier := getattr(fragment, "id", None):
            pending.id = identifier
        function = getattr(fragment, "function", None)
        if name := getattr(function, "name", None):
            pending.name = name
        if arguments := getattr(function, "arguments", None):
            pending.argument_fragments.append(arguments)

    def _flush(self) -> list[ProviderStreamEvent]:
        if self._flushed:
            return []
        self._flushed = True
        return [
            ProviderStreamEvent(
                kind=StreamEventKind.TOOL_USE,
                tool_call=_assemble_tool(self._tools[index]),
            )
            for index in sorted(self._tools)
        ]

    def _read_usage(self, raw: Any) -> None:
        self._input_tokens = (
            int(getattr(raw, "prompt_tokens", 0) or 0) or self._input_tokens
        )
        self._output_tokens = (
            int(getattr(raw, "completion_tokens", 0) or 0) or self._output_tokens
        )

    def _usage(self) -> TokenUsage:
        return TokenUsage(
            model=self._model,
            input_tokens=self._input_tokens,
            output_tokens=self._output_tokens,
            requests=1,
        )


def translate_stream(
    chunks: Iterable[Any],
    model: str = "",
) -> Iterator[ProviderStreamEvent]:
    """
    Map a stream of completion chunks onto provider events.

    Pure: no SDK import, no socket, no clock. The same assembler drives
    :meth:`OpenAICompatibleProvider.stream`, so exercising this function against
    recorded chunk shapes exercises the real translation.
    """
    assembler = _StreamAssembler(model)
    for chunk in chunks:
        yield from assembler.push(chunk)
    yield from assembler.finish()


def _assemble_tool(pending: _PendingToolCall) -> ToolCall:
    """
    Parse the JSON a streamed call's arguments arrived in.

    The *first* complete object is taken rather than requiring the whole buffer
    to be exactly one. A gateway that repeats the fragment stream produces a
    buffer holding the same object twice, which a strict parse rejects as "Extra
    data" — failing the run over a duplicate of the very arguments being asked
    for. Trailing bytes are logged, because they mean something upstream is
    misbehaving.

    Arguments that are not a JSON object at all describe a call nobody can
    dispatch, which is a request error rather than a transport one: another
    attempt would produce a differently broken call, not a working one.
    """
    raw = "".join(pending.argument_fragments).strip() or "{}"
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


def _parse_tool_calls(raw: Iterable[Any]) -> list[ToolCall]:
    """
    Decode requested calls, whose arguments arrive as a JSON string.

    Arguments that are not a JSON object describe a call nobody can dispatch.
    That is a request error rather than a transport one: another attempt would
    produce a differently broken call, not a working one.
    """
    calls: list[ToolCall] = []
    for item in raw:
        function = item.function
        try:
            arguments, _ = first_json_object(function.arguments or "{}")
        except (TypeError, ValueError) as ex:
            raise LLMRequestError(
                f"The call to {function.name!r} carried arguments that are not a "
                f"JSON object: {ex}"
            ) from ex
        if not isinstance(arguments, dict):
            raise LLMRequestError(
                f"The call to {function.name!r} carried arguments that are not a "
                f"JSON object: got {type(arguments).__name__}"
            )
        calls.append(ToolCall(id=item.id, name=function.name, arguments=arguments))
    return calls


def _usage(model: str, raw: Any) -> TokenUsage:
    return TokenUsage(
        model=model,
        input_tokens=int(getattr(raw, "prompt_tokens", 0) or 0),
        output_tokens=int(getattr(raw, "completion_tokens", 0) or 0),
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
        return LLMTransportError(f"Transport failure reaching the endpoint: {ex}")
    status = _status_code(ex)
    if status is None:
        # Neither a transport failure nor an HTTP response: a client-side error
        # or a bug, and another attempt cannot change either.
        return LLMRequestError(f"The completion call failed: {ex}")
    if status in _RETRYABLE_STATUSES or status >= 500:
        return LLMTransportError(f"The endpoint returned HTTP {status}: {ex}")
    return LLMRequestError(f"The endpoint rejected the request, HTTP {status}: {ex}")


def _status_code(ex: Exception) -> int | None:
    """The HTTP status behind an exception, from wherever the SDK put it."""
    status = getattr(ex, "status_code", None)
    if status is None:
        status = getattr(getattr(ex, "response", None), "status_code", None)
    return status if isinstance(status, int) else None
