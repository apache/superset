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
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.sql_lab.schemas import (
    OpenSqlLabRequest,
    SqlLabResponse,
)
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)


def _sanitize_sql_lab_url_for_llm_context(url: str) -> str:
    """Wrap untrusted SQL Lab query parameters while keeping the URL usable."""
    parsed_url = urlsplit(url)
    query_params = parse_qsl(parsed_url.query, keep_blank_values=True)
    sanitized_query_params = [
        (
            key,
            sanitize_for_llm_context(value, field_path=(key,))
            if key in {"sql", "title"}
            else value,
        )
        for key, value in query_params
    ]
    return urlunsplit(
        parsed_url._replace(query=urlencode(sanitized_query_params, doseq=True))
    )


def _sanitize_sql_lab_response_for_llm_context(
    response: SqlLabResponse,
) -> SqlLabResponse:
    """Wrap user-controlled SQL Lab response content before LLM exposure."""
    payload = response.model_dump(mode="python")
    payload["url"] = _sanitize_sql_lab_url_for_llm_context(payload["url"])

    for field_name in ("title", "error"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )

    return SqlLabResponse.model_validate(payload)


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
            error_message = (
                f"Database with ID {request.database_connection_id} not found"
            )
            return _sanitize_sql_lab_response_for_llm_context(
                SqlLabResponse(
                    url="",
                    database_id=request.database_connection_id,
                    schema_name=request.schema_name,
                    title=request.title,
                    error=error_message,
                )
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

        return _sanitize_sql_lab_response_for_llm_context(
            SqlLabResponse(
                url=url,
                database_id=request.database_connection_id,
                schema_name=request.schema_name,
                title=request.title,
                error=None,
            )
        )

    except Exception as e:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except Exception:  # noqa: BLE001
            # Broad catch: the DB connection itself may be broken (e.g.,
            # SSL drop), so even rollback can fail with non-SQLAlchemy
            # errors. This is a cleanup path — swallow and log.
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error generating SQL Lab URL: %s", e)
        return _sanitize_sql_lab_response_for_llm_context(
            SqlLabResponse(
                url="",
                database_id=request.database_connection_id,
                schema_name=request.schema_name,
                title=request.title,
                error=f"Failed to generate SQL Lab URL: {str(e)}",
            )
        )
