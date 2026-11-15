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
Which version of an artifact a viewer's frame loads (DR-02, DR-12).

Owners may load any version of their artifact and its draft. Everyone else
loads only published versions, and only when the caller has already decided
they may see the artifact (through a canvas placement they can read).
"""

# TODO(5.2): artifact viewers. Until artifacts are persisted widgets with
# viewers, a non-owner reaches an artifact only through a canvas placement.

from __future__ import annotations

from dataclasses import dataclass

from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_core.artifacts.store import PUBLISHED_REF
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store.filestore import ArtifactFileStore


@dataclass(frozen=True)
class ServedVersion:
    """The version a frame loads, and whether its viewer may edit the artifact."""

    artifact_id: str
    version: str
    is_draft: bool
    can_edit: bool


def choose_version(
    store: ArtifactFileStore,
    actor: str | None,
    artifact_id: str,
    pinned: str | None = None,
    *,
    use_draft: bool = False,
) -> ServedVersion:
    """
    The version to serve ``actor`` for an artifact, pinned or not.

    - An owner who asks for the draft gets it.
    - A pinned version is served to owners if it is one of the artifact's
      versions, and to anyone else if it has been published.
    - Otherwise the published version; an owner of an unpublished artifact
      gets the draft, so that they can preview it where it is placed.
    """
    canonical = store.canonical_id(artifact_id)
    owner = actor if actor and store.is_owner(actor, canonical) else None
    can_edit = owner is not None
    if owner is not None and use_draft:
        return ServedVersion(
            canonical, store.draft_version(owner, canonical), True, can_edit
        )
    if pinned is not None:
        if (can_edit and store.has_version(canonical, pinned)) or store.has_version(
            canonical, pinned, ref=PUBLISHED_REF
        ):
            return ServedVersion(canonical, pinned, False, can_edit)
        raise ArtifactError(
            AuthoringErrorCode.VERSION_NOT_FOUND,
            f"{pinned} isn't a published version of this artifact",
        )
    if (published := store.published_version(canonical)) is not None:
        return ServedVersion(canonical, published, False, can_edit)
    if owner is not None:
        return ServedVersion(
            canonical, store.draft_version(owner, canonical), True, can_edit
        )
    raise ArtifactError(
        AuthoringErrorCode.ARTIFACT_NOT_FOUND,
        f"artifact {artifact_id!r} isn't published",
    )
