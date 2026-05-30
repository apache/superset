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
Get CSS template info FastMCP tool
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.css_template.schemas import (
    CssTemplateError,
    CssTemplateInfo,
    GetCssTemplateInfoRequest,
    serialize_css_template_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="CssTemplate",
    annotations=ToolAnnotations(
        title="Get CSS template info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_css_template_info(
    request: GetCssTemplateInfoRequest, ctx: Context
) -> CssTemplateInfo | CssTemplateError:
    """Get CSS template details by ID or UUID.

    Returns the full CSS template including the css content.

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 123) or UUID string (e.g., "a1b2c3d4-...")
    - To find a CSS template ID, use the list_css_templates tool first

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info(
        "Retrieving CSS template information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.css import CssTemplateDAO

        with event_logger.log_context(action="mcp.get_css_template_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=CssTemplateDAO,
                output_schema=CssTemplateInfo,
                error_schema=CssTemplateError,
                serializer=serialize_css_template_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, CssTemplateInfo):
            await ctx.info(
                "CSS template information retrieved successfully: "
                "id=%s, template_name=%s" % (result.id, result.template_name)
            )
        else:
            await ctx.warning(
                "CSS template retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "CSS template information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return CssTemplateError(
            error=f"Failed to get CSS template info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
