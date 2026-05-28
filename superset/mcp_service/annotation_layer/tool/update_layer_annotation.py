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
    UpdateLayerAnnotationRequest,
    UpdateLayerAnnotationResponse,
)

logger = logging.getLogger(__name__)


def _build_update_properties(request: UpdateLayerAnnotationRequest) -> dict[str, Any]:
    """Build the properties dict for UpdateAnnotationCommand from the request."""
    properties: dict[str, Any] = {"layer": request.layer_id}
    if request.short_descr is not None:
        properties["short_descr"] = request.short_descr
    if request.start_dttm is not None:
        properties["start_dttm"] = request.start_dttm
    if request.end_dttm is not None:
        properties["end_dttm"] = request.end_dttm
    if request.long_descr is not None:
        properties["long_descr"] = request.long_descr
    if request.json_metadata is not None:
        properties["json_metadata"] = request.json_metadata
    return properties


@tool(
    tags=["mutate"],
    class_permission_name="Annotation",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update an annotation in an annotation layer",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_layer_annotation(
    request: UpdateLayerAnnotationRequest, ctx: Context
) -> UpdateLayerAnnotationResponse:
    """Update an existing annotation in an annotation layer.

    Use this tool to change the time range, description, or metadata of an
    existing annotation — for example to correct a deployment window or extend
    an outage marker.

    All fields except layer_id and annotation_id are optional; only the
    fields provided will be updated.

    Workflow:
    1. Identify the annotation layer (layer_id) and annotation (annotation_id).
    2. Call this tool with the fields you want to change.
    3. The annotation will be updated in place on all charts that reference
       that layer.
    """
    await ctx.info(
        "Updating annotation: layer_id=%s, annotation_id=%s"
        % (request.layer_id, request.annotation_id)
    )

    try:
        from superset.commands.annotation_layer.annotation.exceptions import (
            AnnotationInvalidError,
            AnnotationNotFoundError,
            AnnotationUpdateFailedError,
        )
        from superset.commands.annotation_layer.annotation.update import (
            UpdateAnnotationCommand,
        )
        from superset.commands.annotation_layer.exceptions import (
            AnnotationLayerNotFoundError,
        )

        properties = _build_update_properties(request)

        with event_logger.log_context(action="mcp.update_layer_annotation.update"):
            annotation = UpdateAnnotationCommand(
                request.annotation_id, properties
            ).run()

        await ctx.info(
            "Annotation updated: id=%s, layer_id=%s" % (annotation.id, request.layer_id)
        )

        return UpdateLayerAnnotationResponse(
            id=annotation.id,
            layer_id=request.layer_id,
            short_descr=annotation.short_descr,
            start_dttm=annotation.start_dttm,
            end_dttm=annotation.end_dttm,
            long_descr=getattr(annotation, "long_descr", None),
        )

    except AnnotationNotFoundError as exc:
        await ctx.warning(
            "Annotation not found: annotation_id=%s" % (request.annotation_id,)
        )
        return UpdateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            error=f"Annotation {request.annotation_id} not found: {exc}",
        )
    except AnnotationLayerNotFoundError as exc:
        await ctx.warning(
            "Annotation layer not found: layer_id=%s" % (request.layer_id,)
        )
        return UpdateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            error=f"Annotation layer {request.layer_id} not found: {exc}",
        )
    except AnnotationInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Annotation validation failed: %s" % (messages,))
        return UpdateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            error=str(messages),
        )
    except AnnotationUpdateFailedError as exc:
        await ctx.error("Annotation update failed: %s" % (str(exc),))
        return UpdateLayerAnnotationResponse(
            id=None,
            layer_id=request.layer_id,
            error=f"Failed to update annotation: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating annotation: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
