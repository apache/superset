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
Pydantic schemas for tag-related responses
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_serializer,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.system.schemas import TagInfo as BaseTagInfo
from superset.mcp_service.utils.response_utils import humanize_timestamp
from superset.mcp_service.utils.sanitization import sanitize_for_llm_context


class TagFilter(ColumnOperator):
    """
    Filter object for tag listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["name", "type"] = Field(
        ...,
        description="Column to filter on. Supported: 'name' (string match), "
        "'type' (tag type: custom, type, editor, favorited_by).",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Common operators: 'eq' (equals), "
        "'ct' (contains), 'sw' (starts with), 'ew' (ends with).",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class TagInfo(BaseTagInfo):
    """Extends the shared BaseTagInfo with audit timestamps for MCP list/get tools."""

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


class TagList(PaginatedResponse[TagFilter]):
    tags: List[TagInfo]


class ListTagsRequest(PaginatedListRequest[TagFilter]):
    """Request schema for list_tags."""


class TagError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "TagError":
        from datetime import timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetTagInfoRequest(BaseModel):
    """Request schema for get_tag_info with numeric ID."""

    identifier: Annotated[
        int,
        Field(description="Tag identifier — numeric ID"),
    ]


def _sanitize_tag_info_for_llm_context(tag_info: TagInfo) -> TagInfo:
    """Wrap user-controlled tag fields before LLM exposure."""
    payload = tag_info.model_dump(mode="python")
    for field_name in ("name", "description"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )
    return TagInfo(**payload)


def serialize_tag_object(tag: Any) -> TagInfo | None:
    if not tag:
        return None

    type_str: str | None = None
    if (raw_type := getattr(tag, "type", None)) is not None:
        type_str = raw_type.name if hasattr(raw_type, "name") else str(raw_type)

    return _sanitize_tag_info_for_llm_context(
        TagInfo(
            id=getattr(tag, "id", None),
            name=getattr(tag, "name", None),
            type=type_str,
            description=getattr(tag, "description", None),
            changed_on=getattr(tag, "changed_on", None),
            changed_on_humanized=humanize_timestamp(getattr(tag, "changed_on", None)),
            created_on=getattr(tag, "created_on", None),
            created_on_humanized=humanize_timestamp(getattr(tag, "created_on", None)),
        )
    )
