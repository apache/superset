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

"""List annotations within a layer FastMCP tool."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.extensions import event_logger
from superset.mcp_service.annotation_layer.schemas import (
    AnnotationFilter,
    AnnotationInfo,
    AnnotationLayerError,
    AnnotationList,
    DEFAULT_ANNOTATION_COLUMNS,
    ListLayerAnnotationsRequest,
    serialize_annotation,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

_ALL_ANNOTATION_COLUMNS = [
    "id",
    "short_descr",
    "long_descr",
    "start_dttm",
    "end_dttm",
    "json_metadata",
    "layer_id",
]
_SORTABLE_ANNOTATION_COLUMNS = ["id", "short_descr", "start_dttm", "end_dttm"]


@tool(
    tags=["core"],
    class_permission_name="Annotation",
    annotations=ToolAnnotations(
        title="List annotations in a layer",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_layer_annotations(
    request: ListLayerAnnotationsRequest,
    ctx: Context,
) -> AnnotationList | AnnotationLayerError:
    """List annotations within a specific annotation layer.

    The layer_id parameter is required and scopes all results to that layer.

    Sortable columns for order_column: id, short_descr, start_dttm, end_dttm

    Example:
    ```json
    {"layer_id": 1, "page": 1, "page_size": 25}
    ```
    """
    await ctx.info(
        "Listing annotations: layer_id=%s, page=%s, page_size=%s, search=%s"
        % (request.layer_id, request.page, request.page_size, request.search)
    )

    try:
        from superset.daos.annotation_layer import AnnotationDAO, AnnotationLayerDAO

        # Verify the layer exists before listing
        layer = AnnotationLayerDAO.find_by_id(request.layer_id)
        if layer is None:
            await ctx.warning("Annotation layer not found: id=%s" % (request.layer_id,))
            return AnnotationLayerError.create(
                error=f"Annotation layer with id '{request.layer_id}' not found",
                error_type="not_found",
            )

        # Prepend the layer_id filter so results are scoped to this layer
        layer_filter = ColumnOperator(
            col="layer_id", opr=ColumnOperatorEnum.eq, value=request.layer_id
        )
        combined_filters: list[ColumnOperator] = [layer_filter] + list(request.filters)

        def _serialize(obj: object, cols: list[str] | None) -> AnnotationInfo | None:
            return serialize_annotation(obj)

        list_tool = ModelListCore(
            dao_class=AnnotationDAO,
            output_schema=AnnotationInfo,
            item_serializer=_serialize,
            filter_type=AnnotationFilter,
            default_columns=DEFAULT_ANNOTATION_COLUMNS,
            search_columns=["short_descr", "long_descr"],
            list_field_name="annotations",
            output_list_schema=AnnotationList,
            all_columns=_ALL_ANNOTATION_COLUMNS,
            sortable_columns=_SORTABLE_ANNOTATION_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_layer_annotations.query"):
            result = list_tool.run_tool(
                filters=combined_filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        result.layer_id = request.layer_id

        await ctx.info(
            "Annotations listed: layer_id=%s, count=%s, total_count=%s"
            % (
                request.layer_id,
                len(result.annotations) if hasattr(result, "annotations") else 0,
                getattr(result, "total_count", None),
            )
        )
        return result

    except Exception as e:
        await ctx.error(
            "Annotation listing failed: layer_id=%s, error=%s, error_type=%s"
            % (request.layer_id, str(e), type(e).__name__)
        )
        raise
