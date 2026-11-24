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
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import DBAPIError

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import ChartDataQueryFailedError


class OperationalError(Exception):
    """Stand-in for pymssql's ``OperationalError``."""


def test_throttled_database_surfaces_as_typed_error(mocker: MockerFixture) -> None:
    """
    A database that rejects a connection's rollback because it reached its
    request limit (SQL Server error 10928) fails the chart request with a typed
    error instead of an unhandled server error.
    """
    throttle = DBAPIError.instance(
        None,
        None,
        OperationalError("(10928, b'The request limit for the database is 400')"),
        Exception,
    )
    query_context = mocker.MagicMock()
    query_context.get_payload.side_effect = throttle
    engine_spec = query_context.datasource.database.db_engine_spec
    engine_spec.extract_error_message.return_value = "request limit reached"

    with pytest.raises(ChartDataQueryFailedError, match="request limit reached"):
        ChartDataCommand(query_context).run()
