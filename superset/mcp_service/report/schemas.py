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

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RecipientConfig(BaseModel):
    """Configuration for a single report recipient."""

    model_config = ConfigDict(populate_by_name=True)

    type: str = Field(
        ...,
        description=(
            "Recipient channel type. One of: 'Email', 'Slack', 'SlackV2', 'Webhook'."
        ),
    )
    target: str = Field(
        ...,
        description=(
            "Destination for the notification. "
            "For Email: an email address. "
            "For Slack/SlackV2: a channel name or ID. "
            "For Webhook: the URL."
        ),
    )

    @field_validator("type")
    @classmethod
    def type_must_be_valid(cls, v: str) -> str:
        if v not in (valid_types := {"Email", "Slack", "SlackV2", "Webhook"}):
            raise ValueError(
                f"Invalid recipient type {v!r}. Must be one of: {sorted(valid_types)}"
            )
        return v

    @field_validator("target")
    @classmethod
    def target_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("target must not be empty")
        return v.strip()


class CreateReportRequest(BaseModel):
    """Request schema for create_report."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Name for the new report or alert schedule.",
    )
    type: str = Field(
        ...,
        description=(
            "Schedule type: 'Report' to deliver a snapshot, "
            "'Alert' to notify on a SQL condition."
        ),
    )
    crontab: str = Field(
        ...,
        description=(
            "Cron expression defining the execution schedule. "
            "Examples: '0 9 * * 1' (every Monday at 9 AM), "
            "'0 8 * * 1-5' (weekdays at 8 AM)."
        ),
    )
    description: str | None = Field(
        None,
        description="Optional human-readable description of the schedule.",
    )
    active: bool = Field(
        True,
        description="Whether the schedule is active immediately after creation.",
    )
    timezone: str | None = Field(
        None,
        description=(
            "Timezone for interpreting the cron schedule "
            "(e.g., 'America/New_York', 'UTC'). Defaults to server timezone."
        ),
    )
    recipients: list[RecipientConfig] = Field(
        default_factory=list,
        description=(
            "List of notification recipients. "
            "For reports/alerts created via this tool, provide at least one recipient. "
            "Example: [{'type': 'Email', 'target': 'user@example.com'}]"
        ),
    )
    dashboard_id: int | None = Field(
        None,
        description=(
            "ID of the dashboard to attach this report to. "
            "Use list_dashboards to find valid IDs. "
            "Provide either dashboard_id or chart_id, not both."
        ),
    )
    chart_id: int | None = Field(
        None,
        description=(
            "ID of the chart to attach this report to. "
            "Use list_charts to find valid IDs. "
            "Provide either chart_id or dashboard_id, not both."
        ),
    )
    database_id: int | None = Field(
        None,
        description=(
            "ID of the database connection for evaluating the alert condition. "
            "Required when type is 'Alert'. Use list_databases to find valid IDs."
        ),
    )
    sql: str | None = Field(
        None,
        description=(
            "SQL query whose result is evaluated as the alert condition. "
            "Used when type is 'Alert'."
        ),
    )

    @field_validator("type")
    @classmethod
    def type_must_be_valid(cls, v: str) -> str:
        if v not in (valid_types := {"Report", "Alert"}):
            raise ValueError(
                f"Invalid type {v!r}. Must be one of: {sorted(valid_types)}"
            )
        return v

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @field_validator("crontab")
    @classmethod
    def crontab_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("crontab must not be empty")
        return v.strip()


class CreateReportResponse(BaseModel):
    """Response schema for create_report."""

    id: int | None = Field(
        None,
        description="ID of the created report schedule. None if creation failed.",
    )
    name: str | None = Field(
        None,
        description="Name of the created schedule.",
    )
    type: str | None = Field(
        None,
        description="Type of the schedule ('Report' or 'Alert').",
    )
    crontab: str | None = Field(
        None,
        description="Cron expression for the schedule.",
    )
    active: bool | None = Field(
        None,
        description="Whether the schedule is active.",
    )
    url: str | None = Field(
        None,
        description=(
            "URL to manage the report schedule in Superset. None if creation failed."
        ),
    )
    error: str | None = Field(
        None,
        description="Error message if creation failed, otherwise null.",
    )
