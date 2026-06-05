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
List CSS templates FastMCP tool
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.models.core import CssTemplate

from superset.extensions import event_logger
from superset.mcp_service.css_template.schemas import (
    CssTemplateError,
    CssTemplateFilter,
    CssTemplateInfo,
    CssTemplateList,
    ListCssTemplatesRequest,
    serialize_css_template_object,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

_DEFAULT_LIST_CSS_TEMPLATES_REQUEST = ListCssTemplatesRequest()


@tool(
    tags=["core"],
    class_permission_name="CssTemplate",
    annotations=ToolAnnotations(
        title="List CSS templates",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_css_templates(
    request: ListCssTemplatesRequest | None = None,
    ctx: Context | None = None,
) -> CssTemplateList | CssTemplateError:
    """List CSS templates with filtering and search.

    Returns CSS template metadata including name. Use select_columns=['css']
    to include the CSS content (omitted by default due to size).

    Sortable columns for order_column: id, template_name, changed_on,
    created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_css_templates")

    request = request or _DEFAULT_LIST_CSS_TEMPLATES_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing CSS templates: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )
    await ctx.debug(
        "CSS template listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )

    try:
        from superset.daos.css import CssTemplateDAO
        from superset.mcp_service.common.schema_discovery import (
            CSS_TEMPLATE_DEFAULT_COLUMNS,
            CSS_TEMPLATE_SORTABLE_COLUMNS,
            get_all_column_names,
            get_css_template_columns,
        )

        all_columns = get_all_column_names(get_css_template_columns())

        def _serialize_css_template(
            obj: "CssTemplate | None", cols: list[str] | None
        ) -> CssTemplateInfo | None:
            return serialize_css_template_object(obj)

        list_tool = ModelListCore(
            dao_class=CssTemplateDAO,
            output_schema=CssTemplateInfo,
            item_serializer=_serialize_css_template,
            filter_type=CssTemplateFilter,
            default_columns=CSS_TEMPLATE_DEFAULT_COLUMNS,
            search_columns=["template_name"],
            list_field_name="css_templates",
            output_list_schema=CssTemplateList,
            all_columns=all_columns,
            sortable_columns=CSS_TEMPLATE_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_css_templates.query"):
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
            "CSS templates listed successfully: count=%s, total_count=%s"
            % (
                len(result.css_templates) if hasattr(result, "css_templates") else 0,
                getattr(result, "total_count", None),
            )
        )

        columns_to_filter = result.columns_requested
        with event_logger.log_context(action="mcp.list_css_templates.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "CSS template listing failed: page=%s, page_size=%s, error=%s, "
            "error_type=%s"
            % (request.page, request.page_size, str(e), type(e).__name__)
        )
        raise
