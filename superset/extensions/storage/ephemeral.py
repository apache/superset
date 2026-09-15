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
superset_core.extensions.storage.ephemeral at startup. Delegates all cache
access and validation (MAX_TTL, MAX_VALUE_SIZE) to `ExtensionEphemeralDAO`,
shared with the REST API (`api.py`) so both enforce the same limits.
"""

from __future__ import annotations

from typing import Any, ClassVar

from superset_core.extensions.storage.ephemeral import (
    EphemeralSetOptions,
    EphemeralState as CoreEphemeralState,
)

from superset.extensions.storage.ephemeral_dao import ExtensionEphemeralDAO
from superset.extensions.storage.utils import get_current_extension_id


def _get_extension_id() -> str:
    """Get the current extension ID from context."""
    return get_current_extension_id("ephemeral_state")


class SharedEphemeralStateAccessor:
    """
    Accessor for shared (global) ephemeral state.

    Data stored via this accessor is visible to all users of the extension.
    Extension ID is resolved lazily on each operation from the current context.
    """

    def get(self, key: str) -> Any:
        """
        Get a value from shared ephemeral state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found or expired.
        """
        extension_id = _get_extension_id()
        return ExtensionEphemeralDAO.get(extension_id, key, shared=True)

    def set(self, key: str, value: Any, options: EphemeralSetOptions) -> None:
        """
        Set a value in shared ephemeral state with TTL.

        :param key: The key to store.
        :param value: The value to store, encoded with `options.codec`
            (default "json").
        :param options: `EphemeralSetOptions`, e.g. `ttl=3600`. Required —
            `ttl` must not exceed MAX_TTL from config. `codec="pickle"`
            stores a value that isn't JSON-serializable.
        """
        extension_id = _get_extension_id()
        ExtensionEphemeralDAO.set(
            extension_id, key, value, options.ttl, codec=options.codec, shared=True
        )

    def remove(self, key: str) -> None:
        """
        Remove a value from shared ephemeral state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        ExtensionEphemeralDAO.delete(extension_id, key, shared=True)


class EphemeralState(CoreEphemeralState):
    """
    Host implementation for ephemeral state operations.

    This class provides the concrete implementation that is injected into
    superset_core.extensions.storage.ephemeral.

    By default, all operations are user-scoped (private to the current user).
    Use `shared` to access state that is visible to all users.
    """

    @staticmethod
    def get(key: str) -> Any:
        """
        Get a value from user-scoped ephemeral state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found or expired.
        """
        extension_id = _get_extension_id()
        return ExtensionEphemeralDAO.get(extension_id, key, shared=False)

    @staticmethod
    def set(key: str, value: Any, options: EphemeralSetOptions) -> None:
        """
        Set a value in user-scoped ephemeral state with TTL.

        :param key: The key to store.
        :param value: The value to store, encoded with `options.codec`
            (default "json").
        :param options: `EphemeralSetOptions`, e.g. `ttl=3600`. Required —
            `ttl` must not exceed MAX_TTL from config. `codec="pickle"`
            stores a value that isn't JSON-serializable.
        """
        extension_id = _get_extension_id()
        ExtensionEphemeralDAO.set(
            extension_id, key, value, options.ttl, codec=options.codec, shared=False
        )

    @staticmethod
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped ephemeral state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        ExtensionEphemeralDAO.delete(extension_id, key, shared=False)

    #: Shared (global) ephemeral state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    shared: ClassVar[SharedEphemeralStateAccessor] = SharedEphemeralStateAccessor()
