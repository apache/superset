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

import pandas as pd
import pytest

from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    CacheWriteOutcome,
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
    SourceKind,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import (
    _acquire_currency_dependency,
    acquire_query_data,
)
from superset.common.query_object import QueryObject
from superset.utils.core import FilterOperator


@pytest.fixture
def mock_query_context() -> MagicMock:
    """Create a mock QueryContext with AUTO currency format."""
    context = MagicMock()
    context.form_data = {"currency_format": {"symbol": "AUTO"}}
    return context


@pytest.fixture
def mock_query_obj() -> MagicMock:
    """Create a mock QueryObject with filter attributes."""
    obj = MagicMock()
    obj.filter = []
    obj.granularity = None
    obj.from_dttm = None
    obj.to_dttm = None
    obj.extras = {}
    return obj


@pytest.fixture
def mock_datasource() -> MagicMock:
    """Create a mock datasource with currency column."""
    ds = MagicMock()
    ds.currency_code_column = "currency_code"
    return ds


def test_modern_currency_dependency_is_cache_aware_and_bounded(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    timing = QueryAcquisitionTiming(
        cache_key_ns=1,
        cache_read_ns=2,
        source_ns=3,
        cache_write_ns=4,
        cache_write_outcome=CacheWriteOutcome.SUCCEEDED,
        cache_hit=False,
        sources=(),
    )
    primary = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"value": [1]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    dependency = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"currency_code": ["USD"]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    mock_query_obj.datasource = mock_datasource
    mock_query_obj.annotation_layers = []
    mock_query_obj.time_offsets = []
    mock_query_context.get_df_payload_result.return_value = dependency

    combined, currency, _ = _acquire_currency_dependency(
        mock_query_context,
        mock_query_obj,
        primary,
        force_cached=True,
    )

    hidden_query = mock_query_context.get_df_payload_result.call_args.args[0]
    assert hidden_query.columns == ["currency_code"]
    assert hidden_query.filter == [
        {"col": "currency_code", "op": FilterOperator.IS_NOT_NULL, "val": ""}
    ]
    assert hidden_query.row_limit == 2
    assert hidden_query.metrics == []
    assert hidden_query.is_timeseries is False
    assert mock_query_context.get_df_payload_result.call_args.kwargs == {
        "force_cached": True,
        "source_kind": SourceKind.CURRENCY_DETECTION,
    }
    assert currency == "USD"
    assert combined.timing.source_ns == 6


def test_currency_dependency_preserves_existing_filters_and_excludes_null_codes(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    timing = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=0,
        source_ns=0,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        cache_hit=False,
        sources=(),
    )
    primary = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"value": [1]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    dependency = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"currency_code": ["USD"]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    existing_filter = {"col": "region", "op": "IN", "val": ["EMEA"]}
    mock_query_obj.filter = [existing_filter]
    mock_query_obj.datasource = mock_datasource
    mock_query_obj.annotation_layers = []
    mock_query_obj.time_offsets = []
    mock_query_context.get_df_payload_result.return_value = dependency

    _acquire_currency_dependency(
        mock_query_context,
        mock_query_obj,
        primary,
        force_cached=False,
    )

    hidden_query = mock_query_context.get_df_payload_result.call_args.args[0]
    assert hidden_query.filter == [
        existing_filter,
        {"col": "currency_code", "op": FilterOperator.IS_NOT_NULL, "val": ""},
    ]
    assert mock_query_obj.filter == [existing_filter]


def test_acquisition_passes_additional_cache_identity() -> None:
    query_context = MagicMock()
    query_context.form_data = {}
    datasource = MagicMock()
    datasource.currency_code_column = None
    query = QueryObject(datasource=datasource, columns=["region"])
    acquisition = QueryAcquisitionResult(
        payload={"df": pd.DataFrame(), "status": QueryStatus.SUCCESS},
        timing=QueryAcquisitionTiming(
            cache_key_ns=0,
            cache_read_ns=0,
            source_ns=0,
            cache_write_ns=None,
            cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
            cache_hit=False,
            sources=(),
        ),
    )
    query_context.get_df_payload_result.return_value = acquisition

    result = acquire_query_data(
        ChartDataResultType.FULL,
        query_context,
        query,
        False,
        cache_key_extra={"dependency": "producer-cache-key"},
    )

    assert result is not None
    query_context.get_df_payload_result.assert_called_once_with(
        query,
        force_cached=False,
        cache_key_extra={"dependency": "producer-cache-key"},
    )


def test_cache_only_prewarms_currency_without_detecting_value(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    timing = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=0,
        source_ns=0,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        cache_hit=True,
        sources=(),
    )
    primary = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"value": [1]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    mock_query_context.get_df_payload_result.return_value = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"currency_code": ["USD"]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    mock_query_obj.datasource = mock_datasource
    mock_query_obj.annotation_layers = []
    mock_query_obj.time_offsets = []

    with patch(
        "superset.common.query_actions.detect_currency_from_df"
    ) as detect_from_df:
        _, currency, processing_ns = _acquire_currency_dependency(
            mock_query_context,
            mock_query_obj,
            primary,
            force_cached=False,
            detect_value=False,
        )

    mock_query_context.get_df_payload_result.assert_called_once()
    detect_from_df.assert_not_called()
    assert currency is None
    assert processing_ns == 0


def test_currency_dependency_is_not_started_after_primary_failure(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    timing = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=0,
        source_ns=0,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        cache_hit=False,
        sources=(),
    )
    primary = QueryAcquisitionResult(
        payload={"df": pd.DataFrame(), "status": QueryStatus.FAILED},
        timing=timing,
    )
    mock_query_obj.datasource = mock_datasource

    combined, currency, processing_ns = _acquire_currency_dependency(
        mock_query_context,
        mock_query_obj,
        primary,
        force_cached=False,
    )

    assert combined is primary
    assert currency is None
    assert processing_ns == 0
    mock_query_context.get_df_payload_result.assert_not_called()


def test_failed_currency_dependency_does_not_run_detection(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    timing = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=0,
        source_ns=0,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        cache_hit=False,
        sources=(),
    )
    primary = QueryAcquisitionResult(
        payload={
            "df": pd.DataFrame({"value": [1]}),
            "status": QueryStatus.SUCCESS,
        },
        timing=timing,
    )
    dependency = QueryAcquisitionResult(
        payload={"df": pd.DataFrame(), "status": QueryStatus.FAILED},
        timing=timing,
    )
    mock_query_obj.datasource = mock_datasource
    mock_query_obj.annotation_layers = []
    mock_query_obj.time_offsets = []
    mock_query_context.get_df_payload_result.return_value = dependency

    with patch(
        "superset.common.query_actions.detect_currency_from_df"
    ) as detect_from_df:
        _, currency, processing_ns = _acquire_currency_dependency(
            mock_query_context,
            mock_query_obj,
            primary,
            force_cached=False,
        )

    assert currency is None
    assert processing_ns == 0
    detect_from_df.assert_not_called()
