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
import copy
from contextlib import contextmanager
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.commands.chart.data.get_data_command import (
    ChartDataCommand,
    ChartDataExecutionMode,
    ChartDataExecutionOptions,
)
from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    CacheWriteOutcome,
    ChartDataExecutionResult,
    combine_acquisition_timings,
    deserialize_source_trace,
    MAX_SOURCE_TRACE_NODES,
    project_query_timing,
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
    QueryContextExecutionResult,
    QueryDataResult,
    QueryTiming,
    serialize_source_trace,
    source_timing,
    SourceKind,
    SourceOrigin,
    SourceProvider,
    SourceTiming,
    SourceTimingCollector,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import AcquiredQuery
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.exceptions import QueryObjectValidationError


def query_timing(
    *,
    cache_hit: bool | None = False,
    cache_write_outcome: CacheWriteOutcome = CacheWriteOutcome.SUCCEEDED,
    sources: tuple[SourceTiming, ...] | None = (),
) -> QueryTiming:
    return QueryAcquisitionTiming(
        cache_key_ns=1_000_000,
        cache_read_ns=2_000_000,
        source_ns=3_000_000,
        cache_write_ns=4_000_000,
        cache_write_outcome=cache_write_outcome,
        cache_hit=cache_hit,
        sources=sources,
    ).materialized(5_000_000)


def source_trace(origin: SourceOrigin = SourceOrigin.CURRENT) -> SourceTiming:
    return SourceTiming(
        kind=SourceKind.PRIMARY,
        provider=SourceProvider.SQL,
        origin=origin,
        planning_ns=1_000_000,
        execution_ns=2_000_000,
        processing_ns=3_000_000,
        total_ns=6_000_000,
    )


def acquired_query(
    query: QueryObject,
    df: pd.DataFrame,
    status: QueryStatus = QueryStatus.SUCCESS,
) -> AcquiredQuery:
    return AcquiredQuery(
        query_obj=query,
        acquisition=QueryAcquisitionResult(
            payload={"df": df, "status": status},
            timing=QueryAcquisitionTiming(
                cache_key_ns=0,
                cache_read_ns=0,
                source_ns=0,
                cache_write_ns=None,
                cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
                cache_hit=None,
                sources=(),
            ),
        ),
        detected_currency=None,
        currency_processing_ns=0,
    )


def test_source_trace_cache_round_trip_marks_historical_origin() -> None:
    cached = serialize_source_trace((source_trace(),))

    parsed = deserialize_source_trace(cached)

    assert parsed is not None
    assert parsed[0].origin == SourceOrigin.CACHE
    assert parsed[0].execution_ns == 2_000_000


@pytest.mark.parametrize(
    "value",
    [
        None,
        {},
        {"version": 0, "sources": []},
        {"version": 2, "sources": [{"kind": "primary"}]},
        {"version": 2, "sources": "not-a-list"},
    ],
)
def test_source_trace_ignores_old_or_malformed_values(value: Any) -> None:
    assert deserialize_source_trace(value) is None


def test_source_trace_is_bounded() -> None:
    collector = SourceTimingCollector()
    token = collector.activate()
    try:
        with collector.source(SourceKind.PRIMARY, SourceProvider.SQL):
            for _ in range(MAX_SOURCE_TRACE_NODES + 5):
                with source_timing(SourceKind.TIME_OFFSET, SourceProvider.SQL):
                    pass
    finally:
        SourceTimingCollector.deactivate(token)

    trace = collector.snapshot()
    assert len(trace) == 1
    assert trace[0].truncated is True
    assert len(trace[0].children) == MAX_SOURCE_TRACE_NODES - 1


def test_source_trace_root_overflow_marks_last_retained_root() -> None:
    collector = SourceTimingCollector()
    for _ in range(MAX_SOURCE_TRACE_NODES + 1):
        with collector.source(SourceKind.PRIMARY, SourceProvider.SQL):
            pass

    trace = collector.snapshot()

    assert len(trace) == MAX_SOURCE_TRACE_NODES
    assert trace[-1].truncated is True


