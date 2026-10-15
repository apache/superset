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
"""Resolve the soft-delete retention window."""

from __future__ import annotations

import logging
from collections.abc import Callable

from flask import current_app

from superset.extensions import stats_logger_manager
from superset.key_value.shared_entries import get_shared_value
from superset.key_value.types import SharedKey

logger: logging.Logger = logging.getLogger(__name__)

_DEFAULT_RETENTION_DAYS: int = 30
MAX_RETENTION_DAYS: int = 36500


def _defer_invalid_window(message: str) -> int:
    """Record invalid resolutions separately from an intentional zero disable."""
    logger.warning(message)
    stats_logger_manager.instance.incr("deletion_retention.invalid_window")
    return 0


def _config_retention_days() -> int:
    """Return a validated config fallback without breaking scheduled runs."""
    configured: object = current_app.config.get(
        "SOFT_DELETE_RETENTION_DAYS", _DEFAULT_RETENTION_DAYS
    )
    try:
        if isinstance(configured, bool) or not isinstance(configured, (str, int)):
            raise ValueError
        days: int = int(configured)
        if days > MAX_RETENTION_DAYS:
            return _defer_invalid_window(
                "deletion_retention: oversized config retention; skipping"
            )
        if days < -1:
            raise ValueError
        return days
    except (TypeError, ValueError):
        return _defer_invalid_window(
            "deletion_retention: malformed config retention; skipping"
        )


def resolve_retention_window() -> int:
    """Return the retention window in days, read live on each call.

    Resolution order:

    1. An installed ``SOFT_DELETE_RETENTION_DAYS_FUNC`` host policy. Its
       result is authoritative; invalid/unavailable policy defers with zero.
    2. The per-deployment value persisted under
       ``SharedKey.SOFT_DELETE_RETENTION_DAYS`` (read live; takes
       precedence when present).
    3. Otherwise the ``SOFT_DELETE_RETENTION_DAYS`` config /
       environment seed default (itself defaulting to 30).

    ``0`` from any source is a meaningful "disable", so the shared
    value is selected with an explicit ``is None`` check — never ``or``,
    which would treat ``0`` as unset. A malformed shared value is
    rejected (logged) and defers purge with zero rather than crashing the
    scheduled task. Oversized integer windows also defer purge with zero rather
    than shortening an operator's intended retention.
    """
    policy: Callable[[], object] | None = current_app.config.get(
        "SOFT_DELETE_RETENTION_DAYS_FUNC"
    )
    if policy is not None:
        try:
            days: object = policy()
        except Exception:  # Host boundary: do not expose service payloads or purge.
            return _defer_invalid_window(
                "deletion_retention: host retention policy unavailable; skipping"
            )
        if (
            isinstance(days, int)
            and not isinstance(days, bool)
            and -1 <= days <= MAX_RETENTION_DAYS
        ):
            return days
        return _defer_invalid_window(
            "deletion_retention: invalid host retention policy; skipping"
        )
    if (shared := get_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS)) is not None:
        if isinstance(shared, int) and shared > MAX_RETENTION_DAYS:
            return _defer_invalid_window(
                "deletion_retention: oversized shared retention; skipping"
            )
        if isinstance(shared, bool) or not isinstance(shared, int) or shared < -1:
            return _defer_invalid_window(
                "deletion_retention: malformed shared retention; skipping"
            )
        return shared
    return _config_retention_days()
