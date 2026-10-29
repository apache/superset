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
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset.tasks.schemas import TaskResponseSchema
from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE


@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize("task_type", ["superset.query_object_v1", "other_task"])
def test_task_properties_sanitize_chart_errors_per_reader(
    mocker: MockerFixture, guest: bool, task_type: str
) -> None:
    """List and detail serialization redact chart errors without changing storage."""
    task: SimpleNamespace = _task_with_private()
    task.task_type = task_type
    mocker.patch("superset.tasks.utils.current_app").debug = False
    mocker.patch("superset.security_manager.is_guest_user", return_value=guest)
    schema: TaskResponseSchema = TaskResponseSchema(only=["properties"])
    detail: dict[str, Any] = schema.dump(task)
    listing: list[dict[str, Any]] = schema.dump([task], many=True)
    expected: str = (
        str(GENERIC_ERROR_MESSAGE)
        if guest and task_type == "superset.query_object_v1"
        else "boom"
    )
    assert detail["properties"]["error_message"] == expected
    assert listing[0]["properties"]["error_message"] == expected
    assert task.properties_dict["error_message"] == "boom"


@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"GLOBAL_TASK_FRAMEWORK": True}}], indirect=True
)
def test_task_detail_chart_validation_message(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    guest: bool,
) -> None:
    """The detail endpoint uses the viewing principal for chart error redaction."""
    # Avoid app-init regression: task models require the app fixture.
    from superset.models.tasks import Task

    task: Task = Task(
        uuid=uuid4(),
        task_type="superset.query_object_v1",
        status="failure",
        created_on=datetime(2026, 10, 20),
        properties='{"error_message": "Error: Invalid filter on private_column"}',
    )
    mocker.patch("superset.daos.tasks.TaskDAO.find_one_or_none", return_value=task)
    mocker.patch("superset.security_manager.is_guest_user", return_value=guest)
    response: TestResponse = client.get(f"/api/v1/task/{task.uuid}")
    assert response.status_code == 200
    assert response.json["result"]["properties"]["error_message"] == (
        str(GENERIC_ERROR_MESSAGE)
        if guest
        else "Error: Invalid filter on private_column"
    )


def _task_with_private() -> SimpleNamespace:
    """A task with public keys plus a populated two-namespace private bucket."""
    return SimpleNamespace(
        properties_dict={
            "is_abortable": True,
            "progress_percent": 1.0,
            "error_message": "boom",
            "private": {
                "framework": {
                    "celery_task_id": "celery-123",
                    "exception_type": "KeyError",
                    "stack_trace": "Traceback (most recent call last):",
                },
                "task": {"cancel_query_id": "42", "cancel_database_id": 7},
            },
        }
    )


def test_get_properties_strips_private_outside_debug(mocker: MockerFixture) -> None:
    """
    Outside debug mode the whole ``private`` bucket (framework orchestration/error
    debug + task handles) is stripped (CWE-209), while consumer-safe public keys
    — including ``error_message`` — remain.
    """
    mocker.patch("superset.tasks.utils.current_app").debug = False

    properties = TaskResponseSchema().get_properties(_task_with_private())

    assert "private" not in properties
    assert properties["error_message"] == "boom"
    assert properties["is_abortable"] is True
    assert properties["progress_percent"] == 1.0


def test_get_properties_exposes_private_in_debug(mocker: MockerFixture) -> None:
    """In debug mode the private bucket (both namespaces) is surfaced verbatim."""
    mocker.patch("superset.tasks.utils.current_app").debug = True

    properties = TaskResponseSchema().get_properties(_task_with_private())

    private = properties["private"]
    assert private["framework"]["celery_task_id"] == "celery-123"
    assert private["framework"]["exception_type"] == "KeyError"
    assert private["task"]["cancel_query_id"] == "42"
    # public keys unaffected
    assert properties["error_message"] == "boom"


def test_get_subscribers_mixes_users_and_anonymized_guests() -> None:
    """User subscribers keep their profile; guests get anonymized G1/G2 labels."""
    from datetime import datetime

    def _sub(id_, user_id, user, subscribed_at):
        return SimpleNamespace(
            id=id_, user_id=user_id, user=user, subscribed_at=subscribed_at
        )

    alice = SimpleNamespace(first_name="Alice", last_name="Smith")
    task = SimpleNamespace(
        subscribers=[
            _sub(1, 7, alice, datetime(2020, 1, 1, 0, 0, 0)),
            # Two guests, deliberately out of subscription order to prove the
            # G-ordinals are assigned by subscribed_at, not list order.
            _sub(2, None, None, datetime(2020, 1, 1, 0, 0, 2)),
            _sub(3, None, None, datetime(2020, 1, 1, 0, 0, 1)),
        ]
    )

    result = TaskResponseSchema().get_subscribers(task)

    assert result[0] == {
        "user_id": 7,
        "is_guest": False,
        "first_name": "Alice",
        "last_name": "Smith",
        "subscribed_at": "2020-01-01T00:00:00",
    }
    # Guest ordinals follow subscription time: id=3 (earlier) → G1, id=2 → G2.
    guests = {r["subscribed_at"]: r for r in result if r["is_guest"]}
    assert guests["2020-01-01T00:00:01"]["label"] == "G1"
    assert guests["2020-01-01T00:00:02"]["label"] == "G2"
    assert all(g["user_id"] is None for g in guests.values())
