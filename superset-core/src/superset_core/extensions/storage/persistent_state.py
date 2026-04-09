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
Persistent State API for superset-core extensions (Tier 3 Storage).

Provides durable KV storage backed by a dedicated database table.
Data survives server restarts, cache evictions, and browser clears.
Suitable for user preferences, saved state, and any data that must not be lost.

Host implementations will replace these functions during initialization
with concrete implementations providing actual functionality.

Database keys are namespaced automatically:
- User-scoped (default): (extension_id, user_id, key)
- Shared (global): (extension_id, null, key)

Usage:
    from superset_core.extensions.storage import persistent_state

    # User-scoped state (default - private to current user)
    persistent_state.get('preferences')
    persistent_state.set('preferences', {'theme': 'dark'})
    persistent_state.remove('preferences')

    # Shared state (explicit opt-in - visible to all users)
    persistent_state.shared.get('global_config')
    persistent_state.shared.set('global_config', {'version': 2})
    persistent_state.shared.remove('global_config')
"""

from typing import Any, Protocol


class PersistentStateAccessor(Protocol):
    """Protocol for scoped persistent state access."""

    def get(self, key: str) -> Any:
        """Get a value from persistent state."""
        ...

    def set(self, key: str, value: Any) -> None:
        """Set a value in persistent state."""
        ...

    def remove(self, key: str) -> None:
        """Remove a value from persistent state."""
        ...


def get(key: str) -> Any:
    """
    Get a value from user-scoped persistent state.

    Data is automatically scoped to the current authenticated user.
    Other users cannot see or modify this data.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param key: The key to retrieve.
    :returns: The stored value, or None if not found.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def set(key: str, value: Any) -> None:
    """
    Set a value in user-scoped persistent state.

    Data is automatically scoped to the current authenticated user.
    Other users cannot see or modify this data.
    Data persists indefinitely until explicitly removed.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param key: The key to store.
    :param value: The value to store (must be JSON-serializable).
    """
    raise NotImplementedError("Function will be replaced during initialization")


def remove(key: str) -> None:
    """
    Remove a value from user-scoped persistent state.

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

    def set(self, key: str, value: Any) -> None:
        raise NotImplementedError("Accessor will be replaced during initialization")

    def remove(self, key: str) -> None:
        raise NotImplementedError("Accessor will be replaced during initialization")


#: Shared (global) persistent state accessor.
#: Data stored via this accessor is visible to all users of the extension.
#: WARNING: Do not store user-specific or sensitive data here.
#: Host implementations will replace this during initialization.
shared: PersistentStateAccessor = _SharedStub()
