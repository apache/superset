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

import pytest

from superset.utils import json

migrate_deckgl_and_mapbox = import_module(
    "superset.migrations.versions."
    "2026-03-02_00-00_ce6bd21901ab_migrate_deckgl_and_mapbox",
)

Slice = migrate_deckgl_and_mapbox.Slice
MigrateMapBox = migrate_deckgl_and_mapbox.MigrateMapBox
_migrate_deckgl_slice = migrate_deckgl_and_mapbox._migrate_deckgl_slice
_downgrade_deckgl_slice = migrate_deckgl_and_mapbox._downgrade_deckgl_slice


@pytest.mark.usefixtures("app_context")
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

    assert slc.viz_type == "point_cluster_map"

    params = json.loads(slc.params)
    assert params["viz_type"] == "point_cluster_map"
    assert params["mapbox_style"] == "mapbox://styles/mapbox/streets-v11"
    assert params["map_renderer"] == "mapbox"
    assert params["map_label"] == ["name"]
    assert params["map_color"] == "#ff0000"
    assert "mapbox_label" not in params
    assert "mapbox_color" not in params
    assert params["other_param"] == "value"

    query_context = json.loads(slc.query_context)
    assert query_context["form_data"]["viz_type"] == "point_cluster_map"
    assert (
        query_context["form_data"]["mapbox_style"]
        == "mapbox://styles/mapbox/streets-v11"
    )


@pytest.mark.usefixtures("app_context")
def test_upgrade_mapbox_with_non_mapbox_style():
    """Charts with non-mapbox:// style URLs should not get map_provider=mapbox."""
    slc = Slice(
        slice_name="Test Mapbox Open Style",
        viz_type="mapbox",
        params=json.dumps(
            {
                "viz_type": "mapbox",
                "mapbox_style": "https://tiles.openfreemap.org/styles/liberty",
                "other_param": "value",
            }
        ),
        query_context=json.dumps({}),
    )

    MigrateMapBox.upgrade_slice(slc)

    assert slc.viz_type == "point_cluster_map"
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "https://tiles.openfreemap.org/styles/liberty"
    assert "map_renderer" not in params


def test_migrate_deckgl_slice_mapbox_style():
    slc = Slice(
        slice_name="Test Arc",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "mapbox://styles/mapbox/dark-v9",
                "other_param": "value",
            }
        ),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "mapbox://styles/mapbox/dark-v9"
    assert params["map_renderer"] == "mapbox"
    assert params["viz_type"] == "deck_arc"  # viz_type unchanged
    assert params["other_param"] == "value"


def test_migrate_deckgl_slice_open_style():
    """All existing deck_* charts get map_renderer='mapbox' for backwards compat."""
    slc = Slice(
        slice_name="Test Scatter",
        viz_type="deck_scatter",
        params=json.dumps(
            {
                "viz_type": "deck_scatter",
                "mapbox_style": "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
            }
        ),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert (
        params["mapbox_style"]
        == "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    )
    assert params["map_renderer"] == "mapbox"


def test_migrate_deckgl_slice_no_mapbox_style():
    """Slices without mapbox_style still get map_renderer='mapbox'."""
    slc = Slice(
        slice_name="Test Arc No Style",
        viz_type="deck_arc",
        params=json.dumps({"viz_type": "deck_arc", "other_param": "value"}),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["map_renderer"] == "mapbox"
    assert params["other_param"] == "value"


def test_downgrade_deckgl_slice():
    slc = Slice(
        slice_name="Test Arc",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "mapbox://styles/mapbox/dark-v9",
                "map_renderer": "mapbox",
                "other_param": "value",
            }
        ),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "mapbox://styles/mapbox/dark-v9"
    assert "map_renderer" not in params
    assert params["other_param"] == "value"
