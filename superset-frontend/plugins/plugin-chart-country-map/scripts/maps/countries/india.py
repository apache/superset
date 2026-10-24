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
"""India: Jammu and Kashmir (IN-JK) and Ladakh (IN-LA) are new
territories, part of the disputed region of Jammu and Kashmir. Their
geometry comes from a community source, not Natural Earth.

Unlike the notebook's own version of this cell (which prints a warning
and silently falls back to Natural Earth's boundaries on a failed
fetch), this raises - see latvia.py's docstring for why.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "india"

_URL = (
    "https://github.com/geohacker/india/raw/"
    "bcb920c7d3c686f01d085f7661c9ba89bf9bf65e/"
    "state/india_state_kashmir_ladakh.geojson"
)


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    india = ctx.df[ctx.df["admin"] == "India"]
    india_copy = india.copy()

    try:
        india_gdf = gpd.read_file(_URL)
    except Exception as exc:  # noqa: BLE001 - re-raised with context below
        raise RuntimeError(
            f"Unable to download or load the GeoJSON file for India: {exc}"
        ) from exc

    india_gdf = india_gdf.rename(columns={"ST_ID": "iso_3166_2"})
    india_copy.loc[india_copy["iso_3166_2"] == "IN-JK", "geometry"] = (
        india_gdf[india_gdf["iso_3166_2"] == "IN-JK"]
        .dissolve(by="iso_3166_2")
        .reset_index()["geometry"]
        .values
    )
    india_copy.loc[india_copy["iso_3166_2"] == "IN-LA", "geometry"] = (
        india_gdf[india_gdf["iso_3166_2"] == "IN-LA"]
        .dissolve(by="iso_3166_2")
        .reset_index()["geometry"]
        .values
    )

    return {NAME: india_copy}
