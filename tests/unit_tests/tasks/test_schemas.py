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
from types import SimpleNamespace

from pytest_mock import MockerFixture

from superset.tasks.schemas import TaskResponseSchema


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
