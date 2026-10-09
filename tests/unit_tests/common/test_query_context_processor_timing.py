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

from superset.common.chart_data_timing import QueryDataResult, QueryTiming
from superset.common.db_query_status import QueryStatus
from superset.common.query_context_processor import QueryContextProcessor


def _query_timing() -> QueryTiming:
    return QueryTiming(
        query_planning_ns=1_000_000,
        cache_resolution_ns=2_000_000,
        data_acquisition_ns=3_000_000,
        payload_assembly_ns=4_000_000,
        total_ns=12_000_000,
    )


def _query_obj() -> MagicMock:
    query_obj = MagicMock()
    query_obj.columns = ["col1"]
    query_obj.column_names = ["col1"]
    query_obj.metrics = []
    query_obj.metric_names = []
    query_obj.from_dttm = None
    query_obj.to_dttm = None
    query_obj.annotation_layers = []
    query_obj.filter = []
    return query_obj


def _processor() -> QueryContextProcessor:
    query_context = MagicMock()
    query_context.force = False
    query_context.form_data = {}
    query_context.cache_values = {"queries": [{}]}
    query_context.queries = [_query_obj()]
    query_context.prepare_contribution_totals.return_value = ([], None)

    processor = QueryContextProcessor.__new__(QueryContextProcessor)
    processor._query_context = query_context
    processor._qc_datasource = MagicMock()
    processor._qc_datasource.uid = "test_uid"
    processor._qc_datasource.column_names = ["col1"]
    processor._qc_datasource.data = {}
    return processor


def test_public_projection_is_explicit_and_versioned() -> None:
    assert _query_timing().as_public_dict() == {
        "version": 1,
        "query": {
            "query_planning_ms": 1.0,
            "cache_resolution_ms": 2.0,
            "data_acquisition_ms": 3.0,
            "payload_assembly_ms": 4.0,
            "total_ms": 12.0,
        },
    }


def test_public_projection_uses_null_for_non_applicable_phases() -> None:
    timing = QueryTiming(
        query_planning_ns=None,
        cache_resolution_ns=None,
        data_acquisition_ns=None,
        payload_assembly_ns=None,
        total_ns=1,
    )

    assert timing.as_public_dict()["query"] == {
        "query_planning_ms": None,
        "cache_resolution_ms": None,
        "data_acquisition_ms": None,
        "payload_assembly_ms": None,
        "total_ms": 0.0,
    }


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_dataframe_payload_result_keeps_timing_outside_payload(
    cache_manager: MagicMock,
) -> None:
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = "2026-01-01T00:00:00"
    cache.queried_dttm = "2026-01-01T00:00:00"
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = "SELECT 1"
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    cache_manager.get.return_value = cache

    processor = _processor()
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
    ):
        result = processor.get_df_payload_result(_query_obj())

    assert "timing" not in result.payload
    assert result.payload["query"] == "SELECT 1"
    assert result.timing.query_planning_ns >= 0
    assert result.timing.cache_resolution_ns >= 0
    assert result.timing.data_acquisition_ns is None
    assert result.timing.payload_assembly_ns >= 0


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_dataframe_payload_result_measures_non_overlapping_stages(
    cache_manager: MagicMock,
) -> None:
    cache = MagicMock()
    cache.is_loaded = False
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = "2026-01-01T00:00:00"
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = "SELECT 1"
    cache.status = QueryStatus.SUCCESS
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    cache_manager.get.return_value = cache

    processor = _processor()
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", return_value=MagicMock()),
        patch.object(processor, "get_annotation_data", return_value={}),
        patch(
            "superset.common.query_context_processor.time.perf_counter_ns",
            side_effect=[100, 110, 120, 130, 140, 170, 180, 195],
        ),
    ):
        result = processor.get_df_payload_result(_query_obj())

    assert result.timing.query_planning_ns == 10
    assert result.timing.cache_resolution_ns == 10
    assert result.timing.data_acquisition_ns == 30
    assert result.timing.payload_assembly_ns == 15
    cache.set_query_result.assert_called_once()


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_cache_resolution_includes_loaded_cache_compatibility_policy(
    cache_manager: MagicMock,
) -> None:
    """A legacy cached value becomes a miss before cache resolution completes."""
    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = "2026-01-01T00:00:00"
    cache.queried_dttm = "2026-01-01T00:00:00"
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = "SELECT 1"
    cache.status = QueryStatus.SUCCESS
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    cache_manager.get.return_value = cache

    query_obj = _query_obj()
    query_obj.filter = [{"col": "col1", "op": "==", "val": 1}]
    processor = _processor()
    clock_values = iter((100, 110, 120, 130, 140, 170, 180, 195))
    clock_calls = 0

    def perf_counter_ns() -> int:
        nonlocal clock_calls
        clock_calls += 1
        if clock_calls == 4:
            assert cache.is_loaded is False
        return next(clock_values)

    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", return_value=MagicMock()),
        patch.object(processor, "get_annotation_data", return_value={}),
        patch(
            "superset.common.query_context_processor.time.perf_counter_ns",
            side_effect=perf_counter_ns,
        ),
    ):
        result = processor.get_df_payload_result(query_obj)

    assert result.timing.cache_resolution_ns == 10
    assert result.timing.data_acquisition_ns == 30
    cache.set_query_result.assert_called_once()


def test_get_payload_preserves_legacy_shape_without_timing() -> None:
    processor = _processor()
    query_payload = {"data": [{"col1": 1}]}

    with (
        patch(
            "superset.common.query_context_processor.get_query_results_with_timing",
            return_value=QueryDataResult(query_payload, _query_timing()),
        ),
    ):
        result = processor.get_payload()

    assert result == {"queries": [query_payload]}
    assert "timing" not in result["queries"][0]


def test_get_payload_result_keeps_timing_sidecar() -> None:
    processor = _processor()
    query_payload = {"data": [{"col1": 1}]}

    with (
        patch(
            "superset.common.query_context_processor.get_query_results_with_timing",
            return_value=QueryDataResult(query_payload, _query_timing()),
        ),
    ):
        result = processor.get_payload_result()

    assert result.queries[0].payload == query_payload
    assert result.queries[0].timing.total_ns == 12_000_000
    assert "timing" not in result.queries[0].payload
