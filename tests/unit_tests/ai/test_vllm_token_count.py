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
"""Exact vLLM request accounting without credentials or network access."""

from __future__ import annotations

from collections.abc import Callable
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from superset.ai.llm import vllm
from superset.ai.llm.base import (
    CompletionRequest,
    LLMConfigurationError,
    LLMRequestError,
    LLMTransportError,
    Message,
    RequestTokenCount,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.llm.openai_compatible import OpenAICompatibleProvider
from superset.ai.llm.vllm import VLLMProvider
from superset.ai.types import MessageRole
from superset.utils import json


def _provider(**config: Any) -> VLLMProvider:
    return VLLMProvider(
        models={"default": "small", "reasoning": "large"},
        tokenize_url="https://tokenizer.example/tokenize",
        **config,
    )


def _request() -> CompletionRequest:
    return CompletionRequest(
        model="large",
        system="Use authorized sources.",
        messages=[
            Message(role=MessageRole.USER, content="Какие заявки?"),
            Message(
                role=MessageRole.ASSISTANT,
                content="Reading the dataset.",
                tool_calls=[ToolCall(id="one", name="inspect", arguments={"id": 4})],
            ),
            Message(
                role=MessageRole.USER,
                tool_results=[ToolResult(call_id="one", content='{"name":"Қазақ"}')],
            ),
        ],
        tools=[
            ToolDefinition(
                name="inspect",
                description="Read dataset metadata",
                input_schema={
                    "type": "object",
                    "properties": {"id": {"type": "integer"}},
                },
            )
        ],
    )


def _transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> list[httpx.AsyncClient]:
    """Exercise the real HTTP serialization and headers through a mock transport."""
    clients: list[httpx.AsyncClient] = []

    def make_client(**options: Any) -> httpx.AsyncClient:
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), **options)
        clients.append(client)
        return client

    monkeypatch.setattr(
        vllm,
        "_httpx",
        lambda: SimpleNamespace(
            AsyncClient=make_client,
            Headers=httpx.Headers,
            HTTPStatusError=httpx.HTTPStatusError,
            RequestError=httpx.RequestError,
        ),
    )
    return clients


async def test_counter_receives_the_entire_completion_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[dict[str, Any]] = []

    def receive(request: httpx.Request) -> httpx.Response:
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={"count": 612, "max_model_len": 16384})

    _transport(monkeypatch, receive)
    provider = _provider(chat_template_kwargs={"enable_thinking": False})
    request = _request()
    request.max_output_tokens = 200
    request.temperature = 0.2
    payload = provider._payload(request)
    try:
        count = await provider.count_tokens(request)
    finally:
        await provider.aclose()
    assert count == RequestTokenCount(input_tokens=612, context_window=16384)
    assert captured == [
        {
            "model": "large",
            "messages": payload["messages"],
            "tools": payload["tools"],
            **payload["extra_body"],
        }
    ]
    assert [message["role"] for message in captured[0]["messages"]] == [
        "system",
        "user",
        "assistant",
        "tool",
    ]
    assert captured[0]["messages"][-1]["tool_call_id"] == "one"
    assert "Қазақ" in captured[0]["messages"][-1]["content"]
    assert captured[0]["chat_template_kwargs"] == {"enable_thinking": False}
    assert captured[0]["add_generation_prompt"] is True
    assert captured[0]["continue_final_message"] is False
    assert captured[0]["add_special_tokens"] is False


@pytest.mark.parametrize("counter_key", [None, "counter-secret"])
async def test_counter_does_not_inherit_gateway_credentials(
    monkeypatch: pytest.MonkeyPatch, counter_key: str | None
) -> None:
    headers: list[httpx.Headers] = []

    def receive(request: httpx.Request) -> httpx.Response:
        headers.append(request.headers)
        return httpx.Response(200, json={"count": 1, "max_model_len": 10})

    _transport(monkeypatch, receive)
    provider = _provider(
        api_key="gateway-secret",
        default_headers={"X-Gateway-Key": "another-secret"},
        tokenize_api_key=counter_key,
        tokenize_headers={"X-Token-Counter": "enabled"},
    )
    try:
        await provider.count_tokens(_request())
    finally:
        await provider.aclose()
    assert headers[0].get("Authorization") == (
        f"Bearer {counter_key}" if counter_key else None
    )
    assert "X-Gateway-Key" not in headers[0]
    assert headers[0]["X-Token-Counter"] == "enabled"


