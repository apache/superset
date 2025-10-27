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
from superset.commands.report.exceptions import AlertQueryError
from superset.reports.models import ReportScheduleValidatorType


def test_empty_query_result_with_operator_validator_raises_error(
    mocker: MockerFixture,
) -> None:
    """Test that empty results with operator validator raise AlertQueryError"""
    # Mock the retry_call to directly call the function without backoff
    mocker.patch(
        "superset.commands.report.alert.retry_call",
        side_effect=lambda func, **kwargs: func(),
    )

    # Mock _execute_query to return empty DataFrame
    mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        return_value=pd.DataFrame(),
    )

    # Create mock report schedule with operator validator
    report_schedule_mock = mocker.Mock()
    report_schedule_mock.validator_type = ReportScheduleValidatorType.OPERATOR
    report_schedule_mock.id = 1
    report_schedule_mock.sql = "SELECT value FROM metrics WHERE value < 0.75"

    command = AlertCommand(
        report_schedule=report_schedule_mock,
        execution_id=uuid4(),
    )

    # Verify AlertQueryError is raised with correct message
    with pytest.raises(AlertQueryError, match="Alert query returned no results"):
        command.validate()
