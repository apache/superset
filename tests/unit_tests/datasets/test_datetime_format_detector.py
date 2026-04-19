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
"""Tests for datetime format detector."""

from unittest.mock import MagicMock

import pandas as pd
import pytest

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.datasets.datetime_format_detector import DatetimeFormatDetector


@pytest.fixture
def mock_dataset() -> MagicMock:
    """Create a mock dataset for testing."""
    dataset = MagicMock(spec=SqlaTable)
    dataset.table_name = "test_table"
    dataset.schema = "test_schema"
    dataset.is_virtual = False

    # Mock the database engine and dialect for identifier quoting
    mock_engine = MagicMock()
    mock_dialect = MagicMock()
    mock_dialect.identifier_preparer.quote = lambda x: f'"{x}"'
    mock_engine.dialect = mock_dialect

    # Mock the context manager returned by get_sqla_engine()
    dataset.database.get_sqla_engine.return_value.__enter__.return_value = mock_engine
    dataset.database.get_sqla_engine.return_value.__exit__.return_value = None

    # Mock apply_limit_to_sql to return SQL with LIMIT
    dataset.database.apply_limit_to_sql = (
        lambda sql, limit, force: f"{sql} LIMIT {limit}"
    )

    return dataset


@pytest.fixture
def mock_column() -> MagicMock:
    """Create a mock datetime column for testing."""
    column = MagicMock(spec=TableColumn)
    column.column_name = "date_column"
    column.is_temporal = True
    column.datetime_format = None
    column.expression = None  # Not an expression column
    return column


def test_detect_column_format_success(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test successful format detection for a column."""
    # Create sample data with known format
    sample_data = pd.DataFrame(
        {"date_column": ["2023-01-01", "2023-01-02", "2023-01-03"]}
    )

    # Mock database query
    mock_dataset.database.get_df.return_value = sample_data

    detector = DatetimeFormatDetector(sample_size=100)
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format == "%Y-%m-%d"
    mock_dataset.database.get_df.assert_called_once()


def test_detect_column_format_non_temporal(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test that non-temporal columns are skipped."""
    mock_column.is_temporal = False

    detector = DatetimeFormatDetector()
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format is None
    mock_dataset.database.get_df.assert_not_called()


def test_detect_column_format_empty_data(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test format detection with empty data."""
    # Return empty DataFrame
    mock_dataset.database.get_df.return_value = pd.DataFrame()

    detector = DatetimeFormatDetector()
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format is None


def test_detect_column_format_error_handling(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test error handling during format detection."""
    # Simulate database error
    mock_dataset.database.get_df.side_effect = Exception("Database error")

    detector = DatetimeFormatDetector()
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format is None


def test_detect_all_formats(mock_dataset: MagicMock) -> None:
    """Test detecting formats for all temporal columns."""
    # Create mock columns
    col1 = MagicMock(spec=TableColumn)
    col1.column_name = "date1"
    col1.is_temporal = True
    col1.datetime_format = None
    col1.expression = None

    col2 = MagicMock(spec=TableColumn)
    col2.column_name = "date2"
    col2.is_temporal = True
    col2.datetime_format = None
    col2.expression = None

    col3 = MagicMock(spec=TableColumn)
    col3.column_name = "text_col"
    col3.is_temporal = False
    col3.expression = None

    mock_dataset.columns = [col1, col2, col3]

    # Mock database queries
    sample_data1 = pd.DataFrame({"date1": ["2023-01-01", "2023-01-02"]})
    sample_data2 = pd.DataFrame({"date2": ["01/15/2023", "01/16/2023"]})

    mock_dataset.database.get_df.side_effect = [sample_data1, sample_data2]

    detector = DatetimeFormatDetector()
    results = detector.detect_all_formats(mock_dataset)

    assert "date1" in results
    assert "date2" in results
    assert "text_col" not in results
    assert results["date1"] == "%Y-%m-%d"
    assert results["date2"] == "%m/%d/%Y"


def test_detect_all_formats_skip_existing(mock_dataset: MagicMock) -> None:
    """Test that columns with existing formats are skipped unless forced."""
    # Create column with existing format
    col1 = MagicMock(spec=TableColumn)
    col1.column_name = "date1"
    col1.is_temporal = True
    col1.datetime_format = "%Y-%m-%d"
    col1.expression = None

    mock_dataset.columns = [col1]

    detector = DatetimeFormatDetector()
    results = detector.detect_all_formats(mock_dataset, force=False)

    assert results["date1"] == "%Y-%m-%d"
    mock_dataset.database.get_df.assert_not_called()


def test_detect_all_formats_force_redetection(mock_dataset: MagicMock) -> None:
    """Test forced re-detection of formats."""
    # Create column with existing format
    col1 = MagicMock(spec=TableColumn)
    col1.column_name = "date1"
    col1.is_temporal = True
    col1.datetime_format = "%Y-%m-%d"
    col1.expression = None

    mock_dataset.columns = [col1]
    mock_dataset.table_name = "test_table"

    # Return different format
    sample_data = pd.DataFrame({"date1": ["01/15/2023", "01/16/2023"]})
    mock_dataset.database.get_df.return_value = sample_data

    detector = DatetimeFormatDetector()
    results = detector.detect_all_formats(mock_dataset, force=True)

    assert results["date1"] == "%m/%d/%Y"
    assert col1.datetime_format == "%m/%d/%Y"


def test_detect_column_format_virtual_dataset(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test that virtual datasets are skipped."""
    mock_dataset.is_virtual = True

    detector = DatetimeFormatDetector()
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format is None
    mock_dataset.database.get_df.assert_not_called()


def test_detect_column_format_expression_column(
    mock_dataset: MagicMock, mock_column: MagicMock
) -> None:
    """Test that expression columns are skipped."""
    mock_column.expression = "DATE_ADD(some_date, INTERVAL 1 DAY)"

    detector = DatetimeFormatDetector()
    detected_format = detector.detect_column_format(mock_dataset, mock_column)

    assert detected_format is None
    mock_dataset.database.get_df.assert_not_called()
