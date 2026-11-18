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
The user's confirmation of an agent's request to publish, behind the
confirmation endpoint (``confirm_api``).

Before ``published`` moves, the provider builds the version under the policy
in force. A build checks everything the version is made of (every package it
locked, their sizes and the bundle's), which the manifest alone doesn't name,
so that a version with a package the policy refuses since it was built isn't
published. The build of record comes back at once when nothing changed.
"""

from __future__ import annotations

from superset_artifacts_sdk.provider import ArtifactRef
from superset_oss.artifacts.access import require_edit
from superset_oss.artifacts.errors import (
    ArtifactError,
    ExtensionErrorCode,
    translate_missing_version,
)
from superset_oss.artifacts.gate import Artifacts

# At most this many of a failed build's errors in the refusal's message.
MAX_REASONS = 5


def confirm_publish(
    artifacts: Artifacts, actor: str, artifact_id: str, request_id: str
) -> str:
    """Publish the version of pending request ``request_id``, as ``actor``."""
    require_edit(artifacts.access, artifact_id)
    pending = artifacts.store.pending_publish(artifact_id)
    if pending is not None and pending.request_id == request_id:
        ref = ArtifactRef(artifacts.store.canonical_id(artifact_id), pending.version)
        with translate_missing_version(ref):
            built = artifacts.provider.build(ref, artifacts.policy)
        if not built.ok:
            reasons = [d.message for d in built.diagnostics if d.severity == "error"]
            raise ArtifactError(
                ExtensionErrorCode.PUBLISH_BUILD_FAILED,
                "this version doesn't build under the policy here, so it isn't "
                f"published: {'; '.join(reasons[:MAX_REASONS]) or 'no reason given'}",
            )
    return artifacts.store.confirm_publish(actor, artifact_id, request_id)
