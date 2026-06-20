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
List tags FastMCP tool

This module contains the FastMCP tool for listing tags with filtering,
search, and pagination support.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.tag.schemas import (
    ListTagsRequest,
    serialize_tag_object,
    TagError,
    TagFilter,
    TagInfo,
    TagList,
)

logger = logging.getLogger(__name__)

DEFAULT_TAG_COLUMNS = ["id", "name", "type"]
SORTABLE_TAG_COLUMNS = ["id", "name", "changed_on", "created_on"]
ALL_TAG_COLUMNS = [
    "id",
    "name",
    "type",
    "description",
    "changed_on",
    "changed_on_humanized",
    "created_on",
    "created_on_humanized",
]

_DEFAULT_LIST_TAGS_REQUEST = ListTagsRequest()


@tool(
    tags=["core"],
    class_permission_name="Tag",
    annotations=ToolAnnotations(
        title="List tags",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_tags(
    request: ListTagsRequest | None = None,
    ctx: Context | None = None,
) -> TagList | TagError:
    """List tags with filtering and search.

    Returns tag metadata including name, type, and description.

    Tag types: custom (user-created), type (implicit by object type),
    owner (implicit by ownership), favorited_by (implicit by favorites).

    Sortable columns for order_column: id, name, changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_tags")

    request = request or _DEFAULT_LIST_TAGS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing tags: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )
    await ctx.debug(
        "Tag listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )

    try:
        from superset.daos.tag import TagDAO

        def _serialize_tag(obj: object, cols: list[str] | None) -> TagInfo | None:
            return serialize_tag_object(obj)

        list_tool = ModelListCore(
            dao_class=TagDAO,
            output_schema=TagInfo,
            item_serializer=_serialize_tag,
            filter_type=TagFilter,
            default_columns=DEFAULT_TAG_COLUMNS,
            search_columns=["name"],
            list_field_name="tags",
            output_list_schema=TagList,
            all_columns=ALL_TAG_COLUMNS,
            sortable_columns=SORTABLE_TAG_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_tags.query"):
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
            "Tags listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.tags) if hasattr(result, "tags") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_tags.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Tag listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (request.page, request.page_size, str(e), type(e).__name__)
        )
        raise
