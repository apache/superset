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
"""Resolve the soft-delete retention window (FR-PURGE-004 / FR-PURGE-005)."""

from __future__ import annotations

import logging

from flask import current_app

from superset.key_value.shared_entries import get_shared_value
from superset.key_value.types import SharedKey

logger = logging.getLogger(__name__)

_DEFAULT_RETENTION_DAYS = 30


def resolve_retention_window() -> int:
    """Return the retention window in days, read live on each call.

    Resolution order (FR-PURGE-004/005):

    1. The per-workspace value persisted under
       ``SharedKey.SOFT_DELETE_RETENTION_DAYS`` (read live; takes
       precedence when present).
    2. Otherwise the ``SUPERSET_SOFT_DELETE_RETENTION_DAYS`` config /
       environment seed default (itself defaulting to 30).

    ``0`` from either source is a meaningful "disable", so the shared
    value is selected with an explicit ``is None`` check — never ``or``,
    which would treat ``0`` as unset. A malformed shared value is
    rejected (logged) and the fallback is used rather than crashing the
    scheduled task.
    """
    if (shared := get_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS)) is not None:
        if isinstance(shared, bool) or not isinstance(shared, int) or shared < 0:
            logger.warning(
                "deletion_retention: ignoring malformed shared retention value %r; "
                "falling back to config",
                shared,
            )
        else:
            return shared
    return int(
        current_app.config.get(
            "SUPERSET_SOFT_DELETE_RETENTION_DAYS", _DEFAULT_RETENTION_DAYS
        )
    )
