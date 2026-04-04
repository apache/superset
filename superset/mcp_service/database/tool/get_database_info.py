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
Get database info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific database connection.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.database.schemas import (
    DatabaseError,
    DatabaseInfo,
    GetDatabaseInfoRequest,
    serialize_database_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Database",
    annotations=ToolAnnotations(
        title="Get database info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_database_info(
    request: GetDatabaseInfoRequest, ctx: Context
) -> DatabaseInfo | DatabaseError:
    """Get database connection metadata by ID or UUID.

    Returns database configuration including backend type and capabilities
    (allow_ctas, allow_dml, expose_in_sqllab, etc.).

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 123) or UUID string (e.g., "a1b2c3d4-...")
    - To find a database ID, use the list_databases tool first

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
    ```
    """
    await ctx.info(
        "Retrieving database information: identifier=%s" % (request.identifier,)
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s refresh_metadata=%s force_refresh=%s"
        % (
            request.use_cache,
            request.refresh_metadata,
            request.force_refresh,
        )
    )

    try:
        from superset.daos.database import DatabaseDAO

        with event_logger.log_context(action="mcp.get_database_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=DatabaseDAO,
                output_schema=DatabaseInfo,
                error_schema=DatabaseError,
                serializer=serialize_database_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, DatabaseInfo):
            await ctx.info(
                "Database information retrieved successfully: "
                "database_id=%s, database_name=%s, backend=%s"
                % (
                    result.id,
                    result.database_name,
                    result.backend,
                )
            )
        else:
            await ctx.warning(
                "Database retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Database information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                str(e),
                type(e).__name__,
            )
        )
        return DatabaseError(
            error=f"Failed to get database info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
