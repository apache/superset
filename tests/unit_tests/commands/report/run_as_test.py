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
Tests for the per-schedule "Run As" executor validation (SIP-209) in the
create and update report schedule commands.
"""

from typing import Any
from unittest.mock import Mock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.commands.report.create import CreateReportScheduleCommand
from superset.commands.report.exceptions import (
    ReportScheduleFormatRequiredError,
    ReportScheduleInvalidError,
    ReportScheduleRecipientNotAllowedError,
    ReportScheduleRunAlertQueryAsNotAllowedError,
    ReportScheduleRunAsConditionForbiddenError,
    ReportScheduleRunAsContentForbiddenError,
    ReportScheduleRunAsForbiddenError,
    ReportScheduleRunAsNotFoundError,
)
from superset.commands.report.update import UpdateReportScheduleCommand
from superset.reports.models import (
    ReportCreationMethod,
    ReportDataFormat,
    ReportScheduleType,
)


def _user(user_id: int, active: bool = True) -> Mock:
    user = Mock()
    user.id = user_id
    user.is_active = active
    user.username = f"user{user_id}"
    return user


CURRENT_USER = _user(1)
OTHER_USER = _user(2)
USERS = {1: CURRENT_USER, 2: OTHER_USER, 3: _user(3, active=False)}


def _stub_security(mocker: MockerFixture, *, is_admin: bool) -> Mock:
    security_manager = Mock()
    security_manager.is_admin.return_value = is_admin
    security_manager.get_user_by_id.side_effect = lambda pk: USERS.get(pk)
    mocker.patch("superset.commands.report.base.security_manager", security_manager)
    mocker.patch("superset.commands.report.base.get_user", return_value=CURRENT_USER)
    return security_manager


def _errors(exc: pytest.ExceptionInfo[ReportScheduleInvalidError]) -> list[type]:
    return [type(e) for e in exc.value._exceptions]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def _stub_create_deps(
    mocker: MockerFixture, *, feature_enabled: bool, stub_policy: bool = True
) -> None:
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
    mocker.patch.object(CreateReportScheduleCommand, "validate_chart_dashboard")
    mocker.patch.object(CreateReportScheduleCommand, "_validate_report_extra")
    if stub_policy:
        mocker.patch.object(CreateReportScheduleCommand, "validate_recipients_policy")
    mocker.patch("superset.commands.report.create.populate_subjects")
    mocker.patch(
        "superset.commands.report.create.is_feature_enabled",
        return_value=feature_enabled,
    )


def _create_command(**overrides: Any) -> CreateReportScheduleCommand:
    command = CreateReportScheduleCommand({})
    command._properties = {
        "type": ReportScheduleType.REPORT,
        "name": "Test",
        "crontab": "0 9 * * *",
        "creation_method": "alerts_reports",
        **overrides,
    }
    return command


def test_create_feature_disabled_drops_run_as_fields(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=False)
    security_manager = _stub_security(mocker, is_admin=True)

    command = _create_command(run_as=2, run_alert_query_as=2)
    command.validate()

    assert "run_as" not in command._properties
    assert "run_alert_query_as" not in command._properties
    security_manager.get_user_by_id.assert_not_called()


def test_create_defaults_run_as_to_current_user(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)

    command = _create_command()
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER
    # Reports never carry an alert query executor.
    assert "run_alert_query_as" not in command._properties


def test_admin_can_create_with_application_default_executor(
    mocker: MockerFixture,
) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)

    command = _create_command(run_as=None, run_as_type=None)
    command.validate()

    assert command._properties["run_as"] is None
    assert command._properties["run_as_type"] is None


def test_non_admin_cannot_create_with_application_default_executor(
    mocker: MockerFixture,
) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=False)

    command = _create_command(run_as=None, run_as_type=None)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsForbiddenError in _errors(exc)


def test_create_alert_defaults_query_executor_to_run_as(
    mocker: MockerFixture,
) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id",
        return_value=Mock(),
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")

    command = _create_command(type=ReportScheduleType.ALERT, database=1, run_as=2)
    command.validate()

    assert command._properties["run_as"] is OTHER_USER
    assert command._properties["run_alert_query_as"] is None


def test_create_alert_with_distinct_query_executor(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")

    command = _create_command(
        type=ReportScheduleType.ALERT, database=1, run_as=1, run_alert_query_as=2
    )
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER
    assert command._properties["run_alert_query_as"] is OTHER_USER


def test_create_non_admin_cannot_impersonate_another_user(
    mocker: MockerFixture,
) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=False)

    command = _create_command(run_as=2)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsForbiddenError in _errors(exc)


def test_create_non_admin_may_set_themselves(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=False)

    command = _create_command(run_as=1)
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER


def test_create_rejects_missing_or_inactive_user(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)

    for user_id in (3, 999):
        command = _create_command(run_as=user_id)
        with pytest.raises(ReportScheduleInvalidError) as exc:
            command.validate()
        assert ReportScheduleRunAsNotFoundError in _errors(exc)


def test_create_report_rejects_alert_query_executor(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=True)
    _stub_security(mocker, is_admin=True)

    command = _create_command(run_alert_query_as=1)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAlertQueryAsNotAllowedError in _errors(exc)


def test_create_report_rejects_no_attachment_format(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=False)
    _stub_security(mocker, is_admin=True)

    command = _create_command(report_format=ReportDataFormat.NONE)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleFormatRequiredError in _errors(exc)


def test_create_alert_allows_no_attachment_format(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=False)
    _stub_security(mocker, is_admin=True)
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")

    command = _create_command(
        type=ReportScheduleType.ALERT, database=1, report_format=ReportDataFormat.NONE
    )
    command.validate()


def test_create_enforces_recipient_policy(mocker: MockerFixture) -> None:
    _stub_create_deps(mocker, feature_enabled=False, stub_policy=False)
    _stub_security(mocker, is_admin=True)
    mocker.patch(
        "superset.commands.report.base.ReportConfigDAO.find_disallowed_addresses",
        return_value=["x@other.org"],
    )

    command = _create_command(
        recipients=[
            {
                "type": "Email",
                "recipient_config_json": {"target": "x@other.org"},
            }
        ]
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRecipientNotAllowedError in _errors(exc)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def _make_model(
    *,
    model_type: ReportScheduleType = ReportScheduleType.REPORT,
    run_as: Mock | None = None,
    run_alert_query_as: Mock | None = None,
) -> Mock:
    model = Mock()
    model.type = model_type
    model.database_id = 5 if model_type == ReportScheduleType.ALERT else None
    model.creation_method = "alerts_reports"
    model.name = "test_schedule"
    model.crontab = "0 9 * * *"
    model.last_state = "noop"
    model.editors = []
    model.retry_on_failure = False
    model.send_failed_reports = False
    model.chart_id = None
    model.dashboard_id = 10
    model.custom_width = None
    model.extra_json = '{"dashboard": {"anchor": ""}}'
    model.recipients = []
    model.report_format = "PNG"
    model.sql = None
    model.validator_config_json = "{}"
    model.validator_type = None
    model.run_as_type = "fixed_user" if run_as else None
    model.run_alert_query_as_type = "fixed_user" if run_alert_query_as else None
    model.run_as = run_as
    model.run_as_fk = run_as.id if run_as else None
    model.run_alert_query_as = run_alert_query_as
    model.run_alert_query_as_fk = run_alert_query_as.id if run_alert_query_as else None
    return model


def _stub_update_deps(
    mocker: MockerFixture, model: Mock, *, is_admin: bool, feature_enabled: bool = True
) -> None:
    mocker.patch(
        "superset.commands.report.update.ReportScheduleDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.report.update.ReportScheduleDAO.validate_update_uniqueness",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.report.update.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(UpdateReportScheduleCommand, "validate_chart_dashboard")
    mocker.patch.object(UpdateReportScheduleCommand, "validate_report_frequency")
    mocker.patch.object(UpdateReportScheduleCommand, "validate_alert_query")
    mocker.patch.object(UpdateReportScheduleCommand, "_validate_report_extra")
    mocker.patch.object(UpdateReportScheduleCommand, "validate_recipients_policy")
    mocker.patch("superset.commands.report.update.compute_subjects")
    mocker.patch(
        "superset.commands.report.update.is_feature_enabled",
        return_value=feature_enabled,
    )
    mocker.patch(
        "superset.commands.report.update.get_user_id", return_value=CURRENT_USER.id
    )
    update_security_manager = Mock()
    update_security_manager.is_admin.return_value = is_admin
    mocker.patch(
        "superset.commands.report.update.security_manager", update_security_manager
    )
    _stub_security(mocker, is_admin=is_admin)


@pytest.mark.parametrize("is_admin", [False, True])
def test_update_feature_disabled_clears_saved_executors(
    mocker: MockerFixture, is_admin: bool
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=OTHER_USER,
    )
    _stub_update_deps(mocker, model, is_admin=is_admin, feature_enabled=False)

    command = UpdateReportScheduleCommand(1, {"name": "renamed"})
    command.validate()

    assert command._properties["run_as"] is None
    assert command._properties["run_as_type"] is None
    assert command._properties["run_alert_query_as"] is None
    assert command._properties["run_alert_query_as_type"] is None


def test_update_admin_sets_and_clears_run_as(mocker: MockerFixture) -> None:
    model = _make_model(run_as=CURRENT_USER)
    _stub_update_deps(mocker, model, is_admin=True)

    command = UpdateReportScheduleCommand(1, {"run_as": 2})
    command.validate()
    assert command._properties["run_as"] is OTHER_USER

    # Explicit null reverts to the legacy ALERT_REPORTS_EXECUTORS resolution.
    command = UpdateReportScheduleCommand(1, {"run_as": None})
    command.validate()
    assert command._properties["run_as"] is None
    assert command._properties["run_as_type"] is None


def test_update_non_admin_cannot_select_application_default(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"run_as": None})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsForbiddenError in _errors(exc)


def test_update_non_admin_cannot_point_at_another_user(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=CURRENT_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"run_as": 2})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsForbiddenError in _errors(exc)


def test_update_non_admin_can_change_metadata_of_schedule_run_by_other(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    # Unchanged content fields sent back by the UI do not count as changes.
    command = UpdateReportScheduleCommand(
        1,
        {
            "active": False,
            "name": "renamed",
            "dashboard": 10,
            "chart": None,
            "report_format": "PNG",
            "extra": {"dashboard": {"anchor": ""}},
            "recipients": [],
        },
    )
    command.validate()


def test_empty_native_filters_do_not_count_as_content_change(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "extra": {"dashboard": {"anchor": "", "nativeFilters": []}},
        },
    )
    command.validate()

    assert command._changed_content_fields() == set()


def test_nonempty_native_filters_remain_protected_content(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1,
        {
            "extra": {
                "dashboard": {
                    "anchor": "",
                    "nativeFilters": [{"nativeFilterId": "NATIVE_FILTER-1"}],
                }
            }
        },
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)


@pytest.mark.parametrize("application_default", [False, True])
def test_empty_email_cc_and_bcc_do_not_count_as_recipient_changes(
    mocker: MockerFixture, application_default: bool
) -> None:
    """A modal resubmission of optional empty fields permits metadata edits."""
    model = _make_model(run_as=None if application_default else OTHER_USER)
    model.recipients = [
        Mock(
            type="Email",
            recipient_config_json='{"target": "a@x.com"}',
        )
    ]
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "recipients": [
                {
                    "type": "Email",
                    "recipient_config_json": {
                        "target": "a@x.com",
                        "ccTarget": "",
                        "bccTarget": "",
                    },
                }
            ],
        },
    )
    command.validate()
    assert command._changed_content_fields() == set()


@pytest.mark.parametrize("recipient_type", ["Slack", "SlackV2", "Webhook"])
def test_empty_cc_and_bcc_do_not_change_non_email_recipients(
    mocker: MockerFixture, recipient_type: str
) -> None:
    model = _make_model(run_as=OTHER_USER)
    model.recipients = [
        Mock(
            type=recipient_type,
            recipient_config_json='{"target": "C12345678"}',
        )
    ]
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "recipients": [
                {
                    "type": recipient_type,
                    "recipient_config_json": {
                        "target": "C12345678",
                        "ccTarget": "",
                        "bccTarget": "",
                    },
                }
            ],
        },
    )
    command.validate()

    assert command._changed_content_fields() == set()


@pytest.mark.parametrize(
    "creation_method",
    [ReportCreationMethod.CHARTS, ReportCreationMethod.DASHBOARDS],
)
@pytest.mark.parametrize("application_default", [False, True])
def test_subscription_recipient_rewrite_is_protected_content_change(
    mocker: MockerFixture,
    creation_method: ReportCreationMethod,
    application_default: bool,
) -> None:
    """
    A resubmitted recipient cannot be silently redirected to the editor.

    Schedules created from charts/dashboars always set the ``recipients``
    config to the user email (even if the payload sends something different).
    """
    model = _make_model(run_as=None if application_default else OTHER_USER)
    model.creation_method = creation_method
    model.recipients = [
        Mock(type="Email", recipient_config_json='{"target": "owner@x.com"}')
    ]
    _stub_update_deps(mocker, model, is_admin=False)
    mocker.patch(
        "superset.commands.report.update.get_user_email",
        return_value="editor@x.com",
    )

    command = UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "recipients": [
                {
                    "type": "Email",
                    "recipient_config_json": {"target": "owner@x.com"},
                }
            ],
        },
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)


@pytest.mark.parametrize("application_default", [False, True])
def test_subscription_format_change_requires_takeover(
    mocker: MockerFixture, application_default: bool
) -> None:
    """A format edit cannot use another user's or the default executor."""
    model = _make_model(run_as=None if application_default else OTHER_USER)
    model.creation_method = ReportCreationMethod.CHARTS
    model.recipients = [
        Mock(type="Email", recipient_config_json='{"target": "owner@x.com"}')
    ]
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(1, {"report_format": "PDF"})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)
    assert command._changed_content_fields() == {"report_format"}


