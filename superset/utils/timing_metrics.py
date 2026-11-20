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
"""
Best-effort StatsD timers and counters for latency attribution.

Every helper here measures with a monotonic clock, reports durations in
milliseconds, and swallows metrics-backend failures so instrumentation can
never change the outcome of the code it measures.

Metric keys are static, dot-separated names. ``BaseStatsLogger`` has no tag
support, so any dimension must be encoded in the key; only bounded values
(such as a DB engine name) may be appended, never identifiers, SQL, or
user-controlled strings.
"""

from __future__ import annotations

import functools
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter_ns
from typing import Any, Callable, TypeVar

from flask import g, has_request_context

from superset.extensions import stats_logger_manager

logger = logging.getLogger(__name__)

NANOSECONDS_PER_MILLISECOND = 1_000_000

F = TypeVar("F", bound=Callable[..., Any])

_PRE_HANDLER_START_ATTR = "_timing_metrics_pre_handler_start_ns"


def now_ns() -> int:
    """
    Read the monotonic clock used by these helpers.

    The clock is bound at import time so that tests patching
    ``time.perf_counter_ns`` to drive phase timings elsewhere are not
    perturbed by metric emission.
    """
    return perf_counter_ns()


def elapsed_ms(start_ns: int) -> float:
    """Return milliseconds elapsed since a :func:`now_ns` reading."""
    return max(0, now_ns() - start_ns) / NANOSECONDS_PER_MILLISECOND


def emit_timing(key: str, value_ms: float) -> None:
    """Emit a timer in milliseconds, ignoring metrics-backend failures."""
    try:
        stats_logger_manager.instance.timing(key, value_ms)
    except Exception:  # pylint: disable=broad-except
        logger.debug("Failed to emit timing metric %s", key, exc_info=True)


def emit_incr(key: str) -> None:
    """Increment a counter, ignoring metrics-backend failures."""
    try:
        stats_logger_manager.instance.incr(key)
    except Exception:  # pylint: disable=broad-except
        logger.debug("Failed to emit counter metric %s", key, exc_info=True)


@contextmanager
def timed(key: str) -> Iterator[None]:
    """
    Time the enclosed block and emit it as ``key``.

    The timer is emitted whether the block succeeds or raises, so slow failures
    (timeouts, cancelled warehouse queries) stay visible in the distribution.
    """
    start_ns = now_ns()
    try:
        yield
    finally:
        emit_timing(key, elapsed_ms(start_ns))


def metric_suffix(value: str | None) -> str:
    """
    Normalize a bounded dimension (e.g. a DB engine name) into a key segment.

    Dots would split the dimension into extra key levels, so they are replaced.
    """
    if not value:
        return "unknown"
    return "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in value)


def start_pre_handler_timer(func: F) -> F:
    """
    Record when a request reaches the route, before auth decorators run.

    Pair with :func:`emit_pre_handler_timer` below ``@protect()`` to time the
    authentication and permission checks that run in between.
    """

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        if has_request_context():
            setattr(g, _PRE_HANDLER_START_ATTR, now_ns())
        return func(*args, **kwargs)

    return wrapper  # type: ignore[return-value]


def emit_pre_handler_timer(key: str) -> Callable[[F], F]:
    """
    Emit the time elapsed since :func:`start_pre_handler_timer` ran.

    Only requests that pass the decorators in between reach this point, so
    rejected (401/403) requests are not part of the distribution.
    """

    def decorate(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if has_request_context():
                start_ns = g.pop(_PRE_HANDLER_START_ATTR, None)
                if start_ns is not None:
                    emit_timing(key, elapsed_ms(start_ns))
            return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorate
