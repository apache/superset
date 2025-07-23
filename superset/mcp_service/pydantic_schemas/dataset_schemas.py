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
Pydantic schemas for dataset-related responses
"""

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator, PositiveInt

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.pydantic_schemas.system_schemas import (
    PaginationInfo,
    TagInfo,
    UserInfo,
)
from superset.utils import json


class DatasetAvailableFilters(BaseModel):
    column_operators: Dict[str, List[str]] = Field(
        ...,
        description="Available filter operators for each column: mapping from column "
        "name to list of supported operators",
    )


class DatasetFilter(ColumnOperator):
    """
    Filter object for dataset listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "table_name",
        "schema",
        "owner",
    ] = Field(
        ...,
        description="Column to filter on. See get_dataset_available_filters for "
        "allowed values.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. See get_dataset_available_filters for "
        "allowed values.",
    )
    value: Any = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class TableColumnInfo(BaseModel):
    column_name: str = Field(..., description="Column name")
    verbose_name: Optional[str] = Field(None, description="Verbose name")
    type: Optional[str] = Field(None, description="Column type")
    is_dttm: Optional[bool] = Field(None, description="Is datetime column")
    groupby: Optional[bool] = Field(None, description="Is groupable")
    filterable: Optional[bool] = Field(None, description="Is filterable")
    description: Optional[str] = Field(None, description="Column description")


class SqlMetricInfo(BaseModel):
    metric_name: str = Field(..., description="Metric name")
    verbose_name: Optional[str] = Field(None, description="Verbose name")
    expression: Optional[str] = Field(None, description="SQL expression")
    description: Optional[str] = Field(None, description="Metric description")
    d3format: Optional[str] = Field(None, description="D3 format string")


