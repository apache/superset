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
Pydantic schemas for row level security filter responses.
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

DEFAULT_RLS_COLUMNS = ["id", "name", "filter_type", "clause"]

ALL_RLS_COLUMNS = [
    "id",
    "name",
    "filter_type",
    "tables",
    "subjects",
    "clause",
    "group_key",
    "changed_on",
]

SORTABLE_RLS_COLUMNS = ["id", "name", "filter_type", "changed_on"]


class RlsColumnFilter(ColumnOperator):
    """Filter object for RLS filter listing."""

    col: Literal["name", "filter_type"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(..., description="Operator to use.")
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by"
    )


class RlsTableRef(BaseModel):
    id: int | None = Field(None, description="Table ID")
    table_name: str | None = Field(None, description="Table name")
    model_config = ConfigDict(from_attributes=True)


class RlsSubjectRef(BaseModel):
    id: int | None = Field(None, description="Subject ID")
    label: str | None = Field(None, description="Subject label")
    secondary_label: str | None = Field(None, description="Secondary subject label")
    type: int | None = Field(None, description="Subject type")
    model_config = ConfigDict(from_attributes=True)


class RlsFilterInfo(BaseModel):
    id: int | None = Field(None, description="RLS filter ID")
    name: str | None = Field(None, description="RLS filter name")
    filter_type: str | None = Field(None, description="Filter type: Regular or Base")
    tables: List[RlsTableRef] | None = Field(
        None, description="Tables this filter applies to"
    )
    subjects: List[RlsSubjectRef] | None = Field(
        None, description="Subjects this filter applies to"
    )
    clause: str | None = Field(None, description="SQL WHERE clause")
    group_key: str | None = Field(
        None, description="Group key for Base filter grouping"
    )
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
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


class RlsFilterList(PaginatedResponse[RlsColumnFilter]):
    rls_filters: List[RlsFilterInfo]


class ListRlsFiltersRequest(PaginatedListRequest[RlsColumnFilter]):
    """Request schema for list_rls_filters."""


class RlsFilterError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "RlsFilterError":
        from datetime import timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetRlsFilterInfoRequest(BaseModel):
    """Request schema for get_rls_filter_info."""

    identifier: Annotated[
        int,
        Field(description="RLS filter ID"),
    ]


def serialize_rls_filter_object(rls_filter: Any) -> RlsFilterInfo | None:
    if not rls_filter:
        return None

    tables = [
        RlsTableRef(
            id=getattr(t, "id", None),
            table_name=getattr(t, "table_name", None),
        )
        for t in (getattr(rls_filter, "tables", None) or [])
    ]

    subjects = [
        RlsSubjectRef(
            id=getattr(subject, "id", None),
            label=getattr(subject, "label", None),
            secondary_label=getattr(subject, "secondary_label", None),
            type=getattr(subject, "type", None),
        )
        for subject in (getattr(rls_filter, "subjects", None) or [])
    ]

    return RlsFilterInfo(
        id=getattr(rls_filter, "id", None),
        name=getattr(rls_filter, "name", None),
        filter_type=getattr(rls_filter, "filter_type", None),
        tables=tables,
        subjects=subjects,
        clause=getattr(rls_filter, "clause", None),
        group_key=getattr(rls_filter, "group_key", None),
        changed_on=getattr(rls_filter, "changed_on", None),
    )
