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
from importlib import import_module

from superset.utils import json

migrate_deckgl_and_mapbox = import_module(
    "superset.migrations.versions."
    "2026-03-02_00-00_ce6bd21901ab_migrate_deckgl_and_mapbox",
)

Slice = migrate_deckgl_and_mapbox.Slice
MigrateMapBox = migrate_deckgl_and_mapbox.MigrateMapBox
DECKGL_MAPPINGS = migrate_deckgl_and_mapbox.DECKGL_MAPPINGS
_get_migrate_class = migrate_deckgl_and_mapbox._get_migrate_class


def test_upgrade_mapbox():
    slc = Slice(
        slice_name="Test Mapbox",
        viz_type="mapbox",
        params=json.dumps(
            {
                "viz_type": "mapbox",
                "mapbox_style": "mapbox://styles/mapbox/streets-v11",
                "mapbox_label": ["name"],
                "mapbox_color": "#ff0000",
                "other_param": "value",
            }
        ),
        query_context=json.dumps(
            {
                "form_data": {
                    "viz_type": "mapbox",
                    "mapbox_style": "mapbox://styles/mapbox/streets-v11",
                }
            }
        ),
    )

    MigrateMapBox.upgrade_slice(slc)

    assert slc.viz_type == "maplibre"

    params = json.loads(slc.params)
    assert params["viz_type"] == "maplibre"
    assert params["maplibre_style"] == "https://tiles.openfreemap.org/styles/liberty"
    assert params["maplibre_label"] == ["name"]
    assert params["maplibre_color"] == "#ff0000"
    assert "mapbox_style" not in params
    assert "mapbox_label" not in params
    assert "mapbox_color" not in params
    assert params["other_param"] == "value"

    query_context = json.loads(slc.query_context)
    assert query_context["form_data"]["viz_type"] == "maplibre"
    assert (
        query_context["form_data"]["maplibre_style"]
        == "https://tiles.openfreemap.org/styles/liberty"
    )


def test_upgrade_deckgl():
    for source_viz, target_viz in DECKGL_MAPPINGS.items():
        slc = Slice(
            slice_name=f"Test {source_viz}",
            viz_type=source_viz,
            params=json.dumps(
                {
                    "viz_type": source_viz,
                    "deckgl_param": "value",
                    "mapbox_style": "mapbox://styles/mapbox/dark-v9",
                }
            ),
        )

        migrator_class = _get_migrate_class(source_viz, target_viz)
        migrator_class.upgrade_slice(slc)

        assert slc.viz_type == target_viz

        params = json.loads(slc.params)
        assert params["viz_type"] == target_viz
        assert params["deckgl_param"] == "value"
        # DeckGL migration uses DynamicMigrateViz which does not map Mapbox styles keys
        assert params["mapbox_style"] == "https://tiles.openfreemap.org/styles/dark"
