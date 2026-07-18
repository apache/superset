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
from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Any, Literal, TYPE_CHECKING

from flask import current_app

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

NANOSECONDS_PER_MILLISECOND: int = 1_000_000
SOURCE_TRACE_VERSION: int = 2
MAX_SOURCE_TRACE_DEPTH: int = 8
MAX_SOURCE_TRACE_NODES: int = 64

SourcePhase = Literal["planning", "execution", "processing"]

logger: logging.Logger = logging.getLogger(__name__)


class SourceKind(str, Enum):
    """The reason a data source was contacted."""

    PRIMARY = "primary"
    SERIES_LIMIT = "series_limit"
    TIME_OFFSET = "time_offset"
    ANNOTATION = "annotation"
    CURRENCY_DETECTION = "currency_detection"


class SourceProvider(str, Enum):
    """The implementation family that supplied data."""

    SQL = "sql"
    SEMANTIC = "semantic"
    OTHER = "other"


class SourceOrigin(str, Enum):
    """Whether a source trace was captured during this execution or replayed."""

    CURRENT = "current"
    CACHE = "cache"


class CacheWriteOutcome(str, Enum):
    """Outcome of a requested cache write."""

    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"
    NOT_ATTEMPTED = "not_attempted"


_CACHE_WRITE_OUTCOME_PRIORITY: dict[CacheWriteOutcome, int] = {
    CacheWriteOutcome.NOT_ATTEMPTED: 0,
    CacheWriteOutcome.SUCCEEDED: 1,
    CacheWriteOutcome.SKIPPED: 2,
    CacheWriteOutcome.FAILED: 3,
}


def combine_cache_write_outcomes(
    *outcomes: CacheWriteOutcome,
) -> CacheWriteOutcome:
    """Return the most restrictive outcome for a compound acquisition."""

    return max(outcomes, key=_CACHE_WRITE_OUTCOME_PRIORITY.__getitem__)


def _elapsed_ns(start_ns: int, clock: Callable[[], int]) -> int:
    return max(0, clock() - start_ns)


def _to_ms(value_ns: int | None) -> float | None:
    if value_ns is None:
        return None
    return round(value_ns / NANOSECONDS_PER_MILLISECOND, 2)


@dataclass(frozen=True)
class SourceTiming:
    """Bounded, content-free timing trace for one source operation."""

    kind: SourceKind
    provider: SourceProvider
    origin: SourceOrigin
    planning_ns: int = 0
    execution_ns: int = 0
    processing_ns: int = 0
    total_ns: int = 0
    children: tuple[SourceTiming, ...] = ()
    truncated: bool = False

    def as_public_dict(self) -> dict[str, Any]:
        """Return the stable public representation in milliseconds."""
        return {
            "kind": self.kind.value,
            "provider": self.provider.value,
            "origin": self.origin.value,
            "planning_ms": _to_ms(self.planning_ns),
            "execution_ms": _to_ms(self.execution_ns),
            "processing_ms": _to_ms(self.processing_ns),
            "total_ms": _to_ms(self.total_ns),
            "children": [child.as_public_dict() for child in self.children],
            "truncated": self.truncated,
        }

    def as_cache_value(self) -> dict[str, Any]:
        """Return a versioned cache representation with integer durations."""
        return {
            "kind": self.kind.value,
            "provider": self.provider.value,
            "planning_ns": self.planning_ns,
            "execution_ns": self.execution_ns,
            "processing_ns": self.processing_ns,
            "total_ns": self.total_ns,
            "children": [child.as_cache_value() for child in self.children],
            "truncated": self.truncated,
        }


