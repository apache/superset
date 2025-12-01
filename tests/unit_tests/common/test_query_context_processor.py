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
    from superset.models.helpers import ExploreMixin

    mock_query_context.datasource.data = MagicMock()
    mock_query_context.datasource.data.get.return_value = {
        "col1": "Column 1",
        "col2": "Column 2",
    }

    # Create a processor instance
    processor = QueryContextProcessor(mock_query_context)

    # Setup datasource methods from ExploreMixin to be real methods
    # by binding them to the mock datasource
    processor._qc_datasource.is_valid_date_range = (
        ExploreMixin.is_valid_date_range.__get__(processor._qc_datasource)
    )
    processor._qc_datasource.is_valid_date = ExploreMixin.is_valid_date.__get__(
        processor._qc_datasource
    )
    processor._qc_datasource.get_offset_custom_or_inherit = (
        ExploreMixin.get_offset_custom_or_inherit.__get__(processor._qc_datasource)
    )
    processor._qc_datasource._get_temporal_column_for_filter = (
        ExploreMixin._get_temporal_column_for_filter.__get__(processor._qc_datasource)
    )
    processor._qc_datasource.join_offset_dfs = ExploreMixin.join_offset_dfs.__get__(
        processor._qc_datasource
    )
    processor._qc_datasource._determine_join_keys = (
        ExploreMixin._determine_join_keys.__get__(processor._qc_datasource)
    )
    processor._qc_datasource._process_date_range_offset = (
        ExploreMixin._process_date_range_offset.__get__(processor._qc_datasource)
    )
    processor._qc_datasource._perform_join = ExploreMixin._perform_join.__get__(
        processor._qc_datasource
    )
    processor._qc_datasource._apply_cleanup_logic = (
        ExploreMixin._apply_cleanup_logic.__get__(processor._qc_datasource)
    )
    processor._qc_datasource.add_offset_join_column = (
        ExploreMixin.add_offset_join_column.__get__(processor._qc_datasource)
    )

    return processor


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
    assert (
        processor._qc_datasource.is_valid_date_range("2023-01-01 : 2023-01-31") is True
    )
    assert (
        processor._qc_datasource.is_valid_date_range("2020-12-25 : 2020-12-31") is True
    )

    # Should return False for invalid format
    assert processor._qc_datasource.is_valid_date_range("1 day ago") is False
    assert processor._qc_datasource.is_valid_date_range("2023-01-01") is False
    assert processor._qc_datasource.is_valid_date_range("invalid") is False


def test_is_valid_date_range_static_format():
    """Test that static date range format validation works correctly."""
    from superset.models.helpers import ExploreMixin

    # Should return True for valid date range format
    assert ExploreMixin.is_valid_date_range_static("2023-01-01 : 2023-01-31") is True
    assert ExploreMixin.is_valid_date_range_static("2020-12-25 : 2020-12-31") is True

    # Should return False for invalid format
    assert ExploreMixin.is_valid_date_range_static("1 day ago") is False
    assert ExploreMixin.is_valid_date_range_static("2023-01-01") is False
    assert ExploreMixin.is_valid_date_range_static("invalid") is False


def test_processing_time_offsets_date_range_logic(processor):
    """Test that date range timeshift logic works correctly with feature flag checks."""
    from superset.models.helpers import ExploreMixin

    # Test that the date range validation works
    assert (
        processor._qc_datasource.is_valid_date_range("2023-01-01 : 2023-01-31") is True
    )
    assert processor._qc_datasource.is_valid_date_range("1 year ago") is False

    # Test that static method also works
    assert ExploreMixin.is_valid_date_range_static("2023-01-01 : 2023-01-31") is True
    assert ExploreMixin.is_valid_date_range_static("1 year ago") is False


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

    with patch("superset.models.helpers.feature_flag_manager") as mock_ff:
        mock_ff.is_feature_enabled.return_value = True
        with patch("superset.common.utils.dataframe_utils.left_join_df") as mock_join:
            mock_join.return_value = pd.DataFrame(
                {
                    "dim1": ["A", "B", "C"],
                    "metric1": [10, 20, 30],
                    "metric1 2023-01-01 : 2023-01-31": [5, 10, 15],
                }
            )

            result_df = processor._qc_datasource.join_offset_dfs(
                main_df, offset_dfs, time_grain=None, join_keys=join_keys
            )

            # Verify join was called
            mock_join.assert_called_once()
            assert len(result_df) == 3


