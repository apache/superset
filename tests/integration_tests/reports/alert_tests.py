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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel
from contextlib import nullcontext, suppress
from typing import Optional, Union

import pandas as pd
import pytest
from flask.ctx import AppContext
from pytest_mock import MockerFixture

from superset.commands.report.exceptions import AlertQueryError
from superset.reports.models import ReportCreationMethod, ReportScheduleType
from superset.tasks.types import ExecutorType
from superset.utils.database import get_example_database
from tests.integration_tests.test_app import app


@pytest.mark.parametrize(
    "owner_names,creator_name,config,expected_result",
    [
        (["gamma"], None, [ExecutorType.SELENIUM], "admin"),
        (["gamma"], None, [ExecutorType.OWNER], "gamma"),
        (
            ["alpha", "gamma"],
            "gamma",
            [ExecutorType.CREATOR_OWNER],
            "gamma",
        ),
        (
            ["alpha", "gamma"],
            "alpha",
            [ExecutorType.CREATOR_OWNER],
            "alpha",
        ),
        (
            ["alpha", "gamma"],
            "admin",
            [ExecutorType.CREATOR_OWNER],
            AlertQueryError(),
        ),
        (["gamma"], None, [ExecutorType.CURRENT_USER], AlertQueryError()),
    ],
)
def test_execute_query_as_report_executor(
    owner_names: list[str],
    creator_name: Optional[str],
    config: list[ExecutorType],
    expected_result: Union[tuple[ExecutorType, str], Exception],
    mocker: MockerFixture,
    app_context: AppContext,
    get_user,
) -> None:
    from superset.commands.report.alert import AlertCommand
    from superset.reports.models import ReportSchedule

    original_config = app.config["ALERT_REPORTS_EXECUTE_AS"]
    app.config["ALERT_REPORTS_EXECUTE_AS"] = config
    owners = [get_user(owner_name) for owner_name in owner_names]
    report_schedule = ReportSchedule(
        created_by=get_user(creator_name) if creator_name else None,
        owners=owners,
        type=ReportScheduleType.ALERT,
        description="description",
        crontab="0 9 * * *",
        creation_method=ReportCreationMethod.ALERTS_REPORTS,
        sql="SELECT 1",
        grace_period=14400,
        working_timeout=3600,
        database=get_example_database(),
        validator_config_json='{"op": "==", "threshold": 1}',
    )
    command = AlertCommand(report_schedule=report_schedule)
    override_user_mock = mocker.patch("superset.commands.report.alert.override_user")
    cm = (
        pytest.raises(type(expected_result))
        if isinstance(expected_result, Exception)
        else nullcontext()
    )
    with cm:
        command.run()
        assert override_user_mock.call_args[0][0].username == expected_result

    app.config["ALERT_REPORTS_EXECUTE_AS"] = original_config


def test_execute_query_succeeded_no_retry(
    mocker: MockerFixture, app_context: None
) -> None:
    from superset.commands.report.alert import AlertCommand

    execute_query_mock = mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query",
        side_effect=lambda: pd.DataFrame([{"sample_col": 0}]),
    )

    command = AlertCommand(report_schedule=mocker.Mock())

    command.validate()

    assert execute_query_mock.call_count == 1


def test_execute_query_succeeded_with_retries(
    mocker: MockerFixture, app_context: None
) -> None:
    from superset.commands.report.alert import AlertCommand, AlertQueryError

    execute_query_mock = mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query"
    )

    query_executed_count = 0
    # Should match the value defined in superset_test_config.py
    expected_max_retries = 3

    def _mocked_execute_query() -> pd.DataFrame:
        nonlocal query_executed_count
        query_executed_count += 1

        if query_executed_count < expected_max_retries:
            raise AlertQueryError()
        else:
            return pd.DataFrame([{"sample_col": 0}])

    execute_query_mock.side_effect = _mocked_execute_query
    execute_query_mock.__name__ = "mocked_execute_query"

    command = AlertCommand(report_schedule=mocker.Mock())

    command.validate()

    assert execute_query_mock.call_count == expected_max_retries


def test_execute_query_failed_no_retry(
    mocker: MockerFixture, app_context: None
) -> None:
    from superset.commands.report.alert import AlertCommand, AlertQueryTimeout

    execute_query_mock = mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query"
    )

    def _mocked_execute_query() -> None:
        raise AlertQueryTimeout

    execute_query_mock.side_effect = _mocked_execute_query
    execute_query_mock.__name__ = "mocked_execute_query"

    command = AlertCommand(report_schedule=mocker.Mock())

    with suppress(AlertQueryTimeout):
        command.validate()
    assert execute_query_mock.call_count == 1


def test_execute_query_failed_max_retries(
    mocker: MockerFixture, app_context: None
) -> None:
    from superset.commands.report.alert import AlertCommand, AlertQueryError

    execute_query_mock = mocker.patch(
        "superset.commands.report.alert.AlertCommand._execute_query"
    )

    def _mocked_execute_query() -> None:
        raise AlertQueryError

    execute_query_mock.side_effect = _mocked_execute_query
    execute_query_mock.__name__ = "mocked_execute_query"

    command = AlertCommand(report_schedule=mocker.Mock())

    with suppress(AlertQueryError):
        command.validate()
    # Should match the value defined in superset_test_config.py
    assert execute_query_mock.call_count == 3
