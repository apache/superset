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
    mocker: MockerFixture,
    sql: str = "SELECT * FROM test",
    catalog: str | None = None,
    schema: str | None = None,
) -> tuple[MockerFixture, MockerFixture, MockerFixture]:
    """Set up common mocks for chart streaming export tests."""
    mock_db = mocker.patch("superset.commands.streaming_export.base.db")
    mock_session = mocker.MagicMock()
    mock_db.session.return_value.__enter__.return_value = mock_session

    query_context = mocker.MagicMock()
    datasource = mocker.MagicMock()
    datasource.get_query_str.return_value = sql
    datasource.database = mocker.MagicMock()
    datasource.catalog = catalog
    datasource.schema = schema
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

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",), ("col2",), ("col3",)]
    mock_cursor.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
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

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("name",), ("description",)]
    mock_cursor.fetchmany.side_effect = [
        [("John, Jr.", 'Quote"Test'), ("Line\nBreak", "Comma,Value")],
        [],
    ]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
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

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",), ("col2",), ("col3",)]
    mock_cursor.fetchmany.side_effect = [
        [("value1", None, "value3"), (None, "value2", None)],
        [],
    ]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
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
    """Test that get_raw_connection is used for streaming (not get_sqla_engine)."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",), ("col2",), ("col3",)]
    mock_cursor.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    # Verify get_raw_connection is used (not get_sqla_engine)
    datasource.database.get_raw_connection.assert_called_once_with(
        catalog=None, schema=None
    )


def test_empty_result_set(mocker: MockerFixture) -> None:
    """Test CSV generation with empty result set."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",), ("col2",)]
    mock_cursor.fetchmany.side_effect = [[]]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 1
    assert lines[0] == "col1,col2"


def test_catalog_and_schema_passed_to_engine(mocker: MockerFixture) -> None:
    """Test that catalog and schema are forwarded to get_raw_connection."""
    mock_db, query_context, datasource = _setup_chart_mocks(
        mocker, catalog="my_catalog", schema="my_schema"
    )

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",)]
    mock_cursor.fetchmany.side_effect = [[("val",)], []]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
    )

    command = StreamingCSVExportCommand(query_context)
    list(command.run()())

    datasource.database.get_raw_connection.assert_called_once_with(
        catalog="my_catalog",
        schema="my_schema",
    )


def test_sql_mutation_applied_before_execution(mocker: MockerFixture) -> None:
    """Test that mutate_sql_based_on_config is called before executing SQL.

    Regression test for #40465: the streaming export path was executing raw
    SQL without applying SQL_QUERY_MUTATOR config, leaving trailing semicolons
    unstripped for engines like Trino that reject them.
    """
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)
    datasource.database.mutate_sql_based_on_config.return_value = "SELECT 1 LIMIT 10"

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",)]
    mock_cursor.fetchmany.side_effect = [[(1,)], []]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
    )

    command = StreamingCSVExportCommand(query_context)
    list(command.run()())

    # SQL mutation must be called before execution
    datasource.database.mutate_sql_based_on_config.assert_called_once_with(
        "SELECT * FROM test"
    )
    # The mutated SQL (not the original) should be sent to the cursor
    mock_cursor.execute.assert_called_once_with("SELECT 1 LIMIT 10")


def test_get_raw_connection_used_instead_of_get_sqla_engine(
    mocker: MockerFixture,
) -> None:
    """Test that get_raw_connection is used for proper user impersonation.

    Regression test for #40465: the streaming export path used
    get_sqla_engine() directly, bypassing user impersonation. This meant
    all streaming CSV exports ran as the service principal instead of the
    logged-in user, breaking audit trails and potentially bypassing
    per-user authorization (Ranger, OPA, RLS views).
    """
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_cursor = mocker.MagicMock()
    mock_cursor.description = [("col1",)]
    mock_cursor.fetchmany.side_effect = [[("val",)], []]

    mock_conn = mocker.MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    datasource.database.get_raw_connection.return_value.__enter__.return_value = (
        mock_conn
    )

    command = StreamingCSVExportCommand(query_context)
    list(command.run()())

    # Must use get_raw_connection (handles impersonation, SSH, OAuth2)
    datasource.database.get_raw_connection.assert_called_once()
    # Must NOT use get_sqla_engine directly (bypasses impersonation)
    datasource.database.get_sqla_engine.assert_not_called()
