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

"""Update a column on a dataset (FastMCP tool)."""

import difflib
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    _calculated_expression,
    DatasetColumnDetail,
    PHYSICAL_COLUMN_LOCKED_FIELDS,
    UpdateDatasetColumnRequest,
    UpdateDatasetColumnResponse,
)


def _is_calculated(column: Any) -> bool:
    """A user-defined calculated column, not an expanded nested source field."""
    from superset.connectors.sqla.models import _is_calculated_column

    return _calculated_expression(column) is not None and _is_calculated_column(column)


def _find_column(columns: list[Any], identifier: int | str) -> Any | None:
    """Find a dataset column by ID, UUID, or column_name."""
    if isinstance(identifier, str):
        try:
            identifier = int(identifier)
        except ValueError:
            pass

    if isinstance(identifier, int):
        return next((c for c in columns if c.id == identifier), None)

    lowered = identifier.lower()
    by_uuid = next(
        (c for c in columns if c.uuid and str(c.uuid).lower() == lowered), None
    )
    if by_uuid is not None:
        return by_uuid
    return next((c for c in columns if c.column_name == identifier), None)


def _column_not_found_message(columns: list[Any], identifier: int | str) -> str:
    """Build a "column not found" error while preserving supplied text."""
    names = [c.column_name for c in columns]
    msg = f"Column '{identifier}' not found on this dataset."
    if not names:
        return f"{msg} This dataset has no columns."
    suggestions = difflib.get_close_matches(str(identifier), names, n=3, cutoff=0.6)
    if suggestions:
        return f"{msg} Did you mean: {', '.join(suggestions)}?"
    return f"{msg} Available columns: {', '.join(sorted(names))}."


