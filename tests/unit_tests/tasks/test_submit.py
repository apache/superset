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
"""Unit tests for SubmitTaskCommand lock/transaction ordering."""

from contextlib import contextmanager
from unittest import mock

from pytest_mock import MockerFixture

from superset.commands.tasks.submit import SubmitTaskCommand


def test_lock_encloses_create_or_join(mocker: MockerFixture) -> None:
    """The task lock must be held across the whole create-or-join transaction.

    Regression: the lock previously wrapped only the find/create inside
    ``run_with_info`` while ``@transaction`` committed *after* the lock was
    released, letting a concurrent submitter read-before-commit and insert a
    duplicate ``dedup_key``. The lock must now enclose ``_create_or_join``
    (which commits on return), so the observable order is
    enter-lock -> create/join(+commit) -> exit-lock.
    """
    order: list[str] = []

    @contextmanager
    def fake_lock(dedup_key: str):
        order.append("lock-enter")
        try:
            yield
        finally:
            order.append("lock-exit")

    mocker.patch("superset.commands.tasks.submit.task_lock", fake_lock)
    mocker.patch("superset.commands.tasks.submit.get_user_id", return_value=1)

    def fake_create_or_join(*args, **kwargs):
        order.append("create-or-join")
        return mock.MagicMock(), True

    mocker.patch.object(
        SubmitTaskCommand, "_create_or_join", side_effect=fake_create_or_join
    )

    task, is_new = SubmitTaskCommand(
        {"task_type": "superset.query_object_v1", "scope": "shared"}
    ).run_with_info()

    assert is_new is True
    assert order == ["lock-enter", "create-or-join", "lock-exit"]
