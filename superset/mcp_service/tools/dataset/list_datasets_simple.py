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
List datasets simple FastMCP tool

This module contains the FastMCP tool for listing datasets using
simple filtering with individual query parameters.
"""
import logging
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import Field, PositiveInt

from superset.daos.dataset import DatasetDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas import (
    DatasetListResponse, DatasetSimpleFilters, PaginationInfo,
    serialize_dataset_object, )

logger = logging.getLogger(__name__)


def list_datasets_simple(
    filters: Annotated[
        Optional[DatasetSimpleFilters],
        Field(description="Simple filter object for dataset fields")
    ] = None,
    order_column: Annotated[
        Optional[str],
        Field(description="Column to order results by")
    ] = None,
    order_direction: Annotated[
        Literal["asc", "desc"],
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
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against dataset fields")
    ] = None,
) -> DatasetListResponse:
    """
    SIMPLE FILTERING: List datasets using individual query parameters
    """
    if filters is None:
        filters = DatasetSimpleFilters()
    try:
        filters_dict = filters.model_dump(exclude_none=True)
        dao_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")
        search_columns = [
            "id", "table_name", "db_schema", "database_name", "description",
            "changed_by", "changed_by_name", "created_by", "created_by_name",
            "tags", "owners", "is_virtual", "database_id", "schema_perm", "url"
        ]
        datasets, total_count = dao_wrapper.list(
            filters=filters_dict,
            order_column=order_column or "changed_on",
            order_direction=order_direction or "desc",
            page=page - 1,
            page_size=page_size,
            search=search,
            search_columns=search_columns
        )
        dataset_items = [serialize_dataset_object(dataset) for dataset in
                         datasets]
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
        pagination_info = PaginationInfo(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
            has_next=page < total_pages - 1,
            has_previous=page > 1
        )
        response = DatasetListResponse(
            datasets=dataset_items,
            count=len(dataset_items),
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_previous=page > 1,
            has_next=page < total_pages - 1,
            columns_requested=[
                "id", "table_name", "db_schema", "database_name", "description",
                "changed_by", "changed_by_name", "changed_on",
                "changed_on_humanized",
                "created_by", "created_on", "created_on_humanized", "tags",
                "owners"
            ],
            columns_loaded=list(
                set(
                    [col for item in dataset_items for col in
                     item.model_dump().keys()])),
            filters_applied=filters_dict,
            pagination=pagination_info,
            timestamp=datetime.now(timezone.utc)
        )
        logger.info(f"Successfully retrieved {len(dataset_items)} datasets")
        return response
    except Exception as e:
        error_msg = f"Unexpected error in list_datasets_simple: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
