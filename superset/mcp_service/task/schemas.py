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

"""Pydantic schemas for task MCP tools."""

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

DEFAULT_TASK_COLUMNS: list[str] = ["id", "uuid", "task_type", "status", "changed_on"]
ALL_TASK_COLUMNS: list[str] = [
    "id",
    "uuid",
    "task_type",
    "task_key",
    "task_name",
    "status",
    "scope",
    "changed_on",
    "created_on",
]
TASK_SORTABLE_COLUMNS: list[str] = [
    "task_type",
    "scope",
    "status",
    "created_on",
    "changed_on",
    "started_at",
    "ended_at",
]


class TaskColumnFilter(ColumnOperator):
    """Filter object for task listing.

    col: Column to filter on.
    opr: Operator to use.
    value: Value to filter by.
    """

    col: Literal["task_type", "status", "scope"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(..., description="Operator to use.")
    value: str | int | float | bool | list[str | int | float | bool] = Field(
        ..., description="Value to filter by"
    )


class TaskInfo(BaseModel):
    id: int | None = Field(None, description="Task ID")
    uuid: str | None = Field(None, description="Task UUID")
    task_type: str | None = Field(None, description="Task type (e.g., sql_execution)")
    task_key: str | None = Field(None, description="Task deduplication key")
    task_name: str | None = Field(None, description="Human-readable task name")
    status: str | None = Field(None, description="Task status")
    scope: str | None = Field(None, description="Task scope (private/shared/system)")
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
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> dict[str, Any]:
        data = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}
        return data


class TaskList(BaseModel):
    tasks: list[TaskInfo]
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
    filters_applied: list[TaskColumnFilter] = Field(default_factory=list)
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListTasksRequest(BaseModel):
    """Request schema for list_tasks."""

    filters: Annotated[
        list[TaskColumnFilter],
        Field(
            default_factory=list,
            description=(
                "List of filter objects (col, opr, value). "
                "Filter columns: task_type, status, scope. "
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
                "Text search string matched against task_type, task_key, "
                "task_name, status, and scope. "
                "Cannot be used together with 'filters'."
            ),
        ),
    ]
    order_column: Annotated[
        str | None,
        Field(default=None, description="Column to sort by (default: created_on)"),
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
    def parse_filters(cls, v: Any) -> list[TaskColumnFilter]:
        return parse_json_or_model_list(v, TaskColumnFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> list[str]:
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListTasksRequest":
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' simultaneously. "
                "Use 'search' for text matching on task_type/status/scope, or "
                "'filters' for column-based filtering, but not both."
            )
        return self


class TaskError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Error type")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "TaskError":
        return cls(
            error=error,
            error_type=error_type,
            timestamp=datetime.now(timezone.utc),
        )


class GetTaskInfoRequest(BaseModel):
    """Request schema for get_task_info (ID or UUID lookup)."""

    identifier: Annotated[
        int | str,
        Field(description="Task identifier — numeric ID or UUID string"),
    ]


def serialize_task_object(task: Any) -> TaskInfo | None:
    if not task:
        return None
    uuid_val = getattr(task, "uuid", None)
    changed_on = getattr(task, "changed_on", None)
    if isinstance(changed_on, datetime) and changed_on.tzinfo is None:
        changed_on = changed_on.replace(tzinfo=timezone.utc)
    created_on = getattr(task, "created_on", None)
    if isinstance(created_on, datetime) and created_on.tzinfo is None:
        created_on = created_on.replace(tzinfo=timezone.utc)
    return TaskInfo(
        id=getattr(task, "id", None),
        uuid=str(uuid_val) if uuid_val is not None else None,
        task_type=getattr(task, "task_type", None),
        task_key=sanitize_for_llm_context(
            getattr(task, "task_key", None),
            field_path=("task_key",),
        ),
        task_name=sanitize_for_llm_context(
            getattr(task, "task_name", None),
            field_path=("task_name",),
        ),
        status=getattr(task, "status", None),
        scope=getattr(task, "scope", None),
        changed_on=changed_on,
        created_on=created_on,
    )