def test_subscription_format_change_after_takeover(mocker: MockerFixture) -> None:
    """Switching to the requester permits the format change."""
    model = _make_model(run_as=OTHER_USER)
    model.creation_method = ReportCreationMethod.CHARTS
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(
        1,
        {
            "report_format": "PDF",
            "run_as": CURRENT_USER.id,
            "run_as_type": "fixed_user",
        },
    )
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER


def test_subscription_unchanged_format_preserves_executor(
    mocker: MockerFixture,
) -> None:
    """Resending the stored format during a metadata edit is allowed."""
    model = _make_model(run_as=OTHER_USER)
    model.creation_method = ReportCreationMethod.CHARTS
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(
        1, {"report_format": "PNG", "name": "renamed"}
    )
    command.validate()

    assert "run_as" not in command._properties
    assert "run_as_type" not in command._properties
    assert command._changed_content_fields() == set()


def test_subscription_recipient_rewrite_to_same_address_is_not_a_change(
    mocker: MockerFixture,
) -> None:
    """A metadata edit succeeds when the enforced recipient is unchanged."""
    model = _make_model(run_as=OTHER_USER)
    model.creation_method = ReportCreationMethod.CHARTS
    model.recipients = [
        Mock(type="Email", recipient_config_json='{"target": "editor@x.com"}')
    ]
    _stub_update_deps(mocker, model, is_admin=False)
    mocker.patch(
        "superset.commands.report.update.get_user_email",
        return_value="editor@x.com",
    )

    UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "recipients": [
                {
                    "type": "Email",
                    "recipient_config_json": {"target": "editor@x.com"},
                }
            ],
        },
    ).validate()


