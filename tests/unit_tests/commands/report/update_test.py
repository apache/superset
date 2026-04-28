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
"""Unit tests for UpdateReportScheduleCommand.validate()."""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from pytest_mock import MockerFixture

from superset.commands.report.exceptions import (
    ReportScheduleForbiddenError,
    ReportScheduleInvalidError,
)
from superset.commands.report.update import UpdateReportScheduleCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.reports.models import (
    ReportCreationMethod,
    ReportScheduleType,
    ReportState,
)


def _make_model(
    mocker: MockerFixture,
    *,
    model_type: ReportScheduleType | str,
    database_id: int | None,
    creation_method: ReportCreationMethod = ReportCreationMethod.ALERTS_REPORTS,
) -> Mock:
    model = mocker.Mock()
    model.type = model_type
    model.database_id = database_id
    model.creation_method = creation_method
    model.name = "test_schedule"
    model.crontab = "0 9 * * *"
    model.last_state = "noop"
    model.owners = []
    return model


def _setup_mocks(mocker: MockerFixture, model: Mock) -> None:
    mocker.patch(
        "superset.commands.report.update.ReportScheduleDAO.find_by_id",
        return_value=model,
    )
    mocker.patch(
        "superset.commands.report.update.ReportScheduleDAO.validate_update_uniqueness",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.report.update.security_manager.raise_for_ownership",
    )
    mocker.patch(
        "superset.commands.report.update.DatabaseDAO.find_by_id",
        return_value=mocker.Mock(),
    )
    mocker.patch.object(
        UpdateReportScheduleCommand,
        "validate_chart_dashboard",
    )
    mocker.patch.object(
        UpdateReportScheduleCommand,
        "validate_report_frequency",
    )
    mocker.patch.object(
        UpdateReportScheduleCommand,
        "compute_owners",
        return_value=[],
    )


def _get_validation_messages(
    exc_info: pytest.ExceptionInfo[ReportScheduleInvalidError],
) -> dict[str, str]:
    """Extract field→first message string from ReportScheduleInvalidError."""
    raw = exc_info.value.normalized_messages()
    result = {}
    for field, msgs in raw.items():
        if isinstance(msgs, list):
            result[field] = str(msgs[0])
        else:
            result[field] = str(msgs)
    return result


# --- Report type: database must NOT be set ---


def test_report_with_database_in_payload_rejected(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": 5})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "not allowed" in messages["database"].lower()


def test_report_with_database_none_in_payload_accepted(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": None})
    cmd.validate()  # should not raise


def test_report_no_database_in_payload_model_has_db_rejected(
    mocker: MockerFixture,
) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=5)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "not allowed" in messages["database"].lower()


def test_report_no_database_anywhere_accepted(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={})
    cmd.validate()  # should not raise


# --- Alert type: database MUST be set ---


def test_alert_with_database_in_payload_accepted(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": 5})
    cmd.validate()  # should not raise


def test_alert_with_database_none_in_payload_rejected(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=5)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": None})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "required" in messages["database"].lower()


def test_alert_no_database_in_payload_model_has_db_accepted(
    mocker: MockerFixture,
) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=5)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={})
    cmd.validate()  # should not raise


