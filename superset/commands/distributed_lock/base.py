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
from typing import Any, TYPE_CHECKING

from flask import current_app

from superset.commands.base import BaseCommand
from superset.distributed_lock.utils import get_key
from superset.extensions import cache_manager
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource

if TYPE_CHECKING:
    import redis

logger = logging.getLogger(__name__)


def get_default_lock_ttl() -> int:
    """Get the default lock TTL from config."""
    return int(current_app.config.get("DISTRIBUTED_LOCK_DEFAULT_TTL", 30))


def get_redis_client() -> "redis.Redis[Any] | None":
    """
    Get Redis client from coordination cache if available.

    Returns None if COORDINATION_CACHE_CONFIG is not configured,
    allowing fallback to database-backed locking.
    """
    backend = cache_manager.coordination_cache
    return backend._cache if backend else None


class BaseDistributedLockCommand(BaseCommand):
    """Base command for distributed lock operations."""

    key: uuid.UUID
    namespace: str
    codec = JsonKeyValueCodec()
    resource = KeyValueResource.LOCK

    def __init__(self, namespace: str, params: dict[str, Any] | None = None) -> None:
        self.namespace = namespace
        self.params = params or {}
        self.key = get_key(namespace, **self.params)

    @property
    def redis_lock_key(self) -> str:
        """Redis key for this lock."""
        return f"lock:{self.namespace}:{self.key}"

    def validate(self) -> None:
        pass
