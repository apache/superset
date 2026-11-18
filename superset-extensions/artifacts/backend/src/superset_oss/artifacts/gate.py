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
changes nothing. A call also gets the policy in force for it: the
deployment's layer (``ARTIFACTS_POLICY``), narrowed by the provider's layer
for the request, such as its workspace's.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_artifacts_sdk.policy import ArtifactPolicy, resolve_policy
from superset_artifacts_sdk.provider import ArtifactRuntimeProvider
from superset_artifacts_sdk.registry import artifacts_available, get_provider
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store import file_store_for
from superset_oss.artifacts.store.filestore import ArtifactFileStore

NOT_ENABLED_MESSAGE = (
    "Artifacts are off here: no artifact runtime provider is registered."
)

# The deployment's policy layer, as the entry point read it from
# ARTIFACTS_POLICY. None, the default, is Locked.
_deployment_policy: Mapping[str, Any] | None = None


def set_deployment_policy(layer: Mapping[str, Any] | None) -> None:
    """Set the deployment's policy layer, which every call's policy starts from."""
    global _deployment_policy
    _deployment_policy = layer


@dataclass(frozen=True)
class Artifacts:
    """The registered provider, the file store on its backend, and the policy."""

    provider: ArtifactRuntimeProvider
    store: ArtifactFileStore
    policy: ArtifactPolicy


def open_artifacts() -> Artifacts:
    """
    The provider, its file store and the policy in force, while artifacts are on.

    Raises ``ArtifactError`` with ``NOT_ENABLED`` while no provider is
    registered, and while the provider supplies no store backend and the
    default one can't run.
    """
    provider = get_provider() if artifacts_available() else None
    if provider is None:
        raise ArtifactError(AuthoringErrorCode.NOT_ENABLED, NOT_ENABLED_MESSAGE)
    policy = resolve_policy(_deployment_policy, provider.policy_layer())
    return Artifacts(provider, file_store_for(provider, policy), policy)


def artifacts_on() -> bool:
    """Whether ``open_artifacts`` succeeds: whether the tools would work."""
    try:
        open_artifacts()
    except ArtifactError:
        return False
    return True
