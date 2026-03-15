# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# \"License\"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# \"AS IS\" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Unit tests for SQL Lab Streaming CSV Export Command."""

from unittest.mock import MagicMock, Mock, patch

import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.streaming_export_command import (
    StreamingSqlResultExportCommand,
)
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException
from superset.sqllab.limiting_factor import LimitingFactor


def _setup_sqllab_mocks(
    mocker: MockerFixture, mock_query: MagicMock
) -> tuple[MagicMock, MagicMock]:
    """Set up common mocks for SQL Lab streaming export tests."""
    mock_db_base = mocker.patch("superset.commands.streaming_export.base.db")
    mock_session = MagicMock()
    mock_db_base.session.return_value.__enter__.return_value = mock_session
    mock_session.merge.return_value = mock_query.database

    mock_db_sqllab = mocker.patch(
        "superset.commands.sql_lab.streaming_export_command.db"
    )
    mock_query_result = mock_db_sqllab.session.query.return_value.filter_by.return_value
    mock_query_result.one_or_none.return_value = mock_query

    return mock_db_base, mock_session


@pytest.fixture
def mock_query():
    """Create a mock SQL Lab query."""
    query = MagicMock()
    query.client_id = "test_client_123"
    query.select_sql = None
    query.executed_sql = "SELECT * FROM test_table"
    query.limiting_factor = LimitingFactor.NOT_LIMITED
    query.database = MagicMock()
    query.database.db_engine_spec = MagicMock()
    query.database.db_engine_spec.engine = "postgresql"
    query.raise_for_access = MagicMock()
    return query


@pytest.fixture
def mock_result_proxy():
    """Create a mock database result proxy."""
    result = MagicMock()
    result.keys.return_value = ["id", "name", "value"]
    result.fetchmany.side_effect = [
        [(1, "test1", 100), (2, "test2", 200)],
        [(3, "test3", 300)],
        [],
    ]
    return result


def test_streaming_sql_result_export_command_init():
    """Test command initialization."""
    command = StreamingSqlResultExportCommand("client_123", chunk_size=500)

    assert command._client_id == "client_123"
    assert command._chunk_size == 500
    assert command._query is None
    assert command._current_app is not None


def test_streaming_sql_result_export_command_default_chunk_size():
    """Test command uses default chunk size."""
    command = StreamingSqlResultExportCommand("client_123")

    assert command._chunk_size == 1000


@patch("superset.commands.sql_lab.streaming_export_command.db")
def test_validate_query_not_found(mock_db):
    """Test validate raises exception when query is not found."""
    mock_query_result = mock_db.session.query.return_value.filter_by.return_value
    mock_query_result.one_or_none.return_value = None

    command = StreamingSqlResultExportCommand("nonexistent_client")

    with pytest.raises(SupersetErrorException) as exc_info:
        command.validate()

    assert exc_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR
    assert exc_info.value.status == 404


@patch("superset.commands.sql_lab.streaming_export_command.db")
def test_validate_access_denied(mock_db, mock_query):
    """Test validate raises exception when access is denied."""
    mock_query_result = mock_db.session.query.return_value.filter_by.return_value
    mock_query_result.one_or_none.return_value = mock_query
    mock_query.raise_for_access.side_effect = SupersetSecurityException(
        Mock(message="Access denied")
    )

    command = StreamingSqlResultExportCommand("test_client_123")

    with pytest.raises(SupersetErrorException) as exc_info:
        command.validate()

    assert (
        exc_info.value.error.error_type == SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR
    )
    assert exc_info.value.status == 403


@patch("superset.commands.sql_lab.streaming_export_command.db")
def test_validate_success(mock_db, mock_query):
    """Test successful validation."""
    mock_query_result = mock_db.session.query.return_value.filter_by.return_value
    mock_query_result.one_or_none.return_value = mock_query

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    assert command._query == mock_query
    mock_query.raise_for_access.assert_called_once()


def test_csv_generation_with_select_sql(mocker, mock_query, mock_result_proxy):
    """Test CSV generation when query has select_sql."""
    mock_query.select_sql = "SELECT * FROM test WHERE id > 0"
    mock_query.executed_sql = None

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = (
        mock_result_proxy
    )
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123", chunk_size=2)
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    chunks = list(generator)

    csv_data = "".join(chunks)
    lines = [line.strip() for line in csv_data.strip().split("\n")]

    assert len(lines) == 4
    assert lines[0] == "id,name,value"
    assert "1,test1,100" in csv_data
    assert "2,test2,200" in csv_data
    assert "3,test3,300" in csv_data


