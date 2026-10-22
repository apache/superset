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
"""France: three shipped maps from one section.

- "france": mainland + overseas departments moved in close, compact layout
- "france_regions": the above, dissolved into regions
- "france_overseas": a second, more spread-out overseas layout that also
  pulls in French Polynesia, French Southern and Antarctic Lands, Wallis
  and Futuna, New Caledonia, Saint Pierre and Miquelon, Saint Martin and
  Saint Barthélemy - none of which Natural Earth models as a department
  of France itself.

Also fixes department name typos and a handful of ISO-3166-2 codes that
changed in a 2021 revision.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd
import shapely.affinity
from shapely.geometry import MultiPolygon

from maps.context import BuildContext
from maps.helpers import replace_column, reposition

NAME = "france"


def _fix_names_and_codes(france: gpd.GeoDataFrame) -> None:
    replace_column("name", france, "Seien-et-Marne", "Seine-et-Marne")
    replace_column("name", france, "Haute-Rhin", "Haut-Rhin")

    replace_column("iso_3166_2", france, "FR-75", "FR-75C")

    replace_column("iso_3166_2", france, "FR-GP", "FR-971")
    replace_column("iso_3166_2", france, "FR-GF", "FR-973")
    replace_column("iso_3166_2", france, "FR-RE", "FR-974")
    replace_column("iso_3166_2", france, "FR-YT", "FR-976")
    replace_column("iso_3166_2", france, "FR-MQ", "FR-972")

    replace_column("region_cod", france, "FR-IDF\t", "FR-IDF")
    replace_column("region_cod", france, "FR-COR", "FR-20R")
    replace_column("region_cod", france, "FR-GUA", "FR-971")
    replace_column("region_cod", france, "FR-GUF", "FR-973")
    replace_column("region_cod", france, "FR-LRE", "FR-974")
    replace_column("region_cod", france, "FR-MAY", "FR-976")
    replace_column("region_cod", france, "FR-MTQ", "FR-972")


def _build_france_overseas(
    ctx: BuildContext, france: gpd.GeoDataFrame
) -> gpd.GeoDataFrame:
    france_overseas = france.copy()
    reposition(france_overseas, france.name == "Guadeloupe", 53.2, 29, 1.5, 1.5)
    reposition(france_overseas, france.name == "Martinique", 52.8, 27.5, 1.5, 1.5)
    reposition(france_overseas, france.name == "Guyane française", 45, 35.5, 0.3, 0.3)
    reposition(france_overseas, france.name == "La Réunion", -58.2, 60.5, 1.5, 1.5)
    reposition(france_overseas, france.name == "Mayotte", -50.5, 52.2, 2, 2)

    # Tahiti
    tahiti_data = ctx.df[
        (ctx.df["admin"] == "French Polynesia") & (ctx.df["name"] == "Windward Islands")
    ]
    # Remove Rimatuu to avoid confusion with Corsica when displayed on the map
    windward_geom = tahiti_data.iloc[0].geometry
    filtered_geom = MultiPolygon(
        [geom for i, geom in enumerate(windward_geom.geoms) if i != 1]
    )
    tahiti_data = tahiti_data.copy()
    tahiti_data.at[tahiti_data.index[0], "geometry"] = filtered_geom
    france_overseas = pd.concat([france_overseas, tahiti_data], ignore_index=True)
    reposition(
        france_overseas, france_overseas.name == "Windward Islands", 158.2, 57.3, 2, 2
    )

    # Kerguelen
    kerguelen_data = ctx.df[
        (ctx.df["admin"] == "French Southern and Antarctic Lands")
        & (ctx.df["name"] == "Archipel des Kerguelen")
    ]
    france_overseas = pd.concat([france_overseas, kerguelen_data], ignore_index=True)
    reposition(
        france_overseas,
        france_overseas.name == "Archipel des Kerguelen",
        -63.5,
        88.5,
        0.9,
        0.9,
    )

    # Wallis and Futuna
    wallis_futuna_data = ctx.df[
        (ctx.df["admin"] == "Wallis and Futuna")
        & (ctx.df["name"].isin(["Alo", "`Uvea"]))
    ].copy()
    reposition(wallis_futuna_data, wallis_futuna_data.name == "Alo", 11.3, 1.1)
    reposition(wallis_futuna_data, wallis_futuna_data.name == "`Uvea", 9.5, 0.2)
    wallis_futuna_merged = wallis_futuna_data.dissolve(by="admin").reset_index()
    france_overseas = pd.concat(
        [france_overseas, wallis_futuna_merged], ignore_index=True
    )
    reposition(
        france_overseas, france_overseas.admin == "Wallis and Futuna", 170, 52.5, 4, 4
    )

    # New Caledonia
    new_caledonia_data = ctx.df[(ctx.df["admin"] == "New Caledonia")]
    new_caledonia_merged = new_caledonia_data.dissolve(by="admin").reset_index()
    france_overseas = pd.concat(
        [france_overseas, new_caledonia_merged], ignore_index=True
    )
    reposition(
        france_overseas,
        france_overseas.admin == "New Caledonia",
        -165.5,
        60.4,
        0.4,
        0.4,
    )

    # Saint Pierre and Miquelon
    saint_pierre_and_miquelon_data = ctx.df[
        (ctx.df["admin"] == "Saint Pierre and Miquelon")
    ]
    saint_pierre_and_miquelon_merged = saint_pierre_and_miquelon_data.dissolve(
        by="admin"
    ).reset_index()
    france_overseas = pd.concat(
        [france_overseas, saint_pierre_and_miquelon_merged], ignore_index=True
    )
    reposition(
        france_overseas,
        france_overseas.admin == "Saint Pierre and Miquelon",
        48,
        4,
        3,
        3,
    )

    # Saint Martin
    saint_martin_data = ctx.df[(ctx.df["admin"] == "Saint Martin")]
    france_overseas = pd.concat([france_overseas, saint_martin_data], ignore_index=True)
    reposition(
        france_overseas, france_overseas.admin == "Saint Martin", 54.8, 30.3, 5, 5
    )

    # Saint Barthélemy
    saint_barthelemy_data = ctx.df[(ctx.df["admin"] == "Saint Barthelemy")]
    france_overseas = pd.concat(
        [france_overseas, saint_barthelemy_data], ignore_index=True
    )
    reposition(
        france_overseas, france_overseas.admin == "Saint Barthelemy", 54.5, 30, 8, 8
    )

    # Reposition Paris, and Departements 92/93/94 so they're actually visible
    paris_and_littlecrowndpts = france_overseas[
        france_overseas["name"].isin(
            ["Paris", "Hauts-de-Seine", "Seine-Saint-Denis", "Val-de-Marne"]
        )
    ]
    grouped_geometry = MultiPolygon(paris_and_littlecrowndpts["geometry"].tolist())
    grouped_geometry_transformed = shapely.affinity.scale(
        shapely.affinity.translate(grouped_geometry, xoff=6.3, yoff=2.3),
        xfact=3,
        yfact=3,
    )
    transformed_geometries = list(grouped_geometry_transformed.geoms)
    paris_and_littlecrowndpts_copy = paris_and_littlecrowndpts.copy()
    paris_and_littlecrowndpts_copy["geometry"] = transformed_geometries
    france_overseas = france_overseas[
        ~france_overseas["name"].isin(
            ["Paris", "Hauts-de-Seine", "Seine-Saint-Denis", "Val-de-Marne"]
        )
    ]
    france_overseas = pd.concat(
        [france_overseas, paris_and_littlecrowndpts_copy], ignore_index=True
    )

    # Update metadata properly
    france_overseas.loc[
        france_overseas["name"] == "Windward Islands", ["name", "iso_3166_2"]
    ] = ["Polynésie française", "FR-PF"]
    france_overseas.loc[
        france_overseas["name"] == "Archipel des Kerguelen", ["name", "iso_3166_2"]
    ] = ["Terres australes et antarctiques françaises", "FR-TF"]
    france_overseas.loc[
        france_overseas["admin"] == "Wallis and Futuna", ["name", "iso_3166_2"]
    ] = ["Wallis et Futuna", "FR-WF"]
    france_overseas.loc[
        france_overseas["admin"] == "New Caledonia", ["name", "iso_3166_2"]
    ] = ["Nouvelle-Calédonie", "FR-NC"]
    france_overseas.loc[
        france_overseas["admin"] == "Saint Pierre and Miquelon",
        ["name", "iso_3166_2"],
    ] = ["Saint-Pierre-et-Miquelon", "FR-PM"]
    france_overseas.loc[
        france_overseas["admin"] == "Saint Martin", ["name", "iso_3166_2"]
    ] = ["Saint-Martin", "FR-MF"]
    france_overseas.loc[
        france_overseas["admin"] == "Saint Barthelemy", ["name", "iso_3166_2"]
    ] = ["Saint-Barthélémy", "FR-BL"]

    return france_overseas.rename(columns={"NAME_1": "name", "ISO": "iso_3166_2"})


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    france = ctx.df[ctx.df.admin == "France"]
    _fix_names_and_codes(france)

    france_copy = france.copy()
    reposition(france_copy, france.name == "Guadeloupe", 57.4, 25.4, 1.5, 1.5)
    reposition(france_copy, france.name == "Martinique", 58.4, 27.1, 1.5, 1.5)
    reposition(france_copy, france.name == "Guyane française", 52, 37.7, 0.35, 0.35)
    reposition(france_copy, france.name == "La Réunion", -55, 62.8, 1.5, 1.5)
    reposition(france_copy, france.name == "Mayotte", -43, 54.3, 1.5, 1.5)

    france_regions = france_copy[["geometry", "region_cod", "region"]]
    france_regions = france_regions.dissolve(by=["region_cod", "region"]).reset_index()
    france_regions = france_regions.rename(
        columns={"region": "name", "region_cod": "iso_3166_2"}
    )

    france_overseas = _build_france_overseas(ctx, france)

    return {
        NAME: france_copy,
        "france_regions": france_regions,
        "france_overseas": france_overseas,
    }
