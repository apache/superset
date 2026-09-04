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
"""Unit tests for Chart Streaming CSV Export Command."""

import pytest
from pytest_mock import MockerFixture

from superset.commands.chart.data.streaming_export_command import (
    StreamingCSVExportCommand,
)


def _setup_chart_mocks(
    mocker: MockerFixture, sql: str = "SELECT * FROM test"
) -> tuple[MockerFixture, MockerFixture, MockerFixture]:
    """Set up common mocks for chart streaming export tests."""
    mock_db = mocker.patch("superset.commands.streaming_export.base.db")
    mock_session = mocker.MagicMock()
    mock_db.session.return_value.__enter__.return_value = mock_session

    query_context = mocker.MagicMock()
    datasource = mocker.MagicMock()
    datasource.get_query_str.return_value = sql
    datasource.database = mocker.MagicMock()
    query_context.datasource = datasource
    query_context.queries = [mocker.MagicMock()]
    mock_session.merge.return_value = datasource.database

    return mock_db, query_context, datasource


def test_streaming_csv_export_command_init(mocker: MockerFixture) -> None:
    """Test command initialization."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context, chunk_size=500)

    assert command._query_context == query_context
    assert command._chunk_size == 500
    assert command._current_app is not None


def test_streaming_csv_export_command_default_chunk_size(
    mocker: MockerFixture,
) -> None:
    """Test command uses default chunk size."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context)

    assert command._chunk_size == 1000


def test_validate_calls_raise_for_access(mocker: MockerFixture) -> None:
    """Test validate method calls query context raise_for_access."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context)

    command.validate()

    query_context.raise_for_access.assert_called_once()


def test_validate_raises_exception_on_access_denied(mocker: MockerFixture) -> None:
    """Test validate raises exception when access is denied."""
    query_context = mocker.MagicMock()
    query_context.raise_for_access.side_effect = Exception("Access denied")
    command = StreamingCSVExportCommand(query_context)

    with pytest.raises(Exception, match="Access denied"):
        command.validate()


def test_csv_generation_with_small_dataset(mocker: MockerFixture) -> None:
    """Test CSV generation with a small dataset."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result_proxy = mocker.MagicMock()
    mock_result_proxy.keys.return_value = ["col1", "col2", "col3"]
    mock_result_proxy.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = (
        mock_result_proxy
    )
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=2)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()

    chunks = list(generator)

    csv_data = "".join(chunks)
    lines = [line.strip() for line in csv_data.strip().split("\n")]

    assert len(lines) == 4
    assert lines[0] == "col1,col2,col3"
    assert "row1_val1,row1_val2,row1_val3" in csv_data
    assert "row2_val1,row2_val2,row2_val3" in csv_data
    assert "row3_val1,row3_val2,row3_val3" in csv_data


def test_csv_generation_with_special_characters(mocker: MockerFixture) -> None:
    """Test CSV generation properly escapes special characters."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["name", "description"]
    mock_result.fetchmany.side_effect = [
        [("John, Jr.", 'Quote"Test'), ("Line\nBreak", "Comma,Value")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=10)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    assert '"John, Jr."' in csv_data
    assert '"Quote""Test"' in csv_data
    assert "Line\nBreak" in csv_data
    assert '"Comma,Value"' in csv_data


def test_streaming_with_null_values(mocker: MockerFixture) -> None:
    """Test CSV generation handles NULL values correctly."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1", "col2", "col3"]
    mock_result.fetchmany.side_effect = [
        [("value1", None, "value3"), (None, "value2", None)],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=10)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = csv_data.strip().split("\n")
    assert len(lines) == 3
    assert "value1,,value3" in csv_data
    assert ",value2," in csv_data


def test_streaming_execution_options_enabled(mocker: MockerFixture) -> None:
    """Test that streaming execution options are enabled."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result_proxy = mocker.MagicMock()
    mock_result_proxy.keys.return_value = ["col1", "col2", "col3"]
    mock_result_proxy.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_execution_options = mocker.MagicMock()
    mock_connection.execution_options.return_value = mock_execution_options
    mock_execution_options.execute.return_value = mock_result_proxy
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    mock_connection.execution_options.assert_called_once_with(stream_results=True)


def test_empty_result_set(mocker: MockerFixture) -> None:
    """Test CSV generation with empty result set."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1", "col2"]
    mock_result.fetchmany.side_effect = [[]]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 1
    assert lines[0] == "col1,col2"
