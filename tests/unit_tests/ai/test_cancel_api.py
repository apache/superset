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
"""Cancellation must resolve the run through its owned conversation."""

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils import json


@pytest.mark.parametrize(
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
)
@pytest.mark.usefixtures("full_api_access")
@pytest.mark.parametrize(
    "thread_index,run_id,status_code",
    [
        (0, "run-own", 200),
        (0, "run-other-owned", 404),
        (0, "run-foreign", 404),
        (0, "run-missing", 404),
        (2, "run-foreign", 404),
        (None, "run-own", 404),
        (0, None, 400),
    ],
    ids=[
        "own",
        "other-owned-thread",
        "foreign-run",
        "missing-run",
        "foreign-thread",
        "missing-thread",
        "missing-run-id",
    ],
)
def test_cancel_is_scoped_to_the_owned_thread(
    client: FlaskClient,
    session: Session,
    mocker: MockerFixture,
    thread_index: int | None,
    run_id: str | None,
    status_code: int,
) -> None:
    """Use real DAO predicates and reject mismatches before setting a flag."""
    from superset.models.ai import AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage):
        model.__table__.create(session.bind)
    threads = []
    for owner, stored_run_id in (
        (1, "run-own"),
        (1, "run-other-owned"),
        (2, "run-foreign"),
    ):
        thread = AIChatThread(created_by_fk=owner)
        message = AIChatMessage(
            thread=thread,
            role="assistant",
            status="pending",
            extra_json=json.dumps({"run_id": stored_run_id}),
        )
        session.add(message)
        threads.append(thread)
    session.flush()

    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    cancel = mocker.patch("superset.ai.orchestrator.request_cancel")
    thread_uuid = (
        str(threads[thread_index].uuid)
        if thread_index is not None
        else "00000000-0000-4000-8000-000000000000"
    )

    response = client.post(
        f"/api/v1/ai/thread/{thread_uuid}/cancel",
        json={"run_id": run_id} if run_id is not None else {},
    )

    assert response.status_code == status_code
    if status_code == 200:
        cancel.assert_called_once_with(run_id)
    else:
        cancel.assert_not_called()
