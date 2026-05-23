#!/usr/bin/env python3
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

# mypy: ignore-errors
"""
Unit tests for the Country Map build pipeline transforms.

Run with:  python3 -m pytest test_build.py
       or: python3 test_build.py   (uses the bundled `unittest` runner)

Tests focus on the pure-Python transforms in build.py — the geometry
helpers and the YAML-config application functions. The mapshaper
subprocess calls and shapefile downloads are not exercised here
(they are integration concerns covered by the regen CI workflow).
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

# Import the module under test from this directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402  (intentional after sys.path manipulation)

# ----------------------------------------------------------------------
# _matches
# ----------------------------------------------------------------------


class TestMatches(unittest.TestCase):
    def test_scalar_equality(self):
        props = {"adm0_a3": "FRA", "name": "Paris"}
        assert build._matches(props, {"adm0_a3": "FRA"})
        assert not build._matches(props, {"adm0_a3": "GBR"})

    def test_multiple_conditions_anded(self):
        props = {"adm0_a3": "FRA", "name": "Paris"}
        assert build._matches(props, {"adm0_a3": "FRA", "name": "Paris"})
        assert not build._matches(props, {"adm0_a3": "FRA", "name": "Lyon"})

    def test_in_list_membership(self):
        props = {"name": "Hawaii"}
        assert build._matches(props, {"name": {"in": ["Hawaii", "Alaska"]}})
        assert not build._matches(props, {"name": {"in": ["Texas", "Alaska"]}})

    def test_missing_property(self):
        props = {"adm0_a3": "FRA"}
        assert not build._matches(props, {"name": "Paris"})


# ----------------------------------------------------------------------
# Geometry helpers
# ----------------------------------------------------------------------


def make_polygon(points):
    """Helper: build a Polygon GeoJSON dict from a single ring of [x, y]."""
    return {"type": "Polygon", "coordinates": [points]}


def make_multipolygon(polygons):
    """Helper: build a MultiPolygon GeoJSON dict from a list of single rings."""
    return {"type": "MultiPolygon", "coordinates": [[ring] for ring in polygons]}


class TestBboxCenter(unittest.TestCase):
    def test_unit_square(self):
        geom = make_polygon([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]])
        cx, cy = build._bbox_center(geom)
        assert (cx, cy) == (0.5, 0.5)

    def test_offset_square(self):
        geom = make_polygon([[10, 20], [12, 20], [12, 22], [10, 22], [10, 20]])
        cx, cy = build._bbox_center(geom)
        assert (cx, cy) == (11, 21)


class TestTranslateAndScale(unittest.TestCase):
    def test_pure_translate(self):
        geom = make_polygon([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]])
        build._translate_and_scale(geom, offset=[10, 20], scale=1.0)
        # Each point should shift by (10, 20)
        assert geom["coordinates"][0][0] == [10, 20]
        assert geom["coordinates"][0][2] == [11, 21]

    def test_pure_scale_around_centroid(self):
        # Square centered on origin scaled 2x → corners move outward
        geom = make_polygon([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]])
        build._translate_and_scale(geom, offset=[0, 0], scale=2.0)
        # Bbox center stays at origin; corners now at ±2
        assert geom["coordinates"][0][0] == [-2, -2]
        assert geom["coordinates"][0][2] == [2, 2]

    def test_translate_then_scale_combined(self):
        geom = make_polygon([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]])
        build._translate_and_scale(geom, offset=[10, 0], scale=0.5)
        # Centroid was (1, 1); each corner first scaled around centroid by
        # 0.5 → corners become (0.5, 0.5)..(1.5, 1.5); then translated +10x
        assert geom["coordinates"][0][0] == [10.5, 0.5]
        assert geom["coordinates"][0][2] == [11.5, 1.5]

    def test_multipolygon_handled(self):
        geom = make_multipolygon(
            [
                [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
                [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
            ]
        )
        build._translate_and_scale(geom, offset=[100, 200], scale=1.0)
        assert geom["coordinates"][0][0][0] == [100, 200]
        assert geom["coordinates"][1][0][0] == [105, 205]


class TestTranslateAndScaleWithPivot(unittest.TestCase):
    """The `group: true` case in composite_maps uses a shared pivot
    so multiple features transform as one body."""

    def test_features_with_shared_pivot_preserve_relative_positions(self):
        # Two unit squares, pivot at the midpoint between them
        a = make_polygon([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]])
        b = make_polygon([[3, 0], [4, 0], [4, 1], [3, 1], [3, 0]])
        # Their combined bbox center is (2, 0.5)
        pivot = (2, 0.5)
        # Scale 2x around shared pivot — they move APART
        build._translate_and_scale_with_pivot(a, [0, 0], 2.0, pivot)
        build._translate_and_scale_with_pivot(b, [0, 0], 2.0, pivot)
        # `a`'s right edge was at x=1, distance 1 from pivot → new x=0
        # `b`'s left edge was at x=3, distance 1 from pivot → new x=4
        # Gap between them grows from 2 to 4 (preserved relative position).
        assert a["coordinates"][0][1] == [
            0,
            -0.5,
        ]  # was [1,0]: scaled -1 from pivot x=2
        assert b["coordinates"][0][0] == [4, -0.5]  # was [3,0]: scaled +1 from pivot


class TestDropParts(unittest.TestCase):
    def test_drops_specified_indices(self):
        geom = make_multipolygon(
            [
                [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
                [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]],
                [[4, 4], [5, 4], [5, 5], [4, 5], [4, 4]],
            ]
        )
        result = build._drop_parts(geom, [1])
        assert result["type"] == "MultiPolygon"
        assert len(result["coordinates"]) == 2
        # Kept parts: index 0 and index 2
        assert result["coordinates"][0][0][0] == [0, 0]
        assert result["coordinates"][1][0][0] == [4, 4]

    def test_polygon_unchanged(self):
        geom = make_polygon([[0, 0], [1, 0], [1, 1]])
        result = build._drop_parts(geom, [0])
        assert result["type"] == "Polygon"  # no change


# ----------------------------------------------------------------------
# Transforms
# ----------------------------------------------------------------------


class TestApplyNameOverrides(unittest.TestCase):
    def test_applies_to_matching_features_only(self):
        geo = {
            "type": "FeatureCollection",
            "features": [
                {
                    "properties": {
                        "adm0_a3": "FRA",
                        "name": "Seien-et-Marne",
                    },
                    "geometry": make_polygon([[0, 0], [1, 1]]),
                },
                {
                    "properties": {
                        "adm0_a3": "FRA",
                        "name": "Paris",
                    },
                    "geometry": make_polygon([[2, 2], [3, 3]]),
                },
                {
                    "properties": {
                        "adm0_a3": "GBR",
                        "name": "Seien-et-Marne",  # same string in another country, shouldn't match
                    },
                    "geometry": make_polygon([[4, 4], [5, 5]]),
                },
            ],
        }
        overrides = [
            {
                "match": {"adm0_a3": "FRA", "name": "Seien-et-Marne"},
                "set": {"name": "Seine-et-Marne"},
            },
        ]
        build.apply_name_overrides(geo, overrides)
        assert geo["features"][0]["properties"]["name"] == "Seine-et-Marne"
        assert geo["features"][1]["properties"]["name"] == "Paris"
        assert geo["features"][2]["properties"]["name"] == "Seien-et-Marne"  # unchanged


class TestApplyFlyingIslands(unittest.TestCase):
    def _square_at(self, x, y, adm0_a3, name):
        return {
            "properties": {"adm0_a3": adm0_a3, "name": name},
            "geometry": make_polygon(
                [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]
            ),
        }

    def test_repositions_matched_features(self):
        geo = {
            "type": "FeatureCollection",
            "features": [
                self._square_at(0, 0, "USA", "Hawaii"),
                self._square_at(10, 10, "USA", "Texas"),  # not matched
            ],
        }
        config = {
            "countries": {
                "USA": {
                    "repositions": [
                        {
                            "match": {"name": "Hawaii"},
                            "offset": [100, 200],
                            "scale": 1.0,
                        }
                    ]
                }
            }
        }
        build.apply_flying_islands(geo, config, country_a3=None, admin_level=1)
        # Hawaii moved
        assert geo["features"][0]["geometry"]["coordinates"][0][0] == [100, 200]
        # Texas unchanged
        assert geo["features"][1]["geometry"]["coordinates"][0][0] == [10, 10]

    def test_drop_outside_bbox_only_at_admin1(self):
        geo = {
            "type": "FeatureCollection",
            "features": [
                self._square_at(-50, 50, "NLD", "Caribbean territory"),
                self._square_at(5, 52, "NLD", "Mainland"),
            ],
        }
        config = {
            "countries": {
                "NLD": {"drop_outside_bbox": {"nw": [-20, 60], "se": [20, 20]}}
            }
        }
        # Admin 1: drop applies, Caribbean dropped
        geo_a1 = json.loads(json.dumps(geo))
        build.apply_flying_islands(geo_a1, config, country_a3=None, admin_level=1)
        assert len(geo_a1["features"]) == 1
        assert geo_a1["features"][0]["properties"]["name"] == "Mainland"
        # Admin 0: drop NOT applied (would otherwise drop entire countries
        # whose multi-polygons extend overseas)
        geo_a0 = json.loads(json.dumps(geo))
        build.apply_flying_islands(geo_a0, config, country_a3=None, admin_level=0)
        assert len(geo_a0["features"]) == 2


class TestBboxContains(unittest.TestCase):
    def test_inside_bbox(self):
        geom = make_polygon([[5, 30], [10, 30], [10, 35], [5, 35], [5, 30]])
        assert build._bbox_contains(geom, nw=[0, 40], se=[20, 20])

    def test_outside_bbox_west(self):
        geom = make_polygon([[-30, 30], [-25, 30], [-25, 35], [-30, 35], [-30, 30]])
        assert not build._bbox_contains(geom, nw=[0, 40], se=[20, 20])


if __name__ == "__main__":
    unittest.main(verbosity=2)
