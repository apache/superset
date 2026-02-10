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
from datetime import datetime, timedelta, timezone
from functools import partial
from typing import Any

import redis
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.distributed_lock.base import (
    BaseDistributedLockCommand,
    get_default_lock_ttl,
    get_redis_client,
)
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import AcquireDistributedLockFailedException
from superset.key_value.exceptions import (
    KeyValueCodecEncodeException,
    KeyValueUpsertFailedError,
)
from superset.key_value.types import KeyValueResource
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class AcquireDistributedLock(BaseDistributedLockCommand):
    """
    Acquire a distributed lock with automatic backend selection.

    Uses Redis SET NX EX when SIGNAL_CACHE_CONFIG is configured,
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

    def run(self) -> None:
        if (redis_client := get_redis_client()) is not None:
            self._acquire_redis(redis_client)
        else:
            self._acquire_kv()

    def _acquire_redis(self, redis_client: Any) -> None:
        """Acquire lock using Redis SET NX EX (atomic)."""
        try:
            # SET NX EX: Set if not exists, with expiration
            # Returns True if lock acquired, None if already exists
            acquired = redis_client.set(
                self.redis_lock_key,
                "1",
                nx=True,
                ex=self.ttl_seconds,
            )

            if not acquired:
                logger.debug("Redis lock on %s already taken", self.redis_lock_key)
                raise AcquireDistributedLockFailedException("Lock already taken")

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

    @transaction(
        on_error=partial(
            on_error,
            catches=(
                KeyValueCodecEncodeException,
                KeyValueUpsertFailedError,
                SQLAlchemyError,
            ),
            reraise=AcquireDistributedLockFailedException,
        ),
    )
    def _acquire_kv(self) -> None:
        """Acquire lock using KeyValue table (database)."""
        # Delete expired entries first to prevent stale locks from blocking
        KeyValueDAO.delete_expired_entries(self.resource)

        # Create entry - unique constraint will raise if lock already exists
        KeyValueDAO.create_entry(
            resource=KeyValueResource.LOCK,
            value={"value": True},
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