def test_deserializer_retains_budget_limited_roots() -> None:
    root = source_trace().as_cache_value()
    cached = {
        "version": 2,
        "sources": [root for _ in range(MAX_SOURCE_TRACE_NODES + 1)],
    }

    trace = deserialize_source_trace(cached)

    assert trace is not None
    assert len(trace) == MAX_SOURCE_TRACE_NODES
    assert trace[-1].truncated is True


def test_deserializer_rejects_malformed_nested_source() -> None:
    child = source_trace().as_cache_value()
    child["kind"] = "invalid"
    root = source_trace().as_cache_value()
    root["children"] = [child]

    assert deserialize_source_trace({"version": 2, "sources": [root]}) is None


def test_source_phases_exclude_nested_source_time() -> None:
    class Clock:
        value = 0

        def __call__(self) -> int:
            return self.value

        def advance(self, duration: int) -> None:
            self.value += duration

    clock = Clock()
    collector = SourceTimingCollector(clock)

    with collector.source(SourceKind.PRIMARY, SourceProvider.SQL):
        with collector.phase("execution"):
            clock.advance(10)
            with collector.source(SourceKind.TIME_OFFSET, SourceProvider.SQL):
                with collector.phase("execution"):
                    clock.advance(4)
            clock.advance(6)

    root = collector.snapshot()[0]
    assert root.total_ns == 20
    assert root.execution_ns == 16
    assert root.children[0].total_ns == 4
    assert root.children[0].execution_ns == 4
    assert (
        root.planning_ns
        + root.execution_ns
        + root.processing_ns
        + sum(child.total_ns for child in root.children)
        <= root.total_ns
    )


def test_refused_child_does_not_leak_phases_to_parent() -> None:
    class Clock:
        value = 0

        def __call__(self) -> int:
            return self.value

        def advance(self, duration: int) -> None:
            self.value += duration

    clock = Clock()
    collector = SourceTimingCollector(clock)

    with collector.source(SourceKind.PRIMARY, SourceProvider.SQL):
        with collector.phase("execution"):
            clock.advance(10)
            collector._node_count = MAX_SOURCE_TRACE_NODES  # noqa: SLF001
            with collector.source(SourceKind.TIME_OFFSET, SourceProvider.SQL):
                with collector.phase("processing"):
                    clock.advance(4)
            clock.advance(6)

    root = collector.snapshot()[0]
    assert root.total_ns == 20
    assert root.execution_ns == 16
    assert root.children == ()
    assert root.truncated is True


def test_attached_source_trace_respects_outer_depth() -> None:
    def add_nested_sources(collector: SourceTimingCollector, depth: int) -> None:
        with collector.source(SourceKind.PRIMARY, SourceProvider.SQL):
            if depth > 1:
                add_nested_sources(collector, depth - 1)

    nested = SourceTimingCollector()
    add_nested_sources(nested, 8)

    outer = SourceTimingCollector()
    with outer.source(SourceKind.PRIMARY, SourceProvider.SQL):
        with outer.source(SourceKind.ANNOTATION, SourceProvider.OTHER):
            outer.attach(nested.snapshot())

    trace = outer.snapshot()
    node = trace[0]
    depth = 1
    while node.children:
        node = node.children[0]
        depth += 1

    assert depth == 8
    assert node.truncated is True


