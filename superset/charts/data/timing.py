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

import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from functools import wraps
from typing import ParamSpec, TypeVar

from flask import current_app, Response

P = ParamSpec("P")
R = TypeVar("R", bound=Response)

_PHASE_NAMES = {
    "context": "chart-context",
    "authorize": "chart-authorize",
    "query": "chart-query",
    "client": "chart-client",
    "serialize": "chart-serialize",
    "enqueue": "chart-enqueue",
}


@dataclass
class ChartRequestTiming:
    """Request-local accumulator for fixed chart API phases."""

    started_ns: int = field(default_factory=time.perf_counter_ns)
    phases_ns: dict[str, int] = field(default_factory=dict)

    def add(self, phase: str, duration_ns: int) -> None:
        self.phases_ns[phase] = self.phases_ns.get(phase, 0) + max(0, duration_ns)


_request_timing: ContextVar[ChartRequestTiming | None] = ContextVar(
    "chart_data_request_timing", default=None
)


@contextmanager
def chart_timing_phase(phase: str) -> Iterator[None]:
    """Measure one fixed chart API phase when request collection is active."""
    timing = _request_timing.get()
    if timing is None:
        yield
        return
    if phase not in _PHASE_NAMES:
        raise ValueError(f"Unknown chart timing phase: {phase}")
    started_ns = time.perf_counter_ns()
    try:
        yield
    finally:
        timing.add(phase, time.perf_counter_ns() - started_ns)


def chart_data_request_timing(func: Callable[P, R]) -> Callable[P, R]:
    """Collect request timing and conditionally add a Server-Timing header."""

    @wraps(func)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        timing = ChartRequestTiming()
        token = _request_timing.set(timing)
        response: R | None = None
        try:
            response = func(*args, **kwargs)
            return response
        finally:
            total_ns = max(0, time.perf_counter_ns() - timing.started_ns)
            try:
                _emit_request_metrics(timing, total_ns)
                if response is not None and _should_add_server_timing(response):
                    response.headers["Server-Timing"] = _server_timing_value(
                        timing, total_ns
                    )
            except Exception:  # pylint: disable=broad-except
                current_app.logger.exception("Unable to finalize chart request timing")
            finally:
                _request_timing.reset(token)

    return wrapped


def _should_add_server_timing(response: Response) -> bool:
    return bool(
        current_app.config.get("CHART_DATA_INCLUDE_SERVER_TIMING")
        and 200 <= response.status_code < 300
        and response.mimetype == "application/json"
    )


def _server_timing_value(timing: ChartRequestTiming, total_ns: int) -> str:
    values = [
        f"{_PHASE_NAMES[phase]};dur={duration_ns / 1_000_000:.2f}"
        for phase in _PHASE_NAMES
        if (duration_ns := timing.phases_ns.get(phase)) is not None
    ]
    values.append(f"chart-total;dur={total_ns / 1_000_000:.2f}")
    return ", ".join(values)


def _emit_request_metrics(timing: ChartRequestTiming, total_ns: int) -> None:
    try:
        stats_logger = current_app.config.get("STATS_LOGGER")
        if not stats_logger or not hasattr(stats_logger, "timing"):
            return
        for phase in _PHASE_NAMES:
            if (duration_ns := timing.phases_ns.get(phase)) is not None:
                stats_logger.timing(_PHASE_NAMES[phase], duration_ns / 1_000_000)
        stats_logger.timing("chart-total", total_ns / 1_000_000)
    except Exception:  # pylint: disable=broad-except
        current_app.logger.exception("Unable to emit chart request timing metrics")
