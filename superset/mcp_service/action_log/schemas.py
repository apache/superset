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

"""Pydantic schemas for action-log MCP tools."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

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
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)
from superset.utils import json as json_utils

DEFAULT_LOG_COLUMNS: list[str] = ["id", "action", "user_id", "dttm"]
ALL_LOG_COLUMNS: list[str] = [
    "id",
    "action",
    "user_id",
    "dttm",
    "dashboard_id",
    "slice_id",
    "json",
]
LOG_SORTABLE_COLUMNS: list[str] = ["id", "dttm"]


class ActionLogFilter(ColumnOperator):
    """Filter object for action-log listing.

    col: Column to filter on.
    opr: Operator to use.
    value: Value to filter by.
    """

    col: Literal["action", "user_id", "dashboard_id", "slice_id", "dttm"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(..., description="Operator to use.")
    value: (
        str | int | float | bool | datetime | list[str | int | float | bool | datetime]
    ) = Field(..., description="Value to filter by")

    @model_validator(mode="after")
    def normalize_dttm_value(self) -> "ActionLogFilter":
        """Normalize string dttm values to datetime to avoid VARCHAR bind mismatch.

        Pydantic's left-to-right union matching keeps ISO strings as str when
        str appears before datetime in the union.  This validator parses them so
        the DAO always receives a typed datetime for TIMESTAMP column comparisons.
        Both scalar and list values are normalized so dttm IN (...) is also safe.

        Replaces a trailing 'Z' with '+00:00' before parsing because
        datetime.fromisoformat does not accept the 'Z' suffix on Python < 3.11.
        """

        def _parse(val: str) -> datetime | str:
            try:
                s = val[:-1] + "+00:00" if val.endswith("Z") else val
                parsed = datetime.fromisoformat(s)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                return val

        if self.col == "dttm":
            if isinstance(self.value, str):
                self.value = _parse(self.value)
            elif isinstance(self.value, list):
                self.value = [
                    _parse(v) if isinstance(v, str) else v for v in self.value
                ]
        return self


class ActionLogInfo(BaseModel):
    id: int | None = Field(None, description="Log entry ID")
    action: str | None = Field(None, description="Action name")
    user_id: int | None = Field(
        None, description="ID of the user who performed the action"
    )
    dttm: str | datetime | None = Field(None, description="Timestamp of the action")
    dashboard_id: int | None = Field(None, description="Associated dashboard ID")
    slice_id: int | None = Field(None, description="Associated chart/slice ID")
    json: str | None = Field(
        None,
        description="JSON payload (user-controlled, wrapped in UNTRUSTED-CONTENT)",
    )

    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    def model_post_init(self, __context: Any) -> None:
        if isinstance(self.dttm, datetime) and self.dttm.tzinfo is None:
            object.__setattr__(self, "dttm", self.dttm.replace(tzinfo=timezone.utc))

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> dict[str, Any]:
        data = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}
        return data


class ActionLogList(BaseModel):
    action_logs: list[ActionLogInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: list[str] = Field(default_factory=list)
    columns_loaded: list[str] = Field(default_factory=list)
    columns_available: list[str] = Field(default_factory=list)
    sortable_columns: list[str] = Field(default_factory=list)
    filters_applied: list[ActionLogFilter] = Field(default_factory=list)
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListActionLogsRequest(BaseModel):
    """Request schema for list_action_logs."""

    filters: Annotated[
        list[ActionLogFilter],
        Field(
            default_factory=list,
            description=(
                "List of filter objects (col, opr, value). "
                "Filter columns: action, user_id, dashboard_id, slice_id, dttm. "
                "Cannot be used with 'search'."
            ),
        ),
    ]
    select_columns: Annotated[
        list[str],
        Field(
            default_factory=list,
            description="Columns to return. Defaults to common columns.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description=(
                "Text search string matched against action. "
                "Cannot be used together with 'filters'."
            ),
        ),
    ]
    order_column: Annotated[
        str | None,
        Field(default=None, description="Column to sort by (default: dttm)"),
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(default="desc", description="Sort direction ('asc' or 'desc')"),
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
    def parse_filters(cls, v: Any) -> list[ActionLogFilter]:
        return parse_json_or_model_list(v, ActionLogFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> list[str]:
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListActionLogsRequest":
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' simultaneously. "
                "Use 'search' for text matching on action, or 'filters' for "
                "column-based filtering, but not both."
            )
        return self


class ActionLogError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Error type")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "ActionLogError":
        return cls(
            error=error,
            error_type=error_type,
            timestamp=datetime.now(timezone.utc),
        )


class GetActionLogInfoRequest(BaseModel):
    """Request schema for get_action_log_info (ID-only lookup)."""

    identifier: Annotated[
        int,
        Field(description="Log entry ID (integer)"),
    ]


def _sanitize_log_json(raw: Any) -> str | None:
    """Serialize the log JSON blob to a canonical string and wrap it in
    UNTRUSTED-CONTENT delimiters.

    The entire JSON blob — keys and values alike — is user-controlled and must
    be treated as untrusted. Wrapping the canonical JSON string (rather than
    processing individual dict leaves) closes the dict-key injection gap: no
    key can inject instructions because every byte of the blob is enclosed
    within the trust boundary.
    Falls back to wrapping the raw string when the payload is not valid JSON.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            canonical = json_utils.dumps(json_utils.loads(raw))
        except (ValueError, TypeError):
            canonical = raw
    else:
        try:
            canonical = json_utils.dumps(raw)
        except (ValueError, TypeError):
            canonical = str(raw)
    return sanitize_for_llm_context(
        canonical,
        field_path=("json",),
        excluded_field_names=frozenset(),
    )


def serialize_action_log_object(log: Any) -> ActionLogInfo | None:
    if not log:
        return None
    dttm = getattr(log, "dttm", None)
    if isinstance(dttm, datetime) and dttm.tzinfo is None:
        dttm = dttm.replace(tzinfo=timezone.utc)
    return ActionLogInfo(
        id=getattr(log, "id", None),
        action=getattr(log, "action", None),
        user_id=getattr(log, "user_id", None),
        dttm=dttm,
        dashboard_id=getattr(log, "dashboard_id", None),
        slice_id=getattr(log, "slice_id", None),
        json=_sanitize_log_json(getattr(log, "json", None)),
    )
