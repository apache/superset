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
"""Morocco: a community source (pinned to a commit) with region codes
that need an ISO-format correction and a validation pass.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext

NAME = "morocco"

_URL = (
    "https://raw.githubusercontent.com/abdelghanibelgaid/"
    "morocco-map/"
    "7795c93c17db0a98b0fee33e7851d2e9faee76bb/"
    "maps/morocco.geojson"
)

_EXPECTED_REGION_CODES = {f"MA-{i:02d}" for i in range(1, 13)}


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    source = gpd.read_file(_URL)

    required_columns = {"id", "name", "geometry"}
    if missing_columns := required_columns - set(source.columns):
        raise ValueError(
            f"Morocco source is missing columns: {sorted(missing_columns)}. "
            f"Available columns: {sorted(source.columns)}"
        )

    copy = source.rename(columns={"id": "iso_3166_2", "name": "name"})[
        ["geometry", "iso_3166_2", "name"]
    ].copy()

    # Convert MA01 -> MA-01
    copy["iso_3166_2"] = copy["iso_3166_2"].str.replace(
        r"^MA(\d{2})$", r"MA-\1", regex=True
    )

    if (actual_region_codes := set(copy["iso_3166_2"])) != _EXPECTED_REGION_CODES:
        raise ValueError(
            "Unexpected Morocco region codes. "
            f"Expected {sorted(_EXPECTED_REGION_CODES)}, "
            f"found {sorted(actual_region_codes)}"
        )

    return {NAME: copy}
