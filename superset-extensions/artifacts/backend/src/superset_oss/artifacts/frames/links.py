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
A frame link for the version a viewer is served, and what comes with it.

The canvas and the standalone page answer the same shape: the provider's
short-lived link, the version it loads, whether the viewer may edit the
artifact, the grant, the limits the frame host holds the frame's requests to,
and the parts of the manifest that it checks them against.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_artifacts_sdk.policy import ArtifactPolicy, FrameMode, surface_allowed
from superset_artifacts_sdk.provider import ArtifactRef, FrameLinkMinter
from superset_oss.artifacts.errors import ArtifactError, translate_missing_version
from superset_oss.artifacts.frames.access import ServedVersion
from superset_oss.artifacts.frames.grants import frame_context, host_manifest
from superset_oss.artifacts.store.filestore import ArtifactFileStore


class FrameLinkRequest(BaseModel):
    """Which artifact a frame link is for, and where; the server reads the rest."""

    model_config = ConfigDict(extra="forbid")

    widget_id: UUID
    # The placement that shows it on a canvas; without one, a page of its own.
    # The server decides the surface: no request names one.
    canvas_id: str | int | None = None
    placement_id: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _a_whole_placement(self) -> FrameLinkRequest:
        if (self.canvas_id is None) != (self.placement_id is None):
            raise ValueError("canvas_id and placement_id name a placement together")
        return self


def link_payload(  # noqa: PLR0913
    minter: FrameLinkMinter,
    store: ArtifactFileStore,
    served: ServedVersion,
    mode: FrameMode,
    host_url: str,
    policy: ArtifactPolicy,
    *,
    guest: bool = False,
) -> dict[str, Any]:
    """
    Mint a link to ``served`` for a frame in ``mode``, on the page at ``host_url``.

    Raises ``ArtifactError`` when ``policy`` keeps artifacts off this
    surface, or away from a ``guest`` (``POLICY_DENIED``), when the served
    version's manifest no longer validates (``INVALID_MANIFEST``), and when
    the provider no longer holds the version (``VERSION_NOT_FOUND``), as
    after a publish that lands between reading the version and minting the
    link.
    """
    if not surface_allowed(policy, mode):
        raise ArtifactError(
            AuthoringErrorCode.POLICY_DENIED,
            f"the {policy.profile.value} policy here shows no artifact on a "
            f"{mode} page",
        )
    if guest and policy.surfaces.guest == "off":
        raise ArtifactError(
            AuthoringErrorCode.POLICY_DENIED,
            f"the {policy.profile.value} policy here shows no artifact to "
            "guests (surfaces.guest)",
        )
    manifest = store.manifest_at(served.artifact_id, served.version)
    context = frame_context(mode, manifest, policy, host_url)
    ref = ArtifactRef(served.artifact_id, served.version)
    with translate_missing_version(ref):
        link = minter.mint_frame_link(ref, context)
    return {
        "url": link.url,
        "expires_at": link.expires_at.isoformat(),
        "artifact_id": served.artifact_id,
        "version": served.version,
        "is_draft": served.is_draft,
        "can_edit": served.can_edit,
        "capabilities": sorted(context.capabilities),
        # The frame host's names for them (the SDK's ``BridgeLimits``).
        "limits": {"queries": policy.data.max_queries},
        "manifest": host_manifest(manifest),
    }
