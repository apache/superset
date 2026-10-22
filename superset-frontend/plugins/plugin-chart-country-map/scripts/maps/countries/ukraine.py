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
"""Ukraine: Crimea (UA-43) and Sevastopol (UA-40) belong to Ukraine
(ISO country code UA), pulled from Russia's raw admin-1 rows - not the
corrected `russia` module's output, which applies its own unrelated
dateline fix after this runs.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from maps.context import BuildContext

NAME = "ukraine"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    russia_raw = ctx.df[ctx.df["adm0_a3"] == "RUS"].copy()
    crimea = russia_raw[russia_raw["iso_3166_2"] == "UA-43"].copy()
    sevastopol = russia_raw[russia_raw["iso_3166_2"] == "UA-40"].copy()

    ukraine_with_crimea = pd.concat(
        [ctx.df[ctx.df["adm0_a3"] == "UKR"], crimea, sevastopol], ignore_index=True
    )

    ukraine_with_crimea.loc[ukraine_with_crimea["iso_3166_2"] == "UA-30", "name"] = (
        "Kyiv"
    )
    ukraine_with_crimea.loc[ukraine_with_crimea["iso_3166_2"] == "UA-32", "name"] = (
        "Kyiv Oblast"
    )

    return {NAME: ukraine_with_crimea}