@dataclass(frozen=True)
class QueryAcquisitionTiming:
    """Timing captured before response materialization."""

    cache_key_ns: int
    cache_read_ns: int
    source_ns: int
    cache_write_ns: int | None
    cache_write_outcome: CacheWriteOutcome
    cache_hit: bool | None
    sources: tuple[SourceTiming, ...] | None
    elapsed_ns: int | None = None

    @property
    def total_ns(self) -> int:
        if self.elapsed_ns is not None:
            return self.elapsed_ns
        return (
            self.cache_key_ns
            + self.cache_read_ns
            + self.source_ns
            + (self.cache_write_ns or 0)
        )

    def materialized(self, materialization_ns: int) -> QueryTiming:
        """Create the completed immutable query timing snapshot."""
        return QueryTiming(
            cache_key_ns=self.cache_key_ns,
            cache_read_ns=self.cache_read_ns,
            source_ns=self.source_ns,
            cache_write_ns=self.cache_write_ns,
            cache_write_outcome=self.cache_write_outcome,
            materialization_ns=materialization_ns,
            total_ns=self.total_ns + materialization_ns,
            cache_hit=self.cache_hit,
            sources=self.sources,
        )


@dataclass(frozen=True)
class QueryAcquisitionResult:
    """A dataframe payload paired with acquisition timing."""

    payload: dict[str, Any]
    timing: QueryAcquisitionTiming


def combine_acquisition_timings(
    primary: QueryAcquisitionTiming,
    dependency: QueryAcquisitionTiming,
) -> QueryAcquisitionTiming:
    """Combine sequential acquisition phases without overlapping query totals."""

    def combine_optional_int(left: int | None, right: int | None) -> int | None:
        if left is None and right is None:
            return None
        return (left or 0) + (right or 0)

    cache_hits = {primary.cache_hit, dependency.cache_hit}
    if False in cache_hits:
        cache_hit: bool | None = False
    elif cache_hits == {True}:
        cache_hit = True
    else:
        cache_hit = None

    known_sources = bound_source_trace(
        tuple(
            source
            for sources in (primary.sources, dependency.sources)
            if sources is not None
            for source in sources
        )
    )
    sources = (
        None
        if primary.sources is None and dependency.sources is None and not known_sources
        else known_sources
    )
    return QueryAcquisitionTiming(
        cache_key_ns=primary.cache_key_ns + dependency.cache_key_ns,
        cache_read_ns=primary.cache_read_ns + dependency.cache_read_ns,
        source_ns=primary.source_ns + dependency.source_ns,
        cache_write_ns=combine_optional_int(
            primary.cache_write_ns, dependency.cache_write_ns
        ),
        cache_write_outcome=combine_cache_write_outcomes(
            primary.cache_write_outcome,
            dependency.cache_write_outcome,
        ),
        cache_hit=cache_hit,
        sources=sources,
        elapsed_ns=primary.total_ns + dependency.total_ns,
    )


@dataclass(frozen=True)
class QueryTiming:
    """Completed timing snapshot for one independently materialized query."""

    cache_key_ns: int
    cache_read_ns: int
    source_ns: int
    cache_write_ns: int | None
    cache_write_outcome: CacheWriteOutcome
    materialization_ns: int
    total_ns: int
    cache_hit: bool | None
    sources: tuple[SourceTiming, ...] | None

    def as_public_dict(self) -> dict[str, Any]:
        """Return the versioned chart-data API representation."""
        return {
            "version": 1,
            "query": {
                "cache_key_ms": _to_ms(self.cache_key_ns),
                "cache_read_ms": _to_ms(self.cache_read_ns),
                "source_ms": _to_ms(self.source_ns),
                "cache_write_ms": _to_ms(self.cache_write_ns),
                "cache_write_status": self.cache_write_outcome.value,
                "materialization_ms": _to_ms(self.materialization_ns),
                "total_ms": _to_ms(self.total_ns),
                "cache_hit": self.cache_hit,
            },
            "sources": (
                None
                if self.sources is None
                else [
                    source.as_public_dict()
                    for source in bound_source_trace(self.sources)
                ]
            ),
        }


@dataclass(frozen=True)
class QueryDataResult:
    """A query payload paired with its completed timing sidecar."""

    payload: dict[str, Any]
    timing: QueryTiming


@dataclass(frozen=True)
class QueryContextExecutionResult:
    """Execution result before the command attaches its query context."""

    queries: tuple[QueryDataResult, ...]
    cache_key: str | None = None
    context_cache_write_outcome: CacheWriteOutcome = CacheWriteOutcome.NOT_ATTEMPTED


