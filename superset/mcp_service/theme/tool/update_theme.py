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

from fastmcp import Context
from marshmallow import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.theme.exceptions import (
    SystemThemeProtectedError,
    ThemeNotFoundError,
)
from superset.commands.theme.update import UpdateThemeCommand
from superset.daos.theme import ThemeDAO
from superset.extensions import event_logger
from superset.mcp_service.theme.schemas import (
    UpdateThemeRequest,
    UpdateThemeResponse,
)
from superset.themes.schemas import ThemePutSchema

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Theme",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update theme",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_theme(
    request: UpdateThemeRequest, ctx: Context
) -> UpdateThemeResponse:
    """Update an existing Superset theme's name or Ant Design token configuration.

    Provide the ``id`` of the theme to update plus any fields to change.
    Fields left as ``None`` are preserved from the existing theme.
    System themes cannot be modified.
    """
    await ctx.info("Updating theme: id=%s" % (request.id,))

    try:
        # Fetch current theme to support partial updates (merge missing fields)
        existing = ThemeDAO.find_by_id(request.id)
        if existing is None:
            await ctx.warning("Theme not found: id=%s" % (request.id,))
            return UpdateThemeResponse(id=None, error="Theme not found.")

        theme_name = (
            request.theme_name
            if request.theme_name is not None
            else existing.theme_name
        )
        json_data = (
            request.json_data if request.json_data is not None else existing.json_data
        )

        # Validate and sanitize using the same schema as the REST API PUT endpoint
        schema = ThemePutSchema()
        try:
            item = schema.load({"theme_name": theme_name, "json_data": json_data})
        except ValidationError as exc:
            messages = exc.normalized_messages()
            await ctx.warning("Theme validation failed: %s" % (messages,))
            return UpdateThemeResponse(id=request.id, error=str(messages))

        item["json_data"] = schema.context.get("sanitized_json_data", item["json_data"])

        with event_logger.log_context(action="mcp.update_theme.update"):
            updated = UpdateThemeCommand(request.id, item).run()

        await ctx.info(
            "Theme updated: id=%s, theme_name=%r" % (updated.id, updated.theme_name)
        )
        return UpdateThemeResponse(
            id=updated.id,
            theme_name=updated.theme_name,
            json_data=updated.json_data,
        )

    except ThemeNotFoundError:
        await ctx.warning("Theme not found: id=%s" % (request.id,))
        return UpdateThemeResponse(id=None, error="Theme not found.")
    except SystemThemeProtectedError:
        await ctx.warning("System theme cannot be modified: id=%s" % (request.id,))
        return UpdateThemeResponse(
            id=request.id, error="System themes cannot be modified."
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating theme: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
