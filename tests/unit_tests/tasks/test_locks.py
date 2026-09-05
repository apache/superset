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
"""Unit tests for the GTF task_lock (wait-for-release acquisition)."""

from typing import Any, Callable

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import LockAlreadyHeldException

ACQUIRE = "superset.commands.distributed_lock.acquire.AcquireDistributedLock"
RELEASE = "superset.commands.distributed_lock.release.ReleaseDistributedLock"
COORD = "superset.coordination.base.CoordinationService"


def _drive_wait_for_signal(
    _channel: str,
    check: Callable[[], Any],
    **_kwargs: Any,
) -> Any:
    """Faithful stand-in for wait_for_signal: re-run check() until satisfied.

    Mirrors the real contract (block/poll, then re-run the source-of-truth check),
    without a backend — so task_lock's acquire/release wiring is what's exercised.
    """
    while (result := check()) is None:
        pass
    return result


def test_task_lock_waits_for_a_held_lock_then_acquires_and_notifies(
    mocker: MockerFixture,
) -> None:
    """A held lock is retried (not failed); on release we free it and notify."""
    from superset.tasks.locks import task_lock

    acquire = mocker.patch(ACQUIRE).return_value
    acquire.token = "tok"  # noqa: S105
    # Held for the first two SET NX attempts, then acquired.
    acquire.run.side_effect = [
        LockAlreadyHeldException("Lock already taken"),
        LockAlreadyHeldException("Lock already taken"),
        None,
    ]
    release = mocker.patch(RELEASE)
    coord = mocker.patch(COORD)
    coord.wait_for_signal.side_effect = _drive_wait_for_signal
    coord.is_backend_defined.return_value = True

    entered = False
    with task_lock("dedup-1"):
        entered = True

    assert entered
    assert acquire.run.call_count == 3  # two "held", then acquired
    # Released with the acquisition's own token, then the release stream notified.
    release.assert_called_once_with("gtf:task", {"key": "dedup-1"}, token="tok")  # noqa: S106
    release.return_value.run.assert_called_once()
    coord.notify.assert_called_once_with("gtf:task:lock-released:dedup-1")


def test_task_lock_skips_notify_without_a_coordination_backend(
    mocker: MockerFixture,
) -> None:
    """With no backend there's no release stream to notify (waiters poll)."""
    from superset.tasks.locks import task_lock

    acquire = mocker.patch(ACQUIRE).return_value
    acquire.token = "tok"  # noqa: S105
    acquire.run.side_effect = [None]
    mocker.patch(RELEASE)
    coord = mocker.patch(COORD)
    coord.wait_for_signal.side_effect = _drive_wait_for_signal
    coord.is_backend_defined.return_value = False

    with task_lock("dedup-2"):
        pass

    coord.notify.assert_not_called()


def test_task_lock_propagates_wait_timeout(mocker: MockerFixture) -> None:
    """A genuinely stuck lock (never freed) surfaces wait_for_signal's timeout."""
    from superset.tasks.locks import task_lock

    mocker.patch(ACQUIRE)
    release = mocker.patch(RELEASE)
    coord = mocker.patch(COORD)
    coord.wait_for_signal.side_effect = TimeoutError("Timed out waiting")

    with pytest.raises(TimeoutError):
        with task_lock("dedup-3"):
            pass

    # Never acquired → nothing to release.
    release.return_value.run.assert_not_called()