@dataclass(frozen=True)
class ChartDataExecutionResult:
    """Typed result of executing a chart data command."""

    query_context: QueryContext
    queries: tuple[QueryDataResult, ...]
    cache_key: str | None = None

    def materialize(self) -> dict[str, Any]:
        """Return the historical command payload without timing metadata."""
        result: dict[str, Any] = {
            "query_context": self.query_context,
            # Response projection adds timing and client-processing fields at the
            # query-dict level. Keep those mutations outside the reusable execution
            # result without copying potentially large data values.
            "queries": [dict(query.payload) for query in self.queries],
        }
        if self.cache_key is not None:
            result["cache_key"] = self.cache_key
        return result


@dataclass
class _MutableSourceTiming:
    kind: SourceKind
    provider: SourceProvider
    start_ns: int
    planning_ns: int = 0
    execution_ns: int = 0
    processing_ns: int = 0
    children: list[SourceTiming] = field(default_factory=list)
    truncated: bool = False


@dataclass
class _MutableSourcePhase:
    node: _MutableSourceTiming
    phase: SourcePhase
    active_since_ns: int | None


class _SourceParseState(str, Enum):
    VALID = "valid"
    TRUNCATED = "truncated"
    INVALID = "invalid"


@dataclass(frozen=True)
class _SourceParseResult:
    state: _SourceParseState
    source: SourceTiming | None = None


@dataclass(frozen=True)
class _ParsedSourceFields:
    kind: SourceKind
    provider: SourceProvider
    planning_ns: int
    execution_ns: int
    processing_ns: int
    total_ns: int
    children: list[Any]
    truncated: bool


_active_source_collector: ContextVar[SourceTimingCollector | None] = ContextVar(
    "chart_data_source_timing_collector",
    default=None,
)
_chart_data_execution_depth: ContextVar[int] = ContextVar(
    "chart_data_execution_depth", default=0
)


@contextmanager
def chart_data_execution_scope() -> Iterator[bool]:
    """Identify the outer command execution that owns telemetry emission."""

    depth = _chart_data_execution_depth.get()
    token = _chart_data_execution_depth.set(depth + 1)
    try:
        yield depth == 0
    finally:
        _chart_data_execution_depth.reset(token)


