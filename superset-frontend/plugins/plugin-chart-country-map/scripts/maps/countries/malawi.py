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
"""Malawi: Natural Earth gives two districts the same `iso_3166_2` code
(MW-CT), so Karonga is missing and renders blank. The duplicate
(adm1_code MWI-1194) is actually Karonga, not Chitipa - see
ISO 3166-2:MW.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "malawi"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    malawi_copy = ctx.df[ctx.df.admin == "Malawi"].copy()
    malawi_copy.loc[malawi_copy["adm1_code"] == "MWI-1194", ["iso_3166_2", "name"]] = [
        "MW-KR",
        "Karonga",
    ]

    duplicate_codes = malawi_copy.loc[
        malawi_copy["iso_3166_2"].duplicated(keep=False), "iso_3166_2"
    ]
    if not duplicate_codes.empty:
        raise ValueError(
            "Malawi districts still share ISO codes: "
            f"{sorted(duplicate_codes.unique())}. Natural Earth may have "
            "renumbered adm1_code, so re-check which row is Karonga."
        )

    return {NAME: malawi_copy}
