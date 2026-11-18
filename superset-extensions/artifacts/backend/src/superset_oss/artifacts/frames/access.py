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
Which version of an artifact a viewer's frame loads.

The artifact's editors may load its draft; everyone else loads only its
published version. Who is an editor is the artifact's widget's to say, and
whether the viewer may see the artifact at all is the caller's to have
checked: through a canvas placement they can read, or its widget.
"""

from __future__ import annotations

from dataclasses import dataclass

from superset_artifacts_sdk.authoring import AuthoringErrorCode
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
    artifact_id: str,
    *,
    can_edit: bool,
    use_draft: bool = False,
) -> ServedVersion:
    """
    The version to serve a viewer of ``artifact_id``.

    - An editor in a draft of the canvas (``use_draft``) gets the draft.
    - Everyone else gets the published version; an editor of an unpublished
      artifact gets the draft, to preview it where it is placed.
    """
    canonical = store.canonical_id(artifact_id)
    if can_edit and use_draft:
        return ServedVersion(canonical, store.draft_version(canonical), True, True)
    if (published := store.published_version(canonical)) is not None:
        return ServedVersion(canonical, published, False, can_edit)
    if can_edit:
        return ServedVersion(canonical, store.draft_version(canonical), True, True)
    raise ArtifactError(
        AuthoringErrorCode.ARTIFACT_NOT_FOUND,
        f"artifact {artifact_id!r} isn't published",
    )