class SourceTimingCollector:
    """Collect a bounded source tree without retaining query content."""

    def __init__(self, clock: Callable[[], int] = time.perf_counter_ns) -> None:
        self._clock: Callable[[], int] = clock
        self._roots: list[SourceTiming] = []
        self._stack: list[_MutableSourceTiming | None] = []
        self._phases: list[_MutableSourcePhase] = []
        self._activation_parents: list[SourceTimingCollector | None] = []
        self._node_count: int = 0

    def _pause_active_phases(self) -> list[_MutableSourcePhase]:
        now_ns = self._clock()
        paused: list[_MutableSourcePhase] = []
        for frame in self._phases:
            if frame.active_since_ns is None:
                continue
            duration_ns = max(0, now_ns - frame.active_since_ns)
            attr = f"{frame.phase}_ns"
            setattr(frame.node, attr, getattr(frame.node, attr) + duration_ns)
            frame.active_since_ns = None
            paused.append(frame)
        return paused

    def _resume_phases(self, phases: list[_MutableSourcePhase]) -> None:
        if not phases:
            return
        now_ns = self._clock()
        for frame in phases:
            frame.active_since_ns = now_ns

    def _mark_parent_truncated(self) -> None:
        parent = next((node for node in reversed(self._stack) if node), None)
        if parent is not None:
            parent.truncated = True
        elif self._roots:
            self._roots[-1] = replace(self._roots[-1], truncated=True)

    def _outer_collectors(self) -> Iterator[SourceTimingCollector]:
        """Yield active ancestors, including collectors without source frames."""

        seen = {id(self)}
        collector = self._activation_parents[-1] if self._activation_parents else None
        while collector is not None and id(collector) not in seen:
            yield collector
            seen.add(id(collector))
            collector = (
                collector._activation_parents[-1]  # noqa: SLF001
                if collector._activation_parents  # noqa: SLF001
                else None
            )

    @contextmanager
    def activated(self) -> Iterator[None]:
        """Expose this collector and restore the previous collector on exit."""

        parent = _active_source_collector.get()
        self._activation_parents.append(parent)
        token = _active_source_collector.set(self)
        try:
            yield
        finally:
            _active_source_collector.reset(token)
            popped = self._activation_parents.pop()
            if popped is not parent:
                raise RuntimeError("Source timing collectors exited out of order")

    @contextmanager
    def source(
        self,
        kind: SourceKind,
        provider: SourceProvider,
    ) -> Iterator[None]:
        """Capture one source node and attach it to the active parent."""
        is_root = not self._stack
        parent = next((node for node in reversed(self._stack) if node), None)
        paused = self._pause_active_phases()
        outer_paused = (
            [
                (collector, collector._pause_active_phases())
                for collector in self._outer_collectors()
            ]
            if is_root
            else []
        )
        refused = bool(
            (self._stack and self._stack[-1] is None)
            or self._node_count >= MAX_SOURCE_TRACE_NODES
            or len(self._stack) >= MAX_SOURCE_TRACE_DEPTH
        )
        if refused:
            self._mark_parent_truncated()
            self._stack.append(None)
            try:
                yield
            finally:
                self._stack.pop()
                self._resume_phases(paused)
                for collector, phases in reversed(outer_paused):
                    collector._resume_phases(phases)
            return

        node = _MutableSourceTiming(kind, provider, self._clock())
        self._node_count += 1
        self._stack.append(node)
        try:
            yield
        finally:
            self._stack.pop()
            snapshot = SourceTiming(
                kind=node.kind,
                provider=node.provider,
                origin=SourceOrigin.CURRENT,
                planning_ns=node.planning_ns,
                execution_ns=node.execution_ns,
                processing_ns=node.processing_ns,
                total_ns=_elapsed_ns(node.start_ns, self._clock),
                children=tuple(node.children),
                truncated=node.truncated,
            )
            if parent is None:
                self._roots.append(snapshot)
            else:
                parent.children.append(snapshot)
            self._resume_phases(paused)
            for collector, phases in reversed(outer_paused):
                collector._resume_phases(phases)

    @contextmanager
    def phase(self, phase: SourcePhase) -> Iterator[None]:
        """Attribute elapsed time to a phase of the active source node."""
        if not self._stack or self._stack[-1] is None:
            yield
            return
        node = self._stack[-1]
        assert node is not None
        paused = self._pause_active_phases()
        frame = _MutableSourcePhase(node, phase, self._clock())
        self._phases.append(frame)
        try:
            yield
        finally:
            self._pause_active_phases()
            popped = self._phases.pop()
            if popped is not frame:
                raise RuntimeError("Source timing phases exited out of order")
            self._resume_phases(paused)

    def snapshot(self) -> tuple[SourceTiming, ...]:
        """Return completed root nodes."""
        if self._stack or self._phases:
            raise RuntimeError("Cannot snapshot an active source timing collector")
        return bound_source_trace(tuple(self._roots))

    def attach(self, sources: tuple[SourceTiming, ...]) -> None:
        """Attach current nested traces; historical cache traces are not additive."""
        if not self._stack or self._stack[-1] is None:
            return
        parent = self._stack[-1]
        assert parent is not None
        remaining_nodes = [MAX_SOURCE_TRACE_NODES - self._node_count]
        remaining_depth = MAX_SOURCE_TRACE_DEPTH - len(self._stack)
        for source in sources:
            if source.origin != SourceOrigin.CURRENT:
                continue
            bounded = _bounded_source_copy(
                source,
                remaining_depth=remaining_depth,
                remaining_nodes=remaining_nodes,
            )
            if bounded is None:
                parent.truncated = True
                self._node_count = MAX_SOURCE_TRACE_NODES - remaining_nodes[0]
                return
            parent.children.append(bounded)
        self._node_count = MAX_SOURCE_TRACE_NODES - remaining_nodes[0]


