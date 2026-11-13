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

"""Delete a calculated column on a dataset (FastMCP tool)."""

from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DeleteDatasetColumnRequest,
    DeleteDatasetColumnResponse,
)
from superset.mcp_service.dataset.tool.delete_dataset_metric import (
    _find_affected_charts,
)
from superset.mcp_service.dataset.tool.update_dataset_column import (
    _column_not_found_message,
    _find_column,
    _is_calculated,
    _serialize_column,
)
from superset.utils import json

# Chart config keys whose value is a column name or a list of column names.
_COLUMN_KEYS = frozenset(
    {
        "all_columns",
        "all_columns_x",
        "all_columns_y",
        "columns",
        "entity",
        "granularity_sqla",
        "groupby",
        "groupbyColumns",
        "groupbyRows",
        "order_by_cols",
        "series",
        "series_columns",
        "x",
        "x_axis",
        "y",
        "column",
        "groupby_b",
        "start_time",
        "end_time",
        "y_axis",
        "tooltip_columns",
        "source",
        "target",
        "dimension",
        "granularity_sqla_b",
        "latCol",
        "lonCol",
        "lonlatCol",
        "geohashCol",
    }
)


def _order_by_column(candidate: Any) -> Any:
    """Return the column of an ``order_by_cols`` entry.

    Entries are JSON strings such as ``'["col", true]'`` (column, ascending).
    """
    if isinstance(candidate, str):
        try:
            candidate = json.loads(candidate)
        except (ValueError, RecursionError):
            return candidate
    if isinstance(candidate, list) and candidate:
        return candidate[0]
    return candidate


def _key_matches(key: str, item: Any, column_name: str) -> bool:
    """Whether a column-valued chart config key names ``column_name``."""
    candidates = item if isinstance(item, list) else [item]
    if key == "order_by_cols":
        candidates = [_order_by_column(c) for c in candidates]
    return any(candidate == column_name for candidate in candidates)


def _references_column(value: Any, column_name: str) -> bool:
    """Inspect dimension controls, simple filters, and simple adhoc metrics.

    Only references by column name count, not SQL expressions (custom SQL
    filters, adhoc columns or metrics written as SQL) or arbitrary strings
    elsewhere in the chart configuration.
    """
    if isinstance(value, list):
        return any(_references_column(item, column_name) for item in value)
    if not isinstance(value, dict):
        return False
    # Simple adhoc filters (form data) and query-context filters.
    if value.get("expressionType") == "SIMPLE" and value.get("subject") == column_name:
        return True
    if value.get("col") == column_name:
        return True
    # Simple adhoc metrics reference their column as {"column_name": ...}.
    if value.get("column_name") == column_name:
        return True
    for key, item in value.items():
        if key in _COLUMN_KEYS:
            if _key_matches(key, item, column_name):
                return True
        if _references_column(item, column_name):
            return True
    return False


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Delete dataset calculated column",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def delete_dataset_column(  # noqa: C901
    request: DeleteDatasetColumnRequest, ctx: Context
) -> DeleteDatasetColumnResponse:
    """Delete a calculated column by ID, UUID, or column_name.

    Only calculated columns can be deleted; physical columns mirror the source
    table and are managed by syncing the dataset. Requires dataset editorship
    (or Admin). Other columns are preserved. Returns accessible charts that
    reference the deleted column by name so callers can warn users and repair
    those charts. Chart definitions are not modified. Inspect the dataset with
    get_dataset_info before deleting.
    """
    await ctx.info("Deleting dataset column: dataset_id=%s" % (request.dataset_id,))

    try:
        from sqlalchemy.orm import joinedload, subqueryload

        from superset.commands.dataset.columns.delete import (
            DeleteDatasetColumnCommand,
        )
        from superset.commands.dataset.columns.exceptions import (
            DatasetColumnDeleteFailedError,
            DatasetColumnForbiddenError,
            DatasetColumnNotFoundError,
        )
        from superset.connectors.sqla.models import SqlaTable
        from superset.exceptions import SupersetSecurityException
        from superset.mcp_service.dataset.dataset_utils import resolve_dataset

        eager_options = [
            subqueryload(SqlaTable.columns),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.delete_dataset_column.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return DeleteDatasetColumnResponse(
                error=(
                    f"No dataset found with identifier: {request.dataset_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        # Check editorship before inspecting column names. The command repeats
        # this check on the column before deleting it.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning(
                "Dataset column delete forbidden: dataset_id=%s" % (dataset.id,)
            )
            return DeleteDatasetColumnResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to delete its columns.",
            )

        columns = list(dataset.columns)
        target = _find_column(columns, request.column)
        if target is None:
            message = _column_not_found_message(columns, request.column)
            await ctx.warning("Column not found: %s" % (request.column,))
            return DeleteDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=message,
            )

        if not _is_calculated(target):
            await ctx.warning(
                "Physical column delete rejected: %s" % (target.column_name,)
            )
            return DeleteDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=f"'{target.column_name}' is a physical column from the "
                "source table and cannot be deleted with this tool; only "
                "calculated columns can.",
            )

        deleted_column = _serialize_column(target)
        with event_logger.log_context(action="mcp.delete_dataset_column.references"):
            affected_charts = _find_affected_charts(
                dataset.id, target.column_name, is_reference=_references_column
            )
        with event_logger.log_context(action="mcp.delete_dataset_column.delete"):
            DeleteDatasetColumnCommand(dataset.id, target.id).run()

        await ctx.info(
            "Dataset column deleted: dataset_id=%s, column_id=%s"
            % (dataset.id, deleted_column.id)
        )
        return DeleteDatasetColumnResponse(
            dataset_id=dataset.id,
            dataset_name=dataset.table_name,
            column=deleted_column,
            affected_charts=affected_charts,
        )

    except DatasetColumnNotFoundError:
        await ctx.warning("Column not found: %s" % (request.column,))
        return DeleteDatasetColumnResponse(
            error=f"Column '{request.column}' not found on this dataset.",
        )
    except DatasetColumnForbiddenError:
        await ctx.warning(
            "Dataset column delete forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return DeleteDatasetColumnResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to delete its columns.",
        )
    except DatasetColumnDeleteFailedError as exc:
        await ctx.error("Dataset column delete failed: %s" % (str(exc),))
        return DeleteDatasetColumnResponse(
            error=f"Failed to delete column: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error deleting dataset column: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
