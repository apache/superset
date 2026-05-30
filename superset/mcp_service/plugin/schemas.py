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

"""
Pydantic schemas for dynamic plugin responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
    PositiveInt,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)

DEFAULT_PLUGIN_COLUMNS = ["id", "name", "key", "bundle_url"]

ALL_PLUGIN_COLUMNS = [
    "id",
    "name",
    "key",
    "bundle_url",
    "changed_on",
    "created_on",
]

SORTABLE_PLUGIN_COLUMNS = ["id", "name", "key", "changed_on", "created_on"]


class PluginColumnFilter(ColumnOperator):
    """Filter object for plugin listing."""

    col: Literal["name", "key"] = Field(..., description="Column to filter on.")
    opr: ColumnOperatorEnum = Field(..., description="Operator to use.")
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by"
    )


class PluginInfo(BaseModel):
    id: int | None = Field(None, description="Plugin ID")
    name: str | None = Field(None, description="Plugin display name")
    key: str | None = Field(None, description="Plugin key (corresponds to viz_type)")
    bundle_url: str | None = Field(None, description="URL to the plugin bundle")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        data = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}
        return data


class PluginList(BaseModel):
    plugins: List[PluginInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: List[str] = Field(default_factory=list)
    columns_loaded: List[str] = Field(default_factory=list)
    columns_available: List[str] = Field(default_factory=list)
    sortable_columns: List[str] = Field(default_factory=list)
    filters_applied: List[PluginColumnFilter] = Field(default_factory=list)
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListPluginsRequest(BaseModel):
    """Request schema for list_plugins."""

    filters: Annotated[
        List[PluginColumnFilter],
        Field(
            default_factory=list,
            description="List of filter objects (col, opr, value). "
            "Cannot be used with search.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=list,
            description="Columns to include in response. Defaults to common columns.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search on plugin name or key. "
            "Cannot be used with filters.",
        ),
    ]
    order_column: Annotated[
        str | None, Field(default=None, description="Column to order results by")
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(default="desc", description="Sort direction"),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number (1-based)"),
    ]
    page_size: Annotated[
        int,
        Field(
            default=DEFAULT_PAGE_SIZE,
            gt=0,
            le=MAX_PAGE_SIZE,
            description=f"Items per page (max {MAX_PAGE_SIZE})",
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[PluginColumnFilter]:
        return parse_json_or_model_list(v, PluginColumnFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListPluginsRequest":
        if self.search and self.filters:
            raise ValueError("Cannot use both 'search' and 'filters' simultaneously.")
        return self


class PluginError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "PluginError":
        from datetime import timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetPluginInfoRequest(BaseModel):
    """Request schema for get_plugin_info."""

    identifier: Annotated[
        int,
        Field(description="Plugin ID"),
    ]


def serialize_plugin_object(plugin: Any) -> PluginInfo | None:
    if not plugin:
        return None

    return PluginInfo(
        id=getattr(plugin, "id", None),
        name=getattr(plugin, "name", None),
        key=getattr(plugin, "key", None),
        bundle_url=getattr(plugin, "bundle_url", None),
        changed_on=getattr(plugin, "changed_on", None),
        created_on=getattr(plugin, "created_on", None),
    )
