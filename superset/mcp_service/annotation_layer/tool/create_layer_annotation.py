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
    CreateLayerAnnotationRequest,
    CreateLayerAnnotationResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Annotation",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Add annotation to an annotation layer",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_layer_annotation(
    request: CreateLayerAnnotationRequest, ctx: Context
) -> CreateLayerAnnotationResponse:
    """Add a new annotation to an existing annotation layer.

    Use this tool when a user wants to mark a specific time range on charts
    with a label or note — for example, to flag a deployment, an outage, or
    a campaign period.

    Workflow:
    1. Identify the target annotation layer (layer_id). Use list tools if needed.
    2. Call this tool with the layer_id, a short description, and the time range.
    3. The annotation will appear on charts that reference that layer.
    """
    await ctx.info(
        "Creating annotation: layer_id=%s, short_descr=%r"
        % (request.layer_id, request.short_descr)
    )

    try:
        from superset.commands.annotation_layer.annotation.create import (
            CreateAnnotationCommand,
        )
        from superset.commands.annotation_layer.annotation.exceptions import (
            AnnotationCreateFailedError,
            AnnotationInvalidError,
        )
        from superset.commands.annotation_layer.exceptions import (
            AnnotationLayerNotFoundError,
        )

        properties: dict[str, Any] = {
            "layer": request.layer_id,
            "short_descr": request.short_descr,
            "start_dttm": request.start_dttm,
            "end_dttm": request.end_dttm,
        }
        if request.long_descr is not None:
            properties["long_descr"] = request.long_descr
        if request.json_metadata is not None:
            properties["json_metadata"] = request.json_metadata

        with event_logger.log_context(action="mcp.create_layer_annotation.create"):
            annotation = CreateAnnotationCommand(properties).run()

        await ctx.info(
            "Annotation created: id=%s, layer_id=%s, short_descr=%r"
            % (annotation.id, request.layer_id, request.short_descr)
        )

        return CreateLayerAnnotationResponse(
            id=annotation.id,
            layer_id=request.layer_id,
            short_descr=annotation.short_descr,
            start_dttm=annotation.start_dttm,
            end_dttm=annotation.end_dttm,
            long_descr=getattr(annotation, "long_descr", None),
        )

    except AnnotationLayerNotFoundError as exc:
        await ctx.warning(
            "Annotation layer not found: layer_id=%s" % (request.layer_id,)
        )
        return CreateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            short_descr=request.short_descr,
            start_dttm=request.start_dttm,
            end_dttm=request.end_dttm,
            error=f"Annotation layer {request.layer_id} not found: {exc}",
        )
    except AnnotationInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Annotation validation failed: %s" % (messages,))
        return CreateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            short_descr=request.short_descr,
            start_dttm=request.start_dttm,
            end_dttm=request.end_dttm,
            error=str(messages),
        )
    except AnnotationCreateFailedError as exc:
        await ctx.error("Annotation creation failed: %s" % (str(exc),))
        return CreateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            short_descr=request.short_descr,
            start_dttm=request.start_dttm,
            end_dttm=request.end_dttm,
            error=f"Failed to create annotation: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating annotation: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
