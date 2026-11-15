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
A canvas placement as stored, read with the canvas's access rules.

An extension endpoint that serves one of its own placements reads it through
``load_placement``, so that the caller reaches only the placements that the
canvas's own endpoints would show them.

Usage:
    from superset_core.canvas import placements

    placement = placements.load_placement(canvas_id, placement_id, draft_token)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class StoredPlacement:
    """A placement's widget type and props, as stored."""

    # ``None`` for a widget entity that no longer resolves.
    widget_type: str | None
    props: dict[str, Any]


class PlacementNotFoundError(LookupError):
    """
    No such placement that the caller may read.

    A missing canvas, draft or placement and one the caller may not read look
    the same, so that the answer doesn't reveal what exists.
    """


def load_placement(
    canvas_id: str,
    placement_id: str,
    draft_token: str | None = None,
) -> StoredPlacement:
    """
    Placement ``placement_id`` of a canvas, as stored, or as the caller's draft
    of the canvas holds it.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param canvas_id: The canvas's id or UUID.
    :param placement_id: The placement's node id in the canvas definition.
    :param draft_token: A draft of the canvas to read the placement from. It
        must be the caller's own draft of this canvas, and the caller must
        still be allowed to edit the canvas.
    :returns: The placement's widget type and props.
    :raises PlacementNotFoundError: If the caller can't read the canvas or the
        draft, or the canvas has no such placement.
    """
    raise NotImplementedError("Function will be replaced during initialization")
