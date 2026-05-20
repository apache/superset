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

"""Get annotation layer info FastMCP tool."""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.annotation_layer.schemas import (
    AnnotationLayerError,
    AnnotationLayerInfo,
    GetAnnotationLayerInfoRequest,
    serialize_annotation_layer,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Annotation",
    annotations=ToolAnnotations(
        title="Get annotation layer info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_annotation_layer_info(
    request: GetAnnotationLayerInfoRequest,
    ctx: Context,
) -> AnnotationLayerInfo | AnnotationLayerError:
    """Get detailed information about an annotation layer by ID.

    Returns the layer's name, description, and timestamps.

    Example:
    ```json
    {"id": 1}
    ```
    """
    await ctx.info("Retrieving annotation layer: id=%s" % (request.id,))

    try:
        from superset.daos.annotation_layer import AnnotationLayerDAO

        with event_logger.log_context(action="mcp.get_annotation_layer_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=AnnotationLayerDAO,
                output_schema=AnnotationLayerInfo,
                error_schema=AnnotationLayerError,
                serializer=serialize_annotation_layer,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.id)

        if isinstance(result, AnnotationLayerInfo):
            await ctx.info(
                "Annotation layer retrieved: id=%s, name=%s" % (result.id, result.name)
            )
        else:
            await ctx.warning(
                "Annotation layer not found: id=%s, error_type=%s"
                % (request.id, result.error_type)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Annotation layer lookup failed: id=%s, error=%s, error_type=%s"
            % (request.id, str(e), type(e).__name__)
        )
        return AnnotationLayerError(
            error=f"Failed to get annotation layer info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
