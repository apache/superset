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
MCP tool: list_charts (advanced filtering with metadata cache control)
"""

import logging
from datetime import datetime, timezone
from typing import cast, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.models.slice import Slice

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    ChartFilter,
    ChartInfo,
    ChartLike,
    ChartList,
    ListChartsRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

# Minimal defaults for reduced token usage - users can request more via select_columns
DEFAULT_CHART_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "description",
    "certified_by",
    "certification_details",
    "url",
    "changed_on",
    "changed_on_humanized",
]

SORTABLE_CHART_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "datasource_name",
    "description",
    "changed_on",
    "created_on",
    "popularity_score",
]

CHART_SEARCH_COLUMNS = [
    "slice_name",
    "description",
]


def _needs_popularity(request: ListChartsRequest) -> bool:
    """Check if popularity_score computation is needed."""
    if request.order_column == "popularity_score":
        return True
    if request.select_columns and "popularity_score" in request.select_columns:
        return True
    return False


def _attach_popularity_scores(
    charts: list[ChartInfo], scores: dict[int, float]
) -> None:
    """Attach popularity scores to serialized chart objects in-place."""
    for chart in charts:
        if chart.id is not None and chart.id in scores:
            chart.popularity_score = scores[chart.id]


@tool(
    tags=["core"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="List charts",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_charts(request: ListChartsRequest, ctx: Context) -> ChartList:
    """List charts with filtering and search.

    Returns chart metadata including id, name, viz_type, URL, and last
    modified time.

    Sortable columns for order_column: id, slice_name, viz_type,
    datasource_name, description, changed_on, created_on, popularity_score
    """
    await ctx.info(
        "Listing charts: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Chart listing filters: filters=%s, order_column=%s, order_direction=%s"
        % (
            len(request.filters),
            request.order_column,
            request.order_direction,
        )
    )

    from superset.daos.chart import ChartDAO
    from superset.mcp_service.common.schema_discovery import (
        CHART_SORTABLE_COLUMNS,
        get_all_column_names,
        get_chart_columns,
    )

    # Get all column names dynamically from the model
    all_columns = get_all_column_names(get_chart_columns())

    def _serialize_chart(
        obj: "Slice | None", cols: list[str] | None
    ) -> ChartInfo | None:
        """Serialize chart object (field filtering handled by model_serializer)."""
        return serialize_chart_object(cast(ChartLike | None, obj))

    try:
        # Two-pass approach when sorting by popularity_score
        if request.order_column == "popularity_score":
            with event_logger.log_context(action="mcp.list_charts.popularity_sort"):
                result = _list_charts_by_popularity(
                    request, ChartDAO, _serialize_chart, all_columns, ctx
                )
        else:
            list_core = ModelListCore(
                dao_class=ChartDAO,
                output_schema=ChartInfo,
                item_serializer=_serialize_chart,
                filter_type=ChartFilter,
                default_columns=DEFAULT_CHART_COLUMNS,
                search_columns=CHART_SEARCH_COLUMNS,
                list_field_name="charts",
                output_list_schema=ChartList,
                all_columns=all_columns,
                sortable_columns=CHART_SORTABLE_COLUMNS,
                logger=logger,
            )

            with event_logger.log_context(action="mcp.list_charts.query"):
                result = list_core.run_tool(
                    filters=request.filters,
                    search=request.search,
                    select_columns=request.select_columns,
                    order_column=request.order_column,
                    order_direction=request.order_direction,
                    page=max(request.page - 1, 0),
                    page_size=request.page_size,
                )

            # Attach popularity scores if requested in select_columns
            if request.select_columns and "popularity_score" in request.select_columns:
                from superset.mcp_service.common.popularity import (
                    compute_chart_popularity,
                )

                chart_ids = [c.id for c in result.charts if c.id is not None]
                if chart_ids:
                    scores = compute_chart_popularity(chart_ids)
                    _attach_popularity_scores(result.charts, scores)

        count = len(result.charts) if hasattr(result, "charts") else 0
        total_pages = getattr(result, "total_pages", None)
        await ctx.info(
            "Charts listed successfully: count=%s, total_pages=%s"
            % (count, total_pages)
        )

        # Apply field filtering via serialization context
        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_charts.serialization"):
            return result.model_dump(
                mode="json", context={"select_columns": columns_to_filter}
            )
    except Exception as e:
        await ctx.error("Failed to list charts: %s" % (str(e),))
        raise


def _list_charts_by_popularity(
    request: ListChartsRequest,
    dao_class: type,
    serializer: callable,
    all_columns: list[str],
    ctx: Context,
) -> ChartList:
    """Two-pass listing: sort all matching charts by popularity score."""
    from superset.mcp_service.common.popularity import (
        compute_chart_popularity,
        get_popularity_sorted_ids,
    )
    from superset.mcp_service.common.schema_discovery import CHART_SORTABLE_COLUMNS
    from superset.mcp_service.system.schemas import PaginationInfo

    sorted_ids, scores, total_count = get_popularity_sorted_ids(
        compute_fn=compute_chart_popularity,
        dao_class=dao_class,
        filters=request.filters,
        search=request.search,
        search_columns=CHART_SEARCH_COLUMNS,
        order_direction=request.order_direction,
    )

    # Apply pagination to sorted IDs
    page = max(request.page - 1, 0)
    page_size = request.page_size
    start = page * page_size
    end = start + page_size
    page_ids = sorted_ids[start:end]

    # Fetch full models for page IDs
    if page_ids:
        items = dao_class.find_by_ids(page_ids)
        # Preserve popularity sort order
        id_to_item = {item.id: item for item in items}
        ordered_items = [id_to_item[pid] for pid in page_ids if pid in id_to_item]
    else:
        ordered_items = []

    # Serialize
    select_columns = request.select_columns or DEFAULT_CHART_COLUMNS
    # Ensure popularity_score is in the select_columns
    if "popularity_score" not in select_columns:
        select_columns = list(select_columns) + ["popularity_score"]

    chart_objs = []
    for item in ordered_items:
        obj = serializer(item, select_columns)
        if obj is not None:
            chart_objs.append(obj)

    # Attach scores
    _attach_popularity_scores(chart_objs, scores)

    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0,
    )

    return ChartList(
        charts=chart_objs,
        count=len(chart_objs),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=select_columns,
        columns_loaded=select_columns,
        columns_available=all_columns,
        sortable_columns=CHART_SORTABLE_COLUMNS,
        filters_applied=request.filters if isinstance(request.filters, list) else [],
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc),
    )
