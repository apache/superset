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
Get dataset info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific dataset.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Annotated
from pydantic import Field
from superset.daos.dataset import DatasetDAO
from superset.mcp_service.pydantic_schemas import DatasetInfo, DatasetError, serialize_dataset_object
from superset.mcp_service.utils import ModelGetInfoTool
from superset.mcp_service.pydantic_schemas.dataset_schemas import serialize_dataset_object

logger = logging.getLogger(__name__)

def get_dataset_info(
    dataset_id: Annotated[
        int,
        Field(description="ID of the dataset to retrieve information for")
    ]
) -> DatasetInfo | DatasetError:
    """
    Get detailed information about a specific dataset.
    Returns a DatasetInfo model or DatasetError on error.
    """
    tool = ModelGetInfoTool(
        dao_class=DatasetDAO,
        output_schema=DatasetInfo,
        error_schema=DatasetError,
        serializer=serialize_dataset_object,
        logger=logger,
    )
    return tool.run(dataset_id) 
