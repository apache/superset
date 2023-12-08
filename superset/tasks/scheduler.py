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
from datetime import datetime

from celery import Celery
from celery.exceptions import SoftTimeLimitExceeded

from superset import app, is_feature_enabled
from superset.commands.exceptions import CommandException
from superset.commands.report.exceptions import ReportScheduleUnexpectedError
from superset.commands.report.execute import AsyncExecuteReportScheduleCommand
from superset.commands.report.log_prune import AsyncPruneReportScheduleLogCommand
from superset.daos.report import ReportScheduleDAO
from superset.extensions import celery_app
from superset.stats_logger import BaseStatsLogger
from superset.tasks.cron_util import cron_schedule_window
from superset.utils.celery import session_scope
from superset.utils.core import LoggerLevel
from superset.utils.log import get_logger_from_status

logger = logging.getLogger(__name__)


@celery_app.task(name="reports.scheduler")
def scheduler() -> None:
    """
    Celery beat main scheduler for reports
    """
    stats_logger: BaseStatsLogger = app.config["STATS_LOGGER"]
    stats_logger.incr("reports.scheduler")

    if not is_feature_enabled("ALERT_REPORTS"):
        return
    with session_scope(nullpool=True) as session:
        active_schedules = ReportScheduleDAO.find_active(session)
        triggered_at = (
            datetime.fromisoformat(scheduler.request.expires)
            - app.config["CELERY_BEAT_SCHEDULER_EXPIRES"]
            if scheduler.request.expires
            else datetime.utcnow()
        )
        for active_schedule in active_schedules:
            for schedule in cron_schedule_window(
                triggered_at, active_schedule.crontab, active_schedule.timezone
            ):
                logger.info(
                    "Scheduling alert %s eta: %s", active_schedule.name, schedule
                )
                async_options = {"eta": schedule}
                if (
                    active_schedule.working_timeout is not None
                    and app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"]
                ):
                    async_options["time_limit"] = (
                        active_schedule.working_timeout
                        + app.config["ALERT_REPORTS_WORKING_TIME_OUT_LAG"]
                    )
                    async_options["soft_time_limit"] = (
                        active_schedule.working_timeout
                        + app.config["ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG"]
                    )
                execute.apply_async((active_schedule.id,), **async_options)


@celery_app.task(name="reports.execute", bind=True)
def execute(self: Celery.task, report_schedule_id: int) -> None:
    stats_logger: BaseStatsLogger = app.config["STATS_LOGGER"]
    stats_logger.incr("reports.execute")

    task_id = None
    try:
        task_id = execute.request.id
        scheduled_dttm = execute.request.eta
        logger.info(
            "Executing alert/report, task id: %s, scheduled_dttm: %s",
            task_id,
            scheduled_dttm,
        )
        AsyncExecuteReportScheduleCommand(
            task_id,
            report_schedule_id,
            scheduled_dttm,
        ).run()
    except ReportScheduleUnexpectedError:
        logger.exception(
            "An unexpected occurred while executing the report: %s", task_id
        )
        self.update_state(state="FAILURE")
    except CommandException as ex:
        logger_func, level = get_logger_from_status(ex.status)
        logger_func(
            f"A downstream {level} occurred "
            f"while generating a report: {task_id}. {ex.message}",
            exc_info=True,
        )
        if level == LoggerLevel.EXCEPTION:
            self.update_state(state="FAILURE")


@celery_app.task(name="reports.prune_log")
def prune_log() -> None:
    stats_logger: BaseStatsLogger = app.config["STATS_LOGGER"]
    stats_logger.incr("reports.prune_log")

    try:
        AsyncPruneReportScheduleLogCommand().run()
    except SoftTimeLimitExceeded as ex:
        logger.warning("A timeout occurred while pruning report schedule logs: %s", ex)
    except CommandException:
        logger.exception("An exception occurred while pruning report schedule logs")