def test_public_projection_is_explicit_and_versioned() -> None:
    payload: dict[str, Any] = {"data": []}
    timing = query_timing(sources=(source_trace(),))

    with patch("superset.common.chart_data_timing.current_app") as app:
        app.config = {"CHART_DATA_INCLUDE_TIMING": True}
        project_query_timing(payload, timing)

    assert payload["timing"] == {
        "version": 1,
        "query": {
            "cache_key_ms": 1.0,
            "cache_read_ms": 2.0,
            "source_ms": 3.0,
            "cache_write_ms": 4.0,
            "cache_write_status": "succeeded",
            "materialization_ms": 5.0,
            "total_ms": 15.0,
            "cache_hit": False,
        },
        "sources": [
            {
                "kind": "primary",
                "provider": "sql",
                "origin": "current",
                "planning_ms": 1.0,
                "execution_ms": 2.0,
                "processing_ms": 3.0,
                "total_ms": 6.0,
                "children": [],
                "truncated": False,
            }
        ],
    }


def test_query_total_uses_wall_clock_acquisition_not_phase_sum() -> None:
    acquisition = QueryAcquisitionTiming(
        cache_key_ns=1,
        cache_read_ns=2,
        source_ns=3,
        cache_write_ns=4,
        cache_write_outcome=CacheWriteOutcome.SUCCEEDED,
        cache_hit=False,
        sources=(),
        elapsed_ns=20,
    )

    timing = acquisition.materialized(5)

    assert acquisition.total_ns == 20
    assert timing.total_ns == 25


