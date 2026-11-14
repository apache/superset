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
from __future__ import annotations

from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.dashboard.update import (
    UpdateDashboardCommand,
    UpdateDashboardNativeFiltersCommand,
)
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


def _report(
    report_id: int, dashboard_id: int, extra: dict[str, object] | None = None
) -> MagicMock:
    report = MagicMock()
    report.id = report_id
    report.dashboard_id = dashboard_id
    report.editors = []
    report.extra = extra or {}
    return report


def _tab_report(report_id: int, dashboard_id: int, anchor: str) -> MagicMock:
    return _report(report_id, dashboard_id, {"dashboard": {"anchor": anchor}})


def _filter_report(
    report_id: int, dashboard_id: int, *filter_ids: str, values: object = None
) -> MagicMock:
    return _report(
        report_id,
        dashboard_id,
        {
            "dashboard": {
                "nativeFilters": [
                    {
                        "nativeFilterId": filter_id,
                        "filterType": "filter_select",
                        "columnName": "region",
                        "filterValues": values or ["North America"],
                    }
                    for filter_id in filter_ids
                ]
            }
        },
    )


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
    report = _tab_report(10, 1, '["TAB-2"]')

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
    own_report = _tab_report(10, 1, '["TAB-2"]')
    other_report = _tab_report(20, 2, '["TAB-2"]')

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = [own_report, other_report]
        command.process_tab_diff()

    report_dao.update.assert_called_once_with(own_report, {"active": False})


def test_process_tab_diff_deactivates_a_report_spanning_two_deleted_tabs_once(
    app_context: None,
) -> None:
    """One report naming several deleted tabs is deactivated a single time."""
    command = _tab_diff_command("TAB-2", "TAB-3")
    report = _tab_report(10, 1, '["TAB-2", "TAB-3"]')

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

    own_report = _filter_report(10, 1, "NATIVE_FILTER-2")
    other_report = _filter_report(20, 2, "NATIVE_FILTER-2")
    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_native_filter_id.return_value = [own_report, other_report]
        command.process_native_filter_diff()

    # NATIVE_FILTER-2 is the only one dropped from the new metadata.
    report_dao.find_by_native_filter_id.assert_called_once_with("NATIVE_FILTER-2")
    report_dao.update.assert_called_once_with(own_report, {"active": False})


def test_run_repairs_a_position_json_with_a_detached_cycle(
    mocker: MockerFixture, app_context: None
) -> None:
    """A PUT carrying a corrupted layout is repaired before it is persisted."""
    position = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []},
        # a column dropped into a row nested inside itself: a detached cycle
        "COLUMN-orphan": {
            "id": "COLUMN-orphan",
            "type": "COLUMN",
            "children": ["CHART-trapped", "ROW-orphan"],
        },
        "ROW-orphan": {
            "id": "ROW-orphan",
            "type": "ROW",
            "children": ["COLUMN-orphan"],
        },
        "CHART-trapped": {
            "id": "CHART-trapped",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": 2, "width": 4},
        },
    }
    command = UpdateDashboardCommand(1, {"position_json": json.dumps(position)})
    command._model = MagicMock()  # noqa: SLF001
    mocker.patch.object(command, "validate")
    mocker.patch.object(command, "process_tab_diff")
    mocker.patch.object(command, "process_native_filter_diff")
    mocker.patch("superset.db")
    mocker.patch("superset.commands.dashboard.update.db")
    dao = mocker.patch("superset.commands.dashboard.update.DashboardDAO")

    command.run()

    saved = json.loads(dao.update.call_args.args[1]["position_json"])
    assert "COLUMN-orphan" not in saved
    assert "ROW-orphan" not in saved
    [new_row_id] = saved["GRID_ID"]["children"]
    assert saved[new_row_id]["children"] == ["CHART-trapped"]
    assert saved["CHART-trapped"]["parents"] == ["ROOT_ID", "GRID_ID", new_row_id]


def _mock_dependencies(mocker: MockerFixture, existing_css: str) -> None:
    model = mocker.MagicMock(
        id=1, tags=[], css=existing_css, is_managed_externally=False
    )
    mocker.patch(
        "superset.commands.dashboard.update.DashboardDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.dashboard.update.DashboardDAO"
        ".validate_update_slug_uniqueness",
        return_value=True,
    )
    mocker.patch("superset.commands.dashboard.update.security_manager")
    mocker.patch("superset.commands.dashboard.update.compute_subjects")
    mocker.patch("superset.commands.dashboard.update.validate_tags")


