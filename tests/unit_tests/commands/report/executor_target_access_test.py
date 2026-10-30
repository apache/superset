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
"""
Tests that a report's target is checked as the identity the report runs as,
both when the schedule is saved and when it executes.
"""

from datetime import datetime
from typing import Any
from unittest.mock import Mock
from uuid import uuid4

import pytest
from flask import g
from pytest_mock import MockerFixture

from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.commands.report.create import CreateReportScheduleCommand
from superset.commands.report.exceptions import (
    ReportScheduleExecutorAccessDeniedError,
    ReportScheduleExecutorTargetAccessError,
    ReportScheduleInvalidError,
)
from superset.commands.report.execute import (
    AsyncExecuteReportScheduleCommand,
    BaseReportState,
)
from superset.commands.report.update import UpdateReportScheduleCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.reports.models import (
    ReportDataFormat,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.tasks.types import FixedExecutor

SPECIFIC_REASON = "Dashboard is in a folder the executor cannot read."


def _user(user_id: int, username: str, active: bool = True) -> Mock:
    user = Mock()
    user.id = user_id
    user.username = username
    user.is_active = active
    user.is_anonymous = False
    return user


SAVER = _user(1, "saver")
MACHINE = _user(2, "machine")


def _denial() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
            message=SPECIFIC_REASON,
            level=ErrorLevel.WARNING,
        )
    )


def _raise_for_access_denying(*denied: Mock) -> Any:
    def raise_for_access(**kwargs: Any) -> None:
        if getattr(g, "user", None) in denied:
            raise _denial()

    return raise_for_access


def _excluded_for(*withheld_from: Mock) -> Any:
    """An ``is_excluded_by_extra_access`` stand-in withholding "dashboards"."""

    def is_excluded(asset_kind: str, id_value: int) -> bool:
        return asset_kind == "dashboards" and getattr(g, "user", None) in withheld_from

    return is_excluded


# ---------------------------------------------------------------------------
# Save time
# ---------------------------------------------------------------------------


def _stub_create(
    mocker: MockerFixture,
    *,
    dashboard: Any,
    is_admin: bool = False,
    dynamic_executor: bool = False,
) -> Mock:
    mocker.patch.object(CreateReportScheduleCommand, "_populate_recipients")
    mocker.patch(
        "superset.commands.report.create.ReportScheduleDAO.validate_update_uniqueness",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.report.create.ReportScheduleDAO.validate_unique_creation_method",
        return_value=True,
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_report_frequency")
    mocker.patch.object(CreateReportScheduleCommand, "_validate_report_extra")
    mocker.patch.object(CreateReportScheduleCommand, "validate_recipients_policy")
    mocker.patch("superset.commands.report.create.populate_subjects")
    mocker.patch(
        "superset.commands.report.create.is_feature_enabled",
        return_value=dynamic_executor,
    )
    mocker.patch(
        "superset.commands.report.base.is_feature_enabled",
        return_value=dynamic_executor,
        create=True,
    )

    def validate_chart_dashboard(
        self: CreateReportScheduleCommand, exceptions: list[Any], update: bool = False
    ) -> None:
        self._properties["dashboard"] = dashboard

    mocker.patch.object(
        CreateReportScheduleCommand,
        "validate_chart_dashboard",
        validate_chart_dashboard,
    )

    security_manager = Mock()
    security_manager.is_admin.return_value = is_admin
    security_manager.find_user.side_effect = {"machine": MACHINE, "saver": SAVER}.get
    security_manager.get_user_by_id.side_effect = {1: SAVER, 2: MACHINE}.get
    security_manager.raise_for_access.side_effect = _raise_for_access_denying(MACHINE)
    mocker.patch("superset.commands.report.base.security_manager", security_manager)
    mocker.patch("superset.commands.report.base.get_user", return_value=SAVER)
    return security_manager


def _create_command(**overrides: Any) -> CreateReportScheduleCommand:
    return CreateReportScheduleCommand(
        {
            "type": ReportScheduleType.REPORT,
            "name": "Daily",
            "crontab": "0 9 * * *",
            "creation_method": "alerts_reports",
            "report_format": ReportDataFormat.PNG,
            "dashboard": 7,
            **overrides,
        }
    )


def test_create_rejects_legacy_executor_without_target_access(
    mocker: MockerFixture, app: Any
) -> None:
    """The saver can read the dashboard but the configured executor cannot."""
    dashboard = Mock()
    _stub_create(mocker, dashboard=dashboard)
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )

    with app.test_request_context():
        g.user = SAVER
        with pytest.raises(ReportScheduleInvalidError) as exc:
            _create_command().validate()

    errors = exc.value._exceptions
    assert [type(error) for error in errors] == [
        ReportScheduleExecutorTargetAccessError
    ]
    # A non-admin saver must not learn the legacy machine account's name.
    assert "machine" not in str(errors[0].messages)
    assert errors[0].field_name == "dashboard"


