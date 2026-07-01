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
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from flask import current_app
from kombu.exceptions import OperationalError as KombuOperationalError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandException
from superset.commands.report.exceptions import (
    ReportScheduleCeleryNotConfiguredError,
    ReportScheduleExecuteNowFailedError,
    ReportScheduleForbiddenError,
    ReportScheduleNotFoundError,
)
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.reports.models import ReportSchedule

logger = logging.getLogger(__name__)


class ExecuteReportScheduleNowCommand(BaseCommand):
    """
    Execute a report schedule immediately (manual trigger).

    Validates permissions and triggers immediate execution of a report or alert
    via Celery task, similar to scheduled execution but without waiting for the
    cron schedule. Sets ``eta`` to the current UTC time so that the downstream
    task receives a valid ``scheduled_dttm`` value.
    """

    def __init__(self, model_id: int) -> None:
        self._model_id = model_id
        self._model: Optional[ReportSchedule] = None

    def run(self) -> str:
        """
        Execute the command and return an execution UUID for tracking.

        Returns:
            str: Execution UUID that can be used to track the execution status.

        Raises:
            ReportScheduleNotFoundError: Report schedule not found.
            ReportScheduleForbiddenError: User doesn't have permission to execute.
            ReportScheduleCeleryNotConfiguredError: Celery broker is not reachable.
            ReportScheduleExecuteNowFailedError: Execution failed to start.
        """
        try:
            self.validate()
            if not self._model:
                raise ReportScheduleExecuteNowFailedError()

            execution_id = str(uuid4())

            logger.info(
                "Manually executing report schedule %s (id: %d), execution_id: %s",
                self._model.name,
                self._model.id,
                execution_id,
            )

            # Import here to avoid circular imports
            from superset.tasks.scheduler import execute

            # Set eta to now so the downstream task receives a valid scheduled_dttm.
            async_options: dict[str, Any] = {
                "task_id": execution_id,
                "eta": datetime.now(tz=timezone.utc),
            }

            if self._model.working_timeout is not None and current_app.config.get(
                "ALERT_REPORTS_WORKING_TIME_OUT_KILL", True
            ):
                async_options["time_limit"] = (
                    self._model.working_timeout
                    + current_app.config.get("ALERT_REPORTS_WORKING_TIME_OUT_LAG", 10)
                )
                async_options["soft_time_limit"] = (
                    self._model.working_timeout
                    + current_app.config.get(
                        "ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG", 5
                    )
                )

            try:
                execute.apply_async((self._model.id,), **async_options)
            except KombuOperationalError as celery_ex:
                logger.error("Celery backend not configured: %s", str(celery_ex))
                raise ReportScheduleCeleryNotConfiguredError() from celery_ex
            except Exception as celery_ex:
                logger.error("Celery task execution failed: %s", str(celery_ex))
                raise ReportScheduleExecuteNowFailedError() from celery_ex

            return execution_id

        except CommandException:
            raise
        except Exception as ex:
            logger.exception(
                "Unexpected error executing report schedule %d", self._model_id
            )
            raise ReportScheduleExecuteNowFailedError() from ex

    def validate(self) -> None:
        """Validate the report schedule exists and the user has permission to
        execute."""
        self._model = ReportScheduleDAO.find_by_id(self._model_id)
        if not self._model:
            raise ReportScheduleNotFoundError()

        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise ReportScheduleForbiddenError() from ex