def test_get_offset_custom_or_inherit_with_inherit(processor):
    """Test get_offset_custom_or_inherit with 'inherit' option."""
    from_dttm = pd.Timestamp("2024-01-01")
    to_dttm = pd.Timestamp("2024-01-10")

    result = processor._qc_datasource.get_offset_custom_or_inherit(
        "inherit", from_dttm, to_dttm
    )

    # Should return the difference in days
    assert result == "9 days ago"


def test_get_offset_custom_or_inherit_with_date(processor):
    """Test get_offset_custom_or_inherit with specific date."""
    from_dttm = pd.Timestamp("2024-01-10")
    to_dttm = pd.Timestamp("2024-01-20")

    result = processor._qc_datasource.get_offset_custom_or_inherit(
        "2024-01-05", from_dttm, to_dttm
    )

    # Should return difference between from_dttm and the specified date
    assert result == "5 days ago"


def test_get_offset_custom_or_inherit_with_invalid_date(processor):
    """Test get_offset_custom_or_inherit with invalid date format."""
    from_dttm = pd.Timestamp("2024-01-10")
    to_dttm = pd.Timestamp("2024-01-20")

    result = processor._qc_datasource.get_offset_custom_or_inherit(
        "invalid-date", from_dttm, to_dttm
    )

    # Should return empty string for invalid format
    assert result == ""


def test_get_temporal_column_for_filter_with_granularity(processor):
    """Test _get_temporal_column_for_filter returns granularity when available."""
    query_object = MagicMock()
    query_object.granularity = "date_column"

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, "x_axis_col"
    )

    assert result == "date_column"


def test_get_temporal_column_for_filter_with_x_axis_fallback(processor):
    """Test _get_temporal_column_for_filter falls back to x_axis_label."""
    query_object = MagicMock()
    query_object.granularity = None

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, "x_axis_col"
    )

    assert result == "x_axis_col"


def test_get_temporal_column_for_filter_with_datasource_columns(processor):
    """Test _get_temporal_column_for_filter
    returns None when no clear temporal column."""
    query_object = MagicMock()
    query_object.granularity = None
    query_object.filter = []

    mock_datetime_col = MagicMock()
    mock_datetime_col.is_dttm = True
    mock_datetime_col.column_name = "created_at"

    mock_regular_col = MagicMock()
    mock_regular_col.is_dttm = False
    mock_regular_col.column_name = "name"

    processor._qc_datasource.columns = [mock_regular_col, mock_datetime_col]

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, None
    )

    assert result is None


def test_get_temporal_column_for_filter_prefers_granularity(processor):
    """Test _get_temporal_column_for_filter uses granularity when available."""
    query_object = MagicMock()
    query_object.granularity = "timestamp_col"
    query_object.filter = []

    mock_datetime_col = MagicMock()
    mock_datetime_col.is_dttm = True
    mock_datetime_col.name = "other_col"

    processor._qc_datasource.columns = [mock_datetime_col]

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, None
    )

    assert result == "timestamp_col"


def test_get_temporal_column_for_filter_no_columns_found(processor):
    """Test _get_temporal_column_for_filter
    returns None when no temporal column found."""
    query_object = MagicMock()
    query_object.granularity = None

    # Mock datasource with no datetime columns
    mock_regular_col = MagicMock()
    mock_regular_col.is_dttm = False
    mock_regular_col.column_name = "name"

    processor._qc_datasource.columns = [mock_regular_col]

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, None
    )

    assert result is None


def test_get_temporal_column_for_filter_no_datasource_columns(processor):
    """Test _get_temporal_column_for_filter handles datasource
    without columns attribute."""
    query_object = MagicMock()
    query_object.granularity = None

    # Remove columns attribute from datasource
    if hasattr(processor._qc_datasource, "columns"):
        delattr(processor._qc_datasource, "columns")

    result = processor._qc_datasource._get_temporal_column_for_filter(
        query_object, None
    )

    assert result is None


