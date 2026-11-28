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
"""Finland: adds the Åland Islands, pulled from the admin-0 dataset since
Natural Earth doesn't model them as an admin-1 province of Finland.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from maps.context import BuildContext

NAME = "finland"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    finland_aland = ctx.df_admin0_10m.loc[
        ctx.df_admin0_10m.name_en.isin(["Åland"]),
        [x for x in ctx.df_admin0_10m.columns if x in ctx.df.columns],
    ]
    finland_aland = finland_aland.merge(
        pd.DataFrame(
            data={
                "name_en": ["Åland"],
                "name_fi": ["Ahvenanmaan maakunta"],
                "iso_3166_2": ["FI-01"],
            },
        ),
        on="name_en",
        how="left",
    )

    finland = ctx.df[ctx.df.admin == "Finland"]
    finland_copy = pd.concat([finland, finland_aland], ignore_index=True)
    finland_copy["name_fi"] = finland_copy["name_fi"].combine_first(
        finland_copy["name_fi"]
    )
    finland_copy = finland_copy.drop(["name_fi"], axis=1)

    return {NAME: finland_copy}