@pytest.mark.parametrize("optional_field", ["ccTarget", "bccTarget"])
@pytest.mark.parametrize(
    "recipient_type,target", [("Email", "a@x.com"), ("Slack", "C12345678")]
)
def test_nonempty_cc_or_bcc_counts_as_recipient_change(
    mocker: MockerFixture, optional_field: str, recipient_type: str, target: str
) -> None:
    """Adding an actual Cc or Bcc remains a protected content change."""
    model = _make_model(run_as=OTHER_USER)
    model.recipients = [
        Mock(type=recipient_type, recipient_config_json=f'{{"target": "{target}"}}')
    ]
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1,
        {
            "recipients": [
                {
                    "type": recipient_type,
                    "recipient_config_json": {
                        "target": target,
                        optional_field: "other@x.com",
                    },
                }
            ]
        },
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)


def test_update_non_admin_cannot_change_content_of_schedule_run_by_other(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"dashboard": 11})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)


@pytest.mark.parametrize(
    "field,value",
    [("creation_method", "dashboards"), ("custom_width", 900)],
)
def test_update_non_admin_can_change_display_settings_run_by_other(
    field: str, value: Any, mocker: MockerFixture
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    UpdateReportScheduleCommand(1, {field: value}).validate()


@pytest.mark.parametrize(
    "field,value",
    [
        ("database", 7),
        ("sql", "SELECT 2"),
        ("validator_type", "op"),
        ("validator_config_json", {"op": ">"}),
    ],
)
def test_condition_fields_do_not_count_as_delivered_content(
    field: str, value: Any
) -> None:
    command = UpdateReportScheduleCommand(1, {field: value})
    command._model = _make_model(run_as=OTHER_USER)

    assert command._changed_content_fields() == set()


def test_non_admin_cannot_switch_other_user_alert_to_report(
    mocker: MockerFixture,
) -> None:
    model = _make_model(model_type=ReportScheduleType.ALERT, run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1, {"type": ReportScheduleType.REPORT, "database": None}
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)
    assert command._changed_content_fields() == {"type"}


@pytest.mark.parametrize(
    "field,value",
    [
        ("database", 7),
        ("sql", "SELECT 2"),
        ("validator_type", "not null"),
        ("validator_config_json", {"op": ">", "threshold": 1}),
    ],
)
def test_non_admin_cannot_change_alert_condition_run_by_other(
    mocker: MockerFixture,
    field: str,
    value: Any,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=OTHER_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(1, {field: value})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsConditionForbiddenError in _errors(exc)


@pytest.mark.parametrize("field,value", [("sql", "SELECT 2"), ("database", 7)])
def test_non_admin_can_change_alert_condition_when_query_runs_as_self(
    mocker: MockerFixture, field: str, value: Any
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=CURRENT_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)

    UpdateReportScheduleCommand(1, {field: value}).validate()


def test_non_admin_cannot_change_alert_condition_using_application_default(
    mocker: MockerFixture,
) -> None:
    model = _make_model(model_type=ReportScheduleType.ALERT)
    _stub_update_deps(mocker, model, is_admin=False)

    with pytest.raises(ReportScheduleInvalidError) as exc:
        UpdateReportScheduleCommand(1, {"sql": "SELECT 2"}).validate()

    assert ReportScheduleRunAsConditionForbiddenError in _errors(exc)


def test_non_admin_can_change_alert_condition_after_selecting_self(
    mocker: MockerFixture,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=OTHER_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1, {"run_alert_query_as": CURRENT_USER.id, "sql": "SELECT 2"}
    )
    command.validate()
    assert command._properties["run_alert_query_as"] is CURRENT_USER


def test_unchanged_alert_condition_payload_is_allowed(
    mocker: MockerFixture,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=OTHER_USER,
    )
    model.sql = "SELECT 1"
    _stub_update_deps(mocker, model, is_admin=False)

    UpdateReportScheduleCommand(
        1,
        {
            "name": "renamed",
            "sql": "SELECT 1",
            "validator_config_json": {},
        },
    ).validate()


def test_update_non_admin_can_change_content_after_taking_over(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"dashboard": 11, "run_as": 1})
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER


def test_update_admin_can_change_content_of_schedule_run_by_other(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=True)

    UpdateReportScheduleCommand(1, {"dashboard": 11}).validate()


def test_update_report_clears_stale_alert_query_executor(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=CURRENT_USER, run_alert_query_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=True)

    command = UpdateReportScheduleCommand(1, {"name": "renamed"})
    command.validate()

    assert command._properties["run_alert_query_as"] is None


def test_update_report_rejects_alert_query_executor(mocker: MockerFixture) -> None:
    model = _make_model()
    _stub_update_deps(mocker, model, is_admin=True)

    command = UpdateReportScheduleCommand(1, {"run_alert_query_as": 2})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAlertQueryAsNotAllowedError in _errors(exc)


def test_update_alert_query_executor_is_validated(mocker: MockerFixture) -> None:
    model = _make_model(model_type=ReportScheduleType.ALERT, run_as=CURRENT_USER)
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"run_alert_query_as": 2})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()
    assert ReportScheduleRunAsForbiddenError in _errors(exc)

    command = UpdateReportScheduleCommand(1, {"run_alert_query_as": 1})
    command.validate()
    assert command._properties["run_alert_query_as"] is CURRENT_USER


