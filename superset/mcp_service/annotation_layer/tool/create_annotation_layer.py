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
from superset.mcp_service.annotation_layer.schemas import (
    CreateAnnotationLayerRequest,
    CreateAnnotationLayerResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Annotation",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create annotation layer",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_annotation_layer(
    request: CreateAnnotationLayerRequest, ctx: Context
) -> CreateAnnotationLayerResponse:
    """Create a named annotation layer in Superset.

    Annotation layers group annotations that can be overlaid on charts.
    Use this tool to create a new layer before adding annotations to it.

    Workflow:
    1. Call this tool with a unique name and optional description
    2. Use the returned ``id`` to add annotations via the Superset API
    """
    await ctx.info("Creating annotation layer: name=%r" % (request.name,))

    try:
        from superset.commands.annotation_layer.create import (
            CreateAnnotationLayerCommand,
        )
        from superset.commands.annotation_layer.exceptions import (
            AnnotationLayerCreateFailedError,
            AnnotationLayerInvalidError,
        )

        properties: dict[str, Any] = {"name": request.name}
        if request.descr is not None:
            properties["descr"] = request.descr

        with event_logger.log_context(action="mcp.create_annotation_layer.create"):
            layer = CreateAnnotationLayerCommand(properties).run()

        await ctx.info(
            "Annotation layer created: id=%s, name=%r" % (layer.id, layer.name)
        )

        return CreateAnnotationLayerResponse(
            id=layer.id,
            name=layer.name,
            descr=layer.descr,
        )

    except AnnotationLayerInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Annotation layer validation failed: %s" % (messages,))
        return CreateAnnotationLayerResponse(
            id=None,
            name=request.name,
            descr=request.descr,
            error=str(messages),
        )
    except AnnotationLayerCreateFailedError as exc:
        await ctx.error("Annotation layer creation failed: %s" % (str(exc),))
        return CreateAnnotationLayerResponse(
            id=None,
            name=request.name,
            descr=request.descr,
            error=f"Failed to create annotation layer: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating annotation layer: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