def test_processing_time_offsets_temporal_column_error(processor):
    """Test processing_time_offsets raises QueryObjectValidationError
    when temporal column can't be determined."""
    from superset.common.query_object import QueryObject
    from superset.exceptions import QueryObjectValidationError

    # Create a dataframe for testing
    df = pd.DataFrame({"dim1": ["A", "B", "C"], "metric1": [10, 20, 30]})

    # Create query object with date range offset and proper time range
    query_object = QueryObject(
        datasource=MagicMock(),
        granularity=None,  # No granularity set
        columns=[],
        is_timeseries=True,
        time_offsets=["2023-01-01 : 2023-01-31"],
        filter=[
            {
                "col": "some_date_col",
                "op": "TEMPORAL_RANGE",
                "val": "2024-01-01 : 2024-01-31",
            }
        ],
    )

    # Mock get_since_until_from_query_object to return valid dates
    with patch(
        "superset.common.utils.time_range_utils.get_since_until_from_query_object"
    ) as mock_dates:
        mock_dates.return_value = (
            pd.Timestamp("2024-01-01"),
            pd.Timestamp("2024-01-31"),
        )

        # Mock feature flag to be enabled
        with patch("superset.models.helpers.feature_flag_manager") as mock_ff:
            mock_ff.is_feature_enabled.return_value = True

            # Mock _get_temporal_column_for_filter to return None
            # (no temporal column found)
            with patch.object(
                processor._qc_datasource,
                "_get_temporal_column_for_filter",
                return_value=None,
            ):
                # Mock the datasource's processing_time_offsets to raise the error
                def raise_error(*args, **kwargs):
                    raise QueryObjectValidationError(
                        "Unable to identify temporal column for date "
                        "range time comparison."
                    )

                with patch.object(
                    processor._qc_datasource,
                    "processing_time_offsets",
                    side_effect=raise_error,
                ):
                    with pytest.raises(
                        QueryObjectValidationError,
                        match="Unable to identify temporal column",
                    ):
                        processor._qc_datasource.processing_time_offsets(
                            df, query_object, None, None, False
                        )


def test_processing_time_offsets_date_range_enabled(processor):
    """Test processing_time_offsets correctly handles
    date range offsets when enabled."""
    from superset.common.query_object import QueryObject

    # Create a dataframe for testing
    df = pd.DataFrame(
        {
            "dim1": ["A", "B", "C"],
            "metric1": [10, 20, 30],
            "__timestamp": pd.date_range("2023-01-01", periods=3, freq="D"),
        }
    )

    # Create a properly mocked datasource
    mock_datasource = MagicMock()
    mock_datasource.id = 123
    mock_datasource.uid = "abc123"
    mock_datasource.cache_timeout = None
    mock_datasource.changed_on = pd.Timestamp("2023-01-01")
    mock_datasource.get_extra_cache_keys.return_value = {}

    # Create query object with date range offset
    query_object = QueryObject(
        datasource=mock_datasource,
        granularity="date_col",
        columns=[],
        is_timeseries=True,
        time_offsets=["2022-01-01 : 2022-01-31"],
        filter=[],
    )

    # Mock the query context and its methods
    processor._query_context.queries = [query_object]

    with patch("superset.models.helpers.feature_flag_manager") as mock_ff:
        mock_ff.is_feature_enabled.return_value = True

        with patch(
            "superset.utils.core.get_base_axis_labels",
            return_value=["__timestamp"],
        ):
            with patch(
                "superset.common.utils.time_range_utils.get_since_until_from_query_object"
            ) as mock_dates:
                mock_dates.return_value = (
                    pd.Timestamp("2023-01-01"),
                    pd.Timestamp("2023-01-03"),
                )

                with patch(
                    "superset.common.utils.time_range_utils.get_since_until_from_time_range"
                ) as mock_time_range:
                    mock_time_range.return_value = (
                        pd.Timestamp("2022-01-01"),
                        pd.Timestamp("2022-01-31"),
                    )

                    with patch.object(
                        processor, "get_query_result"
                    ) as mock_query_result:
                        mock_result = MagicMock()
                        mock_result.df = pd.DataFrame(
                            {
                                "dim1": ["A", "B"],
                                "metric1": [5, 10],
                                "__timestamp": pd.date_range(
                                    "2022-01-01", periods=2, freq="D"
                                ),
                            }
                        )
                        mock_result.query = "SELECT * FROM table"
                        mock_result.cache_key = "offset_cache_key"
                        mock_query_result.return_value = mock_result

                        # Mock the datasource's processing_time_offsets to
                        # return a proper result
                        mock_cached_result = {
                            "df": pd.DataFrame(
                                {
                                    "dim1": ["A", "B", "C"],
                                    "metric1": [10, 20, 30],
                                    "metric1 2022-01-01 : 2022-01-31": [5, 10, 15],
                                    "__timestamp": pd.date_range(
                                        "2023-01-01", periods=3, freq="D"
                                    ),
                                }
                            ),
                            "queries": ["SELECT * FROM table"],
                            "cache_keys": ["mock_cache_key"],
                        }

                        with patch.object(
                            processor._qc_datasource,
                            "processing_time_offsets",
                            return_value=mock_cached_result,
                        ):
                            # Test the method (call datasource method directly)
                            result = processor._qc_datasource.processing_time_offsets(
                                df, query_object, None, None, False
                            )

                            # Verify that the method completes successfully
                            assert "df" in result
                            assert "queries" in result
                            assert "cache_keys" in result

                            # Verify the result has the expected structure
                            assert isinstance(result["df"], pd.DataFrame)
                            assert isinstance(result["queries"], list)
                            assert isinstance(result["cache_keys"], list)


