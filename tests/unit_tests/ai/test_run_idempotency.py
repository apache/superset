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
"""Run acceptance, delivery retries and stream reconnects must not repeat work."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from typing import Any
from uuid import UUID

import pytest
from flask import current_app
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.ai.llm.echo import EchoProvider

pytestmark = [
    pytest.mark.parametrize(
        "app",
        [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}],
        indirect=True,
    ),
    pytest.mark.usefixtures("full_api_access"),
]


@pytest.fixture
def provider(mocker: MockerFixture) -> EchoProvider:
    """A typed deterministic provider, shared by all deliveries in one test."""
    provider = EchoProvider()
    mocker.patch("superset.ai.factories.get_provider", return_value=provider)
    return provider


@pytest.fixture
def conversation(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    provider: EchoProvider,
) -> str:
    """Real HTTP and metadata, controlled identity and a network-free provider."""
    from superset.ai.eventbus import MemoryEventBus
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)
    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    mocker.patch("superset.ai.factories.get_tools_for_profile", return_value=None)
    mocker.patch("superset.ai.eventbus.get_event_bus", return_value=MemoryEventBus())
    response = client.post("/api/v1/ai/thread/", json={})
    assert response.status_code == 201
    return f"/api/v1/ai/thread/{response.json['result']['uuid']}"


def _post(client: FlaskClient, conversation: str, **updates: Any) -> Any:
    """Submit the same idempotency key unless a test overrides it."""
    return client.post(
        f"{conversation}/message",
        json={"content": "one question", "request_id": "one-request", **updates},
    )


@pytest.mark.parametrize("mode", ["inline", "worker"])
def test_post_replay_keeps_run_and_accepted_context(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    mode: str,
) -> None:
    """Changed replay parameters must not overwrite the accepted run."""
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": mode})
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    context = {"dashboard_id": 42}
    first = _post(
        client,
        conversation,
        model="first-model",
        agent_key="first-agent",
        page_context=context,
    )
    replay = _post(
        client,
        conversation,
        model="different-model",
        agent_key="different-agent",
        page_context={"dashboard_id": 43},
    )
    assert first.status_code == replay.status_code == 202
    assert first.json["result"] == replay.json["result"]
    assert session.query(AIChatMessage).count() == 2
    assistant = session.query(AIChatMessage).filter_by(role="assistant").one()
    assert assistant.extra["model"] == "first-model"
    assert assistant.extra["agent_key"] == "first-agent"
    assert assistant.extra["page_context"] == context
    for call in submitted.call_args_list:
        assert call.args[0].run_id == first.json["result"]["run_id"]
        assert call.args[0].model == "first-model"
        assert call.args[0].profile_key == "first-agent"
        assert call.args[0].page_context == context


def test_assistant_commit_already_has_its_run_context(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
) -> None:
    """A crash after inserting the placeholder cannot lose its run identifier."""
    from superset.models.ai import AIChatMessage

    original_commit = session.commit
    committed: list[dict[str, Any]] = []

    def record_commit() -> None:
        """Observe every committed assistant version, not just the final response."""
        for message in session.query(AIChatMessage).filter_by(role="assistant"):
            committed.append(dict(message.extra))
        original_commit()

    mocker.patch.object(session, "commit", side_effect=record_commit)
    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    result = _post(client, conversation, model="accepted-model")
    assert result.status_code == 202
    assert committed
    assert all(
        extra.get("run_id") == result.json["result"]["run_id"] for extra in committed
    )
    assert all(extra.get("model") == "accepted-model" for extra in committed)


@pytest.mark.parametrize(
    "ambiguous", [False, True], ids=["rejected", "accepted-then-error"]
)
def test_replay_recovers_submission_without_repeating_inference(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
    ambiguous: bool,
) -> None:
    """A delivery that may have succeeded is safe to submit again, with the same run."""
    from superset.ai.orchestrator import execute_turn, TurnRequest
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    deliveries: list[TurnRequest] = []
    attempts = 0

    def submit(turn: TurnRequest) -> None:
        """Simulate the two broker failure outcomes without a real broker."""
        nonlocal attempts
        attempts += 1
        if attempts > 1 or ambiguous:
            deliveries.append(turn)
        if attempts == 1:
            raise RuntimeError("broker acknowledgement lost")

    mocker.patch("superset.ai.tasks.submit_turn", side_effect=submit)
    assert _post(client, conversation).status_code == 500
    session.expire_all()
    recorded_run_id = (
        session.query(AIChatMessage).filter_by(role="assistant").one().extra["run_id"]
    )
    replay = _post(client, conversation)
    assert replay.status_code == 202
    assert replay.json["result"]["run_id"] == recorded_run_id
    assert attempts == 2
    assert all(turn.run_id == replay.json["result"]["run_id"] for turn in deliveries)
    for turn in deliveries:
        execute_turn(turn)
    assert len(provider.requests) == 1
    session.expire_all()
    assistant = session.query(AIChatMessage).filter_by(role="assistant").one()
    assert assistant.status == "complete"
    assert assistant.content == "echo: one question"
    assert assistant.extra["run_id"] == replay.json["result"]["run_id"]


@pytest.mark.parametrize("mode", ["inline", "worker"])
def test_completed_stream_replays_without_new_inference(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
    mode: str,
) -> None:
    """The same accepted run can be read again without rewriting its answer."""
    from superset.ai.orchestrator import execute_turn
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": mode})
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    run = _post(client, conversation).json["result"]
    if mode == "worker":
        execute_turn(submitted.call_args.args[0])
        assert _post(client, conversation).json["result"] == run
        submitted.assert_called_once()
        # Terminal replay must not require unexpired Redis events.
        mocker.patch(
            "superset.ai.api._tail_event_bus",
            side_effect=AssertionError("expired event stream"),
        )
    url = f"{conversation}/stream?run_id={run['run_id']}"
    first = client.get(url).get_data(as_text=True)
    replay = client.get(url).get_data(as_text=True)
    assert "echo: one question" in first
    assert "echo: one question" in replay
    assert 'event: done\ndata: {"ok": true}' in replay
    assert len(provider.requests) == 1
    session.expire_all()
    assert (
        session.query(AIChatMessage).filter_by(role="assistant").one().status
        == "complete"
    )


def test_duplicate_consumer_leaves_owner_and_cancellation_untouched(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
) -> None:
    """Only the consumer that claims pending may run or clean up the turn."""
    from superset.ai.orchestrator import stream_turn, TurnRequest
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    run = _post(client, conversation).json["result"]
    turn = TurnRequest(
        thread_uuid=conversation.rsplit("/", 1)[1],
        user_id=1,
        run_id=run["run_id"],
        assistant_message_uuid=run["assistant_message_uuid"],
    )
    owner = stream_turn(turn)
    next(owner)
    clear_cancel = mocker.patch("superset.ai.orchestrator.clear_cancel")
    try:
        assert list(stream_turn(turn)) == []
        clear_cancel.assert_not_called()
        session.expire_all()
        message = (
            session.query(AIChatMessage)
            .filter_by(uuid=UUID(run["assistant_message_uuid"]))
            .one()
        )
        assert message.status == "streaming"
        assert provider.requests == []
    finally:
        owner.close()


@pytest.mark.parametrize(
    "status,outcome,event,ok",
    [
        ("complete", "success", "final", True),
        ("complete", "timeout", "final", False),
        ("error", "error", "error", False),
        ("cancelled", "cancelled", "cancelled", False),
    ],
)
def test_replay_preserves_terminal_outcome(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
    status: str,
    outcome: str,
    event: str,
    ok: bool,
) -> None:
    """Reading any terminal state cannot restart or report it as a new success."""
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    accepted = _post(client, conversation).json["result"]
    message = session.query(AIChatMessage).filter_by(role="assistant").one()
    message.status = status
    message.content = "stored answer"
    message.update_extra({"outcome": outcome})
    session.commit()
    replay = _post(client, conversation)
    assert replay.json["result"] == accepted
    body = client.get(f"{conversation}/stream?run_id={accepted['run_id']}").get_data(
        as_text=True
    )
    assert "stored answer" in body
    assert f"event: {event}\n" in body
    assert f'event: done\ndata: {{"ok": {str(ok).lower()}}}' in body
    assert provider.requests == []
    session.expire_all()
    assert message.status == status
    assert message.content == "stored answer"


def test_inline_reconnect_waits_for_the_claimed_producer(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
) -> None:
    """A second reader receives the first producer's result, not an empty stream."""
    from superset.ai.api import _run_inline_stream
    from superset.ai.orchestrator import stream_turn, TurnRequest

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    accepted = _post(client, conversation).json["result"]
    turn = TurnRequest(
        thread_uuid=conversation.rsplit("/", 1)[1],
        user_id=1,
        run_id=accepted["run_id"],
        assistant_message_uuid=accepted["assistant_message_uuid"],
    )
    owner = stream_turn(turn)
    next(owner)
    sleep = mocker.patch(
        "superset.ai.api.time.sleep", side_effect=lambda _: list(owner)
    )
    try:
        body = "".join(_run_inline_stream(turn))
    finally:
        owner.close()
    sleep.assert_called_once_with(1)
    assert "echo: one question" in body
    assert 'event: done\ndata: {"ok": true}' in body
    assert len(provider.requests) == 1


