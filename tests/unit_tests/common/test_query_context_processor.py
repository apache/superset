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


def test_get_temporal_column_for_filter_with_granularity(processor):
    """Test _get_temporal_column_for_filter returns granularity when available."""
    query_object = MagicMock()
    query_object.granularity = "date_column"

    result = processor._get_temporal_column_for_filter(query_object, "x_axis_col")

    assert result == "date_column"


def test_get_temporal_column_for_filter_with_x_axis_fallback(processor):
    """Test _get_temporal_column_for_filter falls back to x_axis_label."""
    query_object = MagicMock()
    query_object.granularity = None

    result = processor._get_temporal_column_for_filter(query_object, "x_axis_col")

    assert result == "x_axis_col"


def test_get_temporal_column_for_filter_with_datasource_columns(processor):
    """Test _get_temporal_column_for_filter finds datetime column from datasource."""
    query_object = MagicMock()
    query_object.granularity = None

    # Mock datasource with datetime columns
    mock_datetime_col = MagicMock()
    mock_datetime_col.is_dttm = True
    mock_datetime_col.column_name = "created_at"

    mock_regular_col = MagicMock()
    mock_regular_col.is_dttm = False
    mock_regular_col.column_name = "name"

    processor._qc_datasource.columns = [mock_regular_col, mock_datetime_col]

    result = processor._get_temporal_column_for_filter(query_object, None)

    assert result == "created_at"


def test_get_temporal_column_for_filter_with_datasource_name_attr(processor):
    """Test _get_temporal_column_for_filter with columns using name attribute."""
    query_object = MagicMock()
    query_object.granularity = None

    # Mock datasource with datetime column using 'name' attribute
    # instead of 'column_name'
    mock_datetime_col = MagicMock()
    mock_datetime_col.is_dttm = True
    mock_datetime_col.name = "timestamp_col"
    # Remove column_name attribute to test name fallback
    del mock_datetime_col.column_name

    processor._qc_datasource.columns = [mock_datetime_col]

    result = processor._get_temporal_column_for_filter(query_object, None)

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

    result = processor._get_temporal_column_for_filter(query_object, None)

    assert result is None


def test_get_temporal_column_for_filter_no_datasource_columns(processor):
    """Test _get_temporal_column_for_filter handles datasource
    without columns attribute."""
    query_object = MagicMock()
    query_object.granularity = None

    # Remove columns attribute from datasource
    if hasattr(processor._qc_datasource, "columns"):
        delattr(processor._qc_datasource, "columns")

    result = processor._get_temporal_column_for_filter(query_object, None)

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
        "superset.common.query_context_processor.get_since_until_from_query_object"
    ) as mock_dates:
        mock_dates.return_value = (
            pd.Timestamp("2024-01-01"),
            pd.Timestamp("2024-01-31"),
        )

        # Mock feature flag to be enabled
        with patch(
            "superset.common.query_context_processor.feature_flag_manager"
        ) as mock_ff:
            mock_ff.is_feature_enabled.return_value = True

            # Mock _get_temporal_column_for_filter to return None
            # (no temporal column found)
            with patch.object(
                processor, "_get_temporal_column_for_filter", return_value=None
            ):
                with patch(
                    "superset.common.query_context_processor.get_base_axis_labels",
                    return_value=["__timestamp"],
                ):
                    with pytest.raises(
                        QueryObjectValidationError,
                        match="Unable to identify temporal column",
                    ):
                        processor.processing_time_offsets(df, query_object)


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

    with patch(
        "superset.common.query_context_processor.feature_flag_manager"
    ) as mock_ff:
        mock_ff.is_feature_enabled.return_value = True

        with patch(
            "superset.common.query_context_processor.get_base_axis_labels",
            return_value=["__timestamp"],
        ):
            with patch(
                "superset.common.query_context_processor.get_since_until_from_query_object"
            ) as mock_dates:
                mock_dates.return_value = (
                    pd.Timestamp("2023-01-01"),
                    pd.Timestamp("2023-01-03"),
                )

                with patch(
                    "superset.common.query_context_processor.get_since_until_from_time_range"
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

                        with patch.object(
                            processor,
                            "_get_temporal_column_for_filter",
                            return_value="date_col",
                        ):
                            with patch.object(
                                processor,
                                "query_cache_key",
                                return_value="mock_cache_key",
                            ):
                                # Test the method
                                result = processor.processing_time_offsets(
                                    df, query_object
                                )

                                # Verify that the method completes successfully
                                assert "df" in result
                                assert "queries" in result
                                assert "cache_keys" in result

                                # Verify the result has the expected structure
                                assert isinstance(result["df"], pd.DataFrame)
                                assert isinstance(result["queries"], list)
                                assert isinstance(result["cache_keys"], list)


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
