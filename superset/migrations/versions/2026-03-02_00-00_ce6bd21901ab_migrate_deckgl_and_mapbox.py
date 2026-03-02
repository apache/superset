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
"""migrate deckgl and mapbox to maplibre

Revision ID: ce6bd21901ab
Revises: 4b2a8c9d3e1f
Create Date: 2026-03-02 00:00:00.000000

"""

import copy
import logging
import re
from typing import Any

from alembic import op

from superset import db
from superset.migrations.shared.migrate_viz.base import (
    FORM_DATA_BAK_FIELD_NAME,
    MigrateViz,
    QUERIES_BAK_FIELD_NAME,
    Slice,
)
from superset.migrations.shared.utils import try_load_json
from superset.utils import json

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "ce6bd21901ab"
down_revision = "4b2a8c9d3e1f"


class PassThroughMigrateViz(MigrateViz):
    has_x_axis_control = False

    def _pre_action(self) -> None:
        style = self.data.get("mapbox_style")
        if isinstance(style, str):
            if re.match(r"^mapbox://styles/mapbox/dark-v\d+$", style):
                self.data["mapbox_style"] = "https://tiles.openfreemap.org/styles/dark"
            elif re.match(r"^mapbox://styles/mapbox/streets-v\d+$", style):
                self.data["mapbox_style"] = (
                    "https://tiles.openfreemap.org/styles/liberty"
                )

    @classmethod
    def upgrade_slice(cls, slc: Slice) -> None:
        try:
            clz = cls(slc.params)
            form_data_bak = copy.deepcopy(clz.data)

            clz._pre_action()
            clz._migrate()
            clz._post_action()

            # viz_type depends on the migration and should be set after its execution
            # because a source viz can be mapped to different target viz types
            slc.viz_type = clz.target_viz_type

            backup: Any | dict[str, Any] = {FORM_DATA_BAK_FIELD_NAME: form_data_bak}

            query_context = try_load_json(slc.query_context)
            queries_bak = None

            if query_context:
                if "form_data" in query_context:
                    query_context["form_data"] = clz.data
                queries_bak = copy.deepcopy(query_context.get("queries"))
            else:
                query_context = {}

            slc.query_context = json.dumps(query_context)
            if queries_bak is not None:
                backup[QUERIES_BAK_FIELD_NAME] = queries_bak

            slc.params = json.dumps({**clz.data, **backup})

        except Exception as e:
            logger.warning("Failed to migrate slice %s: %s", slc.id, e)


class MigrateMapBox(PassThroughMigrateViz):
    source_viz_type = "mapbox"
    target_viz_type = "maplibre"
    rename_keys = {
        "mapbox_style": "maplibre_style",
        "mapbox_label": "maplibre_label",
        "mapbox_color": "maplibre_color",
    }
    remove_keys = set()


DECKGL_MAPPINGS = {
    "deck_arc": "deck_arc_maplibre",
    "deck_geojson": "deck_geojson_maplibre",
    "deck_grid": "deck_grid_maplibre",
    "deck_hex": "deck_hex_maplibre",
    "deck_heatmap": "deck_heatmap_maplibre",
    "deck_multi": "deck_multi_maplibre",
    "deck_path": "deck_path_maplibre",
    "deck_polygon": "deck_polygon_maplibre",
    "deck_scatter": "deck_scatter_maplibre",
    "deck_screengrid": "deck_screengrid_maplibre",
    "deck_contour": "deck_contour_maplibre",
}


def _get_migrate_class(source: str, target: str) -> type[MigrateViz]:
    class DynamicMigrateViz(PassThroughMigrateViz):
        source_viz_type = source
        target_viz_type = target
        rename_keys = {}
        remove_keys = set()

    return DynamicMigrateViz


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for old_viz, new_viz in DECKGL_MAPPINGS.items():
        cls = _get_migrate_class(old_viz, new_viz)
        cls.upgrade(session)

    MigrateMapBox.upgrade(session)


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for old_viz, new_viz in DECKGL_MAPPINGS.items():
        cls = _get_migrate_class(old_viz, new_viz)
        cls.downgrade(session)

    MigrateMapBox.downgrade(session)