@pytest.mark.parametrize(
    "status", [301, 307, 400, 401, 403, 404, 422, 408, 429, 500, 503]
)
async def test_counter_errors_are_classified_without_echoing_response_content(
    monkeypatch: pytest.MonkeyPatch, status: int
) -> None:
    calls: list[httpx.Request] = []

    def receive(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            status,
            headers={"Location": "https://unrelated.example/"},
            text="secret-prompt-and-gateway-key",
        )

    _transport(monkeypatch, receive)
    provider = _provider()
    expected = (
        LLMTransportError if status in (408, 429) or status >= 500 else LLMRequestError
    )
    try:
        with pytest.raises(expected) as error:
            await provider.count_tokens(_request())
        assert str(error.value) == f"The token counter returned HTTP {status}."
        assert len(calls) == 1  # Redirects never forward the prompt or credentials.
    finally:
        await provider.aclose()


async def test_transport_error_is_retryable_without_exposing_its_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def receive(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("private-url-and-key", request=request)

    _transport(monkeypatch, receive)
    provider = _provider()
    try:
        with pytest.raises(
            LLMTransportError, match="^The token counter could not be reached.$"
        ):
            await provider.count_tokens(_request())
    finally:
        await provider.aclose()


@pytest.mark.parametrize(
    "body",
    [
        {},
        [],
        None,
        {"count": 1},
        {"count": True, "max_model_len": 10},
        {"count": "1", "max_model_len": 10},
        {"count": -1, "max_model_len": 10},
        {"count": 1.5, "max_model_len": 10},
        {"count": 1, "max_model_len": False},
        {"count": 1, "max_model_len": 0},
    ],
)
async def test_invalid_counter_response_is_permanent(
    monkeypatch: pytest.MonkeyPatch, body: Any
) -> None:
    _transport(
        monkeypatch, lambda request: httpx.Response(200, content=json.dumps(body))
    )
    provider = _provider()
    try:
        with pytest.raises(LLMRequestError, match="invalid count or context window"):
            await provider.count_tokens(_request())
    finally:
        await provider.aclose()


async def test_oversized_prompt_is_counted_so_the_caller_can_compact(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _transport(
        monkeypatch,
        lambda request: httpx.Response(200, json={"count": 25, "max_model_len": 20}),
    )
    provider = _provider()
    try:
        assert await provider.count_tokens(_request()) == RequestTokenCount(25, 20)
    finally:
        await provider.aclose()


@pytest.mark.parametrize(
    "url",
    [
        None,
        "",
        "/tokenize",
        "file:///tmp/tokenize",
        "https://user:key@example/tokenize",
    ],
)
async def test_endpoint_must_be_explicit_and_cannot_embed_credentials(url: Any) -> None:
    provider = VLLMProvider(models={"default": "large"}, tokenize_url=url)
    with pytest.raises(LLMConfigurationError, match="tokenize_url"):
        await provider.count_tokens(_request())
    assert provider._tokenize_client is None


async def test_unknown_model_is_rejected_before_opening_the_counter() -> None:
    provider = _provider()
    request = _request()
    request.model = "unconfigured"
    with pytest.raises(LLMRequestError, match="unconfigured"):
        await provider.count_tokens(request)
    assert provider._tokenize_client is None


async def test_counter_pool_is_closed_and_recreated_for_the_next_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients = _transport(
        monkeypatch,
        lambda request: httpx.Response(200, json={"count": 1, "max_model_len": 10}),
    )
    provider = _provider()
    completion_close = AsyncMock()
    provider._async_client = SimpleNamespace(close=completion_close)
    await provider.count_tokens(_request())
    await provider.count_tokens(_request())
    assert len(clients) == 1
    await provider.aclose()
    await provider.aclose()
    completion_close.assert_awaited_once()
    assert clients[0].is_closed
    assert provider._tokenize_client is None
    await provider.count_tokens(_request())
    assert len(clients) == 2
    await provider.aclose()
    assert clients[1].is_closed


async def test_a_provider_without_a_counter_does_not_guess() -> None:
    provider = OpenAICompatibleProvider(models={"default": "large"})
    assert provider.supports_token_counting is False
    with pytest.raises(LLMConfigurationError, match="exact token counting"):
        await provider.count_tokens(_request())
