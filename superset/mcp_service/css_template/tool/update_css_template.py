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

from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.css_template.schemas import (
    UpdateCssTemplateRequest,
    UpdateCssTemplateResponse,
)


@tool(
    tags=["mutate"],
    class_permission_name="CssTemplate",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update CSS template",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def update_css_template(
    request: UpdateCssTemplateRequest, ctx: Context
) -> UpdateCssTemplateResponse:
    """Update an existing CSS template's name or CSS content.

    Use this tool when a user wants to rename a CSS template or replace its
    CSS content. At least one of ``template_name`` or ``css`` must be provided.

    The template is identified by its ``id``.
    """
    await ctx.info(
        "Updating CSS template: id=%s, fields=%r"
        % (
            request.id,
            [f for f in ("template_name", "css") if getattr(request, f) is not None],
        )
    )

    try:
        from superset.commands.css.exceptions import (
            CssTemplateInvalidError,
            CssTemplateNotFoundError,
            CssTemplateUpdateFailedError,
        )
        from superset.commands.css.update import UpdateCssTemplateCommand

        properties: dict[str, Any] = {}
        if request.template_name is not None:
            properties["template_name"] = request.template_name
        if request.css is not None:
            properties["css"] = request.css

        if not properties:
            return UpdateCssTemplateResponse(
                error="At least one of template_name or css must be provided.",
            )

        with event_logger.log_context(action="mcp.update_css_template.update"):
            template = UpdateCssTemplateCommand(request.id, properties).run()

        await ctx.info(
            "CSS template updated: id=%s, template_name=%r"
            % (template.id, template.template_name)
        )

        return UpdateCssTemplateResponse(
            id=template.id,
            template_name=template.template_name,
            css=template.css,
        )

    except CssTemplateNotFoundError:
        await ctx.warning("CSS template not found: id=%s" % (request.id,))
        return UpdateCssTemplateResponse(
            error="CSS template not found: %s" % (request.id,),
        )
    except CssTemplateInvalidError as exc:
        await ctx.warning("CSS template validation failed: %s" % (str(exc),))
        return UpdateCssTemplateResponse(
            error=str(exc),
        )
    except CssTemplateUpdateFailedError as exc:
        await ctx.error("CSS template update failed: %s" % (str(exc),))
        return UpdateCssTemplateResponse(
            error="Failed to update CSS template: %s" % (exc,),
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating CSS template: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
