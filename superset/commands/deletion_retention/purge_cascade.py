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
"""Shared hard-delete cascade for the purge task and force-purge command.

A single code path so the two surfaces cannot drift (FR-PURGE-003 /
FR-PURGE-008). Every dependent row is removed by an explicit ``sa.delete``;
the DB ``ON DELETE CASCADE`` constraints are a backstop only — SQLite does
not enforce FKs unless ``PRAGMA foreign_keys=ON`` and Core bulk DML fires
only DB-level cascades, so relying on cascade silently leaks rows (C10).

Cascade tiers (C14 / C18):

* **M:N join rows** — hard-deleted for the purged entity, including join
  rows owned by *surviving* entities (e.g. a live dashboard's
  ``dashboard_slices`` row to a purged chart). The entity on the other side
  is never touched except to lose that one relationship row.
* **Owned children** (``delete-orphan``, no independent existence) — a
  dataset's columns and metrics, hard-deleted with it.
* **Independently-owned entities** (a dashboard's charts, a chart's dataset)
  are **preserved**. A live chart's loose ``datasource_id`` to a purged
  dataset is left dangling — legacy hard-delete semantics, no guard (C21).
* **Version history** (Stage 2) — the entity's own ``*_version`` shadows and
  the ``version_changes`` scoped to them, plus an orphan-sweep of any
  ``version_transaction`` left owning zero surviving shadows (C12/C16). Runs
  behind a ``has_table`` check so it no-ops when versioning is absent.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@contextmanager
def suspend_version_capture() -> Iterator[None]:
    """Turn Continuum's write tracking off for the duration of the block.

    A purge *removes* version history; it must not *generate* it. Flipping
    Continuum's master ``versioning`` option off also stops the association
    tracker (``track_association_operations``) from firing on the cascade's
    raw ``sa.delete`` of tracked join tables (``dashboard_slices``), which
    otherwise raises ``KeyError`` because there is no Continuum unit-of-work
    for a Core delete. No-op when Continuum is absent or capture is already
    off; the prior value is always restored.
    """
    try:
        from sqlalchemy_continuum import versioning_manager
    except ImportError:
        yield
        return
    previous = versioning_manager.options.get("versioning", True)
    versioning_manager.options["versioning"] = False
    try:
        yield
    finally:
        versioning_manager.options["versioning"] = previous


def entity_uuid(entity: Any) -> str | None:
    """Return the entity's UUID as a string, or ``None`` if it has none."""
    value = getattr(entity, "uuid", None)
    return str(value) if value is not None else None


def _version_tables_present(bind: Any) -> bool:
    """Whether the version-history tables exist (a testable seam, so the
    version cascade no-ops cleanly before sc-103156 — H3/Assumptions)."""
    return sa.inspect(bind).has_table("version_transaction")


@dataclass
class CascadeResult:
    """Outcome of one entity's cascade.

    ``purged`` is False when the conditional entity-row delete matched no
    row — the entity was restored between selection and delete (the
    restore-vs-purge race, FR-PURGE-006) or was already gone. In that case
    no dependents are touched.
    """

    purged: bool
    entity_type: str
    entity_uuid: str | None
    dangling_chart_uuids: list[str] = field(default_factory=list)
    removed_dashboard_slices: int = 0
    version_rows_removed: int = 0