def test_update_dashboard_does_not_reject_unchanged_dangerous_css(
    mocker: MockerFixture,
) -> None:
    """A dashboard whose stored css predates the check (or was imported
    before the check covered imports) stays editable for changes that
    don't touch css -- resending the unchanged value must not re-trigger
    validation. This is the regression covered by apache/superset#40640's
    follow-up: renaming a dashboard, moving a chart, or editing a filter all
    resend the full object, including an untouched ``css`` field."""
    existing_css = "@import url('https://evil.example.com/x.css');"
    _mock_dependencies(mocker, existing_css)

    UpdateDashboardCommand(
        1, {"dashboard_title": "Renamed", "css": existing_css}
    ).validate()


def test_update_dashboard_rejects_new_dangerous_css(mocker: MockerFixture) -> None:
    """A genuinely new css value is still validated on update, and the
    resulting error stays keyed under "css" -- matching the field-shaped
    error the PUT schema returned before this validation moved into the
    command -- rather than falling back to marshmallow's generic
    "_schema" key."""
    _mock_dependencies(mocker, existing_css="")

    dangerous_css = "div { width: expression(alert(1)); }"
    with pytest.raises(DashboardInvalidError) as exc_info:
        UpdateDashboardCommand(1, {"css": dangerous_css}).validate()
    assert "css" in exc_info.value.normalized_messages()
    assert any(
        "disallowed construct" in str(message)
        for exc in exc_info.value._exceptions
        for message in exc.messages
    )


def test_update_dashboard_rejects_dangerous_css_replacing_a_prior_value(
    mocker: MockerFixture,
) -> None:
    """Changing an already-dangerous css to a different, still-dangerous
    value is rejected -- the exemption is only for resending the exact
    stored value unchanged, not for editing css at all."""
    _mock_dependencies(
        mocker, existing_css="@import url('https://old.example.com/x.css');"
    )

    dangerous_css = "@import url('https://new.example.com/y.css');"
    with pytest.raises(DashboardInvalidError) as exc_info:
        UpdateDashboardCommand(1, {"css": dangerous_css}).validate()
    assert any(
        "disallowed construct" in str(message)
        for exc in exc_info.value._exceptions
        for message in exc.messages
    )


def test_update_dashboard_skips_css_check_when_css_absent(
    mocker: MockerFixture,
) -> None:
    """A PUT payload that omits css entirely (a partial update) doesn't
    trigger the check at all."""
    _mock_dependencies(mocker, existing_css="@import url('https://evil.example.com');")

    UpdateDashboardCommand(1, {"dashboard_title": "Renamed"}).validate()


def _layout(*tab_ids: str) -> dict[str, object]:
    return {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": list(tab_ids)},
        **{
            tab: {"id": tab, "type": "TAB", "meta": {"text": tab}, "children": []}
            for tab in tab_ids
        },
    }


def test_process_tab_diff_reads_the_layout_from_json_metadata_positions(
    app_context: None,
) -> None:
    """The dashboard UI sends the layout in json_metadata, with no position_json."""
    command = UpdateDashboardCommand(
        1, {"json_metadata": json.dumps({"positions": _layout("TAB-1")})}
    )
    model = MagicMock()
    model.id = 1
    type(model).tabs = PropertyMock(
        return_value={"all_tabs": {"TAB-1": "Sales", "TAB-2": "Marketing Overview"}}
    )
    command._model = model  # noqa: SLF001
    report = _tab_report(10, 1, '["TAB-2"]')

    with (
        patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao,
        patch.object(UpdateDashboardCommand, "_send_deactivated_report_email") as send,
    ):
        report_dao.find_by_extra_metadata.return_value = [report]
        command.process_tab_diff()

    report_dao.find_by_extra_metadata.assert_called_once_with("TAB-2")
    report_dao.update.assert_called_once_with(report, {"active": False})
    send.assert_called_once()


def test_process_tab_diff_prefers_json_metadata_positions_over_position_json(
    app_context: None,
) -> None:
    command = UpdateDashboardCommand(
        1,
        {
            "position_json": json.dumps(_layout("TAB-1", "TAB-2")),
            "json_metadata": json.dumps({"positions": _layout("TAB-1")}),
        },
    )
    model = MagicMock()
    model.id = 1
    type(model).tabs = PropertyMock(
        return_value={"all_tabs": {"TAB-1": "a", "TAB-2": "b"}}
    )
    command._model = model  # noqa: SLF001

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = []
        command.process_tab_diff()

    report_dao.find_by_extra_metadata.assert_called_once_with("TAB-2")


def test_process_tab_diff_falls_back_to_position_json_for_null_positions(
    app_context: None,
) -> None:
    command = _tab_diff_command("TAB-1", "TAB-2")
    command._properties["json_metadata"] = json.dumps(  # noqa: SLF001
        {"positions": None}
    )

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = []
        command.process_tab_diff()

    report_dao.find_by_extra_metadata.assert_called_once_with("TAB-2")


