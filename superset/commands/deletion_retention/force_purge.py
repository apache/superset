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
"""Compliance force-purge of a single entity by UUID.

Immediate, irreversible removal of one entity regardless of the retention
window or whether it is currently soft-deleted or live. Runs the same cascade
as the time-based task with ``enforce_window=False`` — identical dependent
handling with legacy hard-delete semantics: M:N join rows hard-deleted,
a referencing live chart's loose ``datasource_id`` left dangling (the chart is
never modified). Idempotent: a UUID that resolves to nothing is a no-op.
"""

from __future__ import annotations

import logging
from typing import Any, cast

from superset import db
from superset.commands.deletion_retention import audit
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    CascadeResult,
    dashboard_slice_count,
    suppress_purge_association_versions,
)
from superset.models.helpers import skip_visibility_filter, SoftDeleteMixin

logger: logging.Logger = logging.getLogger(__name__)


class ForcePurgeCommand:
    """Force-purge the entity identified by *uuid*, if any."""

    def __init__(self, uuid: str, actor: str = "operator") -> None:
        self._uuid: str = uuid
        self._actor: str = actor

    def _resolve(self) -> SoftDeleteMixin | None:
        """Find the entity across every soft-delete model by UUID, matching
        live or soft-deleted rows (visibility-filter bypassed)."""
        for model in SoftDeleteMixin._registered_subclasses:  # noqa: SLF001
            if not hasattr(model, "uuid"):
                continue
            with skip_visibility_filter(db.session, model):
                entity = (
                    db.session.query(model).filter(model.uuid == self._uuid).first()
                )
            if entity is not None:
                return entity
        return None

    def run(self) -> dict[str, Any]:
        """Resolve + purge. Returns a summary; a no-op when nothing matches."""
        audit.reconcile_pending()
        entity = self._resolve()
        if entity is None:
            logger.info("force_purge: no entity for uuid=%s (no-op)", self._uuid)
            return {"purged": False, "reason": "not_found", "uuid": self._uuid}

        entity_type = str(cast(Any, type(entity)).__tablename__)
        removed_dashboard_slices = dashboard_slice_count(db.session, entity)
        # The audit row commits independently. Release the resolving read
        # transaction first, then resolve again against post-audit state.
        db.session.rollback()
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_FORCE,
            actor=self._actor,
            entity_type=entity_type,
            entity_uuid=self._uuid,
            removed_dashboard_slices=removed_dashboard_slices,
        )
        entity = self._resolve()
        if entity is None:
            audit.fail(record_id)
            logger.info(
                "force_purge: entity disappeared before purge uuid=%s (no-op)",
                self._uuid,
            )
            return {"purged": False, "reason": "not_found", "uuid": self._uuid}
        try:
            with suppress_purge_association_versions(db.session):
                result: CascadeResult = cascade_hard_delete(
                    db.session, entity, enforce_window=False
                )
                db.session.commit()
        except Exception:
            db.session.rollback()
            audit.fail(record_id)
            raise
        if result.purged:
            audit.confirm(
                record_id,
                affected_referrers=result.dangling_chart_uuids,
                removed_dashboard_slices=result.removed_dashboard_slices,
            )
        elif result.blocked_reason is not None:
            audit.block(record_id)
        else:
            audit.fail(record_id)
        if result.purged:
            logger.info(
                "force_purge: purged %s uuid=%s "
                "(dangling charts=%d, dashboard_slices=%d)",
                result.entity_type,
                self._uuid,
                len(result.dangling_chart_uuids),
                result.removed_dashboard_slices,
            )
        elif result.blocked_reason is not None:
            logger.info(
                "force_purge: blocked %s uuid=%s reason=%s",
                result.entity_type,
                self._uuid,
                result.blocked_reason,
            )
        else:
            logger.info(
                "force_purge: no-op %s uuid=%s (restored or already gone)",
                result.entity_type,
                self._uuid,
            )
        return {
            "purged": result.purged,
            "reason": "blocked" if result.blocked_reason is not None else None,
            "blocked_reason": result.blocked_reason,
            "entity_type": result.entity_type,
            "uuid": self._uuid,
            "dangling_chart_uuids": result.dangling_chart_uuids,
            "removed_dashboard_slices": result.removed_dashboard_slices,
            "version_rows_removed": result.version_rows_removed,
        }
