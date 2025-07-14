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
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas import DatasetInfo, DatasetError, serialize_dataset_object

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
    try:
        dao_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")
        dataset, error_type, error_message = dao_wrapper.info(dataset_id)
        if dataset is None:
            error_data = DatasetError(
                error=error_message,
                error_type=error_type,
                timestamp=datetime.now(timezone.utc)
            )
            logger.warning(f"DatasetInfo {dataset_id} error: {error_type} - {error_message}")
            return error_data
        response = serialize_dataset_object(dataset)
        logger.info(f"DatasetInfo response created successfully for dataset {dataset.id}")
        return response
    except Exception as context_error:
        error_msg = f"Error within Flask app context: {str(context_error)}"
        logger.error(error_msg, exc_info=True)
        raise
    except Exception as e:
        error_msg = f"Unexpected error in get_dataset_info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise 