@pytest.mark.parametrize("ending", ["timeout", "deleted", "owner-changed"])
def test_reconnect_stops_waiting_without_restarting_or_finalizing(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
    provider: EchoProvider,
    ending: str,
) -> None:
    """An abandoned or inaccessible run cannot keep a reader waiting forever."""
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    accepted = _post(client, conversation).json["result"]
    message = session.query(AIChatMessage).filter_by(role="assistant").one()
    message.status = "streaming"
    session.commit()
    finalise = mocker.patch("superset.ai.orchestrator._finalise_message")
    clear_cancel = mocker.patch("superset.ai.orchestrator.clear_cancel")
    sleep = mocker.patch("superset.ai.api.time.sleep")
    if ending == "timeout":
        mocker.patch("superset.ai.api._STREAM_TIMEOUT_SECONDS", 0)
        expected = "The run is still in progress."
    else:

        def make_unavailable(_: float) -> None:
            """Change the persisted conversation after the stream has opened."""
            if ending == "deleted":
                session.delete(message.thread)
            else:
                message.thread.created_by_fk = 2
            session.commit()

        sleep.side_effect = make_unavailable
        expected = "That conversation is no longer available."

    body = client.get(f"{conversation}/stream?run_id={accepted['run_id']}").get_data(
        as_text=True
    )
    assert expected in body
    assert 'event: done\ndata: {"ok": false}' in body
    assert provider.requests == []
    finalise.assert_not_called()
    clear_cancel.assert_not_called()
    if ending == "timeout":
        sleep.assert_not_called()
    else:
        sleep.assert_called_once_with(1)


