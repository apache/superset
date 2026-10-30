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
from flask_caching.backends import NullCache, SimpleCache

from superset.common.chart_data_timing import QueryDataResult, QueryTiming
from superset.common.db_query_status import QueryStatus
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion


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


@pytest.mark.parametrize(
    ("timeout", "force", "expected_force"),
    [(-1, False, True), (60, True, True), (60, False, False)],
)
def test_contribution_totals_receive_resolved_cache_policy(
    timeout: int, force: bool, expected_force: bool
) -> None:
    """Direct totals dispatch honors the same disabled/forced cache policy."""
    processor: QueryContextProcessor = _processor()
    main: MagicMock = _query_obj()
    main.post_processing = [{"operation": "contribution", "options": {}}]
    totals: MagicMock = _query_obj()
    context: MagicMock = MagicMock()
    context.queries = [main, totals]
    context.get_query_result.return_value.df = pd.DataFrame({"revenue": [5.0]})
    processor._query_context = context

    def execute(query: MagicMock) -> MagicMock:
        assert query is totals
        assert query.cache_timeout == timeout
        assert query.force_query is expected_force
        return context.get_query_result.return_value

    context.get_query_result.side_effect = execute
    with (
        patch.object(processor, "get_cache_timeout", return_value=timeout),
        patch.object(processor, "query_cache_key", return_value="totals-key"),
        patch.object(processor, "_resolve_forced_query", return_value=force),
    ):
        processor.ensure_totals_available([0], 1)
    context.get_query_result.assert_called_once_with(totals)
    assert main.post_processing[0]["options"]["contribution_totals"] == {"revenue": 5.0}


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


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_dataframe_payload_result_resolves_force_and_timeout_onto_query_object(
    cache_manager: MagicMock,
) -> None:
    """Datasources with their own caching (semantic containment) read the
    force decision and timeout from the query object, so the processor must
    hand them the values it resolved for the result cache."""
    cache: MagicMock = MagicMock()
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

    processor: QueryContextProcessor = _processor()
    query_obj: MagicMock = _query_obj()
    query_obj.force_query = False
    query_obj.cache_timeout = None
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=-1),
    ):
        processor.get_df_payload_result(query_obj)

    # A resolved ``-1`` disables caching, which the processor expresses as a
    # forced query; both facts must reach the query object.
    assert query_obj.force_query is True
    assert query_obj.cache_timeout == -1
    cache_manager.get.assert_called_once()
    assert cache_manager.get.call_args.kwargs["force_query"] is True


def _cache(is_loaded: bool) -> MagicMock:
    cache: MagicMock = MagicMock()
    cache.is_loaded = is_loaded
    cache.is_cached = is_loaded
    cache.df = pd.DataFrame({"col1": [1]})
    cache.cache_dttm = "2026-01-01T00:00:00" if is_loaded else None
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
    return cache


def _emitted(stats_logger: MagicMock) -> tuple[set[str], set[str]]:
    timers = {call.args[0] for call in stats_logger.timing.call_args_list}
    counters = {call.args[0] for call in stats_logger.incr.call_args_list}
    return timers, counters