def test_create_names_executor_to_admin(mocker: MockerFixture, app: Any) -> None:
    """An admin configured the executor and is told which user it is."""
    _stub_create(mocker, dashboard=Mock(), is_admin=True)
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )

    with app.test_request_context():
        g.user = SAVER
        with pytest.raises(ReportScheduleInvalidError) as exc:
            _create_command().validate()

    assert '"machine"' in str(exc.value._exceptions[0].messages)


def test_create_rejects_run_as_user_without_target_access(
    mocker: MockerFixture, app: Any
) -> None:
    """An admin-chosen "Run As" user must be able to read the dashboard."""
    _stub_create(mocker, dashboard=Mock(), is_admin=True, dynamic_executor=True)

    with app.test_request_context():
        g.user = SAVER
        with pytest.raises(ReportScheduleInvalidError) as exc:
            _create_command(run_as=MACHINE.id).validate()

    assert [type(error) for error in exc.value._exceptions] == [
        ReportScheduleExecutorTargetAccessError
    ]


@pytest.mark.parametrize(
    "overrides",
    [
        # A paused schedule never executes.
        {"active": False},
        # An alert without an attachment never renders its target.
        {"type": ReportScheduleType.ALERT, "report_format": ReportDataFormat.NONE},
    ],
)
def test_create_skips_check_when_target_is_never_rendered(
    mocker: MockerFixture, app: Any, overrides: dict[str, Any]
) -> None:
    security_manager = _stub_create(mocker, dashboard=Mock())
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )

    with app.test_request_context():
        g.user = SAVER
        _create_command(database=1, **overrides).validate()

    security_manager.raise_for_access.assert_not_called()


@pytest.mark.parametrize(
    "executors",
    [
        # The executor can read the dashboard.
        [FixedExecutor("saver")],
        # No executor resolves at save time: execution reports that error.
        [FixedExecutor("deleted")],
    ],
)
def test_create_accepts_executor_with_access_or_unresolved(
    mocker: MockerFixture, app: Any, executors: list[Any]
) -> None:
    _stub_create(mocker, dashboard=Mock())
    mocker.patch.dict(app.config, {"ALERT_REPORTS_EXECUTORS": executors})

    with app.test_request_context():
        g.user = SAVER
        _create_command().validate()


def test_create_rejects_executor_withheld_by_extra_access_exclusions(
    mocker: MockerFixture, app: Any
) -> None:
    """
    ``raise_for_access`` does not consult ``EXTRA_ACCESS_QUERY_EXCLUSIONS``, yet
    resolving the dashboard as the executor does, so an executor the hook
    withholds the dashboard from can never deliver.
    """
    security_manager = _stub_create(mocker, dashboard=Mock(id=7))
    security_manager.raise_for_access.side_effect = None
    mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )

    with app.test_request_context():
        g.user = SAVER
        with pytest.raises(ReportScheduleInvalidError) as exc:
            _create_command().validate()

    errors = exc.value._exceptions
    assert [type(error) for error in errors] == [
        ReportScheduleExecutorTargetAccessError
    ]
    assert errors[0].field_name == "dashboard"
    assert "machine" not in str(errors[0].messages)


