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
Pydantic schemas for report (alerts & reports) related responses.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.cache_schemas import (
    CreatedByMeMixin,
    EditedByMeMixin,
    MetadataCacheControl,
)
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.privacy import (
    filter_user_directory_fields,
    strip_user_directory_fields_from_schema,
)
from superset.mcp_service.system.schemas import (
    serialize_subject_object,
    SubjectInfo,
)
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.mcp_service.utils.response_utils import humanize_timestamp


class ReportFilter(ColumnOperator):
    """
    Filter object for report listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "name",
        "type",
        "active",
        "dashboard_id",
        "chart_id",
        "last_state",
        "creation_method",
    ] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='report') for "
        "available filter columns.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='report') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ReportInfo(BaseModel):
    id: int | None = Field(None, description="Report/Alert ID")
    name: str | None = Field(None, description="Report/Alert name")
    description: str | None = Field(None, description="Report/Alert description")
    type: str | None = Field(None, description="Schedule type: 'Alert' or 'Report'")
    active: bool | None = Field(None, description="Whether the schedule is active")
    crontab: str | None = Field(None, description="Cron expression for scheduling")
    dashboard_id: int | None = Field(
        None, description="Associated dashboard ID, if any"
    )
    chart_id: int | None = Field(None, description="Associated chart ID, if any")
    last_eval_dttm: str | datetime | None = Field(
        None, description="Last report/alert evaluation timestamp"
    )
    last_eval_dttm_humanized: str | None = Field(
        None, description="Humanized last evaluation time"
    )
    last_state: str | None = Field(
        None, description="Last report/alert execution state"
    )
    creation_method: str | None = Field(
        None, description="How the report/alert was created"
    )
    editors: List[SubjectInfo] = Field(
        default_factory=list, description="Report/Alert editors"
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
        json_schema_extra=strip_user_directory_fields_from_schema,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter fields based on serialization context.

        If context contains 'select_columns', only include those fields.
        Otherwise, include all fields (default behavior).
        """
        data = filter_user_directory_fields(serializer(self))

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class ReportList(PaginatedResponse[ReportFilter]):
    reports: List[ReportInfo]


class ListReportsRequest(
    EditedByMeMixin,
    CreatedByMeMixin,
    MetadataCacheControl,
    PaginatedListRequest[ReportFilter],
):
    """Request schema for list_reports."""


class ReportError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str) -> str:
        """Wrap error text before it is exposed to LLM context."""
        return sanitize_for_llm_context(value, field_path=("error",))

    @classmethod
    def create(cls, error: str, error_type: str) -> "ReportError":
        """Create a standardized ReportError with timestamp."""
        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetReportInfoRequest(MetadataCacheControl):
    """Request schema for get_report_info — identifier is a numeric ID only."""

    identifier: Annotated[
        int,
        Field(description="Report/Alert numeric ID"),
    ]


def serialize_report_object(report: Any) -> ReportInfo | None:
    if not report:
        return None

    return ReportInfo(
        id=getattr(report, "id", None),
        name=sanitize_for_llm_context(
            getattr(report, "name", None),
            field_path=("name",),
        ),
        description=sanitize_for_llm_context(
            getattr(report, "description", None),
            field_path=("description",),
        ),
        type=getattr(report, "type", None),
        active=getattr(report, "active", None),
        crontab=getattr(report, "crontab", None),
        dashboard_id=getattr(report, "dashboard_id", None),
        chart_id=getattr(report, "chart_id", None),
        last_eval_dttm=getattr(report, "last_eval_dttm", None),
        last_eval_dttm_humanized=humanize_timestamp(
            getattr(report, "last_eval_dttm", None)
        ),
        last_state=getattr(report, "last_state", None),
        creation_method=getattr(report, "creation_method", None),
        editors=[
            editor
            for editor in (
                serialize_subject_object(subject)
                for subject in getattr(report, "editors", [])
            )
            if editor is not None
        ],
        changed_on=getattr(report, "changed_on", None),
        changed_on_humanized=humanize_timestamp(getattr(report, "changed_on", None)),
        created_on=getattr(report, "created_on", None),
        created_on_humanized=humanize_timestamp(getattr(report, "created_on", None)),
    )
