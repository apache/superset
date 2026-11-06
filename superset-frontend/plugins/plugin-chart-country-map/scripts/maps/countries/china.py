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
"""China: adds Taiwan, Hong Kong and Macau as Special Administrative
Regions, pulled from the admin-0 dataset since Natural Earth doesn't
model them as admin-1 provinces of China.

Note: ISO-3166-2:CN has since switched these regions to letter codes
(e.g. CN-91 -> CN-HK); the numeric codes are kept here for backward
compatibility, as in the notebook this replaces.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from maps.context import BuildContext

NAME = "china"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    china_sars = ctx.df_admin0_10m.loc[
        ctx.df_admin0_10m.name_en.isin(["Taiwan", "Hong Kong", "Macau"]),
        [x for x in ctx.df_admin0_10m.columns if x in ctx.df.columns],
    ]
    china_sars = china_sars.merge(
        pd.DataFrame(
            data={
                "name_en": ["Taiwan", "Hong Kong", "Macau"],
                "name_zh": ["中国台湾", "香港特别行政区", "澳门特别行政区"],
                "iso_3166_2": ["CN-71", "CN-91", "CN-92"],
            },
        ),
        on="name_en",
        how="left",
    )

    china = ctx.df[ctx.df.admin == "China"]
    china_copy = pd.concat([china, china_sars], ignore_index=True)
    china_copy["name_zh"] = china_copy["name_zh"].combine_first(china_copy["name_zh_y"])
    china_copy = china_copy.drop(["name_zh_x", "name_zh_y"], axis=1)

    return {NAME: china_copy}
