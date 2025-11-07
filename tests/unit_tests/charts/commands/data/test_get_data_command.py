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

from unittest.mock import Mock, patch

import pytest

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.common.chart_data import ChartDataResultType
from superset.common.query_context import QueryContext


def test_query_result_type_allows_validation_error_payload() -> None:
    """
    Regression test: Ensure result_type='query' with error payload returns
    the error instead of raising ChartDataQueryFailedError.

    This locks in the behavior where validation errors are passed through
    to the frontend for display in ViewQueryModal.

    Context:
    - GitHub Issue #35492
    - Superset 4.1.3 allowed errors to pass through
    - Command reorganization in 2023 broke this behavior
    - This test ensures errors pass through for query-only requests
    """
    # Mock QueryContext with result_type=QUERY
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.QUERY
    mock_query_context.get_payload.return_value = {
        "queries": [{"error": "Missing temporal column", "language": "sql"}]
    }

    command = ChartDataCommand(mock_query_context)

    # Should NOT raise - this is the key assertion for the regression test
    result = command.run()

    # Verify error is passed through in the response
    assert result["queries"][0]["error"] == "Missing temporal column"
    assert result["queries"][0]["language"] == "sql"
    assert "query" not in result["queries"][0]  # No SQL for validation errors


def test_full_result_type_raises_on_error() -> None:
    """
    Test that result_type='full' with error raises ChartDataQueryFailedError.

    This ensures data requests continue to fail fast when errors occur,
    maintaining existing behavior for non-query requests.
    """
    # Mock QueryContext with result_type=FULL
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.FULL
    mock_query_context.get_payload.return_value = {
        "queries": [{"error": "Invalid column name"}]
    }

    command = ChartDataCommand(mock_query_context)

    # Should raise exception for data requests
    with pytest.raises(ChartDataQueryFailedError) as exc_info:
        command.run()

    assert "Invalid column name" in str(exc_info.value)


def test_results_result_type_raises_on_error() -> None:
    """
    Test that result_type='results' with error raises ChartDataQueryFailedError.

    Ensures fail-fast behavior is preserved for results-only requests.
    """
    # Mock QueryContext with result_type=RESULTS
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.RESULTS
    mock_query_context.get_payload.return_value = {
        "queries": [{"error": "Database connection failed"}]
    }

    command = ChartDataCommand(mock_query_context)

    # Should raise exception for results requests
    with pytest.raises(ChartDataQueryFailedError) as exc_info:
        command.run()

    assert "Database connection failed" in str(exc_info.value)


def test_query_result_type_returns_successful_query() -> None:
    """
    Test that result_type='query' without error returns query successfully.

    Ensures no regression for successful query requests.
    """
    # Mock QueryContext with result_type=QUERY and successful query
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.QUERY
    mock_query_context.get_payload.return_value = {
        "queries": [{"query": "SELECT * FROM table", "language": "sql"}]
    }

    command = ChartDataCommand(mock_query_context)

    # Should return query successfully
    result = command.run()

    assert result["queries"][0]["query"] == "SELECT * FROM table"
    assert result["queries"][0]["language"] == "sql"
    assert "error" not in result["queries"][0]


def test_full_result_type_returns_successful_data() -> None:
    """
    Test that result_type='full' without error returns data successfully.

    Ensures no regression for successful data requests.
    """
    # Mock QueryContext with result_type=FULL and successful data
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.FULL
    mock_query_context.get_payload.return_value = {
        "queries": [{"data": [{"col1": "value1"}], "colnames": ["col1"]}]
    }

    command = ChartDataCommand(mock_query_context)

    # Should return data successfully
    result = command.run()

    assert result["queries"][0]["data"] == [{"col1": "value1"}]
    assert result["queries"][0]["colnames"] == ["col1"]
    assert "error" not in result["queries"][0]


def test_query_result_type_with_multiple_queries_and_mixed_results() -> None:
    """
    Test that result_type='query' handles multiple queries with mixed results.

    Some queries may succeed while others have validation errors.
    All should be returned without raising exceptions.
    """
    # Mock QueryContext with multiple queries
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.QUERY
    mock_query_context.get_payload.return_value = {
        "queries": [
            {"query": "SELECT * FROM table1", "language": "sql"},
            {"error": "Missing required field", "language": "sql"},
            {"query": "SELECT * FROM table2", "language": "sql"},
        ]
    }

    command = ChartDataCommand(mock_query_context)

    # Should return all queries without raising
    result = command.run()

    # Verify first query succeeded
    assert result["queries"][0]["query"] == "SELECT * FROM table1"
    assert "error" not in result["queries"][0]

    # Verify second query has error
    assert result["queries"][1]["error"] == "Missing required field"
    assert "query" not in result["queries"][1]

    # Verify third query succeeded
    assert result["queries"][2]["query"] == "SELECT * FROM table2"
    assert "error" not in result["queries"][2]


