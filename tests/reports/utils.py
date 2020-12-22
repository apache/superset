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

from typing import List, Optional

from flask_appbuilder.security.sqla.models import User

from superset import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.reports import (
    ReportExecutionLog,
    ReportRecipients,
    ReportSchedule,
    ReportState,
)
from superset.models.slice import Slice


def insert_report_schedule(
    type: str,
    name: str,
    crontab: str,
    sql: Optional[str] = None,
    description: Optional[str] = None,
    chart: Optional[Slice] = None,
    dashboard: Optional[Dashboard] = None,
    database: Optional[Database] = None,
    owners: Optional[List[User]] = None,
    validator_type: Optional[str] = None,
    validator_config_json: Optional[str] = None,
    log_retention: Optional[int] = None,
    last_state: Optional[ReportState] = None,
    grace_period: Optional[int] = None,
    recipients: Optional[List[ReportRecipients]] = None,
    logs: Optional[List[ReportExecutionLog]] = None,
) -> ReportSchedule:
    owners = owners or []
    recipients = recipients or []
    logs = logs or []
    last_state = last_state or ReportState.NOOP
    report_schedule = ReportSchedule(
        type=type,
        name=name,
        crontab=crontab,
        sql=sql,
        description=description,
        chart=chart,
        dashboard=dashboard,
        database=database,
        owners=owners,
        validator_type=validator_type,
        validator_config_json=validator_config_json,
        log_retention=log_retention,
        grace_period=grace_period,
        recipients=recipients,
        logs=logs,
        last_state=last_state,
    )
    db.session.add(report_schedule)
    db.session.commit()
    return report_schedule
