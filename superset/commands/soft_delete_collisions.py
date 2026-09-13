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
"""Translate unique-slot collisions with SOFT-DELETED rows into guidance.

Soft delete keeps rows in the database, so database-level unique
constraints still see them. On dialects where the constraint was replaced
by a partial index (``WHERE deleted_at IS NULL`` -- PostgreSQL and
MySQL 8.0+ for ``dashboards.slug``), a deleted row no longer reserves its
slot; on the full-constraint dialects (SQLite, MariaDB, MySQL < 8.0) an
insert colliding with a soft-deleted row still dies at flush with a raw
``IntegrityError``. Datasets keep a full constraint everywhere and refuse
at validation instead.

These helpers turn both shapes into an actionable 422: which deleted
object holds the slot, that an owner can restore it (Settings ▸ Recently
Archived, or the restore endpoint), or that a different identifier can be
chosen. A collision NOT caused by a soft-deleted row is never masked --
callers re-raise the original error when no deleted holder exists.

Adding the next soft-deletable entity: use
:func:`find_soft_deleted_slot_holder` with the entity's unique criteria
and raise the entity's own guidance ``ValidationError`` beside its
existing "already exists" error.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder import Model


def find_soft_deleted_slot_holder(
    model_cls: type["Model"], *criteria: Any
) -> "Model | None":
    """Return the soft-deleted row matching *criteria*, if any.

    Bypasses the soft-delete visibility filter with the session-scoped
    context manager (a per-query execution option never reaches the
    listener -- see ``DatasetDAO.validate_uniqueness``'s rationale) and
    matches deleted rows only, so a live-row conflict is never
    misreported as restorable.
    """
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.models.helpers import skip_visibility_filter

    with skip_visibility_filter(db.session, model_cls):
        return (
            db.session.query(model_cls)
            .filter(*criteria, model_cls.deleted_at.isnot(None))
            .first()
        )


def raise_for_soft_deleted_slug_collision(slug: str | None, cause: Exception) -> None:
    """Translate a dashboard-slug ``IntegrityError`` when a deleted row holds it.

    No-op (returning so the caller re-raises *cause*) when there is no
    slug in play or no soft-deleted holder -- a genuine conflict keeps its
    original error. Only reachable on the full-constraint dialects; the
    partial-index dialects never raise for a soft-deleted slug in the
    first place.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.exceptions import (
        DashboardInvalidError,
        DashboardSlugReservedValidationError,
    )
    from superset.models.dashboard import Dashboard

    if not slug:
        return
    holder = find_soft_deleted_slot_holder(Dashboard, Dashboard.slug == slug)
    if holder is None:
        return
    raise DashboardInvalidError(
        exceptions=[DashboardSlugReservedValidationError(slug, holder)]
    ) from cause