def _bounded_source_copy(
    source: SourceTiming,
    *,
    remaining_depth: int,
    remaining_nodes: list[int],
) -> SourceTiming | None:
    if remaining_depth <= 0 or remaining_nodes[0] <= 0:
        return None
    remaining_nodes[0] -= 1
    children: list[SourceTiming] = []
    truncated = source.truncated
    for child in source.children:
        bounded_child = _bounded_source_copy(
            child,
            remaining_depth=remaining_depth - 1,
            remaining_nodes=remaining_nodes,
        )
        if bounded_child is None:
            truncated = True
            break
        children.append(bounded_child)
    return replace(source, children=tuple(children), truncated=truncated)


def bound_source_trace(sources: tuple[SourceTiming, ...]) -> tuple[SourceTiming, ...]:
    """Bound an arbitrary source forest and preserve an explicit truncation marker."""

    remaining_nodes = [MAX_SOURCE_TRACE_NODES]
    bounded_sources: list[SourceTiming] = []
    for source in sources:
        bounded = _bounded_source_copy(
            source,
            remaining_depth=MAX_SOURCE_TRACE_DEPTH,
            remaining_nodes=remaining_nodes,
        )
        if bounded is None:
            if bounded_sources:
                bounded_sources[-1] = replace(bounded_sources[-1], truncated=True)
            break
        bounded_sources.append(bounded)
    return tuple(bounded_sources)


def active_source_collector() -> SourceTimingCollector | None:
    """Return the active collector for nested execution propagation."""
    return _active_source_collector.get()


@contextmanager
def source_timing(
    kind: SourceKind,
    provider: SourceProvider,
) -> Iterator[None]:
    """Record a nested source operation when collection is active."""
    collector = _active_source_collector.get()
    if collector is None:
        yield
        return
    with collector.source(kind, provider):
        yield


@contextmanager
def source_phase(phase: SourcePhase) -> Iterator[None]:
    """Record a source phase when collection is active."""
    collector = _active_source_collector.get()
    if collector is None:
        yield
        return
    with collector.phase(phase):
        yield


def serialize_source_trace(sources: tuple[SourceTiming, ...]) -> dict[str, Any]:
    """Serialize source timing for the data cache."""
    return {
        "version": SOURCE_TRACE_VERSION,
        "sources": [source.as_cache_value() for source in bound_source_trace(sources)],
    }


def _parse_source_fields(value: Mapping[str, Any]) -> _ParsedSourceFields | None:
    try:
        kind = SourceKind(value["kind"])
        provider = SourceProvider(value["provider"])
        planning_ns = value["planning_ns"]
        execution_ns = value["execution_ns"]
        processing_ns = value["processing_ns"]
        total_ns = value["total_ns"]
        children = value.get("children", [])
        truncated = value.get("truncated", False)
    except (KeyError, TypeError, ValueError):
        return None

    durations = (planning_ns, execution_ns, processing_ns, total_ns)
    if not all(
        isinstance(item, int) and not isinstance(item, bool) and item >= 0
        for item in durations
    ):
        return None
    if not isinstance(children, list) or not isinstance(truncated, bool):
        return None
    return _ParsedSourceFields(
        kind=kind,
        provider=provider,
        planning_ns=planning_ns,
        execution_ns=execution_ns,
        processing_ns=processing_ns,
        total_ns=total_ns,
        children=children,
        truncated=truncated,
    )


