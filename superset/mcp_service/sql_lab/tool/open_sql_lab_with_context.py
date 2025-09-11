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
MCP tool: open_sql_lab_with_context

This tool generates a URL to open SQL Lab with pre-populated context including
database connection, schema, dataset context, and SQL query.
"""

import logging
from urllib.parse import urlencode

from fastmcp import Context

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.sql_lab.schemas import OpenSqlLabRequest, SqlLabResponse

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def open_sql_lab_with_context(
    request: OpenSqlLabRequest, ctx: Context
) -> SqlLabResponse:
    """
    Generate a URL to open SQL Lab with pre-populated context.

    This tool creates a SQL Lab URL with the specified database connection,
    schema, dataset context, and SQL query. The URL can be used to directly
    navigate users to a pre-configured SQL Lab session.

    Args:
        request: OpenSqlLabRequest with database_connection_id, schema,
                dataset_in_context, and sql parameters

    Returns:
        SqlLabResponse with the generated URL and context information
    """
    try:
        from superset.daos.database import DatabaseDAO

        # Validate database exists and is accessible
        database = DatabaseDAO.find_by_id(request.database_connection_id)
        if not database:
            return SqlLabResponse(
                url="",
                database_id=request.database_connection_id,
                schema_name=request.schema_name,
                title=request.title,
                error=f"Database with ID {request.database_connection_id} not found",
            )

        # Build query parameters for SQL Lab URL
        params = {
            "dbid": str(request.database_connection_id),
        }

        if request.schema_name:
            params["schema"] = request.schema_name

        if request.sql:
            params["sql"] = request.sql

        if request.title:
            params["title"] = request.title

        if request.dataset_in_context:
            # Add dataset context as a comment in the SQL if no SQL provided
            if not request.sql:
                context_comment = (
                    f"-- Context: Working with dataset '{request.dataset_in_context}'\n"
                    f"-- Database: {database.database_name}\n"
                )
                if request.schema_name:
                    context_comment += f"-- Schema: {request.schema_name}\n"
                    table_reference = (
                        f"{request.schema_name}.{request.dataset_in_context}"
                    )
                else:
                    table_reference = request.dataset_in_context

                context_comment += f"\nSELECT * FROM {table_reference} LIMIT 100;"
                params["sql"] = context_comment

        # Construct SQL Lab URL
        query_string = urlencode(params)
        url = f"/sqllab?{query_string}"

        logger.info(
            "Generated SQL Lab URL for database %s", request.database_connection_id
        )

        return SqlLabResponse(
            url=url,
            database_id=request.database_connection_id,
            schema_name=request.schema_name,
            title=request.title,
            error=None,
        )

    except Exception as e:
        logger.error("Error generating SQL Lab URL: %s", e)
        return SqlLabResponse(
            url="",
            database_id=request.database_connection_id,
            schema_name=request.schema_name,
            title=request.title,
            error=f"Failed to generate SQL Lab URL: {str(e)}",
        )
