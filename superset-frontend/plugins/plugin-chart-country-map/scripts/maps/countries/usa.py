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
"""USA: the classic "flying islands" case - Hawaii and Alaska get moved
and rescaled closer to the mainland so the choropleth reads at a sane
aspect ratio. Exercises the shared `reposition` helper.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import reposition

NAME = "usa"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    usa = ctx.df[ctx.df["adm0_a3"] == "USA"]
    usa_copy = usa.copy()
    reposition(usa_copy, usa.name == "Hawaii", 51, 5.5)
    reposition(usa_copy, usa.name == "Alaska", 35, -34, 0.35, 0.35)
    return {NAME: usa_copy}
