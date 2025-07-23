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
advanced filtering with clear, unambiguous request schema.
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelListTool
from superset.mcp_service.pydantic_schemas import DatasetInfo, DatasetList
from superset.mcp_service.pydantic_schemas.dataset_schemas import (
    DatasetFilter,
    ListDatasetsRequest,
    serialize_dataset_object,
)

logger = logging.getLogger(__name__)

DEFAULT_DATASET_COLUMNS = [
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
]


@mcp.tool
@mcp_auth_hook
def list_datasets(request: ListDatasetsRequest) -> DatasetList:
    """
    List datasets with advanced filtering, search, and column selection.

    Uses a clear request object schema to avoid validation ambiguity with
    arrays/strings.
    All parameters are properly typed and have sensible defaults.
    """

    from superset.daos.dataset import DatasetDAO

    tool = ModelListTool(
        dao_class=DatasetDAO,
        output_schema=DatasetInfo,
        item_serializer=lambda obj, cols: serialize_dataset_object(obj),
        filter_type=DatasetFilter,
        default_columns=DEFAULT_DATASET_COLUMNS,
        search_columns=["catalog", "schema", "sql", "table_name", "uuid", "tags"],
        list_field_name="datasets",
        output_list_schema=DatasetList,
        logger=logger,
    )
    return tool.run(
        filters=request.filters,
        search=request.search,
        select_columns=request.select_columns,
        order_column=request.order_column,
        order_direction=request.order_direction,
        page=max(request.page - 1, 0),
        page_size=request.page_size,
    )
