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
"""Asset-type configuration shared by the folders DAO, schemas, and API.

A ``FolderObject`` links a folder to exactly one asset via a dedicated FK column
(``dashboard_id``/``chart_id``/``dataset_id``). This module maps each asset type
to its FK column and owning model, and defines which asset kinds belong to each
folder namespace (``folder_type``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

DEFAULT_FOLDER_TYPE = "analytics"


@dataclass(frozen=True)
class AssetType:
    """Describes how an asset kind maps onto ``FolderObject`` and its model."""

    name: str
    fk_column: str
    title_attr: str
    model_loader: Callable[[], type[Any]]

    @property
    def model(self) -> type[Any]:
        return self.model_loader()


def _load_dashboard() -> type[Any]:
    from superset.models.dashboard import Dashboard

    return Dashboard


def _load_chart() -> type[Any]:
    from superset.models.slice import Slice

    return Slice


def _load_dataset() -> type[Any]:
    from superset.connectors.sqla.models import SqlaTable

    return SqlaTable


ASSET_TYPE_CONFIGS: dict[str, AssetType] = {
    "dashboard": AssetType(
        "dashboard", "dashboard_id", "dashboard_title", _load_dashboard
    ),
    "chart": AssetType("chart", "chart_id", "slice_name", _load_chart),
    "dataset": AssetType("dataset", "dataset_id", "table_name", _load_dataset),
}

ASSET_TYPES = set(ASSET_TYPE_CONFIGS)

# Which asset kinds surface under each folder namespace.
FOLDER_TYPE_ASSETS: dict[str, list[str]] = {
    "analytics": ["dashboard", "chart"],
}


def asset_types_for_folder_type(folder_type: str) -> list[str]:
    """Return the asset kinds shown for a given ``folder_type``."""
    return FOLDER_TYPE_ASSETS.get(folder_type, [])