def test_full_result_type_fails_fast_on_first_error_in_multiple_queries() -> None:
    """
    Test that result_type='full' raises on first error even with multiple queries.

    Ensures fail-fast behavior when multiple queries are present.
    """
    # Mock QueryContext with multiple queries where first has error
    mock_query_context = Mock(spec=QueryContext)
    mock_query_context.result_type = ChartDataResultType.FULL
    mock_query_context.get_payload.return_value = {
        "queries": [
            {"error": "First query failed"},
            {"data": [{"col1": "value1"}]},
        ]
    }

    command = ChartDataCommand(mock_query_context)

    # Should raise on first error without processing remaining queries
    with pytest.raises(ChartDataQueryFailedError) as exc_info:
        command.run()

    assert "First query failed" in str(exc_info.value)


def test_get_query_catches_parsing_error() -> None:
    """
    Test that _get_query() catches SupersetParseError and returns both SQL and error.

    When SQL generation succeeds but optimization/parsing fails:
    - SQL has already been compiled (stored in error.extra['sql'])
    - Error message describes the parsing failure
    - Both should be returned to the frontend for display
    """
    from superset.common.query_actions import _get_query
    from superset.common.query_object import QueryObject
    from superset.exceptions import SupersetParseError

    # Create mock query_context and query_obj
    mock_query_context = Mock()
    mock_query_obj = Mock(spec=QueryObject)

    # Create SupersetParseError with SQL in error.extra
    parse_error = SupersetParseError(
        sql="SELECT SUM ( Open",  # SQL was generated before parsing failed
        engine="postgresql",
        message="Error parsing near 'Open' at line 1:17",
        line=1,
        column=17,
    )

    # Mock _get_datasource and datasource.get_query_str to raise the error
    with patch("superset.common.query_actions._get_datasource") as mock_get_ds:
        mock_datasource = Mock()
        mock_datasource.query_language = "sql"
        mock_datasource.get_query_str.side_effect = parse_error
        mock_get_ds.return_value = mock_datasource

        # GREEN: Exception is caught, values returned (new behavior after fix)
        result = _get_query(mock_query_context, mock_query_obj, False)

        # Should return both query (from error.extra['sql']) and error message
        assert result["query"] == "SELECT SUM ( Open"
        assert result["error"] == "Error parsing near 'Open' at line 1:17"
        assert result["language"] == "sql"


def test_get_query_handles_parsing_error_with_missing_sql_key() -> None:
    """
    Test _get_query() when error.extra exists but 'sql' key is missing.

    Edge case: error.extra = {"other_field": "value"} with no 'sql' key.
    Should NOT set result["query"] - prevents null from reaching TypeScript.
    Should still return error message for display.

    Ensures defensive programming when extracting SQL from exception extra data.
    """
    from superset.common.query_actions import _get_query
    from superset.common.query_object import QueryObject
    from superset.exceptions import SupersetParseError

    mock_query_context = Mock()
    mock_query_obj = Mock(spec=QueryObject)

    parse_error = SupersetParseError(
        sql="SELECT * FROM table",
        message="Parsing error occurred",
    )
    # Mock error.extra to NOT have sql key
    parse_error.error.extra = {"other_field": "some_value"}

    with patch("superset.common.query_actions._get_datasource") as mock_get_ds:
        mock_datasource = Mock()
        mock_datasource.query_language = "sql"
        mock_datasource.get_query_str.side_effect = parse_error
        mock_get_ds.return_value = mock_datasource

        result = _get_query(mock_query_context, mock_query_obj, False)

        assert "query" not in result
        assert result["error"] == "Parsing error occurred"
        assert result["language"] == "sql"


def test_get_query_handles_parsing_error_with_null_sql_value() -> None:
    """
    Test _get_query() when error.extra has 'sql': None explicitly set.

    Edge case: error.extra = {"sql": None} with sql key present but value is None.
    Should NOT set result["query"] - prevents null from reaching TypeScript.
    Should still return error message for display.

    Ensures defensive programming when extracting SQL from exception extra data.
    """
    from superset.common.query_actions import _get_query
    from superset.common.query_object import QueryObject
    from superset.exceptions import SupersetParseError

    mock_query_context = Mock()
    mock_query_obj = Mock(spec=QueryObject)

    parse_error = SupersetParseError(
        sql="SELECT * FROM table",
        message="Parsing error occurred",
    )
    # Mock error.extra to have sql key with None value
    parse_error.error.extra = {"sql": None}

    with patch("superset.common.query_actions._get_datasource") as mock_get_ds:
        mock_datasource = Mock()
        mock_datasource.query_language = "sql"
        mock_datasource.get_query_str.side_effect = parse_error
        mock_get_ds.return_value = mock_datasource

        result = _get_query(mock_query_context, mock_query_obj, False)

        assert "query" not in result
        assert result["error"] == "Parsing error occurred"
        assert result["language"] == "sql"
