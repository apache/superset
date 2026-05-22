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
    CreateReportRequest,
    CreateReportResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create a scheduled report or alert",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_report(
    request: CreateReportRequest, ctx: Context
) -> CreateReportResponse:
    """Create a new scheduled report or alert in Superset.

    Use this tool when the user wants to:
    - Email a dashboard or chart snapshot on a recurring schedule (type='Report')
    - Trigger a notification when a SQL query result meets a threshold (type='Alert')

    Workflow:
    1. Get dashboard_id from list_dashboards or chart_id from list_charts
    2. For alerts, also get database_id from list_databases
    3. Call this tool with the schedule config and at least one recipient
    4. The returned id can be referenced when managing schedules
    """
    await ctx.info(
        "Creating report schedule: name=%r, type=%s, crontab=%r"
        % (request.name, request.type, request.crontab)
    )

    try:
        # Deferred to avoid circular imports with the @tool decorator initialization
        from superset.commands.report.create import CreateReportScheduleCommand
        from superset.commands.report.exceptions import (
            ReportScheduleCreateFailedError,
            ReportScheduleInvalidError,
        )
        from superset.mcp_service.utils.url_utils import get_superset_base_url
        from superset.reports.models import (
            ReportCreationMethod,
            ReportRecipientType,
            ReportScheduleType,
        )

        schedule_type = (
            ReportScheduleType.ALERT
            if request.type == "Alert"
            else ReportScheduleType.REPORT
        )

        recipient_type_map = {
            "Email": ReportRecipientType.EMAIL,
            "Slack": ReportRecipientType.SLACK,
            "SlackV2": ReportRecipientType.SLACKV2,
            "Webhook": ReportRecipientType.WEBHOOK,
        }
        recipients: list[dict[str, Any]] = [
            {
                "type": recipient_type_map[r.type],
                "recipient_config_json": {"target": r.target},
            }
            for r in request.recipients
        ]

        properties: dict[str, Any] = {
            "name": request.name,
            "type": schedule_type,
            "crontab": request.crontab,
            "active": request.active,
            "creation_method": ReportCreationMethod.ALERTS_REPORTS,
            "recipients": recipients,
        }

        optional: dict[str, Any] = {
            "description": request.description,
            "timezone": request.timezone,
            "dashboard": request.dashboard_id,
            "chart": request.chart_id,
            "database": request.database_id,
            "sql": request.sql,
        }
        properties.update({k: v for k, v in optional.items() if v is not None})

        with event_logger.log_context(action="mcp.create_report.create"):
            schedule = CreateReportScheduleCommand(properties).run()

        report_url = f"{get_superset_base_url()}/report/list/"

        await ctx.info(
            "Report schedule created: id=%s, name=%r, type=%s"
            % (schedule.id, schedule.name, schedule.type)
        )

        return CreateReportResponse(
            id=schedule.id,
            name=schedule.name,
            type=schedule.type,
            crontab=schedule.crontab,
            active=schedule.active,
            url=report_url,
        )

    except ReportScheduleInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Report schedule validation failed: %s" % (messages,))
        return CreateReportResponse(
            id=None,
            name=request.name,
            type=request.type,
            crontab=request.crontab,
            active=request.active,
            url=None,
            error=str(messages),
        )
    except ReportScheduleCreateFailedError as exc:
        await ctx.error("Report schedule creation failed: %s" % (str(exc),))
        return CreateReportResponse(
            id=None,
            name=request.name,
            type=request.type,
            crontab=request.crontab,
            active=request.active,
            url=None,
            error=f"Failed to create report schedule: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating report schedule: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
