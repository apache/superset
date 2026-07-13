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
Get report info FastMCP tool.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.report.schemas import (
    GetReportInfoRequest,
    ReportError,
    ReportInfo,
    serialize_report_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="ReportSchedule",
    annotations=ToolAnnotations(
        title="Get report info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_report_info(
    request: GetReportInfoRequest, ctx: Context
) -> ReportInfo | ReportError:
    """Get alert or report schedule metadata by numeric ID.

    Returns schedule configuration including type (Alert/Report), active
    status, cron expression, and associated dashboard or chart.

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 123)
    - To find a report ID, use the list_reports tool first
    - Editor/access-list details are excluded by privacy controls

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info(
        "Retrieving report information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset import is_feature_enabled
        from superset.daos.report import ReportScheduleDAO

        if not is_feature_enabled("ALERT_REPORTS"):
            return ReportError.create(
                error="The Alerts & Reports feature is disabled on this instance.",
                error_type="FeatureDisabled",
            )

        with event_logger.log_context(action="mcp.get_report_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=ReportScheduleDAO,
                output_schema=ReportInfo,
                error_schema=ReportError,
                serializer=serialize_report_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, ReportInfo):
            await ctx.info(
                "Report information retrieved successfully: "
                "report_id=%s, name=%s, type=%s"
                % (
                    result.id,
                    result.name,
                    result.type,
                )
            )
        else:
            await ctx.warning(
                "Report retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as exc:  # noqa: BLE001
        await ctx.error(
            "Report information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                str(exc),
                type(exc).__name__,
            )
        )
        return ReportError(
            error=f"Failed to get report info: {str(exc)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