def test_current_dependency_trace_survives_missing_historical_trace() -> None:
    cached = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=1,
        source_ns=0,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        cache_hit=True,
        sources=None,
    )
    current_source = source_trace()
    dependency = QueryAcquisitionTiming(
        cache_key_ns=0,
        cache_read_ns=1,
        source_ns=5,
        cache_write_ns=1,
        cache_write_outcome=CacheWriteOutcome.SUCCEEDED,
        cache_hit=False,
        sources=(current_source,),
    )

    combined = combine_acquisition_timings(cached, dependency)

    assert combined.sources == (current_source,)
    assert combined.cache_hit is False


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_dataframe_acquisition_returns_timing_outside_payload(
    cache_manager: MagicMock,
) -> None:
    query_context = MagicMock()
    query_context.force = False
    datasource = MagicMock()
    datasource.type = "table"
    datasource.uid = "1__table"
    datasource.column_names = ["value"]
    processor = QueryContextProcessor(query_context)
    processor._qc_datasource = datasource

    cache = MagicMock()
    cache.is_loaded = True
    cache.is_cached = True
    cache.has_applied_filter_columns = True
    cache.source_trace = (source_trace(SourceOrigin.CACHE),)
    cache.df = pd.DataFrame({"value": [1]})
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = None
    cache.query = "SELECT value"
    cache.status = "success"
    cache.stacktrace = None
    cache.sql_rowcount = 1
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0
    cache_manager.get.return_value = cache

    query = MagicMock()
    query.columns = ["value"]
    query.column_names = ["value"]
    query.metrics = []
    query.metric_names = []
    query.filter = []
    query.from_dttm = None
    query.to_dttm = None
    query.annotation_layers = []

    with (
        patch.object(processor, "query_cache_key", return_value="cache-key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
    ):
        result = processor.get_df_payload_result(query)

    assert "timing" not in result.payload
    assert all(not key.startswith("_chart_data") for key in result.payload)
    assert result.timing.cache_hit is True
    assert result.timing.sources is not None
    assert result.timing.sources[0].origin == SourceOrigin.CACHE


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_cache_write_timer_starts_after_result_loading(
    cache_manager: MagicMock,
) -> None:
    events: list[str] = []
    clock_value = 0

    def clock() -> int:
        nonlocal clock_value
        clock_value += 1
        events.append("clock")
        return clock_value

    query_context = MagicMock()
    query_context.force = False
    datasource = MagicMock()
    datasource.type = "table"
    datasource.uid = "1__table"
    datasource.column_names = ["value"]
    processor = QueryContextProcessor(query_context)
    processor._qc_datasource = datasource

    cache = MagicMock()
    cache.is_loaded = False
    cache.is_cached = None
    cache.status = None
    cache.source_trace = None
    cache.df = pd.DataFrame()
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0

    def load_result(*args: Any, **kwargs: Any) -> None:
        events.append("load")
        cache.is_loaded = True
        cache.status = QueryStatus.SUCCESS
        cache.df = pd.DataFrame({"value": [1]})
        cache.cache_dttm = None
        cache.queried_dttm = None
        cache.applied_template_filters = []
        cache.applied_filter_columns = []
        cache.rejected_filter_columns = []
        cache.annotation_data = {}
        cache.error_message = None
        cache.query = "SELECT value"
        cache.stacktrace = None
        cache.sql_rowcount = 1

    def write_result(*args: Any, **kwargs: Any) -> CacheWriteOutcome:
        events.append("write")
        return CacheWriteOutcome.SUCCEEDED

    cache.load_query_result.side_effect = load_result
    cache.write_query_result_with_outcome.side_effect = write_result
    cache_manager.get.return_value = cache

    query = MagicMock()
    query.columns = ["value"]
    query.column_names = ["value"]
    query.metrics = []
    query.metric_names = []
    query.filter = []
    query.from_dttm = None
    query.to_dttm = None
    query.annotation_layers = []
    query_result = MagicMock(status=QueryStatus.SUCCESS)

    with (
        patch.object(processor, "query_cache_key", return_value="cache-key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", return_value=query_result),
        patch(
            "superset.common.query_context_processor.time.perf_counter_ns",
            side_effect=clock,
        ),
    ):
        result = processor.get_df_payload_result(query)

    load_idx = events.index("load")
    write_idx = events.index("write")
    assert events[load_idx + 1 : write_idx] == ["clock"]
    assert events[write_idx + 1] == "clock"
    assert result.timing.cache_write_ns == 1
    assert result.timing.cache_write_outcome == CacheWriteOutcome.SUCCEEDED


@patch("superset.common.query_context_processor.QueryCacheManager")
def test_failed_result_loading_does_not_attempt_cache_write(
    cache_manager: MagicMock,
) -> None:
    query_context = MagicMock()
    query_context.force = False
    datasource = MagicMock()
    datasource.type = "table"
    datasource.uid = "1__table"
    datasource.column_names = ["value"]
    processor = QueryContextProcessor(query_context)
    processor._qc_datasource = datasource

    cache = MagicMock()
    cache.is_loaded = False
    cache.is_cached = None
    cache.status = None
    cache.source_trace = None
    cache.df = pd.DataFrame()
    cache.cache_dttm = None
    cache.queried_dttm = None
    cache.applied_template_filters = []
    cache.applied_filter_columns = []
    cache.rejected_filter_columns = []
    cache.annotation_data = {}
    cache.error_message = "failed"
    cache.query = ""
    cache.stacktrace = None
    cache.sql_rowcount = None
    cache.bq_memory_limited = False
    cache.bq_memory_limited_row_count = 0

    def fail_loading(*args: Any, **kwargs: Any) -> None:
        cache.status = QueryStatus.FAILED
        cache.is_loaded = False

    cache.load_query_result.side_effect = fail_loading
    cache_manager.get.return_value = cache

    query = MagicMock()
    query.columns = ["value"]
    query.column_names = ["value"]
    query.metrics = []
    query.metric_names = []
    query.filter = []
    query.from_dttm = None
    query.to_dttm = None
    query.annotation_layers = []

    with (
        patch.object(processor, "query_cache_key", return_value="cache-key"),
        patch.object(processor, "get_cache_timeout", return_value=300),
        patch.object(processor, "get_query_result", return_value=MagicMock()),
    ):
        result = processor.get_df_payload_result(query)

    cache.write_query_result_with_outcome.assert_not_called()
    assert result.timing.cache_write_ns is None
    assert result.timing.cache_write_outcome == CacheWriteOutcome.NOT_ATTEMPTED


def test_command_run_preserves_legacy_payload_without_timing() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(QueryDataResult({"data": []}, query_timing()),)
    )

    with patch("superset.commands.chart.data.get_data_command.emit_query_timing"):
        result = ChartDataCommand(query_context).run()

    assert result["queries"] == [{"data": []}]
    assert "timing" not in result["queries"][0]


