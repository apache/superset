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

"""Host implementation of backend-only extension secrets storage."""

from __future__ import annotations

from typing import Any

from superset_core.extensions.storage.models import StorageAccess
from superset_core.extensions.storage.secrets import SecretsState as CoreSecretsState

from superset.extensions.storage.codecs import DEFAULT_CODEC, get_codec
from superset.extensions.storage.persistent_dao import ExtensionStorageDAO
from superset.extensions.storage.utils import (
    get_current_extension_id,
    get_current_user_id,
)
from superset.utils.decorators import transaction


class SecretsState(CoreSecretsState):
    """Encrypted persistent secrets scoped to the current extension and user."""

    @staticmethod
    def get(key: str) -> Any:
        """Return the current user's decoded secret, or ``None`` when absent."""
        extension_id = get_current_extension_id("secrets_state")
        user_id = get_current_user_id("secrets_state")
        return ExtensionStorageDAO.get_decoded_value(
            extension_id,
            key,
            user_fk=user_id,
            access=StorageAccess.BACKEND,
        )

    @staticmethod
    @transaction()
    def set(key: str, value: Any) -> None:
        """Store a JSON-encoded secret encrypted at rest."""
        extension_id = get_current_extension_id("secrets_state")
        user_id = get_current_user_id("secrets_state")
        ExtensionStorageDAO.set(
            extension_id,
            key,
            get_codec(DEFAULT_CODEC).encode(value),
            codec=DEFAULT_CODEC,
            user_fk=user_id,
            encrypt=True,
            access=StorageAccess.BACKEND,
        )

    @staticmethod
    @transaction()
    def remove(key: str) -> None:
        """Remove the current user's secret."""
        extension_id = get_current_extension_id("secrets_state")
        user_id = get_current_user_id("secrets_state")
        ExtensionStorageDAO.delete_by_key(
            extension_id,
            key,
            user_fk=user_id,
            access=StorageAccess.BACKEND,
        )
