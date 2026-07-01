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
from typing import Any

from flask import current_app

TIMING_KEY = "_chart_data_timing"
TIMING_START_KEY = "_start_time"
RESULT_PROCESSING_START_KEY = "_result_processing_start"

logger = logging.getLogger(__name__)


def _emit_timing_metrics(timing: dict[str, Any]) -> None:
    """Emit numeric chart data timing phases through the configured stats logger."""
    stats_logger = current_app.config.get("STATS_LOGGER")
    if stats_logger and hasattr(stats_logger, "timing"):
        for phase, value in timing.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                stats_logger.timing(f"chart_data.{phase}", value)


def _log_slow_chart_query(timing: dict[str, Any]) -> None:
    """Log a warning when chart data processing exceeds the configured threshold."""
    threshold = current_app.config.get("CHART_DATA_SLOW_QUERY_THRESHOLD_MS")
    if threshold is None or timing["total_ms"] <= threshold:
        return

    db_exec = timing.get("db_execution_ms")
    logger.warning(
        "Slow chart query: total=%.0fms validate=%.0fms "
        "cache_lookup=%.0fms db_execution=%s "
        "result_processing=%.0fms is_cached=%s",
        timing["total_ms"],
        timing.get("validate_ms", 0),
        timing.get("cache_lookup_ms", 0),
        f"{db_exec:.0f}ms" if db_exec is not None else "cached",
        timing.get("result_processing_ms", 0),
        timing.get("is_cached", False),
    )


def finalize_timing_payload(payload: dict[str, Any]) -> None:
    """Finalize internal chart data timing state and attach public timing if enabled."""
    timing = payload.pop(TIMING_KEY, None)
    if not isinstance(timing, dict):
        return

    end_time = time.perf_counter()
    result_processing_start = timing.pop(RESULT_PROCESSING_START_KEY, None)
    if isinstance(result_processing_start, (int, float)):
        timing["result_processing_ms"] = round(
            (end_time - result_processing_start) * 1000,
            2,
        )
    else:
        timing.setdefault("result_processing_ms", 0)

    start_time = timing.pop(TIMING_START_KEY, None)
    if isinstance(start_time, (int, float)):
        timing["total_ms"] = round((end_time - start_time) * 1000, 2)
    else:
        timing["total_ms"] = round(
            sum(
                value
                for phase, value in timing.items()
                if phase.endswith("_ms")
                and isinstance(value, (int, float))
                and not isinstance(value, bool)
            ),
            2,
        )

    timing.setdefault("db_execution_ms", None)
    cache_state = (
        timing.get("is_cached") if "is_cached" in timing else payload.get("is_cached")
    )
    timing["is_cached"] = cache_state is True

    _emit_timing_metrics(timing)
    _log_slow_chart_query(timing)

    if current_app.config.get("CHART_DATA_INCLUDE_TIMING"):
        payload["timing"] = timing