def test_create_accepts_executor_not_withheld_by_extra_access_exclusions(
    mocker: MockerFixture, app: Any
) -> None:
    security_manager = _stub_create(mocker, dashboard=Mock(id=7))
    security_manager.raise_for_access.side_effect = None
    mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        side_effect=_excluded_for(SAVER),
    )
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )

    with app.test_request_context():
        g.user = SAVER
        _create_command().validate()


def _update_command(
    mocker: MockerFixture,
    *,
    stored_dashboard: Any,
    properties: dict[str, Any],
    active: bool = True,
) -> UpdateReportScheduleCommand:
    model = Mock()
    model.chart = None
    model.chart_id = None
    model.dashboard = stored_dashboard
    model.dashboard_id = getattr(stored_dashboard, "id", None)
    model.type = ReportScheduleType.REPORT
    model.report_format = ReportDataFormat.PNG
    model.active = active
    model.run_as_type = None
    model.run_as = None
    model.created_by = SAVER
    model.changed_by = SAVER
    model.editors = []
    command = UpdateReportScheduleCommand(model.id, properties)
    command._model = model
    return command


def _stub_update_security(mocker: MockerFixture, app: Any) -> Mock:
    security_manager = Mock()
    security_manager.is_admin.return_value = False
    security_manager.find_user.side_effect = {"machine": MACHINE, "saver": SAVER}.get
    security_manager.raise_for_access.side_effect = _raise_for_access_denying(MACHINE)
    mocker.patch("superset.commands.report.base.security_manager", security_manager)
    mocker.patch("superset.commands.report.base.get_user", return_value=SAVER)
    mocker.patch("superset.commands.report.base.is_feature_enabled", return_value=False)
    mocker.patch.dict(
        app.config, {"ALERT_REPORTS_EXECUTORS": [FixedExecutor("machine")]}
    )
    return security_manager


def test_update_rejects_new_target_executor_cannot_access(
    mocker: MockerFixture, app: Any
) -> None:
    _stub_update_security(mocker, app)
    stored, submitted = Mock(id=7), Mock(id=8)
    command = _update_command(
        mocker, stored_dashboard=stored, properties={"dashboard": submitted}
    )

    exceptions: list[Any] = []
    with app.test_request_context():
        command.validate_executor_target_access(exceptions)

    assert [type(error) for error in exceptions] == [
        ReportScheduleExecutorTargetAccessError
    ]


def test_update_rejects_resuming_schedule_executor_cannot_access(
    mocker: MockerFixture, app: Any
) -> None:
    _stub_update_security(mocker, app)
    stored = Mock(id=7)
    command = _update_command(
        mocker,
        stored_dashboard=stored,
        properties={"active": True, "dashboard": stored},
        active=False,
    )

    exceptions: list[Any] = []
    with app.test_request_context():
        command.validate_executor_target_access(exceptions)

    assert [type(error) for error in exceptions] == [
        ReportScheduleExecutorTargetAccessError
    ]


def test_update_rejects_new_target_withheld_from_executor_by_exclusions(
    mocker: MockerFixture, app: Any
) -> None:
    security_manager = _stub_update_security(mocker, app)
    security_manager.raise_for_access.side_effect = None
    mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    stored, submitted = Mock(id=7), Mock(id=8)
    command = _update_command(
        mocker, stored_dashboard=stored, properties={"dashboard": submitted}
    )

    exceptions: list[Any] = []
    with app.test_request_context():
        command.validate_executor_target_access(exceptions)

    assert [type(error) for error in exceptions] == [
        ReportScheduleExecutorTargetAccessError
    ]


