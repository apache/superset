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
artifact, the grant, and the parts of the manifest that the frame host checks
the frame's requests against.
"""

from __future__ import annotations

from typing import Any

from superset_core.artifacts.provider import ArtifactRef, FrameLinkMinter, FrameMode
from superset_oss.artifacts.frames.access import ServedVersion
from superset_oss.artifacts.frames.grants import frame_context, host_manifest
from superset_oss.artifacts.store.filestore import ArtifactFileStore


def link_payload(
    minter: FrameLinkMinter,
    store: ArtifactFileStore,
    served: ServedVersion,
    mode: FrameMode,
    host_url: str,
) -> dict[str, Any]:
    """
    Mint a link to ``served`` for a frame in ``mode``, on the page at ``host_url``.

    Raises ``ArtifactError`` when the served version's manifest no longer
    validates.
    """
    manifest = store.manifest_at(served.artifact_id, served.version)
    context = frame_context(mode, manifest, host_url)
    link = minter.mint_frame_link(
        ArtifactRef(served.artifact_id, served.version), context
    )
    return {
        "url": link.url,
        "expires_at": link.expires_at.isoformat(),
        "artifact_id": served.artifact_id,
        "version": served.version,
        "is_draft": served.is_draft,
        "can_edit": served.can_edit,
        "capabilities": sorted(context.capabilities),
        "manifest": host_manifest(manifest),
    }
