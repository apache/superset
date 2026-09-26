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

"""Delete a saved metric on a dataset (FastMCP tool)."""

from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DeleteDatasetMetricRequest,
    DeleteDatasetMetricResponse,
    MetricChartReference,
)
from superset.mcp_service.dataset.tool.update_dataset_metric import (
    _find_metric,
    _metric_not_found_message,
    _serialize_metric,
)


def _references_metric(value: Any, metric_name: str) -> bool:
    """Inspect metric controls, HAVING filters, and query-context metric names.

    Only named metric references count, not SQL expressions, adhoc labels,
    column names, or arbitrary strings elsewhere in the chart configuration.
    """
    if isinstance(value, list):
        return any(_references_metric(item, metric_name) for item in value)
    if not isinstance(value, dict):
        return False
    if value.get("saved_metric") is True and value.get("name") == metric_name:
        return True
    if value.get("clause") == "HAVING" and value.get("subject") == metric_name:
        return True
    for key, item in value.items():
        if {"metric", "metrics"}.intersection(key.split("_")):
            candidates = item if isinstance(item, list) else [item]
            if any(candidate == metric_name for candidate in candidates):
                return True
        if (
            key == "orderby"
            and isinstance(item, list)
            and any(
                isinstance(order, list) and order and order[0] == metric_name
                for order in item
            )
        ):
            return True
        if _references_metric(item, metric_name):
            return True
    return False


def _find_affected_charts(
    dataset_id: int, metric_name: str
) -> list[MetricChartReference]:
    """Return only accessible charts on this dataset referencing the metric."""
    from superset import db
    from superset.exceptions import SupersetSecurityException
    from superset.models.slice import Slice
    from superset.utils import json
    from superset.utils.core import DatasourceType

    charts = (
        db.session.query(Slice)
        .filter(
            Slice.datasource_id == dataset_id,
            Slice.datasource_type == DatasourceType.TABLE,
        )
        .order_by(Slice.id)
        .all()
    )
    references = []
    for chart in charts:
        try:
            security_manager.raise_for_access(chart=chart)
        except SupersetSecurityException:
            continue
        configs = [chart.form_data]
        if chart.query_context:
            configs.append(json.loads(chart.query_context))
        if _references_metric(configs, metric_name):
            references.append(
                MetricChartReference(
                    id=chart.id,
                    uuid=str(chart.uuid) if chart.uuid else None,
                    slice_name=chart.slice_name,
                )
            )
    return references


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Delete dataset metric",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def delete_dataset_metric(
    request: DeleteDatasetMetricRequest, ctx: Context
) -> DeleteDatasetMetricResponse:
    """Delete a saved metric by ID, UUID, or metric_name.

    Requires dataset editorship (or Admin). Other metrics are preserved.
    Returns accessible charts that reference the deleted metric by name so
    callers can warn users and repair those charts. Chart definitions are not
    modified. Inspect the dataset with get_dataset_info before deleting.
    """
    await ctx.info("Deleting dataset metric: dataset_id=%s" % (request.dataset_id,))

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

        eager_options = [
            subqueryload(SqlaTable.metrics),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.delete_dataset_metric.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return DeleteDatasetMetricResponse(
                error=(
                    f"No dataset found with identifier: {request.dataset_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        # Check editorship before inspecting metric names. The command repeats
        # this check and enforces all dataset update validation on persistence.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning(
                "Dataset metric delete forbidden: dataset_id=%s" % (dataset.id,)
            )
            return DeleteDatasetMetricResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to delete its metrics.",
            )

        metrics = list(dataset.metrics)
        target = _find_metric(metrics, request.metric)
        if target is None:
            message = _metric_not_found_message(metrics, request.metric)
            await ctx.warning("Metric not found: %s" % (request.metric,))
            return DeleteDatasetMetricResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=message,
            )

        deleted_metric = _serialize_metric(target)
        with event_logger.log_context(action="mcp.delete_dataset_metric.references"):
            affected_charts = _find_affected_charts(dataset.id, target.metric_name)
        # Omit only the target; the command/DAO deletes omitted metrics.
        metrics_payload = [
            {"id": metric.id, "metric_name": metric.metric_name}
            for metric in metrics
            if metric.id != target.id
        ]
        with event_logger.log_context(action="mcp.delete_dataset_metric.delete"):
            updated_dataset = UpdateDatasetCommand(
                dataset.id, {"metrics": metrics_payload}
            ).run()

        await ctx.info(
            "Dataset metric deleted: dataset_id=%s, metric_id=%s"
            % (updated_dataset.id, deleted_metric.id)
        )
        return DeleteDatasetMetricResponse(
            dataset_id=updated_dataset.id,
            dataset_name=updated_dataset.table_name,
            metric=deleted_metric,
            affected_charts=affected_charts,
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return DeleteDatasetMetricResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset metric delete forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return DeleteDatasetMetricResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to delete its metrics.",
        )
    except DatasetSoftDeletedTwinExistsError as exc:
        collision_message: str = str(exc)
        await ctx.warning("Dataset metric validation failed: %s" % (collision_message,))
        return DeleteDatasetMetricResponse(error=collision_message)
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset metric validation failed: %s" % (messages,))
        return DeleteDatasetMetricResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset metric delete failed: %s" % (str(exc),))
        return DeleteDatasetMetricResponse(
            error=f"Failed to delete metric: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error deleting dataset metric: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
