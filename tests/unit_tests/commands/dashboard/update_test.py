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
    type(model).tabs = PropertyMock(
        return_value={"all_tabs": {"TAB-1": "First", "TAB-2": "Second"}}
    )
    command._model = model  # noqa: SLF001

    report = MagicMock()
    report.editors = []
    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = [report]
        command.process_tab_diff()

    # TAB-2 is gone from the new layout, TAB-1 is not.
    report_dao.find_by_extra_metadata.assert_called_once_with("TAB-2")
    report_dao.update.assert_called_once_with(report, {"active": False})
