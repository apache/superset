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
"""Netherlands: crops out everything but the European mainland (Natural
Earth includes the Caribbean constituent countries under the same
admin).
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import apply_bounds

NAME = "netherlands"


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    netherlands = ctx.df[ctx.df.admin == "Netherlands"]
    netherlands_copy = apply_bounds(netherlands, (-20, 60), (20, 20))

    return {NAME: netherlands_copy}
