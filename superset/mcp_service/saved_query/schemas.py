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
Pydantic schemas for saved query-related responses
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
from superset.mcp_service.privacy import filter_user_directory_fields

DEFAULT_SAVED_QUERY_COLUMNS = ["id", "label", "db_id", "schema", "uuid"]
SORTABLE_SAVED_QUERY_COLUMNS = [
    "id",
    "label",
    "db_id",
    "schema",
    "changed_on",
    "created_on",
]


class SavedQueryFilter(ColumnOperator):
    """
    Filter object for saved query listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["label", "db_id", "schema", "catalog", "created_by_fk"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class SavedQueryInfo(BaseModel):
    id: int | None = Field(None, description="Saved query ID")
    uuid: str | None = Field(None, description="Saved query UUID")
    label: str | None = Field(None, description="Saved query label/name")
    sql: str | None = Field(None, description="SQL query text")
    db_id: int | None = Field(None, description="Database connection ID")
    schema: str | None = Field(None, description="Database schema name")
    catalog: str | None = Field(None, description="Database catalog name")
    description: str | None = Field(None, description="User-provided description")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    last_run: str | datetime | None = Field(
        None, description="Timestamp of last execution"
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        data = filter_user_directory_fields(serializer(self))

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class SavedQueryList(PaginatedResponse[SavedQueryFilter]):
    saved_queries: List[SavedQueryInfo]


class ListSavedQueriesRequest(PaginatedListRequest[SavedQueryFilter]):
    """Request schema for list_saved_queries."""


class SavedQueryError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class GetSavedQueryInfoRequest(BaseModel):
    """Request schema for get_saved_query_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Saved query identifier - can be numeric ID or UUID string"),
    ]


def serialize_saved_query_object(saved_query: Any) -> SavedQueryInfo | None:
    if not saved_query:
        return None

    return SavedQueryInfo(
        id=getattr(saved_query, "id", None),
        uuid=str(getattr(saved_query, "uuid", ""))
        if getattr(saved_query, "uuid", None)
        else None,
        label=getattr(saved_query, "label", None),
        sql=getattr(saved_query, "sql", None),
        db_id=getattr(saved_query, "db_id", None),
        schema=getattr(saved_query, "schema", None),
        catalog=getattr(saved_query, "catalog", None),
        description=getattr(saved_query, "description", None),
        changed_on=getattr(saved_query, "changed_on", None),
        created_on=getattr(saved_query, "created_on", None),
        last_run=getattr(saved_query, "last_run", None),
    )
