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
"""Russia: Natural Earth's 1:50m data incorrectly merges Karelia into
Murmansk. Replace only those two regions with their correct 1:10m
boundaries so the rest of Russia retains the smaller 1:50m payload - see
https://github.com/nvkelso/natural-earth-vector/issues/929 - then shift
the Chukchi Autonomous Okrug (which Natural Earth splits across the
antimeridian) back onto one side of the map.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from maps.context import BuildContext
from maps.helpers import shift_geom

NAME = "russia"

_CORRECTED_REGIONS = ["Karelia", "Murmansk"]


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    russia_50m = ctx.df_50m[(ctx.df_50m.admin == "Russia") & ctx.df_50m.name.notna()]
    russia_10m_corrections = ctx.df_10m[
        (ctx.df_10m.admin == "Russia") & ctx.df_10m.name.isin(_CORRECTED_REGIONS)
    ]
    russia = pd.concat(
        [
            russia_50m[~russia_50m.name.isin(_CORRECTED_REGIONS)],
            russia_10m_corrections,
        ]
    )

    russia_copy = russia.copy()
    russia_copy.loc[russia.name == "Chukchi Autonomous Okrug", "geometry"] = (
        russia_copy.loc[russia.name == "Chukchi Autonomous Okrug", "geometry"].apply(
            shift_geom
        )
    )

    return {NAME: russia_copy}
