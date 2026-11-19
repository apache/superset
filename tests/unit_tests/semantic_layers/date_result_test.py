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

"""Temporal result conversion must support calculations without changing exports."""

from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from typing import cast
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest
from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import SemanticResult

from superset.common.chart_data import ChartDataResultFormat
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import InvalidPostProcessingError
from superset.models.helpers import QueryResult
from superset.semantic_layers.exceptions import SemanticLayerQueryRejectedError
from superset.semantic_layers.mapper import (
    _ViewMetadata,
    get_results,
    map_semantic_result_to_query_result,
    ValidatedQueryObject,
)
from superset.semantic_layers.models import SemanticView
from superset.utils.core import GenericDataType
from superset.utils.json import json_int_dttm_ser


def _date_frame(query: ValidatedQueryObject) -> pd.DataFrame:
    """Convert typed provider dates through the real final mapper boundary."""
    table: pa.Table = pa.table(
        {
            "day": pa.array([date(2026, 1, 5), date(2026, 1, 7)], type=pa.date32()),
            "amount": [1, 3],
        }
    )
    return _mapped_frame(table, query)


def _mapped_frame(table: pa.Table, query: ValidatedQueryObject) -> pd.DataFrame:
    """Map provider output without discovery or network calls."""
    return map_semantic_result_to_query_result(
        SemanticResult(requests=[], results=table),
        query,
        timedelta(0),
        _ViewMetadata(metrics=(), dimensions=()),
    ).df


def _resample_query() -> ValidatedQueryObject:
    """Build the pivot/resample/flatten chain emitted by a daily time-series chart."""
    return ValidatedQueryObject(
        metrics=["amount"],
        columns=["day"],
        post_processing=[
            {
                "operation": "pivot",
                "options": {
                    "index": ["day"],
                    "columns": [],
                    "aggregates": {"amount": {"operator": "mean"}},
                    "drop_missing_columns": True,
                },
            },
            {
                "operation": "resample",
                "options": {"method": "asfreq", "rule": "1D", "fill_value": 0},
            },
            {"operation": "flatten"},
        ],
    )


def test_semantic_date_daily_resample_fills_gaps() -> None:
    """A date-typed semantic axis supports the chart's real post-processing chain."""
    query: ValidatedQueryObject = _resample_query()
    result: pd.DataFrame = query.exec_post_processing(_date_frame(query))
    assert result["amount"].tolist() == [1, 0, 3]
    assert result["day"].dt.date.tolist() == [
        date(2026, 1, 5),
        date(2026, 1, 6),
        date(2026, 1, 7),
    ]


def test_ordinary_date_axis_normalization_and_exports() -> None:
    """Record SQL DATE axis normalization and its existing export presentation."""
    dataset: SqlaTable = SqlaTable(
        columns=[TableColumn(column_name="day", type="DATE", is_dttm=True)],
        offset=0,
    )
    query: ValidatedQueryObject = ValidatedQueryObject(
        columns=["day"], metrics=["amount"], granularity="day"
    )
    frame: pd.DataFrame = dataset.normalize_df(_date_frame(query), query)
    assert pd.api.types.is_datetime64_any_dtype(frame["day"])
    context: MagicMock = MagicMock(result_format=ChartDataResultFormat.CSV)
    context.datasource.data = {}
    processor: QueryContextProcessor = QueryContextProcessor(
        cast(QueryContext, context)
    )
    csv_result: object = processor.get_data(
        frame.copy(), [GenericDataType.TEMPORAL, GenericDataType.NUMERIC]
    )
    assert isinstance(csv_result, bytes)
    assert csv_result.decode("utf-8-sig").splitlines()[1] == "2026-01-05,1"
    context.result_format = ChartDataResultFormat.XLSX
    xlsx_result: object = processor.get_data(
        frame.copy(), [GenericDataType.TEMPORAL, GenericDataType.NUMERIC]
    )
    assert isinstance(xlsx_result, bytes)
    sheet: Worksheet = cast(Worksheet, load_workbook(BytesIO(xlsx_result)).active)
    assert sheet["A2"].number_format == "YYYY-MM-DD HH:MM:SS"


