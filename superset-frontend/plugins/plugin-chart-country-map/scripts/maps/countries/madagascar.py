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
"""Madagascar: Natural Earth's borders are out of date (21 regions
instead of 23) and reuse province codes as region codes. Replaced
wholesale from a live W.H.O. AFRO GDB query (CC BY-NC-SA 3.0 IGO) - this
is the one source in the whole catalog that can't be pinned to a
commit, since it's a live service rather than a repo.
"""

from __future__ import annotations

import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon

from maps.context import BuildContext

NAME = "madagascar"

_URL = (
    "https://maps.afro.who.int/server/rest/services/Hosted/AFROGDB_PUBLIC_DATA/"
    "FeatureServer/0/query?where=iso3_code+%3D+%27MDG%27+and+boundary_type_id+%3D+1"
    "&geometryType=esriGeometryEnvelope&defaultSR=&spatialRel=esriSpatialRelIntersects"
    "&units=esriSRUnit_Foot&outFields=level_id%2Cdisplay_name&returnGeometry=true&f=geojson"
)

# Simplify directly in EPSG:4326 -> degrees conversion, targeting ~50m
# resolution, adjusted so the output file size is roughly in line with
# other countries' (~200KB).
_MEAN_METERS_PER_DEGREE = 108_000
_SIMPLIFY_TOLERANCE_DEG = 10 * 50 / _MEAN_METERS_PER_DEGREE


def _reverse_ring_order(
    geom: Polygon | MultiPolygon,
) -> Polygon | MultiPolygon:
    # cf. https://ruky.me/how-to-correctly-load-your-country-in-to-apache-superset/#step-5--converting-geojson-file-to-go-against-right-hand-rule
    if geom.geom_type == "Polygon":
        return Polygon(list(geom.exterior.coords)[::-1])
    return MultiPolygon(
        [Polygon(list(poly.exterior.coords)[::-1]) for poly in geom.geoms]
    )


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    try:
        mdg_gdf = gpd.read_file(_URL)  # already in EPSG:4326
    except Exception as exc:
        raise RuntimeError(
            f"Unable to download or load the GeoJSON for Madagascar: {exc}"
        ) from exc

    mdg_gdf["geometry"] = mdg_gdf.geometry.simplify(
        tolerance=_SIMPLIFY_TOLERANCE_DEG, preserve_topology=True
    )
    mdg_gdf["geometry"] = mdg_gdf.geometry.apply(_reverse_ring_order)

    madagascar_copy = mdg_gdf.rename(
        columns={"level_id": "iso_3166_2", "display_name": "name"}
    )

    return {NAME: madagascar_copy}
