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
from unittest.mock import ANY, call, MagicMock, patch

import pytest

from superset import db, security_manager
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.models.dashboard import Dashboard
from superset.utils.json import dumps
from tests.integration_tests.fixtures.tabbed_dashboard import (
    tabbed_dashboard,  # noqa: F401
)
from tests.integration_tests.reports.utils import (
    cleanup_report_schedule,
    create_report_notification,
)
from tests.integration_tests.test_app import app

tab1 = "TAB-L1AA"
tab2 = "TAB-L1AB"
tab3 = "TAB-L1BB"


@pytest.fixture(autouse=True, scope="module")
def initial_report_cleanup():
    with app.app_context():
        cleanup_report_schedule()


def remove_tabs_from_dashboard(dashboard: Dashboard, tabs: list[str]):
    data = dashboard.data.copy()
    position = data["position_json"]
    for tab in tabs:
        del position[tab]
    data["position_json"] = dumps(position)
    return data


@patch("superset.commands.dashboard.update.send_email_smtp")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", ALERT_REPORT_TABS=True
)
def test_tab_deletion_single_report(
    send_email_smtp_mock: MagicMock,
    tabbed_dashboard: Dashboard,  # noqa: F811
    login_as_admin,
):
    tab_to_delete = tab1
    users = db.session.query(security_manager.user_model).all()
    report = create_report_notification(
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": tab_to_delete}},
        owners=[users[0]],
    )
    assert report.active is True
    UpdateDashboardCommand(
        tabbed_dashboard.id,
        remove_tabs_from_dashboard(tabbed_dashboard, [tab_to_delete]),
    ).run()

    assert report.active is False
    send_email_smtp_mock.assert_called_with(
        to=users[0].email,
        subject="[Report: report] Deactivated",
        html_content=ANY,
        config=ANY,
    )
    cleanup_report_schedule(report)


@patch("superset.commands.dashboard.update.send_email_smtp")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", ALERT_REPORT_TABS=True
)
def test_tab_deletion_multiple_reports(
    send_email_smtp_mock: MagicMock,
    tabbed_dashboard: Dashboard,  # noqa: F811
    login_as_admin,
):
    tab_to_delete = tab1
    retained_tab = tab2
    users = db.session.query(security_manager.user_model).all()
    report1 = create_report_notification(
        name="report 1",
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": tab_to_delete}},
        owners=[users[0], users[1]],
    )
    report2 = create_report_notification(
        name="report 2",
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": tab_to_delete}},
        owners=[users[1]],
    )
    report3 = create_report_notification(
        name="report 3",
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": retained_tab}},
        owners=[users[2]],
    )

    assert report1.active is True
    assert report2.active is True
    assert report3.active is True

    UpdateDashboardCommand(
        tabbed_dashboard.id,
        remove_tabs_from_dashboard(tabbed_dashboard, [tab_to_delete]),
    ).run()

    assert report1.active is False
    assert report2.active is False
    assert report3.active is True

    expected_calls = [
        call(
            to=users[0].email,
            subject="[Report: report 1] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
        call(
            to=users[1].email,
            subject="[Report: report 1] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
        call(
            to=users[1].email,
            subject="[Report: report 2] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
    ]

    assert send_email_smtp_mock.call_count == 3
    assert send_email_smtp_mock.call_args_list == expected_calls

    cleanup_report_schedule(report1)
    cleanup_report_schedule(report2)
    cleanup_report_schedule(report3)


@patch("superset.commands.dashboard.update.send_email_smtp")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", ALERT_REPORT_TABS=True
)
def test_multitple_tabs_removed(
    send_email_smtp_mock: MagicMock,
    tabbed_dashboard: Dashboard,  # noqa: F811
    login_as_admin,
):
    tabs_to_delete = [tab1, tab2]
    users = db.session.query(security_manager.user_model).all()
    report1 = create_report_notification(
        name="report 1",
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": tabs_to_delete[0]}},
        owners=[users[0], users[1]],
    )
    report2 = create_report_notification(
        name="report 2",
        dashboard=tabbed_dashboard,
        extra={"dashboard": {"anchor": tabs_to_delete[1]}},
        owners=[users[2]],
    )

    assert report1.active is True
    assert report2.active is True

    UpdateDashboardCommand(
        tabbed_dashboard.id,
        remove_tabs_from_dashboard(tabbed_dashboard, tabs_to_delete),
    ).run()

    assert report1.active is False
    assert report2.active is False

    expected_calls = [
        call(
            to=users[0].email,
            subject="[Report: report 1] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
        call(
            to=users[1].email,
            subject="[Report: report 1] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
        call(
            to=users[2].email,
            subject="[Report: report 2] Deactivated",
            html_content=ANY,
            config=ANY,
        ),
    ]

    assert send_email_smtp_mock.call_count == 3
    assert send_email_smtp_mock.call_args_list == expected_calls

    cleanup_report_schedule(report1)
    cleanup_report_schedule(report2)
