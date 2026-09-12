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
"""Write-path metrics for the versioning capture listeners.

The capture listeners fail open (a versioning bug must never break a
user's save), so the read path (``activity/orchestrator``) is richly
instrumented but the write path historically logged-and-swallowed with no
counter. Each :func:`incr_capture_error` call emits
``superset.versioning.capture.<stage>.error`` so a systematic capture
regression is alertable rather than log-grep-only.

Shared across the capture subpackages — the change-record listener
(``changes/listener.py``) and the baseline probe
(``baseline/collection.py``) both swallow failures under the same
fail-open posture, and an alerting surface with a blind quadrant defeats
its purpose.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_CAPTURE_METRIC_PREFIX: str = "superset.versioning.capture"


def incr_capture_error(stage: str) -> None:
    """Emit a counter for a swallowed capture-path failure at *stage*.

    Best-effort: metrics emission must never itself break a user's save,
    so it is wrapped in the same fail-open posture as the call sites.
    """
    # pylint: disable=import-outside-toplevel
    try:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.incr(f"{_CAPTURE_METRIC_PREFIX}.{stage}.error")
    except Exception:  # pylint: disable=broad-except
        logger.exception("versioning: failed to emit capture-error metric")


def emit_capture_timing(stage: str, duration_ms: float) -> None:
    """Emit the write-path latency for one capture *stage*, in milliseconds.

    The documented recovery lever for capture trouble is the
    ``ENABLE_VERSIONING_CAPTURE`` kill-switch, flipped on save-path
    slowdown — this series
    (``superset.versioning.capture.<stage>.latency``) is the signal an
    operator alerts on before flipping it. :func:`incr_capture_error`
    covers *loss*; this covers *slowdown*. The series includes every
    commit on the session — commits touching no versioned entity still
    pay the listener overhead — so alerts belong on upper percentiles,
    not the mean. Best-effort under the same fail-open posture: metrics
    emission must never itself break a user's save.
    """
    # pylint: disable=import-outside-toplevel
    try:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.timing(
            f"{_CAPTURE_METRIC_PREFIX}.{stage}.latency", duration_ms
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("versioning: failed to emit capture-latency metric")