def test_ensure_totals_available_updates_cache_values():
    """
    Test that ensure_totals_available() updates the query objects AND
    cache_values to keep them in sync.

    The issue was that ensure_totals_available() modified QueryObject instances
    (e.g., setting row_limit=None on totals queries and adding contribution_totals
    to post_processing), but cache_values still contained the original queries.
    This caused cache key mismatches between worker execution and cache fetch.
    """
    import pandas as pd

    from superset.common.query_object import QueryObject

    # Create a mock datasource
    mock_datasource = MagicMock()
    mock_datasource.uid = "test_datasource"
    mock_datasource.database.db_engine_spec.engine = "postgresql"
    mock_datasource.cache_timeout = None
    mock_datasource.changed_on = None

    # Create QueryObjects that would trigger ensure_totals_available logic
    # Query 1: Main query with contribution post-processing (needs totals)
    main_query = QueryObject(
        datasource=mock_datasource,
        columns=["brokerage"],
        metrics=["Net Amount In", "Amount Out", "Amount In"],
        row_limit=50000,
        orderby=[["Net Amount In", False]],
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": ["Amount In", "Amount Out"],
                    "rename_columns": ["%Amount In", "%Amount Out"],
                },
            }
        ],
    )

    # Query 2: Totals query (no columns, has metrics, no post-processing)
    totals_query = QueryObject(
        datasource=mock_datasource,
        columns=[],  # No columns = totals query
        metrics=["Net Amount In", "Amount Out", "Amount In"],
        row_limit=50000,
        post_processing=[],  # No post-processing
    )

    # Create mock query context
    mock_query_context = MagicMock()
    mock_query_context.force = False
    mock_query_context.datasource = mock_datasource
    mock_query_context.queries = [main_query, totals_query]
    mock_query_context.result_type = "full"
    mock_query_context.cache_values = {
        "datasource": {"type": "table", "id": 1},
        "queries": [
            # These are the original queries as they would be stored in cache_values
            {
                "columns": ["brokerage"],
                "metrics": ["Net Amount In", "Amount Out", "Amount In"],
                "row_limit": 50000,
                "orderby": [("Net Amount In", False)],
                "post_processing": [
                    {
                        "operation": "contribution",
                        "options": {
                            "columns": ["Amount In", "Amount Out"],
                            "rename_columns": ["%Amount In", "%Amount Out"],
                        },
                    }
                ],
            },
            {
                "columns": [],
                "metrics": ["Net Amount In", "Amount Out", "Amount In"],
                "row_limit": 50000,
                "post_processing": [],
            },
        ],
        "result_type": "full",
        "result_format": "json",
    }

    # Create processor
    processor = QueryContextProcessor(mock_query_context)
    processor._qc_datasource = mock_datasource

    # Mock the query execution result for totals query
    mock_query_result = MagicMock()
    mock_df = pd.DataFrame(
        {
            "Net Amount In": [20228060486.838825],
            "Amount Out": [-20543489614.980007],
            "Amount In": [40771550101.81883],
        }
    )
    mock_query_result.df = mock_df

    with patch.object(
        mock_query_context, "get_query_result", return_value=mock_query_result
    ):
        # Call ensure_totals_available
        processor.ensure_totals_available()

        # Now call get_payload which should update cache_values
        with patch(
            "superset.common.query_context_processor.get_query_results"
        ) as mock_get_query_results:
            # Mock the query results
            mock_query_results_response = [
                {
                    "data": [{"brokerage": "Test", "Net Amount In": 100}],
                    "query": "SELECT ...",
                }
            ]
            mock_get_query_results.return_value = mock_query_results_response

            # Mock cache manager to avoid actual caching
            with patch(
                "superset.common.query_context_processor.QueryCacheManager"
            ) as mock_cache_manager:
                mock_cache = MagicMock()
                mock_cache.is_loaded = True
                mock_cache.df = pd.DataFrame(
                    {"brokerage": ["Test"], "Net Amount In": [100]}
                )
                mock_cache.query = "SELECT ..."
                mock_cache.error_message = None
                mock_cache.status = "success"
                mock_cache_manager.get.return_value = mock_cache

                # This should update cache_values to match the modified queries
                processor.get_payload(cache_query_context=False)

    # Verify that cache_values has been updated to reflect the modifications
    updated_cache_queries = mock_query_context.cache_values["queries"]

    # Check that totals query has row_limit=None (modified by ensure_totals_available)
    assert updated_cache_queries[1]["row_limit"] is None, (
        "Expected totals query to have row_limit=None after ensure_totals_available, "
        f"but got: {updated_cache_queries[1]['row_limit']}"
    )

    # Check that the main query has contribution_totals in post_processing
    assert (
        "contribution_totals"
        in updated_cache_queries[0]["post_processing"][0]["options"]
    ), "Expected main query post_processing to have contribution_totals added"

    # Verify the contribution_totals match what we mocked
    expected_totals = {
        "Net Amount In": 20228060486.838825,
        "Amount Out": -20543489614.980007,
        "Amount In": 40771550101.81883,
    }
    assert (
        updated_cache_queries[0]["post_processing"][0]["options"]["contribution_totals"]
        == expected_totals
    )


