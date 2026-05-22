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
Create dataset FastMCP tool

Registers a physical table as a Superset dataset against an existing
database connection — the programmatic equivalent of Data → Datasets → +Dataset.
Returns the same DatasetInfo shape as get_dataset_info so the caller can feed
the resulting dataset_id directly into generate_chart.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.dataset.schemas import (
    CreateDatasetRequest,
    DatasetError,
    DatasetInfo,
    serialize_dataset_object,
)

logger = logging.getLogger(__name__)


@mcp.tool(tags=["mutate"])
@mcp_auth_hook
def create_dataset(
    request: CreateDatasetRequest, ctx: Context
) -> DatasetInfo | DatasetError:
    """Register a physical table as a Superset dataset.

    Wraps POST /api/v1/dataset/ — the same endpoint the UI uses when you click
    Data → Datasets → +Dataset.  Returns full dataset metadata (same shape as
    get_dataset_info) so you can pass the resulting dataset_id straight into
    generate_chart.

    Required fields:
    - database_id: ID of the existing database connection
    - schema: Schema/namespace where the table lives (e.g. "public")
    - table_name: Exact name of the physical table to register

    Optional fields:
    - owners: List of user IDs to set as owners (defaults to calling user)

    Example:
    ```json
    {
        "database_id": 1,
        "schema": "public",
        "table_name": "orders"
    }
    ```

    Returns DatasetInfo on success or DatasetError on failure.
    Use list_databases to find the correct database_id.
    """
    try:
        from superset.commands.dataset.create import CreateDatasetCommand
        from superset.commands.dataset.exceptions import (
            DatasetCreateFailedError,
            DatasetExistsValidationError,
            DatasetInvalidError,
            TableNotFoundValidationError,
        )

        dataset_properties = {
            "database": request.database_id,
            "schema": request.schema,
            "table_name": request.table_name,
        }
        if request.owners is not None:
            dataset_properties["owners"] = request.owners

        command = CreateDatasetCommand(dataset_properties)
        dataset = command.run()

        result = serialize_dataset_object(dataset)
        if result is None:
            return DatasetError(
                error="Dataset was created but could not be serialized",
                error_type="SerializationError",
                timestamp=datetime.now(timezone.utc),
            )

        logger.info(
            "Created dataset id=%s table=%s.%s",
            dataset.id,
            request.schema,
            request.table_name,
        )
        return result

    except DatasetExistsValidationError as e:
        return DatasetError(
            error=str(e),
            error_type="DatasetExistsError",
            timestamp=datetime.now(timezone.utc),
        )
    except TableNotFoundValidationError as e:
        return DatasetError(
            error=str(e),
            error_type="TableNotFoundError",
            timestamp=datetime.now(timezone.utc),
        )
    except DatasetInvalidError as e:
        return DatasetError(
            error=str(e),
            error_type="ValidationError",
            timestamp=datetime.now(timezone.utc),
        )
    except DatasetCreateFailedError as e:
        return DatasetError(
            error=str(e),
            error_type="CreateFailedError",
            timestamp=datetime.now(timezone.utc),
        )
    except Exception as e:
        logger.error("Failed to create dataset: %s", e, exc_info=True)
        return DatasetError(
            error=f"Failed to create dataset: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
