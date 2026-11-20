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
from functools import partial
from typing import Any

from croniter import CroniterBadDateError

from superset.commands.base import BaseCommand
from superset.commands.report.exceptions import (
    ReportConfigConflictError,
    ReportConfigUpdateFailedError,
)
from superset.daos.report import ReportConfigDAO, ReportScheduleDAO
from superset.reports.models import (
    ReportConfigKey,
    ReportSchedule,
    ReportScheduleType,
)
from superset.reports.utils import cron_meets_minimum_interval, get_email_addresses
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateReportConfigCommand(BaseCommand):
    """
    Update the global Alerts & Reports configuration.

    Recipient restrictions and minimum intervals are validated against every
    existing schedule: when any of them would become invalid under the new
    configuration the command fails and lists the impacted schedules, so admins
    can fix them before tightening the policy.
    """

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._impacted: list[dict[str, Any]] = []

    @transaction(on_error=partial(on_error, reraise=ReportConfigUpdateFailedError))
    def run(self) -> dict[str, Any]:
        ReportConfigDAO.lock_for_update()
        self.validate()
        ReportConfigDAO.upsert(self._properties)
        return ReportConfigDAO.get_effective_config()

    def _effective(self, key: ReportConfigKey) -> Any:
        """Value ``key`` will have once the payload is applied."""
        if key in self._properties:
            return self._properties[key]
        return ReportConfigDAO.get_effective_value(key)

    def _add_impacted(self, schedule: ReportSchedule, reason: str, detail: str) -> None:
        self._impacted.append(
            {
                "id": schedule.id,
                "name": schedule.name,
                "type": schedule.type,
                "reason": reason,
                "detail": detail,
            }
        )

    def _validate_recipients(self) -> None:
        touches_policy = (
            ReportConfigKey.ALLOWED_EMAIL_DOMAINS in self._properties
            or ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS in self._properties
        )
        if not touches_policy:
            return
        allowed_domains = self._effective(ReportConfigKey.ALLOWED_EMAIL_DOMAINS) or []
        limit_to_users = bool(
            self._effective(ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS)
        )
        if not allowed_domains and not limit_to_users:
            return
        schedules = [
            (schedule, get_email_addresses(schedule.recipients))
            for schedule in ReportScheduleDAO.find_with_email_recipients()
        ]
        known_emails = (
            ReportConfigDAO.get_known_user_emails(
                list(
                    {
                        address.lower()
                        for _, addresses in schedules
                        for address in addresses
                    }
                )
            )
            if limit_to_users
            else None
        )
        for schedule, addresses in schedules:
            disallowed = ReportConfigDAO.find_disallowed_addresses(
                addresses,
                allowed_domains=allowed_domains,
                limit_to_users=limit_to_users,
                known_emails=known_emails,
            )
            for address in disallowed:
                self._add_impacted(schedule, "recipient", address)

    def _validate_frequency(
        self, key: ReportConfigKey, report_type: ReportScheduleType
    ) -> None:
        if key not in self._properties:
            return
        minimum_interval = self._effective(key)
        if not isinstance(minimum_interval, int) or minimum_interval < 120:
            return
        for schedule in ReportScheduleDAO.find_by_type(report_type):
            try:
                if not cron_meets_minimum_interval(schedule.crontab, minimum_interval):
                    self._add_impacted(schedule, "frequency", schedule.crontab)
            except CroniterBadDateError:
                logger.warning(
                    "Skipping schedule %s with an invalid crontab", schedule.id
                )

    def validate(self) -> None:
        self._impacted = []
        self._validate_recipients()
        self._validate_frequency(
            ReportConfigKey.ALERT_MINIMUM_INTERVAL, ReportScheduleType.ALERT
        )
        self._validate_frequency(
            ReportConfigKey.REPORT_MINIMUM_INTERVAL, ReportScheduleType.REPORT
        )
        if self._impacted:
            raise ReportConfigConflictError(self._impacted)
