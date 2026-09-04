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
"""migrate mapbox and deckgl charts to point_cluster_map

Revision ID: ce6bd21901ab
Revises: 4b2a8c9d3e1f
Create Date: 2026-03-02 00:00:00.000000


"""

import copy
import logging
from typing import Any

from alembic import op
from sqlalchemy.orm import Session

from superset import db
from superset.migrations.shared.migrate_viz.base import (
    FORM_DATA_BAK_FIELD_NAME,
    MigrateViz,
    QUERIES_BAK_FIELD_NAME,
    Slice,
)
from superset.migrations.shared.utils import paginated_update, try_load_json
from superset.utils import json

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "ce6bd21901ab"
down_revision = "a1b2c3d4e5f6"

DECKGL_VIZ_TYPES = [
    "deck_arc",
    "deck_contour",
    "deck_geojson",
    "deck_grid",
    "deck_heatmap",
    "deck_hex",
    "deck_multi",
    "deck_path",
    "deck_polygon",
    "deck_scatter",
    "deck_screengrid",
]


class MigrateMapBox(MigrateViz):
    """Migrate the legacy standalone Mapbox scatter chart to point_cluster_map."""

    has_x_axis_control = False
    source_viz_type = "mapbox"
    target_viz_type = "point_cluster_map"
    rename_keys = {
        "mapbox_label": "map_label",
        "mapbox_color": "map_color",
    }
    remove_keys = set()

    def _post_action(self) -> None:
        # If the style URL is a mapbox:// URL, the chart was using Mapbox GL.
        # Set map_renderer so the new chart continues to use the Mapbox renderer,
        # which will pick up MAPBOX_API_KEY from the server config.
        mapbox_style = self.data.get("mapbox_style", "")
        if isinstance(mapbox_style, str) and mapbox_style.startswith("mapbox://"):
            self.data["map_renderer"] = "mapbox"

    @classmethod
    def upgrade_slice(cls, slc: Slice) -> None:
        try:
            clz = cls(slc.params)
            form_data_bak = copy.deepcopy(clz.data)

            clz._pre_action()
            clz._migrate()
            clz._post_action()

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

        except (ValueError, KeyError, TypeError) as e:
            logger.warning("Failed to migrate slice %s: %s", slc.id, e)


def _migrate_deckgl_slice(slc: Slice) -> bool:
    """Set map_renderer='mapbox' for all existing deck.gl slices.

    This ensures full backwards compatibility: existing charts keep using the
    Mapbox renderer. Users can later switch to MapLibre in the chart controls.
    Only new charts will default to MapLibre.

    Returns True if the slice was modified.
    """
    params = try_load_json(slc.params)
    if not params:
        return False

    if "map_renderer" in params:
        return False

    params["map_renderer"] = "mapbox"
    slc.params = json.dumps(params)
    return True


def _downgrade_deckgl_slice(slc: Slice) -> bool:
    """Reverse _migrate_deckgl_slice. Returns True if the slice was modified."""
    params = try_load_json(slc.params)
    if not params or "map_renderer" not in params:
        return False

    params.pop("map_renderer", None)
    slc.params = json.dumps(params)
    return True


def _migrate_deckgl_slices(session: Session, *, upgrade: bool) -> None:
    fn = _migrate_deckgl_slice if upgrade else _downgrade_deckgl_slice
    query = session.query(Slice).filter(Slice.viz_type.in_(DECKGL_VIZ_TYPES))
    for slc in paginated_update(query):
        try:
            fn(slc)
        except (ValueError, KeyError, TypeError) as e:
            logger.warning("Failed to migrate deck.gl slice %s: %s", slc.id, e)
    session.commit()


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateMapBox.upgrade(session)
    _migrate_deckgl_slices(session, upgrade=True)


def downgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateMapBox.downgrade(session)
    _migrate_deckgl_slices(session, upgrade=False)
