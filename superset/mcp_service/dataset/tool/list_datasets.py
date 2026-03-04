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
List datasets FastMCP tool (Advanced with metadata cache control)

This module contains the FastMCP tool for listing datasets using
advanced filtering with clear, unambiguous request schema and metadata cache control.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DatasetFilter,
    DatasetInfo,
    DatasetList,
    ListDatasetsRequest,
    serialize_dataset_object,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

# Minimal defaults for reduced token usage - users can request more via select_columns
# NOTE: "database" (relationship) is included so the DAO eagerly loads it
# via joinedload, which avoids N+1 lazy-load queries when the serializer
# accesses dataset.database.name (via the database_name @property).
DEFAULT_DATASET_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "database_name",
    "database",
    "description",
    "certified_by",
    "certification_details",
    "changed_on",
    "changed_on_humanized",
]

SORTABLE_DATASET_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "changed_on",
    "created_on",
    "popularity_score",
]

DATASET_SEARCH_COLUMNS = ["schema", "sql", "table_name", "uuid"]


def _attach_popularity_scores(datasets: list[Any], scores: dict[int, float]) -> None:
    """Attach popularity scores to serialized dataset objects in-place."""
    for ds in datasets:
        if ds.id is not None and ds.id in scores:
            ds.popularity_score = scores[ds.id]


@tool(
    tags=["core"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="List datasets",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_datasets(request: ListDatasetsRequest, ctx: Context) -> DatasetList:
    """List datasets with filtering and search.

    Returns dataset metadata including table name, schema, and last modified
    time.

    Sortable columns for order_column: id, table_name, schema, changed_on,
    created_on, popularity_score
    """
    await ctx.info(
        "Listing datasets: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Dataset listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (
            request.use_cache,
            request.refresh_metadata,
            request.force_refresh,
        )
    )

    try:
        from superset.daos.dataset import DatasetDAO
        from superset.mcp_service.common.schema_discovery import (
            DATASET_SORTABLE_COLUMNS,
            get_all_column_names,
            get_dataset_columns,
        )

        # Get all column names dynamically from the model
        all_columns = get_all_column_names(get_dataset_columns())

        def _serialize_dataset(
            obj: "SqlaTable | None", cols: list[str] | None
        ) -> DatasetInfo | None:
            """Serialize dataset (filtering via model_serializer)."""
            return serialize_dataset_object(obj)

        # Two-pass approach when sorting by popularity_score
        if request.order_column == "popularity_score":
            with event_logger.log_context(action="mcp.list_datasets.popularity_sort"):
                result = _list_datasets_by_popularity(
                    request, DatasetDAO, _serialize_dataset, all_columns, ctx
                )
        else:
            # Create tool with standard serialization
            list_core = ModelListCore(
                dao_class=DatasetDAO,
                output_schema=DatasetInfo,
                item_serializer=_serialize_dataset,
                filter_type=DatasetFilter,
                default_columns=DEFAULT_DATASET_COLUMNS,
                search_columns=DATASET_SEARCH_COLUMNS,
                list_field_name="datasets",
                output_list_schema=DatasetList,
                all_columns=all_columns,
                sortable_columns=DATASET_SORTABLE_COLUMNS,
                logger=logger,
            )

            with event_logger.log_context(action="mcp.list_datasets.query"):
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
                    compute_dataset_popularity,
                )

                ds_ids = [d.id for d in result.datasets if d.id is not None]
                if ds_ids:
                    scores = compute_dataset_popularity(ds_ids)
                    _attach_popularity_scores(result.datasets, scores)

        await ctx.info(
            "Datasets listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.datasets) if hasattr(result, "datasets") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        # Apply field filtering via serialization context
        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_datasets.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Dataset listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        raise


def _list_datasets_by_popularity(
    request: ListDatasetsRequest,
    dao_class: Any,
    serializer: Callable[..., dict[str, Any] | None],
    all_columns: list[str],
    ctx: Context,
) -> DatasetList:
    """Two-pass listing: sort all matching datasets by popularity score."""
    from superset.mcp_service.common.popularity import (
        compute_dataset_popularity,
        get_popularity_sorted_ids,
    )
    from superset.mcp_service.common.schema_discovery import DATASET_SORTABLE_COLUMNS
    from superset.mcp_service.system.schemas import PaginationInfo

    sorted_ids, scores, total_count = get_popularity_sorted_ids(
        compute_fn=compute_dataset_popularity,
        dao_class=dao_class,
        filters=request.filters,
        search=request.search,
        search_columns=DATASET_SEARCH_COLUMNS,
        order_direction=request.order_direction,
    )

    # Apply pagination to sorted IDs
    page = max(request.page - 1, 0)
    page_size = request.page_size
    start = page * page_size
    end = start + page_size

    # Fetch full models for page IDs
    if page_ids := sorted_ids[start:end]:
        items = dao_class.find_by_ids(page_ids)
        id_to_item = {item.id: item for item in items}
        ordered_items = [id_to_item[pid] for pid in page_ids if pid in id_to_item]
    else:
        ordered_items = []

    # Serialize
    select_columns = request.select_columns or DEFAULT_DATASET_COLUMNS
    if "popularity_score" not in select_columns:
        select_columns = list(select_columns) + ["popularity_score"]

    ds_objs = []
    for item in ordered_items:
        obj = serializer(item, select_columns)
        if obj is not None:
            ds_objs.append(obj)

    _attach_popularity_scores(ds_objs, scores)

    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0,
    )

    return DatasetList(
        datasets=ds_objs,
        count=len(ds_objs),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=select_columns,
        columns_loaded=select_columns,
        columns_available=all_columns,
        sortable_columns=DATASET_SORTABLE_COLUMNS,
        filters_applied=request.filters if isinstance(request.filters, list) else [],
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc),
    )
