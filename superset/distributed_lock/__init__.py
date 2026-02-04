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

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from superset.distributed_lock.utils import get_key


@contextmanager
def DistributedLock(  # noqa: N802
    namespace: str,
    ttl_seconds: int | None = None,
    **kwargs: Any,
) -> Iterator[uuid.UUID]:
    """
    Distributed lock for coordinating operations across workers.

    Automatically uses Redis-based locking when SIGNAL_CACHE_CONFIG is
    configured, falling back to database-backed locking otherwise.

    Redis locking uses SET NX EX for atomic acquisition with automatic expiration.
    Database locking uses the KeyValue table with manual expiration cleanup.

    :param namespace: Lock namespace for grouping related locks
    :param ttl_seconds: Lock TTL in seconds. Defaults to 30 seconds.
                        After expiration, the lock is automatically released
                        to prevent deadlocks from crashed processes.
    :param kwargs: Additional key parameters to differentiate locks
    :yields: UUID identifying this lock acquisition
    :raises AcquireDistributedLockFailedException: If lock is already held
            or Redis connection fails
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.distributed_lock.acquire import AcquireDistributedLock
    from superset.commands.distributed_lock.release import ReleaseDistributedLock

    key = get_key(namespace, **kwargs)

    AcquireDistributedLock(namespace, kwargs, ttl_seconds).run()
    try:
        yield key
    finally:
        ReleaseDistributedLock(namespace, kwargs).run()
