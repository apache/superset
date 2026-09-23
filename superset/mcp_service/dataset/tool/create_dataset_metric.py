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

"""Create a saved metric on a dataset (FastMCP tool)."""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    CreateDatasetMetricRequest,
    CreateDatasetMetricResponse,
)
from superset.mcp_service.dataset.tool.update_dataset_metric import (
    _serialize_metric,
)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create dataset metric",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def create_dataset_metric(
    request: CreateDatasetMetricRequest, ctx: Context
) -> CreateDatasetMetricResponse:
    """Add a saved metric to a dataset identified by ID or UUID.

    Requires metric_name and expression; accepts the same optional properties
    as update_dataset_metric. Existing metrics are preserved. Requires dataset
    editorship (or Admin), just like updating a dataset. Use get_dataset_info
    to inspect existing names before creating a metric.
    """
    updates = request.updates()
    await ctx.info("Creating dataset metric: dataset_id=%s" % (request.dataset_id,))

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
            subqueryload(SqlaTable.metrics),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.create_dataset_metric.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return CreateDatasetMetricResponse(
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
                "Dataset metric create forbidden: dataset_id=%s" % (dataset.id,)
            )
            return CreateDatasetMetricResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to create its metrics.",
            )

        metrics = list(dataset.metrics)
        if any(metric.metric_name == request.metric_name for metric in metrics):
            await ctx.warning("Metric already exists: %s" % (request.metric_name,))
            return CreateDatasetMetricResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=f"Metric '{request.metric_name}' already exists on this dataset. "
                "Choose a unique metric_name or use update_dataset_metric.",
            )

        # The DAO deletes omitted metrics, so preserve every existing row.
        metrics_payload = [
            {"id": metric.id, "metric_name": metric.metric_name} for metric in metrics
        ]
        metrics_payload.append(updates)
        with event_logger.log_context(action="mcp.create_dataset_metric.create"):
            updated_dataset = UpdateDatasetCommand(
                dataset.id, {"metrics": metrics_payload}
            ).run()

        created_metric = next(
            m for m in updated_dataset.metrics if m.metric_name == request.metric_name
        )
        await ctx.info(
            "Dataset metric created: dataset_id=%s, metric_id=%s"
            % (updated_dataset.id, created_metric.id)
        )
        return CreateDatasetMetricResponse(
            dataset_id=updated_dataset.id,
            dataset_name=updated_dataset.table_name,
            metric=_serialize_metric(created_metric),
            url=(
                f"{get_superset_base_url()}/explore/"
                f"?datasource_type=table&datasource_id={updated_dataset.id}"
            ),
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return CreateDatasetMetricResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset metric create forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return CreateDatasetMetricResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to create its metrics.",
        )
    except DatasetSoftDeletedTwinExistsError as exc:
        collision_message: str = str(exc)
        await ctx.warning("Dataset metric validation failed: %s" % (collision_message,))
        return CreateDatasetMetricResponse(error=collision_message)
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset metric validation failed: %s" % (messages,))
        return CreateDatasetMetricResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset metric create failed: %s" % (str(exc),))
        return CreateDatasetMetricResponse(
            error=f"Failed to create metric: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating dataset metric: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
