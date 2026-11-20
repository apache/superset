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
"""Context checkpoints retain evidence without rewriting the visible transcript."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence
from dataclasses import asdict
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from flask import current_app
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.ai.history import encode_checkpoint, restore_context
from superset.ai.llm.base import (
    CompletionRequest,
    LLMResponse,
    Message,
    ProviderStreamEvent,
    RequestTokenCount,
    ToolCall,
    ToolResult,
)
from superset.ai.llm.echo import EchoProvider, ScriptedTurn
from superset.ai.runtime.context import ContextPolicy, ConversationContext
from superset.ai.types import MessageRole
from superset.utils import json


def _row(role: str, content: str, **extra: Any) -> SimpleNamespace:
    return SimpleNamespace(
        uuid=uuid4(),
        role=role,
        content=content,
        status="complete",
        extra=extra,
        context_json=None,
    )


def test_checkpoint_restores_full_tool_evidence_and_appends_only_new_rows() -> None:
    rows = [_row("user", "First question"), _row("assistant", "First answer")]
    context = ConversationContext(
        [
            Message(MessageRole.USER, "First question"),
            Message(MessageRole.ASSISTANT, tool_calls=[ToolCall("call", "query", {})]),
            Message(
                MessageRole.USER, tool_results=[ToolResult("call", "evidence" * 2000)]
            ),
            Message(MessageRole.ASSISTANT, "First answer"),
        ],
        "Earlier verified facts",
        2,
    )
    rows[-1].context_json = encode_checkpoint(context, rows)
    rows.append(_row("user", "Second question"))
    restored = restore_context(rows)
    assert restored.summary == context.summary
    assert restored.compactions == 2
    assert restored.messages[:-1] == context.messages
    assert restored.messages[-1].content == "Second question"
    assert restored.messages[2].tool_results[0].content == "evidence" * 2000


def test_late_queued_answer_invalidates_a_checkpoint_that_did_not_see_it() -> None:
    rows = [
        _row("user", "First question"),
        _row("assistant", ""),
        _row("user", "Second question"),
        _row("assistant", "Second answer"),
    ]
    rows[1].status = "pending"
    rows[-1].context_json = encode_checkpoint(
        ConversationContext(
            [Message(MessageRole.ASSISTANT, "Second answer")], "old summary"
        ),
        rows,
    )
    rows[1].status = "complete"
    rows[1].content = "Late first answer with important facts"
    restored = restore_context(rows)
    assert restored.summary == ""
    assert [m.content for m in restored.messages] == [r.content for r in rows]


def test_a_checkpoint_cannot_be_reused_for_another_transcript() -> None:
    first = [_row("assistant", "Same text")]
    second = [_row("assistant", "Same text")]
    first[0].context_json = encode_checkpoint(
        ConversationContext([Message(MessageRole.ASSISTANT, "Private evidence")]), first
    )
    second[0].context_json = first[0].context_json
    assert [m.content for m in restore_context(second).messages] == ["Same text"]


@pytest.mark.parametrize("malformed", ["not json", "[]", "null", '{"version":99}'])
def test_bad_checkpoint_falls_back_to_original_rows(malformed: str) -> None:
    rows = [_row("user", "Question"), _row("assistant", "Answer")]
    rows[-1].context_json = malformed
    assert [m.content for m in restore_context(rows).messages] == ["Question", "Answer"]


def test_unmatched_tool_result_in_a_checkpoint_is_not_replayed() -> None:
    rows = [_row("assistant", "Original answer")]
    valid = ConversationContext([Message(MessageRole.ASSISTANT, "Original answer")])
    payload = json.loads(encode_checkpoint(valid, rows))
    payload["context"]["messages"] = [
        asdict(
            Message(MessageRole.USER, tool_results=[ToolResult("missing", "invalid")])
        )
    ]
    rows[0].context_json = json.dumps(payload)
    assert [m.content for m in restore_context(rows).messages] == ["Original answer"]


def test_legacy_history_replays_excerpts_without_discarding_old_questions() -> None:
    rows = [_row("user", f"Question {index}") for index in range(40)]
    rows.append(
        _row(
            "assistant",
            "Answer",
            tool_calls=[
                {
                    "name": "query",
                    "arguments": {"sql": "SELECT 1"},
                    "ok": True,
                    "output": '{"rows":[1]}',
                }
            ],
        )
    )
    restored = restore_context(rows)
    assert restored.messages[0].content == "Question 0"
    assert restored.messages[-1].content == "Answer"
    assert "Recorded output excerpt" in restored.messages[-2].tool_results[0].content
    assert (
        restored.messages[-3].tool_calls[0].id
        == restored.messages[-2].tool_results[0].call_id
    )


class CountingEchoProvider(EchoProvider):
    """A deterministic byte-token endpoint with a scripted summary response."""

    supports_token_counting = True

    def __init__(self, script: Sequence[ScriptedTurn] | None = None) -> None:
        super().__init__(script)
        self.counted: list[CompletionRequest] = []
        self.summary_requests: list[CompletionRequest] = []

    async def count_tokens(self, request: CompletionRequest) -> RequestTokenCount:
        self.counted.append(request)
        payload = {
            "system": request.system,
            "messages": [asdict(m) for m in request.messages],
            "tools": [asdict(t) for t in request.tools],
        }
        return RequestTokenCount(len(json.dumps(payload).encode("utf-8")), 32000)

    async def complete(self, request: CompletionRequest) -> LLMResponse:
        self.summary_requests.append(request)
        return LLMResponse(text="Previously verified: dataset 7, total 42.")


@pytest.fixture
def checkpoint_conversation(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
) -> tuple[str, CountingEchoProvider]:
    """Real HTTP and SQLite state with controlled identity and no inference network."""
    from superset.ai.eventbus import MemoryEventBus
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)
    provider = CountingEchoProvider()
    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    mocker.patch("superset.ai.factories.get_provider", return_value=provider)
    mocker.patch("superset.ai.factories.get_tools_for_profile", return_value=None)
    mocker.patch(
        "superset.ai.orchestrator._build_system_prompt", return_value="Test system"
    )
    mocker.patch("superset.ai.eventbus.get_event_bus", return_value=MemoryEventBus())
    mocker.patch.dict(
        current_app.config,
        {
            "AI_CONTEXT_COMPACTION_ENABLED": True,
            "AI_ASSISTANT_MAX_HISTORY_MESSAGES": 1,
            "AI_ASSISTANT_MAX_HISTORY_CHARS": 1,
        },
    )
    response = client.post("/api/v1/ai/thread/", json={})
    assert response.status_code == 201
    return f"/api/v1/ai/thread/{response.json['result']['uuid']}", provider


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}], indirect=True
)
@pytest.mark.usefixtures("full_api_access")
def test_compacted_conversation_survives_reload_and_keeps_original_rows(
    checkpoint_conversation: tuple[str, CountingEchoProvider],
    client: FlaskClient,
    session: Session,
) -> None:
    from superset.models.ai import AIChatMessage, AIChatThread

    url, provider = checkpoint_conversation
    thread = session.query(AIChatThread).one()
    original = []
    for index in range(8):
        content = (
            "Fact: dataset 7, total 42. " if index == 0 else "Earlier discussion. "
        ) + "x" * 4000
        row = AIChatMessage(
            thread_id=thread.id,
            role="user" if index % 2 == 0 else "assistant",
            content=content,
        )
        session.add(row)
        original.append(content)
    session.commit()
    for index, question in enumerate(["Continue the analysis", "What was the total?"]):
        accepted = client.post(
            f"{url}/message", json={"content": question, "request_id": f"turn-{index}"}
        )
        assert accepted.status_code == 202
        client.get(
            f"{url}/stream?run_id={accepted.json['result']['run_id']}"
        ).get_data()
        session.expire_all()
    rows = session.query(AIChatMessage).order_by(AIChatMessage.id).all()
    assert [row.content for row in rows[:8]] == original
    assert rows[9].context_json is not None
    assert rows[11].context_json is not None
    assert "Previously verified" in provider.requests[-1].messages[0].content
    assert provider.requests[-1].messages[-1].content == "What was the total?"
    first_summary = json.loads(provider.summary_requests[0].messages[0].content)
    assert (
        "Fact: dataset 7, total 42." in first_summary["earlier_messages"][0]["content"]
    )
    detail = client.get(f"{url}")
    assert detail.status_code == 200
    assert all(
        "context_json" not in message for message in detail.json["result"]["messages"]
    )


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}], indirect=True
)
@pytest.mark.usefixtures("full_api_access")
def test_reversed_deliveries_do_not_make_a_future_checkpoint_visible(
    checkpoint_conversation: tuple[str, CountingEchoProvider],
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
) -> None:
    from superset.ai.orchestrator import execute_turn
    from superset.models.ai import AIChatMessage

    url, provider = checkpoint_conversation
    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    for key in ("first", "second"):
        response = client.post(
            f"{url}/message", json={"content": f"{key} question", "request_id": key}
        )
        assert response.status_code == 202
    deliveries = [call.args[0] for call in submitted.call_args_list]
    for delivery in reversed(deliveries):
        execute_turn(delivery)
    assert [m.content for m in provider.requests[-1].messages] == ["first question"]
    session.expire_all()
    rows = session.query(AIChatMessage).order_by(AIChatMessage.id).all()
    assert rows[1].context_json
    assert rows[3].context_json
    response = client.post(
        f"{url}/message", json={"content": "third question", "request_id": "third"}
    )
    assert response.status_code == 202
    execute_turn(submitted.call_args.args[0])
    contents = [m.content for m in provider.requests[-1].messages]
    assert "echo: first question" in contents
    assert "echo: second question" in contents
    assert contents[-1] == "third question"


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}], indirect=True
)
@pytest.mark.usefixtures("full_api_access")
def test_earlier_answer_finishing_during_inference_invalidates_the_new_checkpoint(
    checkpoint_conversation: tuple[str, CountingEchoProvider],
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
) -> None:
    from superset.ai.orchestrator import execute_turn
    from superset.models.ai import AIChatMessage

    url, provider = checkpoint_conversation
    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    for key in ("first", "second"):
        accepted = client.post(
            f"{url}/message", json={"content": f"{key} question", "request_id": key}
        )
        assert accepted.status_code == 202
    original_stream = provider.stream

    async def finish_earlier_answer(
        request: CompletionRequest,
    ) -> AsyncIterator[ProviderStreamEvent]:
        # The later turn has already read its history. Another worker finishes
        # the earlier answer before this turn persists its continuation state.
        earlier = session.query(AIChatMessage).order_by(AIChatMessage.id).all()[1]
        earlier.content = "Late first answer: verified total 42."
        earlier.status = "complete"
        session.commit()
        async for event in original_stream(request):
            yield event

    mocker.patch.object(provider, "stream", side_effect=finish_earlier_answer)
    execute_turn(submitted.call_args.args[0])
    session.expire_all()
    rows = session.query(AIChatMessage).order_by(AIChatMessage.id).all()
    assert rows[3].content == "echo: second question"
    assert rows[3].context_json is None
    accepted = client.post(
        f"{url}/message", json={"content": "What was the total?", "request_id": "third"}
    )
    assert accepted.status_code == 202
    execute_turn(submitted.call_args.args[0])
    assert "Late first answer: verified total 42." in [
        message.content for message in provider.requests[-1].messages
    ]


async def test_native_tool_evidence_uses_context_budget_and_keeps_a_bounded_audit(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    from superset.ai.runtime.base import RunRequest
    from superset.ai.runtime.messages import MessagesApiRuntime
    from superset.ai.tools.base import AITool, ToolOutput, ToolRegistry

    payload = {"dataset": {"id": 7, "expression": "exact field " * 1000}}

    class MetadataTool(AITool):
        name = "metadata"

        def run(self, **kwargs: Any) -> ToolOutput:
            return ToolOutput(
                content="", payload=payload, display={"text": "display " * 1000}
            )

    mocker.patch(
        "superset.ai.tools.base._current_user", return_value=SimpleNamespace(id=1)
    )
    mocker.patch.dict(current_app.config, {"AI_AGENT_MAX_RESULT_BYTES": 256})
    provider = CountingEchoProvider(
        [
            ScriptedTurn(tool_calls=(ToolCall("c1", "metadata", {}),)),
            ScriptedTurn(text="The dataset expression is available."),
        ]
    )
    runtime = MessagesApiRuntime(provider)
    request = RunRequest(
        messages=[Message(MessageRole.USER, "Inspect the dataset")],
        system_prompt="Test system",
        tools=ToolRegistry([MetadataTool()]),
        context_policy=ContextPolicy(),
    )
    _events = [event async for event in runtime.run(request)]
    assert runtime.result.ok
    result = provider.requests[1].messages[-1].tool_results[0]
    assert json.loads(result.content) == payload
    audit = runtime.result.tool_calls[0]
    assert audit["output_truncated"] is True
    assert not audit.get("truncated", False)
    assert len(str(audit["output"]).encode("utf-8")) <= 2000
    assert runtime.result.context is not None
    assert runtime.result.context.messages[-2].tool_results[0].content == result.content
    assert (
        runtime.result.context.messages[-1].content
        == "The dataset expression is available."
    )
    for counted, completion in zip(
        list(provider.counted), provider.requests, strict=True
    ):
        count = await provider.count_tokens(counted)
        assert completion.max_output_tokens is not None
        assert count.input_tokens + completion.max_output_tokens == count.context_window


@pytest.mark.parametrize("stage", ["counter", "summary"])
async def test_context_operations_share_the_run_deadline(
    stage: str,
    mocker: MockerFixture,
) -> None:
    from superset.ai.runtime.base import RunRequest
    from superset.ai.runtime.messages import MessagesApiRuntime

    provider = CountingEchoProvider()
    closed = mocker.patch.object(provider, "aclose", new_callable=mocker.AsyncMock)

    async def stalled(_request: CompletionRequest) -> Any:
        await asyncio.Event().wait()

    mocker.patch.object(
        provider,
        "count_tokens" if stage == "counter" else "complete",
        side_effect=stalled,
    )
    context = ConversationContext(
        [
            Message(MessageRole.ASSISTANT, "x" * 26000),
            Message(MessageRole.USER, "Continue"),
        ]
    )
    before = asdict(context)
    runtime = MessagesApiRuntime(provider)
    request = RunRequest(
        messages=context.messages,
        system_prompt="Test",
        context=context,
        context_policy=ContextPolicy(),
        timeout_seconds=0.02,
    )
    _events = [event async for event in runtime.run(request)]
    assert runtime.result.timed_out
    assert runtime.result.error is None
    assert runtime.result.context is None
    assert asdict(context) == before
    assert provider.requests == []
    closed.assert_awaited_once()


async def test_stop_while_counting_prevents_the_completion(
    mocker: MockerFixture,
) -> None:
    from superset.ai.runtime.base import RunRequest
    from superset.ai.runtime.messages import MessagesApiRuntime
    from superset.ai.types import StreamEventType

    provider = CountingEchoProvider()
    cancelled = False

    async def counted(_request: CompletionRequest) -> RequestTokenCount:
        nonlocal cancelled
        cancelled = True
        return RequestTokenCount(100, 32000)

    mocker.patch.object(provider, "count_tokens", side_effect=counted)
    runtime = MessagesApiRuntime(provider)
    events = [
        event
        async for event in runtime.run(
            RunRequest(
                messages=[Message(MessageRole.USER, "Question")],
                system_prompt="Test",
                context_policy=ContextPolicy(),
                should_cancel=lambda: cancelled,
            )
        )
    ]
    assert runtime.result.cancelled
    assert runtime.result.error is None
    assert provider.requests == []
    assert StreamEventType.ERROR not in [event.type for event in events]


async def test_summary_usage_is_reported_as_a_separate_model_call(
    mocker: MockerFixture,
) -> None:
    from superset.ai.runtime.base import RunRequest
    from superset.ai.runtime.messages import MessagesApiRuntime

    provider = CountingEchoProvider()
    mocker.patch.object(
        provider,
        "complete",
        return_value=LLMResponse(
            text="Verified total: 42.",
            usage={"input_tokens": 27000, "output_tokens": 16, "model": "echo-default"},
        ),
    )
    recorder = mocker.Mock(enabled=True)
    mocker.patch("superset.ai.runtime.messages.current_run", return_value=recorder)
    runtime = MessagesApiRuntime(provider)
    _events = [
        event
        async for event in runtime.run(
            RunRequest(
                messages=[
                    Message(MessageRole.ASSISTANT, "x" * 26000),
                    Message(MessageRole.USER, "Continue"),
                ],
                system_prompt="Test",
                context_policy=ContextPolicy(),
            )
        )
    ]
    assert runtime.result.ok
    calls = recorder.model_call.call_args_list
    assert len(calls) == 2
    assert calls[0].kwargs["input_tokens"] == 27000
    assert calls[0].kwargs["output_tokens"] == 16
    assert calls[0].kwargs["response_text"] == "Verified total: 42."
    assert calls[1].kwargs["response_text"] == "echo: Continue"
