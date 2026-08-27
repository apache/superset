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

from superset.commands.distributed_lock.base import BaseDistributedLockCommand
from superset.coordination.base import CoordinationService
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import ReleaseDistributedLockFailedException
from superset.key_value.exceptions import KeyValueDeleteFailedError
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class ReleaseDistributedLock(BaseDistributedLockCommand):
    """
    Release a distributed lock with automatic backend selection.

    Uses Redis when DISTRIBUTED_COORDINATION_CONFIG is configured, otherwise the
    KeyValue table. Release is **ownership-checked**: it only removes the lock if
    the stored value still matches this acquisition's ``token``. Without that
    check, a holder whose TTL expired (letting another holder acquire the same
    key) would delete the *new* holder's lock on its own release.
    """

    def __init__(
        self,
        namespace: str,
        params: dict[str, Any] | None = None,
        token: str | None = None,
    ) -> None:
        super().__init__(namespace, params)
        # The acquisition token to match on release (see AcquireDistributedLock).
        # None means "delete unconditionally" — only for callers that did not
        # acquire via the token-aware path.
        self.token = token

    def run(self) -> None:
        if CoordinationService.is_backend_defined():
            self._release_redis()
        else:
            self._release_kv()

    def _release_redis(self) -> None:
        """Release the lock only if we still own it (atomic compare-and-delete)."""
        try:
            if self.token is not None:
                # One server-side compare-and-delete: removes the key only if it
                # still holds our token, so an expired-then-reacquired lock owned
                # by another holder is left untouched (no get-then-delete window).
                if not CoordinationService.compare_and_delete(
                    self.redis_lock_key, self.token
                ):
                    logger.warning(
                        "Not releasing Redis lock %s: owned by another "
                        "acquisition or already gone",
                        self.redis_lock_key,
                    )
                return
            CoordinationService.delete_value(self.redis_lock_key)
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
        """Release the KV lock only if we still own it (ownership-checked).

        The read and the delete are separate statements, so this is not atomic the
        way the Redis path's compare-and-delete is; the enclosing transaction plus
        the lock's TTL keep the residual window harmless.
        """
        if self.token is not None:
            stored = KeyValueDAO.get_value(self.resource, self.key, self.codec)
            if not isinstance(stored, dict) or stored.get("token") != self.token:
                # Missing/expired, or re-acquired by another holder — leave it.
                logger.warning(
                    "Not releasing KV lock namespace=%s key=%s: not owned by "
                    "this acquisition",
                    self.namespace,
                    self.key,
                )
                return
        KeyValueDAO.delete_entry(self.resource, self.key)
        logger.debug(
            "Released KV lock: namespace=%s key=%s",
            self.namespace,
            self.key,
        )
