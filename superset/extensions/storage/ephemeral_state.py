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
Host implementation for Ephemeral State (Tier 2 Storage).

Provides the concrete cache-backed implementation that is injected into
superset_core.extensions.storage.ephemeral_state at startup.
"""

from __future__ import annotations

from typing import Any

from flask import g

from superset.extensions import cache_manager
from superset.extensions.context import get_current_extension_context

# Key separator
SEPARATOR = ":"

# Key prefix for extension ephemeral state
KEY_PREFIX = "superset-ext"


def _get_extension_id() -> str:
    """Get the current extension ID from context."""
    context = get_current_extension_context()
    if context is None:
        raise RuntimeError(
            "ephemeral_state can only be used within an extension context. "
            "Ensure this code is being executed during extension loading or "
            "within an extension API request handler."
        )
    return context.manifest.id


def _get_current_user_id() -> int:
    """Get the current authenticated user's ID."""
    user = getattr(g, "user", None)
    if user is None or not hasattr(user, "id"):
        raise RuntimeError(
            "ephemeral_state requires an authenticated user. "
            "Ensure the request has been authenticated."
        )
    return user.id


def _build_cache_key(*parts: Any) -> str:
    """Build a namespaced cache key from parts."""
    return SEPARATOR.join(str(part) for part in parts)


class SharedEphemeralStateAccessor:
    """
    Accessor for shared (global) ephemeral state.

    Data stored via this accessor is visible to all users of the extension.
    Extension ID is resolved lazily on each operation from the current context.
    """

    def _build_key(self, key: str) -> str:
        """Build a shared (global) cache key."""
        extension_id = _get_extension_id()
        return _build_cache_key(KEY_PREFIX, extension_id, "shared", key)

    def get(self, key: str) -> Any:
        """
        Get a value from shared ephemeral state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found or expired.
        """
        cache_key = self._build_key(key)
        return cache_manager.extension_ephemeral_state_cache.get(cache_key)

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """
        Set a value in shared ephemeral state with TTL.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        :param ttl: Time-to-live in seconds. Defaults to CACHE_DEFAULT_TIMEOUT.
        """
        cache_key = self._build_key(key)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

    def remove(self, key: str) -> None:
        """
        Remove a value from shared ephemeral state.

        :param key: The key to remove.
        """
        cache_key = self._build_key(key)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)


class EphemeralStateImpl:
    """
    Host implementation for ephemeral state operations.

    This class provides the concrete implementation that is injected into
    superset_core.extensions.storage.ephemeral_state.

    By default, all operations are user-scoped (private to the current user).
    Use `shared` to access state that is visible to all users.
    """

    @staticmethod
    def _build_user_key(extension_id: str, user_id: int, key: str) -> str:
        """Build a user-scoped cache key."""
        return _build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)

    @staticmethod
    def get(key: str) -> Any:
        """
        Get a value from user-scoped ephemeral state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found or expired.
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        cache_key = EphemeralStateImpl._build_user_key(extension_id, user_id, key)
        return cache_manager.extension_ephemeral_state_cache.get(cache_key)

    @staticmethod
    def set(key: str, value: Any, ttl: int | None = None) -> None:
        """
        Set a value in user-scoped ephemeral state with TTL.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        :param ttl: Time-to-live in seconds. Defaults to CACHE_DEFAULT_TIMEOUT.
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        cache_key = EphemeralStateImpl._build_user_key(extension_id, user_id, key)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

    @staticmethod
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped ephemeral state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        cache_key = EphemeralStateImpl._build_user_key(extension_id, user_id, key)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)

    #: Shared (global) ephemeral state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    shared: SharedEphemeralStateAccessor = SharedEphemeralStateAccessor()
