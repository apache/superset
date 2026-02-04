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
from functools import partial
from typing import Any

import redis
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.distributed_lock.base import (
    BaseDistributedLockCommand,
    get_redis_client,
)
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import ReleaseDistributedLockFailedException
from superset.key_value.exceptions import KeyValueDeleteFailedError
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class ReleaseDistributedLock(BaseDistributedLockCommand):
    """
    Release a distributed lock with automatic backend selection.

    Uses Redis DELETE when SIGNAL_CACHE_CONFIG is configured,
    otherwise deletes from KeyValue table.
    """

    def run(self) -> None:
        if (redis_client := get_redis_client()) is not None:
            self._release_redis(redis_client)
        else:
            self._release_kv()

    def _release_redis(self, redis_client: Any) -> None:
        """Release lock using Redis DELETE."""
        try:
            redis_client.delete(self.redis_lock_key)
            logger.debug("Released Redis lock: %s", self.redis_lock_key)
        except redis.RedisError as ex:
            # Log warning but don't raise - TTL will handle cleanup
            logger.warning(
                "Failed to release Redis lock %s: %s (TTL will handle cleanup)",
                self.redis_lock_key,
                ex,
            )

    @transaction(
        on_error=partial(
            on_error,
            catches=(
                KeyValueDeleteFailedError,
                SQLAlchemyError,
            ),
            reraise=ReleaseDistributedLockFailedException,
        ),
    )
    def _release_kv(self) -> None:
        """Release lock using KeyValue table (database)."""
        KeyValueDAO.delete_entry(self.resource, self.key)
        logger.debug(
            "Released KV lock: namespace=%s key=%s",
            self.namespace,
            self.key,
        )
