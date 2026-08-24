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
"""Unit tests for the GTF task_lock (block-and-wait acquisition)."""

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import LockAlreadyHeldException

ACQUIRE = "superset.commands.distributed_lock.acquire.AcquireDistributedLock"
RELEASE = "superset.commands.distributed_lock.release.ReleaseDistributedLock"


def test_task_lock_waits_for_a_held_lock_then_acquires(
    mocker: MockerFixture,
) -> None:
    """A held lock is retried (not failed) so a concurrent submit can join."""
    from superset.tasks.locks import task_lock

    mocker.patch("superset.tasks.locks.time.sleep")
    acquire = mocker.patch(ACQUIRE).return_value
    acquire.token = "tok"  # noqa: S105
    # Held for the first two attempts, then acquired.
    acquire.run.side_effect = [
        LockAlreadyHeldException("Lock already taken"),
        LockAlreadyHeldException("Lock already taken"),
        None,
    ]
    release = mocker.patch(RELEASE)

    entered = False
    with task_lock("dedup-1"):
        entered = True

    assert entered
    assert acquire.run.call_count == 3
    # Released with the acquisition's own token (ownership-checked).
    release.assert_called_once_with("gtf:task", {"key": "dedup-1"}, token="tok")  # noqa: S106
    release.return_value.run.assert_called_once()


def test_task_lock_reraises_when_still_held_past_the_deadline(
    mocker: MockerFixture,
) -> None:
    """A genuinely stuck lock (held past the wait window) surfaces the error."""
    from superset.tasks.locks import task_lock

    mocker.patch("superset.tasks.locks.time.sleep")
    # First monotonic() sets the deadline; the next is past it, so we give up.
    mocker.patch("superset.tasks.locks.time.monotonic", side_effect=[0.0, 999.0])
    mocker.patch(ACQUIRE).return_value.run.side_effect = LockAlreadyHeldException(
        "Lock already taken"
    )
    release = mocker.patch(RELEASE)

    with pytest.raises(LockAlreadyHeldException):
        with task_lock("dedup-2"):
            pass

    # Never entered the critical section → nothing to release.
    release.return_value.run.assert_not_called()
