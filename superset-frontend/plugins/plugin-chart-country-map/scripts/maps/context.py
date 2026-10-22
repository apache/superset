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
from __future__ import annotations

from dataclasses import dataclass

import geopandas as gpd

# Matches the notebook's `plot_styles` dict exactly, so a --preview render
# looks like the notebook's own inline previews.
PLOT_STYLES = {
    "edgecolor": "black",
    "column": "name",
    "legend": False,
    "cmap": "tab20",
    "linewidth": 0.25,
}


@dataclass
class BuildContext:
    """Natural Earth data shared by every per-country build() call.

    `df` is the merged admin-1 (states/provinces) dataset: 1:50m geometry
    for the large countries Natural Earth ships at that resolution, 1:10m
    for everyone else. `df_10m`/`df_50m` are the two un-merged sources,
    needed by the handful of country modules (currently only Russia) that
    build their own custom mix of the two. `df_admin0_10m` is the
    1:10m admin-0 (country-level) dataset, needed by modules that pull in
    a territory Natural Earth doesn't model as a province of its parent
    (Finland/Åland, China/Taiwan+Hong Kong+Macau).
    """

    df: gpd.GeoDataFrame
    df_10m: gpd.GeoDataFrame
    df_50m: gpd.GeoDataFrame
    df_admin0_10m: gpd.GeoDataFrame

    def is_50m_sourced(self, admin_name: str) -> bool:
        return admin_name in set(self.df_50m["admin"].str.lower().unique())
