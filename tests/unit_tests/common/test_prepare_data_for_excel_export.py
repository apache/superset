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
from pandas import DataFrame, Series, Timestamp
from pandas.api.types import is_numeric_dtype
from pandas.testing import assert_frame_equal
from pytest import fixture, mark

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import (
    AGGREGATED_JOIN_COLUMN,
    QueryContextProcessor,
)
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import TimeGrain
from superset.utils.core import GenericDataType

query_context_processor = QueryContextProcessor(
    QueryContext(
        datasource=BaseDatasource(),
        queries=[],
        result_type=ChartDataResultType.COLUMNS,
        form_data={},
        slice_=None,
        result_format=ChartDataResultFormat.XLSX,
        cache_values={},
    )
)


def test_export_xlsx_with_one_numeric_column():
    df = DataFrame(
        {
            "col0": ["123", "1", "2", "3"],
            "col1": ["456", "5.67", "0", ".45"],
            "col2": ["2020-01-07", "2020-01-08", "2020-01-09", "2020-01-10"],
            "col3": ["True", "False", "True", "False"],
        }
    )
    coltypes: list[GenericDataType] = [
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
        GenericDataType.TEMPORAL,
        GenericDataType.BOOLEAN,
    ]

    # only col1 should be converted to numeric, according to coltypes definition
    xdf = query_context_processor.copy_df_for_excel_export(df, coltypes)
    assert not is_numeric_dtype(xdf["col0"])
    assert is_numeric_dtype(xdf["col1"])
    assert not is_numeric_dtype(xdf["col2"])
    assert not is_numeric_dtype(xdf["col3"])


def test_export_xlsx_with_failing_numeric_data():
    df = DataFrame(
        {
            "col0": ["123", "1", "2", "3"],
            "col1": ["456", "not_numeric", "0", ".45"],
            "col2": ["2020-01-07", "2020-01-08", "2020-01-09", "2020-01-10"],
            "col3": ["True", "False", "True", "False"],
        }
    )
    coltypes: list[GenericDataType] = [
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
        GenericDataType.TEMPORAL,
        GenericDataType.BOOLEAN,
    ]

    # given data in col1, conversion to numeric should fail silently
    xdf = query_context_processor.copy_df_for_excel_export(df, coltypes)
    assert not is_numeric_dtype(xdf["col0"])
    assert not is_numeric_dtype(xdf["col1"])
    assert not is_numeric_dtype(xdf["col2"])
    assert not is_numeric_dtype(xdf["col3"])
