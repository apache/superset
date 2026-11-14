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
"""South Africa: Natural Earth includes the far-off Prince Edward
Islands (east of 35°E) in Western Cape, stretching the map far south of
the mainland. Move them in, level with the bottom of the mainland, as
is done for Hawaii and Svalbard.
"""

from __future__ import annotations

import geopandas as gpd
import shapely.affinity
import shapely.geometry

from maps.context import BuildContext

# Matches the alt_maps key this replaces in the notebook (contains a
# space; save_geojson turns it into south_africa.geojson).
NAME = "south africa"


def _move_prince_edward_islands(
    geom: shapely.geometry.MultiPolygon,
) -> shapely.geometry.MultiPolygon:
    mainland = [part for part in geom.geoms if part.centroid.x < 35]
    islands = shapely.geometry.MultiPolygon(
        [part for part in geom.geoms if part.centroid.x >= 35]
    )
    islands = shapely.affinity.scale(
        shapely.affinity.translate(islands, -9.0, 12.25), 2, 2
    )
    return shapely.geometry.MultiPolygon(mainland + list(islands.geoms))


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    south_africa_copy = ctx.df[ctx.df.admin == "South Africa"].copy()

    is_wc = south_africa_copy.iso_3166_2 == "ZA-WC"
    south_africa_copy.loc[is_wc, "geometry"] = south_africa_copy.loc[
        is_wc, "geometry"
    ].apply(_move_prince_edward_islands)

    return {NAME: south_africa_copy}