def _serialize_column(column: Any) -> DatasetColumnDetail:
    """Build a ``DatasetColumnDetail`` from a ``TableColumn`` model."""
    return DatasetColumnDetail(
        id=getattr(column, "id", None),
        uuid=str(column.uuid) if getattr(column, "uuid", None) else None,
        column_name=column.column_name or "",
        verbose_name=getattr(column, "verbose_name", None),
        type=getattr(column, "type", None),
        is_dttm=getattr(column, "is_dttm", None),
        groupby=getattr(column, "groupby", None),
        filterable=getattr(column, "filterable", None),
        description=getattr(column, "description", None),
        expression=_calculated_expression(column),
        python_date_format=getattr(column, "python_date_format", None),
        is_calculated=_is_calculated(column),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update dataset column",
        readOnlyHint=False,
        # Overwrites an existing column's definition and affects every chart
        # that uses it, like update_dataset_metric.
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def update_dataset_column(  # noqa: C901
    request: UpdateDatasetColumnRequest, ctx: Context
) -> UpdateDatasetColumnResponse:
    """Update a column on a dataset.

    Edits a calculated column (a named SQL expression stored on the dataset,
    e.g. CASE WHEN amount > 100 THEN 'large' ELSE 'small' END) or the
    display/behaviour settings of any column: verbose_name, description, type,
    is_dttm, groupby, filterable, python_date_format. Changes apply to every
    chart that uses the column.

    Only calculated columns can change column_name or expression; physical
    columns mirror the source table, so renaming them or giving them an
    expression would break them. Only the properties you pass are changed;
    everything else on the column, and all other columns, is left untouched.
    Use create_dataset_column / delete_dataset_column to add or remove
    calculated columns. Requires ownership of the dataset (or Admin).

    Workflow:
    1. Call get_dataset_info with column_fields including 'expression' to
       inspect the dataset's columns
    2. Call this tool with the dataset ID, the column identifier, and only
       the properties to change

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "column": "order_size",
        "expression": "CASE WHEN amount > 500 THEN 'large' ELSE 'small' END",
        "verbose_name": "Order size"
    }
    ```
    """
    updates = request.updates()
    await ctx.info(
        "Updating dataset column: dataset_id=%s, column=%r, properties=%s"
        % (request.dataset_id, request.column, sorted(updates))
    )

    try:
        from sqlalchemy.orm import joinedload, subqueryload

        from superset.commands.dataset.exceptions import (
            DatasetForbiddenError,
            DatasetInvalidError,
            DatasetNotFoundError,
            DatasetSoftDeletedTwinExistsError,
            DatasetUpdateFailedError,
        )
        from superset.commands.dataset.update import UpdateDatasetCommand
        from superset.connectors.sqla.models import SqlaTable
        from superset.exceptions import SupersetSecurityException
        from superset.mcp_service.dataset.dataset_utils import resolve_dataset
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        eager_options = [
            subqueryload(SqlaTable.columns),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.update_dataset_column.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return UpdateDatasetColumnResponse(
                error=(
                    f"No dataset found with identifier: {request.dataset_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        # Enforce editorship before touching the column list, so a caller who
        # cannot edit the dataset cannot probe column names through the
        # not-found suggestions.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning(
                "Dataset column update forbidden: dataset_id=%s" % (dataset.id,)
            )
            return UpdateDatasetColumnResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to update its columns.",
            )

        columns = list(dataset.columns)
        target = _find_column(columns, request.column)
        if target is None:
            message = _column_not_found_message(columns, request.column)
            await ctx.warning("Column not found: %s" % (request.column,))
            return UpdateDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=message,
            )

        if not _is_calculated(target) and (
            locked := PHYSICAL_COLUMN_LOCKED_FIELDS & set(updates)
        ):
            await ctx.warning(
                "Physical column property change rejected: %s" % (sorted(locked),)
            )
            return UpdateDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=f"'{target.column_name}' is a physical column from the "
                f"source table, so {' and '.join(sorted(locked))} cannot be "
                "changed. Use create_dataset_column to add a calculated column "
                "instead.",
            )

        new_name = updates.get("column_name")
        if new_name is not None and any(
            c.column_name == new_name and c.id != target.id for c in columns
        ):
            await ctx.warning("Column name already exists: %s" % (new_name,))
            return UpdateDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=f"Column '{new_name}' already exists on this dataset. "
                "Choose a unique column_name.",
            )

        # Send only the target column: preserve_existing_columns keeps every
        # other column as stored when the command runs, including changes made
        # by other writers since the lookup above. The command enforces dataset
        # ownership and validates name uniqueness, the SQL expression, and the
        # date format.
        with event_logger.log_context(action="mcp.update_dataset_column.update"):
            updated_dataset = UpdateDatasetCommand(
                dataset.id,
                {"columns": [{"id": target.id, **updates}]},
                preserve_existing_columns=True,
            ).run()

        updated_column = next(
            (c for c in updated_dataset.columns if c.id == target.id), None
        )

        await ctx.info(
            "Dataset column updated: dataset_id=%s, column_id=%s, properties=%s"
            % (updated_dataset.id, target.id, sorted(updates))
        )

        return UpdateDatasetColumnResponse(
            dataset_id=updated_dataset.id,
            dataset_name=updated_dataset.table_name,
            column=_serialize_column(updated_column) if updated_column else None,
            updated_properties=sorted(updates),
            url=(
                f"{get_superset_base_url()}/explore/"
                f"?datasource_type=table&datasource_id={updated_dataset.id}"
            ),
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return UpdateDatasetColumnResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset column update forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return UpdateDatasetColumnResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to update its columns.",
        )
    except DatasetSoftDeletedTwinExistsError as exc:
        collision_message: str = str(exc)
        await ctx.warning("Dataset column validation failed: %s" % (collision_message,))
        return UpdateDatasetColumnResponse(error=collision_message)
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset column validation failed: %s" % (messages,))
        return UpdateDatasetColumnResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset column update failed: %s" % (str(exc),))
        return UpdateDatasetColumnResponse(
            error=f"Failed to update column: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating dataset column: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
