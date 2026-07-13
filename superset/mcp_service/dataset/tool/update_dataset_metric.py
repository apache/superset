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

"""Update a saved metric on a dataset (FastMCP tool)."""

import difflib
import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DatasetMetricDetail,
    MetricCurrency,
    UpdateDatasetMetricRequest,
    UpdateDatasetMetricResponse,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)

logger = logging.getLogger(__name__)


def _find_metric(metrics: list[Any], identifier: int | str) -> Any | None:
    """Find a saved metric by ID, UUID, or metric_name."""
    if isinstance(identifier, str):
        try:
            identifier = int(identifier)
        except ValueError:
            pass

    if isinstance(identifier, int):
        return next((m for m in metrics if m.id == identifier), None)

    lowered = identifier.lower()
    by_uuid = next(
        (m for m in metrics if m.uuid and str(m.uuid).lower() == lowered), None
    )
    if by_uuid is not None:
        return by_uuid
    return next((m for m in metrics if m.metric_name == identifier), None)


def _metric_not_found_message(metrics: list[Any], identifier: int | str) -> str:
    """Build a "metric not found" error, escaping caller- and stored-supplied
    text so it can't break out of the LLM context delimiters (same treatment as
    the success path in ``_serialize_metric``)."""
    names = [m.metric_name for m in metrics]
    safe_identifier = escape_llm_context_delimiters(str(identifier))
    msg = f"Metric '{safe_identifier}' not found on this dataset."
    if not names:
        return f"{msg} This dataset has no saved metrics."
    suggestions = difflib.get_close_matches(str(identifier), names, n=3, cutoff=0.6)
    if suggestions:
        safe_suggestions = [escape_llm_context_delimiters(n) for n in suggestions]
        return f"{msg} Did you mean: {', '.join(safe_suggestions)}?"
    safe_names = [escape_llm_context_delimiters(n) for n in sorted(names)]
    return f"{msg} Available metrics: {', '.join(safe_names)}."


