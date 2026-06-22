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

"""
Ephemeral State API for superset-core extensions (Tier 2 Storage).

Provides short-lived KV storage backed by the configured server-side cache
backend (Redis, Memcached, or filesystem). Automatically expires based on TTL.
Not guaranteed to survive server restarts.

Host implementations will replace the EphemeralState class during initialization
with a concrete implementation providing actual functionality.

Cache keys are namespaced automatically:
- User-scoped (default): superset-ext:{extension_id}:user:{user_id}:{key}
- Shared (global): superset-ext:{extension_id}:shared:{key}

Usage (via extension context - preferred):
    from superset_core.extensions.context import get_context

    ctx = get_context()

    # User-scoped state (default - private to current user)
    ctx.storage.ephemeral.get('preference')
    ctx.storage.ephemeral.set('preference', 'compact', ttl=3600)
    ctx.storage.ephemeral.remove('preference')

    # Shared state (explicit opt-in - visible to all users)
    ctx.storage.ephemeral.shared.get('job_progress')
    ctx.storage.ephemeral.shared.set('job_progress', {'pct': 42}, ttl=3600)
    ctx.storage.ephemeral.shared.remove('job_progress')
"""

from typing import Any, ClassVar, Protocol


class EphemeralStateAccessor(Protocol):
    """Protocol for scoped ephemeral state access."""

    def get(self, key: str) -> Any:
        """Get a value from ephemeral state."""
        ...

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a value in ephemeral state with TTL."""
        ...

    def remove(self, key: str) -> None:
        """Remove a value from ephemeral state."""
        ...


class EphemeralState:
    """
    Tier 2 ephemeral state storage for extensions.

    Backed by the configured server-side cache (Redis, Memcached, or filesystem).
    Data expires based on TTL and is not guaranteed to survive server restarts.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.

    All operations are user-scoped by default (private to the current user).
    Use `.shared` to access state that is visible to all users.
    """

    @staticmethod
    def get(key: str) -> Any:
        """
        Get a value from user-scoped ephemeral state.

        Data is automatically scoped to the current authenticated user.
        Other users cannot see or modify this data.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found or expired.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    @staticmethod
    def set(key: str, value: Any, ttl: int | None = None) -> None:
        """
        Set a value in user-scoped ephemeral state with TTL.

        Data is automatically scoped to the current authenticated user.
        Other users cannot see or modify this data.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        :param ttl: Time-to-live in seconds. Defaults to MAX_TTL from config.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    @staticmethod
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped ephemeral state.

        Data is automatically scoped to the current authenticated user.

        :param key: The key to remove.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    #: Shared (global) ephemeral state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    #: Host implementations will set this during initialization.
    shared: ClassVar[EphemeralStateAccessor]
