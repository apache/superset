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
DECKGL_MIGRATION_ADDED_FIELDS = migrate_deckgl_and_mapbox.DECKGL_MIGRATION_ADDED_FIELDS
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
    """Charts with non-mapbox:// style URLs should stay on the MapLibre path."""
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
    assert params["maplibre_style"] == "https://tiles.openfreemap.org/styles/liberty"
    assert params["map_renderer"] == "maplibre"


@pytest.mark.parametrize(
    (
        "mapbox_style",
        "expected_map_renderer",
        "expected_maplibre_style",
        "expected_modified",
    ),
    [
        ("mapbox://styles/mapbox/dark-v9", "mapbox", None, True),
        (
            "tile://https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "maplibre",
            "tile://https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            True,
        ),
        (
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "maplibre",
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            True,
        ),
        (None, None, None, False),
        (
            "https://example.com/styles/custom-style.json",
            "maplibre",
            "https://example.com/styles/custom-style.json",
            True,
        ),
    ],
)
def test_migrate_deckgl_slice_map_renderer_classification(
    mapbox_style, expected_map_renderer, expected_maplibre_style, expected_modified
):
    params = {
        "viz_type": "deck_arc",
        "other_param": "value",
    }
    if mapbox_style is not None:
        params["mapbox_style"] = mapbox_style

    slc = Slice(
        slice_name="Test Arc",
        viz_type="deck_arc",
        params=json.dumps(params),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is expected_modified
    migrated_params = json.loads(slc.params)
    if mapbox_style is not None:
        assert migrated_params["mapbox_style"] == mapbox_style
    else:
        assert "mapbox_style" not in migrated_params
    if expected_map_renderer is None:
        assert "map_renderer" not in migrated_params
    else:
        assert migrated_params["map_renderer"] == expected_map_renderer
    if expected_maplibre_style is None:
        assert "maplibre_style" not in migrated_params
    else:
        assert migrated_params["maplibre_style"] == expected_maplibre_style
    if expected_modified:
        assert DECKGL_MIGRATION_ADDED_FIELDS in migrated_params
    else:
        assert DECKGL_MIGRATION_ADDED_FIELDS not in migrated_params
    assert migrated_params["viz_type"] == "deck_arc"  # viz_type unchanged
    assert migrated_params["other_param"] == "value"


def test_migrate_deckgl_slice_preserves_existing_maplibre_style():
    slc = Slice(
        slice_name="Test Arc Existing MapLibre Style",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "https://legacy.example.com/style.json",
                "maplibre_style": "https://saved.example.com/style.json",
                "other_param": "value",
            }
        ),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is False
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "https://legacy.example.com/style.json"
    assert params["maplibre_style"] == "https://saved.example.com/style.json"
    assert params["other_param"] == "value"


def test_migrate_deckgl_slice_preserves_existing_map_renderer():
    slc = Slice(
        slice_name="Test Arc Existing Renderer",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "mapbox://styles/mapbox/dark-v9",
                "map_renderer": "maplibre",
                "other_param": "value",
            }
        ),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is False
    params = json.loads(slc.params)
    assert params["map_renderer"] == "maplibre"
    assert params["mapbox_style"] == "mapbox://styles/mapbox/dark-v9"
    assert params["other_param"] == "value"


def test_migrate_deckgl_slice_copies_style_without_overwriting_renderer():
    slc = Slice(
        slice_name="Test Arc Existing Renderer Open Style",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "https://legacy.example.com/style.json",
                "map_renderer": "mapbox",
                "other_param": "value",
            }
        ),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["map_renderer"] == "mapbox"
    assert params["mapbox_style"] == "https://legacy.example.com/style.json"
    assert params["maplibre_style"] == "https://legacy.example.com/style.json"
    assert params[DECKGL_MIGRATION_ADDED_FIELDS] == ["maplibre_style"]
    assert params["other_param"] == "value"


@pytest.mark.parametrize("params", [[], "legacy", 1])
def test_migrate_deckgl_slice_ignores_non_object_params(params):
    slc = Slice(
        slice_name="Test Arc Non-object Params",
        viz_type="deck_arc",
        params=json.dumps(params),
    )

    modified = _migrate_deckgl_slice(slc)

    assert modified is False
    assert json.loads(slc.params) == params


def test_downgrade_deckgl_slice():
    slc = Slice(
        slice_name="Test Arc",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "mapbox://styles/mapbox/dark-v9",
                "map_renderer": "mapbox",
                DECKGL_MIGRATION_ADDED_FIELDS: ["map_renderer"],
                "other_param": "value",
            }
        ),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "mapbox://styles/mapbox/dark-v9"
    assert "map_renderer" not in params
    assert DECKGL_MIGRATION_ADDED_FIELDS not in params
    assert params["other_param"] == "value"


def test_downgrade_deckgl_slice_removes_copied_maplibre_style():
    slc = Slice(
        slice_name="Test Arc Open Style",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "https://legacy.example.com/style.json",
                "maplibre_style": "https://legacy.example.com/style.json",
                "map_renderer": "maplibre",
                DECKGL_MIGRATION_ADDED_FIELDS: ["maplibre_style", "map_renderer"],
                "other_param": "value",
            }
        ),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is True
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "https://legacy.example.com/style.json"
    assert "maplibre_style" not in params
    assert "map_renderer" not in params
    assert DECKGL_MIGRATION_ADDED_FIELDS not in params
    assert params["other_param"] == "value"


def test_downgrade_deckgl_slice_preserves_distinct_maplibre_style():
    slc = Slice(
        slice_name="Test Arc Existing MapLibre Style",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "https://legacy.example.com/style.json",
                "maplibre_style": "https://saved.example.com/style.json",
                "other_param": "value",
            }
        ),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is False
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "https://legacy.example.com/style.json"
    assert params["maplibre_style"] == "https://saved.example.com/style.json"
    assert params["other_param"] == "value"


def test_downgrade_deckgl_slice_preserves_unmarked_renderer_and_maplibre_style():
    slc = Slice(
        slice_name="Test Arc Existing Fields",
        viz_type="deck_arc",
        params=json.dumps(
            {
                "viz_type": "deck_arc",
                "mapbox_style": "https://legacy.example.com/style.json",
                "maplibre_style": "https://legacy.example.com/style.json",
                "map_renderer": "maplibre",
                "other_param": "value",
            }
        ),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is False
    params = json.loads(slc.params)
    assert params["mapbox_style"] == "https://legacy.example.com/style.json"
    assert params["maplibre_style"] == "https://legacy.example.com/style.json"
    assert params["map_renderer"] == "maplibre"
    assert params["other_param"] == "value"


@pytest.mark.parametrize("params", [[], "legacy", 1])
def test_downgrade_deckgl_slice_ignores_non_object_params(params):
    slc = Slice(
        slice_name="Test Arc Non-object Params",
        viz_type="deck_arc",
        params=json.dumps(params),
    )

    modified = _downgrade_deckgl_slice(slc)

    assert modified is False
    assert json.loads(slc.params) == params
