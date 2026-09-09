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
"""Write-side: restore a versioned entity to an earlier state.

Companion to :mod:`superset.versioning.queries`. The
``BaseRestoreVersionCommand`` in :mod:`superset.commands.version_restore`
is the only intended caller; the backward-compat ``VersionDAO`` façade
in :mod:`superset.daos.version` re-exports ``restore_version``.

Restore semantics are strictly per-entity: a restore rewrites the target
entity's own fields (and, for datasets, its own columns/metrics — the
aggregate's internal parts), never the content of other entities. A
dashboard restore reattaches membership to charts that still exist;
charts that have been deleted since the snapshot stay deleted and are
reported as skipped rather than revived or dangling.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.versioning.baseline import OPERATION_DELETE
from superset.versioning.queries import find_active_by_uuid
from superset.versioning.utils import single_flush_scope

logger = logging.getLogger(__name__)

# A DELETE version row (``OPERATION_DELETE``) is never a valid restore
# target: Continuum's ``Reverter`` would delete the live entity and report
# success — the opposite of the non-destructive contract — so the engine
# treats it as not-found.


# Per-model relationships that Continuum's Reverter recurses into during a
# restore — deliberately limited to the entity's OWN aggregate parts
# (``TableColumn`` / ``SqlMetric`` on ``SqlaTable``). ``Dashboard`` is NOT
# given ``slices`` here: recursing into the M2M would run a full child
# revert on every member chart, overwriting live charts' content with
# historical values (charts are shared entities with their own restore),
# and re-creating hard-deleted charts. Dashboard membership is instead
# reconstructed by :func:`_restore_dashboard_membership`.
#
# Unknown models fail closed (``LookupError``) rather than defaulting to a
# relation-less restore — a silently partial restore is worse than a loud
# failure (mirrors ``_RAISE_FOR_ACCESS_KWARG`` in ``api_helpers``).
_RESTORE_RELATIONS: dict[str, list[str]] = {
    "SqlaTable": ["columns", "metrics"],
    "Dashboard": [],
    "Slice": [],
}


@dataclass
class RestoreResult:
    """Outcome of a successful restore.

    ``skipped_slice_ids`` is only ever populated for dashboard restores:
    member charts referenced by the snapshot that no longer exist and were
    therefore not reattached (they stay deleted — restore never revives
    entities).
    """

    entity: Any
    skipped_slice_ids: list[int] = field(default_factory=list)


def restore_version(
    model_cls: type,
    entity_uuid: UUID,
    transaction_id: int,
    *,
    entity: Any | None = None,
) -> RestoreResult | None:
    """Restore the entity identified by *entity_uuid* to the state captured
    at *transaction_id* (the stable identifier resolved from a
    ``version_uuid`` by :func:`superset.versioning.queries.resolve_version`).

    Returns a :class:`RestoreResult` wrapping the live entity, or ``None``
    when the UUID does not match an active entity, no version row exists at
    *transaction_id*, or the target row is a DELETE — callers should
    translate all three to a 404.

    Pass *entity* to skip the ``find_active_by_uuid`` lookup when the
    caller has already loaded the row (the command's ``validate()`` has).

    Uses SQLAlchemy-Continuum's native ``version_obj.revert(relations=...)``
    and delegates commit to the caller (expected to be a command decorated
    with ``@transaction()``). The ``relations`` list depends on the model
    type and is looked up in :data:`_RESTORE_RELATIONS`; unknown models
    raise ``LookupError`` rather than silently restoring without children.

    Within the same flush, ``changed_on`` / ``changed_by_fk`` are
    re-stamped with the current time and the restoring user's id so the
    new version row produced by the restoring commit reflects who clicked
    Restore, not the original author. ``created_on`` / ``created_by_fk``
    are left alone.
    """
    if entity is None:
        entity = find_active_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None
    elif entity.uuid != entity_uuid:
        # The caller-supplied shortcut must describe the same row as
        # *entity_uuid*: everything downstream (the version lookup, the
        # audit stamp, the caller's logging) trusts them to agree. Fail
        # loudly rather than restore one entity while reporting another.
        raise ValueError(
            f"entity.uuid ({entity.uuid!r}) does not match entity_uuid "
            f"({entity_uuid!r}); the preloaded entity must be the one "
            "identified by entity_uuid"
        )

    ver_cls = version_class(model_cls)
    target_version = (
        db.session.query(ver_cls)
        .filter(
            # Pin to (id, uuid): a hard delete frees the integer id, so
            # matching on it alone can resolve a *predecessor's* version row
            # and restore its content over the current entity.
            ver_cls.id == entity.id,
            ver_cls.uuid == entity.uuid,
            ver_cls.transaction_id == transaction_id,
        )
        .one_or_none()
    )
    if target_version is None or target_version.operation_type == OPERATION_DELETE:
        return None

    relations = _RESTORE_RELATIONS.get(model_cls.__name__)
    if relations is None:
        raise LookupError(
            f"No restore relations registered for {model_cls.__name__!r}; "
            "register the model in _RESTORE_RELATIONS before wiring a "
            "restore command for it."
        )

    # Run the whole revert — including membership reconstruction and audit
    # stamping — inside a single flush scope so SQLAlchemy-Continuum's
    # ``Reverter`` can iterate relations without tripping its autoflush
    # race, and so the change-records listener sees the complete state in
    # one ``after_flush`` pass. See ``single_flush_scope`` for the full
    # rationale.
    skipped_slice_ids: list[int] = []
    try:
        with single_flush_scope(db.session):
            target_version.revert(relations=relations)
            if model_cls.__name__ == "Dashboard":
                skipped_slice_ids = _restore_dashboard_membership(
                    entity, transaction_id
                )
            _stamp_audit_fields_for_restore(entity)
    except Exception:
        logger.exception(
            "Continuum revert() failed for %s id=%s tx=%s relations=%s",
            model_cls.__name__,
            entity.id,
            transaction_id,
            relations,
        )
        raise

    logger.info(
        "versioning: restored %s id=%s uuid=%s to tx=%s (skipped_slices=%s)",
        model_cls.__name__,
        entity.id,
        entity_uuid,
        transaction_id,
        skipped_slice_ids or None,
    )
    return RestoreResult(entity=entity, skipped_slice_ids=skipped_slice_ids)


def _restore_dashboard_membership(dashboard: Any, transaction_id: int) -> list[int]:
    """Reset *dashboard*'s chart membership to what it was at
    *transaction_id*, reattaching only charts that still exist.

    Reads the validity-windowed ``dashboard_slices_version`` shadow
    (Continuum's auto-generated M2M table): a slice was a member at tx T
    iff a non-DELETE row has ``transaction_id <= T`` and an open or
    later-closing validity window.

    Returns the ids of snapshot members that no longer exist and were
    skipped. Live charts' content is never touched — restoring a chart's
    content is the chart's own restore endpoint's job.
    """
    # pylint: disable=import-outside-toplevel
    # Local imports: models.slice transitively imports models.core, which
    # needs the initialised app — module-top import would recreate the
    # bootstrap cycle documented in changes/listener.py; shadow_queries is
    # imported lazily for the same reason (see queries.get_version).
    from superset.models.slice import Slice
    from superset.versioning.changes import shadow_rows_valid_at

    ver_cls = version_class(type(dashboard))
    m2m_tbl = ver_cls.__table__.metadata.tables.get("dashboard_slices_version")
    if m2m_tbl is None:  # pragma: no cover — shadow tables always exist here
        return []

    # shadow_rows_valid_at owns the validity-window semantics (open or
    # later-closing window, non-DELETE) — the same predicate the version
    # snapshot's column/metric reconstruction uses.
    member_ids = sorted(
        {
            row["slice_id"]
            for row in shadow_rows_valid_at(
                db.session,
                m2m_tbl,
                "dashboard_id",
                dashboard.id,
                transaction_id,
            )
            if row["slice_id"] is not None
        }
    )
    if not member_ids:
        dashboard.slices = []
        return []

    live_slices = db.session.query(Slice).filter(Slice.id.in_(member_ids)).all()
    live_ids = {slc.id for slc in live_slices}
    skipped = sorted(set(member_ids) - live_ids)
    if skipped:
        logger.warning(
            "versioning: dashboard id=%s restore to tx=%s skipped %d "
            "member chart(s) that no longer exist: %s",
            dashboard.id,
            transaction_id,
            len(skipped),
            skipped,
        )
    dashboard.slices = live_slices
    return skipped


def _stamp_audit_fields_for_restore(entity: Any) -> None:
    """Overwrite ``changed_on`` / ``changed_by_fk`` on *entity* with the
    current time and current user id, so that the restore is attributed
    to the restoring user rather than the version snapshot's original
    author. Runs inside the restore's single flush scope so the stamp
    rides the same Continuum transaction as the revert."""
    # pylint: disable=import-outside-toplevel
    # Local import: utils.core pulls in the feature-flag manager, which
    # needs the initialised app (same cycle as models.slice above).
    from superset.utils.core import get_user_id

    entity.changed_on = datetime.now()
    entity.changed_by_fk = get_user_id()
