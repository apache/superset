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
Get query info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific SQL query from the query history.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.query.schemas import (
    GetQueryInfoRequest,
    QueryError,
    QueryInfo,
    serialize_query_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Query",
    annotations=ToolAnnotations(
        title="Get query info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_query_info(
    request: GetQueryInfoRequest, ctx: Context
) -> QueryInfo | QueryError:
    """Get SQL query history details by ID.

    Returns query details including SQL text, execution status, timing,
    row count, and any error messages.

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 123)
    - To find a query ID, use the list_queries tool first

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```
    """
    await ctx.info(
        "Retrieving query information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.query import QueryDAO

        with event_logger.log_context(action="mcp.get_query_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=QueryDAO,
                output_schema=QueryInfo,
                error_schema=QueryError,
                serializer=serialize_query_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, QueryInfo):
            await ctx.info(
                "Query information retrieved successfully: "
                "query_id=%s, status=%s, database_id=%s"
                % (
                    result.id,
                    result.status,
                    result.database_id,
                )
            )
        else:
            await ctx.warning(
                "Query retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Query information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                str(e),
                type(e).__name__,
            )
        )
        return QueryError(
            error="Failed to get query info",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