def _serialize_metric(metric: Any) -> DatasetMetricDetail:
    """Build a ``DatasetMetricDetail`` from a ``SqlMetric`` model.

    Returns the metric's identifiers (id, uuid) and all updatable properties,
    wrapping free-text fields in LLM-context sanitization the same way the
    dataset read path does.
    """
    currency = getattr(metric, "currency", None)
    return DatasetMetricDetail(
        id=getattr(metric, "id", None),
        uuid=str(metric.uuid) if getattr(metric, "uuid", None) else None,
        metric_name=escape_llm_context_delimiters(metric.metric_name) or "",
        verbose_name=sanitize_for_llm_context(
            getattr(metric, "verbose_name", None),
            field_path=("metric", "verbose_name"),
        ),
        expression=sanitize_for_llm_context(
            getattr(metric, "expression", None),
            field_path=("metric", "expression"),
        ),
        description=sanitize_for_llm_context(
            getattr(metric, "description", None),
            field_path=("metric", "description"),
        ),
        d3format=getattr(metric, "d3format", None),
        metric_type=getattr(metric, "metric_type", None),
        currency=MetricCurrency.model_validate(currency)
        if isinstance(currency, dict)
        else None,
        warning_text=sanitize_for_llm_context(
            getattr(metric, "warning_text", None),
            field_path=("metric", "warning_text"),
        ),
        extra=sanitize_for_llm_context(
            getattr(metric, "extra", None),
            field_path=("metric", "extra"),
        ),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update dataset metric",
        readOnlyHint=False,
        # Overwrites an existing metric's definition and affects every chart
        # that uses it — non-additive, like update_chart.
        destructiveHint=True,
    ),
)
async def update_dataset_metric(  # noqa: C901
    request: UpdateDatasetMetricRequest, ctx: Context
) -> UpdateDatasetMetricResponse:
    """Update a saved metric on a dataset.

    Modifies properties of an existing saved metric (the named, reusable
    aggregations stored on a dataset, e.g. SUM(revenue)) — such as its SQL
    expression, name, display label, or number format. Changes apply to
    every chart that uses the metric.

    Only the properties you pass are changed; everything else on the metric,
    and all other metrics on the dataset, is left untouched. This tool cannot
    create or delete metrics. Requires ownership of the dataset (or Admin).

    Workflow:
    1. Call get_dataset_info to inspect the dataset's saved metrics
    2. Call this tool with the dataset ID, the metric identifier, and only
       the properties to change

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "metric": "sum_revenue",
        "expression": "SUM(net_revenue)",
        "d3format": "$,.2f"
    }
    ```
    """
    updates = request.updates()
    await ctx.info(
        "Updating dataset metric: dataset_id=%s, metric=%r, properties=%s"
        % (request.dataset_id, request.metric, sorted(updates))
    )

    try:
        from sqlalchemy.orm import joinedload, subqueryload

        from superset.commands.dataset.exceptions import (
            DatasetForbiddenError,
            DatasetInvalidError,
            DatasetNotFoundError,
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

        with event_logger.log_context(action="mcp.update_dataset_metric.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return UpdateDatasetMetricResponse(
                error=(
                    f"No dataset found with identifier: {request.dataset_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        # Enforce editorship before touching the metric list. Otherwise a caller
        # with read access but not edit rights could distinguish "metric exists"
        # from "metric not found" and enumerate metric names via the not-found
        # suggestions. UpdateDatasetCommand re-checks this, but only after the
        # lookup below would have already leaked that information.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning(
                "Dataset metric update forbidden: dataset_id=%s" % (dataset.id,)
            )
            return UpdateDatasetMetricResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to update its metrics.",
            )

        metrics = list(dataset.metrics)
        target = _find_metric(metrics, request.metric)
        if target is None:
            message = _metric_not_found_message(metrics, request.metric)
            await ctx.warning("Metric not found: %s" % (request.metric,))
            return UpdateDatasetMetricResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=message,
            )

        # DatasetDAO.update_metrics deletes any metric missing from the list,
        # so every metric is sent back: untouched ones as bare
        # {id, metric_name} stubs (the bulk update merges them over the stored
        # row), and the target with the requested changes applied on top.
        metrics_payload: list[dict[str, Any]] = []
        for metric in metrics:
            entry: dict[str, Any] = {
                "id": metric.id,
                "metric_name": metric.metric_name,
            }
            if metric.id == target.id:
                entry.update(updates)
            metrics_payload.append(entry)

        # UpdateDatasetCommand enforces dataset ownership and validates
        # metric name uniqueness and the SQL expression
        with event_logger.log_context(action="mcp.update_dataset_metric.update"):
            updated_dataset = UpdateDatasetCommand(
                dataset.id, {"metrics": metrics_payload}
            ).run()

        updated_metric = next(
            (m for m in updated_dataset.metrics if m.id == target.id), None
        )

        await ctx.info(
            "Dataset metric updated: dataset_id=%s, metric_id=%s, properties=%s"
            % (updated_dataset.id, target.id, sorted(updates))
        )

        return UpdateDatasetMetricResponse(
            dataset_id=updated_dataset.id,
            dataset_name=updated_dataset.table_name,
            metric=_serialize_metric(updated_metric) if updated_metric else None,
            updated_properties=sorted(updates),
            url=(
                f"{get_superset_base_url()}/explore/"
                f"?datasource_type=table&datasource_id={updated_dataset.id}"
            ),
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return UpdateDatasetMetricResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset metric update forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return UpdateDatasetMetricResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to update its metrics.",
        )
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset metric validation failed: %s" % (messages,))
        return UpdateDatasetMetricResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset metric update failed: %s" % (str(exc),))
        return UpdateDatasetMetricResponse(
            error=f"Failed to update metric: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating dataset metric: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