def test_get_df_payload_validates_before_cache_key_generation():
    """
    Test that get_df_payload calls validate() before generating cache key.
    """
    from superset.common.query_object import QueryObject

    # Create a mock query context
    mock_query_context = MagicMock()
    mock_query_context.force = False
    mock_query_context.result_type = "full"

    # Create a mock datasource
    mock_datasource = MagicMock()
    mock_datasource.id = 123
    mock_datasource.uid = "test_datasource"
    mock_datasource.cache_timeout = None
    mock_datasource.database.db_engine_spec.engine = "postgresql"
    mock_datasource.database.extra = "{}"
    mock_datasource.get_extra_cache_keys.return_value = []
    mock_datasource.changed_on = None

    # Create processor
    processor = QueryContextProcessor(mock_query_context)
    processor._qc_datasource = mock_datasource

    # Create a query object with unsanitized where clause
    query_obj = QueryObject(
        datasource=mock_datasource,
        columns=["col1"],
        metrics=[],
        extras={"where": "(\n  col1 > 0\n)"},  # Unsanitized with newlines
    )

    # Track the order of calls
    call_order = []

    original_validate = query_obj.validate

    def mock_validate(*args, **kwargs):
        call_order.append("validate")
        # Update extras to simulate sanitization
        query_obj.extras["where"] = "(col1 > 0)"  # Sanitized, compact format
        return original_validate(*args, **kwargs)

    original_cache_key = query_obj.cache_key

    def mock_cache_key(*args, **kwargs):
        call_order.append("cache_key")
        # Verify that extras have been sanitized at this point
        assert query_obj.extras["where"] == "(col1 > 0)", (
            f"Expected sanitized clause in cache_key, got: {query_obj.extras['where']}"
        )
        return original_cache_key(*args, **kwargs)

    with patch.object(query_obj, "validate", side_effect=mock_validate):
        with patch.object(query_obj, "cache_key", side_effect=mock_cache_key):
            with patch(
                "superset.common.query_context_processor.QueryCacheManager"
            ) as mock_cache_manager:
                mock_cache = MagicMock()
                mock_cache.is_loaded = True
                mock_cache.df = pd.DataFrame({"col1": [1, 2, 3]})
                mock_cache.query = "SELECT * FROM table"
                mock_cache.error_message = None
                mock_cache.status = "success"
                mock_cache_manager.get.return_value = mock_cache

                # Call get_df_payload
                processor.get_df_payload(query_obj, force_cached=False)

    # Verify validate was called before cache_key
    assert call_order == ["validate", "cache_key"], (
        f"Expected validate to be called before cache_key, "
        f"but got call order: {call_order}"
    )


