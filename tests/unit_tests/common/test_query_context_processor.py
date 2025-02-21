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
    mock_df_to_escaped_csv.assert_called_once_with(df, index=False, encoding="utf-8")


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
    mock_df_to_escaped_csv.assert_called_once_with(df, index=False, encoding="utf-8")


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
