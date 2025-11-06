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

from uuid import uuid4

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.commands.report.alert import AlertCommand
from superset.commands.report.exceptions import AlertValidatorConfigError
from superset.reports.models import ReportScheduleValidatorType, ReportState


def test_empty_query_result_with_operator_validator_sets_none(
    mocker: MockerFixture,
) -> None:
    """Test that empty results with operator validator set result to None"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, **kwargs: func(),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": "<", "threshold": 0.75}'
    report_schedule_mock.id = 1
    report_schedule_mock.sql = "SELECT value FROM metrics WHERE value < 0.75"

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    command.validate()
    assert command._result is None

    triggered = command.run()
    assert triggered is False
    assert report_schedule_mock.last_value is None


@pytest.mark.parametrize(
    "operator,threshold",
    [
        ("<", 0.75),
        ("<=", 100),
        (">", 50),
        (">=", 0),
        ("==", 42),
        ("!=", 0),
    ],
)
def test_empty_result_prevents_false_alerts_for_all_operators(
    mocker: MockerFixture,
    operator: str,
    threshold: float,
) -> None:
    """Test that empty results don't trigger false alerts for any operator type"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, **kwargs: func(),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = (
        f'{{"op": "{operator}", "threshold": {threshold}}}'
    )
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered = command.run()
    assert triggered is False, (
        f"Alert with operator '{operator}' should not trigger on empty results"
    )


def test_empty_result_flow_sets_noop_state(mocker: MockerFixture) -> None:
    """Test that empty results lead to NOOP state and no notification is sent"""
    from superset.commands.report.execute import ReportNotTriggeredErrorState

    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, **kwargs: func(),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.type = "Alert"
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": "<", "threshold": 0.75}'
    report_schedule_mock.id = 1
    report_schedule_mock.last_state = ReportState.NOOP

    state = ReportNotTriggeredErrorState(
        report_schedule=report_schedule_mock,
        scheduled_dttm=mocker.Mock(),
        execution_id=uuid4(),
    )

    send_mock = mocker.patch.object(state, "send")
    update_mock = mocker.patch.object(state, "update_report_schedule_and_log")

    state.next()

    update_mock.assert_any_call(ReportState.NOOP)
    send_mock.assert_not_called()


def test_malformed_config_raises_error_even_with_empty_result(
    mocker: MockerFixture,
) -> None:
    """Test that malformed config is detected even when result is None"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, **kwargs: func(),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = "invalid json"
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    command.validate()
    assert command._result is None

    with pytest.raises(AlertValidatorConfigError):
        command.run()
