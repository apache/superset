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
Pydantic schemas for saved widget MCP tools
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal

from pydantic import BaseModel, ConfigDict, Field, model_serializer

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.utils.response_utils import humanize_timestamp


class WidgetListFilter(ColumnOperator):
    """
    Filter object for widget listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["name", "widget_type"] = Field(
        ...,
        description="Column to filter on. Supported: 'name' and 'widget_type' "
        "(the namespaced id of the registered widget, such as 'markdown').",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Common operators: 'eq' (equals), "
        "'ct' (contains), 'sw' (starts with), 'ew' (ends with).",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class WidgetInfo(BaseModel):
    """Saved widget metadata returned by MCP list/get tools."""

    id: int | None = None
    uuid: str | None = None
    widget_type: str | None = Field(
        None, description="Namespaced id of the registered widget, such as 'markdown'"
    )
    schema_version: int | None = Field(
        None, description="Version of the widget's schema that the props conform to"
    )
    name: str | None = None
    description: str | None = Field(
        None,
        description="What the widget shows, its business meaning and any caveats",
    )
    props: Dict[str, Any] | None = Field(
        None, description="The widget's type-specific values"
    )
    revision: int | None = Field(
        None, description="Incremented on every change; send it back when updating"
    )
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: str | None = Field(
        None, description="Humanized modification time"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    created_on_humanized: str | None = Field(
        None, description="Humanized creation time"
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter serialized fields to those requested via select_columns context."""
        data: Dict[str, Any] = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}
        return data


class WidgetList(PaginatedResponse[WidgetListFilter]):
    widgets: List[WidgetInfo]


class ListWidgetsRequest(PaginatedListRequest[WidgetListFilter]):
    """Request schema for list_widgets."""


class WidgetError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class GetWidgetInfoRequest(BaseModel):
    """Request schema for get_widget_info with numeric ID or UUID string."""

    identifier: Annotated[
        int | str,
        Field(description="Widget identifier — numeric ID or UUID string"),
    ]


def serialize_widget_object(widget: Any) -> WidgetInfo | None:
    if not widget:
        return None

    return WidgetInfo(
        id=getattr(widget, "id", None),
        uuid=str(uuid) if (uuid := getattr(widget, "uuid", None)) else None,
        widget_type=getattr(widget, "widget_type", None),
        schema_version=getattr(widget, "schema_version", None),
        name=getattr(widget, "name", None),
        description=getattr(widget, "description", None),
        props=getattr(widget, "props", None),
        revision=getattr(widget, "revision", None),
        changed_on=getattr(widget, "changed_on", None),
        changed_on_humanized=humanize_timestamp(getattr(widget, "changed_on", None)),
        created_on=getattr(widget, "created_on", None),
        created_on_humanized=humanize_timestamp(getattr(widget, "created_on", None)),
    )
