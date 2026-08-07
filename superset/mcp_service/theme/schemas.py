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
Pydantic schemas for theme-related responses
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
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.utils.response_utils import humanize_timestamp
from superset.mcp_service.utils.sanitization import sanitize_for_llm_context


class ThemeFilter(ColumnOperator):
    """
    Filter object for theme listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["theme_name"] = Field(
        ...,
        description="Column to filter on. Supported: 'theme_name' (string match).",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Common operators: 'eq' (equals), "
        "'ct' (contains), 'sw' (starts with), 'ew' (ends with).",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ThemeInfo(BaseModel):
    """Theme metadata returned by MCP list/get tools."""

    id: int | None = None
    theme_name: str | None = None
    json_data: str | None = Field(
        None, description="Raw antd design-token JSON configuration as a string"
    )
    uuid: str | None = None
    is_system: bool | None = None
    is_system_default: bool | None = None
    is_system_dark: bool | None = None
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


class ThemeList(PaginatedResponse[ThemeFilter]):
    themes: List[ThemeInfo]


class ListThemesRequest(PaginatedListRequest[ThemeFilter]):
    """Request schema for list_themes."""


class ThemeError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "ThemeError":
        from datetime import timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetThemeInfoRequest(BaseModel):
    """Request schema for get_theme_info with numeric ID or UUID string."""

    identifier: Annotated[
        int | str,
        Field(description="Theme identifier — numeric ID or UUID string"),
    ]


class CreateThemeRequest(BaseModel):
    """Request schema for create_theme."""

    theme_name: Annotated[
        str,
        Field(description="Human-readable name for the theme"),
    ]
    json_data: Annotated[
        dict[str, Any] | str,
        Field(
            description="The antd design-token configuration. Accepts either a JSON "
            "object (dict) or a JSON string."
        ),
    ]

    @field_validator("theme_name")
    @classmethod
    def reject_blank_theme_name(cls, value: str) -> str:
        """Mirror the REST ThemePostSchema check: no empty/whitespace names."""
        if not value or not value.strip():
            raise ValueError("Theme name cannot be empty.")
        return value


class CreateThemeResponse(BaseModel):
    success: bool = Field(..., description="Whether the theme was created")
    id: int | None = Field(None, description="ID of the created theme")
    uuid: str | None = Field(None, description="UUID of the created theme")
    theme_name: str | None = Field(None, description="Name of the created theme")
    message: str | None = Field(None, description="Human-readable success message")
    error: str | None = Field(None, description="Error message if creation failed")
    error_type: str | None = Field(None, description="Type of error if creation failed")


def _sanitize_theme_info_for_llm_context(theme_info: ThemeInfo) -> ThemeInfo:
    """Wrap user-controlled theme fields before LLM exposure.

    ``theme_name`` is user-supplied free text. ``json_data`` is structured
    configuration, but its token values (font families, URLs, arbitrary antd
    tokens) are equally user-controlled and pass ``is_valid_theme`` /
    ``sanitize_theme_tokens`` untouched, so the whole JSON string is wrapped
    as one untrusted block — the JSON stays parseable inside the delimiters,
    and embedded delimiter tokens are escaped so a hostile value cannot close
    the wrapper early.
    """
    payload = theme_info.model_dump(mode="python")
    payload["theme_name"] = sanitize_for_llm_context(
        payload.get("theme_name"),
        field_path=("theme_name",),
    )
    payload["json_data"] = sanitize_for_llm_context(
        payload.get("json_data"),
        field_path=("json_data",),
    )
    return ThemeInfo(**payload)


def serialize_theme_object(theme: Any) -> ThemeInfo | None:
    if not theme:
        return None

    return _sanitize_theme_info_for_llm_context(
        ThemeInfo(
            id=getattr(theme, "id", None),
            theme_name=getattr(theme, "theme_name", None),
            json_data=getattr(theme, "json_data", None),
            uuid=str(uuid) if (uuid := getattr(theme, "uuid", None)) else None,
            is_system=getattr(theme, "is_system", None),
            is_system_default=getattr(theme, "is_system_default", None),
            is_system_dark=getattr(theme, "is_system_dark", None),
            changed_on=getattr(theme, "changed_on", None),
            changed_on_humanized=humanize_timestamp(getattr(theme, "changed_on", None)),
            created_on=getattr(theme, "created_on", None),
            created_on_humanized=humanize_timestamp(getattr(theme, "created_on", None)),
        )
    )