def cascade_hard_delete(
    session: Session,
    entity: Any,
    *,
    enforce_window: bool,
    cutoff: datetime | None = None,
) -> CascadeResult:
    """Remove *entity* and everything that depends on it in one transaction.

    With ``enforce_window=True`` (time-based purge) the entity row is removed
    by a conditional ``DELETE … WHERE deleted_at IS NOT NULL AND deleted_at <
    cutoff`` re-asserted at delete time: a concurrent restore that cleared
    ``deleted_at`` makes the row fail the predicate, so it survives and the
    cascade is skipped (``purged=False``). With ``enforce_window=False``
    (force-purge) the row is removed unconditionally regardless of its
    ``deleted_at`` state (C15). The conditional delete is claimed **first**,
    before any dependent is touched, so a lost race never strips a restored
    entity's relationships.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    if enforce_window and cutoff is None:
        raise ValueError("cutoff is required when enforce_window=True")

    model = type(entity)
    table = model.__table__
    entity_id = entity.id
    uuid = entity_uuid(entity)
    entity_type = _USER_FACING_TYPE.get(table.name, table.name)

    # Read referrers that will be left dangling / lose a relationship BEFORE
    # the row is gone, so the audit record can name them (FR-PURGE-009/012).
    dangling_chart_uuids: list[str] = []
    if model is SqlaTable:
        dangling_chart_uuids = [
            str(uuid)
            for (uuid,) in session.execute(
                sa.select(Slice.uuid)
                .where(Slice.datasource_id == entity_id)
                .where(Slice.datasource_type == "table")
            )
        ]
        # Replicate the after_delete permission cleanup that Core bulk-delete
        # would skip (C20) — do it while the row's attributes are still
        # readable, before the entity is removed.
        _cleanup_dataset_permission(session, entity)

    # Claim the entity row first (restore-race safety, FR-PURGE-006).
    delete_entity = sa.delete(table).where(table.c.id == entity_id)
    if enforce_window:
        delete_entity = delete_entity.where(table.c.deleted_at.is_not(None)).where(
            table.c.deleted_at < cutoff
        )
    if session.execute(delete_entity).rowcount == 0:
        logger.info(
            "deletion_retention: %s id=%s not purged (restored or already gone)",
            entity_type,
            entity_id,
        )
        return CascadeResult(purged=False, entity_type=entity_type, entity_uuid=uuid)

    removed_dashboard_slices = _delete_m2m_joins(session, model, entity_id)
    _delete_owned_children(session, model, entity_id)
    version_rows = _delete_version_history(session, entity, entity_id)

    return CascadeResult(
        purged=True,
        entity_type=entity_type,
        entity_uuid=uuid,
        dangling_chart_uuids=dangling_chart_uuids,
        removed_dashboard_slices=removed_dashboard_slices,
        version_rows_removed=version_rows,
    )


_USER_FACING_TYPE = {
    "slices": "chart",
    "dashboards": "dashboard",
    "tables": "dataset",
}


def _delete_m2m_joins(session: Session, model: type, entity_id: int) -> int:
    """Hard-delete every M:N join / association row the entity owns (C14).

    Returns the number of ``dashboard_slices`` rows removed (recorded in the
    audit entry for chart purges — they may belong to live dashboards).
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable, sqlatable_user
    from superset.models.dashboard import (
        Dashboard,
        dashboard_slices,
        dashboard_user,
        DashboardRoles,
    )
    from superset.models.slice import Slice, slice_user
    from superset.tags.models import ObjectType, TaggedObject

    removed_dashboard_slices = 0
    if model is Dashboard:
        session.execute(
            sa.delete(dashboard_slices).where(
                dashboard_slices.c.dashboard_id == entity_id
            )
        )
        session.execute(
            sa.delete(dashboard_user).where(dashboard_user.c.dashboard_id == entity_id)
        )
        session.execute(
            sa.delete(DashboardRoles).where(DashboardRoles.c.dashboard_id == entity_id)
        )
        _delete_tags(session, TaggedObject, ObjectType.dashboard, entity_id)
    elif model is Slice:
        # Every dashboard_slices row pointing at this chart, including those
        # owned by live dashboards (the live dashboard survives, minus this
        # chart from its layout) — C14.
        removed_dashboard_slices = session.execute(
            sa.delete(dashboard_slices).where(dashboard_slices.c.slice_id == entity_id)
        ).rowcount
        session.execute(sa.delete(slice_user).where(slice_user.c.slice_id == entity_id))
        _delete_tags(session, TaggedObject, ObjectType.chart, entity_id)
    elif model is SqlaTable:
        session.execute(
            sa.delete(sqlatable_user).where(sqlatable_user.c.table_id == entity_id)
        )
        _delete_tags(session, TaggedObject, ObjectType.dataset, entity_id)
    return removed_dashboard_slices


def _delete_tags(
    session: Session, tagged_object: type, object_type: Any, entity_id: int
) -> None:
    """Remove the entity's ``tagged_object`` rows (the ``after_delete`` tag
    cleanup Core bulk-delete skips — C14/C20)."""
    session.execute(
        sa.delete(tagged_object.__table__).where(
            tagged_object.object_id == entity_id,
            tagged_object.object_type == object_type,
        )
    )


def _delete_owned_children(session: Session, model: type, entity_id: int) -> None:
    """Hard-delete a dataset's owned children (columns + metrics) — C18.

    These ``delete-orphan`` children have no independent existence. Charts
    and dashboards have no such owned child tables today.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    if model is SqlaTable:
        session.execute(
            sa.delete(TableColumn.__table__).where(
                TableColumn.__table__.c.table_id == entity_id
            )
        )
        session.execute(
            sa.delete(SqlMetric.__table__).where(
                SqlMetric.__table__.c.table_id == entity_id
            )
        )


def _cleanup_dataset_permission(session: Session, entity: Any) -> None:
    """Replicate ``SqlaTable.after_delete`` permission cleanup (C20).

    Core ``sa.delete`` does not fire the ORM ``after_delete`` listener that
    normally removes the dataset's ``datasource access`` view-menu /
    permission-view, so it is done explicitly here or the PVM is orphaned.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    try:
        vm_name = security_manager.get_dataset_perm(
            entity.id, entity.table_name, entity.database.database_name
        )
        security_manager._delete_pvm_on_sqla_event(  # pylint: disable=protected-access
            None, session.connection(), "datasource_access", vm_name
        )
    except Exception:  # pylint: disable=broad-except
        # Permission cleanup is best-effort: a missing PVM (already gone) or a
        # detached database reference must not abort the entity purge.
        logger.warning(
            "deletion_retention: dataset permission cleanup failed for id=%s",
            entity.id,
            exc_info=True,
        )


