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

from contextlib import nullcontext
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session

from superset.commands.dashboard.exceptions import DashboardInvalidError
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


@pytest.mark.parametrize(
    "change",
    [
        "remove_parent",
        "change_cycle",
        "add_filter",
        "unchanged",
        "no_snapshot",
        "null_metadata",
        "empty_metadata",
    ],
)
def test_native_filters_reject_concurrent_metadata_change(
    app_context: None, change: str
) -> None:
    """A stale filter payload must not overwrite a concurrent committed edit."""
    from superset.commands.dashboard.exceptions import (
        DashboardNativeFiltersUpdateFailedError,
    )
    from superset.commands.dashboard.update import UpdateDashboardNativeFiltersCommand

    class TestBase(DeclarativeBase):
        """Isolated schema for exercising real SQL snapshot checks."""

    class StoredDashboard(TestBase):
        """Minimal persisted dashboard metadata, without application fixtures."""

        __tablename__ = "dashboards"
        id: Mapped[int] = mapped_column(primary_key=True)
        json_metadata: Mapped[str | None] = mapped_column()

    engine = create_engine("sqlite://")
    TestBase.metadata.create_all(engine)
    original: str | None = json.dumps(
        {
            "native_filter_configuration": [
                {"id": "parent"},
                {"id": "child", "cascadeParentIds": []},
            ]
        }
    )
    configs = {
        "remove_parent": [{"id": "child", "cascadeParentIds": []}],
        "change_cycle": [
            {"id": "parent", "cascadeParentIds": ["child"]},
            {"id": "child"},
        ],
        "add_filter": [{"id": "parent"}, {"id": "child"}, {"id": "new"}],
    }
    conflict = change in configs
    if change == "null_metadata":
        original = None
    elif change == "empty_metadata":
        original = ""
    concurrent = (
        json.dumps({"native_filter_configuration": configs[change]})
        if conflict
        else original
    )
    with Session(engine) as session:
        stored = StoredDashboard(id=1, json_metadata=original)
        session.add(stored)
        session.commit()
        # The tool has validated a request against `original`. Another writer
        # commits before its command runs; the identity-map object stays stale.
        session.refresh(stored)
        session.query(StoredDashboard).filter_by(id=1).update(
            {"json_metadata": concurrent}, synchronize_session=False
        )
        session.commit()
        stored.json_metadata = original
        command = UpdateDashboardNativeFiltersCommand(
            1,
            {"modified": [{"id": "child", "cascadeParentIds": ["parent"]}]},
        )
        command._expected_metadata = (  # noqa: SLF001
            None if change == "no_snapshot" else original or ""
        )
        command._model = stored  # noqa: SLF001

        def update_config(*args: object) -> list[dict[str, object]]:
            """Stage the validated payload and trigger a possible autoflush."""
            stored.json_metadata = json.dumps(
                {
                    "native_filter_configuration": [
                        {"id": "parent"},
                        {"id": "child", "cascadeParentIds": ["parent"]},
                    ]
                }
            )
            session.query(StoredDashboard).count()
            return []

        with (
            patch("superset.commands.dashboard.update.db.session", session),
            patch("superset.commands.dashboard.update.Dashboard", StoredDashboard),
            patch.object(UpdateDashboardCommand, "validate"),
            patch(
                "superset.commands.dashboard.update.DashboardDAO.update_native_filters_config",
                side_effect=update_config,
            ),
            pytest.raises(
                DashboardNativeFiltersUpdateFailedError, match="changed.*retry"
            )
            if conflict
            else nullcontext(),
        ):
            UpdateDashboardNativeFiltersCommand.run.__wrapped__(command)
        if conflict:
            session.rollback()
        else:
            session.commit()
        session.expire_all()
        reloaded = session.get(StoredDashboard, 1)
        assert reloaded is not None
        persisted = reloaded.json_metadata
        if conflict:
            assert persisted == concurrent
        else:
            assert persisted is not None
            assert json.loads(persisted)["native_filter_configuration"][1][
                "cascadeParentIds"
            ] == ["parent"]
    engine.dispose()
