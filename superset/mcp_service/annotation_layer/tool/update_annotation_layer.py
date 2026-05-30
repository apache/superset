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
    UpdateAnnotationLayerRequest,
    UpdateAnnotationLayerResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Annotation",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update annotation layer",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def update_annotation_layer(
    request: UpdateAnnotationLayerRequest, ctx: Context
) -> UpdateAnnotationLayerResponse:
    """Update an existing annotation layer's name or description.

    Use this tool to rename an annotation layer or update its description.
    At least one of ``name`` or ``descr`` must be provided.

    Workflow:
    1. Call this tool with the layer ``id`` and the fields to change
    2. The updated layer ``id`` and new values are returned on success
    """
    await ctx.info(
        "Updating annotation layer: id=%s, name=%r" % (request.id, request.name)
    )

    try:
        from superset.commands.annotation_layer.exceptions import (
            AnnotationLayerInvalidError,
            AnnotationLayerNotFoundError,
            AnnotationLayerUpdateFailedError,
        )
        from superset.commands.annotation_layer.update import (
            UpdateAnnotationLayerCommand,
        )

        properties: dict[str, Any] = {}
        if request.name is not None:
            properties["name"] = request.name
        if request.descr is not None:
            properties["descr"] = request.descr

        with event_logger.log_context(action="mcp.update_annotation_layer.update"):
            layer = UpdateAnnotationLayerCommand(request.id, properties).run()

        await ctx.info(
            "Annotation layer updated: id=%s, name=%r" % (layer.id, layer.name)
        )

        return UpdateAnnotationLayerResponse(
            id=layer.id,
            name=layer.name,
            descr=layer.descr,
        )

    except AnnotationLayerNotFoundError:
        await ctx.warning("Annotation layer not found: id=%s" % (request.id,))
        return UpdateAnnotationLayerResponse(
            id=None,
            name=request.name,
            descr=request.descr,
            error=f"Annotation layer {request.id} not found",
        )
    except AnnotationLayerInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Annotation layer validation failed: %s" % (messages,))
        return UpdateAnnotationLayerResponse(
            id=None,
            name=request.name,
            descr=request.descr,
            error=str(messages),
        )
    except AnnotationLayerUpdateFailedError as exc:
        await ctx.error("Annotation layer update failed: %s" % (str(exc),))
        return UpdateAnnotationLayerResponse(
            id=None,
            name=request.name,
            descr=request.descr,
            error=f"Failed to update annotation layer: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating annotation layer: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
