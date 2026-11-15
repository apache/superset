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
The artifact file store (5.4: E2, E3, E5) and the backend it runs on.

``file_store_for`` picks the backend: the provider's own store when it has
one (P7), otherwise the default on extension storage (DR-19), which refuses
to run until S10 and S11 land, so that artifacts then answer ``NOT_ENABLED``
rather than risk a lost update.
"""

from __future__ import annotations

from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_core.artifacts.provider import ArtifactRuntimeProvider
from superset_core.artifacts.store import ArtifactStoreBackend
from superset_oss.artifacts.constants import DEFAULT_NAMESPACE
from superset_oss.artifacts.store.errors import ArtifactStoreError
from superset_oss.artifacts.store.extension_storage_backend import (
    BackendUnavailableError,
    ExtensionStorageBackend,
)
from superset_oss.artifacts.store.filestore import ArtifactFileStore


def default_backend() -> ArtifactStoreBackend:
    """The backend on extension storage, or ``NOT_ENABLED`` while it can't run."""
    try:
        return ExtensionStorageBackend.from_extension_context()
    except BackendUnavailableError as ex:
        raise ArtifactStoreError(
            AuthoringErrorCode.NOT_ENABLED,
            f"the default artifact store can't run yet: {ex}; the runtime "
            "provider must supply a store backend",
        ) from ex


def file_store_for(provider: ArtifactRuntimeProvider) -> ArtifactFileStore:
    """The file store on ``provider``'s backend, or on the default one."""
    backend = provider.store_backend() or default_backend()
    return ArtifactFileStore(backend, namespace=DEFAULT_NAMESPACE)
