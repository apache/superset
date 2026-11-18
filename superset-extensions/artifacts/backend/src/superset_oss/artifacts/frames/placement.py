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

A placement shows an artifact by holding its saved widget, whose UUID is the
artifact's id. It is read through ``superset_core``'s placement lookup, which
applies the canvas's access rules: a canvas the caller can't read looks the
same as one that doesn't exist.
"""

from __future__ import annotations

from superset_core.canvas import placements
from superset_oss.artifacts.constants import WIDGET_TYPE


class PlacementNotFoundError(LookupError):
    """No artifact placement there that the caller can read."""


def placement_artifact(
    canvas_id: str, placement_id: str, draft_token: str | None = None
) -> str:
    """The artifact, by its widget's UUID, that placement ``placement_id`` shows."""
    try:
        placement = placements.load_placement(canvas_id, placement_id, draft_token)
    except placements.PlacementNotFoundError as ex:
        raise PlacementNotFoundError(placement_id) from ex
    if placement.widget_type != WIDGET_TYPE or placement.widget_id is None:
        raise PlacementNotFoundError(placement_id)
    return placement.widget_id
