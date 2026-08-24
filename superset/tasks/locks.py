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
"""Distributed locking utilities for the Global Task Framework (GTF).

This module provides distributed locks for task operations to prevent race
conditions during concurrent task creation, subscription, and cancellation.

The lock key uses the task's dedup_key, ensuring all operations on the same
logical task serialize correctly.

When DISTRIBUTED_COORDINATION_CONFIG is configured, uses Redis SET NX EX for
efficient single-command locking. Otherwise falls back to database-backed
locking via DistributedLock.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Iterator

from superset.exceptions import LockAlreadyHeldException

logger = logging.getLogger(__name__)


# Task operations use a shorter TTL than the global default since
# they complete quickly (just DB operations, no external calls)
TASK_LOCK_TTL_SECONDS = 10
# Wait (block-and-retry) for a held lock rather than failing fast: concurrent
# submits of the SAME task must serialize so all-but-one JOIN the task the winner
# creates. Wait past the TTL so a lock orphaned by a crashed holder is waited out
# (it auto-expires) instead of erroring.
TASK_LOCK_WAIT_SECONDS = TASK_LOCK_TTL_SECONDS + 2
TASK_LOCK_RETRY_INTERVAL_SECONDS = 0.05


@contextmanager
def task_lock(dedup_key: str) -> Iterator[None]:
    """
    Acquire a distributed lock for task operations.

    Uses the task's dedup_key as the lock key. All operations on the same
    logical task (create, subscribe, cancel) use the same lock, ensuring
    mutual exclusion. This prevents race conditions such as:
    - Two concurrent creates with the same key
    - Subscribe racing with cancel
    - Multiple concurrent cancel requests

    When DISTRIBUTED_COORDINATION_CONFIG is configured, uses Redis SET NX EX
    for efficient single-command locking. Otherwise falls back to
    database-backed DistributedLock.

    :param dedup_key: Task deduplication key (from get_active_dedup_key)
    :yields: Nothing; used as context manager
    :raises AcquireDistributedLockFailedException: If the lock is still held after
        waiting out the TTL (only when a holder is genuinely stuck)

    Example:
        dedup_key = get_active_dedup_key(TaskScope.SHARED, "report", "monthly")
        with task_lock(dedup_key):
            # Create, subscribe, or cancel task here
            ...
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.distributed_lock.acquire import AcquireDistributedLock
    from superset.commands.distributed_lock.release import ReleaseDistributedLock

    params = {"key": dedup_key}
    acquire = AcquireDistributedLock("gtf:task", params, TASK_LOCK_TTL_SECONDS)

    # Block-and-wait rather than fail fast. Several charts can resolve to the same
    # query_cache_key (hence the same SHARED task and dedup_key) and submit at
    # once; the winner creates the task and the rest must WAIT here, then join it —
    # failing fast would surface a spurious "Lock already taken" error. Bounded by
    # the TTL so a crashed holder's lock is waited out (auto-expiry), never forever.
    deadline = time.monotonic() + TASK_LOCK_WAIT_SECONDS
    while True:
        try:
            acquire.run()
            break
        except LockAlreadyHeldException:
            if time.monotonic() >= deadline:
                raise
            time.sleep(TASK_LOCK_RETRY_INTERVAL_SECONDS)

    logger.debug("Acquired task lock for key: %s", dedup_key)
    try:
        yield
    finally:
        ReleaseDistributedLock("gtf:task", params, token=acquire.token).run()
        logger.debug("Released task lock for key: %s", dedup_key)