def test_update_rechecks_when_target_kind_changes_but_id_matches(
    mocker: MockerFixture, app: Any
) -> None:
    _stub_update_security(mocker, app)
    stored_chart, submitted_dashboard = Mock(id=7), Mock(id=7)
    command = _update_command(
        mocker,
        stored_dashboard=None,
        properties={"chart": None, "dashboard": submitted_dashboard},
    )
    model = command._model
    assert model is not None
    model.chart = stored_chart
    model.chart_id = stored_chart.id
    model.dashboard = None
    model.dashboard_id = None

    exceptions: list[Any] = []
    with app.test_request_context():
        command.validate_executor_target_access(exceptions)

    assert [type(error) for error in exceptions] == [
        ReportScheduleExecutorTargetAccessError
    ]


@pytest.mark.parametrize(
    "properties",
    [
        # Pausing an already-broken schedule must always be possible.
        {"active": False},
        # The modal resends the unchanged target with a metadata-only edit.
        {"name": "Renamed", "dashboard": "stored"},
    ],
)
def test_update_does_not_trap_an_already_broken_schedule(
    mocker: MockerFixture, app: Any, properties: dict[str, Any]
) -> None:
    security_manager = _stub_update_security(mocker, app)
    stored = Mock(id=7)
    if properties.get("dashboard") == "stored":
        properties = {**properties, "dashboard": stored}
    command = _update_command(mocker, stored_dashboard=stored, properties=properties)

    exceptions: list[Any] = []
    with app.test_request_context():
        command.validate_executor_target_access(exceptions)

    assert exceptions == []
    security_manager.raise_for_access.assert_not_called()


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


def _dashboard_report() -> ReportSchedule:
    return ReportSchedule(
        id=11,
        name="Daily",
        type=ReportScheduleType.REPORT,
        report_format=ReportDataFormat.PNG,
        dashboard_id=7,
        last_state=ReportState.NOOP,
    )


def test_precommit_access_denial_is_terminalized_by_the_state_machine(
    mocker: MockerFixture, app_context: None
) -> None:
    """
    An executor that cannot build the dashboard permalink must not abort the
    execution before it is claimed: that path writes no log row, changes no
    state and notifies no one. The state machine, which records failures,
    must still run.
    """
    from superset.commands.report.execution_claim import ExecutionClaim

    command = AsyncExecuteReportScheduleCommand(str(uuid4()), 11, datetime.utcnow())
    command._model = _dashboard_report()
    mocker.patch.object(command, "validate")
    mocker.patch(
        "superset.commands.report.execute._should_build_execution_context",
        return_value=False,
    )
    mocker.patch(
        "superset.commands.report.execute.get_executor_user",
        return_value=(MACHINE, "machine"),
    )
    denial = DashboardAccessDeniedError()
    denial.__cause__ = _denial()
    mocker.patch.object(BaseReportState, "get_dashboard_urls", side_effect=denial)
    claim = mocker.patch(
        "superset.commands.report.execute.claim_execution",
        return_value=ExecutionClaim(ReportState.NOOP),
    )
    machine = mocker.patch(
        "superset.commands.report.execute.ReportScheduleStateMachine"
    )

    command.run()

    claim.assert_called_once()
    machine.return_value.run.assert_called_once()


def _state(mocker: MockerFixture, dashboard_state: dict[str, Any] | None) -> Any:
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.id = 11
    schedule.name = "Daily"
    schedule.type = ReportScheduleType.REPORT
    schedule.chart = None
    schedule.chart_id = None
    schedule.dashboard_id = 7
    schedule.dashboard = mocker.Mock(id=7, uuid="dashboard-uuid")
    schedule.force_screenshot = False
    schedule.extra = {"dashboard": dashboard_state} if dashboard_state else {}
    schedule.get_native_filters_params.return_value = ("()", [])
    schedule.editors = []
    schedule.recipients = []
    return BaseReportState(schedule, datetime.utcnow(), uuid4())


