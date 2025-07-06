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
from superset.mcp_service.pydantic_schemas import (
    DatasetInfoResponse,
    DatasetErrorResponse,
    TagInfo,
    UserInfo,
)

logger = logging.getLogger(__name__)

def get_dataset_info(
    dataset_id: Annotated[
        int,
        Field(description="ID of the dataset to retrieve information for")
    ]
) -> DatasetInfoResponse | DatasetErrorResponse:
    """
    Get detailed information about a specific dataset.
    Parameters
    ----------
    dataset_id : int
        ID of the dataset to retrieve information for.
    Returns
    -------
    DatasetInfoResponse or DatasetErrorResponse
        Detailed dataset information or error response.
    """
    try:
        dao_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")
        dataset, error_type, error_message = dao_wrapper.info(dataset_id)
        if dataset is None:
            error_data = DatasetErrorResponse(
                error=error_message,
                error_type=error_type,
                timestamp=datetime.now(timezone.utc)
            )
            logger.warning(f"Dataset {dataset_id} error: {error_type} - {error_message}")
            return error_data
        response = DatasetInfoResponse(
            id=dataset.id,
            table_name=dataset.table_name,
            db_schema=getattr(dataset, 'schema', None),
            database_name=getattr(dataset.database, 'database_name', None) if getattr(dataset, 'database', None) else None,
            description=getattr(dataset, 'description', None),
            changed_by=getattr(dataset, 'changed_by_name', None) or (str(dataset.changed_by) if getattr(dataset, 'changed_by', None) else None),
            changed_on=getattr(dataset, 'changed_on', None),
            changed_on_humanized=getattr(dataset, 'changed_on_humanized', None),
            created_by=getattr(dataset, 'created_by_name', None) or (str(dataset.created_by) if getattr(dataset, 'created_by', None) else None),
            created_on=getattr(dataset, 'created_on', None),
            created_on_humanized=getattr(dataset, 'created_on_humanized', None),
            tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in getattr(dataset, 'tags', [])] if getattr(dataset, 'tags', None) else [],
            owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in getattr(dataset, 'owners', [])] if getattr(dataset, 'owners', None) else [],
            is_virtual=getattr(dataset, 'is_virtual', None),
            database_id=getattr(dataset, 'database_id', None),
            schema_perm=getattr(dataset, 'schema_perm', None),
            url=getattr(dataset, 'url', None),
            sql=getattr(dataset, 'sql', None),
            main_dttm_col=getattr(dataset, 'main_dttm_col', None),
            offset=getattr(dataset, 'offset', None),
            cache_timeout=getattr(dataset, 'cache_timeout', None),
            params=getattr(dataset, 'params', None),
            template_params=getattr(dataset, 'template_params', None),
            extra=getattr(dataset, 'extra', None),
        )
        logger.info(f"Dataset response created successfully for dataset {dataset.id}")
        return response
    except Exception as context_error:
        error_msg = f"Error within Flask app context: {str(context_error)}"
        logger.error(error_msg, exc_info=True)
        raise
    except Exception as e:
        error_msg = f"Unexpected error in get_dataset_info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise 