@pytest.mark.parametrize(
    "result_format",
    [ChartDataResultFormat.JSON, ChartDataResultFormat.CSV, ChartDataResultFormat.XLSX],
)
def test_semantic_date_raw_results_keep_date_presentation(
    result_format: ChartDataResultFormat,
) -> None:
    """Raw dates retain their JSON instant, CSV text and spreadsheet date format."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        columns=["day"], metrics=["amount"]
    )
    context: MagicMock = MagicMock(result_format=result_format)
    context.datasource.data = {}
    processor: QueryContextProcessor = QueryContextProcessor(
        cast(QueryContext, context)
    )
    result: object = processor.get_data(
        _date_frame(query), [GenericDataType.TEMPORAL, GenericDataType.NUMERIC]
    )
    if result_format == ChartDataResultFormat.JSON:
        assert isinstance(result, list)
        assert json_int_dttm_ser(result[0]["day"]) == json_int_dttm_ser(
            date(2026, 1, 5)
        )
    elif result_format == ChartDataResultFormat.CSV:
        assert isinstance(result, bytes)
        assert result.decode("utf-8-sig").splitlines() == [
            "day,amount",
            "2026-01-05,1",
            "2026-01-07,3",
        ]
    else:
        assert isinstance(result, bytes)
        sheet: Worksheet = cast(Worksheet, load_workbook(BytesIO(result)).active)
        assert sheet["A2"].value == datetime(2026, 1, 5)
        assert sheet["A2"].number_format == "YYYY-MM-DD"


@pytest.mark.parametrize("resampling", [False, True])
@pytest.mark.parametrize(
    "result_format",
    list(ChartDataResultFormat.table_like()) + [ChartDataResultFormat.JSON],
)
def test_semantic_date_exports_match_unchanged_raw_or_resampled_sql(
    resampling: bool, result_format: ChartDataResultFormat
) -> None:
    """Raw bytes stay identical; newly supported resampled exports match SQL output."""
    query: ValidatedQueryObject = (
        _resample_query() if resampling else ValidatedQueryObject()
    )
    # Build the independent pre-change raw frame rather than use the changed mapper.
    expected: pd.DataFrame = pd.DataFrame(
        {"day": [date(2026, 1, 5), date(2026, 1, 7)], "amount": [1, 3]}
    )
    actual: pd.DataFrame = _date_frame(query)
    if resampling:
        dataset: SqlaTable = SqlaTable(
            columns=[TableColumn(column_name="day", type="DATE", is_dttm=True)],
            offset=0,
        )
        query.granularity = "day"
        expected = query.exec_post_processing(dataset.normalize_df(expected, query))
        actual = query.exec_post_processing(actual)
    context: MagicMock = MagicMock(result_format=result_format)
    context.datasource.data = {}
    processor: QueryContextProcessor = QueryContextProcessor(
        cast(QueryContext, context)
    )
    coltypes: list[GenericDataType] = [
        GenericDataType.TEMPORAL,
        GenericDataType.NUMERIC,
    ]
    assert processor.get_data(actual, coltypes) == processor.get_data(
        expected, coltypes
    )


@pytest.mark.parametrize("date_type", [pa.date32(), pa.date64()])
def test_semantic_date_resample_nulls_follow_sql_behavior(
    date_type: pa.DataType,
) -> None:
    """Preserve SQL's rejection of a NULL bucket rather than silently drop it."""
    table: pa.Table = pa.table(
        {
            "day": pa.array([date(2026, 1, 5), None, date(2026, 1, 7)], type=date_type),
            "amount": [1, 99, 3],
        }
    )
    query: ValidatedQueryObject = _resample_query()
    frame: pd.DataFrame = _mapped_frame(table, query)
    assert pd.isna(frame["day"].iloc[1])
    dataset: SqlaTable = SqlaTable(
        columns=[TableColumn(column_name="day", type="DATE", is_dttm=True)], offset=0
    )
    query.granularity = "day"
    ordinary: pd.DataFrame = dataset.normalize_df(table.to_pandas(), query)
    with pytest.raises(InvalidPostProcessingError, match="requires DatetimeIndex"):
        query.exec_post_processing(ordinary)
    with pytest.raises(InvalidPostProcessingError, match="requires DatetimeIndex"):
        query.exec_post_processing(frame)