class DatasetInfo(BaseModel):
    id: Optional[int] = Field(None, description="Dataset ID")
    table_name: Optional[str] = Field(None, description="Table name")
    schema: Optional[str] = Field(None, description="Schema name")
    database_name: Optional[str] = Field(None, description="Database name")
    description: Optional[str] = Field(None, description="Dataset description")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_on: Optional[Union[str, datetime]] = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: Optional[str] = Field(
        None, description="Humanized modification time"
    )
    created_by: Optional[str] = Field(None, description="Dataset creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(
        None, description="Creation timestamp"
    )
    created_on_humanized: Optional[str] = Field(
        None, description="Humanized creation time"
    )
    tags: List[TagInfo] = Field(default_factory=list, description="Dataset tags")
    owners: List[UserInfo] = Field(
        default_factory=list, description="DatasetInfo owners"
    )
    is_virtual: Optional[bool] = Field(
        None, description="Whether the dataset is virtual (uses SQL)"
    )
    database_id: Optional[int] = Field(None, description="Database ID")
    schema_perm: Optional[str] = Field(None, description="Schema permission string")
    url: Optional[str] = Field(None, description="Dataset URL")
    sql: Optional[str] = Field(None, description="SQL for virtual datasets")
    main_dttm_col: Optional[str] = Field(None, description="Main datetime column")
    offset: Optional[int] = Field(None, description="Offset")
    cache_timeout: Optional[int] = Field(None, description="Cache timeout")
    params: Optional[Dict[str, Any]] = Field(None, description="Extra params")
    template_params: Optional[Dict[str, Any]] = Field(
        None, description="Template params"
    )
    extra: Optional[Dict[str, Any]] = Field(None, description="Extra metadata")
    columns: List[TableColumnInfo] = Field(
        default_factory=list, description="Columns in the dataset"
    )
    metrics: List[SqlMetricInfo] = Field(
        default_factory=list, description="Metrics in the dataset"
    )
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class DatasetList(BaseModel):
    datasets: List[DatasetInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: Optional[List[str]] = None
    columns_loaded: Optional[List[str]] = None
    filters_applied: List[DatasetFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListDatasetsRequest(BaseModel):
    """Request schema for list_datasets with clear, unambiguous types."""

    filters: Annotated[
        List[DatasetFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Each "
            "filter is an object with 'col', 'opr', and 'value' "
            "properties. Cannot be used together with 'search'.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=lambda: [
                "id",
                "table_name",
                "schema",
                "database_name",
                "changed_by_name",
                "changed_on",
                "created_by_name",
                "created_on",
                "metrics",
                "columns",
            ],
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
        ),
    ]
    search: Annotated[
        Optional[str],
        Field(
            default=None,
            description="Text search string to match against dataset fields. Cannot "
            "be used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        Optional[str], Field(default=None, description="Column to order results by")
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="asc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number for pagination (1-based)"),
    ]
    page_size: Annotated[
        PositiveInt, Field(default=100, description="Number of items per page")
    ]

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListDatasetsRequest":
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class DatasetError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(
        None, description="Error timestamp"
    )
    model_config = ConfigDict(ser_json_timedelta="iso8601")


def serialize_dataset_object(dataset: Any) -> Optional[DatasetInfo]:
    if not dataset:
        return None
    params = getattr(dataset, "params", None)
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except Exception:
            params = None
    columns = [
        TableColumnInfo(
            column_name=getattr(col, "column_name", None),
            verbose_name=getattr(col, "verbose_name", None),
            type=getattr(col, "type", None),
            is_dttm=getattr(col, "is_dttm", None),
            groupby=getattr(col, "groupby", None),
            filterable=getattr(col, "filterable", None),
            description=getattr(col, "description", None),
        )
        for col in getattr(dataset, "columns", [])
    ]
    metrics = [
        SqlMetricInfo(
            metric_name=getattr(metric, "metric_name", None),
            verbose_name=getattr(metric, "verbose_name", None),
            expression=getattr(metric, "expression", None),
            description=getattr(metric, "description", None),
            d3format=getattr(metric, "d3format", None),
        )
        for metric in getattr(dataset, "metrics", [])
    ]
    return DatasetInfo(
        id=getattr(dataset, "id", None),
        table_name=getattr(dataset, "table_name", None),
        schema=getattr(dataset, "schema", None),
        database_name=getattr(dataset.database, "database_name", None)
        if getattr(dataset, "database", None)
        else None,
        description=getattr(dataset, "description", None),
        changed_by=getattr(dataset, "changed_by_name", None)
        or (str(dataset.changed_by) if getattr(dataset, "changed_by", None) else None),
        changed_on=getattr(dataset, "changed_on", None),
        changed_on_humanized=getattr(dataset, "changed_on_humanized", None),
        created_by=getattr(dataset, "created_by_name", None)
        or (str(dataset.created_by) if getattr(dataset, "created_by", None) else None),
        created_on=getattr(dataset, "created_on", None),
        created_on_humanized=getattr(dataset, "created_on_humanized", None),
        tags=[
            TagInfo.model_validate(tag, from_attributes=True)
            for tag in getattr(dataset, "tags", [])
        ]
        if getattr(dataset, "tags", None)
        else [],
        owners=[
            UserInfo.model_validate(owner, from_attributes=True)
            for owner in getattr(dataset, "owners", [])
        ]
        if getattr(dataset, "owners", None)
        else [],
        is_virtual=getattr(dataset, "is_virtual", None),
        database_id=getattr(dataset, "database_id", None),
        schema_perm=getattr(dataset, "schema_perm", None),
        url=getattr(dataset, "url", None),
        sql=getattr(dataset, "sql", None),
        main_dttm_col=getattr(dataset, "main_dttm_col", None),
        offset=getattr(dataset, "offset", None),
        cache_timeout=getattr(dataset, "cache_timeout", None),
        params=params,
        template_params=getattr(dataset, "template_params", None),
        extra=getattr(dataset, "extra", None),
        columns=columns,
        metrics=metrics,
    )
