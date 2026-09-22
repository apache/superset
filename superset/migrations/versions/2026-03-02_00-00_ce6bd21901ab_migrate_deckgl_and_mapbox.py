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
Revises: a1b2c3d4e5f6
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
DECKGL_MIGRATION_ADDED_FIELDS = "__deckgl_maplibre_migration_added_fields"


def _is_mapbox_style(style: Any) -> bool:
    return isinstance(style, str) and style.startswith("mapbox://")


def _copy_legacy_maplibre_style(
    data: dict[str, Any], added_fields: list[str] | None = None
) -> bool:
    mapbox_style = data.get("mapbox_style")
    if (
        isinstance(mapbox_style, str)
        and not _is_mapbox_style(mapbox_style)
        and "maplibre_style" not in data
    ):
        data["maplibre_style"] = mapbox_style
        if added_fields is not None:
            added_fields.append("maplibre_style")
        if "map_renderer" not in data:
            data["map_renderer"] = "maplibre"
            if added_fields is not None:
                added_fields.append("map_renderer")
        return True
    return False


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
        if _is_mapbox_style(mapbox_style):
            self.data["map_renderer"] = "mapbox"
        else:
            _copy_legacy_maplibre_style(self.data)

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
    """Preserve deck.gl renderer/style state after the MapLibre migration.

    True Mapbox styles get map_renderer='mapbox'. Non-Mapbox legacy
    mapbox_style values are copied to maplibre_style so the MapLibre path keeps
    rendering the saved style value.

    Returns True if the slice was modified.
    """
    params = try_load_json(slc.params)
    if not isinstance(params, dict) or not params:
        return False

    modified = False
    added_fields: list[str] = []

    mapbox_style = params.get("mapbox_style", "")
    if _is_mapbox_style(mapbox_style):
        if "map_renderer" not in params:
            params["map_renderer"] = "mapbox"
            added_fields.append("map_renderer")
            modified = True
    else:
        modified = _copy_legacy_maplibre_style(params, added_fields)

    if not modified:
        return False
    params[DECKGL_MIGRATION_ADDED_FIELDS] = added_fields
    slc.params = json.dumps(params)
    return True


def _downgrade_deckgl_slice(slc: Slice) -> bool:
    """Reverse _migrate_deckgl_slice. Returns True if the slice was modified."""
    params = try_load_json(slc.params)
    if not isinstance(params, dict) or not params:
        return False

    added_fields = params.get(DECKGL_MIGRATION_ADDED_FIELDS)
    if not isinstance(added_fields, list):
        return False

    for field in added_fields:
        if field in {"map_renderer", "maplibre_style"} and field in params:
            params.pop(field, None)

    params.pop(DECKGL_MIGRATION_ADDED_FIELDS, None)
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