def test_semantic_date_resample_empty_skips_post_processing(
    mocker: MockerFixture,
) -> None:
    """The host's empty-result guard keeps typed empty DATE results successful."""
    table: pa.Table = pa.table(
        {"day": pa.array([], type=pa.date32()), "amount": pa.array([], type=pa.int64())}
    )
    query: ValidatedQueryObject = _resample_query()
    result: QueryResult = map_semantic_result_to_query_result(
        SemanticResult(requests=[], results=table),
        query,
        timedelta(0),
        _ViewMetadata(metrics=(), dimensions=()),
    )
    mocker.patch("superset.semantic_layers.models.get_results", return_value=result)
    post_processing: MagicMock = mocker.patch.object(query, "exec_post_processing")
    assert SemanticView().get_query_result(query).df.empty
    post_processing.assert_not_called()


@pytest.mark.parametrize("resampling", [False, True])
@pytest.mark.parametrize("tz", [None, "UTC"])
def test_semantic_date_conversion_leaves_timestamps_unchanged(
    resampling: bool, tz: str | None
) -> None:
    """Native timestamps, including UTC instants, do not change dtype or values."""
    table: pa.Table = pa.table(
        {
            "day": pa.array(
                [datetime(2026, 1, 5, tzinfo=timezone.utc if tz else None)],
                type=pa.timestamp("us", tz=tz),
            ),
            "amount": [1],
        }
    )
    query: ValidatedQueryObject = (
        _resample_query() if resampling else ValidatedQueryObject()
    )
    pd.testing.assert_frame_equal(
        _mapped_frame(table, query), table.to_pandas(integer_object_nulls=True)
    )


@pytest.mark.parametrize("resampling", [False, True])
def test_semantic_date_conversion_keeps_text_and_exact_nullable_ints(
    resampling: bool,
) -> None:
    """Do not guess text dates or convert nullable identifiers through float64."""
    table: pa.Table = pa.table(
        {
            "day": ["2026-01-05", "2026-01-07"],
            "amount": [1, 3],
            "id": pa.array([2**53 + 1, None], type=pa.int64()),
        }
    )
    query: ValidatedQueryObject = (
        _resample_query() if resampling else ValidatedQueryObject()
    )
    frame: pd.DataFrame = _mapped_frame(table, query)
    pd.testing.assert_frame_equal(frame, table.to_pandas(integer_object_nulls=True))
    assert frame["id"].iloc[0] == 2**53 + 1
    if resampling:
        with pytest.raises(InvalidPostProcessingError, match="requires DatetimeIndex"):
            query.exec_post_processing(frame)


@pytest.mark.parametrize(
    "operation", ["rolling", "cum", "contribution", "compare", "prophet"]
)
def test_non_resample_operations_do_not_change_date_representation(
    operation: str,
) -> None:
    """Selecting other post-processing does not opt raw DATE output into timestamps."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        post_processing=[{"operation": operation}]
    )
    assert type(_date_frame(query)["day"].iloc[0]) is date


def test_resample_does_not_bypass_semantic_time_comparison_refusal(
    mocker: MockerFixture,
) -> None:
    """A real semantic datasource still rejects unsupported offsets before dispatch."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=SemanticView(id=7, name="Orders"),
        metrics=["amount"],
        columns=["day"],
        time_offsets=["1 week ago"],
        post_processing=[*_resample_query().post_processing],
    )
    dispatch: MagicMock = mocker.patch(
        "superset.semantic_layers.mapper._dispatch_semantic_query"
    )
    with pytest.raises(
        SemanticLayerQueryRejectedError, match="Time comparison is not yet supported"
    ):
        get_results(query)
    dispatch.assert_not_called()
