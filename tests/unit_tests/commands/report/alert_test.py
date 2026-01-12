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

import numpy as np
import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.commands.report.alert import AlertCommand
from superset.commands.report.exceptions import AlertValidatorConfigError
from superset.reports.models import ReportScheduleValidatorType, ReportState


def test_empty_query_result_with_operator_validator_returns_false_with_message(
    mocker: MockerFixture,
) -> None:
    """Test that empty results with operator validator returns (False, message)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
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

    triggered, message = command.run()

    assert triggered is False
    assert command._result is None
    assert message == "Query returned no rows (empty result set)"


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
    """Test that empty results return (False, message) for any operator type"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
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

    triggered, message = command.run()

    assert (
        triggered is False
    ), f"Alert with operator '{operator}' should not trigger on empty results"
    assert message == "Query returned no rows (empty result set)"


def test_empty_result_flow_sets_noop_state(mocker: MockerFixture) -> None:
    """Test that empty results lead to NOOP state with info message"""
    from superset.commands.report.execute import ReportNotTriggeredErrorState

    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
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

    update_mock.assert_any_call(
        ReportState.NOOP, error_message="Query returned no rows (empty result set)"
    )
    send_mock.assert_not_called()


def test_malformed_config_raises_error_with_valid_result(
    mocker: MockerFixture,
) -> None:
    """Test that malformed config is detected when result is valid"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [0.5]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = "invalid json"
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    with pytest.raises(AlertValidatorConfigError):
        command.run()


def test_query_returning_null_value_returns_false_with_message(
    mocker: MockerFixture,
) -> None:
    """Test that query returning NULL value returns (False, message)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [None]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": "<", "threshold": 0.75}'
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False
    assert command._result is None, "Query returning NULL should set result to None"
    assert message == "Query returned NULL value"


def test_query_returning_zero_value_sets_result_to_zero(
    mocker: MockerFixture,
) -> None:
    """Test that query returning 0 value sets result to 0.0 (not None)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [0]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": "<", "threshold": 0.75}'
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert command._result == 0.0, "Query returning 0 should set result to 0.0"
    assert triggered is True, "0 < 0.75 should trigger alert"
    assert message is None
    assert report_schedule_mock.last_value == 0.0


def test_query_returning_nan_value_returns_false_with_message(
    mocker: MockerFixture,
) -> None:
    """Test that query returning NaN value returns (False, message)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [np.nan]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": ">", "threshold": 5}'
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False
    assert command._result is None, "Query returning NaN should set result to None"
    assert message == "Query returned NULL value"


@pytest.mark.parametrize(
    "value,expected_result,operator,threshold,should_trigger",
    [
        (0, 0.0, "<", 0.75, True),
        (0.5, 0.5, "<", 0.75, True),
        (1.0, 1.0, "<", 0.75, False),
        (0, 0.0, ">=", 0, True),
    ],
)
def test_value_handling_with_valid_numbers(
    mocker: MockerFixture,
    value: float,
    expected_result: float,
    operator: str,
    threshold: float,
    should_trigger: bool,
) -> None:
    """Test proper handling of valid numeric values including 0"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [value]}),
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

    triggered, message = command.run()
    assert (
        command._result == expected_result
    ), f"Value {value} should result in {expected_result}, got {command._result}"
    assert triggered is should_trigger, (
        f"Value {value} with {operator} {threshold} should "
        f"{'trigger' if should_trigger else 'not trigger'} alert"
    )
    assert report_schedule_mock.last_value == expected_result
    if should_trigger:
        assert message is None
    else:
        assert message is None  # Non-trigger due to threshold, not NULL


@pytest.mark.parametrize(
    "value,expected_message",
    [
        (None, "Query returned NULL value"),
        (np.nan, "Query returned NULL value"),
    ],
)
def test_value_handling_with_null_and_nan(
    mocker: MockerFixture,
    value: float | None,
    expected_message: str,
) -> None:
    """Test that NULL and NaN values return (False, message)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [value]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.validator_config_json = '{"op": "<", "threshold": 0.75}'
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False
    assert message == expected_message
    assert command._result is None


def test_not_null_validator_with_valid_value_triggers_alert(
    mocker: MockerFixture,
) -> None:
    """Test NOT_NULL validator triggers with valid non-null value"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [42]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.NOT_NULL
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is True, "NOT_NULL with valid value should trigger alert"
    assert command._result == 42
    assert message is None
    assert report_schedule_mock.last_value_row_json == "42"


def test_not_null_validator_with_null_value_does_not_trigger(
    mocker: MockerFixture,
) -> None:
    """Test NOT_NULL validator normalizes NULL to None and doesn't trigger"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [None]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.NOT_NULL
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False, "NOT_NULL with NULL value should not trigger"
    assert command._result is None
    assert message == "Query returned NULL value"


def test_not_null_validator_with_nan_value_does_not_trigger(
    mocker: MockerFixture,
) -> None:
    """Test NOT_NULL validator normalizes NaN to None and doesn't trigger"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [np.nan]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.NOT_NULL
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False, "NOT_NULL with NaN value should not trigger"
    assert command._result is None
    assert message == "Query returned NULL value"


def test_not_null_validator_with_zero_value_does_not_trigger(
    mocker: MockerFixture,
) -> None:
    """Test NOT_NULL validator with 0 value does not trigger (0 is falsy)"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame({"value": [0]}),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.NOT_NULL
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False, "NOT_NULL with 0 value should not trigger"
    assert command._result == 0


def test_not_null_validator_with_empty_result_does_not_trigger(
    mocker: MockerFixture,
) -> None:
    """Test NOT_NULL validator with empty result does not trigger"""
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, *args, **kwargs: func(*args, **kwargs),
    )
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.NOT_NULL
    report_schedule_mock.id = 1

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    triggered, message = command.run()

    assert triggered is False, "NOT_NULL with empty result should not trigger"
    assert command._result is None