@pytest.mark.parametrize(
    ("is_loaded", "timeout", "expected_counter"),
    [
        (True, 300, "chart_data.cache.hit"),
        (False, 300, "chart_data.cache.miss"),
        (False, -1, "chart_data.cache.bypass"),
    ],
)
@patch("superset.utils.timing_metrics.stats_logger_manager")
@patch("superset.common.query_context_processor.QueryCacheManager")
def test_dataframe_payload_result_emits_cache_outcome(
    cache_manager: MagicMock,
    stats_logger_manager: MagicMock,
    is_loaded: bool,
    timeout: int,
    expected_counter: str,
) -> None:
    cache_manager.get.return_value = _cache(is_loaded)
    processor: QueryContextProcessor = _processor()
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=timeout),
        patch.object(processor, "get_query_result", return_value=MagicMock()),
        patch.object(processor, "get_annotation_data", return_value={}),
    ):
        processor.get_df_payload_result(_query_obj())

    timers, counters = _emitted(stats_logger_manager.instance)
    assert counters == {expected_counter}
    # A bypass never reads the cache backend, so it has no read timing.
    assert ("chart_data.cache.get" in timers) is (
        expected_counter != "chart_data.cache.bypass"
    )
    assert {
        "chart_data.cache.key",
        "chart_data.query.planning",
        "chart_data.query.payload_assembly",
        "chart_data.query.total",
    } <= timers
    # Datasource time is only measured when the datasource was queried.
    assert ("chart_data.query.data_acquisition" in timers) is (not is_loaded)
    assert ("chart_data.query.annotations" in timers) is (not is_loaded)


@pytest.mark.parametrize(
    ("status", "timeout", "backend", "expect_write"),
    [
        (QueryStatus.SUCCESS, 60, "simple", True),
        (QueryStatus.FAILED, 60, "simple", False),
        (QueryStatus.SUCCESS, 60, "null", False),
        (QueryStatus.SUCCESS, -1, "simple", False),
    ],
)
@patch("superset.utils.timing_metrics.stats_logger_manager")
@patch.object(QueryCacheManager, "set", return_value=True)
def test_cache_set_timed_only_for_cache_writes(
    cache_set: MagicMock,
    stats_logger_manager: MagicMock,
    status: QueryStatus,
    timeout: int,
    backend: str,
    expect_write: bool,
    app_context: None,
) -> None:
    """Failed results and writes skipped by the cache layer are not timed."""
    query_result: MagicMock = MagicMock()
    query_result.status = status
    query_result.df = pd.DataFrame({"col1": [1]})
    region_cache: MagicMock = MagicMock()
    region_cache.cache = NullCache() if backend == "null" else SimpleCache()

    with patch.dict(
        "superset.common.utils.query_cache_manager._cache",
        {CacheRegion.DEFAULT: region_cache},
    ):
        QueryCacheManager().set_query_result(
            key="key", query_result=query_result, timeout=timeout
        )

    timers, _ = _emitted(stats_logger_manager.instance)
    assert ("chart_data.cache.set" in timers) is expect_write


@patch("superset.utils.timing_metrics.stats_logger_manager")
@patch("superset.common.query_context_processor.QueryCacheManager")
def test_cache_outcome_is_bypass_without_cache_backend(
    cache_manager: MagicMock, stats_logger_manager: MagicMock
) -> None:
    cache_manager.has_backend.return_value = False
    cache_manager.get.return_value = _cache(False)
    processor: QueryContextProcessor = _processor()
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", return_value=MagicMock()),
        patch.object(processor, "get_annotation_data", return_value={}),
    ):
        processor.get_df_payload_result(_query_obj())

    timers, counters = _emitted(stats_logger_manager.instance)
    assert counters == {"chart_data.cache.bypass"}
    assert "chart_data.cache.get" not in timers


@patch("superset.utils.timing_metrics.stats_logger_manager")
@patch("superset.common.query_context_processor.QueryCacheManager")
def test_query_timers_emitted_when_acquisition_raises(
    cache_manager: MagicMock, stats_logger_manager: MagicMock
) -> None:
    cache_manager.get.return_value = _cache(False)
    processor: QueryContextProcessor = _processor()
    with (
        patch.object(processor, "query_cache_key", return_value="key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", side_effect=RuntimeError("boom")),
        pytest.raises(RuntimeError),
    ):
        processor.get_df_payload_result(_query_obj())

    timers, _ = _emitted(stats_logger_manager.instance)
    assert {
        "chart_data.query.planning",
        "chart_data.query.data_acquisition",
        "chart_data.query.total",
    } <= timers
    assert "chart_data.query.payload_assembly" not in timers