def test_nested_chart_commands_emit_telemetry_only_from_outer_owner() -> None:
    inner_context = MagicMock()
    inner_context.result_type = ChartDataResultType.FULL
    inner_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(QueryDataResult({"data": ["inner"]}, query_timing()),)
    )

    outer_context = MagicMock()
    outer_context.result_type = ChartDataResultType.FULL
    outer_timing = query_timing()

    def execute_outer(**kwargs: Any) -> QueryContextExecutionResult:
        ChartDataCommand(inner_context).execute()
        return QueryContextExecutionResult(
            queries=(QueryDataResult({"data": ["outer"]}, outer_timing),)
        )

    outer_context.get_payload_result.side_effect = execute_outer

    with patch(
        "superset.commands.chart.data.get_data_command.emit_query_timing"
    ) as emit:
        ChartDataCommand(outer_context).execute()

    emit.assert_called_once_with(outer_timing)


def test_failed_chart_command_emits_completed_query_timing() -> None:
    timing = query_timing()
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(QueryDataResult({"error": "database error"}, timing),)
    )

    with (
        patch(
            "superset.commands.chart.data.get_data_command.emit_query_timing"
        ) as emit,
        pytest.raises(ChartDataQueryFailedError),
    ):
        ChartDataCommand(query_context).execute()

    emit.assert_called_once_with(timing)


def test_chart_command_converts_query_validation_failure() -> None:
    query_context = MagicMock()
    query_context.get_payload_result.side_effect = QueryObjectValidationError(
        "invalid contribution plan"
    )

    with pytest.raises(ChartDataQueryFailedError, match="invalid contribution plan"):
        ChartDataCommand(query_context).execute()


def test_cache_only_rejects_failed_query_cache_write() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(
            QueryDataResult(
                {"status": "success"},
                query_timing(cache_write_outcome=CacheWriteOutcome.FAILED),
            ),
        ),
        cache_key="qc-key",
        context_cache_write_outcome=CacheWriteOutcome.SUCCEEDED,
    )

    with pytest.raises(ChartDataQueryFailedError):
        ChartDataCommand(query_context).execute(
            ChartDataExecutionOptions(mode=ChartDataExecutionMode.CACHE_ONLY)
        )

    query_context.get_payload_result.assert_called_once_with(
        cache_query_context=False,
        force_cached=False,
        materialize=False,
    )


def test_cache_only_allows_configuration_skips_for_warmup() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(
            QueryDataResult(
                {"status": "success"},
                query_timing(
                    cache_hit=False,
                    cache_write_outcome=CacheWriteOutcome.SKIPPED,
                ),
            ),
        ),
    )

    ChartDataCommand(query_context).execute(
        ChartDataExecutionOptions(mode=ChartDataExecutionMode.CACHE_ONLY)
    )


def test_strict_cache_only_requires_data_and_context_cache() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(
            QueryDataResult(
                {"status": "success"},
                query_timing(
                    cache_hit=False,
                    cache_write_outcome=CacheWriteOutcome.SKIPPED,
                ),
            ),
        ),
        context_cache_write_outcome=CacheWriteOutcome.SUCCEEDED,
    )

    with pytest.raises(ChartDataQueryFailedError):
        ChartDataCommand(query_context).execute(
            ChartDataExecutionOptions(
                mode=ChartDataExecutionMode.CACHE_ONLY,
                cache_query_context=True,
                require_cache_writes=True,
            )
        )

    query_context.get_payload_result.assert_called_once_with(
        cache_query_context=True,
        force_cached=False,
        materialize=False,
    )


