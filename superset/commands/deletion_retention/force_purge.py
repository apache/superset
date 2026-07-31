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


class AmbiguousPurgeTargetError(Exception):
    """The UUID matches rows in more than one soft-delete model."""


class ForcePurgeCommand:
    """Force-purge the entity identified by *uuid*, if any.

    ``model_cls`` restricts resolution to a single entity type. Operators
    reach this command with a bare UUID and no type, so it defaults to
    searching every soft-delete model — but UUID uniqueness is only enforced
    per table, so that search can be ambiguous. When it is, the command
    refuses rather than guessing: picking the first match would let a
    compliance deletion destroy an entity of a type nobody asked about.

    Any caller that already knows the type — notably one acting for an end
    user, whose authorization was necessarily checked against one specific
    entity — must pass ``model_cls`` so resolution cannot wander.

    ``require_archived`` restricts the purge to rows that are still
    soft-deleted. It is passed through to the cascade, where it becomes a
    predicate on the locked claim and on the conditional delete — checking it
    only at resolution time would narrow the race without closing it, since a
    restore can commit between the resolve and the lock.
    """

    def __init__(
        self,
        uuid: str,
        actor: str = "operator",
        model_cls: type[SoftDeleteMixin] | None = None,
        require_archived: bool = False,
        require_audit: bool = False,
    ) -> None:
        self._uuid: str = uuid
        self._actor: str = actor
        self._model_cls = model_cls
        self._require_archived = require_archived
        self._require_audit = require_audit

    def _resolve(self) -> SoftDeleteMixin | None:
        """Find the entity by UUID, visibility-filter bypassed.

        Searches only ``model_cls`` when given, else every registered
        soft-delete model — raising :class:`AmbiguousPurgeTargetError` if more
        than one model matches. Matches live rows as well as soft-deleted ones
        unless ``require_archived`` is set.
        """
        candidates = (
            [self._model_cls]
            if self._model_cls is not None
            else SoftDeleteMixin._registered_subclasses  # noqa: SLF001
        )
        matches: list[SoftDeleteMixin] = []
        for model in candidates:
            if not hasattr(model, "uuid"):
                continue
            with skip_visibility_filter(db.session, model):
                query = db.session.query(model).filter(model.uuid == self._uuid)
                if self._require_archived:
                    query = query.filter(model.deleted_at.is_not(None))
                entity = query.first()
            if entity is not None:
                matches.append(entity)
        if len(matches) > 1:
            raise AmbiguousPurgeTargetError(
                f"uuid={self._uuid!r} matches "
                f"{', '.join(sorted(type(m).__name__ for m in matches))}; "
                "pass the entity type to disambiguate"
            )
        return matches[0] if matches else None

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
        db.session.rollback()  # pylint: disable=consider-using-transaction
        record_id = audit.write_ahead(
            trigger=audit.TRIGGER_FORCE,
            actor=self._actor,
            entity_type=entity_type,
            entity_uuid=self._uuid,
            removed_dashboard_slices=removed_dashboard_slices,
        )
        if record_id is None and self._require_audit:
            # The scheduled task always fails closed here; this command's
            # default fail-open is licensed by "a human operator is present at
            # a shell" -- a rationale that does not transfer to the REST
            # caller, which passes require_audit so an end user's irreversible
            # purge can never execute unrecorded.
            logger.warning(
                "force_purge: refused uuid=%s -- write-ahead audit "
                "unavailable and the caller requires one",
                self._uuid,
            )
            return {
                "purged": False,
                "reason": "audit_unavailable",
                "uuid": self._uuid,
            }
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
                    db.session,
                    entity,
                    enforce_window=False,
                    require_archived=self._require_archived,
                )
            # Commit AFTER the suppression block: Continuum executes its
            # pending association statements during flush/commit, so the
            # block's exit-time trim must run first or a session carrying
            # versioned state would write the purge-queued shadows anyway.
            # Commit/rollback are managed manually so audit.fail() can
            # record the outcome after the purge transaction resolves.
            db.session.commit()  # pylint: disable=consider-using-transaction
        except Exception:
            db.session.rollback()  # pylint: disable=consider-using-transaction
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
