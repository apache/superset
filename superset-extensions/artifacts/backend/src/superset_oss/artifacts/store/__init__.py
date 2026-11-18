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
The artifact file store and the backend it runs on.

``file_store_for`` picks the backend from the provider's store role
(``ArtifactStoreSource``): the provider's own when it supplies one, otherwise
the default on extension storage. The default runs only where extension
storage can tell which extension calls it, which takes a context the host
sets while a request runs (see ``extension_storage_backend``); without one,
artifacts answer ``NOT_ENABLED``.
"""

from __future__ import annotations

from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_artifacts_sdk.policy import ArtifactPolicy, LOCKED
from superset_artifacts_sdk.provider import ArtifactStoreSource
from superset_artifacts_sdk.store import ArtifactStoreBackend
from superset_oss.artifacts.errors import ArtifactError
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
        raise ArtifactError(
            AuthoringErrorCode.NOT_ENABLED,
            f"the default artifact store can't run yet: {ex}; the runtime "
            "provider must supply a store backend",
        ) from ex


def file_store_for(
    source: ArtifactStoreSource, policy: ArtifactPolicy = LOCKED
) -> ArtifactFileStore:
    """
    The file store on ``source``'s backend, or on the default one without it,
    under ``policy``.
    """
    backend = source.store_backend()
    return ArtifactFileStore(
        default_backend() if backend is None else backend, policy=policy
    )