def test_update_report_rejects_no_attachment_format(mocker: MockerFixture) -> None:
    model = _make_model()
    _stub_update_deps(mocker, model, is_admin=True)

    command = UpdateReportScheduleCommand(1, {"report_format": ReportDataFormat.NONE})
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleFormatRequiredError in _errors(exc)


def test_clear_content_executor_restores_application_default(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=OTHER_USER)
    _stub_update_deps(mocker, model, is_admin=True)
    command = UpdateReportScheduleCommand(1, {"run_as": None})
    command.validate()
    assert command._properties["run_as_type"] is None
    assert command._properties["run_as"] is None


def test_clear_query_executor_inherits_content(mocker: MockerFixture) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=CURRENT_USER,
    )
    _stub_update_deps(mocker, model, is_admin=True)
    command = UpdateReportScheduleCommand(1, {"run_alert_query_as": None})
    command.validate()
    assert command._properties["run_alert_query_as"] is None
    assert command._properties["run_alert_query_as_type"] is None


@pytest.mark.parametrize("run_as", [OTHER_USER, None])
@pytest.mark.parametrize(
    "payload",
    [{"run_alert_query_as": None}, {"run_alert_query_as_type": None}],
)
def test_non_admin_cannot_clear_query_executor_to_another_identity(
    mocker: MockerFixture, run_as: Mock | None, payload: dict[str, None]
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=run_as,
        run_alert_query_as=CURRENT_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, payload)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleRunAsConditionForbiddenError in _errors(exc)


