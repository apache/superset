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

from superset.key_value.shared_entries import get_shared_value
from superset.key_value.types import SharedKey

logger: logging.Logger = logging.getLogger(__name__)

_DEFAULT_RETENTION_DAYS: int = 30


def _config_retention_days() -> int:
    """Return a validated config fallback without breaking scheduled runs."""
    configured = current_app.config.get(
        "SOFT_DELETE_RETENTION_DAYS", _DEFAULT_RETENTION_DAYS
    )
    try:
        if isinstance(configured, bool) or not isinstance(configured, (str, int)):
            raise ValueError
        days = int(configured)
        if days < -1:
            raise ValueError
        return days
    except (TypeError, ValueError):
        logger.warning(
            "deletion_retention: ignoring malformed config retention value %r; "
            "falling back to %d days",
            configured,
            _DEFAULT_RETENTION_DAYS,
        )
        return _DEFAULT_RETENTION_DAYS


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
    rejected (logged) and the fallback is used rather than crashing the
    scheduled task.
    """
    policy: Callable[[], object] | None = current_app.config.get(
        "SOFT_DELETE_RETENTION_DAYS_FUNC"
    )
    if policy is not None:
        try:
            days: object = policy()
        except Exception:  # Host boundary: do not expose service payloads or purge.
            logger.warning(
                "deletion_retention: host retention policy unavailable; skipping"
            )
            return 0
        if isinstance(days, int) and not isinstance(days, bool) and -1 <= days <= 36500:
            return days
        logger.warning("deletion_retention: invalid host retention policy; skipping")
        return 0
    if (shared := get_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS)) is not None:
        if isinstance(shared, bool) or not isinstance(shared, int) or shared < -1:
            logger.warning(
                "deletion_retention: ignoring malformed shared retention value %r; "
                "falling back to config",
                shared,
            )
        else:
            return shared
    return _config_retention_days()
