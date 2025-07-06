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
List datasets FastMCP tool (Advanced)

This module contains the FastMCP tool for listing datasets using
advanced filtering with complex filter objects and JSON payload.
"""
import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, conlist, constr, Field, PositiveInt
from superset.daos.dataset import DatasetDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas import (
    DatasetListResponse,
    PaginationInfo,
    serialize_dataset_object,
)

logger = logging.getLogger(__name__)

class DatasetFilter(BaseModel):
    """
    Filter object for dataset listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """
    col: Literal[
        "table_name",
        "schema",
        "database_name",
        "changed_by",
        "created_by",
        "owner",
        "is_virtual",
        "tags"
    ] = Field(..., description="Column to filter on. See get_dataset_available_filters for allowed values.")
    opr: Literal[
        "eq", "ne", "in", "nin", "sw", "ew"
    ] = Field(..., description="Operator to use. See get_dataset_available_filters for allowed values.")
    value: Any = Field(..., description="Value to filter by (type depends on col and opr)")

def list_datasets(
    filters: Annotated[
        Optional[conlist(DatasetFilter, min_length=1)],
        Field(description="List of filter objects (column, operator, value)")
    ] = None,
    columns: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of columns to include in the response")
    ] = None,
    keys: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of keys to include in the response")
    ] = None,
    order_column: Annotated[
        Optional[constr(strip_whitespace=True, min_length=1)],
        Field(description="Column to order results by")
    ] = None,
    order_direction: Annotated[
        Optional[Literal["asc", "desc"]],
        Field(description="Direction to order results ('asc' or 'desc')")
    ] = "asc",
    page: Annotated[
        PositiveInt,
        Field(description="Page number for pagination (1-based)")
    ] = 1,
    page_size: Annotated[
        PositiveInt,
        Field(description="Number of items per page")
    ] = 100,
    select_columns: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of columns to select (overrides 'columns' and 'keys')")
    ] = None,
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against dataset fields")
    ] = None,
) -> DatasetListResponse:
    """
    ADVANCED FILTERING: List datasets using complex filter objects and JSON payload
    Returns a DatasetListResponse Pydantic model (not a dict), matching list_datasets_simple.
    """
    simple_filters = {}
    if filters:
        for filter_obj in filters:
            if isinstance(filter_obj, DatasetFilter):
                col = filter_obj.col
                value = filter_obj.value
                if filter_obj.opr == 'eq':
                    simple_filters[col] = value
                elif filter_obj.opr == 'sw':
                    simple_filters[col] = f"{value}%"
    dao_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")
    search_columns = [
        "id", "table_name", "db_schema", "database_name", "description",
        "changed_by", "changed_by_name", "created_by", "created_by_name",
        "tags", "owners", "is_virtual", "database_id", "schema_perm", "url"
    ]
    datasets, total_count = dao_wrapper.list(
        filters=simple_filters,
        order_column=order_column or "changed_on",
        order_direction=order_direction or "desc",
        page=max(page - 1, 0),
        page_size=page_size,
        search=search,
        search_columns=search_columns
    )
    columns_to_load = []
    if select_columns:
        if isinstance(select_columns, str):
            select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
        columns_to_load = select_columns
    elif columns:
        columns_to_load = columns
    elif keys:
        columns_to_load = keys
    else:
        columns_to_load = [
            "id", "table_name", "db_schema", "database_name", "description",
            "changed_by_name", "changed_on", "created_by_name", "created_on"
        ]
    dataset_items = [serialize_dataset_object(dataset) for dataset in datasets]
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0
    )
    response = DatasetListResponse(
        datasets=dataset_items,
        count=len(dataset_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=columns_to_load,
        columns_loaded=list(set([col for item in dataset_items for col in item.model_dump().keys()])),
        filters_applied=simple_filters,
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc)
    )
    logger.info(f"Successfully retrieved {len(dataset_items)} datasets")
    return response