def test_non_admin_can_clear_query_executor_when_content_runs_as_self(
    mocker: MockerFixture,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=CURRENT_USER,
        run_alert_query_as=CURRENT_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(1, {"run_alert_query_as": None})
    command.validate()

    assert command._properties["run_alert_query_as"] is None
    assert command._properties["run_alert_query_as_type"] is None


def test_non_admin_can_clear_query_executor_while_switching_content_to_self(
    mocker: MockerFixture,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=CURRENT_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)

    command = UpdateReportScheduleCommand(
        1, {"run_as": CURRENT_USER.id, "run_alert_query_as": None}
    )
    command.validate()

    assert command._properties["run_as"] is CURRENT_USER
    assert command._properties["run_alert_query_as"] is None


@pytest.mark.parametrize("active", [False, True])
def test_enabling_attachment_validates_existing_content_user(
    active: bool, mocker: MockerFixture
) -> None:
    from superset.reports.models import ReportSchedule

    mocker.patch(
        "superset.commands.report.update.is_feature_enabled", return_value=True
    )
    command = UpdateReportScheduleCommand(1, {"report_format": ReportDataFormat.PNG})
    command._model = ReportSchedule(
        report_format=ReportDataFormat.NONE, run_as_type="fixed_user"
    )
    command._model.run_as = _user(2, active=active)
    errors: list[ValidationError] = []
    command._validate_attachment_executor(errors)
    assert bool(errors) is not active
    if errors:
        assert isinstance(errors[0], ReportScheduleRunAsNotFoundError)


def test_enabling_attachment_rejects_deleted_content_user(
    mocker: MockerFixture,
) -> None:
    from superset.reports.models import ReportSchedule

    mocker.patch(
        "superset.commands.report.update.is_feature_enabled", return_value=True
    )
    command = UpdateReportScheduleCommand(1, {"report_format": ReportDataFormat.PNG})
    command._model = ReportSchedule(
        report_format=ReportDataFormat.NONE, run_as_type="fixed_user"
    )
    errors: list[ValidationError] = []
    command._validate_attachment_executor(errors)
    assert isinstance(errors[0], ReportScheduleRunAsNotFoundError)


def test_enabling_attachment_uses_default_when_type_is_unset(
    mocker: MockerFixture,
) -> None:
    from superset.reports.models import ReportSchedule

    mocker.patch(
        "superset.commands.report.update.is_feature_enabled", return_value=True
    )
    mocker.patch(
        "superset.commands.report.update.get_executor",
        return_value=("creator", CURRENT_USER.username),
    )
    mocker.patch(
        "superset.commands.report.update.security_manager.find_user",
        return_value=CURRENT_USER,
    )
    command = UpdateReportScheduleCommand(1, {"report_format": ReportDataFormat.PNG})
    command._model = ReportSchedule(report_format=ReportDataFormat.NONE)
    command._model.run_as = OTHER_USER
    command._model.run_as_type = None

    errors: list[ValidationError] = []
    command._validate_attachment_executor(errors)

    assert errors == []
    assert command._model.run_as is OTHER_USER
    assert command._model.run_as_type is None


@pytest.mark.parametrize("field", ["run_as", "run_alert_query_as"])
def test_non_admin_update_cannot_choose_other_user(
    field: str,
    mocker: MockerFixture,
) -> None:
    model = _make_model(model_type=ReportScheduleType.ALERT, run_as=CURRENT_USER)
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(
        1,
        {
            field: OTHER_USER.id,
            f"{field}_type": "fixed_user",
        },
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()
    assert ReportScheduleRunAsForbiddenError in _errors(exc)


def test_non_admin_takes_over_both_alert_executors_before_content_edit(
    mocker: MockerFixture,
) -> None:
    model = _make_model(
        model_type=ReportScheduleType.ALERT,
        run_as=OTHER_USER,
        run_alert_query_as=OTHER_USER,
    )
    _stub_update_deps(mocker, model, is_admin=False)
    command = UpdateReportScheduleCommand(
        1,
        {
            "dashboard": 11,
            "run_as": CURRENT_USER.id,
            "run_as_type": "fixed_user",
            "run_alert_query_as": CURRENT_USER.id,
            "run_alert_query_as_type": "fixed_user",
        },
    )
    command.validate()
    assert command._properties["run_as"] is CURRENT_USER
    assert command._properties["run_alert_query_as"] is CURRENT_USER


def test_non_admin_legacy_content_edits_require_explicit_self(
    mocker: MockerFixture,
) -> None:
    model = _make_model()
    _stub_update_deps(mocker, model, is_admin=False)
    metadata = UpdateReportScheduleCommand(1, {"name": "renamed"})
    metadata.validate()
    assert "run_as" not in metadata._properties
    with pytest.raises(ReportScheduleInvalidError) as exc:
        UpdateReportScheduleCommand(1, {"dashboard": 11}).validate()
    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)
    own = UpdateReportScheduleCommand(
        1, {"dashboard": 11, "run_as": CURRENT_USER.id, "run_as_type": "fixed_user"}
    )
    own.validate()
    assert own._properties["run_as"] is CURRENT_USER


def test_non_admin_stale_user_with_unset_type_cannot_edit_content(
    mocker: MockerFixture,
) -> None:
    model = _make_model(run_as=CURRENT_USER)
    model.run_as_type = None
    _stub_update_deps(mocker, model, is_admin=False)

    with pytest.raises(ReportScheduleInvalidError) as exc:
        UpdateReportScheduleCommand(1, {"dashboard": 11}).validate()

    assert ReportScheduleRunAsContentForbiddenError in _errors(exc)


@pytest.mark.parametrize(
    ("report_type", "report_format", "global_enabled", "requires_asset"),
    [
        (ReportScheduleType.ALERT, ReportDataFormat.NONE, True, False),
        (ReportScheduleType.ALERT, ReportDataFormat.PNG, False, True),
        (ReportScheduleType.ALERT, ReportDataFormat.PNG, True, True),
        (ReportScheduleType.REPORT, ReportDataFormat.PNG, False, True),
    ],
)
def test_create_attachment_asset_requirement(
    report_type: str,
    report_format: str,
    global_enabled: bool,
    requires_asset: bool,
    mocker: MockerFixture,
) -> None:
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        ReportScheduleEitherChartOrDashboardError,
    )

    _stub_create_deps(mocker, feature_enabled=False)
    _stub_security(mocker, is_admin=True)
    mocker.patch.object(
        CreateReportScheduleCommand,
        "validate_chart_dashboard",
        BaseReportScheduleCommand.validate_chart_dashboard,
    )
    mocker.patch(
        "superset.commands.report.base.ReportConfigDAO.get_effective_value",
        return_value=global_enabled,
    )
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")
    command = _create_command(type=report_type, report_format=report_format, database=1)
    if requires_asset:
        with pytest.raises(ReportScheduleInvalidError) as exc:
            command.validate()
        assert ReportScheduleEitherChartOrDashboardError in _errors(exc)
    else:
        command.validate()


