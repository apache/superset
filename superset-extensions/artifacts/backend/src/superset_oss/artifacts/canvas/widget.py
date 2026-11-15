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
The ``artifact`` widget type: an artifact's sandboxed code, placed on a canvas.

Imported inside the extension's context, so the host registers it as
``extensions.superset-oss.artifacts.artifact``; the frontend renderer
registers under that full id.
"""

# TODO: CANVAS_DISABLED_WIDGET_TYPES keeps this type out of the type lists and
# refuses adding it, but placements that hold it still render.
# TODO: core has no hook for a widget to check its props when a placement is
# written, so nothing checks that its author may read the artifact it names;
# viewers then see the artifact's published versions through the placement.
# TODO: a render-complete signal, a fallback the manifest declares for when
# the code can't run, a cross-filter handshake, and host chrome for "view
# query" and export.

from __future__ import annotations

from superset_core.widgets import Widget, widget, WidgetBehavior, WidgetUi
from superset_oss.artifacts.canvas.controls import ArtifactControls
from superset_oss.artifacts.constants import WIDGET_TYPE_NAME


@widget(
    widget_type=WIDGET_TYPE_NAME,
    name="Artifact",
    description=(
        "A small app an agent wrote: HTML, CSS and JavaScript or React, run in "
        "a sandboxed frame with no network and no login. It reads Superset "
        "data only through the named bindings its manifest declares, run as "
        "the viewer, and can set cross-filters it declares. Use it when no "
        "chart or other widget type fits. Write the artifact with the artifact "
        "authoring tools first; the props only name it."
    ),
)
class Artifact(Widget):
    controls_class = ArtifactControls
    behavior = WidgetBehavior(filterable=True, emits_filters=True)
    ui = WidgetUi(default_size=(12, 8))
