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
"""Database-backed Alerts & Reports configuration validation tests."""

from uuid import uuid4

import pytest
from flask.ctx import AppContext

from superset import db
from superset.commands.report.exceptions import ReportConfigConflictError
from superset.commands.report.update_config import UpdateReportConfigCommand
from superset.daos.report import ReportScheduleDAO
from superset.reports.models import (
    ReportConfigKey,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
)
from superset.utils import json


def test_domain_conflict_includes_inactive_bcc_but_excludes_slack(
    app_context: AppContext,
) -> None:
    """The real recipient join finds inactive e-mail schedules, including Bcc."""
    inactive_email = ReportSchedule(
        type=ReportScheduleType.REPORT,
        name=f"sip209_inactive_email_{uuid4()}",
        crontab="0 9 * * *",
        active=False,
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.EMAIL,
                recipient_config_json=json.dumps(
                    {
                        "target": "internal@example.com",
                        "bccTarget": "external@outside.org",
                    }
                ),
            )
        ],
    )
    slack_only = ReportSchedule(
        type=ReportScheduleType.REPORT,
        name=f"sip209_slack_only_{uuid4()}",
        crontab="0 9 * * *",
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json=json.dumps({"target": "external@outside.org"}),
            )
        ],
    )
    db.session.add_all([inactive_email, slack_only])
    db.session.commit()

    try:
        matching_ids = {
            schedule.id for schedule in ReportScheduleDAO.find_with_email_recipients()
        }
        assert inactive_email.id in matching_ids
        assert slack_only.id not in matching_ids

        with pytest.raises(ReportConfigConflictError) as exc:
            UpdateReportConfigCommand(
                {
                    ReportConfigKey.ALLOWED_EMAIL_DOMAINS: ["example.com"],
                    ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS: False,
                }
            ).validate()

        seeded_ids = {inactive_email.id, slack_only.id}
        assert [
            row for row in exc.value.impacted_schedules if row["id"] in seeded_ids
        ] == [
            {
                "id": inactive_email.id,
                "name": inactive_email.name,
                "type": ReportScheduleType.REPORT,
                "reason": "recipient",
                "detail": "external@outside.org",
            }
        ]
    finally:
        db.session.rollback()
        db.session.delete(inactive_email)
        db.session.delete(slack_only)
        db.session.commit()