def test_create_alert_default_format_requires_asset_when_global_disabled(
    mocker: MockerFixture,
) -> None:
    """Omitting report_format cannot store an asset-less default PNG alert."""
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        ReportScheduleEitherChartOrDashboardError,
    )

    _stub_create_deps(mocker, feature_enabled=False)
    _stub_security(mocker, is_admin=True)
    mocker.patch.object(
        CreateReportScheduleCommand,
        "validate_chart_dashboard",
        BaseReportScheduleCommand.validate_chart_dashboard,
    )
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")

    command = _create_command(type=ReportScheduleType.ALERT, database=1)
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()

    assert ReportScheduleEitherChartOrDashboardError in _errors(exc)


@pytest.mark.parametrize("include_asset", [False, True])
@pytest.mark.parametrize("global_enabled", [False, True])
def test_enabling_attachment_requires_asset_on_update(
    include_asset: bool, global_enabled: bool, mocker: MockerFixture
) -> None:
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        ReportScheduleEitherChartOrDashboardError,
    )

    model = _make_model(model_type=ReportScheduleType.ALERT, run_as=CURRENT_USER)
    model.report_format = ReportDataFormat.NONE
    model.dashboard_id = 10 if include_asset else None
    _stub_update_deps(mocker, model, is_admin=True)
    mocker.patch.object(
        UpdateReportScheduleCommand,
        "validate_chart_dashboard",
        BaseReportScheduleCommand.validate_chart_dashboard,
    )
    mocker.patch(
        "superset.commands.report.base.ReportConfigDAO.get_effective_value",
        return_value=global_enabled,
    )
    command = UpdateReportScheduleCommand(1, {"report_format": ReportDataFormat.PNG})
    if include_asset:
        command.validate()
    else:
        with pytest.raises(ReportScheduleInvalidError) as exc:
            command.validate()
        assert ReportScheduleEitherChartOrDashboardError in _errors(exc)


