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

"""List annotation layers FastMCP tool."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.annotation_layer.schemas import (
    AnnotationLayerError,
    AnnotationLayerFilter,
    AnnotationLayerInfo,
    AnnotationLayerList,
    DEFAULT_LAYER_COLUMNS,
    ListAnnotationLayersRequest,
    serialize_annotation_layer,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

_DEFAULT_REQUEST = ListAnnotationLayersRequest()

_ALL_LAYER_COLUMNS = ["id", "name", "descr", "changed_on", "created_on"]
_SORTABLE_LAYER_COLUMNS = ["id", "name", "changed_on", "created_on"]


@tool(
    tags=["core"],
    class_permission_name="Annotation",
    annotations=ToolAnnotations(
        title="List annotation layers",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_annotation_layers(
    request: ListAnnotationLayersRequest | None = None,
    ctx: Context | None = None,
) -> AnnotationLayerList | AnnotationLayerError:
    """List annotation layers with filtering, search, and pagination.

    Returns annotation layer metadata including name and description.

    Sortable columns for order_column: id, name, changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_annotation_layers")

    request = request or _DEFAULT_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing annotation layers: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )

    try:
        from superset.daos.annotation_layer import AnnotationLayerDAO

        def _serialize(
            obj: object, cols: list[str] | None
        ) -> AnnotationLayerInfo | None:
            return serialize_annotation_layer(obj)

        list_tool = ModelListCore(
            dao_class=AnnotationLayerDAO,
            output_schema=AnnotationLayerInfo,
            item_serializer=_serialize,
            filter_type=AnnotationLayerFilter,
            default_columns=DEFAULT_LAYER_COLUMNS,
            search_columns=["name", "descr"],
            list_field_name="annotation_layers",
            output_list_schema=AnnotationLayerList,
            all_columns=_ALL_LAYER_COLUMNS,
            sortable_columns=_SORTABLE_LAYER_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_annotation_layers.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "Annotation layers listed: count=%s, total_count=%s"
            % (
                len(result.annotation_layers)
                if hasattr(result, "annotation_layers")
                else 0,
                getattr(result, "total_count", None),
            )
        )
        return result

    except Exception as e:
        await ctx.error(
            "Annotation layer listing failed: error=%s, error_type=%s"
            % (str(e), type(e).__name__)
        )
        raise
