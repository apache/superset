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
Open SQL Lab with Context MCP Tool

Tool for generating SQL Lab URLs with pre-populated sql and context.
"""

import logging
from urllib.parse import urlencode

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.sql_lab.schemas import (
    OpenSqlLabRequest,
    SqlLabResponse,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)


@tool(
    tags=["explore"],
    class_permission_name="SQLLab",
    method_permission_name="read",
    annotations=ToolAnnotations(
        title="Open SQL Lab with context",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def open_sql_lab_with_context(
    request: OpenSqlLabRequest, ctx: Context
) -> SqlLabResponse:
    """Generate SQL Lab URL with pre-populated sql and context.

    Pass the sql parameter to pre-fill the editor. Returns URL for direct navigation.
    """
    try:
        from superset.daos.database import DatabaseDAO

        with event_logger.log_context(action="mcp.open_sql_lab.db_validation"):
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

        # Construct SQL Lab URL with full base URL
        query_string = urlencode(params)
        url = f"{get_superset_base_url()}/sqllab?{query_string}"

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
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error generating SQL Lab URL: %s", e)
        return SqlLabResponse(
            url="",
            database_id=request.database_connection_id,
            schema_name=request.schema_name,
            title=request.title,
            error=f"Failed to generate SQL Lab URL: {str(e)}",
        )
