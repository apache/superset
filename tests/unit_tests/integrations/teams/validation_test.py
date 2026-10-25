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
"""Teams save-time rules, merged updates, and existing execution-path regressions."""

from __future__ import annotations

from collections.abc import Iterator
from copy import deepcopy
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import call, MagicMock
from uuid import uuid4

import pytest
from flask import current_app, Flask

from superset.commands.report import create, execute, update
from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import ReportScheduleInvalidError
from superset.integrations.teams import validation
from superset.integrations.teams.store import TeamsInstallationStore
from superset.reports.models import (
    ReportRecipients,
    ReportRecipientType,
    ReportScheduleType,
    ReportState,
)
from superset.reports.notifications.exceptions import NotificationTransientError
from superset.utils import json

TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


@pytest.fixture
def configured_app(
    teams_config: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> Iterator[Flask]:
    """Enable a single approved destination without requiring any installation."""
    app = Flask(__name__)
    app.config.update(
        FEATURE_FLAGS={"ALERT_REPORT_TEAMS": True},
        ALERT_REPORTS_TEAMS=teams_config,
    )
    monkeypatch.setattr(
        validation.feature_flag_manager,
        "is_feature_enabled",
        lambda name: current_app.config["FEATURE_FLAGS"].get(name, False),
    )
    with app.app_context():
        yield app


def teams_recipient(config: object = None, *, saved: bool = False) -> Any:
    """Represent either command input or an existing recipient ORM object."""
    config = {"target": "ops"} if config is None else config
    if saved:
        return ReportRecipients(
            type=ReportRecipientType.TEAMS, recipient_config_json=json.dumps(config)
        )
    return {"type": ReportRecipientType.TEAMS, "recipient_config_json": config}


@pytest.mark.parametrize("serialized", [False, True])
def test_shared_validation_accepts_command_and_saved_recipient(
    configured_app: Flask, serialized: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    lookup = MagicMock(
        side_effect=AssertionError("save-time validation must not query installations")
    )
    monkeypatch.setattr(TeamsInstallationStore, "get_active", lookup)
    recipient = json.dumps({"target": "ops"}) if serialized else {"target": "ops"}
    before = deepcopy(configured_app.config["ALERT_REPORTS_TEAMS"])
    config, destination = validation.validate_teams_recipient(
        recipient, "Alert", "NONE"
    )
    assert config.tenant_id == TENANT
    assert destination.key == "ops"
    assert configured_app.config["ALERT_REPORTS_TEAMS"] == before
    lookup.assert_not_called()


@pytest.mark.parametrize(
    "mode,field",
    [
        ("disabled", "recipients"),
        ("unconfigured", "recipients"),
        ("invalid-config", "recipients"),
        ("report", "type"),
        ("png", "report_format"),
        ("pdf", "report_format"),
        ("missing-format", "report_format"),
        ("unknown", "recipients"),
        ("malformed", "recipients"),
        ("extra-fields", "recipients"),
    ],
)
def test_shared_validation_rejects_invalid_combinations(
    configured_app: Flask, mode: str, field: str
) -> None:
    recipient: object = {"target": "ops"}
    schedule_type = "Alert"
    report_format = "NONE"
    if mode == "disabled":
        configured_app.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
    elif mode == "unconfigured":
        configured_app.config["ALERT_REPORTS_TEAMS"] = {}
    elif mode == "invalid-config":
        configured_app.config["ALERT_REPORTS_TEAMS"] = {
            "credential": "private-credential"
        }
    elif mode == "report":
        schedule_type = "Report"
    elif mode in {"png", "pdf", "missing-format"}:
        report_format = {"png": "PNG", "pdf": "PDF", "missing-format": ""}[mode]
    elif mode == "unknown":
        recipient = {"target": "unapproved"}
    elif mode == "malformed":
        recipient = "{private-credential"
    else:
        recipient = {"target": "ops", "credential": "private-credential"}
    with pytest.raises(validation.TeamsRecipientValidationError) as exc:
        validation.validate_teams_recipient(recipient, schedule_type, report_format)
    assert exc.value.field == field
    assert "private-credential" not in str(exc.value)


@pytest.fixture
def command_dependencies(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub unrelated DAO, editorship, SQL, and executor rules; run real validation."""
    for module in (create, update):
        monkeypatch.setattr(module, "is_feature_enabled", lambda name: False)
        monkeypatch.setattr(module, "ReportScheduleDAO", MagicMock())
        module.ReportScheduleDAO.validate_update_uniqueness.return_value = True
        module.ReportScheduleDAO.validate_unique_creation_method.return_value = True
        monkeypatch.setattr(module, "DatabaseDAO", MagicMock())
        module.DatabaseDAO.find_by_id.return_value = SimpleNamespace(id=1)
    monkeypatch.setattr(create, "populate_subjects", MagicMock())
    monkeypatch.setattr(update, "compute_subjects", MagicMock())
    monkeypatch.setattr(
        update, "security_manager", SimpleNamespace(raise_for_editorship=MagicMock())
    )
    for method in (
        "validate_alert_query",
        "validate_chart_dashboard",
        "validate_report_frequency",
        "_validate_report_extra",
        "validate_recipients_policy",
    ):
        monkeypatch.setattr(BaseReportScheduleCommand, method, MagicMock())
    monkeypatch.setattr(
        create.CreateReportScheduleCommand, "_validate_executors", MagicMock()
    )
    monkeypatch.setattr(
        update.UpdateReportScheduleCommand, "_validate_executors", MagicMock()
    )
    monkeypatch.setattr(
        update.UpdateReportScheduleCommand, "_validate_attachment_executor", MagicMock()
    )


def create_command(**changes: Any) -> create.CreateReportScheduleCommand:
    """Build a complete attachment-free alert request."""
    return create.CreateReportScheduleCommand(
        {
            "type": "Alert",
            "report_format": "NONE",
            "name": "Operations alert",
            "crontab": "0 9 * * *",
            "database": 1,
            "creation_method": "alerts_reports",
            "recipients": [teams_recipient()],
            **changes,
        }
    )


def saved_schedule(**changes: Any) -> SimpleNamespace:
    """Supply the persisted fields used when PUT omits recipients/type/format."""
    return SimpleNamespace(
        **{
            "active": True,
            "type": "Alert",
            "report_format": "NONE",
            "name": "Operations alert",
            "crontab": "0 9 * * *",
            "database_id": 1,
            "database": SimpleNamespace(id=1),
            "sql": "SELECT 1",
            "validator_type": "not null",
            "validator_config_json": "{}",
            "creation_method": "alerts_reports",
            "last_state": "Success",
            "recipients": [teams_recipient(saved=True)],
            "editors": [],
            "chart_id": None,
            "dashboard_id": None,
            "dashboard": None,
            "extra_json": None,
            "run_as": None,
            "run_as_type": None,
            "run_alert_query_as": None,
            "run_alert_query_as_type": None,
            "retry_on_failure": False,
            "send_failed_reports": False,
            **changes,
        }
    )


def validate_update(
    model: SimpleNamespace, changes: dict[str, Any]
) -> update.UpdateReportScheduleCommand:
    """Run the real update validator with saved values and submitted changes."""
    cast(MagicMock, update.ReportScheduleDAO.find_by_id).return_value = model
    command = update.UpdateReportScheduleCommand(1, changes)
    command.validate()
    return command


def test_create_valid_teams_alert_without_installation(
    configured_app: Flask, command_dependencies: None
) -> None:
    command = create_command()
    command.validate()
    assert command._properties["recipients"] == [teams_recipient()]


@pytest.mark.parametrize("updating", [False, True])
@pytest.mark.parametrize("duplicate", [False, True])
def test_teams_destination_keys_must_be_unique(
    configured_app: Flask,
    command_dependencies: None,
    updating: bool,
    duplicate: bool,
) -> None:
    destinations = configured_app.config["ALERT_REPORTS_TEAMS"]["destinations"]
    destinations.append(
        {**destinations[0], "key": "finance", "channel_id": "channel-2"}
    )
    recipients = [
        teams_recipient(),
        teams_recipient({"target": "ops" if duplicate else "finance"}),
    ]

    def validate() -> None:
        if updating:
            validate_update(saved_schedule(), {"recipients": recipients})
        else:
            create_command(recipients=recipients).validate()

    if duplicate:
        with pytest.raises(ReportScheduleInvalidError) as exc:
            validate()
        assert "Teams destination keys must be unique" in str(
            exc.value.normalized_messages()
        )
    else:
        validate()


@pytest.mark.parametrize("changes", [{"active": False}, {"description": "Updated"}])
def test_existing_duplicate_teams_recipients_allow_metadata_edits(
    configured_app: Flask, command_dependencies: None, changes: dict[str, Any]
) -> None:
    model = saved_schedule(
        recipients=[teams_recipient(saved=True), teams_recipient(saved=True)]
    )
    validate_update(
        model, {**changes, "recipients": [teams_recipient(), teams_recipient()]}
    )


def test_reactivating_saved_duplicate_teams_recipients_is_rejected(
    configured_app: Flask, command_dependencies: None
) -> None:
    model = saved_schedule(
        active=False,
        recipients=[teams_recipient(saved=True), teams_recipient(saved=True)],
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        validate_update(model, {"active": True})
    assert "Teams destination keys must be unique" in str(
        exc.value.normalized_messages()
    )


def test_create_must_explicitly_disable_default_attachments(
    configured_app: Flask, command_dependencies: None
) -> None:
    command = create_command()
    command._properties.pop("report_format")
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()
    assert "report_format" in exc.value.normalized_messages()


@pytest.mark.parametrize(
    "changes,field",
    [
        ({"report_format": "PNG"}, "report_format"),
        ({"report_format": "PDF"}, "report_format"),
        ({"type": "Report", "database": None, "report_format": "PNG"}, "type"),
        ({"recipients": [teams_recipient({"target": "unknown"})]}, "recipients"),
    ],
)
def test_create_command_applies_shared_recipient_rules(
    configured_app: Flask,
    command_dependencies: None,
    changes: dict[str, Any],
    field: str,
) -> None:
    with pytest.raises(ReportScheduleInvalidError) as exc:
        create_command(**changes).validate()
    assert field in exc.value.normalized_messages()


@pytest.mark.parametrize(
    "changes,field",
    [
        ({"report_format": "PNG"}, "report_format"),
        ({"report_format": "CSV"}, "report_format"),
        ({"type": "Report"}, "type"),
        ({"type": "Report", "report_format": "PNG", "database": None}, "type"),
    ],
)
def test_partial_update_checks_saved_teams_recipients(
    configured_app: Flask,
    command_dependencies: None,
    changes: dict[str, Any],
    field: str,
) -> None:
    model = saved_schedule()
    before = model.recipients[0].recipient_config_json
    with pytest.raises(ReportScheduleInvalidError) as exc:
        validate_update(model, changes)
    assert field in exc.value.normalized_messages()
    assert "Teams" in str(exc.value.normalized_messages()[field])
    assert model.report_format == "NONE"
    assert model.type == "Alert"
    assert model.recipients[0].recipient_config_json == before


@pytest.mark.parametrize("mode", ["disabled", "unconfigured", "removed-destination"])
@pytest.mark.parametrize(
    "changes",
    [
        {"active": False},
        {
            "active": False,
            "type": "Alert",
            "report_format": "NONE",
            "recipients": [teams_recipient()],
        },
        {"name": "Rename only"},
        {"description": "Changed description"},
    ],
)
def test_pause_and_metadata_updates_allow_unavailable_teams(
    configured_app: Flask,
    command_dependencies: None,
    mode: str,
    changes: dict[str, Any],
) -> None:
    make_teams_unavailable(configured_app, mode)
    model = saved_schedule()
    command = validate_update(model, changes)
    assert all(command._properties[key] == value for key, value in changes.items())
    assert (
        model.recipients[0].recipient_config_json
        == teams_recipient(saved=True).recipient_config_json
    )


def test_metadata_only_update_preserves_valid_saved_recipients(
    configured_app: Flask, command_dependencies: None
) -> None:
    command = validate_update(saved_schedule(), {"description": "Changed description"})
    assert "recipients" not in command._properties
    assert "report_format" not in command._properties
    assert "type" not in command._properties


def test_adding_teams_uses_saved_type_and_format(
    configured_app: Flask, command_dependencies: None
) -> None:
    command = validate_update(
        saved_schedule(recipients=[]), {"recipients": [teams_recipient()]}
    )
    assert command._properties["recipients"] == [teams_recipient()]


@pytest.mark.parametrize(
    "replacement",
    [[], [{"type": "Email", "recipient_config_json": {"target": "owner@example.com"}}]],
)
def test_removing_teams_allows_format_and_type_change(
    configured_app: Flask, command_dependencies: None, replacement: list[dict[str, Any]]
) -> None:
    configured_app.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
    command = validate_update(
        saved_schedule(),
        {
            "recipients": replacement,
            "type": "Report",
            "report_format": "PNG",
            "database": None,
        },
    )
    assert command._properties["recipients"] == replacement


@pytest.mark.parametrize("saved_format", ["PNG", "PDF", "CSV", "XLSX", "TEXT"])
def test_metadata_update_can_preserve_legacy_invalid_teams_format(
    configured_app: Flask, command_dependencies: None, saved_format: str
) -> None:
    command = validate_update(
        saved_schedule(report_format=saved_format), {"name": "Rename only"}
    )
    assert command._properties["name"] == "Rename only"


def test_update_can_fix_invalid_saved_format_in_same_request(
    configured_app: Flask, command_dependencies: None
) -> None:
    command = validate_update(
        saved_schedule(report_format="PNG"), {"report_format": "NONE"}
    )
    assert command._properties["report_format"] == "NONE"


@pytest.mark.parametrize("global_attachments", [False, True])
@pytest.mark.parametrize("fail_delivery", [False, True])
def test_teams_none_alert_reuses_execution_and_logs_without_screenshot(
    monkeypatch: pytest.MonkeyPatch,
    global_attachments: bool,
    fail_delivery: bool,
) -> None:
    schedule = SimpleNamespace(
        type=ReportScheduleType.ALERT,
        report_format="NONE",
        name="Operations alert",
        description="Condition triggered",
        chart=None,
        dashboard=None,
        email_subject=None,
        include_cta=False,
        recipients=[teams_recipient(saved=True)],
    )
    state = execute.ReportSuccessState.__new__(execute.ReportSuccessState)
    state._report_schedule = schedule
    state._execution_id = uuid4()
    policy = MagicMock(return_value=global_attachments)
    monkeypatch.setattr(execute, "alerts_attach_reports_enabled", policy)
    monkeypatch.setattr(state, "is_in_grace_period", lambda: False)
    monkeypatch.setattr(state, "is_in_error_grace_period", lambda: True)
    monkeypatch.setattr(state, "_handle_retry_or_error", lambda *args: False)
    monkeypatch.setattr(state, "_reset_retry_counter", MagicMock())
    logs = MagicMock()
    monkeypatch.setattr(state, "update_report_schedule_and_log", logs)
    alert = MagicMock()
    alert.return_value.run.return_value = (True, None)
    monkeypatch.setattr(execute, "AlertCommand", alert)
    monkeypatch.setattr(state, "_validate_recipients_policy", MagicMock())
    monkeypatch.setattr(state, "_get_url", lambda **kwargs: None)
    monkeypatch.setattr(state, "_get_slack_retry_deadline", lambda: None)
    monkeypatch.setattr(
        state,
        "_get_log_data",
        lambda: {"notification_type": "Alert", "notification_format": "NONE"},
    )
    capture = MagicMock(
        side_effect=AssertionError(
            "attachment-free alerts must not render or fetch files"
        )
    )
    for method in ("_get_screenshots", "_get_pdf", "_get_data", "_get_embedded_data"):
        monkeypatch.setattr(state, method, capture)
    dispatched = MagicMock(
        side_effect=NotificationTransientError("Teams temporarily unavailable")
        if fail_delivery
        else None
    )
    monkeypatch.setattr(state, "_send", dispatched)
    if fail_delivery:
        with pytest.raises(NotificationTransientError):
            state.next()
        assert logs.call_args_list == [
            call(ReportState.WORKING),
            call(ReportState.ERROR, error_message="Teams temporarily unavailable"),
        ]
    else:
        state.next()
        assert logs.call_args_list == [
            call(ReportState.WORKING),
            call(ReportState.SUCCESS, error_message=None),
        ]
    message, recipients = dispatched.call_args.args
    assert message.name == "Operations alert"
    assert message.description == "Condition triggered"
    assert not message.has_attachments
    assert message.embedded_data is None
    assert recipients == schedule.recipients
    capture.assert_not_called()
    policy.assert_not_called()
    alert.return_value.run.assert_called_once()


@pytest.mark.parametrize("total_seconds", [100.0, float("inf")])
def test_teams_delivery_reuses_execution_deadline_and_cleanup_reserve(
    configured_app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    total_seconds: float,
) -> None:
    """Each recipient gets the same absolute deadline instead of a fresh allowance."""
    from superset.reports.notifications.base import NotificationContent
    from superset.utils.report_execution import (
        ReportExecutionContext,
        ReportExecutionDeadline,
    )

    state = execute.BaseReportState.__new__(execute.BaseReportState)
    state._report_execution_context = ReportExecutionContext(
        execution_id=uuid4(),
        report_schedule_id=1,
        deadline=ReportExecutionDeadline(total_seconds=total_seconds, started_at=10.0),
        cleanup_reserve_seconds=5.0,
    )
    state._report_schedule = SimpleNamespace(name="Teams alert")
    monkeypatch.setattr(state, "_assert_rendered_delivery_allowed", MagicMock())
    monkeypatch.setattr(execute, "app", configured_app)
    configured_app.config["ALERT_REPORTS_NOTIFICATION_DRY_RUN"] = False
    notification = MagicMock()
    factory = MagicMock(return_value=notification)
    monkeypatch.setattr(execute, "create_notification", factory)
    content = NotificationContent(
        name="Teams alert",
        header_data={
            "notification_type": "Alert",
            "notification_format": "NONE",
            "editors": [],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": None,
        },
    )
    recipient = teams_recipient(saved=True)
    for _ in range(2):
        state._send_notification(content, recipient)
        assert content.delivery_deadline == 10.0 + total_seconds - 5.0
    assert notification.send.call_count == 2


@pytest.mark.parametrize("mode", ["disabled", "unconfigured", "removed-destination"])
@pytest.mark.parametrize("active", [False, True])
@pytest.mark.parametrize("pause", [False, True])
def test_echoed_delivery_values_do_not_revalidate_unavailable_teams(
    configured_app: Flask,
    command_dependencies: None,
    mode: str,
    active: bool,
    pause: bool,
) -> None:
    """Email's empty CC/BCC echoes allow metadata edits and pausing saved Teams."""
    make_teams_unavailable(configured_app, mode)
    model = saved_schedule(active=active)
    model.recipients.append(
        SimpleNamespace(
            type="Email", recipient_config_json='{"target":"owner@example.com"}'
        )
    )
    recipients = [
        {
            "type": "Email",
            "recipient_config_json": {
                "target": "owner@example.com",
                "ccTarget": "",
                "bccTarget": "",
            },
        },
        teams_recipient(),
    ]
    command = validate_update(
        model,
        {
            "description": "Changed",
            "active": False if pause else active,
            "type": "Alert",
            "report_format": "NONE",
            "recipients": recipients,
        },
    )
    assert command._properties["recipients"] == recipients


def make_teams_unavailable(app: Flask, mode: str) -> None:
    """Simulate deployment changes without changing the saved alert."""
    if mode == "disabled":
        app.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
    elif mode == "unconfigured":
        app.config["ALERT_REPORTS_TEAMS"] = {}
    else:
        app.config["ALERT_REPORTS_TEAMS"]["destinations"][0]["key"] = "renamed"


@pytest.mark.parametrize("mode", ["disabled", "unconfigured", "removed-destination"])
@pytest.mark.parametrize(
    "changes",
    [
        {"active": True},
        {"recipients": [teams_recipient({"target": "unknown"})]},
        {"type": "Report", "database": None},
        {"report_format": "PNG"},
        {"active": False, "report_format": "PNG"},
        {"active": False, "type": "Report", "database": None},
        {"active": False, "recipients": [teams_recipient({"target": "unknown"})]},
    ],
)
def test_delivery_changes_revalidate_unavailable_teams_even_when_pausing(
    configured_app: Flask,
    command_dependencies: None,
    mode: str,
    changes: dict[str, Any],
) -> None:
    """Omitted recipients and active:false cannot bypass delivery validation."""
    make_teams_unavailable(configured_app, mode)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        validate_update(saved_schedule(active=changes != {"active": True}), changes)
    field = "recipients"
    if mode == "removed-destination":
        if "type" in changes:
            field = "type"
        elif "report_format" in changes:
            field = "report_format"
    assert "Teams" in str(exc.value.normalized_messages()[field])


@pytest.mark.parametrize("field", ["ccTarget", "bccTarget"])
@pytest.mark.parametrize("serialized", [False, True])
@pytest.mark.parametrize("pause", [False, True])
def test_empty_email_fields_on_teams_are_delivery_changes(
    configured_app: Flask,
    command_dependencies: None,
    field: str,
    serialized: bool,
    pause: bool,
) -> None:
    """Unsupported Teams fields cannot compare unchanged and bypass validation."""
    config = {"target": "ops", field: ""}
    recipient = teams_recipient(json.dumps(config) if serialized else config)
    changes: dict[str, Any] = {
        "description": "Changed description",
        "recipients": [recipient],
    }
    if pause:
        changes["active"] = False
    with pytest.raises(ReportScheduleInvalidError) as exc:
        validate_update(saved_schedule(), changes)
    assert "A configured Teams destination key is required" in str(
        exc.value.normalized_messages()["recipients"]
    )
