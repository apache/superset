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

import datetime
import sqlite3
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.utils import ping
from tests.conftest import with_config


@pytest.fixture
def mock_engine(mocker: MockerFixture) -> tuple[MagicMock, MagicMock, MagicMock]:
    mock_connection = mocker.MagicMock()
    mock_engine = mocker.MagicMock()
    mock_dialect = mocker.MagicMock()
    mock_engine.raw_connection.return_value = mock_connection
    mock_engine.dialect = mock_dialect
    return mock_engine, mock_connection, mock_dialect


@with_config({"TEST_DATABASE_CONNECTION_TIMEOUT": datetime.timedelta(seconds=10)})
def test_ping_success(mock_engine: MockerFixture):
    """
    Test the ``ping`` method.
    """
    mock_engine, mock_connection, mock_dialect = mock_engine
    mock_dialect.do_ping.return_value = True

    result = ping(mock_engine)

    assert result is True

    mock_engine.raw_connection.assert_called_once()
    mock_dialect.do_ping.assert_called_once_with(mock_connection)


@with_config({"TEST_DATABASE_CONNECTION_TIMEOUT": datetime.timedelta(seconds=10)})
def test_ping_sqlite_exception(mocker: MockerFixture, mock_engine: MockerFixture):
    """
    Test the ``ping`` method when a sqlite3.ProgrammingError is raised.
    """
    mock_engine, mock_connection, mock_dialect = mock_engine
    mock_dialect.do_ping.side_effect = [sqlite3.ProgrammingError, True]

    result = ping(mock_engine)

    assert result is True

    mock_dialect.do_ping.assert_has_calls(
        [mocker.call(mock_connection), mocker.call(mock_engine)]
    )


def test_ping_runtime_exception(mocker: MockerFixture, mock_engine: MockerFixture):
    """
    Test the ``ping`` method when a RuntimeError is raised.
    """
    mock_engine, _, mock_dialect = mock_engine
    mock_timeout = mocker.patch("superset.commands.database.utils.timeout")
    mock_timeout.side_effect = RuntimeError("timeout")
    mock_dialect.do_ping.return_value = True

    result = ping(mock_engine)

    assert result is True
    mock_dialect.do_ping.assert_called_once_with(mock_engine)
