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
"""Philippines regions: dissolves provinces into regions, with two
renamed to their current official names.

NOTE - a bug found while porting this, deliberately NOT fixed here:
the notebook this replaces also builds a corrected province-level
"philippines" map (merging highly-urbanized cities into their home
province, splitting Maguindanao/Davao, renaming Compostela Valley) from
a pinned community source - but never actually wires that result into
its output. The plain "philippines" entry Superset ships today is still
built from raw, outdated Natural Earth data; the corrected GeoDataFrame
the notebook computes is silently discarded. Confirmed against the
currently-committed philippines.geojson, which still has "Compostela
Valley" and an undivided "Maguindanao" - this conversion preserves that
same (buggy) output for byte-for-byte fidelity rather than silently
changing shipped data. Fixing it is a separate, visible decision for a
follow-up PR, not something to bundle into a scripts-vs-notebook
refactor.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "philippines"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    philippines_regions = ctx.df[ctx.df.admin == "Philippines"][
        ["geometry", "region_cod", "region"]
    ]
    philippines_regions = philippines_regions.dissolve(
        by=["region_cod", "region"]
    ).reset_index()
    philippines_regions = philippines_regions.rename(
        columns={"region": "name", "region_cod": "iso_3166_2"}
    )
    philippines_regions["name"] = philippines_regions["name"].replace(
        {
            "Dinagat Islands (Region XIII)": (
                "Caraga Administrative Region (Region XIII)"
            ),
            "Autonomous Region in Muslim Mindanao (ARMM)": (
                "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)"
            ),
        }
    )

    return {"philippines_regions": philippines_regions}
