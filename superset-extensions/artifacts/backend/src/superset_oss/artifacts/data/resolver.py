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
An artifact placement's named bindings, from the manifest its frame runs.

The canvas placement data endpoint asks the artifact widget type for a
placement's binding by name (its ``binding_resolver``). The binding comes from
the manifest of the version that the caller's frame loads, picked by the
frame's own rules (``choose_version``): the pinned version, or else the
published one, and the owner's draft while the placement is read from their
own draft of the canvas. The host then runs the binding as it runs any other:
as the caller, with their dataset access.
"""

# TODO: the frame link and the data request each pick the version, so a write
# to the draft between the two can give a draft's frame the bindings of the
# next draft.

from __future__ import annotations

from typing import Any

from superset_core.widgets import BindingRequest
from superset_oss.artifacts.data.bindings import BindingError, resolve_binding
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version
from superset_oss.artifacts.frames.placement import artifact_of
from superset_oss.artifacts.store.filestore import ArtifactFileStore


def placement_binding(
    store: ArtifactFileStore, actor: str | None, request: BindingRequest
) -> dict[str, Any] | None:
    """
    Binding ``request.name`` of the artifact a placement shows, for ``actor``.

    ``None`` when the props name no artifact, when ``actor`` may see no version
    of it, and when the version's manifest declares no binding of that name,
    or one that doesn't map onto placement data. The host answers each as a
    placement without the binding.
    """
    artifact = artifact_of(request.props)
    if artifact is None:
        return None
    try:
        served = choose_version(
            store,
            actor,
            artifact.artifact_id,
            artifact.version,
            # The renderer asks for the draft exactly while the canvas shows a
            # draft, so that the frame and its data come from one version.
            use_draft=request.draft_token is not None,
        )
        manifest = store.manifest_at(served.artifact_id, served.version)
        return resolve_binding(manifest, request.name)
    except (ArtifactError, BindingError):
        return None
