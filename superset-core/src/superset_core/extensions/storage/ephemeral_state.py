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

Host implementations will replace these functions during initialization
with concrete implementations providing actual functionality.

Cache keys are namespaced automatically:
- User-scoped (default): superset-ext:{extension_id}:user:{user_id}:{key}
- Shared (global): superset-ext:{extension_id}:{key}

Usage:
    from superset_core.extensions.storage import ephemeral_state

    # User-scoped state (default - private to current user)
    ephemeral_state.get('preference')
    ephemeral_state.set('preference', 'compact')
    ephemeral_state.remove('preference')

    # Shared state (explicit opt-in - visible to all users)
    ephemeral_state.shared.get('job_progress')
    ephemeral_state.shared.set('job_progress', {'pct': 42})
    ephemeral_state.shared.remove('job_progress')
"""

from typing import Any, Protocol


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


def get(key: str) -> Any:
    """
    Get a value from user-scoped ephemeral state.

    Data is automatically scoped to the current authenticated user.
    Other users cannot see or modify this data.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param key: The key to retrieve.
    :returns: The stored value, or None if not found or expired.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def set(key: str, value: Any, ttl: int | None = None) -> None:
    """
    Set a value in user-scoped ephemeral state with TTL.

    Data is automatically scoped to the current authenticated user.
    Other users cannot see or modify this data.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param key: The key to store.
    :param value: The value to store (must be JSON-serializable).
    :param ttl: Time-to-live in seconds. Defaults to CACHE_DEFAULT_TIMEOUT.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def remove(key: str) -> None:
    """
    Remove a value from user-scoped ephemeral state.

    Data is automatically scoped to the current authenticated user.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param key: The key to remove.
    """
    raise NotImplementedError("Function will be replaced during initialization")


class _SharedStub:
    """Stub for shared accessor that raises NotImplementedError on any operation."""

    def get(self, key: str) -> Any:
        raise NotImplementedError("Accessor will be replaced during initialization")

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        raise NotImplementedError("Accessor will be replaced during initialization")

    def remove(self, key: str) -> None:
        raise NotImplementedError("Accessor will be replaced during initialization")


#: Shared (global) ephemeral state accessor.
#: Data stored via this accessor is visible to all users of the extension.
#: WARNING: Do not store user-specific or sensitive data here.
#: Host implementations will replace this during initialization.
shared: EphemeralStateAccessor = _SharedStub()


__all__ = [
    "EphemeralStateAccessor",
    "get",
    "set",
    "remove",
    "shared",
]
