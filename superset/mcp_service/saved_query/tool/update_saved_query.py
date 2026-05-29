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
    UpdateSavedQueryRequest,
    UpdateSavedQueryResponse,
)

logger = logging.getLogger(__name__)

_LOGGABLE_FIELDS = (
    "label",
    "sql",
    "db_id",
    "schema",
    "description",
    "template_parameters",
)


def _build_update_properties(request: "UpdateSavedQueryRequest") -> dict[str, Any]:
    """Return only the fields the caller explicitly provided."""
    fields = {
        "label": request.label,
        "sql": request.sql,
        "db_id": request.db_id,
        "schema": request.schema,
        "description": request.description,
        "template_parameters": request.template_parameters,
    }
    return {k: v for k, v in fields.items() if v is not None}


@tool(
    tags=["mutate"],
    class_permission_name="SavedQuery",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update saved query",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_saved_query(
    request: UpdateSavedQueryRequest, ctx: Context
) -> UpdateSavedQueryResponse:
    """Update an existing saved query's label, SQL, database, schema, or description.

    All fields except ``id`` are optional — only provided fields are changed.
    The query must already exist and the caller must have write access to
    the SavedQuery resource.

    Example: rename only
    ```json
    {"id": 42, "label": "Monthly Revenue"}
    ```

    Example: update SQL and description
    ```json
    {"id": 42, "sql": "SELECT * FROM orders LIMIT 100", "description": "All orders"}
    ```
    """
    changed = [f for f in _LOGGABLE_FIELDS if getattr(request, f, None) is not None]
    await ctx.info("Updating saved query: id=%s, fields=%s" % (request.id, changed))

    try:
        from superset.commands.query.exceptions import (
            SavedQueryInvalidError,
            SavedQueryNotFoundError,
            SavedQueryUpdateFailedError,
        )
        from superset.commands.query.update import UpdateSavedQueryCommand
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        properties = _build_update_properties(request)

        if not properties:
            return UpdateSavedQueryResponse(
                id=None,
                error=(
                    "No fields to update. Provide at least one of: "
                    "label, sql, db_id, schema, description, template_parameters."
                ),
            )

        with event_logger.log_context(action="mcp.update_saved_query.update"):
            saved_query = UpdateSavedQueryCommand(request.id, properties).run()

        base_url = get_superset_base_url()
        saved_query_url = f"{base_url}/sqllab?savedQueryId={saved_query.id}"

        await ctx.info(
            "Saved query updated: id=%s, url=%s" % (saved_query.id, saved_query_url)
        )

        return UpdateSavedQueryResponse(
            id=saved_query.id,
            label=saved_query.label,
            sql=saved_query.sql,
            db_id=saved_query.db_id,
            schema=saved_query.schema or None,
            description=saved_query.description or None,
            url=saved_query_url,
        )

    except SavedQueryNotFoundError:
        await ctx.warning("Saved query not found: id=%s" % (request.id,))
        return UpdateSavedQueryResponse(
            id=None,
            error=f"Saved query with ID {request.id} not found.",
        )
    except SavedQueryInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Saved query validation failed: %s" % (messages,))
        return UpdateSavedQueryResponse(
            id=None,
            error=str(messages),
        )
    except SavedQueryUpdateFailedError as exc:
        await ctx.error("Saved query update failed: %s" % (str(exc),))
        return UpdateSavedQueryResponse(
            id=None,
            error=f"Failed to update saved query: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating saved query: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