@patch("superset.commands.sql_lab.streaming_export_command.SQLScript")
def test_csv_generation_with_executed_sql_and_limit(
    mock_sqlscript, mocker, mock_query, mock_result_proxy
):
    """Test CSV generation with executed_sql and applies limit."""
    mock_query.select_sql = None
    mock_query.executed_sql = "SELECT * FROM test LIMIT 2"
    mock_query.limiting_factor = LimitingFactor.QUERY

    mock_statement = Mock()
    mock_statement.get_limit_value.return_value = 3
    mock_script_instance = Mock()
    mock_script_instance.statements = [mock_statement]
    mock_sqlscript.return_value = mock_script_instance

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_result = MagicMock()
    mock_result.keys.return_value = ["id", "name"]
    mock_result.fetchmany.side_effect = [
        [(1, "test1"), (2, "test2"), (3, "test3"), (4, "test4")],
        [],
    ]

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123", chunk_size=10)
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 3  # header + 2 rows (limit - 1)


def test_csv_generation_with_special_characters(mocker, mock_query):
    """Test CSV generation properly escapes special characters."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["text", "description"]
    mock_result.fetchmany.side_effect = [
        [('Text with "quotes"', "Line\nbreak"), ("Comma,value", "Tab\tchar")],
        [],
    ]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    assert '"Text with ""quotes"""' in csv_data  # Quotes doubled
    assert "Line\nbreak" in csv_data
    assert '"Comma,value"' in csv_data
    assert "Tab\tchar" in csv_data


def test_limiting_factor_dropdown(mocker, mock_query):
    """Test limit adjustment for DROPDOWN limiting factor."""
    mock_query.select_sql = None
    mock_query.executed_sql = "SELECT * FROM test LIMIT 101"
    mock_query.limiting_factor = LimitingFactor.DROPDOWN

    with patch(
        "superset.commands.sql_lab.streaming_export_command.SQLScript"
    ) as mock_sqlscript:
        mock_statement = Mock()
        mock_statement.get_limit_value.return_value = 101
        mock_script_instance = Mock()
        mock_script_instance.statements = [mock_statement]
        mock_sqlscript.return_value = mock_script_instance

        mock_result = MagicMock()
        mock_result.keys.return_value = ["id"]
        mock_result.fetchmany.side_effect = [[(i,) for i in range(101)], []]

        mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

        mock_connection = MagicMock()
        mock_connection.execution_options.return_value.execute.return_value = (
            mock_result
        )
        mock_connection.__enter__.return_value = mock_connection
        mock_connection.__exit__.return_value = None

        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_connection
        mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
            mock_engine
        )

        command = StreamingSqlResultExportCommand("test_client_123", chunk_size=200)
        command.validate()

        csv_generator_callable = command.run()
        generator = csv_generator_callable()
        csv_data = "".join(generator)

        lines = [line.strip() for line in csv_data.strip().split("\n")]
        assert len(lines) == 101


def test_limiting_factor_query_and_dropdown(mocker, mock_query):
    """Test limit adjustment for QUERY_AND_DROPDOWN limiting factor."""
    mock_query.select_sql = None
    mock_query.executed_sql = "SELECT * FROM test LIMIT 51"
    mock_query.limiting_factor = LimitingFactor.QUERY_AND_DROPDOWN

    with patch(
        "superset.commands.sql_lab.streaming_export_command.SQLScript"
    ) as mock_sqlscript:
        mock_statement = Mock()
        mock_statement.get_limit_value.return_value = 51
        mock_script_instance = Mock()
        mock_script_instance.statements = [mock_statement]
        mock_sqlscript.return_value = mock_script_instance

        mock_result = MagicMock()
        mock_result.keys.return_value = ["id"]
        mock_result.fetchmany.side_effect = [[(i,) for i in range(51)], []]

        mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

        mock_connection = MagicMock()
        mock_connection.execution_options.return_value.execute.return_value = (
            mock_result
        )
        mock_connection.__enter__.return_value = mock_connection
        mock_connection.__exit__.return_value = None

        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_connection
        mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
            mock_engine
        )

        command = StreamingSqlResultExportCommand("test_client_123", chunk_size=100)
        command.validate()

        csv_generator_callable = command.run()
        generator = csv_generator_callable()
        csv_data = "".join(generator)

        lines = [line.strip() for line in csv_data.strip().split("\n")]
        assert len(lines) == 51


def test_empty_result_set(mocker, mock_query):
    """Test CSV generation with empty result set."""
    mock_query.select_sql = "SELECT * FROM empty_table"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["col1", "col2"]
    mock_result.fetchmany.side_effect = [[]]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 1
    assert lines[0] == "col1,col2"


