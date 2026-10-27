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
"""A lost worker must terminate its message without replaying the turn."""

import subprocess
import sys
from types import SimpleNamespace

import pytest
from billiard.einfo import ExceptionInfo
from billiard.exceptions import WorkerLostError
from celery.utils.imports import symbol_by_name
from flask import Flask, has_app_context
from kombu import Message
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


@pytest.fixture(autouse=True)
def app_context(app: Flask, mocker: MockerFixture) -> None:
    """Parent worker callbacks run outside the child task's Flask context."""
    mocker.patch.dict(
        sys.modules,
        {"superset.tasks.celery_app": SimpleNamespace(flask_app=app)},
    )


@pytest.mark.parametrize("status", ["pending", "streaming", "complete", "cancelled"])
@pytest.mark.parametrize("failure", ["worker_lost", "hard_timeout"])
@pytest.mark.parametrize("owner_id", ["delivery-id", "other-delivery"])
def test_parent_worker_failure_finalises_only_unfinished_runs(
    session: Session, mocker: MockerFixture, status: str, failure: str, owner_id: str
) -> None:
    """Drive Celery's real parent callbacks against stored conversation rows."""
    from superset.ai.eventbus import MemoryEventBus
    from superset.ai.orchestrator import TurnRequest
    from superset.ai.tasks import run_turn
    from superset.extensions import celery_app
    from superset.models.ai import AIChatMessage, AIChatThread
    from superset.utils import json

    for model in (AIChatThread, AIChatMessage):
        model.__table__.create(session.bind)
    thread = AIChatThread(created_by_fk=1)
    message = AIChatMessage(
        thread=thread,
        role="assistant",
        status=status,
        content="saved answer" if status == "complete" else "",
        extra_json=json.dumps({"run_id": "owned-run", "worker_task_id": owner_id}),
    )
    session.add(message)
    session.commit()
    turn = TurnRequest(
        thread_uuid=str(thread.uuid),
        user_id=1,
        run_id="owned-run",
        assistant_message_uuid=str(message.uuid),
    )
    bus = MemoryEventBus()
    mocker.patch("superset.ai.eventbus.get_event_bus", return_value=bus)
    published = mocker.spy(bus, "publish")
    execute = mocker.patch("superset.ai.tasks.execute_turn")
    # Only the Celery result backend is outside the isolated metadata database.
    mocker.patch.object(run_turn.backend, "mark_as_failure")
    request_type = symbol_by_name(run_turn.Request)
    request = request_type(
        Message(headers={"id": "delivery-id", "task": run_turn.name}),
        app=celery_app,
        task=run_turn,
        decoded=True,
        body=([turn.to_payload()], {}, {}),
    )
    assert not has_app_context()
    if failure == "hard_timeout":
        request.on_timeout(soft=False, timeout=30)
    else:
        try:
            raise WorkerLostError("internal-only failure")
        except WorkerLostError:
            info = ExceptionInfo()
        request.on_failure(info)

    session.expire_all()
    failed = status == "pending" or (
        status == "streaming" and owner_id == "delivery-id"
    )
    expected = "error" if failed else status
    assert message.status == expected
    execute.assert_not_called()
    if expected == "error":
        assert message.extra["outcome"] == "error"
        assert message.content
        assert "internal-only" not in message.content
        events = [event for event in bus.consume("owned-run", 0.01) if event]
        assert [event.type.value for event in events] == ["final", "error", "done"]
        assert events[0].payload["content"] == message.content
        assert events[-1].payload == {"ok": False}
    else:
        published.assert_not_called()
        if status == "complete":
            assert message.content == "saved answer"


def test_worker_task_pins_early_acknowledgement() -> None:
    """The no-redelivery contract must not inherit Helm's late-ack setting."""
    subprocess.run(  # noqa: S603 - fixed test code in an isolated interpreter
        [
            sys.executable,
            "-c",
            "from superset.extensions import celery_app; "
            "celery_app.conf.task_acks_late = True; "
            "from superset.ai.tasks import run_turn; "
            "assert run_turn.acks_late is False",
        ],
        check=True,
        capture_output=True,
    )
