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
Get saved query info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific saved SQL query.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.saved_query.schemas import (
    GetSavedQueryInfoRequest,
    SavedQueryError,
    SavedQueryInfo,
    serialize_saved_query_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="SavedQuery",
    annotations=ToolAnnotations(
        title="Get saved query info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_saved_query_info(
    request: GetSavedQueryInfoRequest, ctx: Context
) -> SavedQueryInfo | SavedQueryError:
    """Get saved query details by ID or UUID.

    Returns the full saved query including SQL text, label, database,
    schema, and timestamps.

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 42) or UUID string (e.g., "a1b2c3d4-...")
    - To find a saved query ID, use the list_saved_queries tool first

    Example usage:
    ```json
    {
        "identifier": 42
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
        "Retrieving saved query information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.query import SavedQueryDAO

        with event_logger.log_context(action="mcp.get_saved_query_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=SavedQueryDAO,
                output_schema=SavedQueryInfo,
                error_schema=SavedQueryError,
                serializer=serialize_saved_query_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, SavedQueryInfo):
            await ctx.info(
                "Saved query information retrieved successfully: "
                "saved_query_id=%s, label=%s, db_id=%s"
                % (
                    result.id,
                    result.label,
                    result.db_id,
                )
            )
        else:
            await ctx.warning(
                "Saved query retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Saved query information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                str(e),
                type(e).__name__,
            )
        )
        return SavedQueryError(
            error="Failed to get saved query info",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
