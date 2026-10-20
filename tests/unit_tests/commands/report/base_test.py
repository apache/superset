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

import logging
from datetime import timedelta
from functools import wraps
from typing import Any, Callable
from unittest.mock import patch

import pytest
from pytest_mock import MockerFixture

from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import (
    ReportScheduleCrontabNotValidError,
    ReportScheduleFrequencyNotAllowed,
)
from superset.reports.models import ReportScheduleType

# Tuples, not sets: these feed ``@pytest.mark.parametrize``, and pytest-xdist
# requires every worker to collect the same test ids in the same order. A set
# of strings iterates in per-process hash order (PYTHONHASHSEED), so a set here
# makes workers disagree and xdist aborts with "Different tests were collected".
REPORT_TYPES: tuple[ReportScheduleType, ...] = (
    ReportScheduleType.ALERT,
    ReportScheduleType.REPORT,
)

TEST_SCHEDULES_EVERY_MINUTE: tuple[str, ...] = (
    "* * * * *",
    "1-5 * * * *",
    "10-20 * * * *",
    "0,45,10-20 * * * *",
    "23,45,50,51 * * * *",
    "10,20,30,40-45 * * * *",
)

TEST_SCHEDULES_SINGLE_MINUTES: tuple[str, ...] = (
    "1,5,8,10,12 * * * *",
    "10 1 * * *",
    "27,2 1-5 * * *",
)

TEST_SCHEDULES: tuple[str, ...] = (
    TEST_SCHEDULES_EVERY_MINUTE + TEST_SCHEDULES_SINGLE_MINUTES
)


def dynamic_alert_minimum_interval(**kwargs) -> int:
    return int(timedelta(minutes=10).total_seconds())


def dynamic_report_minimum_interval(**kwargs) -> int:
    return int(timedelta(minutes=5).total_seconds())


