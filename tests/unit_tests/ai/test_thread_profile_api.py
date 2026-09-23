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
"""An accepted turn snapshots and remembers its permitted conversation profile."""

from typing import Any

import pytest
from flask import current_app
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

pytestmark = [
    pytest.mark.parametrize(
        "app",
        [
            {
                "FEATURE_FLAGS": {"AI_ASSISTANT": True},
                "AI_ASSISTANT_EXECUTION_MODE": mode,
            }
            for mode in ("inline", "worker")
        ],
        indirect=True,
        ids=["inline", "worker"],
    ),
    pytest.mark.usefixtures("full_api_access"),
]


@pytest.fixture
def thread(session: Session, mocker: MockerFixture) -> Any:
    """Real metadata rows; route identity and broker delivery are controlled."""
    from superset import security_manager
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)
    conversation = AIChatThread(created_by_fk=1, agent_key="analyst")
    session.add(conversation)
    session.flush()
    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    mocker.patch.object(security_manager, "can_access", return_value=False)
    mocker.patch.dict(
        current_app.config,
        {
            "AI_AGENT_PROFILES": {
                "restricted": {
                    "name": "Restricted",
                    "tools": [],
                    "required_permission": ("can_admin", "AIAssistant"),
                },
            },
        },
    )
    return conversation


@pytest.mark.parametrize(
    "stored,selection,expected",
    [
        ("analyst", {}, "analyst"),
        ("analyst", {"agent_key": None}, "analyst"),
        ("analyst", {"agent_key": ""}, "analyst"),
        ("analyst", {"agent_key": "default"}, "default"),
        ("default", {"agent_key": "analyst"}, "analyst"),
        (None, {}, "default"),
        ("removed", {}, "default"),
        ("analyst", {"agent_key": "removed"}, "default"),
        ("restricted", {}, "default"),
        ("analyst", {"agent_key": "restricted"}, "default"),
        ("analyst", {"agent_key": "analyst"}, "analyst"),
    ],
)
def test_message_remembers_and_snapshots_its_profile(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    thread: Any,
    stored: str | None,
    selection: dict[str, Any],
    expected: str,
) -> None:
    """Later profile changes must not retarget an already accepted turn."""
    thread.agent_key = stored
    session.commit()
    url = f"/api/v1/ai/thread/{thread.uuid}"
    submitted = mocker.patch("superset.ai.tasks.submit_turn")
    stream = mocker.patch(
        "superset.ai.api.AIRestApi._build_stream", return_value=iter(())
    )

    response = client.post(f"{url}/message", json={"content": "first", **selection})
    assert response.status_code == 202
    accepted = response.json["result"]

    session.expire_all()
    detail = client.get(url).json["result"]
    assert detail["agent_key"] == expected
    assistant = next(
        message
        for message in detail["messages"]
        if message["uuid"] == accepted["assistant_message_uuid"]
    )
    assert assistant["extra"]["agent_key"] == expected

    next_profile = "default" if expected == "analyst" else "analyst"
    response = client.post(
        f"{url}/message", json={"content": "second", "agent_key": next_profile}
    )
    assert response.status_code == 202
    session.expire_all()
    assert client.get(url).json["result"]["agent_key"] == next_profile

    if current_app.config["AI_ASSISTANT_EXECUTION_MODE"] == "worker":
        assert [call.args[0].profile_key for call in submitted.call_args_list] == [
            expected,
            next_profile,
        ]
    else:
        submitted.assert_not_called()
        assert (
            client.get(f"{url}/stream?run_id={accepted['run_id']}").status_code == 200
        )
        assert stream.call_args.args[1].profile_key == expected


@pytest.mark.parametrize(
    "rejected",
    ["foreign-thread", "missing-thread", "no-profile", "all-profiles-denied"],
)
def test_rejected_profile_request_leaves_the_conversation_untouched(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    thread: Any,
    rejected: str,
) -> None:
    """Ownership/profile validation precedes storing messages or queueing work."""
    from superset.ai.profiles import AgentProfile, ProfileRegistry
    from superset.models.ai import AIChatMessage

    if rejected == "foreign-thread":
        thread.created_by_fk = 2
    session.commit()
    thread_uuid = str(thread.uuid)
    if rejected == "missing-thread":
        thread_uuid = "00000000-0000-4000-8000-000000000000"
    if rejected == "no-profile":
        mocker.patch(
            "superset.ai.factories.get_profiles", return_value=ProfileRegistry()
        )
    if rejected == "all-profiles-denied":
        registry = ProfileRegistry(
            {
                "default": AgentProfile(
                    key="default",
                    name="Restricted",
                    required_permission=("can_admin", "AIAssistant"),
                ),
            }
        )
        mocker.patch("superset.ai.factories.get_profiles", return_value=registry)
    submitted = mocker.patch("superset.ai.tasks.submit_turn")

    response = client.post(
        f"/api/v1/ai/thread/{thread_uuid}/message",
        json={"content": "must not be stored", "agent_key": "default"},
    )

    assert response.status_code == (
        422 if rejected in ("no-profile", "all-profiles-denied") else 404
    )
    session.expire_all()
    assert thread.agent_key == "analyst"
    assert session.query(AIChatMessage).count() == 0
    submitted.assert_not_called()