def test_enabling_attachment_rejects_explicitly_cleared_asset(
    mocker: MockerFixture,
) -> None:
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        ReportScheduleEitherChartOrDashboardError,
    )

    model = _make_model(model_type=ReportScheduleType.ALERT, run_as=CURRENT_USER)
    model.report_format = ReportDataFormat.NONE
    model.dashboard_id = 10
    _stub_update_deps(mocker, model, is_admin=True)
    mocker.patch.object(
        UpdateReportScheduleCommand,
        "validate_chart_dashboard",
        BaseReportScheduleCommand.validate_chart_dashboard,
    )
    mocker.patch(
        "superset.commands.report.base.ReportConfigDAO.get_effective_value",
        return_value=True,
    )

    command = UpdateReportScheduleCommand(
        1, {"report_format": ReportDataFormat.PNG, "dashboard": None}
    )
    with pytest.raises(ReportScheduleInvalidError) as exc:
        command.validate()
    assert ReportScheduleEitherChartOrDashboardError in _errors(exc)


def test_attachment_free_alert_keeps_supplied_asset_and_validates_access(
    mocker: MockerFixture,
) -> None:
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import ReportScheduleForbiddenError
    from superset.exceptions import SupersetSecurityException

    _stub_create_deps(mocker, feature_enabled=False)
    manager = _stub_security(mocker, is_admin=True)
    mocker.patch.object(
        CreateReportScheduleCommand,
        "validate_chart_dashboard",
        BaseReportScheduleCommand.validate_chart_dashboard,
    )
    dashboard = Mock()
    mocker.patch(
        "superset.commands.report.base.DashboardDAO.find_by_id", return_value=dashboard
    )
    mocker.patch(
        "superset.commands.report.create.DatabaseDAO.find_by_id", return_value=Mock()
    )
    mocker.patch.object(CreateReportScheduleCommand, "validate_alert_query")
    command = _create_command(
        type=ReportScheduleType.ALERT,
        database=1,
        report_format=ReportDataFormat.NONE,
        dashboard=10,
    )
    command.validate()
    assert command._properties["dashboard"] is dashboard
    assert command._properties["report_format"] == ReportDataFormat.NONE
    manager.raise_for_access.assert_called_once_with(dashboard=dashboard)
    manager.raise_for_access.side_effect = SupersetSecurityException(
        Mock(message="Access denied")
    )
    command = _create_command(
        type=ReportScheduleType.ALERT,
        database=1,
        report_format=ReportDataFormat.NONE,
        dashboard=10,
    )
    with pytest.raises(ReportScheduleForbiddenError):
        command.validate()
