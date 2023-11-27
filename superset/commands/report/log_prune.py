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
from datetime import datetime, timedelta

from superset.commands.base import BaseCommand
from superset.commands.report.exceptions import ReportSchedulePruneLogError
from superset.daos.exceptions import DAODeleteFailedError
from superset.daos.report import ReportScheduleDAO
from superset.reports.models import ReportSchedule
from superset.utils.celery import session_scope

logger = logging.getLogger(__name__)


class AsyncPruneReportScheduleLogCommand(BaseCommand):
    """
    Prunes logs from all report schedules
    """

    def __init__(self, worker_context: bool = True):
        self._worker_context = worker_context

    def run(self) -> None:
        with session_scope(nullpool=True) as session:
            self.validate()
            prune_errors = []

            for report_schedule in session.query(ReportSchedule).all():
                if report_schedule.log_retention is not None:
                    from_date = datetime.utcnow() - timedelta(
                        days=report_schedule.log_retention
                    )
                    try:
                        row_count = ReportScheduleDAO.bulk_delete_logs(
                            report_schedule, from_date, session=session, commit=False
                        )
                        logger.info(
                            "Deleted %s logs for report schedule id: %s",
                            str(row_count),
                            str(report_schedule.id),
                        )
                    except DAODeleteFailedError as ex:
                        prune_errors.append(str(ex))
            if prune_errors:
                raise ReportSchedulePruneLogError(";".join(prune_errors))

    def validate(self) -> None:
        pass
