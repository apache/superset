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

from unittest.mock import MagicMock, patch, PropertyMock

from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.utils import json


def _tab_diff_command(*stored_tab_ids: str) -> UpdateDashboardCommand:
    """A command on dashboard 1 whose new layout holds TAB-1 alone.

    Every one of ``stored_tab_ids`` other than TAB-1 is therefore dropped by
    the update.
    """
    command = UpdateDashboardCommand(
        1,
        {
            "position_json": json.dumps(
                {
                    "ROOT_ID": {
                        "id": "ROOT_ID",
                        "type": "ROOT",
                        "children": ["TAB-1"],
                    },
                    "TAB-1": {
                        "id": "TAB-1",
                        "type": "TAB",
                        "meta": {"text": "First"},
                        "children": [],
                    },
                }
            )
        },
    )
    model = MagicMock()
    model.id = 1
    type(model).tabs = PropertyMock(
        return_value={"all_tabs": {tab: tab for tab in stored_tab_ids}}
    )
    command._model = model  # noqa: SLF001
    return command


def _report(report_id: int, dashboard_id: int) -> MagicMock:
    report = MagicMock()
    report.id = report_id
    report.dashboard_id = dashboard_id
    report.editors = []
    return report


def test_process_tab_diff_ignores_the_layout_without_position_json(
    app_context: None,
) -> None:
    """An update that does not carry a layout must not walk the stored one.

    A tab can only be deleted by an update that supplies `position_json`, so
    for any other payload — publishing a dashboard, renaming it — there is
    nothing to diff and the stored layout must be left alone.
    """
    command = UpdateDashboardCommand(1, {"published": True})
    tabs = PropertyMock(side_effect=AssertionError("the layout must not be read"))
    model = MagicMock()
    type(model).tabs = tabs
    command._model = model  # noqa: SLF001

    command.process_tab_diff()

    tabs.assert_not_called()


def test_process_tab_diff_deactivates_reports_on_deleted_tabs(
    app_context: None,
) -> None:
    """An update that drops a tab still deactivates the reports using it."""
    command = _tab_diff_command("TAB-1", "TAB-2")
    report = _report(10, dashboard_id=1)

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = [report]
        command.process_tab_diff()

    # TAB-2 is gone from the new layout, TAB-1 is not.
    report_dao.find_by_extra_metadata.assert_called_once_with("TAB-2")
    report_dao.update.assert_called_once_with(report, {"active": False})


def test_process_tab_diff_only_touches_reports_on_the_updated_dashboard(
    app_context: None,
) -> None:
    """A report is only deactivated when it belongs to the updated dashboard."""
    command = _tab_diff_command("TAB-1", "TAB-2")
    own_report = _report(10, dashboard_id=1)
    other_report = _report(20, dashboard_id=2)

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = [own_report, other_report]
        command.process_tab_diff()

    report_dao.update.assert_called_once_with(own_report, {"active": False})


def test_process_tab_diff_deactivates_a_report_spanning_two_deleted_tabs_once(
    app_context: None,
) -> None:
    """One report naming several deleted tabs is deactivated a single time."""
    command = _tab_diff_command("TAB-2", "TAB-3")
    report = _report(10, dashboard_id=1)

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        # The same report is matched by both deleted tabs.
        report_dao.find_by_extra_metadata.return_value = [report]
        command.process_tab_diff()

    report_dao.update.assert_called_once_with(report, {"active": False})


def test_process_native_filter_diff_only_touches_reports_on_the_updated_dashboard(
    app_context: None,
) -> None:
    """The filter path is scoped to the updated dashboard as well.

    It shares its report lookup with the tab path.
    """
    command = UpdateDashboardCommand(
        1,
        {
            "json_metadata": json.dumps(
                {"native_filter_configuration": [{"id": "NATIVE_FILTER-1"}]}
            )
        },
    )
    model = MagicMock()
    model.id = 1
    model.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {"id": "NATIVE_FILTER-1"},
                {"id": "NATIVE_FILTER-2"},
            ]
        }
    )
    command._model = model  # noqa: SLF001

    own_report = _report(10, dashboard_id=1)
    other_report = _report(20, dashboard_id=2)
    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_native_filter_id.return_value = [own_report, other_report]
        command.process_native_filter_diff()

    # NATIVE_FILTER-2 is the only one dropped from the new metadata.
    report_dao.find_by_native_filter_id.assert_called_once_with("NATIVE_FILTER-2")
    report_dao.update.assert_called_once_with(own_report, {"active": False})
