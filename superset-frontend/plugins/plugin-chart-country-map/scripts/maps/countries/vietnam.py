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
"""Vietnam: corrects province/city name spellings and diacritics."""

from __future__ import annotations

import geopandas as gpd

from maps.context import BuildContext
from maps.helpers import replace_column

NAME = "vietnam"

_NAME_CORRECTIONS = [
    ("Ðong Tháp", "Đồng Tháp"),
    ("Son La", "Sơn La"),
    ("Ha Tinh", "Hà Tĩnh"),
    ("Quàng Nam", "Quảng Nam"),
    ("Lai Chau", "Lai Châu"),
    ("Hồ Chí Minh city", "Thành phố Hồ Chí Minh"),
    ("Hau Giang", "Hậu Giang"),
    ("Ha Noi", "Hà Nội"),
    ("Can Tho", "Cần Thơ"),
    ("Đông Nam Bộ", "Đồng Nai"),
    ("Đông Bắc", "Bắc Kạn"),
    ("Đồng Bằng Sông Hồng", "Hưng Yên"),
]


def build(ctx: BuildContext) -> dict[str, gpd.GeoDataFrame]:
    vietnam_copy = ctx.df[ctx.df.admin == "Vietnam"].copy()
    for old, new in _NAME_CORRECTIONS:
        replace_column("name", vietnam_copy, old, new)

    return {NAME: vietnam_copy}