def test_plain_dashboard_url_reports_executor_and_reason(
    mocker: MockerFixture, app: Any
) -> None:
    """
    A plain dashboard URL would load as the not-found page for the executor
    and fail as a generic screenshot error; fail with the actual reason.
    """
    mocker.patch(
        "superset.commands.report.execute.security_manager.raise_for_access",
        side_effect=_raise_for_access_denying(MACHINE),
    )
    state = _state(mocker, None)

    with app.test_request_context():
        g.user = MACHINE
        with pytest.raises(ReportScheduleExecutorAccessDeniedError) as exc:
            state.get_dashboard_urls()

    assert '"machine"' in str(exc.value)
    assert SPECIFIC_REASON in str(exc.value)


def test_plain_dashboard_url_rejects_dashboard_withheld_by_exclusions(
    mocker: MockerFixture, app: Any
) -> None:
    """
    An executor the exclusion hook withholds the dashboard from passes
    ``raise_for_access`` but renders the not-found page; name the cause.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    state = _state(mocker, None)

    with app.test_request_context():
        g.user = MACHINE
        with pytest.raises(ReportScheduleExecutorAccessDeniedError) as exc:
            state.get_dashboard_urls()

    assert '"machine"' in str(exc.value)


@pytest.mark.parametrize(
    "dashboard_state",
    [
        # A single selected tab.
        {"anchor": "TAB-1"},
        # Several selected tabs.
        {"anchor": '["TAB-1", "TAB-2"]'},
    ],
)
def test_tab_urls_reject_dashboard_withheld_by_exclusions_before_permalink(
    mocker: MockerFixture, app: Any, dashboard_state: dict[str, Any]
) -> None:
    """
    The permalink command resolves the dashboard through the DAO, which raises
    ``DashboardNotFoundError`` for a withheld id. That is neither handled by the
    pre-claim permalink step nor recorded by the state machine, so the denial
    has to be raised, as the access-denied error, before the command runs.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    permalink = mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        side_effect=DashboardNotFoundError(),
    )
    state = _state(mocker, dashboard_state)

    with app.test_request_context():
        g.user = MACHINE
        with pytest.raises(ReportScheduleExecutorAccessDeniedError):
            state.get_dashboard_urls()

    permalink.assert_not_called()


def test_dashboard_urls_build_when_exclusions_do_not_withhold_it(
    mocker: MockerFixture, app: Any
) -> None:
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(SAVER),
    )
    state = _state(mocker, None)

    with app.test_request_context():
        g.user = MACHINE
        assert state.get_dashboard_urls()


def test_get_dashboard_urls_without_executor_skips_access_check(
    mocker: MockerFixture, app: Any
) -> None:
    raise_for_access = mocker.patch(
        "superset.commands.report.execute.security_manager.raise_for_access"
    )
    state = _state(mocker, None)

    with app.test_request_context():
        g.user = None
        assert state.get_dashboard_urls()

    raise_for_access.assert_not_called()


def test_permalink_denial_carries_specific_reason(
    mocker: MockerFixture, app: Any
) -> None:
    """
    The DAO keeps its generic message for every requester; the report
    recovers the specific reason from the denial's cause.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    denial = DashboardAccessDeniedError()
    denial.__cause__ = _denial()
    mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        side_effect=denial,
    )
    state = _state(mocker, {"anchor": "TAB-1"})

    with app.test_request_context():
        g.user = MACHINE
        with pytest.raises(ReportScheduleExecutorAccessDeniedError) as exc:
            state._get_tab_url({"anchor": "TAB-1"})

    assert '"machine"' in str(exc.value)
    assert SPECIFIC_REASON in str(exc.value)


def test_failure_notification_links_plain_dashboard_when_permalink_denied(
    mocker: MockerFixture, app: Any
) -> None:
    """
    The editors' failure notification must still be sent when the stateful
    link it would carry is the permalink the executor cannot create.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        side_effect=DashboardAccessDeniedError(),
    )
    state = _state(mocker, {"anchor": "TAB-1"})
    mocker.patch.object(state, "_get_log_data", return_value={})
    send = mocker.patch.object(state, "_send")

    with app.test_request_context():
        g.user = MACHINE
        state.send_error("Error occurred for report: Daily", "denied")

    content = send.call_args.args[0]
    assert content.text == "denied"
    assert content.url.endswith("/dashboard/dashboard-uuid/?force=false")