def _entity_version_targets(
    model: type, metadata: sa.MetaData, parent_shadow: sa.Table, entity_id: int
) -> list[tuple[sa.Table, Any]]:
    """The ``(shadow_table, row_predicate)`` pairs that make up *this* entity's
    own version history: the parent shadow keyed by ``id``, plus — per type —
    the dashboard/chart M2M shadow (``dashboard_slices_version``) and a
    dataset's child shadows (``table_columns_version`` / ``sql_metrics_version``
    keyed by ``table_id``). It never touches another entity's rows."""
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    targets: list[tuple[sa.Table, Any]] = [
        (parent_shadow, parent_shadow.c.id == entity_id)
    ]
    m2m = metadata.tables.get("dashboard_slices_version")
    if m2m is not None and model is Dashboard:
        targets.append((m2m, m2m.c.dashboard_id == entity_id))
    elif m2m is not None and model is Slice:
        targets.append((m2m, m2m.c.slice_id == entity_id))
    elif model is SqlaTable:
        for child_name in ("table_columns_version", "sql_metrics_version"):
            child = metadata.tables.get(child_name)
            if child is not None and "table_id" in child.c:
                targets.append((child, child.c.table_id == entity_id))
    return targets


def _delete_version_history(session: Session, entity: Any, entity_id: int) -> int:
    """Stage 2 (C12/C16): remove the entity's own version-history rows.

    Deletes the entity's parent + child + M2M ``*_version`` shadow rows and the
    ``version_changes`` rows scoped to this entity (by ``entity_kind`` +
    ``entity_id`` — **not** by transaction, which is shared), then sweeps any
    ``version_transaction`` left owning zero surviving shadow / change rows. A
    ``version_transaction`` is a *shared* unit-of-work boundary that can span
    entities, so it is removed only once orphaned — never blind-deleted (⚠️ B2).
    Gated on the version tables existing, so it no-ops cleanly before sc-103156.
    """
    if not _version_tables_present(session.get_bind()):
        return 0

    # pylint: disable=import-outside-toplevel
    try:
        from sqlalchemy_continuum import version_class, versioning_manager
        from sqlalchemy_continuum.exc import ClassNotVersioned
    except ImportError:
        return 0

    model = type(entity)
    try:
        parent_shadow = version_class(model).__table__
    except ClassNotVersioned:
        return 0

    metadata = parent_shadow.metadata
    # version_transaction lives in Continuum's manager, not the shadow metadata.
    tx = versioning_manager.transaction_cls.__table__
    changes = metadata.tables.get("version_changes")
    targets = _entity_version_targets(model, metadata, parent_shadow, entity_id)

    # Transactions these shadow rows are anchored to — orphan-sweep candidates.
    tx_ids: set[int] = set()
    for tbl, pred in targets:
        if "transaction_id" in tbl.c:
            tx_ids.update(
                row[0]
                for row in session.execute(
                    sa.select(tbl.c.transaction_id).where(pred).distinct()
                )
            )

    removed = 0
    for tbl, pred in targets:
        removed += session.execute(sa.delete(tbl).where(pred)).rowcount

    # version_changes scoped to this entity (entity_kind + entity_id).
    if changes is not None:
        from superset.versioning.changes import ENTITY_KIND_BY_CLASS_NAME

        kind = ENTITY_KIND_BY_CLASS_NAME.get(model.__name__)
        if kind is not None:
            session.execute(
                sa.delete(changes).where(
                    changes.c.entity_kind == kind,
                    changes.c.entity_id == entity_id,
                )
            )

    if tx is not None and tx_ids:
        _sweep_orphan_transactions(session, metadata, tx, changes, tx_ids)

    return removed


def _sweep_orphan_transactions(
    session: Session,
    metadata: sa.MetaData,
    tx: sa.Table,
    changes: sa.Table | None,
    tx_ids: set[int],
) -> None:
    """Delete the given ``version_transaction`` rows that no surviving shadow
    *or* ``version_changes`` row references — across every ``*_version`` table
    (C16). A double-sweep of the same orphan is a harmless no-op."""
    sources = [
        t
        for name, t in metadata.tables.items()
        if name.endswith("_version") and "transaction_id" in t.c
    ]
    if changes is not None and "transaction_id" in changes.c:
        sources.append(changes)
    still_referenced: set[int] = set()
    for source in sources:
        still_referenced.update(
            row[0]
            for row in session.execute(
                sa.select(source.c.transaction_id)
                .where(source.c.transaction_id.in_(tx_ids))
                .distinct()
            )
        )
    orphaned = tx_ids - still_referenced
    if orphaned:
        session.execute(sa.delete(tx).where(tx.c.id.in_(orphaned)))
