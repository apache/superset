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

Host implementations will replace the PersistentState class during initialization
with a concrete implementation providing actual functionality.

Database keys are namespaced automatically:
- User-scoped (default): (extension_id, user_id, key)
- Shared (global): (extension_id, null, key)

Usage (via extension context - preferred):
    from superset_core.extensions.context import get_context

    ctx = get_context()

    # User-scoped state (default - private to current user)
    ctx.storage.persistent.get('preferences')
    ctx.storage.persistent.set('preferences', {'theme': 'dark'})
    ctx.storage.persistent.remove('preferences')

    # Shared state (explicit opt-in - visible to all users)
    ctx.storage.persistent.shared.get('global_config')
    ctx.storage.persistent.shared.set('global_config', {'version': 2})
    ctx.storage.persistent.shared.remove('global_config')

    # Encrypted at rest
    ctx.storage.persistent.set(
        'api_token', 'sk-...', PersistentSetOptions(encrypt=True)
    )
"""

from dataclasses import dataclass
from typing import Any, ClassVar, Protocol


@dataclass(frozen=True)
class PersistentSetOptions:
    """
    Options for a persistent state `set` call.

    NOTE: This is intentionally minimal for the initial implementation.
    Additional options can be added here later without changing the `set`
    signature on `PersistentStateAccessor`/`PersistentState`.
    """

    encrypt: bool = False


class PersistentStateAccessor(Protocol):
    """Protocol for scoped persistent state access."""

    def get(self, key: str) -> Any:
        """Get a value from persistent state."""
        ...

    def set(
        self, key: str, value: Any, options: PersistentSetOptions | None = None
    ) -> None:
        """Set a value in persistent state."""
        ...

    def remove(self, key: str) -> None:
        """Remove a value from persistent state."""
        ...


class PersistentState:
    """
    Tier 3 persistent state storage for extensions.

    Backed by a dedicated database table. Data survives server restarts,
    cache evictions, and browser clears.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.

    All operations are user-scoped by default (private to the current user).
    Use `.shared` to access state that is visible to all users.
    """

    @staticmethod
    def get(key: str) -> Any:
        """
        Get a value from user-scoped persistent state.

        Data is automatically scoped to the current authenticated user.
        Other users cannot see or modify this data.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    @staticmethod
    def set(key: str, value: Any, options: PersistentSetOptions | None = None) -> None:
        """
        Set a value in user-scoped persistent state.

        Data is automatically scoped to the current authenticated user.
        Other users cannot see or modify this data.
        Data persists indefinitely until explicitly removed.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        :param options: Optional `PersistentSetOptions`, e.g. `encrypt=True`
            to store the value encrypted at rest.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    @staticmethod
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped persistent state.

        Data is automatically scoped to the current authenticated user.

        :param key: The key to remove.
        """
        raise NotImplementedError("Class will be replaced during initialization")

    #: Shared (global) persistent state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    #: Host implementations will set this during initialization.
    shared: ClassVar[PersistentStateAccessor]
