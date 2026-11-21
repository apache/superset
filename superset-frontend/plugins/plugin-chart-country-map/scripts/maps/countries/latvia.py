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
"""Latvia: a community GeoJSON source that can legitimately fail to load.

Unlike the notebook's own version of this cell (which prints a warning
and silently falls back to the untouched Natural Earth row on a failed
fetch), this raises. The orchestrator's CI equivalent already fails the
job on a build error (see update-country-maps.yml); swallowing the
error here would just make that check blind to this one source.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "latvia"

_URL = (
    "https://raw.githubusercontent.com/eriks47/latvia/"
    "f87a18268a0ae9996022436482c68e58d4240a68/latvia.geojson"
)


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    try:
        latvia_gdf = gpd.read_file(_URL)
    except Exception as exc:  # noqa: BLE001 - re-raised with context below
        raise RuntimeError(
            f"Unable to download or load the GeoJSON file for Latvia: {exc}"
        ) from exc

    latvia = gpd.GeoDataFrame(latvia_gdf, geometry="geometry", crs=latvia_gdf.crs)
    return {NAME: latvia}