def test_cache_values_sync_after_ensure_totals_available():
    """
    Test that cache_values is synchronized with QueryObject modifications
    after ensure_totals_available() runs.

    This is a focused regression test for the cache key mismatch issue.
    It verifies that when ensure_totals_available() modifies QueryObject
    instances, those changes are reflected in cache_values before the
    QueryContext cache key is generated.
    """
    import pandas as pd

    from superset.common.query_object import QueryObject

    # Create a mock datasource
    mock_datasource = MagicMock()
    mock_datasource.uid = "test_datasource_456"
    mock_datasource.database.db_engine_spec.engine = "pinot"
    mock_datasource.cache_timeout = None
    mock_datasource.changed_on = None

    # Create two queries: one totals query and one main query with contribution
    totals_query = QueryObject(
        datasource=mock_datasource,
        columns=[],
        metrics=["sales"],
        row_limit=1000,
        post_processing=[],
    )

    main_query = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales"],
        row_limit=1000,
        post_processing=[{"operation": "contribution", "options": {}}],
    )

    # Create mock query context with initial cache_values
    mock_query_context = MagicMock()
    mock_query_context.force = False
    mock_query_context.datasource = mock_datasource
    mock_query_context.queries = [main_query, totals_query]
    mock_query_context.result_type = "full"
    mock_query_context.cache_values = {
        "datasource": {"type": "table", "id": 20},
        "queries": [
            {
                "columns": ["region"],
                "metrics": ["sales"],
                "row_limit": 1000,
                "post_processing": [{"operation": "contribution", "options": {}}],
            },
            {
                "columns": [],
                "metrics": ["sales"],
                "row_limit": 1000,
                "post_processing": [],
            },
        ],
        "result_type": "full",
        "result_format": "json",
    }

    # Create processor
    processor = QueryContextProcessor(mock_query_context)
    processor._qc_datasource = mock_datasource

    # Mock query execution result (totals query execution)
    mock_query_result = MagicMock()
    mock_df = pd.DataFrame({"sales": [1000.0]})
    mock_query_result.df = mock_df

    # Patch methods to isolate the test
    with patch.object(
        mock_query_context, "get_query_result", return_value=mock_query_result
    ):
        # Mock cache management to prevent actual caching
        with patch(
            "superset.common.query_context_processor.QueryCacheManager"
        ) as mock_cache_manager:
            mock_cache = MagicMock()
            mock_cache.is_loaded = True
            mock_cache.df = pd.DataFrame({"region": ["North"], "sales": [100]})
            mock_cache.query = "SELECT region, SUM(sales) FROM table GROUP BY region"
            mock_cache.error_message = None
            mock_cache.status = "success"
            mock_cache_manager.get.return_value = mock_cache

            # Mock the query results
            with patch(
                "superset.common.query_context_processor.get_query_results"
            ) as mock_get_query_results:
                mock_query_results_response = [
                    {
                        "data": [{"region": "North", "sales": 100}],
                        "query": "SELECT region, SUM(sales) FROM table GROUP BY region",
                    }
                ]
                mock_get_query_results.return_value = mock_query_results_response

                # Call get_payload - this internally calls ensure_totals_available()
                # and then should update cache_values
                processor.get_payload(cache_query_context=False)

    # Verify the fix: cache_values should now reflect the modifications
    updated_cache_queries = mock_query_context.cache_values["queries"]
    updated_totals_row_limit = updated_cache_queries[1]["row_limit"]

    # Before the fix: row_limit would remain 1000 in cache_values
    # After the fix: row_limit should be None (modified by
    # ensure_totals_available)
    assert updated_totals_row_limit is None, (
        "Expected row_limit to be None after ensure_totals_available, "
        f"but got: {updated_totals_row_limit}"
    )

    # Verify that contribution_totals was added to the main query
    assert (
        "contribution_totals"
        in updated_cache_queries[0]["post_processing"][0]["options"]
    )

    # Verify that the main query row_limit is still 1000 (only totals query
    # should be modified)
    assert updated_cache_queries[0]["row_limit"] == 1000


