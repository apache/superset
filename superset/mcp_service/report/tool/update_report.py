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

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.report.schemas import (
    UpdateReportRequest,
    UpdateReportResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update a scheduled report or alert",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def update_report(
    request: UpdateReportRequest, ctx: Context
) -> UpdateReportResponse:
    """Update an existing scheduled report or alert in Superset.

    Use this tool when the user wants to:
    - Change the name, schedule, or recipients of an existing report or alert
    - Enable or disable a schedule without deleting it
    - Update the SQL condition or database for an existing alert

    Only fields explicitly provided in the request are changed;
    all omitted fields retain their current values.

    Workflow:
    1. Get the report id from a previous create_report call or from the Superset UI
    2. Call this tool with the id and only the fields to change
    3. The returned id confirms which schedule was updated
    """
    await ctx.info("Updating report schedule: id=%s" % (request.id,))

    try:
        # Deferred to avoid circular imports with the @tool decorator initialization
        from superset.commands.report.exceptions import (
            ReportScheduleInvalidError,
            ReportScheduleNotFoundError,
            ReportScheduleUpdateFailedError,
        )
        from superset.commands.report.update import UpdateReportScheduleCommand
        from superset.mcp_service.utils.url_utils import get_superset_base_url
        from superset.reports.models import (
            ReportRecipientType,
            ReportScheduleType,
        )

        recipient_type_map = {
            "Email": ReportRecipientType.EMAIL,
            "Slack": ReportRecipientType.SLACK,
            "SlackV2": ReportRecipientType.SLACKV2,
            "Webhook": ReportRecipientType.WEBHOOK,
        }

        recipients = None
        if request.recipients is not None:
            recipients = [
                {
                    "type": recipient_type_map[r.type],
                    "recipient_config_json": {"target": r.target},
                }
                for r in request.recipients
            ]

        all_props: dict[str, Any] = {
            "name": request.name,
            "crontab": request.crontab,
            "active": request.active,
            "description": request.description,
            "timezone": request.timezone,
            "dashboard": request.dashboard_id,
            "chart": request.chart_id,
            "database": request.database_id,
            "sql": request.sql,
        }
        if request.type is not None:
            all_props["type"] = (
                ReportScheduleType.ALERT
                if request.type == "Alert"
                else ReportScheduleType.REPORT
            )
        if recipients is not None:
            all_props["recipients"] = recipients
        properties = {k: v for k, v in all_props.items() if v is not None}

        with event_logger.log_context(action="mcp.update_report.update"):
            schedule = UpdateReportScheduleCommand(request.id, properties).run()

        report_url = f"{get_superset_base_url()}/report/list/"

        await ctx.info(
            "Report schedule updated: id=%s, name=%r, type=%s"
            % (schedule.id, schedule.name, schedule.type)
        )

        return UpdateReportResponse(
            id=schedule.id,
            name=schedule.name,
            type=schedule.type,
            crontab=schedule.crontab,
            active=schedule.active,
            url=report_url,
        )

    except ReportScheduleNotFoundError:
        await ctx.warning("Report schedule not found: id=%s" % (request.id,))
        return UpdateReportResponse(
            id=None,
            error=f"Report schedule with id={request.id} not found.",
        )
    except ReportScheduleInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Report schedule validation failed: %s" % (messages,))
        return UpdateReportResponse(
            id=None,
            error=str(messages),
        )
    except ReportScheduleUpdateFailedError as exc:
        await ctx.error("Report schedule update failed: %s" % (str(exc),))
        return UpdateReportResponse(
            id=None,
            error=f"Failed to update report schedule: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating report schedule: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