def test_error_handling_yields_error_marker(mocker, mock_query):
    """Test that exceptions are caught and error marker is yielded."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_db_base = mocker.patch("superset.commands.streaming_export.base.db")
    mock_session = MagicMock()
    mock_db_base.session.return_value.__enter__.return_value = mock_session
    mock_session.merge.side_effect = Exception("Database connection failed")

    mock_db_sqllab = mocker.patch(
        "superset.commands.sql_lab.streaming_export_command.db"
    )
    mock_query_result = mock_db_sqllab.session.query.return_value.filter_by.return_value
    mock_query_result.one_or_none.return_value = mock_query

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    chunks = list(generator)

    error_output = "".join(chunks)
    assert "__STREAM_ERROR__" in error_output
    assert "Export failed" in error_output


def test_connection_is_closed_after_streaming(mocker, mock_query, mock_result_proxy):
    """Test that database connection is properly closed."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = (
        mock_result_proxy
    )
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    # With context managers, __exit__ is called to cleanup the connection
    mock_connection.__exit__.assert_called_once()


def test_streaming_execution_options_enabled(mocker, mock_query, mock_result_proxy):
    """Test that streaming execution options are enabled."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_execution_options = Mock()
    mock_connection.execution_options.return_value = mock_execution_options
    mock_execution_options.execute.return_value = mock_result_proxy
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    mock_connection.execution_options.assert_called_once_with(stream_results=True)


@patch("superset.commands.streaming_export.base.logger")
def test_completion_logging(mock_logger, mocker, mock_query, mock_result_proxy):
    """Test that completion is logged with metrics."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = (
        mock_result_proxy
    )
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    assert mock_logger.info.called
    log_message = str(mock_logger.info.call_args)
    assert "Streaming CSV completed" in log_message
    assert "rows" in log_message


def test_null_values_handling(mocker, mock_query):
    """Test CSV generation handles NULL values correctly."""
    mock_query.select_sql = "SELECT * FROM test"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["id", "name", "value"]
    mock_result.fetchmany.side_effect = [
        [(1, None, 100), (2, "test", None), (None, None, None)],
        [],
    ]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 4
    assert "1,,100" in csv_data
    assert "2,test," in csv_data
    assert ",," in csv_data


def test_csv_export_config_custom_separator(mocker, mock_query):
    """
    Test that streaming CSV export respects CSV_EXPORT config
    for custom separator (sep).

    This is a regression test for GitHub issue #32371.
    """
    mock_query.select_sql = "SELECT * FROM test"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["id", "name"]
    mock_result.fetchmany.side_effect = [
        [(1, "Alice"), (2, "Bob")],
        [],
    ]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    # Mock the app config to use semicolon separator
    mocker.patch(
        "superset.commands.streaming_export.base.app.config.get",
        return_value={"sep": ";", "encoding": "utf-8"},
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    # With sep=";", columns should be separated by semicolon
    assert "id;name" in csv_data
    assert "1;Alice" in csv_data
    assert "2;Bob" in csv_data


def test_csv_export_config_custom_decimal(mocker, mock_query):
    """
    Test that streaming CSV export respects CSV_EXPORT config
    for custom decimal separator.

    This is a regression test for GitHub issue #32371.
    """
    mock_query.select_sql = "SELECT * FROM test"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["id", "price"]
    mock_result.fetchmany.side_effect = [
        [(1, 12.34), (2, 56.78)],
        [],
    ]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    # Mock the app config to use comma as decimal separator
    mocker.patch(
        "superset.commands.streaming_export.base.app.config.get",
        return_value={"sep": ";", "decimal": ",", "encoding": "utf-8"},
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    # With decimal=",", float values should use comma
    assert "12,34" in csv_data
    assert "56,78" in csv_data


def test_csv_export_config_combined_sep_and_decimal(mocker, mock_query):
    """
    Test that streaming CSV export respects both sep and decimal from CSV_EXPORT.

    This is a regression test for GitHub issue #32371.
    """
    mock_query.select_sql = "SELECT * FROM test"

    mock_result = MagicMock()
    mock_result.keys.return_value = ["id", "name", "price"]
    mock_result.fetchmany.side_effect = [
        [(1, "Widget", 99.99), (2, "Gadget", 149.50)],
        [],
    ]

    mock_db, mock_session = _setup_sqllab_mocks(mocker, mock_query)

    mock_connection = MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_query.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    # Mock the app config to use European format
    mocker.patch(
        "superset.commands.streaming_export.base.app.config.get",
        return_value={"sep": ";", "decimal": ",", "encoding": "utf-8"},
    )

    command = StreamingSqlResultExportCommand("test_client_123")
    command.validate()

    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    # Verify header uses semicolon separator
    assert "id;name;price" in csv_data
    # Verify data uses semicolon separator and comma decimal
    assert "1;Widget;99,99" in csv_data
    assert "2;Gadget;149,5" in csv_data or "2;Gadget;149,50" in csv_data
