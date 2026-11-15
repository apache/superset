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
The artifact a canvas placement shows, read from the stored canvas.

The artifact id and version come from the placement's stored props (or the
caller's own draft of the canvas), never from the request, and the canvas
DAO's access filter applies: a canvas the caller can't read looks the same as
one that doesn't exist.
"""

# TODO(S2): this mirrors GetPlacementDataCommand.validate through host
# internals, which aren't a public API. A public way for an extension's
# renderer to resolve its own placement (SIP-231's data hook) replaces it.

from __future__ import annotations

from dataclasses import dataclass

from superset_oss.artifacts.constants import WIDGET_TYPE


@dataclass(frozen=True)
class PlacementArtifact:
    artifact_id: str
    version: str | None


class PlacementNotFoundError(LookupError):
    """No artifact placement there that the caller can read."""


def placement_artifact(
    canvas_id: str, placement_id: str, draft_token: str | None = None
) -> PlacementArtifact:
    """The artifact that placement ``placement_id`` of a canvas shows."""
    # Host internals, imported here so that importing the extension's pure
    # modules never needs Superset.
    from superset.canvas.definition.registry import get_widget_resolver
    from superset.commands.canvas.draft import load_draft
    from superset.commands.canvas.exceptions import (
        CanvasDraftNotFoundError,
        CanvasForbiddenError,
        CanvasNotFoundError,
    )
    from superset.daos.canvas import CanvasDAO

    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_id))
    if canvas is None:
        raise PlacementNotFoundError(canvas_id)
    resolver = get_widget_resolver()
    if draft_token:
        try:
            draft = load_draft(draft_token)
        except (
            CanvasDraftNotFoundError,
            CanvasForbiddenError,
            CanvasNotFoundError,
        ) as ex:
            raise PlacementNotFoundError(canvas_id) from ex
        if draft.canvas_id != canvas.id:
            raise PlacementNotFoundError(canvas_id)
        definition, resolver = draft.definition, draft.resolver()
    else:
        definition = CanvasDAO.load(canvas)
    node = (definition.get("nodes") or {}).get(placement_id)
    if not isinstance(node, dict):
        raise PlacementNotFoundError(placement_id)
    widget_type, props = node.get("widgetType"), node.get("props") or {}
    if widget_id := node.get("widgetId"):
        widget = resolver.widgets({widget_id}).get(widget_id)
        if widget is None:
            raise PlacementNotFoundError(placement_id)
        widget_type, props = widget.widget_type, widget.props or {}
    artifact_id, version = props.get("artifact_id"), props.get("version")
    if widget_type != WIDGET_TYPE or not isinstance(artifact_id, str):
        raise PlacementNotFoundError(placement_id)
    return PlacementArtifact(
        artifact_id=artifact_id,
        version=version if isinstance(version, str) and version else None,
    )
