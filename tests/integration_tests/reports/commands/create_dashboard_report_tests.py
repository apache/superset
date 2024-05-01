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

import pytest

from superset import db
from superset.commands.report.create import CreateReportScheduleCommand
from superset.commands.report.exceptions import ReportScheduleInvalidError
from superset.models.dashboard import Dashboard
from superset.reports.models import (
    ReportCreationMethod,
    ReportRecipientType,
    ReportScheduleType,
)
from tests.integration_tests.fixtures.tabbed_dashboard import (
    tabbed_dashboard,  # noqa: F401
)

DASHBOARD_REPORT_SCHEDULE_DEFAULTS = {
    "type": ReportScheduleType.REPORT,
    "description": "description",
    "crontab": "0 9 * * *",
    "creation_method": ReportCreationMethod.ALERTS_REPORTS,
    "recipients": [
        {
            "type": ReportRecipientType.EMAIL,
            "recipient_config_json": {"target": "target@example.com"},
        },
    ],
    "grace_period": 14400,
    "working_timeout": 3600,
}


@pytest.mark.usefixtures("login_as_admin")
def test_accept_valid_tab_ids(tabbed_dashboard: Dashboard) -> None:  # noqa: F811
    report_schedule = CreateReportScheduleCommand(
        {
            **DASHBOARD_REPORT_SCHEDULE_DEFAULTS,
            "name": "tabbed dashboard report (valid tabs id)",
            "dashboard": tabbed_dashboard.id,
            "extra": {"dashboard": {"activeTabs": ["TAB-L1AA", "TAB-L2AB"]}},
        }
    ).run()
    assert report_schedule.extra == {
        "dashboard": {"activeTabs": ["TAB-L1AA", "TAB-L2AB"]}
    }
    db.session.delete(report_schedule)
    db.session.commit()


@pytest.mark.usefixtures("login_as_admin")
def test_raise_exception_for_invalid_tab_ids(tabbed_dashboard: Dashboard) -> None:  # noqa: F811
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        CreateReportScheduleCommand(
            {
                **DASHBOARD_REPORT_SCHEDULE_DEFAULTS,
                "name": "tabbed dashboard report (invalid tab ids)",
                "dashboard": tabbed_dashboard.id,
                "extra": {"dashboard": {"activeTabs": ["TAB-INVALID_ID"]}},
            }
        ).run()
    assert "Invalid tab ids" in str(exc_info.value.normalized_messages())

    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        CreateReportScheduleCommand(
            {
                **DASHBOARD_REPORT_SCHEDULE_DEFAULTS,
                "name": "tabbed dashboard report (invalid tab ids in anchor)",
                "dashboard": tabbed_dashboard.id,
                "extra": {
                    "dashboard": {
                        "activeTabs": ["TAB-L1AA"],
                        "anchor": "TAB-INVALID_ID",
                    }
                },
            }
        ).run()
    assert "Invalid tab ids" in str(exc_info.value.normalized_messages())
