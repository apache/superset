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
"""Philippines: a province-level community source replaces the raw,
outdated Natural Earth boundaries, plus a dissolve of the (unrelated,
Natural-Earth-sourced) regions.

The notebook this replaces fetched this same community source, renamed
its columns, and then never wired the result into its output - the
plain "philippines" entry it shipped was actually still raw Natural
Earth data (highly-urbanized cities split out as their own polygons, an
undivided "Maguindanao", "Compostela Valley" instead of "Davao de
Oro"). Confirmed against the previously-committed philippines.geojson.
This fixes that: the corrected 83-province source is now the
"philippines" output.
"""

from __future__ import annotations

import geopandas as gpd
from shapely.geometry.polygon import orient

from maps.context import BuildContext

NAME = "philippines"

_URL = (
    "https://raw.githubusercontent.com/jdruii/phgeojson/"
    "098399b6f27ca10e31c8f304e4148b3a56431ec2/philippines.geojson"
)


def _orient_clockwise(geom):
    if geom.geom_type == "Polygon":
        return orient(geom, sign=-1.0)
    if geom.geom_type == "MultiPolygon":
        return type(geom)([orient(part, sign=-1.0) for part in geom.geoms])
    return geom


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    try:
        source = gpd.read_file(_URL)
    except Exception as exc:  # noqa: BLE001 - re-raised with context below
        raise RuntimeError(
            f"Unable to download or load the GeoJSON file for Philippines: {exc}"
        ) from exc

    required_columns = {"NAME_1", "ISO", "geometry"}
    if missing_columns := required_columns - set(source.columns):
        raise ValueError(
            f"Philippines source is missing columns: {sorted(missing_columns)}. "
            f"Available columns: {sorted(source.columns)}"
        )

    philippines = source.rename(columns={"NAME_1": "name", "ISO": "iso_3166_2"})[
        ["geometry", "iso_3166_2", "name"]
    ].copy()
    # The chart projects with d3 v3, which reads a counterclockwise exterior
    # ring as the complement on the sphere; the community source mixes
    # windings, so force clockwise exteriors (sign=-1).
    philippines["geometry"] = philippines.geometry.apply(_orient_clockwise)

    philippines_regions = ctx.df[ctx.df.admin == "Philippines"][
        ["geometry", "region_cod", "region"]
    ]
    philippines_regions = philippines_regions.dissolve(
        by=["region_cod", "region"]
    ).reset_index()
    philippines_regions = philippines_regions.rename(
        columns={"region": "name", "region_cod": "iso_3166_2"}
    )
    philippines_regions["name"] = philippines_regions["name"].replace(
        {
            "Dinagat Islands (Region XIII)": (
                "Caraga Administrative Region (Region XIII)"
            ),
            "Autonomous Region in Muslim Mindanao (ARMM)": (
                "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)"
            ),
        }
    )

    return {NAME: philippines, "philippines_regions": philippines_regions}
