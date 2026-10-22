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
"""Italy: one Natural Earth section that produces two distinct shipped
maps - plain regions, and regions with Trento/Bolzano split out as
autonomous provinces.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from maps.context import BuildContext

NAME = "italy"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    regions = ctx.df[ctx.df.admin == "Italy"][["geometry", "region_cod", "region"]]
    regions = regions.dissolve(by=["region_cod", "region"]).reset_index()
    regions = regions.rename(columns={"region": "name", "region_cod": "iso_3166_2"})

    trento_and_bozen = ctx.df[
        (ctx.df.admin == "Italy") & (ctx.df.iso_3166_2.isin(["IT-TN", "IT-BZ"]))
    ][["geometry", "iso_3166_2", "name"]]

    with_provinces = pd.concat([regions, trento_and_bozen])
    with_provinces = with_provinces[with_provinces["iso_3166_2"] != "IT-32"]

    return {
        "italy_regions": regions,
        "italy_regions_and_autonomous_provinces": with_provinces,
    }