def _parse_source(
    value: Mapping[str, Any],
    *,
    depth: int,
    remaining: list[int],
) -> _SourceParseResult:
    if depth >= MAX_SOURCE_TRACE_DEPTH or remaining[0] <= 0:
        return _SourceParseResult(_SourceParseState.TRUNCATED)
    fields = _parse_source_fields(value)
    if fields is None:
        return _SourceParseResult(_SourceParseState.INVALID)

    remaining[0] -= 1
    children: list[SourceTiming] = []
    truncated = fields.truncated
    budget_truncated = False
    for child_value in fields.children:
        if not isinstance(child_value, Mapping):
            return _SourceParseResult(_SourceParseState.INVALID)
        child_result = _parse_source(child_value, depth=depth + 1, remaining=remaining)
        if child_result.state == _SourceParseState.INVALID:
            return child_result
        if child_result.state == _SourceParseState.TRUNCATED:
            truncated = True
            budget_truncated = True
            if child_result.source is not None:
                children.append(child_result.source)
            break
        assert child_result.source is not None
        children.append(child_result.source)
    source = SourceTiming(
        kind=fields.kind,
        provider=fields.provider,
        origin=SourceOrigin.CACHE,
        planning_ns=fields.planning_ns,
        execution_ns=fields.execution_ns,
        processing_ns=fields.processing_ns,
        total_ns=fields.total_ns,
        children=tuple(children),
        truncated=truncated,
    )
    accounted_ns = (
        fields.planning_ns
        + fields.execution_ns
        + fields.processing_ns
        + sum(child.total_ns for child in children)
    )
    if accounted_ns > fields.total_ns:
        return _SourceParseResult(_SourceParseState.INVALID)
    return _SourceParseResult(
        (_SourceParseState.TRUNCATED if budget_truncated else _SourceParseState.VALID),
        source,
    )


def deserialize_source_trace(value: Any) -> tuple[SourceTiming, ...] | None:
    """Parse a trusted-shape source trace; malformed and old values are ignored."""
    if not isinstance(value, Mapping) or value.get("version") != SOURCE_TRACE_VERSION:
        return None
    sources_value = value.get("sources")
    if not isinstance(sources_value, list):
        return None
    remaining = [MAX_SOURCE_TRACE_NODES]
    sources: list[SourceTiming] = []
    for source_value in sources_value:
        if not isinstance(source_value, Mapping):
            return None
        source_result = _parse_source(source_value, depth=0, remaining=remaining)
        if source_result.state == _SourceParseState.INVALID:
            return None
        if source_result.source is None:
            if sources:
                sources[-1] = replace(sources[-1], truncated=True)
            break
        sources.append(source_result.source)
        if source_result.state == _SourceParseState.TRUNCATED:
            break
    return tuple(sources)


def project_query_timing(payload: dict[str, Any], timing: QueryTiming) -> None:
    """Project timing into a chart-data API payload when explicitly enabled."""
    if current_app.config.get("CHART_DATA_INCLUDE_TIMING"):
        payload["timing"] = timing.as_public_dict()


def emit_query_timing(timing: QueryTiming) -> None:
    """Emit timing observability without changing query execution outcomes."""
    try:
        public_query = timing.as_public_dict()["query"]
        stats_logger = current_app.config.get("STATS_LOGGER")
        if stats_logger and hasattr(stats_logger, "timing"):
            for phase, value in public_query.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    stats_logger.timing(f"chart_data.query.{phase}", value)
            for source in _current_sources(timing.sources or ()):
                stats_logger.timing(
                    f"chart_data.source.{source.kind.value}.total_ms",
                    _to_ms(source.total_ns),
                )
        threshold = current_app.config.get("CHART_DATA_SLOW_QUERY_THRESHOLD_MS")
        total_ms = _to_ms(timing.total_ns) or 0
        if threshold is not None and total_ms > threshold:
            logger.warning(
                "Slow chart query: total=%.0fms cache_key=%.0fms cache_read=%.0fms "
                "source=%.0fms cache_write=%s cache_write_status=%s "
                "materialization=%.0fms cache_hit=%s",
                total_ms,
                _to_ms(timing.cache_key_ns) or 0,
                _to_ms(timing.cache_read_ns) or 0,
                _to_ms(timing.source_ns) or 0,
                (
                    f"{_to_ms(timing.cache_write_ns):.0f}ms"
                    if timing.cache_write_ns is not None
                    else "not-attempted"
                ),
                timing.cache_write_outcome.value,
                _to_ms(timing.materialization_ns) or 0,
                timing.cache_hit,
            )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Unable to emit chart data timing metrics")


def _current_sources(sources: tuple[SourceTiming, ...]) -> Iterator[SourceTiming]:
    for source in sources:
        if source.origin == SourceOrigin.CURRENT:
            yield source
        yield from _current_sources(source.children)
