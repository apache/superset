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
import json

from pydantic import BaseModel, conlist, constr, Field, PositiveInt
from superset.daos.dataset import DatasetDAO
from superset.mcp_service.pydantic_schemas import (
    DatasetList,
    PaginationInfo,
    serialize_dataset_object,
    DatasetInfo,
)
from superset.mcp_service.pydantic_schemas.dataset_schemas import DatasetFilter

logger = logging.getLogger(__name__)

DEFAULT_DATASET_COLUMNS = [
    "id", "table_name", "db_schema", "database_name",
    "changed_by_name", "changed_on", "created_by_name", "created_on"
]

def list_datasets(
    filters: Annotated[
        Optional[conlist(DatasetFilter, min_length=0)],
        Field(description="List of filter objects (column, operator, value)")
    ] = None,
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against dataset fields")
    ] = None,
    select_columns: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description=f"List of columns to select. If not specified, defaults to: {DEFAULT_DATASET_COLUMNS}.")
    ] = None,
    order_column: Annotated[
        Optional[constr(strip_whitespace=True, min_length=0)],
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
) -> DatasetList:
    """
    ADVANCED FILTERING: List datasets using complex filter objects and JSON payload
    Returns a DatasetList Pydantic model (not a dict), matching list_datasets_simple.
    """
    # Ensure select_columns is a list
    if select_columns:
        if isinstance(select_columns, str):
            select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
        columns_to_load = select_columns
    else:
        columns_to_load = DEFAULT_DATASET_COLUMNS
    # Replace dao_wrapper usage with DatasetDAO
    datasets, total_count = DatasetDAO.list(
        column_operators=filters,
        order_column=order_column or "changed_on",
        order_direction=order_direction or "desc",
        page=page,
        page_size=page_size,
        search=search,
        search_columns=[
            "catalog",
            "schema",
            "sql",
            "table_name",
            "uuid",
        ],
        custom_filters=None,
        columns=columns_to_load,
    )
    dataset_items = []
    for dataset in datasets:
        item = serialize_dataset_object(dataset)
        if item is not None:
            dataset_items.append(item)
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0
    )
    response = DatasetList(
        datasets=dataset_items,
        count=len(dataset_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=select_columns if select_columns else DEFAULT_DATASET_COLUMNS,
        columns_loaded=list(set([col for item in dataset_items for col in item.model_dump().keys()])),
        filters_applied=filters if isinstance(filters, list) else [],
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc)
    )
    logger.info(f"Successfully retrieved {len(dataset_items)} datasets")
    return response
