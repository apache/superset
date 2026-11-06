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
"""Kenya: Natural Earth's county boundaries predate the 2010 constitution
(https://en.wikipedia.org/wiki/Counties_of_Kenya). Replaced wholesale
with geoBoundaries' KEN/ADM1 data, pinned to a commit. Per-boundary
metadata marks this dataset Public Domain (source: RCMRD / Africa
GeoPortal), not geoBoundaries' project-wide CC BY 4.0:
https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "kenya"

_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
    "releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1.geojson"
)


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    try:
        kenya_gdf = gpd.read_file(_URL)
    except Exception as exc:
        raise RuntimeError(
            "Unable to download or load the GeoJSON file for Kenya. "
            "Refusing to silently fall back to the outdated Natural Earth "
            "boundaries."
        ) from exc

    kenya_gdf = kenya_gdf.rename(
        columns={"shapeName": "name", "shapeISO": "iso_3166_2"}
    )
    # geoBoundaries truncates this county's name; correct it to the
    # official name.
    kenya_gdf["name"] = kenya_gdf["name"].replace("Tharaka", "Tharaka-Nithi")
    kenya_copy = gpd.GeoDataFrame(kenya_gdf, geometry="geometry", crs=kenya_gdf.crs)

    return {NAME: kenya_copy}
