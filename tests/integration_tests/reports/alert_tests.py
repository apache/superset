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

import pandas as pd
from pytest_mock import MockFixture


def test_execute_query_succeeded_no_retry(
    mocker: MockFixture, app_context: None
) -> None:

    from superset.reports.commands.alert import AlertCommand

    execute_query_mock = mocker.patch(
        "superset.reports.commands.alert.AlertCommand._execute_query",
        side_effect=lambda: pd.DataFrame([{"sample_col": 0}]),
    )

    command = AlertCommand(report_schedule=mocker.Mock())

    command.validate()

    assert execute_query_mock.call_count == 1


def test_execute_query_succeeded_with_retries(
    mocker: MockFixture, app_context: None
) -> None:
    from superset.reports.commands.alert import AlertCommand, AlertQueryError

    execute_query_mock = mocker.patch(
        "superset.reports.commands.alert.AlertCommand._execute_query"
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


def test_execute_query_failed_no_retry(mocker: MockFixture, app_context: None) -> None:
    from superset.reports.commands.alert import AlertCommand, AlertQueryTimeout

    execute_query_mock = mocker.patch(
        "superset.reports.commands.alert.AlertCommand._execute_query"
    )

    def _mocked_execute_query() -> None:
        raise AlertQueryTimeout

    execute_query_mock.side_effect = _mocked_execute_query
    execute_query_mock.__name__ = "mocked_execute_query"

    command = AlertCommand(report_schedule=mocker.Mock())

    try:
        command.validate()
    except AlertQueryTimeout:
        pass

    assert execute_query_mock.call_count == 1


def test_execute_query_failed_max_retries(
    mocker: MockFixture, app_context: None
) -> None:
    from superset.reports.commands.alert import AlertCommand, AlertQueryError

    execute_query_mock = mocker.patch(
        "superset.reports.commands.alert.AlertCommand._execute_query"
    )

    def _mocked_execute_query() -> None:
        raise AlertQueryError

    execute_query_mock.side_effect = _mocked_execute_query
    execute_query_mock.__name__ = "mocked_execute_query"

    command = AlertCommand(report_schedule=mocker.Mock())

    try:
        command.validate()
    except AlertQueryError:
        pass

    # Should match the value defined in superset_test_config.py
    assert execute_query_mock.call_count == 3
