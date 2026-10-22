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
"""Downloads and loads the Natural Earth datasets the notebook's
"Download Data" / "Read Natural Earth data files" cells produce.
"""

from __future__ import annotations

import os

import geopandas as gpd
import pandas as pd
import requests

from .context import BuildContext

NATURAL_EARTH_URLS = [
    "https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries.zip",
    "https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_1_states_provinces.zip",
    "https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/50m/cultural/ne_50m_admin_1_states_provinces.zip",
]

# Natural Earth's own download URL 404s; this mirror is the notebook's
# existing "temporary fix" for the same problem.
_NATURAL_EARTH_URL_FIX = (
    "https://www.naturalearthdata.com/http//www.naturalearthdata.com/download",
    "https://naciscdn.org/naturalearth",
)

_REQUEST_HEADERS = {
    "accept-encoding": "gzip, deflate, br",
    "user-agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"
    ),
}


def download_natural_earth(data_dir: str, skip_existing: bool = True) -> None:
    os.makedirs(data_dir, exist_ok=True)
    for url in NATURAL_EARTH_URLS:
        file_name = url.split("/")[-1]
        full_file_name = os.path.join(data_dir, file_name)
        resolved_url = url.replace(*_NATURAL_EARTH_URL_FIX)
        with requests.get(
            resolved_url, headers=_REQUEST_HEADERS, stream=True, timeout=120
        ) as res:
            if res.status_code != 200:
                raise RuntimeError(
                    f"Failed to download {file_name}: HTTP {res.status_code}"
                )
            file_size = int(res.headers["content-length"])
            if (
                skip_existing
                and os.path.exists(full_file_name)
                and file_size == os.path.getsize(full_file_name)
            ):
                continue
            with open(full_file_name, "wb") as fh:
                fh.write(res.content)


def load_natural_earth(data_dir: str, skip_existing: bool = True) -> BuildContext:
    download_natural_earth(data_dir, skip_existing=skip_existing)

    df_admin0_10m = gpd.read_file(
        os.path.join(data_dir, "ne_10m_admin_0_countries.zip")
    )
    df_10m = gpd.read_file(
        os.path.join(data_dir, "ne_10m_admin_1_states_provinces.zip")
    )
    df_50m = gpd.read_file(
        os.path.join(data_dir, "ne_50m_admin_1_states_provinces.zip")
    )

    df_admin0_10m.columns = df_admin0_10m.columns.str.lower()

    # Use 1:50m geometry for the (large) countries Natural Earth ships at
    # that resolution; 1:10m for everyone else.
    df = pd.concat([df_10m[~df_10m["admin"].isin(df_50m["admin"].unique())], df_50m])

    return BuildContext(
        df=df,
        df_admin0_10m=df_admin0_10m,
        df_50m_admins=set(df_50m["admin"].str.lower().unique()),
    )
