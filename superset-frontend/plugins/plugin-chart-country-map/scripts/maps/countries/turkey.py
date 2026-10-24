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
"""Turkey: corrects province name spellings/diacritics, and dissolves
provinces into the 12 NUTS-1 regions for a second, coarser map.
"""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import create_region_polygons, replace_column

NAME = "turkey"

# NUTS-1 codes for Turkey and their corresponding province (iso_3166_2) codes.
_REGION_PROVINCES = {
    "TR1": ["TR-34"],
    "TR2": ["TR-59", "TR-22", "TR-39", "TR-10", "TR-17"],
    "TR3": ["TR-35", "TR-09", "TR-20", "TR-48", "TR-45", "TR-03", "TR-43", "TR-64"],
    "TR4": ["TR-16", "TR-26", "TR-11", "TR-41", "TR-54", "TR-81", "TR-14", "TR-77"],
    "TR5": ["TR-06", "TR-42", "TR-70"],
    "TR6": ["TR-07", "TR-32", "TR-15", "TR-01", "TR-33", "TR-31", "TR-46", "TR-80"],
    "TR7": ["TR-71", "TR-68", "TR-51", "TR-50", "TR-40", "TR-38", "TR-58", "TR-66"],
    "TR8": [
        "TR-67",
        "TR-78",
        "TR-74",
        "TR-37",
        "TR-18",
        "TR-57",
        "TR-55",
        "TR-60",
        "TR-19",
        "TR-05",
    ],
    "TR9": ["TR-61", "TR-52", "TR-28", "TR-53", "TR-08", "TR-29"],
    "TRA": ["TR-25", "TR-24", "TR-69", "TR-04", "TR-36", "TR-76", "TR-75"],
    "TRB": ["TR-44", "TR-23", "TR-12", "TR-62", "TR-65", "TR-49", "TR-13", "TR-30"],
    "TRC": [
        "TR-27",
        "TR-02",
        "TR-79",
        "TR-63",
        "TR-21",
        "TR-47",
        "TR-72",
        "TR-73",
        "TR-56",
    ],
}

_REGION_NAMES = {
    "TR1": "İstanbul",
    "TR2": "Batı Marmara",
    "TR3": "Ege",
    "TR4": "Doğu Marmara",
    "TR5": "Batı Anadolu",
    "TR6": "Akdeniz",
    "TR7": "Orta Anadolu",
    "TR8": "Batı Karadeniz",
    "TR9": "Doğu Karadeniz",
    "TRA": "Kuzeydoğu Anadolu",
    "TRB": "Ortadoğu Anadolu",
    "TRC": "Güneydoğu Anadolu",
}

# Corrections applied in order: wrong spellings first, then missing
# Turkish characters.
_NAME_CORRECTIONS = [
    ("Kinkkale", "Kırıkkale"),
    ("Zinguldak", "Zonguldak"),
    ("K. Maras", "Kahramanmaraş"),
    ("Adiyaman", "Adıyaman"),
    ("Agri", "Ağrı"),
    ("Aydin", "Aydın"),
    ("Balikesir", "Balıkesir"),
    ("Çankiri", "Çankırı"),
    ("Diyarbakir", "Diyarbakır"),
    ("Elazig", "Elâzığ"),
    ("Eskisehir", "Eskişehir"),
    ("Gümüshane", "Gümüşhane"),
    ("Hakkari", "Hakkâri"),
    ("Istanbul", "İstanbul"),
    ("Izmir", "İzmir"),
    ("Iğdir", "Iğdır"),
    ("Kirklareli", "Kırklareli"),
    ("Kirsehir", "Kırşehir"),
    ("Mugla", "Muğla"),
    ("Mus", "Muş"),
    ("Nevsehir", "Nevşehir"),
    ("Nigde", "Niğde"),
    ("Sanliurfa", "Şanlıurfa"),
    ("Sirnak", "Şırnak"),
    ("Tekirdag", "Tekirdağ"),
    ("Usak", "Uşak"),
]


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    turkey = ctx.df[ctx.df.admin == "Turkey"][["iso_3166_2", "name", "geometry"]]

    for old, new in _NAME_CORRECTIONS:
        replace_column("name", turkey, old, new)
    turkey_copy = turkey.copy()

    turkey_regions = create_region_polygons(_REGION_PROVINCES, turkey)
    turkey_regions = turkey_regions.rename(columns={"REGION": "iso_3166_2"})
    turkey_regions["name"] = turkey_regions["iso_3166_2"].map(_REGION_NAMES)

    return {
        NAME: turkey_copy,
        "turkey_regions": turkey_regions,
    }