def test_failure_notification_links_plain_dashboard_when_dashboard_withheld(
    mocker: MockerFixture, app: Any
) -> None:
    """
    An executor the exclusion hook withholds the dashboard from makes the
    permalink command answer with ``DashboardNotFoundError``. The failure
    notification still has to go out, linking the dashboard itself.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    permalink = mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        side_effect=DashboardNotFoundError(),
    )
    state = _state(mocker, {"anchor": "TAB-1"})
    mocker.patch.object(state, "_get_log_data", return_value={})
    send = mocker.patch.object(state, "_send")

    with app.test_request_context():
        g.user = MACHINE
        state.send_error("Error occurred for report: Daily", "withheld")

    content = send.call_args.args[0]
    assert content.text == "withheld"
    assert content.url.endswith("/dashboard/dashboard-uuid/?force=false")
    permalink.assert_not_called()


def test_get_url_rejects_dashboard_withheld_by_exclusions_before_permalink(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Content generation reaches the stored-state permalink through ``_get_url``
    rather than ``get_dashboard_urls``; the exclusion has to surface there as
    the access-denied error too.
    """
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(MACHINE),
    )
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    permalink = mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        side_effect=DashboardNotFoundError(),
    )
    state = _state(mocker, {"anchor": "TAB-1"})

    with app.test_request_context():
        g.user = MACHINE
        with pytest.raises(ReportScheduleExecutorAccessDeniedError):
            state._get_url(user_friendly=True)

    permalink.assert_not_called()


def test_get_tab_url_builds_permalink_when_exclusions_do_not_withhold_it(
    mocker: MockerFixture, app: Any
) -> None:
    mocker.patch("superset.commands.report.execute.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.report.execute.is_excluded_by_extra_access",
        side_effect=_excluded_for(SAVER),
    )
    permalink = mocker.patch(
        "superset.commands.report.execute.CreateDashboardPermalinkCommand.run",
        return_value="permalink-key",
    )
    mocker.patch("superset.commands.report.execute.db.session.commit")
    state = _state(mocker, {"anchor": "TAB-1"})

    with app.test_request_context():
        g.user = MACHINE
        url = state._get_tab_url({"anchor": "TAB-1"})

    permalink.assert_called_once()
    assert "permalink-key" in url


def test_executor_access_denial_is_logged_and_not_retried(
    mocker: MockerFixture,
) -> None:
    """The state machine records the denial and notifies the editors."""
    from superset.commands.report.execute import ReportNotTriggeredErrorState

    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.type = ReportScheduleType.REPORT
    schedule.name = "Daily"
    schedule.last_state = ReportState.NOOP
    schedule.retry_on_failure = True
    schedule.retry_attempt = 0
    schedule.retry_max_attempts = 3
    state = ReportNotTriggeredErrorState(schedule, datetime.utcnow(), uuid4())
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    error = ReportScheduleExecutorAccessDeniedError(
        "dashboard", "machine", SPECIFIC_REASON
    )
    mocker.patch.object(state, "send", side_effect=error)
    log = mocker.patch.object(state, "update_report_schedule_and_log")
    mocker.patch.object(state, "_reset_retry_counter")
    retry = mocker.patch.object(state, "_schedule_retry", create=True)
    mocker.patch.object(state, "is_in_error_grace_period", return_value=False)
    send_error = mocker.patch.object(state, "send_error")
    mocker.patch.object(state, "create_log")

    with pytest.raises(ReportScheduleExecutorAccessDeniedError):
        state.next()

    assert log.call_args_list[-1].args[0] == ReportState.ERROR
    message = log.call_args_list[-1].kwargs["error_message"]
    assert '"machine"' in message
    assert SPECIFIC_REASON in message
    assert SPECIFIC_REASON in send_error.call_args.args[1]
    retry.assert_not_called()
