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

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from superset.common.chart_data import ChartDataResultFormat
from superset.common.query_context_processor import QueryContextProcessor
from superset.utils.core import GenericDataType


@pytest.fixture
def mock_query_context():
    with patch(
        "superset.common.query_context_processor.QueryContextProcessor"
    ) as mock_query_context_processor:
        yield mock_query_context_processor


@pytest.fixture
def processor(mock_query_context):
    mock_query_context.datasource.data = MagicMock()
    mock_query_context.datasource.data.get.return_value = {
        "col1": "Column 1",
        "col2": "Column 2",
    }
    return QueryContextProcessor(mock_query_context)


def test_get_data_table_like(processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON

    result = processor.get_data(df, coltypes)
    expected = [
        {"col1": 1, "col2": "a"},
        {"col1": 2, "col2": "b"},
        {"col1": 3, "col2": "c"},
    ]
    assert result == expected


@patch("superset.common.query_context_processor.csv.df_to_escaped_csv")
def test_get_data_csv(mock_df_to_escaped_csv, processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.CSV

    mock_df_to_escaped_csv.return_value = "col1,col2\n1,a\n2,b\n3,c\n"
    result = processor.get_data(df, coltypes)
    assert result == "col1,col2\n1,a\n2,b\n3,c\n"
    mock_df_to_escaped_csv.assert_called_once_with(
        df, index=False, encoding="utf-8-sig"
    )


@patch("superset.common.query_context_processor.excel.df_to_excel")
@patch("superset.common.query_context_processor.excel.apply_column_types")
def test_get_data_xlsx(
    mock_apply_column_types, mock_df_to_excel, processor, mock_query_context
):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.XLSX

    mock_df_to_excel.return_value = b"binary data"
    result = processor.get_data(df, coltypes)
    assert result == b"binary data"
    mock_apply_column_types.assert_called_once_with(df, coltypes)
    mock_df_to_excel.assert_called_once_with(df)


def test_get_data_json(processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON

    result = processor.get_data(df, coltypes)
    expected = [
        {"col1": 1, "col2": "a"},
        {"col1": 2, "col2": "b"},
        {"col1": 3, "col2": "c"},
    ]
    assert result == expected


def test_get_data_invalid_dataframe(processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON

    with patch.object(df, "to_dict", side_effect=ValueError("Invalid DataFrame")):
        with pytest.raises(ValueError, match="Invalid DataFrame"):
            processor.get_data(df, coltypes)


def test_get_data_non_unique_columns(processor, mock_query_context):
    data = [[1, "a"], [2, "b"], [3, "c"]]
    df = pd.DataFrame(data, columns=["col1", "col1"])
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON

    with pytest.warns(
        UserWarning,
        match="DataFrame columns are not unique, some columns will be omitted",
    ):
        processor.get_data(df, coltypes)


def test_get_data_empty_dataframe_json(processor, mock_query_context):
    df = pd.DataFrame(columns=["col1", "col2"])
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON
    result = processor.get_data(df, coltypes)
    assert result == []


@patch("superset.common.query_context_processor.csv.df_to_escaped_csv")
def test_get_data_empty_dataframe_csv(
    mock_df_to_escaped_csv, processor, mock_query_context
):
    df = pd.DataFrame(columns=["col1", "col2"])
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.CSV
    mock_df_to_escaped_csv.return_value = "col1,col2\n"
    result = processor.get_data(df, coltypes)
    assert result == "col1,col2\n"
    mock_df_to_escaped_csv.assert_called_once_with(
        df, index=False, encoding="utf-8-sig"
    )


@patch("superset.common.query_context_processor.excel.df_to_excel")
@patch("superset.common.query_context_processor.excel.apply_column_types")
def test_get_data_empty_dataframe_xlsx(
    mock_apply_column_types, mock_df_to_excel, processor, mock_query_context
):
    df = pd.DataFrame(columns=["col1", "col2"])
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.XLSX
    mock_df_to_excel.return_value = b"binary data empty"
    result = processor.get_data(df, coltypes)
    assert result == b"binary data empty"
    mock_apply_column_types.assert_called_once_with(df, coltypes)
    mock_df_to_excel.assert_called_once_with(df)


def test_get_data_nan_values_json(processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, np.nan, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON
    result = processor.get_data(df, coltypes)
    assert result[0]["col1"] == 1
    assert pd.isna(result[1]["col1"])
    assert result[2]["col1"] == 3


def test_get_data_invalid_input(processor, mock_query_context):
    df = "not a dataframe"
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON
    with pytest.raises(AttributeError):
        processor.get_data(df, coltypes)


def test_get_data_default_format_when_result_format_is_none(
    processor, mock_query_context
):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = None
    result = processor.get_data(df, coltypes)
    expected = [
        {"col1": 1, "col2": "a"},
        {"col1": 2, "col2": "b"},
        {"col1": 3, "col2": "c"},
    ]
    assert result == expected


def fake_apply_column_types(df, coltypes):
    if len(coltypes) != len(df.columns):
        raise ValueError("Mismatch between column types and dataframe columns")
    return df


@patch("superset.common.query_context_processor.excel.df_to_excel")
@patch(
    "superset.common.query_context_processor.excel.apply_column_types",
    side_effect=fake_apply_column_types,
)
def test_get_data_invalid_coltypes_length_xlsx(
    mock_apply_column_types, mock_df_to_excel, processor, mock_query_context
):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC]  # Mismatched length
    mock_query_context.result_format = ChartDataResultFormat.XLSX
    with pytest.raises(
        ValueError, match="Mismatch between column types and dataframe columns"
    ):
        processor.get_data(df, coltypes)


def test_get_data_does_not_mutate_dataframe(processor, mock_query_context):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    original_df = df.copy(deep=True)
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.JSON
    _ = processor.get_data(df, coltypes)
    pd.testing.assert_frame_equal(df, original_df)


@patch(
    "superset.common.query_context_processor.excel.apply_column_types",
    side_effect=ValueError("Conversion error"),
)
def test_get_data_xlsx_apply_column_types_error(
    mock_apply_column_types, processor, mock_query_context
):
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    coltypes = [GenericDataType.NUMERIC, GenericDataType.STRING]
    mock_query_context.result_format = ChartDataResultFormat.XLSX
    with pytest.raises(ValueError, match="Conversion error"):
        processor.get_data(df, coltypes)


def test_is_valid_date_range_format(processor):
    """Test that date range format validation works correctly."""
    # Should return True for valid date range format
    assert processor.is_valid_date_range("2023-01-01 : 2023-01-31") is True
    assert processor.is_valid_date_range("2020-12-25 : 2020-12-31") is True

    # Should return False for invalid format
    assert processor.is_valid_date_range("1 day ago") is False
    assert processor.is_valid_date_range("2023-01-01") is False
    assert processor.is_valid_date_range("invalid") is False


def test_is_valid_date_range_static_format():
    """Test that static date range format validation works correctly."""
    # Should return True for valid date range format
    assert (
        QueryContextProcessor.is_valid_date_range_static("2023-01-01 : 2023-01-31")
        is True
    )
    assert (
        QueryContextProcessor.is_valid_date_range_static("2020-12-25 : 2020-12-31")
        is True
    )

    # Should return False for invalid format
    assert QueryContextProcessor.is_valid_date_range_static("1 day ago") is False
    assert QueryContextProcessor.is_valid_date_range_static("2023-01-01") is False
    assert QueryContextProcessor.is_valid_date_range_static("invalid") is False


def test_processing_time_offsets_date_range_logic(processor):
    """Test that date range timeshift logic works correctly with feature flag checks."""
    # Test that the date range validation works
    assert processor.is_valid_date_range("2023-01-01 : 2023-01-31") is True
    assert processor.is_valid_date_range("1 year ago") is False

    # Test that static method also works
    assert (
        QueryContextProcessor.is_valid_date_range_static("2023-01-01 : 2023-01-31")
        is True
    )
    assert QueryContextProcessor.is_valid_date_range_static("1 year ago") is False


def test_feature_flag_validation_logic():
    """Test that feature flag validation logic works as expected."""
    from superset.extensions import feature_flag_manager

    # This tests the concept - actual feature flag value depends on config
    # The important thing is that the code checks for DATE_RANGE_TIMESHIFTS_ENABLED
    flag_name = "DATE_RANGE_TIMESHIFTS_ENABLED"

    # Test that the feature flag is being checked
    # (This will vary based on actual config but tests the mechanism)
    result = feature_flag_manager.is_feature_enabled(flag_name)
    assert isinstance(result, bool)  # Should return a boolean


def test_join_offset_dfs_date_range_basic(processor):
    """Test basic join logic for date range offsets."""
    # Create simple test data
    main_df = pd.DataFrame({"dim1": ["A", "B", "C"], "metric1": [10, 20, 30]})

    offset_df = pd.DataFrame({"dim1": ["A", "B", "C"], "metric1": [5, 10, 15]})

    # Mock query context
    mock_query = MagicMock()
    mock_query.granularity = "date_col"
    processor._query_context.queries = [mock_query]

    # Test basic join with date range offset
    offset_dfs = {"2023-01-01 : 2023-01-31": offset_df}
    join_keys = ["dim1"]

    with patch(
        "superset.common.query_context_processor.feature_flag_manager"
    ) as mock_ff:
        mock_ff.is_feature_enabled.return_value = True
        with patch(
            "superset.common.query_context_processor.dataframe_utils.left_join_df"
        ) as mock_join:
            mock_join.return_value = pd.DataFrame(
                {
                    "dim1": ["A", "B", "C"],
                    "metric1": [10, 20, 30],
                    "metric1 2023-01-01 : 2023-01-31": [5, 10, 15],
                }
            )

            result_df = processor.join_offset_dfs(
                main_df, offset_dfs, time_grain=None, join_keys=join_keys
            )

            # Verify join was called
            mock_join.assert_called_once()
            assert len(result_df) == 3


def test_get_offset_custom_or_inherit_with_inherit(processor):
    """Test get_offset_custom_or_inherit with 'inherit' option."""
    from_dttm = pd.Timestamp("2024-01-01")
    to_dttm = pd.Timestamp("2024-01-10")

    result = processor.get_offset_custom_or_inherit("inherit", from_dttm, to_dttm)

    # Should return the difference in days
    assert result == "9 days ago"


def test_get_offset_custom_or_inherit_with_date(processor):
    """Test get_offset_custom_or_inherit with specific date."""
    from_dttm = pd.Timestamp("2024-01-10")
    to_dttm = pd.Timestamp("2024-01-20")

    result = processor.get_offset_custom_or_inherit("2024-01-05", from_dttm, to_dttm)

    # Should return difference between from_dttm and the specified date
    assert result == "5 days ago"


def test_get_offset_custom_or_inherit_with_invalid_date(processor):
    """Test get_offset_custom_or_inherit with invalid date format."""
    from_dttm = pd.Timestamp("2024-01-10")
    to_dttm = pd.Timestamp("2024-01-20")

    result = processor.get_offset_custom_or_inherit("invalid-date", from_dttm, to_dttm)

    # Should return empty string for invalid format
    assert result == ""
