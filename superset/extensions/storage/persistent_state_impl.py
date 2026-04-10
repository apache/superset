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
Host implementation for Persistent State (Tier 3 Storage).

Provides the concrete database-backed implementation that is injected into
superset_core.extensions.storage.persistent_state at startup.
"""

from __future__ import annotations

from typing import Any

from flask import g

from superset.extensions.context import get_current_extension_context
from superset.extensions.storage.persistent_state_dao import ExtensionStorageDAO
from superset.utils import json
from superset.utils.decorators import transaction


def _get_extension_id() -> str:
    """Get the current extension ID from context."""
    context = get_current_extension_context()
    if context is None:
        raise RuntimeError(
            "persistent_state can only be used within an extension context. "
            "Ensure this code is being executed during extension loading or "
            "within an extension API request handler."
        )
    return context.manifest.id


def _get_current_user_id() -> int:
    """Get the current authenticated user's ID."""
    user = getattr(g, "user", None)
    if user is None or not hasattr(user, "id"):
        raise RuntimeError(
            "persistent_state requires an authenticated user. "
            "Ensure the request has been authenticated."
        )
    return user.id


def _decode(raw: bytes | None) -> Any:
    """Decode stored bytes back to a Python value."""
    if raw is None:
        return None
    return json.loads(raw)


def _encode(value: Any) -> bytes:
    """Encode a Python value for database storage."""
    return json.dumps(value).encode()


class SharedPersistentStateAccessor:
    """
    Accessor for shared (global) persistent state.

    Data stored via this accessor is visible to all users of the extension.
    Extension ID is resolved lazily on each operation from the current context.
    """

    def get(self, key: str) -> Any:
        """
        Get a value from shared persistent state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found.
        """
        extension_id = _get_extension_id()
        raw = ExtensionStorageDAO.get_value(extension_id, key, user_fk=None)
        return _decode(raw)

    @transaction()
    def set(self, key: str, value: Any) -> None:
        """
        Set a value in shared persistent state.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        """
        extension_id = _get_extension_id()
        ExtensionStorageDAO.set(extension_id, key, _encode(value), user_fk=None)

    @transaction()
    def remove(self, key: str) -> None:
        """
        Remove a value from shared persistent state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        ExtensionStorageDAO.delete(extension_id, key, user_fk=None)


class PersistentStateImpl:
    """
    Host implementation for persistent state operations.

    This class provides the concrete implementation that is injected into
    superset_core.extensions.storage.persistent_state.

    By default, all operations are user-scoped (private to the current user).
    Use `shared` to access state that is visible to all users.
    """

    @staticmethod
    def get(key: str) -> Any:
        """
        Get a value from user-scoped persistent state.

        :param key: The key to retrieve.
        :returns: The stored value, or None if not found.
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        raw = ExtensionStorageDAO.get_value(extension_id, key, user_fk=user_id)
        return _decode(raw)

    @staticmethod
    @transaction()
    def set(key: str, value: Any) -> None:
        """
        Set a value in user-scoped persistent state.

        :param key: The key to store.
        :param value: The value to store (must be JSON-serializable).
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        ExtensionStorageDAO.set(extension_id, key, _encode(value), user_fk=user_id)

    @staticmethod
    @transaction()
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped persistent state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        user_id = _get_current_user_id()
        ExtensionStorageDAO.delete(extension_id, key, user_fk=user_id)

    #: Shared (global) persistent state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    shared: SharedPersistentStateAccessor = SharedPersistentStateAccessor()
