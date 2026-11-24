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
The widgets canvases place, read with the canvases' own access rules.

An extension endpoint that serves its widget on a canvas reads the placement
through ``load_placed_widget``, so that the caller reaches only the
placements the canvas's own endpoints would show them, and asks
``editable_widgets`` which of its widgets the caller may change. Nothing here
reads a widget the caller can't: reading a saved widget on its own goes
through ``superset_core.widgets.daos.WidgetDAO``, whose access filter applies.

Usage:
    from superset_core.canvas import placements

    widget_id, widget = placements.load_placed_widget(
        canvas_id, placement_id, draft_token, version=previewed_version
    )
    if widget_id in placements.editable_widgets({widget_id}):
        ...
"""

from __future__ import annotations

from collections.abc import Iterable

from superset_core.canvas.base import StoredWidget


class PlacementNotFoundError(LookupError):
    """
    No such placement that the caller may read.

    A missing canvas, draft or placement and one the caller may not read look
    the same, so that the answer doesn't reveal what exists.
    """


def load_placed_widget(
    canvas_id: str,
    placement_id: str,
    draft_token: str | None = None,
    *,
    version: str | None = None,
) -> tuple[str, StoredWidget]:
    """
    The saved widget that placement ``placement_id`` of a canvas shows, as
    the canvas stores it, as the caller's draft of the canvas holds it, or as
    a saved version of the canvas placed it: the widget's UUID, and its content
    as that canvas, draft or version resolves it. The canvas grants read access
    to the widgets it places, as a dashboard does to its charts, so a caller
    who may read the canvas gets the widget.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param canvas_id: The canvas's id or UUID.
    :param placement_id: The placement's node id in the canvas definition.
    :param draft_token: A draft of the canvas to read the placement from. It
        must be the caller's own draft of this canvas, and the caller must
        still be allowed to edit the canvas.
    :param version: The UUID of a saved version of the canvas to read the
        placement from, as the canvas page names the version it previews
        (``X-Canvas-Version``). Like the rest of a canvas's history, only its
        editors can read one. A draft, when given too, wins.
    :returns: The widget's UUID and content.
    :raises PlacementNotFoundError: If the caller can't read the canvas, the
        draft or the version, the canvas has no such placement, or the
        placement shows no saved widget (a container or text stores its own
        content).
    """
    raise NotImplementedError("Function will be replaced during initialization")


def editable_widgets(widget_ids: Iterable[str]) -> set[str]:
    """
    Those of the saved widgets ``widget_ids`` (UUIDs) that the current user
    may change, as canvases decide it: an admin, or an editor of the widget,
    through their roles and groups too. Ids that name no widget are left out.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.
    """
    raise NotImplementedError("Function will be replaced during initialization")