def test_alert_no_database_anywhere_rejected(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "required" in messages["database"].lower()


# --- Type transitions ---


def test_alert_to_report_without_clearing_db_rejected(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=5)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(
        model_id=1, data={"type": ReportScheduleType.REPORT}
    )
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "not allowed" in messages["database"].lower()


def test_alert_to_report_with_db_cleared_accepted(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=5)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(
        model_id=1,
        data={"type": ReportScheduleType.REPORT, "database": None},
    )
    cmd.validate()  # should not raise


def test_report_to_alert_without_db_rejected(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(
        model_id=1, data={"type": ReportScheduleType.ALERT}
    )
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "required" in messages["database"].lower()


def test_report_with_nonexistent_database_returns_not_allowed(
    mocker: MockerFixture,
) -> None:
    """Report + nonexistent DB must return 'not allowed', not 'does not exist'."""
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)
    mocker.patch(
        "superset.commands.report.update.DatabaseDAO.find_by_id",
        return_value=None,
    )

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": 99999})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "not allowed" in messages["database"].lower()
    assert "does not exist" not in messages["database"].lower()


def test_report_to_alert_with_db_accepted(mocker: MockerFixture) -> None:
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(
        model_id=1,
        data={"type": ReportScheduleType.ALERT, "database": 5},
    )
    cmd.validate()  # should not raise


# --- Recipient enforcement for chart/dashboard reports ---

_PATCH_GET_USER_EMAIL = "superset.commands.report.update.get_user_email"


def test_chart_report_update_recipient_overridden_with_owner_email(
    mocker: MockerFixture,
) -> None:
    """Updating recipients on a chart report always locks them to the owner's email."""
    model = _make_model(
        mocker,
        model_type=ReportScheduleType.REPORT,
        database_id=None,
        creation_method=ReportCreationMethod.CHARTS,
    )
    _setup_mocks(mocker, model)

    data = {
        "recipients": [
            {
                "type": "Email",
                "recipient_config_json": {"target": "other@example.com"},
            }
        ]
    }
    cmd = UpdateReportScheduleCommand(model_id=1, data=data)
    with patch(_PATCH_GET_USER_EMAIL, return_value="owner@example.com"):
        cmd.validate()

    recipients = cmd._properties["recipients"]
    assert len(recipients) == 1
    assert recipients[0]["recipient_config_json"]["target"] == "owner@example.com"


def test_dashboard_report_update_recipient_overridden_with_owner_email(
    mocker: MockerFixture,
) -> None:
    """Updating recipients on a dashboard report locks them to the owner's email."""
    model = _make_model(
        mocker,
        model_type=ReportScheduleType.REPORT,
        database_id=None,
        creation_method=ReportCreationMethod.DASHBOARDS,
    )
    _setup_mocks(mocker, model)

    data = {
        "recipients": [
            {
                "type": "Email",
                "recipient_config_json": {"target": "other@example.com"},
            }
        ]
    }
    cmd = UpdateReportScheduleCommand(model_id=1, data=data)
    with patch(_PATCH_GET_USER_EMAIL, return_value="owner@example.com"):
        cmd.validate()

    recipients = cmd._properties["recipients"]
    assert len(recipients) == 1
    assert recipients[0]["recipient_config_json"]["target"] == "owner@example.com"


def test_alerts_reports_update_recipient_not_overridden(
    mocker: MockerFixture,
) -> None:
    """Recipients on admin-created alerts/reports are not modified on update."""
    model = _make_model(
        mocker,
        model_type=ReportScheduleType.REPORT,
        database_id=None,
        creation_method=ReportCreationMethod.ALERTS_REPORTS,
    )
    _setup_mocks(mocker, model)

    original_recipient = {
        "type": "Email",
        "recipient_config_json": {"target": "team@example.com"},
    }
    cmd = UpdateReportScheduleCommand(
        model_id=1, data={"recipients": [original_recipient]}
    )
    with patch(_PATCH_GET_USER_EMAIL, return_value="owner@example.com"):
        cmd.validate()

    assert (
        cmd._properties["recipients"][0]["recipient_config_json"]["target"]
        == "team@example.com"
    )


def test_chart_report_update_no_recipients_in_payload_unchanged(
    mocker: MockerFixture,
) -> None:
    """If recipients are not in the update payload, nothing is changed."""
    model = _make_model(
        mocker,
        model_type=ReportScheduleType.REPORT,
        database_id=None,
        creation_method=ReportCreationMethod.CHARTS,
    )
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"name": "new name"})
    with patch(_PATCH_GET_USER_EMAIL, return_value="owner@example.com"):
        cmd.validate()

    assert "recipients" not in cmd._properties


def test_chart_report_update_no_user_email_raises(mocker: MockerFixture) -> None:
    """Update fails with a validation error when the user has no email address."""
    model = _make_model(
        mocker,
        model_type=ReportScheduleType.REPORT,
        database_id=None,
        creation_method=ReportCreationMethod.CHARTS,
    )
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(
        model_id=1,
        data={
            "recipients": [
                {"type": "Email", "recipient_config_json": {"target": "x@y.com"}}
            ]
        },
    )
    with patch(_PATCH_GET_USER_EMAIL, return_value=None):
        with pytest.raises(ReportScheduleInvalidError) as exc_info:
            cmd.validate()

    messages = _get_validation_messages(exc_info)
    assert "recipients" in messages


# --- Deactivation state reset ---


def test_deactivation_resets_working_state_to_noop(mocker: MockerFixture) -> None:
    """Deactivating a report in WORKING state should reset last_state to NOOP."""
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    model.last_state = ReportState.WORKING
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"active": False})
    cmd.validate()
    assert cmd._properties["last_state"] == ReportState.NOOP


def test_deactivation_from_non_working_does_not_reset(mocker: MockerFixture) -> None:
    """Deactivating a report NOT in WORKING state should not touch last_state."""
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    model.last_state = ReportState.SUCCESS
    _setup_mocks(mocker, model)

    cmd = UpdateReportScheduleCommand(model_id=1, data={"active": False})
    cmd.validate()
    assert "last_state" not in cmd._properties


# --- Ownership check ---


def test_ownership_check_raises_forbidden(mocker: MockerFixture) -> None:
    """Non-owner should get ReportScheduleForbiddenError."""
    model = _make_model(mocker, model_type=ReportScheduleType.REPORT, database_id=None)
    _setup_mocks(mocker, model)
    mocker.patch(
        "superset.commands.report.update.security_manager.raise_for_ownership",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="Forbidden",
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )

    cmd = UpdateReportScheduleCommand(model_id=1, data={})
    with pytest.raises(ReportScheduleForbiddenError):
        cmd.validate()


# --- Database not found for alert ---


def test_alert_with_nonexistent_database_rejected(mocker: MockerFixture) -> None:
    """Alert with a database ID that doesn't exist should fail validation."""
    model = _make_model(mocker, model_type=ReportScheduleType.ALERT, database_id=None)
    _setup_mocks(mocker, model)
    mocker.patch(
        "superset.commands.report.update.DatabaseDAO.find_by_id",
        return_value=None,
    )

    cmd = UpdateReportScheduleCommand(model_id=1, data={"database": 99999})
    with pytest.raises(ReportScheduleInvalidError) as exc_info:
        cmd.validate()
    messages = _get_validation_messages(exc_info)
    assert "database" in messages
    assert "does not exist" in messages["database"].lower()