def test_replay_without_recorded_run_does_not_restart_legacy_message(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
) -> None:
    """Old placeholders without an accepted run must not silently regenerate."""
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    assert _post(client, conversation).status_code == 202
    assistant = session.query(AIChatMessage).filter_by(role="assistant").one()
    assistant.extra_json = None
    session.commit()
    replay = _post(client, conversation)
    assert replay.status_code == 422
    assert "Use a new request_id" in replay.json["message"]
    submitted.assert_called_once()
    assert session.query(AIChatMessage).count() == 2


def test_claim_database_error_does_not_finalize_someone_elses_run(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    conversation: str,
) -> None:
    """An uncertain claim must not clear cancellation or rewrite a shared row."""
    from superset.models.ai import AIChatMessage

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "inline"})
    accepted = _post(client, conversation).json["result"]
    mocker.patch(
        "superset.ai.orchestrator._claim_pending",
        side_effect=RuntimeError("db unavailable"),
    )
    finalise = mocker.patch("superset.ai.orchestrator._finalise_message")
    clear_cancel = mocker.patch("superset.ai.orchestrator.clear_cancel")
    body = client.get(f"{conversation}/stream?run_id={accepted['run_id']}").get_data(
        as_text=True
    )
    assert "event: error\n" in body
    assert 'event: done\ndata: {"ok": false}' in body
    assert "db unavailable" not in body
    finalise.assert_not_called()
    clear_cancel.assert_not_called()
    session.expire_all()
    assert (
        session.query(AIChatMessage).filter_by(role="assistant").one().status
        == "pending"
    )


def test_two_database_sessions_can_only_claim_once(
    app: Any,
    tmp_path: Path,
    mocker: MockerFixture,
) -> None:
    """Competing database connections exercise the conditional UPDATE itself."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import scoped_session, sessionmaker

    from superset.ai.orchestrator import _claim_pending
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.thread import CreateAIChatThreadCommand
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    engine = create_engine(f"sqlite:///{tmp_path / 'claims.db'}")
    sessions = scoped_session(sessionmaker(bind=engine))
    mocker.patch("superset.db.session", sessions)
    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(engine)
    thread = CreateAIChatThreadCommand(1).run()
    message = AppendAIChatMessageCommand(
        thread.uuid, 1, "assistant", "", status="pending"
    ).run()
    message_uuid = str(message.uuid)
    sessions.remove()
    barrier = Barrier(2)

    def claim() -> bool:
        """Use a separate session and Flask context for each contender."""
        with app.app_context():
            try:
                barrier.wait(timeout=10)
                return _claim_pending(message_uuid)
            finally:
                sessions.remove()

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = [pool.submit(claim) for _ in range(2)]
            assert sorted(result.result(timeout=15) for result in results) == [
                False,
                True,
            ]
    finally:
        sessions.remove()
        engine.dispose()
