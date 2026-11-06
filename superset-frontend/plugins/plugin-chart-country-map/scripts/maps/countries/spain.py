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
"""Spain: move the Canary Islands (Las Palmas, Santa Cruz de Tenerife)
closer to the mainland.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import reposition

NAME = "spain"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    spain = ctx.df[ctx.df.admin == "Spain"]
    spain_copy = spain.copy()

    reposition(
        spain_copy,
        spain.name.isin(["Las Palmas", "Santa Cruz de Tenerife"]),
        3,
        7,
        1,
        1,
    )

    return {NAME: spain_copy}
