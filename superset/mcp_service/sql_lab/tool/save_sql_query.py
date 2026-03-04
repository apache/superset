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
MCP tool: save_sql_query

Save a SQL query so it appears in the Saved Queries list and can be
opened in SQL Lab via a direct URL.
"""

import logging

from fastmcp import Context
from superset_core.mcp import tool

from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.mcp_service.sql_lab.schemas import (
    SaveSqlQueryRequest,
    SaveSqlQueryResponse,
)
from superset.mcp_service.utils.schema_utils import parse_request
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)


@tool(tags=["mutate"])
@parse_request(SaveSqlQueryRequest)
def save_sql_query(request: SaveSqlQueryRequest, ctx: Context) -> SaveSqlQueryResponse:
    """Save a SQL query as a named saved query.

    The saved query appears in the Saved Queries list and can be opened
    directly in SQL Lab via the returned URL.

    Typical workflow:
    1. execute_sql(database_id, sql) — run and verify the query
    2. save_sql_query(database_id, sql, label) — persist it

    Returns:
    - Saved query ID, label, and SQL Lab URL
    """
    try:
        from flask import g

        from superset import db, security_manager
        from superset.models.core import Database
        from superset.models.sql_lab import SavedQuery

        # Validate database exists and user has access
        with event_logger.log_context(action="mcp.save_sql_query.db_validation"):
            database = (
                db.session.query(Database).filter_by(id=request.database_id).first()
            )
            if not database:
                return SaveSqlQueryResponse(
                    id=0,
                    label=request.label,
                    sql_lab_url="",
                    error=f"Database with ID {request.database_id} not found",
                )

            if not security_manager.can_access_database(database):
                return SaveSqlQueryResponse(
                    id=0,
                    label=request.label,
                    sql_lab_url="",
                    error=f"Access denied to database {database.database_name}",
                )

        # Create the saved query
        with event_logger.log_context(action="mcp.save_sql_query.create"):
            saved_query = SavedQuery(
                db_id=request.database_id,
                sql=request.sql,
                label=request.label,
                description=request.description or "",
                schema=request.schema_name or "",
                catalog=request.catalog,
                template_parameters=request.template_parameters,
                user_id=g.user.id if hasattr(g, "user") and g.user else None,
            )

            db.session.add(saved_query)
            db.session.commit()

        sql_lab_url = f"{get_superset_base_url()}/sqllab?savedQueryId={saved_query.id}"

        logger.info(
            "Saved query created: id=%s, label=%s", saved_query.id, saved_query.label
        )

        return SaveSqlQueryResponse(
            id=saved_query.id,
            label=saved_query.label,
            sql_lab_url=sql_lab_url,
            database_name=database.database_name,
        )

    except SupersetSecurityException as exc:
        logger.warning("Security error saving query: %s", exc)
        return SaveSqlQueryResponse(
            id=0,
            label=request.label,
            sql_lab_url="",
            error=f"Permission denied: {exc}",
        )
