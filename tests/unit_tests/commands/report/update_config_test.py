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
from typing import Any
from unittest.mock import Mock

import pytest
from pytest_mock import MockerFixture

from superset.commands.report.exceptions import ReportConfigConflictError
from superset.commands.report.update_config import UpdateReportConfigCommand
from superset.reports.models import ReportConfigKey, ReportScheduleType

MODULE = "superset.commands.report.update_config"


def _schedule(
    schedule_id: int,
    name: str,
    schedule_type: ReportScheduleType,
    crontab: str = "0 9 * * *",
    recipients: list[Any] | None = None,
) -> Mock:
    schedule = Mock()
    schedule.id = schedule_id
    schedule.name = name
    schedule.type = schedule_type
    schedule.crontab = crontab
    schedule.recipients = recipients or []
    return schedule


def _stub_daos(mocker: MockerFixture, *, effective: dict[str, Any] | None = None):
    effective = effective or {}
    mocker.patch(f"{MODULE}.ReportConfigDAO.lock_for_update")
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.get_effective_value",
        side_effect=lambda key: effective.get(key),
    )
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.get_fallback_value",
        side_effect=lambda key: []
        if key == ReportConfigKey.ALLOWED_EMAIL_DOMAINS
        else 0,
    )
    upsert = mocker.patch(f"{MODULE}.ReportConfigDAO.upsert")
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.get_effective_config", return_value={"saved": True}
    )
    return upsert


def test_no_conflicts_upserts_and_returns_effective_config(
    mocker: MockerFixture,
) -> None:
    upsert = _stub_daos(mocker)
    mocker.patch(
        f"{MODULE}.ReportScheduleDAO.find_with_email_recipients", return_value=[]
    )
    mocker.patch(f"{MODULE}.ReportScheduleDAO.find_by_type", return_value=[])

    payload: dict[str, Any] = {
        ReportConfigKey.ALERTS_ATTACH_REPORTS: False,
        ReportConfigKey.ALLOWED_EMAIL_DOMAINS: ["example.com"],
        ReportConfigKey.ALERT_MINIMUM_INTERVAL: 600,
    }
    result = UpdateReportConfigCommand(payload).run()

    upsert.assert_called_once_with(payload)
    assert result == {"saved": True}


def test_config_row_is_locked_before_validation_and_merge(
    mocker: MockerFixture,
) -> None:
    """A concurrent save cannot interleave between policy validation and merge."""
    _stub_daos(mocker)
    steps: list[str] = []
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.lock_for_update",
        side_effect=lambda: steps.append("lock"),
    )
    mocker.patch.object(
        UpdateReportConfigCommand,
        "validate",
        side_effect=lambda: steps.append("validate"),
    )
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.upsert",
        side_effect=lambda _: steps.append("merge"),
    )

    UpdateReportConfigCommand({ReportConfigKey.ALERTS_ATTACH_REPORTS: False}).run()

    assert steps == ["lock", "validate", "merge"]


def test_recipient_conflicts_list_impacted_schedules(mocker: MockerFixture) -> None:
    _stub_daos(mocker)
    schedules = [
        _schedule(1, "ok", ReportScheduleType.REPORT),
        _schedule(2, "external", ReportScheduleType.ALERT),
    ]
    mocker.patch(
        f"{MODULE}.ReportScheduleDAO.find_with_email_recipients",
        return_value=schedules,
    )
    mocker.patch(f"{MODULE}.get_email_addresses", return_value=["x@other.org"])
    mocker.patch(
        f"{MODULE}.ReportConfigDAO.find_disallowed_addresses",
        side_effect=[[], ["x@other.org"]],
    )

    with pytest.raises(ReportConfigConflictError) as exc:
        UpdateReportConfigCommand(
            {ReportConfigKey.ALLOWED_EMAIL_DOMAINS: ["example.com"]}
        ).validate()

    assert exc.value.impacted_schedules == [
        {
            "id": 2,
            "name": "external",
            "type": ReportScheduleType.ALERT,
            "reason": "recipient",
            "detail": "x@other.org",
        }
    ]


def test_recipient_policy_not_validated_when_unrestricted(
    mocker: MockerFixture,
) -> None:
    _stub_daos(mocker)
    find = mocker.patch(f"{MODULE}.ReportScheduleDAO.find_with_email_recipients")

    UpdateReportConfigCommand(
        {
            ReportConfigKey.ALLOWED_EMAIL_DOMAINS: [],
            ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS: False,
        }
    ).validate()

    find.assert_not_called()


def test_frequency_conflicts_only_check_matching_type(mocker: MockerFixture) -> None:
    _stub_daos(mocker)
    find_by_type = mocker.patch(
        f"{MODULE}.ReportScheduleDAO.find_by_type",
        return_value=[
            _schedule(1, "hourly", ReportScheduleType.ALERT, crontab="0 * * * *"),
            _schedule(2, "every minute", ReportScheduleType.ALERT, crontab="* * * * *"),
        ],
    )

    with pytest.raises(ReportConfigConflictError) as exc:
        UpdateReportConfigCommand(
            {ReportConfigKey.ALERT_MINIMUM_INTERVAL: 3600}
        ).validate()

    find_by_type.assert_called_once_with(ReportScheduleType.ALERT)
    assert [s["id"] for s in exc.value.impacted_schedules] == [2]
    assert exc.value.impacted_schedules[0]["reason"] == "frequency"


def test_explicit_null_reverts_to_fallback_and_skips_frequency_check(
    mocker: MockerFixture,
) -> None:
    _stub_daos(mocker)
    find_by_type = mocker.patch(f"{MODULE}.ReportScheduleDAO.find_by_type")

    # Fallback is 0 which never restricts schedules.
    UpdateReportConfigCommand(
        {ReportConfigKey.REPORT_MINIMUM_INTERVAL: None}
    ).validate()

    find_by_type.assert_not_called()


def test_recipient_checks_reuse_known_users_across_schedules(
    mocker: MockerFixture,
) -> None:
    _stub_daos(mocker)
    mocker.patch(
        f"{MODULE}.ReportScheduleDAO.find_with_email_recipients",
        return_value=[
            _schedule(1, "first", ReportScheduleType.ALERT),
            _schedule(2, "second", ReportScheduleType.REPORT),
        ],
    )
    mocker.patch(
        f"{MODULE}.get_email_addresses",
        side_effect=[
            ["Alice@example.com", "bob@example.com"],
            ["alice@example.com"],
        ],
    )
    lookup = mocker.patch(
        f"{MODULE}.ReportConfigDAO.get_known_user_emails",
        return_value={"alice@example.com"},
    )
    with pytest.raises(ReportConfigConflictError) as exc:
        UpdateReportConfigCommand(
            {ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS: True}
        ).validate()
    lookup.assert_called_once()
    assert set(lookup.call_args.args[0]) == {"alice@example.com", "bob@example.com"}
    assert [row["detail"] for row in exc.value.impacted_schedules] == [
        "bob@example.com"
    ]
