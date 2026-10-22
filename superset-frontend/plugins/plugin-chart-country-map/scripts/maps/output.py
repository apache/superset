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
"""Writes a built GeoDataFrame to a GeoJSON file, matching the notebook's
"Output GeoJSON Files" cell (simplification included).
"""

from __future__ import annotations

import os

import geopandas as gpd
import shapely.ops

from .context import BuildContext, COUNTRY_NAME_ALIASES

USEFUL_COLUMNS = ["ISO", "NAME_1", "geometry"]

# Per-country overrides for files where the size-based heuristic below
# doesn't give a good result (ported verbatim from the notebook).
SIMPLIFY_FACTOR_OVERRIDES = {
    "uk": 0.005,
    # geoBoundaries data is full-resolution; simplify to match the file size
    # of comparable countries (its bounding-box "size" narrowly misses the
    # 100 threshold).
    "kenya": 0.01,
}


def get_simplify_factor_by_size(gdf: gpd.GeoDataFrame) -> float:
    xmin, ymin, xmax, ymax = shapely.ops.unary_union(gdf["geometry"]).bounds
    size = (xmax - xmin) * (ymax - ymin)
    if size > 1000:
        return 0.03
    if size > 300:
        return 0.02
    if size > 100:
        return 0.01
    return 0


def simplify_if_needed(ctx: BuildContext, name: str, gdf: gpd.GeoDataFrame) -> None:
    """Simplifies the geometry in place, unless it's already coarse (sourced
    from Natural Earth's 1:50m dataset).
    """
    alias = COUNTRY_NAME_ALIASES.get(name, name)
    if alias in ctx.df_50m_admins:
        return

    factor = SIMPLIFY_FACTOR_OVERRIDES.get(name) or get_simplify_factor_by_size(gdf)
    if factor:
        gdf["geometry"] = gdf.simplify(factor)


def save_geojson(
    ctx: BuildContext, name: str, gdf: gpd.GeoDataFrame, out_dir: str
) -> str:
    gdf = gdf.copy()
    # For backward compatibility with the frontend plugin's existing column
    # expectations.
    gdf["ISO"] = gdf["iso_3166_2"]
    gdf["NAME_1"] = gdf["name"]

    simplify_if_needed(ctx, name, gdf)

    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{name.replace(' ', '_')}.geojson")
    gdf[USEFUL_COLUMNS].to_file(path, driver="GeoJSON")
    return path
