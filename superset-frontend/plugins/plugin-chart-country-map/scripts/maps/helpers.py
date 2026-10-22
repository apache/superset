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
"""Geometry helpers shared across more than one per-country build script.

Only `reposition` is ported so far - it's the one the prototype's USA
module needs. The notebook has several siblings (`shift_geom`,
`replace_column`, `apply_bounds`, `create_region_polygons`) that other
countries use; port them here once a country module actually needs them,
rather than speculatively up front.
"""

from __future__ import annotations

from typing import Any

import geopandas as gpd
import shapely.affinity
import shapely.geometry


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