def test_strict_cache_only_requires_context_cache_after_data_hit() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.get_payload_result.return_value = QueryContextExecutionResult(
        queries=(
            QueryDataResult(
                {"status": "success"},
                query_timing(
                    cache_hit=True,
                    cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
                ),
            ),
        ),
        context_cache_write_outcome=CacheWriteOutcome.SKIPPED,
    )

    with pytest.raises(ChartDataQueryFailedError):
        ChartDataCommand(query_context).execute(
            ChartDataExecutionOptions(
                mode=ChartDataExecutionMode.CACHE_ONLY,
                cache_query_context=True,
                require_cache_writes=True,
            )
        )


def test_execution_result_materializes_without_sidecar() -> None:
    query_context = cast(Any, object())
    execution = ChartDataExecutionResult(
        query_context=query_context,
        queries=(QueryDataResult({"data": [1]}, query_timing()),),
        cache_key="qc-key",
    )

    assert execution.materialize() == {
        "query_context": query_context,
        "queries": [{"data": [1]}],
        "cache_key": "qc-key",
    }


def test_execution_result_materialization_does_not_mutate_sidecar_payload() -> None:
    query_context = cast(Any, object())
    payload = {"data": [1]}
    execution = ChartDataExecutionResult(
        query_context=query_context,
        queries=(QueryDataResult(payload, query_timing()),),
    )

    first = execution.materialize()
    first["queries"][0]["timing"] = {"version": 1}
    first["queries"][0]["rowcount"] = 1

    assert execution.materialize()["queries"] == [{"data": [1]}]
    assert payload == {"data": [1]}


def test_annotation_cycle_is_rejected_before_nested_execution() -> None:
    chart = MagicMock()
    chart.id = 42
    annotation = {"value": 42, "name": "recursive"}

    with (
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.common.query_context_processor._annotation_chart_stack"
        ) as annotation_stack,
    ):
        annotation_stack.get.return_value = (42,)
        with pytest.raises(
            QueryObjectValidationError,
            match="Circular chart annotation dependency",
        ):
            QueryContextProcessor.get_viz_annotation_data(annotation, force=False)


def test_native_annotation_records_planning_execution_and_processing() -> None:
    phases: list[str] = []

    @contextmanager
    def record_phase(phase: str):
        phases.append(phase)
        yield

    annotation = MagicMock(
        start_dttm="start",
        end_dttm="end",
        short_descr="short",
        long_descr="long",
        json_metadata="{}",
    )
    layer_object = MagicMock(id=7, annotation=[annotation])
    query = MagicMock(
        annotation_layers=[{"sourceType": "NATIVE", "value": 7, "name": "events"}]
    )

    with (
        patch(
            "superset.common.query_context_processor.AnnotationLayerDAO.find_by_ids",
            return_value=[layer_object],
        ),
        patch(
            "superset.common.query_context_processor.source_phase",
            side_effect=record_phase,
        ),
    ):
        result = QueryContextProcessor.get_native_annotation_data(query)

    assert phases == ["planning", "execution", "processing"]
    assert result["events"]["records"] == [
        {
            "start_dttm": "start",
            "end_dttm": "end",
            "short_descr": "short",
            "long_descr": "long",
            "json_metadata": "{}",
        }
    ]


def test_legacy_chart_annotation_records_all_source_phases() -> None:
    phases: list[str] = []

    @contextmanager
    def record_phase(phase: str):
        phases.append(phase)
        yield

    chart = MagicMock()
    chart.id = 8
    chart.viz_type = "legacy"
    chart.datasource.type = "table"
    chart.datasource.id = 3
    chart.form_data = {"viz_type": "legacy"}
    payload = {"data": {"records": [{"value": 1}]}}
    viz = MagicMock()
    viz.get_payload.return_value = payload

    with (
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.common.query_context_processor.viz_types",
            {"legacy": object()},
        ),
        patch("superset.common.query_context_processor.get_viz", return_value=viz),
        patch(
            "superset.common.query_context_processor.source_phase",
            side_effect=record_phase,
        ),
    ):
        result = QueryContextProcessor.get_viz_annotation_data(
            {"value": 8, "name": "legacy", "overrides": {}},
            force=False,
        )

    assert phases == [
        "execution",
        "planning",
        "planning",
        "execution",
        "processing",
    ]
    assert result == payload["data"]


