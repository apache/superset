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
placements that the canvas's own endpoints would show them, and asks the
host's ``WidgetResolver`` (``get_widget_resolver``) what else it needs, such
as whether the caller may change the widget (``editable``).

Usage:
    from superset_core.canvas import placements

    widget_id, widget = placements.load_placed_widget(
        canvas_id, placement_id, draft_token
    )
    if widget_id in placements.get_widget_resolver().editable({widget_id}):
        ...
"""

from __future__ import annotations

from superset_core.canvas.base import StoredWidget, WidgetResolver


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
) -> tuple[str, StoredWidget]:
    """
    The saved widget that placement ``placement_id`` of a canvas shows, as
    the canvas stores it or as the caller's draft of the canvas holds it: the
    widget's UUID, and its content as that canvas or draft resolves it.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param canvas_id: The canvas's id or UUID.
    :param placement_id: The placement's node id in the canvas definition.
    :param draft_token: A draft of the canvas to read the placement from. It
        must be the caller's own draft of this canvas, and the caller must
        still be allowed to edit the canvas.
    :returns: The widget's UUID and content.
    :raises PlacementNotFoundError: If the caller can't read the canvas or the
        draft, the canvas has no such placement, or the placement shows no
        saved widget (a container or text stores its own content).
    """
    raise NotImplementedError("Function will be replaced during initialization")


def get_widget_resolver() -> WidgetResolver:
    """
    The host's resolver of saved widgets, as canvases use it: their content
    (``widgets``), and which the current user may change (``editable``).

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.
    """
    raise NotImplementedError("Function will be replaced during initialization")
