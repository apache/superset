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
Create theme FastMCP tool

Creates a reusable Superset theme from an antd design-token configuration.
The supplied json_data is sanitized and validated with the same routine the
REST API uses before the theme is persisted via ThemeDAO.
"""

import logging
from typing import Any

from fastmcp import Context
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.theme.schemas import CreateThemeRequest, CreateThemeResponse
from superset.mcp_service.utils.sanitization import sanitize_for_llm_context
from superset.themes.schemas import _sanitize_and_validate_theme_config
from superset.utils import json

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
    """Create a reusable theme from antd design tokens.

    Accepts a theme name and an antd design-token configuration (json_data),
    supplied either as a JSON object or a JSON string. The configuration is
    sanitized and validated the same way the REST API validates themes before
    the theme is persisted.

    Required fields:
    - theme_name: Human-readable name for the theme
    - json_data: The antd design-token configuration (dict or JSON string)

    Example:
    ```json
    {
        "theme_name": "Corporate Blue",
        "json_data": {"token": {"colorPrimary": "#1d4ed8"}}
    }
    ```

    Returns CreateThemeResponse with the new theme's id and uuid on success,
    or an error response (error_type="ValidationError") if the configuration
    is invalid.
    """
    await ctx.info("Creating theme: theme_name=%s" % (request.theme_name,))

    # Parse json_data into a dict (accept dict or JSON string)
    config_dict: dict[str, Any]
    if isinstance(request.json_data, str):
        try:
            parsed = json.loads(request.json_data)
        except (TypeError, json.JSONDecodeError) as exc:
            await ctx.warning("Invalid JSON in json_data: %s" % (str(exc),))
            return CreateThemeResponse(
                success=False,
                error=f"json_data is not valid JSON: {exc}",
                error_type="ValidationError",
            )
        if not isinstance(parsed, dict):
            await ctx.warning("json_data did not parse to an object")
            return CreateThemeResponse(
                success=False,
                error="json_data must be a JSON object",
                error_type="ValidationError",
            )
        config_dict = parsed
    else:
        config_dict = request.json_data

    # Sanitize and validate using the same routine as the REST API
    try:
        sanitized = _sanitize_and_validate_theme_config(config_dict)
    except ValidationError as exc:
        await ctx.warning("Theme validation failed: %s" % (exc.messages,))
        return CreateThemeResponse(
            success=False,
            error=str(exc.messages),
            error_type="ValidationError",
        )

    try:
        from superset.daos.theme import ThemeDAO

        with event_logger.log_context(action="mcp.create_theme"):
            theme = ThemeDAO.create(
                attributes={
                    "theme_name": request.theme_name,
                    "json_data": json.dumps(sanitized),
                    "is_system": False,
                }
            )
            db.session.commit()  # pylint: disable=consider-using-transaction

        await ctx.info(
            "Theme created: id=%s, uuid=%s" % (theme.id, getattr(theme, "uuid", None))
        )
        # Wrap the user-controlled name like the list/get responses do, so
        # the create path is not an unsanitized echo channel into LLM context.
        safe_name = sanitize_for_llm_context(
            theme.theme_name, field_path=("theme_name",)
        )
        return CreateThemeResponse(
            success=True,
            id=theme.id,
            uuid=str(uuid) if (uuid := getattr(theme, "uuid", None)) else None,
            theme_name=safe_name,
            message=f"Theme '{safe_name}' created successfully",
        )

    except SQLAlchemyError as exc:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        logger.exception("Failed to create theme")
        await ctx.error("Failed to create theme: %s" % (str(exc),))
        return CreateThemeResponse(
            success=False,
            # Raw SQLAlchemy text can leak SQL/connection details; the full
            # exception is already in the server log via logger.exception.
            error="Failed to create theme due to a database error.",
            error_type="CreateFailedError",
        )
    except Exception as exc:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        logger.exception("Unexpected error in create_theme")
        await ctx.error("Unexpected error: %s" % (type(exc).__name__,))
        raise