def test_contribution_totals_are_reused_without_mutating_queries() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        row_limit=100,
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query = QueryObject(
        datasource=datasource,
        columns=[],
        metrics=["sales"],
        row_limit=100,
    )
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query]
    query_context.result_type = ChartDataResultType.FULL
    processor = QueryContextProcessor(query_context)
    observed_queries: list[tuple[list[Any], int | None]] = []

    def acquire(
        result_type: ChartDataResultType,
        context: MagicMock,
        query: QueryObject,
        force_cached: bool,
        **kwargs: Any,
    ) -> AcquiredQuery:
        observed_queries.append((copy.deepcopy(query.post_processing), query.row_limit))
        value = 100.0 if not query.columns else 1.0
        return acquired_query(query, pd.DataFrame({"sales": [value]}))

    completed = QueryDataResult({"status": "success"}, query_timing())
    with (
        patch(
            "superset.common.query_context_processor.acquire_query_data",
            side_effect=acquire,
        ),
        patch(
            "superset.common.query_context_processor.materialize_acquired_query",
            return_value=completed,
        ),
        patch(
            "superset.common.query_context_processor.cache_acquired_query",
            return_value=completed,
        ),
    ):
        materialized = processor._execute_query_plan(False, True)
        materialized_queries = list(observed_queries)
        observed_queries.clear()
        cached = processor._execute_query_plan(False, False)

    assert len(materialized) == len(cached) == 2
    assert observed_queries == materialized_queries
    assert observed_queries[0] == ([], None)
    assert observed_queries[1][0][0]["options"]["contribution_totals"] == {
        "sales": 100.0
    }
    assert totals_query.row_limit == 100
    assert "contribution_totals" not in main_query.post_processing[0]["options"]


def test_legacy_contribution_uses_first_equivalent_totals_query() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query_1 = QueryObject(datasource=datasource, columns=[], metrics=["sales"])
    totals_query_2 = QueryObject(datasource=datasource, columns=[], metrics=["sales"])
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query_1, totals_query_2]
    processor = QueryContextProcessor(query_context)

    with patch("superset.common.query_context_processor.logger.warning") as warning:
        plan = processor._contribution_plan()

    assert plan == {0: 1}
    warning.assert_called_once_with(
        "Multiple totals queries match contribution query %d; using producer %d",
        0,
        1,
    )


def test_contribution_totals_require_matching_time_shift() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        time_shift="1 year",
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    unshifted_totals = QueryObject(
        datasource=datasource,
        columns=[],
        metrics=["sales"],
    )
    query_context = MagicMock()
    query_context.queries = [main_query, unshifted_totals]

    assert QueryContextProcessor(query_context)._contribution_plan() == {}


def test_explicit_contribution_producer_resolves_legacy_ambiguity() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["count", "sales"],
        contribution_totals_query_index=2,
        post_processing=[
            {
                "operation": "contribution",
                "options": {"columns": ["sales"]},
            }
        ],
    )
    totals_queries = [
        QueryObject(datasource=datasource, columns=[], metrics=["sales"]),
        QueryObject(datasource=datasource, columns=[], metrics=["sales"]),
    ]
    query_context = MagicMock()
    query_context.queries = [main_query, *totals_queries]

    assert QueryContextProcessor(query_context)._contribution_plan() == {0: 2}


def test_explicit_contribution_producer_must_match_consumer_filters() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        filters=[{"col": "region", "op": "==", "val": "north"}],
        contribution_totals_query_index=1,
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query = QueryObject(
        datasource=datasource,
        columns=[],
        metrics=["sales"],
        filters=[{"col": "region", "op": "==", "val": "south"}],
    )
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query]

    with pytest.raises(
        QueryObjectValidationError,
        match="does not match its consumer",
    ):
        QueryContextProcessor(query_context)._contribution_plan()


