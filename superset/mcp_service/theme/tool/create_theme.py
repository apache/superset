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

from superset.extensions import db, event_logger
from superset.mcp_service.theme.schemas import (
    CreateThemeRequest,
    CreateThemeResponse,
)
from superset.models.core import Theme
from superset.themes.schemas import ThemePostSchema
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Theme",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create theme",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_theme(
    request: CreateThemeRequest, ctx: Context
) -> CreateThemeResponse:
    """Create a new Superset theme with custom Ant Design token styling.

    Use this tool when a user wants to save a custom color scheme, typography,
    or other visual styling as a reusable Superset theme.

    The ``json_data`` field must be a valid Ant Design theme token JSON string,
    for example: ``{"token": {"colorPrimary": "#1677ff"}}``.

    After creating the theme, an admin can activate it as the instance default
    via the Superset UI or the set_system_default API endpoint.
    """
    await ctx.info("Creating theme: theme_name=%r" % (request.theme_name,))

    try:
        # Validate and sanitize inputs using the same schema as the REST API
        schema = ThemePostSchema()
        try:
            item = schema.load(
                {"theme_name": request.theme_name, "json_data": request.json_data}
            )
        except ValidationError as exc:
            messages = exc.normalized_messages()
            await ctx.warning("Theme validation failed: %s" % (messages,))
            return CreateThemeResponse(
                id=None,
                theme_name=request.theme_name,
                json_data=request.json_data,
                error=str(messages),
            )

        # Use sanitized json_data if the schema produced one
        json_data = schema.context.get("sanitized_json_data", item["json_data"])

        with event_logger.log_context(action="mcp.create_theme.create"):

            @transaction()
            def _create() -> Theme:
                new_theme = Theme(
                    theme_name=item["theme_name"],
                    json_data=json_data,
                    is_system=False,
                )
                db.session.add(new_theme)
                db.session.flush()
                return new_theme

            new_theme = _create()

        await ctx.info(
            "Theme created: id=%s, theme_name=%r" % (new_theme.id, new_theme.theme_name)
        )

        return CreateThemeResponse(
            id=new_theme.id,
            theme_name=new_theme.theme_name,
            json_data=new_theme.json_data,
        )

    except Exception as exc:
        await ctx.error(
            "Unexpected error creating theme: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