def app_custom_config(
    alert_minimum_interval: int | str | Callable[[], int] = 0,
    report_minimum_interval: int | str | Callable[[], int] = 0,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to mock the current_app.config values dynamically for each test.

    :param alert_minimum_interval: Minimum interval. Defaults to None.
    :param report_minimum_interval: Minimum interval. Defaults to None.

    :returns: A decorator that wraps a function.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            config_overrides = {
                "ALERT_MINIMUM_INTERVAL": alert_minimum_interval,
                "REPORT_MINIMUM_INTERVAL": report_minimum_interval,
            }
            with patch("flask.current_app.config", config_overrides):
                return func(*args, **kwargs)

        return wrapper

    return decorator


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config()
def test_validate_report_frequency(report_type: str, schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    no minimum frequency configured.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=4).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=5).total_seconds()),
)
def test_validate_report_frequency_minimum_set() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    minimum frequencies configured.
    """

    BaseReportScheduleCommand().validate_report_frequency(
        "1,5 * * * *",
        ReportScheduleType.ALERT,
    )
    BaseReportScheduleCommand().validate_report_frequency(
        "6,11 * * * *",
        ReportScheduleType.REPORT,
    )


@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=5).total_seconds()),
)
def test_validate_report_frequency_invalid_schedule() -> None:
    """
    Test the ``validate_report_frequency`` method when the configured
    schedule exceeds the limit.
    """
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,2 * * * *",
            ReportScheduleType.ALERT,
        )

    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,5 * * * *",
            ReportScheduleType.REPORT,
        )


@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=10).total_seconds()),
)
def test_validate_report_frequency_alert_only(schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for alerts and user is creating report.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        ReportScheduleType.REPORT,
    )


@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    report_minimum_interval=int(timedelta(minutes=10).total_seconds()),
)
def test_validate_report_frequency_report_only(schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for reports and user is creating alert.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        ReportScheduleType.ALERT,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=5).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=5).total_seconds()),
)
def test_validate_report_frequency_never_matching_crontab(report_type: str) -> None:
    """
    Test the ``validate_report_frequency`` method with a crontab that is
    syntactically valid but never matches a real calendar date (Feb 30th).

    Such schedules pass ``croniter.is_valid()`` (purely syntactic) and thus
    marshmallow schema validation, but raise ``CroniterBadDateError`` when
    iterated. This should surface as a ``ValidationError`` rather than
    propagating the raw croniter exception.
    """
    with pytest.raises(ReportScheduleCrontabNotValidError):
        BaseReportScheduleCommand().validate_report_frequency(
            "0 0 30 2 *",
            report_type,
        )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=1).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=1).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_one(
    report_type: str, schedule: str
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `1`. Validates the usage of `-` and `*` in the cron.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES_SINGLE_MINUTES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=2).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_two(
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `2`.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES_EVERY_MINUTE)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=2).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_two_raises(
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `2`. Validates the usage of `-` and `*` in the cron.
    """
    # Should fail for schedules with `-` and `*`
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            schedule,
            report_type,
        )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval="10 minutes",
    report_minimum_interval="10 minutes",
)
def test_validate_report_frequency_invalid_config(
    caplog: pytest.LogCaptureFixture,
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when the configuration
    is invalid.
    """
    caplog.set_level(logging.ERROR)
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )
    expected_error_message = (
        f"invalid value for {report_type}_MINIMUM_INTERVAL: 10 minutes"
    )
    assert expected_error_message.lower() in caplog.text.lower()


@app_custom_config(
    alert_minimum_interval=dynamic_alert_minimum_interval,
    report_minimum_interval=dynamic_report_minimum_interval,
)
def test_validate_report_frequency_using_callable() -> None:
    """
    Test the ``validate_report_frequency`` method when the config
    values are set to a function.
    """
    # Should fail with a 9 minutes interval, and work with 10
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,10 * * * *",
            ReportScheduleType.ALERT,
        )

    BaseReportScheduleCommand().validate_report_frequency(
        "1,11 * * * *",
        ReportScheduleType.ALERT,
    )

    # Should fail with a 4 minutes interval, and work with 5
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,5 * * * *",
            ReportScheduleType.REPORT,
        )

    BaseReportScheduleCommand().validate_report_frequency(
        "1,6 * * * *",
        ReportScheduleType.REPORT,
    )


def test_validate_alert_query_rejects_multi_statement_sql() -> None:
    """
    Alert SQL is validated at save time; multi-statement SQL cannot be
    persisted for later raw execution by the alert runner.
    """
    from unittest.mock import MagicMock

    from marshmallow import ValidationError

    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        AlertQueryMultipleStatementsValidationError,
    )

    database = MagicMock()
    database.backend = "sqlite"
    database.allow_dml = False

    exceptions: list[ValidationError] = []
    BaseReportScheduleCommand().validate_alert_query(
        database, "SELECT 1; DROP TABLE ab_user", exceptions
    )

    assert len(exceptions) == 1
    assert isinstance(exceptions[0], AlertQueryMultipleStatementsValidationError)


def test_validate_alert_query_rejects_dml_when_not_allowed() -> None:
    """A mutating alert query is rejected unless the database allows DML."""
    from unittest.mock import MagicMock

    from marshmallow import ValidationError

    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        AlertQueryDMLNotAllowedValidationError,
    )

    database = MagicMock()
    database.backend = "sqlite"
    database.allow_dml = False

    exceptions: list[ValidationError] = []
    BaseReportScheduleCommand().validate_alert_query(
        database, "UPDATE ab_user SET active = 1", exceptions
    )

    assert len(exceptions) == 1
    assert isinstance(exceptions[0], AlertQueryDMLNotAllowedValidationError)


def test_validate_alert_query_rejects_unauthorized_tables(
    mocker: MockerFixture,
) -> None:
    """A single read-only statement referencing tables the user cannot access
    is rejected via the table-level authorization check."""
    from unittest.mock import MagicMock

    from marshmallow import ValidationError

    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        AlertQueryDataAccessValidationError,
    )
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    mocker.patch(
        "superset.commands.report.base.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                message="You need access to the following tables: `secret`",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    database = MagicMock()
    database.backend = "sqlite"
    database.allow_dml = False

    exceptions: list[ValidationError] = []
    BaseReportScheduleCommand().validate_alert_query(
        database, "SELECT * FROM secret", exceptions
    )

    assert len(exceptions) == 1
    assert isinstance(exceptions[0], AlertQueryDataAccessValidationError)


# -- Report target exclusions --
#
# The related-field filter narrows the picker, but a list filter is not an
# authorisation boundary: ``_check_object_access`` resolves the posted id
# through ``find_by_id``, which applies the ordinary access filter. These go
# through that method rather than the exclusion helper in isolation, so a
# regression in the key mapping or the raise is caught.


def test_check_object_access_refuses_an_excluded_report_target(
    mocker: MockerFixture,
) -> None:
    """An excluded id posted directly must be refused, not merely hidden."""
    from superset.commands.report.exceptions import ReportScheduleForbiddenError

    excluded = mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        return_value=True,
    )
    dao = mocker.MagicMock()
    dao.find_by_id.return_value = mocker.MagicMock()

    cmd = BaseReportScheduleCommand()
    cmd._properties = {}

    with pytest.raises(ReportScheduleForbiddenError):
        cmd._check_object_access(
            42,
            kind="dashboard",
            dao=dao,
            not_found_exc=ValueError,
            exceptions=[],
        )

    # The key is derived from the kind, which is what a rename would break.
    assert excluded.call_args.args[0] == "report_target_dashboards"


def test_check_object_access_allows_a_target_that_is_not_excluded(
    mocker: MockerFixture,
) -> None:
    """With no exclusion configured the ordinary access check decides."""
    mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        return_value=False,
    )
    raise_for_access = mocker.patch(
        "superset.commands.report.base.security_manager"
    ).raise_for_access
    dao = mocker.MagicMock()
    resolved = mocker.MagicMock()
    dao.find_by_id.return_value = resolved

    cmd = BaseReportScheduleCommand()
    cmd._properties = {}
    cmd._check_object_access(
        42,
        kind="chart",
        dao=dao,
        not_found_exc=ValueError,
        exceptions=[],
    )

    raise_for_access.assert_called_once_with(chart=resolved)
    assert cmd._properties["chart"] is resolved


def test_an_update_omitting_the_target_still_checks_the_stored_one(
    mocker: MockerFixture,
) -> None:
    """Reactivating a report must not resume a schedule on a withheld target.

    ``PUT /api/v1/report/<id>`` with only ``{"active": true}`` reaches the
    branch that takes the target from the stored model, so without this the
    schedule resumes while resubmitting that same target is refused.
    """
    from superset.commands.report.exceptions import ReportScheduleForbiddenError

    excluded = mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        return_value=True,
    )

    cmd = BaseReportScheduleCommand()
    cmd._properties = {"active": True}
    # The class declares no ``_model``; production reads it via ``getattr``.
    cmd._model = mocker.MagicMock(chart_id=None, dashboard_id=9)

    with pytest.raises(ReportScheduleForbiddenError):
        cmd.validate_chart_dashboard([], update=True)

    assert excluded.call_args.args == ("report_target_dashboards", 9)


def test_an_update_omitting_the_target_passes_when_not_withheld(
    mocker: MockerFixture,
) -> None:
    """With no exclusion configured the stored target is left alone."""
    mocker.patch(
        "superset.commands.report.base.is_excluded_by_extra_access",
        return_value=False,
    )

    cmd = BaseReportScheduleCommand()
    cmd._properties = {"active": True}
    # The class declares no ``_model``; production reads it via ``getattr``.
    cmd._model = mocker.MagicMock(chart_id=None, dashboard_id=9)

    exceptions: list[Any] = []
    cmd.validate_chart_dashboard(exceptions, update=True)
    assert exceptions == []
