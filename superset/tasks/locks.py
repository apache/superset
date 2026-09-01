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
from contextlib import contextmanager
from typing import Iterator

from superset.exceptions import LockAlreadyHeldException

logger = logging.getLogger(__name__)


# Task operations use a shorter TTL than the global default since
# they complete quickly (just DB operations, no external calls)
TASK_LOCK_TTL_SECONDS = 10
# Wait for a held lock rather than failing fast: concurrent submits of the SAME
# task must serialize so all-but-one JOIN the task the winner creates. Give the
# wait comfortable headroom over the TTL (plus the stream block interval) so a
# lock orphaned by a crashed holder is still waited out — the lock auto-expires
# at the TTL and the next re-check acquires it — rather than timing out first.
TASK_LOCK_WAIT_SECONDS = TASK_LOCK_TTL_SECONDS * 3
# Poll cadence for the no-coordination-backend fallback (see wait_for_signal).
TASK_LOCK_POLL_INTERVAL_SECONDS = 0.05


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

    Waits for a held lock rather than failing fast — several charts can resolve
    to the same query_cache_key (hence the same SHARED task and dedup_key) and
    submit at once; the winner creates the task and the rest wait here, then join
    it. The wait is delegated to ``CoordinationService.wait_for_signal``, which is
    **event-driven** when a coordination backend is configured (it parks on the
    lock's release-signal Redis Stream and retries the ``SET NX`` when the holder
    releases — or on the periodic re-check that also covers a crashed holder,
    whose lock auto-expires at the TTL) and **polls** the acquire otherwise. On
    release we ``notify`` that stream so a waiter wakes immediately.

    :param dedup_key: Task deduplication key (from get_active_dedup_key)
    :yields: Nothing; used as context manager
    :raises TimeoutError: If the lock is still held after ``TASK_LOCK_WAIT_SECONDS``
        (only when a holder is genuinely stuck)

    Example:
        dedup_key = get_active_dedup_key(TaskScope.SHARED, "report", "monthly")
        with task_lock(dedup_key):
            # Create, subscribe, or cancel task here
            ...
    """
    # Deferred imports: the lock commands pull in the key-value metastore layer,
    # whose encrypted-column setup requires an initialized app at import time, so
    # importing them at module scope would tie this module's import to app startup.
    # pylint: disable=import-outside-toplevel
    from superset.commands.distributed_lock.acquire import AcquireDistributedLock
    from superset.commands.distributed_lock.release import ReleaseDistributedLock
    from superset.coordination.base import CoordinationService

    params = {"key": dedup_key}
    release_channel = f"gtf:task:lock-released:{dedup_key}"
    acquire = AcquireDistributedLock("gtf:task", params, TASK_LOCK_TTL_SECONDS)

    def _try_acquire() -> bool | None:
        # SET NX: acquire the lock, or None while another submit still holds it.
        # (Re-runs reuse this acquisition's token, so release stays ownership-safe.)
        # wait_for_signal treats any non-None result as "satisfied".
        try:
            acquire.run()
            return True
        except LockAlreadyHeldException:
            return None

    CoordinationService.wait_for_signal(
        release_channel,
        _try_acquire,
        timeout=TASK_LOCK_WAIT_SECONDS,
        poll_interval=TASK_LOCK_POLL_INTERVAL_SECONDS,
    )

    logger.debug("Acquired task lock for key: %s", dedup_key)
    try:
        yield
    finally:
        # Release (delete) BEFORE notifying, so a woken waiter sees the freed lock.
        # Best-effort: a release/notify failure must NOT propagate out of the lock.
        # This teardown runs after the caller's create-or-join transaction has
        # committed, so letting it escape would skip the caller's post-commit work
        # (notably enqueuing the Celery job in submit_task), stranding a committed
        # PENDING task the reaper won't reclaim. The lock's TTL reclaims the lock.
        try:
            ReleaseDistributedLock("gtf:task", params, token=acquire.token).run()
            if CoordinationService.is_backend_defined():
                CoordinationService.notify(release_channel)
            logger.debug("Released task lock for key: %s", dedup_key)
        except Exception:  # noqa: BLE001  pylint: disable=broad-except
            logger.warning(
                "Best-effort release/notify of task lock %s failed; the lock TTL "
                "will reclaim it",
                dedup_key,
                exc_info=True,
            )
