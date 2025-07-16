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
from typing import Annotated, Literal, Optional

from pydantic import conlist, constr, Field, PositiveInt
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelListTool
from superset.mcp_service.pydantic_schemas import (DatasetInfo, DatasetList)
from superset.mcp_service.pydantic_schemas.dataset_schemas import DatasetFilter

logger = logging.getLogger(__name__)

DEFAULT_DATASET_COLUMNS = [
    "id", "table_name", "db_schema", "database_name",
    "changed_by_name", "changed_on", "created_by_name", "created_on"
]


@mcp.tool
@mcp_auth_hook
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
    List datasets with advanced filtering, search, and column selection.
    """

    from superset.daos.dataset import DatasetDAO

    tool = ModelListTool(
        dao_class=DatasetDAO,
        output_schema=DatasetInfo,
        item_serializer=lambda obj, cols: DatasetInfo(**dict(obj._mapping)) if not cols else DatasetInfo(**{k: v for k, v in dict(obj._mapping).items() if k in cols}),
        filter_type=DatasetFilter,
        default_columns=DEFAULT_DATASET_COLUMNS,
        search_columns=[
            "catalog",
            "schema",
            "sql",
            "table_name",
            "uuid",
            "tags"
        ],
        list_field_name="datasets",
        output_list_schema=DatasetList,
        logger=logger,
    )
    return tool.run(
        filters=filters,
        search=search,
        select_columns=select_columns,
        order_column=order_column,
        order_direction=order_direction,
        page=max(page - 1, 0),
        page_size=page_size,
    )
