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
"""Shared Teams recipient rules for schedule saves and notification delivery."""

from flask import current_app

from superset.extensions import feature_flag_manager
from superset.integrations.teams.config import (
    parse_teams_config,
    TeamsConfig,
    TeamsDestination,
)
from superset.reports.models import ReportDataFormat, ReportScheduleType
from superset.utils import json


class TeamsRecipientValidationError(ValueError):
    """A field-specific error that never includes credentials or supplied values."""

    def __init__(self, message: str, field: str = "recipients") -> None:
        """Identify the schedule field that must be corrected."""
        super().__init__(message)
        self.field = field


def validate_teams_recipient(
    recipient_config: object,
    schedule_type: str | None,
    report_format: str | None,
) -> tuple[TeamsConfig, TeamsDestination]:
    """Require an enabled, configured, attachment-free alert and an approved key.

    Accept deserialized command input or persisted recipient JSON. Installation
    availability is deliberately checked only at delivery, so schedules may be
    saved before a bot is installed. No SDK dependency or database access is needed.
    """
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_TEAMS"):
        raise TeamsRecipientValidationError("Teams alert delivery is disabled")
    try:
        config = parse_teams_config(current_app.config.get("ALERT_REPORTS_TEAMS", {}))
    except ValueError:
        raise TeamsRecipientValidationError(
            "Invalid Teams deployment configuration"
        ) from None
    if config is None:
        raise TeamsRecipientValidationError("Teams deployment is not configured")
    if schedule_type != ReportScheduleType.ALERT:
        raise TeamsRecipientValidationError(
            "Teams recipients require an alert schedule", "type"
        )
    if report_format != ReportDataFormat.NONE:
        raise TeamsRecipientValidationError(
            "Teams recipients require disabled attachments (NONE format)",
            "report_format",
        )
    try:
        recipient = (
            json.loads(recipient_config)
            if isinstance(recipient_config, str)
            else recipient_config
        )
    except (ValueError, TypeError):
        raise TeamsRecipientValidationError(
            "Invalid Teams recipient configuration"
        ) from None
    if (
        not isinstance(recipient, dict)
        or set(recipient) != {"target"}
        or not isinstance(recipient["target"], str)
        or not recipient["target"]
    ):
        raise TeamsRecipientValidationError(
            "A configured Teams destination key is required"
        )
    try:
        destination = config.get_destination(recipient["target"])
    except ValueError:
        raise TeamsRecipientValidationError(
            "Teams destination is not approved"
        ) from None
    return config, destination
