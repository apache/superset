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
Whether artifacts are on here, and what a call needs once they are.

Artifacts are on only while an artifact runtime provider is registered and a
store backend can run. Every MCP tool, prompt and REST endpoint goes through
``open_artifacts``, so that otherwise each one answers ``NOT_ENABLED`` and
changes nothing.
"""

from __future__ import annotations

from dataclasses import dataclass

from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_core.artifacts.provider import (
    ArtifactRuntimeProvider,
    artifacts_available,
    get_provider,
)
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store import file_store_for
from superset_oss.artifacts.store.filestore import ArtifactFileStore

NOT_ENABLED_MESSAGE = (
    "Artifacts are off here: no artifact runtime provider is registered."
)


@dataclass(frozen=True)
class Artifacts:
    """The registered provider, and the file store on its backend."""

    provider: ArtifactRuntimeProvider
    store: ArtifactFileStore


def open_artifacts() -> Artifacts:
    """
    The provider and its file store, while artifacts are on.

    Raises ``ArtifactError`` with ``NOT_ENABLED`` while no provider is
    registered, and while the provider supplies no store backend and the
    default one can't run.
    """
    provider = get_provider() if artifacts_available() else None
    if provider is None:
        raise ArtifactError(AuthoringErrorCode.NOT_ENABLED, NOT_ENABLED_MESSAGE)
    return Artifacts(provider, file_store_for(provider.store_backend()))


def artifacts_on() -> bool:
    """Whether ``open_artifacts`` succeeds: whether the tools would work."""
    try:
        open_artifacts()
    except ArtifactError:
        return False
    return True
