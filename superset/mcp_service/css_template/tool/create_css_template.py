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

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.css_template.schemas import (
    CreateCssTemplateRequest,
    CreateCssTemplateResponse,
)


@tool(
    tags=["mutate"],
    class_permission_name="CssTemplate",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create CSS template",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_css_template(
    request: CreateCssTemplateRequest, ctx: Context
) -> CreateCssTemplateResponse:
    """Create a new CSS template that can be applied to dashboards.

    Use this tool when a user wants to save a CSS stylesheet as a named
    template for reuse across multiple dashboards.

    The returned ``id`` can be used when configuring dashboard appearance.
    """
    await ctx.info("Creating CSS template: template_name=%r" % (request.template_name,))

    try:
        from superset.commands.css.create import CreateCssTemplateCommand
        from superset.commands.css.exceptions import (
            CssTemplateCreateFailedError,
            CssTemplateInvalidError,
        )

        with event_logger.log_context(action="mcp.create_css_template.create"):
            template = CreateCssTemplateCommand(
                {
                    "template_name": request.template_name,
                    "css": request.css,
                }
            ).run()

        await ctx.info(
            "CSS template created: id=%s, template_name=%r"
            % (template.id, template.template_name)
        )

        return CreateCssTemplateResponse(
            id=template.id,
            template_name=template.template_name,
            css=template.css,
        )

    except CssTemplateInvalidError as exc:
        await ctx.warning("CSS template validation failed: %s" % (str(exc),))
        return CreateCssTemplateResponse(
            template_name=request.template_name,
            css=request.css,
            error=str(exc),
        )
    except CssTemplateCreateFailedError as exc:
        await ctx.error("CSS template creation failed: %s" % (str(exc),))
        return CreateCssTemplateResponse(
            template_name=request.template_name,
            css=request.css,
            error=f"Failed to create CSS template: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating CSS template: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
