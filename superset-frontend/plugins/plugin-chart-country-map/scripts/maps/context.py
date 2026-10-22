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

# A handful of country keys need the Natural Earth name they're looked up
# under to differ from their output key (ported verbatim from the notebook's
# `country_name_aliases`).
COUNTRY_NAME_ALIASES = {
    "korea": "south korea",
    "uk": "united kingdom",
    "usa": "united states of america",
    "timorleste": "east timor",
    "tanzania": "united republic of tanzania",
}


@dataclass
class BuildContext:
    """Natural Earth data shared by every per-country build() call."""

    df: gpd.GeoDataFrame
    df_admin0_10m: gpd.GeoDataFrame
    df_50m_admins: set[str]
