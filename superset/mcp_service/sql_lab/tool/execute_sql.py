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
Execute SQL MCP Tool

Tool for executing SQL queries against databases with security validation
and timeout protection.
"""

import logging
from decimal import Decimal
from typing import Any

from fastmcp import Context
from mcp.types import ToolAnnotations

from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.extensions import event_logger
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.sql_lab.execute_sql_core import ExecuteSqlCore
from superset.mcp_service.sql_lab.schemas import (
    ExecuteSqlRequest,
    ExecuteSqlResponse,
)
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message,
    OAUTH2_CONFIG_ERROR_MESSAGE,
)
from superset.sql.parse import SQLScript

logger = logging.getLogger(__name__)


@mcp.tool(
    tags=["mutate"],
    annotations=ToolAnnotations(
        title="Execute SQL query",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
@mcp_auth_hook(
    class_permission_name="SQLLab", method_permission_name="execute_sql_query"
)
async def execute_sql(  # noqa: C901
    request: ExecuteSqlRequest, ctx: Context
) -> ExecuteSqlResponse:
    """Execute SQL query against database.

    Returns query results with security validation and timeout protection.
    """
    await ctx.info(
        "Starting SQL execution: database_id=%s, timeout=%s, limit=%s, schema=%s"
        % (request.database_id, request.timeout, request.limit, request.schema_name)
    )

    # Log SQL query details (truncated for security)
    sql_preview = request.sql[:100] + "..." if len(request.sql) > 100 else request.sql
    await ctx.debug(
        "SQL query details: sql_preview=%r, sql_length=%s, has_parameters=%s"
        % (
            sql_preview,
            len(request.sql),
            bool(request.parameters),
        )
    )

    logger.info("Executing SQL query on database ID: %s", request.database_id)

    try:
        # Import inside function to avoid initialization issues
        from superset import db, is_feature_enabled, security_manager
        from superset.errors import SupersetErrorType
        from superset.models.core import Database

        # 1. Get database and check access
        with event_logger.log_context(action="mcp.execute_sql.db_validation"):
            database = (
                db.session.query(Database).filter_by(id=request.database_id).first()
            )
            if not database:
                await ctx.warning(
                    "Database not found: database_id=%s" % request.database_id
                )
                return ExecuteSqlResponse(
                    success=False,
                    error=(
                        f"Database with ID {request.database_id} not found."
                        " Use list_databases to get valid database IDs."
                    ),
                    error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR.value,
                )

            if not security_manager.can_access_database(database):
                await ctx.warning(
                    "Access denied to database: %s" % database.database_name
                )
                return ExecuteSqlResponse(
                    success=False,
                    error=f"Access denied to database {database.database_name}",
                    error_type=SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR.value,
                )

        # 2. Block destructive DDL (DROP, TRUNCATE, ALTER)
        # Fail-closed: if parsing fails, block the query rather than
        # allowing potentially destructive SQL to bypass the check.
        # Render Jinja2 templates and apply request.parameters first so
        # templated/placeholder SQL can be parsed.
        from superset.exceptions import SupersetErrorException

        with event_logger.log_context(action="mcp.execute_sql.ddl_check"):
            try:
                sql_to_check = request.sql
                if request.template_params:
                    from superset.jinja_context import get_template_processor

                    tp = get_template_processor(database=database)
                    sql_to_check = tp.process_template(
                        sql_to_check, **request.template_params
                    )
                if request.parameters is not None:
                    from superset.mcp_service.sql_lab.sql_lab_utils import (
                        _apply_parameters,
                    )

                    sql_to_check = _apply_parameters(sql_to_check, request.parameters)

                script = SQLScript(sql_to_check, database.db_engine_spec.engine)
                if script.has_destructive():
                    await ctx.error(
                        "Destructive DDL blocked: sql_preview=%r" % sql_preview
                    )
                    return ExecuteSqlResponse(
                        success=False,
                        error=(
                            "Destructive DDL statements (DROP, TRUNCATE, ALTER) "
                            "are not allowed through MCP. Use the Superset SQL "
                            "Lab UI for administrative database operations."
                        ),
                        error_type=SupersetErrorType.DML_NOT_ALLOWED_ERROR.value,
                    )
            except SupersetErrorException as param_err:
                # Surface parameter-substitution errors (e.g. missing
                # placeholder) with their canonical error type so callers
                # can distinguish them from a SQL parse failure.
                await ctx.warning(
                    "Parameter substitution failed: %s" % param_err.error.message
                )
                return ExecuteSqlResponse(
                    success=False,
                    error=param_err.error.message,
                    error_type=param_err.error.error_type.value,
                )
            except Exception as parse_err:
                await ctx.error(
                    "DDL pre-check failed to parse SQL, blocking query: %s"
                    % str(parse_err)
                )
                return ExecuteSqlResponse(
                    success=False,
                    error=(
                        "SQL could not be parsed for security validation. "
                        "Please check your SQL syntax and try again."
                    ),
                    error_type=SupersetErrorType.INVALID_SQL_ERROR.value,
                )

        # 3. Execute SQL via ExecuteSqlCore (6.0 architecture)
        sql_tool = ExecuteSqlCore(use_command_mode=False, logger=logger)
        with event_logger.log_context(action="mcp.execute_sql.query_execution"):
            result = sql_tool.run_tool(request)

        # Surface a warning when template_params is supplied but Jinja
        # rendering is disabled — otherwise the params are silently dropped.
        if (
            request.template_params
            and not is_feature_enabled("ENABLE_TEMPLATE_PROCESSING")
            and isinstance(result, ExecuteSqlResponse)
        ):
            result.template_warning = (
                "template_params was supplied but Jinja2 rendering is "
                "disabled on this Superset instance "
                "(ENABLE_TEMPLATE_PROCESSING feature flag is off). "
                "Template variables in the SQL were NOT substituted; "
                "the query was executed with literal '{{ var }}' placeholders."
            )
            await ctx.warning(
                "template_params supplied but ENABLE_TEMPLATE_PROCESSING is off"
            )

        # Log successful execution
        if hasattr(result, "data") and result.data:
            row_count = len(result.data) if isinstance(result.data, list) else 1
            await ctx.info(
                "SQL execution completed successfully: rows_returned=%s, "
                "query_duration_ms=%s"
                % (
                    row_count,
                    getattr(result, "query_duration_ms", None),
                )
            )
        else:
            await ctx.info("SQL execution completed: status=no_data_returned")

        return result

    except OAuth2RedirectError as ex:
        await ctx.warning(
            "Database requires OAuth authentication: database_id=%s"
            % request.database_id
        )
        return ExecuteSqlResponse(
            success=False,
            error=build_oauth2_redirect_message(ex),
            error_type="OAUTH2_REDIRECT",
        )
    except OAuth2Error:
        await ctx.error(
            "OAuth2 configuration/flow error: database_id=%s" % request.database_id
        )
        return ExecuteSqlResponse(
            success=False,
            error=OAUTH2_CONFIG_ERROR_MESSAGE,
            error_type="OAUTH2_REDIRECT_ERROR",
        )
    except Exception as e:
        await ctx.error(
            "SQL execution failed: error=%s, database_id=%s"
            % (
                str(e),
                request.database_id,
            )
        )
        raise


def _sanitize_row_values(rows: list[dict[str, Any]]) -> None:
    """Sanitize non-serializable values in rows for JSON serialization."""
    for row in rows:
        for key, value in row.items():
            if isinstance(value, (bytes, memoryview)):
                raw = bytes(value) if isinstance(value, memoryview) else value
                try:
                    row[key] = raw.decode("utf-8")
                except (UnicodeDecodeError, AttributeError):
                    row[key] = raw.hex()
            elif isinstance(value, Decimal):
                row[key] = float(value)
            elif not isinstance(value, (str, int, float, bool, type(None), list, dict)):
                row[key] = str(value)
