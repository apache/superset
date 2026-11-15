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
caller's own draft of the canvas), never from the request. They are read
through ``superset_core``'s placement lookup, which applies the canvas's
access rules: a canvas the caller can't read looks the same as one that
doesn't exist.
"""

from __future__ import annotations

from dataclasses import dataclass

from superset_core.canvas import placements
from superset_oss.artifacts.constants import WIDGET_TYPE


@dataclass(frozen=True)
class PlacementArtifact:
    """The artifact a placement names, and the version it pins, if any."""

    artifact_id: str
    version: str | None


class PlacementNotFoundError(LookupError):
    """No artifact placement there that the caller can read."""


def placement_artifact(
    canvas_id: str, placement_id: str, draft_token: str | None = None
) -> PlacementArtifact:
    """The artifact that placement ``placement_id`` of a canvas shows."""
    try:
        placement = placements.load_placement(canvas_id, placement_id, draft_token)
    except placements.PlacementNotFoundError as ex:
        raise PlacementNotFoundError(placement_id) from ex
    artifact_id = placement.props.get("artifact_id")
    version = placement.props.get("version")
    if placement.widget_type != WIDGET_TYPE or not isinstance(artifact_id, str):
        raise PlacementNotFoundError(placement_id)
    return PlacementArtifact(
        artifact_id=artifact_id,
        version=version if isinstance(version, str) and version else None,
    )