def test_process_tab_diff_does_not_match_a_tab_id_prefix(app_context: None) -> None:
    """Deleting TAB-1 must not deactivate a report anchored to TAB-10."""
    command = _tab_diff_command("TAB-1", "TAB-10")
    command._properties["position_json"] = json.dumps(  # noqa: SLF001
        _layout("TAB-10")
    )
    anchored_to_tab_10 = _tab_report(10, 1, '["TAB-10"]')
    anchored_to_tab_1 = _tab_report(11, 1, '["TAB-1"]')
    bare_anchor = _tab_report(12, 1, "TAB-1")

    with patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao:
        report_dao.find_by_extra_metadata.return_value = [
            anchored_to_tab_10,
            anchored_to_tab_1,
            bare_anchor,
        ]
        command.process_tab_diff()

    updated = [call.args[0] for call in report_dao.update.call_args_list]
    assert updated == [anchored_to_tab_1, bare_anchor]


def _filters_command(
    payload: dict[str, object], stored_ids: list[str]
) -> UpdateDashboardNativeFiltersCommand:
    command = UpdateDashboardNativeFiltersCommand(1, payload)
    model = MagicMock()
    model.id = 1
    model.json_metadata = json.dumps(
        {"native_filter_configuration": [{"id": i} for i in stored_ids]}
    )
    command._model = model  # noqa: SLF001
    return command


def _run_filters_command(
    command: UpdateDashboardNativeFiltersCommand,
    reports: list[MagicMock],
) -> MagicMock:
    # The real DAO mutation runs so the diff sees what is actually stored.
    with (
        patch.object(UpdateDashboardCommand, "validate"),
        patch("superset.daos.dashboard.derive_metadata_scopes") as derive,
        patch("superset.commands.dashboard.update.ReportScheduleDAO") as report_dao,
        patch.object(UpdateDashboardCommand, "_send_deactivated_report_email"),
    ):
        derive.return_value = {"native_filter_configuration": []}
        report_dao.find_by_native_filter_id.return_value = reports
        command.run.__wrapped__(command)
    return report_dao


def test_native_filters_command_deactivates_reports_on_deleted_filters(
    app_context: None,
) -> None:
    command = _filters_command(
        {"deleted": ["NATIVE_FILTER-2"]}, ["NATIVE_FILTER-1", "NATIVE_FILTER-2"]
    )
    report = _filter_report(10, 1, "NATIVE_FILTER-2", values=["North America", "EMEA"])

    report_dao = _run_filters_command(command, [report])

    report_dao.find_by_native_filter_id.assert_called_once_with("NATIVE_FILTER-2")
    report_dao.update.assert_called_once_with(report, {"active": False})


def test_native_filters_command_ignores_ids_both_deleted_and_modified(
    app_context: None,
) -> None:
    """An id in both lists survives the update, so nothing is deactivated."""
    command = _filters_command(
        {"deleted": ["NATIVE_FILTER-2"], "modified": [{"id": "NATIVE_FILTER-2"}]},
        ["NATIVE_FILTER-1", "NATIVE_FILTER-2"],
    )

    report_dao = _run_filters_command(
        command, [_filter_report(10, 1, "NATIVE_FILTER-2")]
    )

    report_dao.update.assert_not_called()


def test_native_filters_command_deactivates_filters_dropped_by_reorder(
    app_context: None,
) -> None:
    """A reordered list omitting a filter drops it, even if not in deleted."""
    command = _filters_command(
        {"reordered": ["NATIVE_FILTER-1"]}, ["NATIVE_FILTER-1", "NATIVE_FILTER-2"]
    )
    report = _filter_report(10, 1, "NATIVE_FILTER-2")

    report_dao = _run_filters_command(command, [report])

    report_dao.find_by_native_filter_id.assert_called_once_with("NATIVE_FILTER-2")
    report_dao.update.assert_called_once_with(report, {"active": False})


def test_native_filter_match_is_exact_not_a_substring(app_context: None) -> None:
    """A filter id inside a filterValues string, or another dashboard, is no match."""
    command = _filters_command(
        {"deleted": ["NATIVE_FILTER-2"]}, ["NATIVE_FILTER-1", "NATIVE_FILTER-2"]
    )
    mentions_only_in_value = _filter_report(
        10, 1, "NATIVE_FILTER-1", values=["see NATIVE_FILTER-2 for details"]
    )
    other_dashboard = _filter_report(11, 2, "NATIVE_FILTER-2")

    report_dao = _run_filters_command(
        command, [mentions_only_in_value, other_dashboard]
    )

    report_dao.update.assert_not_called()
