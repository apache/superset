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

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.saved_query.schemas import (
    CreateSavedQueryRequest,
    CreateSavedQueryResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="SavedQuery",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create saved query",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_saved_query(
    request: CreateSavedQueryRequest, ctx: Context
) -> CreateSavedQueryResponse:
    """Save a SQL query to the Saved Queries list so it can be reloaded and shared.

    Creates a persistent SavedQuery that appears in the Saved Queries page
    and can be opened in SQL Lab via the returned URL.

    Workflow:
    1. Call execute_sql to verify the query returns expected results
    2. Call this tool with a label and the SQL to persist it
    3. Use the returned ``url`` to open the saved query in SQL Lab
    """
    await ctx.info(
        "Creating saved query: db_id=%s, label=%r" % (request.db_id, request.label)
    )

    try:
        from superset.commands.query.create import CreateSavedQueryCommand
        from superset.commands.query.exceptions import (
            SavedQueryCreateFailedError,
            SavedQueryInvalidError,
        )
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        properties: dict[str, Any] = {
            "db_id": request.db_id,
            "label": request.label,
            "sql": request.sql,
        }
        if request.schema is not None:
            properties["schema"] = request.schema
        if request.description is not None:
            properties["description"] = request.description
        if request.template_parameters is not None:
            properties["template_parameters"] = request.template_parameters

        with event_logger.log_context(action="mcp.create_saved_query.create"):
            saved_query = CreateSavedQueryCommand(properties).run()

        base_url = get_superset_base_url()
        saved_query_url = f"{base_url}/sqllab?savedQueryId={saved_query.id}"

        await ctx.info(
            "Saved query created: id=%s, url=%s" % (saved_query.id, saved_query_url)
        )

        return CreateSavedQueryResponse(
            id=saved_query.id,
            label=saved_query.label,
            sql=saved_query.sql,
            db_id=saved_query.db_id,
            schema=saved_query.schema or None,
            description=saved_query.description or None,
            url=saved_query_url,
        )

    except SavedQueryInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Saved query validation failed: %s" % (messages,))
        return CreateSavedQueryResponse(
            id=None,
            label=request.label,
            sql=request.sql,
            db_id=request.db_id,
            url=None,
            error=str(messages),
        )
    except SavedQueryCreateFailedError as exc:
        await ctx.error("Saved query creation failed: %s" % (str(exc),))
        return CreateSavedQueryResponse(
            id=None,
            label=request.label,
            sql=request.sql,
            db_id=request.db_id,
            url=None,
            error=f"Failed to create saved query: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating saved query: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
