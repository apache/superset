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

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import redis
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from superset.commands.distributed_lock.base import (
    BaseDistributedLockCommand,
    get_default_lock_ttl,
)
from superset.coordination.base import CoordinationService
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import (
    AcquireDistributedLockFailedException,
    LockAlreadyHeldException,
)
from superset.key_value.exceptions import (
    KeyValueCodecEncodeException,
    KeyValueUpsertFailedError,
)
from superset.key_value.types import KeyValueResource
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


def _kv_lock_on_error(ex: Exception) -> None:
    """Translate KV-backend exceptions into the appropriate lock exception type."""
    if isinstance(ex, IntegrityError):
        # Unique-constraint violation: lock is already held by another process.
        raise LockAlreadyHeldException("KV lock already held") from ex
    if isinstance(
        ex, (KeyValueCodecEncodeException, KeyValueUpsertFailedError, SQLAlchemyError)
    ):
        raise AcquireDistributedLockFailedException(f"KV lock failed: {ex}") from ex
    raise ex


class AcquireDistributedLock(BaseDistributedLockCommand):
    """
    Acquire a distributed lock with automatic backend selection.

    Uses Redis SET NX EX when DISTRIBUTED_COORDINATION_CONFIG is configured,
    otherwise falls back to KeyValue table.

    Raises AcquireDistributedLockFailedException if:
    - Lock is already held by another process
    - Redis connection fails
    """

    ttl_seconds: int

    def __init__(
        self,
        namespace: str,
        params: dict[str, Any] | None = None,
        ttl_seconds: int | None = None,
    ) -> None:
        super().__init__(namespace, params)
        self.ttl_seconds = ttl_seconds or get_default_lock_ttl()
        # A per-acquisition token stored as the lock's value, so release can
        # verify ownership (compare-and-delete) and never delete a lock a
        # *different* holder acquired after this one's TTL expired. Exposed to
        # the DistributedLock context manager, which threads it to release.
        self.token = uuid.uuid4().hex

    def run(self) -> None:
        if CoordinationService.is_backend_defined():
            self._acquire_redis()
        else:
            self._acquire_kv()

    def _acquire_redis(self) -> None:
        """Acquire lock using the coordination backend's SET NX EX (atomic)."""
        try:
            # SET NX EX: Set if not exists, with expiration. The value is this
            # acquisition's ownership token (see release's compare-and-delete).
            # Returns True if lock acquired, None if already exists
            acquired = CoordinationService.set_value(
                self.redis_lock_key,
                self.token,
                ttl=self.ttl_seconds,
                if_absent=True,
            )

            if not acquired:
                logger.debug("Redis lock on %s already taken", self.redis_lock_key)
                raise LockAlreadyHeldException("Lock already taken")

            logger.debug(
                "Acquired Redis lock: %s (TTL=%ds)",
                self.redis_lock_key,
                self.ttl_seconds,
            )

        except redis.RedisError as ex:
            logger.error("Redis lock error for %s: %s", self.redis_lock_key, ex)
            raise AcquireDistributedLockFailedException(
                f"Redis lock failed: {ex}"
            ) from ex

    @transaction(on_error=_kv_lock_on_error)
    def _acquire_kv(self) -> None:
        """Acquire lock using KeyValue table (database)."""
        # Delete expired entries first to prevent stale locks from blocking
        KeyValueDAO.delete_expired_entries(self.resource)

        # Create entry - unique constraint will raise if lock already exists.
        # The value carries this acquisition's ownership token (see release).
        KeyValueDAO.create_entry(
            resource=KeyValueResource.LOCK,
            value={"token": self.token},
            codec=self.codec,
            key=self.key,
            expires_on=datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds),
        )

        logger.debug(
            "Acquired KV lock: namespace=%s key=%s (TTL=%ds)",
            self.namespace,
            self.key,
            self.ttl_seconds,
        )
