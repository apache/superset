import logging
from datetime import datetime, timedelta
from typing import Iterator, Optional

import croniter

from superset.commands.exceptions import CommandException
from superset.extensions import celery_app
from superset.reports.commands.execute import ExecuteReportScheduleCommand
from superset.reports.commands.log_prune import PruneReportScheduleLogCommand
from superset.reports.dao import ReportScheduleDAO
from superset.utils.celery import session_scope

logger = logging.getLogger(__name__)


class ScheduleWindow:
    def __init__(self, window_size: int = 10) -> None:
        self._window_size = window_size
        utc_now = datetime.utcnow()
        self._start_at = utc_now - timedelta(seconds=1)
        self._stop_at = utc_now + timedelta(seconds=self._window_size)

    def next(self, cron: str) -> Iterator[datetime]:
        crons = croniter.croniter(cron, self._start_at)
        for schedule in crons.all_next(datetime):
            if schedule >= self._stop_at:
                break
            yield schedule

    @property
    def start_at(self) -> datetime:
        return self._start_at

    @property
    def stop_at(self) -> datetime:
        return self._stop_at


@celery_app.task(name="reports.scheduler")
def scheduler() -> None:
    """
    Celery beat main scheduler for reports
    """
    schedule_window = ScheduleWindow()
    with session_scope(nullpool=True) as session:
        active_schedules = ReportScheduleDAO.find_active(session)
        for active_schedule in active_schedules:
            logger.debug(f"Processing active schedule {active_schedule}")
            for schedule in schedule_window.next(active_schedule.crontab):
                logger.debug(f"Execution time {schedule}")
                execute.apply_async((active_schedule.id,), eta=schedule)


@celery_app.task(name="reports.execute")
def execute(report_schedule_id: int) -> None:
    try:
        ExecuteReportScheduleCommand(report_schedule_id, worker_context=True).run()
    except CommandException as ex:
        logger.error("An exception occurred while executing the report %s", ex)


@celery_app.task(name="reports.prune_log")
def prune_log() -> None:
    PruneReportScheduleLogCommand(worker_context=True).run()
