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
"""Geometry helpers shared across more than one per-country build script."""

from __future__ import annotations

from typing import Any

import geopandas as gpd
import shapely.affinity
import shapely.geometry
import shapely.ops


def reposition(
    gdf: gpd.GeoDataFrame,
    idx: Any,  # a boolean mask or label selector, e.g. `usa.name == "Hawaii"`
    xoff: float | None = None,
    yoff: float | None = None,
    xscale: float | None = None,
    yscale: float | None = None,
    simplify: float | None = None,
) -> None:
    """Move/scale/simplify the geometry at `idx` in place (e.g. relocating
    Hawaii and Alaska closer to the continental US for a compact map).
    """

    def move_and_scale(
        geom: shapely.geometry.base.BaseGeometry,
    ) -> shapely.geometry.base.BaseGeometry:
        if xoff or yoff:
            geom = shapely.affinity.translate(geom, xoff or 0, yoff or 0)
        if xscale or yscale:
            geom = shapely.affinity.scale(geom, xscale or 1, yscale or 1)
        if simplify:
            geom = geom.simplify(simplify, preserve_topology=False)
        return geom

    gdf.loc[idx, "geometry"] = gdf.loc[idx, "geometry"].apply(move_and_scale)


def replace_column(column: str, gdf: gpd.GeoDataFrame, old: str, new: str) -> None:
    """Replaces every `old` value in `column` with `new`, in place.

    Intentionally mutates the GeoDataFrame it's given rather than
    returning a copy - several callers rely on that (e.g. france.py fixes
    up the shared `france` frame before other sections derive from it).
    """
    if old in gdf[column].values:
        gdf.loc[gdf[column] == old, column] = new


def apply_bounds(
    gdf: gpd.GeoDataFrame,
    northwest: tuple[float, float],
    southeast: tuple[float, float],
) -> gpd.GeoDataFrame:
    """Drops any geometry not fully contained in the given box (e.g.
    cropping a country's overseas territories out of its mainland map).
    """
    x1, y1 = northwest
    x2, y2 = southeast
    boundary = shapely.geometry.Polygon([(x1, y1), (x1, y2), (x2, y2), (x2, y1)])
    gdf = gdf.copy()
    return gdf[gdf.geometry.apply(boundary.contains)]


def shift_geom(
    geom: shapely.geometry.base.BaseGeometry, cutoff: float = 0
) -> shapely.geometry.base.BaseGeometry:
    """Moves the part of a geometry west of `cutoff` degrees to the other
    side of the antimeridian (e.g. Russia's Chukchi Autonomous Okrug,
    which Natural Earth splits across +/-180 longitude).
    """
    border = shapely.geometry.LineString([(cutoff, -90), (cutoff, 90)])
    split_geom = shapely.ops.split(geom, border)

    moved_geom = []
    if isinstance(split_geom, shapely.geometry.GeometryCollection):
        for item in split_geom.geoms:
            minx, _miny, _maxx, _maxy = item.bounds
            if minx < cutoff:
                # Keep split parts distinct after GeoJSON coordinate
                # serialization.
                moved_geom.append(
                    shapely.affinity.translate(item, xoff=360 - cutoff + 1e-9)
                )
            else:
                moved_geom.append(item)
    else:
        # No split occurred.
        moved_geom.append(geom)

    return shapely.ops.unary_union(moved_geom)


def create_region_polygons(
    region_dict: dict[str, list[str]], gdf: gpd.GeoDataFrame
) -> gpd.GeoDataFrame:
    """Dissolves a province-level GeoDataFrame into regions, given a
    region-code -> [province iso_3166_2 codes] mapping (e.g. Turkey's
    NUTS-1 regions).
    """
    city_to_region = {
        city_code: region_code
        for region_code, city_codes in region_dict.items()
        for city_code in city_codes
    }

    gdf = gdf.copy()
    gdf["REGION"] = gdf["iso_3166_2"].map(city_to_region)

    region_gdf = gdf.dissolve(by="REGION").reset_index()
    return region_gdf.drop(columns=["iso_3166_2"])
