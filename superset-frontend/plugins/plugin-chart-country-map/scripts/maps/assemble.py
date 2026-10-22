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
"""Combines the plain country catalog with the registered per-country
module overrides into the final set of maps to ship, matching the
notebook's `get_gdf()` + purge-single-subdivision-countries cells.
"""

from __future__ import annotations

import geopandas as gpd

from .catalog import COUNTRIES, COUNTRY_NAME_ALIASES
from .context import BuildContext


def get_gdf(
    ctx: BuildContext, built: dict[str, gpd.GeoDataFrame], name: str
) -> gpd.GeoDataFrame:
    """Resolves a single country/map name to its GeoDataFrame: a
    registered module's output if one exists, otherwise a plain Natural
    Earth lookup by (aliased) admin name.
    """
    if name in built:
        return built[name].copy()

    alias = COUNTRY_NAME_ALIASES.get(name, name)
    return ctx.df[ctx.df["admin"].str.lower() == alias].copy()


def validate_catalog(ctx: BuildContext, built: dict[str, gpd.GeoDataFrame]) -> None:
    """Raises if a plain catalog entry doesn't resolve to any Natural
    Earth rows (and isn't covered by a registered module instead).
    """
    admins = set(ctx.df["admin"].str.lower().unique())
    invalid = [
        name
        for name in COUNTRIES
        if name not in built and COUNTRY_NAME_ALIASES.get(name, name) not in admins
    ]
    if invalid:
        raise ValueError(f"Following country names are not valid: {invalid}")


def purged_countries(
    ctx: BuildContext, built: dict[str, gpd.GeoDataFrame]
) -> list[str]:
    """Plain catalog entries with one subdivision or fewer - useless as a
    choropleth, so dropped from the output (and any stale file for one
    should be deleted, in case upstream data used to have more).
    """
    return [
        name
        for name in COUNTRIES
        if get_gdf(ctx, built, name)["iso_3166_2"].nunique() <= 1
    ]


def resolve_all(
    ctx: BuildContext, built: dict[str, gpd.GeoDataFrame]
) -> dict[str, gpd.GeoDataFrame]:
    """Returns the final {name: GeoDataFrame} map to save: every plain
    catalog entry with more than one subdivision (others are dropped -
    they'd be useless as a choropleth), plus every registered module
    output (region-variant maps included, even though they aren't in
    the plain catalog at all).
    """
    purged = set(purged_countries(ctx, built))
    kept_plain = [name for name in COUNTRIES if name not in purged]
    all_names = sorted(set(kept_plain) | set(built.keys()))
    return {name: get_gdf(ctx, built, name) for name in all_names}
