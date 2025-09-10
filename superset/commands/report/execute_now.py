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
from typing import Optional
from uuid import uuid4

from flask import current_app

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
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class ExecuteReportScheduleNowCommand(BaseCommand):
    """
    Execute a report schedule immediately (manual trigger).

    This command validates permissions and triggers immediate execution
    of a report or alert via Celery task, similar to scheduled execution
    but without waiting for the cron schedule.
    """

    def __init__(self, model_id: int) -> None:
        self._model_id = model_id
        self._model: Optional[ReportSchedule] = None

    @transaction()
    def run(self) -> str:
        """
        Execute the command and return execution UUID for tracking.

        Returns:
            str: Execution UUID that can be used to track the execution status

        Raises:
            ReportScheduleNotFoundError: Report schedule not found
            ReportScheduleForbiddenError: User doesn't have permission to execute
            ReportScheduleExecuteNowFailedError: Execution failed to start
        """
        try:
            self.validate()
            if not self._model:
                raise ReportScheduleExecuteNowFailedError()

            # Generate execution UUID for tracking
            execution_id = str(uuid4())

            # Trigger immediate execution via Celery
            logger.info(
                "Manually executing report schedule %s (id: %d), execution_id: %s",
                self._model.name,
                self._model.id,
                execution_id,
            )

            # Import the existing execute task to avoid circular imports
            from superset.tasks.scheduler import execute

            # Set async options similar to scheduler but for immediate execution
            async_options = {"task_id": execution_id}
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

            # Execute the task
            try:
                execute.apply_async((self._model.id,), **async_options)
            except Exception as celery_ex:
                # Check for common Celery configuration issues
                error_msg = str(celery_ex).lower()
                if any(
                    keyword in error_msg
                    for keyword in [
                        "no broker",
                        "broker connection",
                        "kombu",
                        "redis",
                        "rabbitmq",
                        "celery",
                        "not registered",
                        "connection refused",
                    ]
                ):
                    logger.error("Celery backend not configured: %s", str(celery_ex))
                    raise ReportScheduleCeleryNotConfiguredError() from celery_ex
                else:
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
        """Validate the report schedule exists and user has permission to execute it."""
        # Validate model exists
        self._model = ReportScheduleDAO.find_by_id(self._model_id)
        if not self._model:
            raise ReportScheduleNotFoundError()

        # Check ownership using the same pattern as delete command
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise ReportScheduleForbiddenError() from ex
