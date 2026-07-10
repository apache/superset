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
superset_core.extensions.storage.persistent at startup.
"""

from __future__ import annotations

from typing import Any, ClassVar

from superset_core.extensions.storage.persistent import (
    PersistentListEntry,
    PersistentListOptions,
    PersistentListResult,
    PersistentSetOptions,
    PersistentState as CorePersistentState,
)

from superset.extensions.storage.codecs import DEFAULT_CODEC, get_codec
from superset.extensions.storage.persistent_dao import ExtensionStorageDAO
from superset.extensions.storage.utils import (
    get_current_extension_id,
    get_current_user_id,
)
from superset.utils.decorators import transaction


def _get_extension_id() -> str:
    """Get the current extension ID from context."""
    return get_current_extension_id("persistent_state")


def _list(
    extension_id: str,
    user_fk: int | None,
    options: PersistentListOptions | None,
) -> PersistentListResult:
    """Shared `list` implementation for both scopes.

    Unlike the REST API, ambient backend code has no SAFE_CODECS
    restriction — every entry's value is decoded unconditionally, same as
    `get_decoded_value()`.
    """
    options = options or PersistentListOptions()
    entries, count = ExtensionStorageDAO.list_entries(
        extension_id,
        user_fk=user_fk,
        resource_type=options.resource_type,
        resource_uuid=options.resource_uuid,
        page=options.page,
        page_size=options.page_size,
    )
    return PersistentListResult(
        entries=[
            PersistentListEntry(
                key=entry.key,
                value=(
                    get_codec(entry.codec).decode(entry.value)
                    if entry.value is not None
                    else None
                ),
                codec=entry.codec,
            )
            for entry in entries
        ],
        count=count,
    )


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
        return ExtensionStorageDAO.get_decoded_value(extension_id, key, user_fk=None)

    @transaction()
    def set(
        self, key: str, value: Any, options: PersistentSetOptions | None = None
    ) -> None:
        """
        Set a value in shared persistent state.

        :param key: The key to store.
        :param value: The value to store, encoded with `options.codec`
            (default "json").
        :param options: Optional `PersistentSetOptions`, e.g. `encrypt=True`
            to store the value encrypted at rest, or `codec="pickle"` to
            store a value that isn't JSON-serializable.
        :raises ExtensionStorageValueTooLarge: if the encoded value exceeds
            MAX_VALUE_SIZE.
        :raises ExtensionStorageQuotaExceeded: if this write would exceed the
            extension's configured persistent storage quota.
        """
        extension_id = _get_extension_id()
        encrypt = options.encrypt if options is not None else False
        codec = options.codec if options is not None else DEFAULT_CODEC
        ExtensionStorageDAO.set(
            extension_id,
            key,
            get_codec(codec).encode(value),
            codec=codec,
            user_fk=None,
            encrypt=encrypt,
        )

    def list(
        self, options: PersistentListOptions | None = None
    ) -> PersistentListResult:
        """
        List entries in shared persistent state.

        :param options: Optional `PersistentListOptions`, e.g.
            `page`/`page_size` to paginate.
        :returns: `PersistentListResult` with the page's entries and the
            total count across all pages.
        :raises ExtensionStorageListPayloadTooLarge: if the requested
            page's combined value size exceeds MAX_LIST_PAYLOAD_SIZE.
        """
        extension_id = _get_extension_id()
        return _list(extension_id, user_fk=None, options=options)

    @transaction()
    def remove(self, key: str) -> None:
        """
        Remove a value from shared persistent state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        ExtensionStorageDAO.delete_by_key(extension_id, key, user_fk=None)


class PersistentState(CorePersistentState):
    """
    Host implementation for persistent state operations.

    This class provides the concrete implementation that is injected into
    superset_core.extensions.storage.persistent.

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
        user_id = get_current_user_id("persistent_state")
        return ExtensionStorageDAO.get_decoded_value(extension_id, key, user_fk=user_id)

    @staticmethod
    @transaction()
    def set(key: str, value: Any, options: PersistentSetOptions | None = None) -> None:
        """
        Set a value in user-scoped persistent state.

        :param key: The key to store.
        :param value: The value to store, encoded with `options.codec`
            (default "json").
        :param options: Optional `PersistentSetOptions`, e.g. `encrypt=True`
            to store the value encrypted at rest, or `codec="pickle"` to
            store a value that isn't JSON-serializable.
        :raises ExtensionStorageValueTooLarge: if the encoded value exceeds
            MAX_VALUE_SIZE.
        :raises ExtensionStorageQuotaExceeded: if this write would exceed the
            extension's configured persistent storage quota.
        """
        extension_id = _get_extension_id()
        user_id = get_current_user_id("persistent_state")
        encrypt = options.encrypt if options is not None else False
        codec = options.codec if options is not None else DEFAULT_CODEC
        ExtensionStorageDAO.set(
            extension_id,
            key,
            get_codec(codec).encode(value),
            codec=codec,
            user_fk=user_id,
            encrypt=encrypt,
        )

    @staticmethod
    def list(options: PersistentListOptions | None = None) -> PersistentListResult:
        """
        List entries in user-scoped persistent state.

        :param options: Optional `PersistentListOptions`, e.g.
            `page`/`page_size` to paginate.
        :returns: `PersistentListResult` with the page's entries and the
            total count across all pages.
        :raises ExtensionStorageListPayloadTooLarge: if the requested
            page's combined value size exceeds MAX_LIST_PAYLOAD_SIZE.
        """
        extension_id = _get_extension_id()
        user_id = get_current_user_id("persistent_state")
        return _list(extension_id, user_fk=user_id, options=options)

    @staticmethod
    @transaction()
    def remove(key: str) -> None:
        """
        Remove a value from user-scoped persistent state.

        :param key: The key to remove.
        """
        extension_id = _get_extension_id()
        user_id = get_current_user_id("persistent_state")
        ExtensionStorageDAO.delete_by_key(extension_id, key, user_fk=user_id)

    #: Shared (global) persistent state accessor.
    #: Data stored via this accessor is visible to all users of the extension.
    #: WARNING: Do not store user-specific or sensitive data here.
    shared: ClassVar[SharedPersistentStateAccessor] = SharedPersistentStateAccessor()
