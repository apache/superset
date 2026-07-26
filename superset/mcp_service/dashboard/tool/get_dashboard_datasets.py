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
Get dashboard datasets FastMCP tool

Returns the datasets used by a dashboard's charts, including columns and
metrics. This is the prerequisite context an agent needs before configuring
native filters on a dashboard (e.g. picking filter target columns).
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from sqlalchemy.orm import subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    dashboard_datasets_serializer,
    DashboardDatasets,
    DashboardError,
    GetDashboardDatasetsRequest,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["core"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard datasets",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@requires_data_model_metadata_access
async def get_dashboard_datasets(
    request: GetDashboardDatasetsRequest, ctx: Context
) -> DashboardDatasets | DashboardError:
    """
    List the datasets used by a dashboard's charts, by ID, UUID, or slug.

    Each dataset includes its table name, schema, database connection
    (id, name, backend), columns (name, type, is_dttm, verbose_name) and
    metrics (name, expression, verbose_name). Use this to understand which
    columns and metrics are available before configuring native filters or
    analyzing a dashboard's data model.

    Datasets the current user cannot access are excluded from the response
    and reported via inaccessible_dataset_count. Column and metric lists are
    capped per dataset; when truncated, columns_truncated/metrics_truncated
    are set and total counts are reported.

    Requires data-model metadata permission (same as the dataset tools); a
    dashboard-only viewer without that permission receives a structured
    privacy denial.

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```
    """
    await ctx.info(
        "Retrieving dashboard datasets: identifier=%s" % (request.identifier,)
    )

    # The decorator hides this tool from search; this check enforces direct
    # calls so dashboard-only viewers can't read dataset/database metadata.
    if not user_can_view_data_model_metadata():
        await ctx.warning("Dashboard datasets lookup blocked by privacy controls")
        return DashboardError.create(
            error="You don't have permission to access dataset details for your role.",
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
        )

    try:
        from superset.connectors.sqla.models import SqlaTable
        from superset.daos.dashboard import DashboardDAO
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        # Eager load slices and each slice's dataset columns/metrics/database to
        # avoid N+1 queries: the serializer groups slices by datasource and reads
        # columns, metrics, and database off every dataset.
        slice_dataset = subqueryload(Dashboard.slices).subqueryload(Slice.table)
        eager_options = [
            slice_dataset.subqueryload(SqlaTable.columns),
            slice_dataset.subqueryload(SqlaTable.metrics),
            slice_dataset.joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.get_dashboard_datasets.lookup"):
            core = ModelGetInfoCore(
                dao_class=DashboardDAO,
                output_schema=DashboardDatasets,
                error_schema=DashboardError,
                serializer=dashboard_datasets_serializer,
                supports_slug=True,
                logger=logger,
                query_options=eager_options,
            )
            result = core.run_tool(request.identifier)

        if isinstance(result, DashboardDatasets):
            await ctx.info(
                "Dashboard datasets retrieved: id=%s, dataset_count=%s, "
                "inaccessible_dataset_count=%s"
                % (
                    result.id,
                    result.dataset_count,
                    result.inaccessible_dataset_count,
                )
            )
        else:
            await ctx.warning(
                "Dashboard datasets retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Dashboard datasets retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return DashboardError(
            error=f"Failed to get dashboard datasets: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
