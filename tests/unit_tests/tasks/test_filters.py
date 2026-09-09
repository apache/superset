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
from unittest.mock import MagicMock

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy import false
from sqlalchemy.orm.session import Session

from superset.tasks.filters import TaskFilter

GUEST_KEY = "guest:" + "a" * 64
OTHER_GUEST_KEY = "guest:" + "b" * 64


def test_task_filter_fails_closed_for_request_without_user_id(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A request-bound principal without a user id (anonymous or guest user)
    must not receive the unfiltered task list.
    """
    mocker.patch("superset.tasks.filters.get_user_id", return_value=None)
    task_filter = TaskFilter("id", MagicMock())
    query = MagicMock()

    with current_app.test_request_context("/api/v1/task/"):
        filtered = task_filter.apply(query, None)

    assert filtered is not query
    query.filter.assert_called_once()
    (predicate,) = query.filter.call_args.args
    assert str(predicate) == str(false())


@pytest.fixture
def guest_task_session(session: Session) -> Session:
    """A session holding one task subscribed to by ``GUEST_KEY``."""
    from superset.models.task_subscribers import TaskSubscriber
    from superset.models.tasks import Task

    engine = session.get_bind()
    Task.metadata.create_all(engine)
    TaskSubscriber.metadata.create_all(engine)

    task = Task(
        task_type="guest_type",
        task_key="guest-task",
        scope="shared",
        status="pending",
        dedup_key="guest-dedup-key",
    )
    session.add(task)
    session.flush()
    session.add(TaskSubscriber(task_id=task.id, guest_key=GUEST_KEY))
    session.flush()
    return session


@pytest.mark.parametrize(
    "guest_key, expected_task_keys",
    [
        # The guest sees the task carrying its own key ...
        (GUEST_KEY, ["guest-task"]),
        # ... and a guest whose token derives a different key sees nothing.
        (OTHER_GUEST_KEY, []),
    ],
)
def test_task_filter_scopes_guest_to_its_own_guest_key(
    guest_task_session: Session,
    mocker: MockerFixture,
    app_context: None,
    guest_key: str,
    expected_task_keys: list[str],
) -> None:
    """A guest's visibility is bounded by the key derived from its own token."""
    from superset.models.tasks import Task

    mocker.patch("superset.tasks.filters.get_user_id", return_value=None)
    mocker.patch(
        "superset.tasks.guest.get_current_guest_subscriber_key",
        return_value=guest_key,
    )

    task_filter = TaskFilter("id", MagicMock())
    with current_app.test_request_context("/api/v1/task/"):
        filtered = task_filter.apply(guest_task_session.query(Task), None)

    assert [task.task_key for task in filtered.all()] == expected_task_keys
