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
"""UK: crops out everything but Great Britain and Northern Ireland
(Natural Earth includes far-flung overseas territories under the same
admin).
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import apply_bounds

NAME = "uk"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    uk = ctx.df[ctx.df.admin == "United Kingdom"]
    uk_copy = apply_bounds(uk, (-10, 60), (20, 20))
    # The source data labels Wirral (GB-WRL) as "Halton", which duplicates GB-HAL.
    uk_copy.loc[uk_copy["iso_3166_2"] == "GB-WRL", "name"] = "Wirral"

    return {NAME: uk_copy}
