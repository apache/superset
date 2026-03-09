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
"""migrate mapbox chart to maplibre

Revision ID: ce6bd21901ab
Revises: 4b2a8c9d3e1f
Create Date: 2026-03-02 00:00:00.000000

"""

import copy
import logging
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


class MigrateMapBox(MigrateViz):
    """Migrate the legacy standalone Mapbox chart to the new MapLibre chart plugin.

    Existing deck.gl charts (deck_arc, deck_scatter, etc.) are left untouched —
    backward compatibility is handled in the frontend by reading the legacy
    mapbox_style field and inferring the map provider from the style URL.
    """

    has_x_axis_control = False
    source_viz_type = "mapbox"
    target_viz_type = "map_gl"
    rename_keys = {
        "mapbox_style": "map_style",
        "mapbox_label": "map_label",
        "mapbox_color": "map_color",
    }
    remove_keys = set()

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

        except Exception as e:
            logger.warning("Failed to migrate slice %s: %s", slc.id, e)


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateMapBox.upgrade(session)


def downgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateMapBox.downgrade(session)