def test_failed_contribution_producer_skips_dependent_query() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        contribution_totals_query_index=1,
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query = QueryObject(datasource=datasource, columns=[], metrics=["sales"])
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query]
    query_context.result_type = ChartDataResultType.FULL
    processor = QueryContextProcessor(query_context)
    completed = QueryDataResult({"status": "failed"}, query_timing())

    with (
        patch(
            "superset.common.query_context_processor.acquire_query_data",
            return_value=acquired_query(
                totals_query,
                pd.DataFrame({"sales": []}),
                QueryStatus.FAILED,
            ),
        ) as acquire,
        patch(
            "superset.common.query_context_processor.cache_acquired_query",
            return_value=completed,
        ),
    ):
        result = processor._execute_query_plan(False, False)

    acquire.assert_called_once()
    assert result[0].payload == {
        "error": "Contribution totals query failed",
        "status": QueryStatus.FAILED,
    }
    assert result[1] == completed


def test_query_only_contribution_plan_does_not_acquire_dataframes() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        contribution_totals_query_index=1,
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query = QueryObject(datasource=datasource, columns=[], metrics=["sales"])
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query]
    query_context.result_type = ChartDataResultType.QUERY
    processor = QueryContextProcessor(query_context)
    metadata_results = [
        QueryDataResult({"query": "SELECT main"}, query_timing()),
        QueryDataResult({"query": "SELECT totals"}, query_timing()),
    ]

    with (
        patch("superset.common.query_context_processor.acquire_query_data") as acquire,
        patch(
            "superset.common.query_context_processor.get_query_results_with_timing",
            side_effect=metadata_results,
        ) as render,
    ):
        result = processor._execute_query_plan(False, True)

    acquire.assert_not_called()
    assert render.call_count == 2
    assert result == tuple(metadata_results)


def test_mixed_contribution_plan_separates_dependency_and_response_modes() -> None:
    datasource = MagicMock()
    main_query = QueryObject(
        datasource=datasource,
        columns=["region"],
        metrics=["sales"],
        result_type=ChartDataResultType.FULL,
        contribution_totals_query_index=1,
        post_processing=[{"operation": "contribution", "options": {}}],
    )
    totals_query = QueryObject(datasource=datasource, columns=[], metrics=["sales"])
    query_context = MagicMock()
    query_context.queries = [main_query, totals_query]
    query_context.result_type = ChartDataResultType.QUERY
    processor = QueryContextProcessor(query_context)
    rendered_main = QueryDataResult({"status": "success"}, query_timing())
    rendered_totals = QueryDataResult({"query": "SELECT totals"}, query_timing())

    def acquire(
        result_type: ChartDataResultType,
        context: MagicMock,
        query: QueryObject,
        force_cached: bool,
        **kwargs: Any,
    ) -> AcquiredQuery:
        assert result_type == ChartDataResultType.FULL
        value = 100.0 if not query.columns else 1.0
        return acquired_query(query, pd.DataFrame({"sales": [value]}))

    with (
        patch(
            "superset.common.query_context_processor.acquire_query_data",
            side_effect=acquire,
        ) as acquire_data,
        patch(
            "superset.common.query_context_processor.materialize_acquired_query",
            return_value=rendered_main,
        ) as materialize,
        patch(
            "superset.common.query_context_processor.get_query_results_with_timing",
            return_value=rendered_totals,
        ) as render_metadata,
    ):
        result = processor._execute_query_plan(False, True)

    assert acquire_data.call_count == 2
    materialize.assert_called_once()
    render_metadata.assert_called_once_with(
        ChartDataResultType.QUERY,
        query_context,
        totals_query,
        False,
    )
    assert result == (rendered_main, rendered_totals)
