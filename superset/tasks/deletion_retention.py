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
"""Celery beat task: purge soft-deleted entities past the retention window.

The deletion-domain analog of ``version_history.prune_old_versions``: where
that ages out version rows while keeping the live entity, this removes
entities that are already soft-deleted (sc-111185). For each
``SoftDeleteMixin`` model it selects rows whose ``deleted_at`` is older than
the per-workspace window and runs the shared cascade per entity, in bounded
id-ordered batches. Convergent, not strictly idempotent: a re-run with the
same clock and data removes nothing, but rows that have since crossed the
cutoff are purged on a later run (FR-PURGE-001).
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa
from flask import current_app

from superset import db
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    entity_uuid,
    suspend_version_capture,
)
from superset.commands.deletion_retention.window import resolve_retention_window
from superset.extensions import celery_app, feature_flag_manager, stats_logger_manager
from superset.models.helpers import (
    skip_visibility_filter,
    SoftDeleteMixin,
)

logger = logging.getLogger(__name__)

_METRIC_PREFIX = "deletion_retention"
# Below SQLite's historical 999 bind-variable limit; well under PG/MySQL
# (R6 — there is no existing SQLITE_MAX_VARIABLE_NUMBER symbol to reuse).
_PURGE_DELETE_CHUNK = 500
_BATCH = _PURGE_DELETE_CHUNK


def _model_table(model: type[SoftDeleteMixin]) -> sa.Table:
    """Return the mapped table for a registered soft-delete model."""
    return model.__table__  # type: ignore[attr-defined]


def _model_name(model: type[SoftDeleteMixin]) -> str:
    """Return the mapped table name for a registered soft-delete model."""
    return model.__tablename__  # type: ignore[attr-defined]


def _soft_delete_models() -> list[type[SoftDeleteMixin]]:
    """The registered ``SoftDeleteMixin`` subclasses (dashboards, charts,
    datasets), in a stable order."""
    return list(SoftDeleteMixin._registered_subclasses)  # noqa: SLF001


def _iter_eligible_ids(
    model: type[SoftDeleteMixin], cutoff: datetime, batch: int
) -> Iterator[list[int]]:
    """Yield id-ordered batches of eligible row ids — ``deleted_at IS NOT NULL
    AND deleted_at < cutoff`` — querying with the visibility-filter bypass so
    soft-deleted rows are visible. Windowed by an ``id`` watermark so memory
    and lock-hold stay bounded on a large first run."""
    table = _model_table(model)
    after_id = 0
    while True:
        with skip_visibility_filter(db.session, model):
            ids = [
                row[0]
                for row in db.session.execute(
                    sa.select(table.c.id)
                    .where(table.c.deleted_at.is_not(None))
                    .where(table.c.deleted_at < cutoff)
                    .where(table.c.id > after_id)
                    .order_by(table.c.id)
                    .limit(batch)
                )
            ]
        if not ids:
            return
        yield ids
        if len(ids) < batch:
            return
        after_id = ids[-1]


def _purge_impl(window_days: int, dry_run: bool) -> dict[str, Any]:
    """Run one purge pass across all soft-delete models."""
    if window_days <= 0:
        logger.info("deletion_retention: window is 0 (disabled); skipping")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.skipped")
        return {"skipped": 1}

    cutoff = datetime.now() - timedelta(days=window_days)  # C6: now(), not utcnow()
    purged: dict[str, int] = {}
    would_purge: dict[str, int] = {}
    failures = 0

    for model in _soft_delete_models():
        entity_type = _model_name(model)
        purged_n, would_n, failed_n = _purge_model(model, cutoff, dry_run)
        if would_n:
            would_purge[entity_type] = would_n
        if purged_n:
            purged[entity_type] = purged_n
        failures += failed_n

    if dry_run:
        for entity_type, count in would_purge.items():
            stats_logger_manager.instance.gauge(
                f"{_METRIC_PREFIX}.would_purge.{entity_type}", count
            )
        logger.info("deletion_retention: DRY RUN would_purge=%s", would_purge)
        return {"dry_run": 1, "would_purge": would_purge}

    for entity_type, count in purged.items():
        stats_logger_manager.instance.gauge(
            f"{_METRIC_PREFIX}.purged.{entity_type}", count
        )
    if failures:
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.cascade_failures")
    stats = {"purged": purged, "cascade_failures": failures}
    logger.info("deletion_retention: %s", stats)
    return stats


def _purge_model(
    model: type[SoftDeleteMixin], cutoff: datetime, dry_run: bool
) -> tuple[int, int, int]:
    """Process one model's eligible rows. Returns ``(purged, would_purge,
    failures)``. A single entity's cascade failure is rolled back, logged, and
    counted — it never aborts the batch (FR-PURGE-010)."""
    entity_type = _model_name(model)
    purged = would = failures = 0
    for id_batch in _iter_eligible_ids(model, cutoff, _BATCH):
        if dry_run:
            would += len(id_batch)
            continue
        for entity_id in id_batch:
            try:
                _purge_one(model, entity_id, cutoff)
                purged += 1
            except Exception:  # pylint: disable=broad-except
                db.session.rollback()
                failures += 1
                logger.exception(
                    "deletion_retention: cascade failed for %s id=%s",
                    entity_type,
                    entity_id,
                )
    return purged, would, failures


def _purge_one(model: type[SoftDeleteMixin], entity_id: int, cutoff: datetime) -> None:
    """Purge a single entity in its own transaction with a write-ahead audit
    record (FR-PURGE-012 / C19)."""
    with skip_visibility_filter(db.session, model):
        entity = db.session.get(model, entity_id)
    if entity is None:
        return
    record_id = audit.write_ahead(
        trigger=audit.TRIGGER_RETENTION,
        actor=audit.ACTOR_SYSTEM,
        entity_type=_model_name(model),
        entity_uuid=entity_uuid(entity),
    )
    with suspend_version_capture():
        result = cascade_hard_delete(
            db.session, entity, enforce_window=True, cutoff=cutoff
        )
        db.session.commit()
    if result.purged:
        audit.confirm(record_id, affected_referrers=result.dangling_chart_uuids)


@celery_app.task(name="deletion_retention.purge_soft_deleted")
def purge_soft_deleted() -> dict[str, Any]:
    """Beat entry point. Resolves the window live, honors the SOFT_DELETE
    rollout gate and dry-run flag, and isolates failures so one bad run does
    not poison the schedule."""
    # While the temporary SOFT_DELETE rollout gate is off the delete path
    # writes no ``deleted_at`` rows, so the task already no-ops; check the gate
    # explicitly for clarity (the check is removed when the gate is).
    if not feature_flag_manager.is_feature_enabled("SOFT_DELETE"):
        logger.info("deletion_retention: SOFT_DELETE gate off; skipping")
        return {"skipped": 1}
    window_days = resolve_retention_window()
    dry_run = bool(current_app.config.get("SUPERSET_SOFT_DELETE_PURGE_DRY_RUN", True))
    try:
        return _purge_impl(window_days, dry_run)
    except Exception:  # pylint: disable=broad-except
        logger.exception("deletion_retention.purge_soft_deleted: task failed")
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.failed")
        return {"error": 1}
