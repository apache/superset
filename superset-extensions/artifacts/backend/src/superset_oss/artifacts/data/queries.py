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
An artifact's queries: the named bindings of the manifest its frame runs.

The host asks the artifact widget type for a widget's queries (its
``build_queries``), for a placement or for the saved widget itself; the
artifact is that widget. They come from the manifest of the version that the
caller's frame loads, picked by the frame's own rules (``choose_version``):
the published version, and the draft for its editors while the placement is
read from their draft of the canvas. The policy in force must admit each
binding, checked on every data request, so that a tighter policy reaches a
published artifact at its next one. The host then runs each binding as it runs
any other: as the caller, with their dataset access, and answers each as the
dataset of the binding's name.
"""

# TODO: the frame link and the data request each pick the version, so a write
# to the draft between the two can give a draft's frame the bindings of the
# next draft.
# TODO: snapshots, which the server mints with the author's access; until
# then a snapshot binding has no data.

from __future__ import annotations

from superset_artifacts_sdk.policy import ArtifactPolicy, binding_problems
from superset_core.widgets import QueryRequest, WidgetQuery
from superset_oss.artifacts.access import ArtifactAccess
from superset_oss.artifacts.data.bindings import BindingError, resolve_binding
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version
from superset_oss.artifacts.store.filestore import ArtifactFileStore

# What the host runs a binding without a row limit with (superset.canvas.data),
# which the policy's max_rows must cap as well.
HOST_ROW_LIMIT = 1_000


def artifact_queries(
    store: ArtifactFileStore,
    policy: ArtifactPolicy,
    access: ArtifactAccess,
    request: QueryRequest,
    *,
    guest: bool = False,
) -> list[WidgetQuery]:
    """
    A query for each binding of the artifact that ``request.widget_id`` is.

    None when there is no widget, or when the caller may see no version of the
    artifact; the host answers that as a widget without data. A binding that
    doesn't map onto the host's data request, that isn't ``live`` or that
    ``policy`` refuses has no query, so no dataset, and the renderer fails the
    frame's data for want of it. Every binding carries its row limit, capped
    by the policy's ``data.max_rows``: one declared without any gets the
    host's default, so capped too. A ``guest`` gets live rows only where
    ``surfaces.guest`` is ``live``: what ``snapshot`` allows, snapshots,
    aren't served yet.
    """
    if request.widget_id is None or (guest and policy.surfaces.guest != "live"):
        return []
    try:
        served = choose_version(
            store,
            request.widget_id,
            can_edit=access.can_edit(request.widget_id),
            use_draft=request.draft_token is not None,
        )
        manifest = store.manifest_at(served.artifact_id, served.version)
    except ArtifactError:
        return []
    queries = []
    for name, declared in manifest.bindings.items():
        if declared.mode != "live" or binding_problems(name, declared, policy):
            continue
        try:
            binding = resolve_binding(manifest, name)
        except BindingError:
            continue
        binding["rowLimit"] = min(
            declared.row_limit or HOST_ROW_LIMIT, policy.data.max_rows
        )
        queries.append(WidgetQuery(name, binding))
    return queries
