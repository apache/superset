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
from superset.semantic_layers.mapper import (
    _ViewMetadata,
    map_semantic_result_to_query_result,
    ValidatedQueryObject,
)
from superset.semantic_layers.models import SemanticView
from superset.utils.core import GenericDataType


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


def _sql_date_dataset() -> SqlaTable:
    """Build the ordinary DATE-axis baseline without a database connection."""
    return SqlaTable(
        columns=[TableColumn(column_name="day", type="DATE", is_dttm=True)], offset=0
    )


def _processor(result_format: ChartDataResultFormat) -> QueryContextProcessor:
    """Use the real export serializer with an offline query context."""
    context: MagicMock = MagicMock(result_format=result_format)
    context.datasource.data = {}
    return QueryContextProcessor(cast(QueryContext, context))


def _resample_query() -> ValidatedQueryObject:
    """Build the pivot/resample/flatten chain emitted by a daily time-series chart."""
    return ValidatedQueryObject(
        metrics=["amount"],
        columns=["day"],
        granularity="day",
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


def test_semantic_date_raw_xlsx_keeps_date_cell_format() -> None:
    """Raw spreadsheet cells retain date-only formatting."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        columns=["day"], metrics=["amount"], granularity="day"
    )
    result: object = _processor(ChartDataResultFormat.XLSX).get_data(
        _date_frame(query), [GenericDataType.TEMPORAL, GenericDataType.NUMERIC]
    )
    assert isinstance(result, bytes)
    sheet: Worksheet = cast(Worksheet, load_workbook(BytesIO(result)).active)
    assert sheet["A2"].value == datetime(2026, 1, 5)
    assert sheet["A2"].number_format == "YYYY-MM-DD"


@pytest.mark.parametrize("resampling", [False, True])
@pytest.mark.parametrize(
    "result_format",
    sorted(ChartDataResultFormat.table_like()) + [ChartDataResultFormat.JSON],
)
def test_semantic_date_exports_match_unchanged_raw_or_resampled_sql(
    resampling: bool, result_format: ChartDataResultFormat
) -> None:
    """Raw bytes stay identical; newly supported resampled exports match SQL output."""
    query: ValidatedQueryObject = (
        _resample_query() if resampling else ValidatedQueryObject(granularity="day")
    )
    # Build the independent pre-change raw frame rather than use the changed mapper.
    expected: pd.DataFrame = pd.DataFrame(
        {"day": [date(2026, 1, 5), date(2026, 1, 7)], "amount": [1, 3]}
    )
    actual: pd.DataFrame = _date_frame(query)
    if resampling:
        expected = query.exec_post_processing(
            _sql_date_dataset().normalize_df(expected, query)
        )
        actual = query.exec_post_processing(actual)
    processor: QueryContextProcessor = _processor(result_format)
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
    ordinary: pd.DataFrame = _sql_date_dataset().normalize_df(table.to_pandas(), query)
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
    expected: pd.DataFrame = result.df.copy()
    mocker.patch("superset.semantic_layers.models.get_results", return_value=result)
    post_processing: MagicMock = mocker.spy(query, "exec_post_processing")
    pd.testing.assert_frame_equal(SemanticView().get_query_result(query).df, expected)
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


@pytest.mark.parametrize("operation", ["rolling", "cum", "contribution", "compare"])
def test_non_resample_operations_do_not_change_date_representation(
    operation: str,
) -> None:
    """Selecting other post-processing does not opt raw DATE output into timestamps."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        granularity="day", post_processing=[{"operation": operation}]
    )
    assert type(_date_frame(query)["day"].iloc[0]) is date


@pytest.mark.parametrize("axis_type", [pa.date32(), pa.date64(), pa.timestamp("us")])
@pytest.mark.parametrize("base_axis", [False, True])
def test_resample_preserves_date_series_labels(
    axis_type: pa.DataType,
    base_axis: bool,
) -> None:
    """Normalize only the selected axis, matching SQL's unchanged DATE legends."""
    table: pa.Table = pa.table(
        {
            "day": pa.array(
                [datetime(2026, 1, 5), datetime(2026, 1, 7)], type=axis_type
            ),
            "cohort": pa.array([date(2025, 11, 1)] * 2, type=pa.date32()),
            "amount": [1, 3],
        }
    )
    query: ValidatedQueryObject = _resample_query()
    query.columns = (
        [
            {
                "sqlExpression": "day",
                "label": "day",
                "columnType": "BASE_AXIS",
            },
            "cohort",
        ]
        if base_axis
        else ["day", "cohort"]
    )
    query.granularity = None if base_axis else "day"
    query.post_processing[0]["options"]["columns"] = ["cohort"]
    dataset: SqlaTable = _sql_date_dataset()
    dataset.columns.append(TableColumn(column_name="cohort", type="DATE", is_dttm=True))
    expected: pd.DataFrame = query.exec_post_processing(
        dataset.normalize_df(table.to_pandas(), query)
    )
    actual: pd.DataFrame = query.exec_post_processing(_mapped_frame(table, query))
    assert actual.columns.tolist() == ["day", "amount, 2025-11-01"]
    assert actual.iloc[:, 1].tolist() == [1, 0, 3]
    pd.testing.assert_frame_equal(actual, expected, check_dtype=False)
