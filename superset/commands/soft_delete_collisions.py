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

import re
from typing import Any, TYPE_CHECKING

#: Slug uniqueness objects. ``idx_unique_slug`` is the original full constraint
#: (migration 1a48a5411020); ``ix_dashboards_active_slug`` is the live-rows-only
#: index that replaced it on PostgreSQL / MySQL 8.0.13+ (9e1f3b8c4d2a).
_SLUG_UNIQUE_NAMES: frozenset[str] = frozenset(
    {"idx_unique_slug", "ix_dashboards_active_slug"}
)

if TYPE_CHECKING:
    from flask_appbuilder import Model


def _is_dashboard_slug_uniqueness_error(cause: Exception) -> bool:
    """Identify dashboard slug uniqueness violations from driver diagnostics."""
    # Wrapper text includes SQL and user-supplied values, not just the error.
    orig: Exception | None = getattr(cause, "orig", None)
    if orig is None:
        return False

    # MySQL drivers can expose SQLSTATE as well as errno. Their SQLSTATE
    # must not send a MySQL diagnostic down the PostgreSQL-only path.
    args: tuple[Any, ...] = getattr(orig, "args", ())
    if args and isinstance(args[0], int):
        if args[0] != 1062 or len(args) < 2 or not isinstance(args[1], str):
            return False
        # Match the quoted key diagnostic, not a name in the duplicate value.
        # MySQL can qualify the key with the table name.
        key_match: re.Match[str] | None = re.search(
            r"""for key (['"`])(?:dashboards\.)?([^'"`]+)\1$""", args[1]
        )
        return key_match is not None and key_match[2] in _SLUG_UNIQUE_NAMES

    pgcode: str | None = getattr(orig, "pgcode", None) or getattr(
        orig, "sqlstate", None
    )
    if pgcode is not None:
        constraint_name: str | None = getattr(
            getattr(orig, "diag", None), "constraint_name", None
        )
        return pgcode == "23505" and constraint_name in _SLUG_UNIQUE_NAMES

    # SQLite's driver text is the diagnostic alone, unlike the wrapper.
    return str(orig).lower() == "unique constraint failed: dashboards.slug"


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
    # Deferred imports: ``superset`` and ``superset.models.helpers`` pull
    # in the app factory / model registry, which must not run at import
    # time of a commands module (app-init chain; see the module
    # docstring).
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

    No-op (returning so the caller re-raises *cause*) when no slug was
    sent (``None`` -- an empty string is a real, storable value and IS
    probed), when a LIVE dashboard holds the slug, or when no
    soft-deleted holder exists -- a genuine conflict keeps its original
    error. The live-holder check matters under concurrency: another
    request can commit the same slug between this request's uniqueness
    precheck and its flush, and the failed constraint is then the live
    row's -- advising a restore of some archived namesake could never
    resolve that conflict.

    Translate only an identified dashboard-slug uniqueness violation; other
    integrity failures (UUID, foreign key, NOT NULL), including unidentifiable
    ones, remain on the caller's original error path. The create schema accepts
    a client-supplied UUID, so UUID collisions reach the same flush, and slug
    restore guidance cannot resolve them (reviewer finding in #44184).
    """
    # Deferred imports: exceptions/models pull in the model registry,
    # which must not run at import time of this shared module (app-init
    # chain; and commands.dashboard.exceptions imports back into command
    # modules that import this helper).
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.commands.dashboard.exceptions import (
        DashboardInvalidError,
        DashboardSlugReservedValidationError,
    )
    from superset.models.dashboard import Dashboard

    if slug is None:
        return
    if not _is_dashboard_slug_uniqueness_error(cause):
        return
    live_holder: "Dashboard | None" = (
        db.session.query(Dashboard)
        .filter(Dashboard.slug == slug, Dashboard.deleted_at.is_(None))
        .first()
    )
    if live_holder is not None:
        return
    holder: "Model | None" = find_soft_deleted_slot_holder(
        Dashboard, Dashboard.slug == slug
    )
    if holder is None:
        return
    raise DashboardInvalidError(
        exceptions=[DashboardSlugReservedValidationError(slug, holder)]
    ) from cause