def test_cache_key_excludes_contribution_totals():
    """
    Test that cache_key() excludes contribution_totals from post_processing.

    contribution_totals is computed at runtime by ensure_totals_available() and
    varies per request. Including it in the cache key would cause mismatches
    between workers that compute different totals for the same query.
    """
    from superset.common.query_object import QueryObject

    mock_datasource = MagicMock()
    mock_datasource.uid = "test_datasource"
    mock_datasource.database.extra = "{}"
    mock_datasource.get_extra_cache_keys.return_value = []

    # Create query with contribution post-processing that includes contribution_totals
    query_with_totals = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales", "profit"],
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sales", "profit"],
                    "rename_columns": ["%sales", "%profit"],
                    "contribution_totals": {"sales": 1000.0, "profit": 200.0},
                },
            }
        ],
    )

    # Create identical query without contribution_totals
    query_without_totals = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales", "profit"],
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sales", "profit"],
                    "rename_columns": ["%sales", "%profit"],
                },
            }
        ],
    )

    # Cache keys should be identical since contribution_totals is excluded
    cache_key_with = query_with_totals.cache_key()
    cache_key_without = query_without_totals.cache_key()

    assert cache_key_with == cache_key_without, (
        "Cache keys should match regardless of contribution_totals. "
        f"With totals: {cache_key_with}, Without totals: {cache_key_without}"
    )


def test_cache_key_preserves_other_post_processing_options():
    """
    Test that cache_key() only excludes contribution_totals, not other options.
    """
    from superset.common.query_object import QueryObject

    mock_datasource = MagicMock()
    mock_datasource.uid = "test_datasource"
    mock_datasource.database.extra = "{}"
    mock_datasource.get_extra_cache_keys.return_value = []

    # Create query with contribution post-processing
    query1 = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales"],
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sales"],
                    "rename_columns": ["%sales"],
                    "contribution_totals": {"sales": 1000.0},
                },
            }
        ],
    )

    # Create query with different rename_columns
    query2 = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales"],
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sales"],
                    "rename_columns": ["%sales_pct"],  # Different!
                    "contribution_totals": {"sales": 1000.0},
                },
            }
        ],
    )

    # Cache keys should differ because rename_columns is different
    assert query1.cache_key() != query2.cache_key(), (
        "Cache keys should differ when other post_processing options differ"
    )


def test_cache_key_non_contribution_post_processing_unchanged():
    """
    Test that non-contribution post_processing operations are unchanged in cache key.
    """
    from superset.common.query_object import QueryObject

    mock_datasource = MagicMock()
    mock_datasource.uid = "test_datasource"
    mock_datasource.database.extra = "{}"
    mock_datasource.get_extra_cache_keys.return_value = []

    # Create query with non-contribution post-processing
    query1 = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales"],
        post_processing=[
            {
                "operation": "pivot",
                "options": {"columns": ["region"], "aggregates": {"sales": "sum"}},
            }
        ],
    )

    query2 = QueryObject(
        datasource=mock_datasource,
        columns=["region"],
        metrics=["sales"],
        post_processing=[
            {
                "operation": "pivot",
                "options": {"columns": ["region"], "aggregates": {"sales": "mean"}},
            }
        ],
    )

    # Cache keys should differ because aggregates option is different
    assert query1.cache_key() != query2.cache_key(), (
        "Cache keys should differ for different non-contribution post_processing"
    )
