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
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy_continuum import version_class

from superset.extensions import db

logger = logging.getLogger(__name__)

# Fields not restored during a version rollback — they represent authorship
# metadata of the current save, not user-authored content.
RESTORE_EXCLUDE_FIELDS = {"created_on", "created_by_fk", "changed_on", "changed_by_fk"}

# Fixed UUIDv5 namespace under which per-(entity, transaction) version UUIDs
# are derived. Never change this constant — changing it invalidates every
# version_uuid that clients may have cached, bookmarked, or stored.
VERSION_UUID_NAMESPACE = UUID("7a6f5d9b-4c3b-5d8e-9a1c-0e2b4c6d8f10")


def _deserialize_snapshot_value(column: Any, value: Any) -> Any:
    """Reverse the JSON-friendly serialization done during snapshot
    capture. ``datetime``/``date``/``UUID`` values were flattened to
    strings; SQLite's DateTime/Date binders reject strings on insert, so
    parse them back using the live table's column type.

    Returns *value* unchanged when it's already the correct Python type
    or when the column type isn't one we serialize.
    """
    if value is None or not isinstance(value, str):
        return value

    try:
        python_type = column.type.python_type
    except (AttributeError, NotImplementedError):
        return value

    # pylint: disable=import-outside-toplevel
    from datetime import date, datetime
    from uuid import UUID

    try:
        if python_type is datetime:
            return datetime.fromisoformat(value)
        if python_type is date:
            return date.fromisoformat(value)
        if python_type is UUID:
            return UUID(value)
    except (TypeError, ValueError):
        return value
    return value


def _coerce_snapshot_list(raw: Any) -> list[dict[str, Any]]:
    """Snapshots are stored as ``JSON`` / ``JSONB`` so the driver may
    return either a pre-parsed list or a string (on SQLite). Normalise
    both to ``list[dict]``.
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        # pylint: disable=import-outside-toplevel
        from superset.utils import json as superset_json

        try:
            parsed = superset_json.loads(raw)
        except Exception:  # pylint: disable=broad-except
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def derive_version_uuid(entity_uuid: UUID, transaction_id: int) -> UUID:
    """Derive a deterministic UUIDv5 identifying one version row.

    The UUID is a function of the owning entity's UUID and the Continuum
    ``transaction_id`` of the version row, so it is stable across retention
    pruning (which never changes ``transaction_id``) and portable across
    replicas. It is not randomly generated — two Supersets with identical
    ``(entity.uuid, transaction_id)`` will compute the same version_uuid.
    """
    return uuid.uuid5(VERSION_UUID_NAMESPACE, f"{entity_uuid}:{transaction_id}")


class VersionDAO:
    @staticmethod
    def _find_active_entity_by_uuid(
        model_cls: type, entity_uuid: UUID
    ) -> Optional[Any]:
        """Return the live entity matching *entity_uuid*, or None if not found.

        Soft-delete filtering (deleted_at IS NOT NULL → return None) will be
        added when sc-103157 is merged (T043).
        """
        return (
            db.session.query(model_cls)
            .filter(model_cls.uuid == entity_uuid)  # type: ignore[attr-defined]
            .one_or_none()
        )

    @staticmethod
    def _get_version_count(model_cls: type, entity_id: int) -> int:
        """Return the number of historical version rows for *entity_id*."""
        ver_cls = version_class(model_cls)
        return (
            db.session.query(sa.func.count())
            .select_from(ver_cls)
            .filter(ver_cls.id == entity_id)
            .scalar()
            or 0
        )

    @staticmethod
    def current_version_number(model_cls: type, entity_id: int) -> Optional[int]:
        """Return the 0-based ``version_number`` of the live row for
        *entity_id* — equivalent to the index of the most recent entry that
        :meth:`list_versions` would return, or ``None`` when the entity has
        no version rows yet.

        Note: this index is *unstable under retention pruning*. When the
        entity is at :envvar:`SUPERSET_VERSION_HISTORY_MAX_VERSIONS`,
        pruning drops the oldest closed row on each save, so the same
        integer can refer to different rows before and after a PUT. Use
        :meth:`current_live_transaction_id` for a stable identifier.
        """
        count = VersionDAO._get_version_count(model_cls, entity_id)
        return count - 1 if count > 0 else None

    @staticmethod
    def current_live_transaction_id(model_cls: type, entity_id: int) -> Optional[int]:
        """Return the Continuum ``transaction_id`` of the live row for
        *entity_id* — stable across retention pruning, unlike the index
        returned by :meth:`current_version_number`.
        """
        ver_cls = version_class(model_cls)
        row = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == entity_id)
            .filter(ver_cls.end_transaction_id.is_(None))
            .order_by(ver_cls.transaction_id.desc())
            .limit(1)
            .first()
        )
        return row[0] if row else None

    @staticmethod
    def current_live_version_uuid(
        model_cls: type, entity_id: int, entity_uuid: UUID
    ) -> Optional[UUID]:
        """Return the deterministic ``version_uuid`` of the live row, or
        ``None`` when the entity has no version rows yet."""
        tx_id = VersionDAO.current_live_transaction_id(model_cls, entity_id)
        if tx_id is None:
            return None
        return derive_version_uuid(entity_uuid, tx_id)

    @staticmethod
    def prune_versions(model_cls: type, entity_id: int) -> None:
        """Delete the oldest version row(s) when the history exceeds the
        configured retention limit.

        The live version row (``end_transaction_id IS NULL``) is never pruned.
        Pruning is best-effort; failures are logged and silently ignored so
        that the calling commit listener is not disrupted.

        Uses a fresh engine connection so it is safe to call from an
        ``after_commit`` session event (where the session has no active
        transaction).
        """
        from flask import current_app  # pylint: disable=import-outside-toplevel

        from superset.extensions import db  # pylint: disable=import-outside-toplevel

        max_versions: int = current_app.config.get(
            "SUPERSET_VERSION_HISTORY_MAX_VERSIONS", 25
        )

        ver_cls = version_class(model_cls)
        ver_tbl = ver_cls.__table__

        try:
            # Use engine.begin() (auto-commits on context exit) since this may
            # be called from an after_commit listener where the session has no
            # active transaction.
            with db.engine.begin() as conn:
                count: int = (
                    conn.execute(
                        sa.select(sa.func.count()).where(ver_tbl.c.id == entity_id)
                    ).scalar()
                    or 0
                )

                excess = count - max_versions
                if excess <= 0:
                    return

                # Oldest non-live rows by transaction_id ascending.
                oldest_tx_ids = (
                    conn.execute(
                        sa.select(ver_tbl.c.transaction_id)
                        .where(
                            ver_tbl.c.id == entity_id,
                            ver_tbl.c.end_transaction_id.is_not(None),
                        )
                        .order_by(ver_tbl.c.transaction_id.asc())
                        .limit(excess)
                    )
                    .scalars()
                    .all()
                )

                if oldest_tx_ids:
                    conn.execute(
                        sa.delete(ver_tbl).where(
                            ver_tbl.c.id == entity_id,
                            ver_tbl.c.transaction_id.in_(oldest_tx_ids),
                        )
                    )
                    # Drop this entity's change records for the pruned txs too
                    # (T052 item d). The DB-level FK on version_changes is
                    # ON DELETE CASCADE against version_transaction, but we
                    # don't delete the tx row here (it may be shared across
                    # entities), so the cascade doesn't fire for us. Explicit
                    # per-(entity_kind, entity_id) delete keeps other entities'
                    # records on the same tx intact.
                    from superset.versioning.changes import (  # noqa: E402
                        _ENTITY_KIND_BY_CLASS_NAME,
                        version_changes_table,
                    )

                    entity_kind = _ENTITY_KIND_BY_CLASS_NAME.get(model_cls.__name__)
                    if entity_kind is not None:
                        try:
                            conn.execute(
                                sa.delete(version_changes_table).where(
                                    version_changes_table.c.entity_kind == entity_kind,
                                    version_changes_table.c.entity_id == entity_id,
                                    version_changes_table.c.transaction_id.in_(
                                        oldest_tx_ids
                                    ),
                                )
                            )
                        except Exception:  # pylint: disable=broad-except
                            # version_changes table missing (pre-migration) —
                            # don't block the shadow-row prune.
                            logger.debug(
                                "prune_versions: change-record cleanup skipped"
                                " for %s id=%s",
                                model_cls.__name__,
                                entity_id,
                            )
        except Exception:  # pylint: disable=broad-except
            logger.exception(
                "prune_versions: failed for %s id=%s",
                model_cls.__name__,
                entity_id,
            )

    @staticmethod
    def list_change_records_batch(
        entity_kind: str,
        entity_id: int,
        transaction_ids: list[int],
    ) -> dict[int, list[dict[str, Any]]]:
        """Return ``version_changes`` rows keyed by ``transaction_id``.

        Batches the lookup across multiple transactions with a single
        ``WHERE transaction_id IN (...) AND entity_kind = ? AND entity_id = ?``
        query so the list endpoint avoids N+1 round-trips. Rows are
        distributed into per-tx lists sorted by ``sequence`` ascending
        (matching the replay order the diff engine emits). Missing
        transactions are represented by an empty list in the result
        so callers can use ``result.get(tx_id, [])`` without guarding.

        If the ``version_changes`` table is missing (pre-migration or
        freshly downgraded), returns an empty dict rather than
        propagating the error — consistent with this being a
        descriptive layer that should not break the list endpoint.
        """
        # pylint: disable=import-outside-toplevel
        from superset.versioning.changes import version_changes_table

        if not transaction_ids:
            return {}

        try:
            rows = (
                db.session.connection()
                .execute(
                    sa.select(
                        version_changes_table.c.transaction_id,
                        version_changes_table.c.sequence,
                        version_changes_table.c.kind,
                        version_changes_table.c.path,
                        version_changes_table.c.from_value,
                        version_changes_table.c.to_value,
                    )
                    .where(
                        version_changes_table.c.entity_kind == entity_kind,
                        version_changes_table.c.entity_id == entity_id,
                        version_changes_table.c.transaction_id.in_(transaction_ids),
                    )
                    .order_by(
                        version_changes_table.c.transaction_id.asc(),
                        version_changes_table.c.sequence.asc(),
                    )
                )
                .mappings()
                .all()
            )
        except sa.exc.OperationalError:
            return {}

        grouped: dict[int, list[dict[str, Any]]] = {tx: [] for tx in transaction_ids}
        for row in rows:
            grouped[row["transaction_id"]].append(
                {
                    "kind": row["kind"],
                    "path": row["path"],
                    "from_value": row["from_value"],
                    "to_value": row["to_value"],
                }
            )
        return grouped

    @staticmethod
    def list_versions(
        model_cls: type,
        entity_uuid: UUID,
    ) -> Optional[list[dict[str, Any]]]:
        """Return the version history for the entity identified by *entity_uuid*.

        Returns ``None`` when no active entity matches the UUID — callers should
        translate that into a 404. Returns an empty list when the entity exists
        but has no version rows yet (pre-migration, or never edited).

        The list is ordered by ``transaction_id`` ascending and each entry is
        assigned a 0-based sequential ``version_number``. ``operation_type`` is
        mapped from Continuum's integer constants to a string (``0`` → baseline,
        ``1`` → update, ``2`` → delete). ``changed_by`` is the User row keyed
        off ``version_transaction.user_id``, or ``None`` when the save had no
        Flask user context (CLI, import, etc.).
        """
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import versioning_manager

        from superset import security_manager

        entity = VersionDAO._find_active_entity_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

        ver_cls = version_class(model_cls)
        ver_tbl = ver_cls.__table__
        tx_tbl = versioning_manager.transaction_cls.__table__
        user_tbl = security_manager.user_model.__table__

        # Left-join version → transaction → user so we can pull the acting
        # user alongside each version row in a single query.
        #
        # Order by ``(operation_type != 0, transaction_id)`` so any op=0 row
        # — either Continuum's INSERT or our synthetic baseline — sorts to
        # version_number 0 regardless of its transaction_id. A single
        # entity never has more than one op=0 row (Continuum only tracks
        # one creation per live entity; our baseline listener only fires
        # when no prior version rows exist), so this gives a stable
        # chronological order with the "original" version always first.
        stmt = (
            sa.select(
                ver_tbl.c.transaction_id,
                ver_tbl.c.operation_type,
                tx_tbl.c.issued_at,
                user_tbl.c.id.label("user_id"),
                user_tbl.c.username,
                user_tbl.c.first_name,
                user_tbl.c.last_name,
            )
            .select_from(
                ver_tbl.join(tx_tbl, ver_tbl.c.transaction_id == tx_tbl.c.id).outerjoin(
                    user_tbl, tx_tbl.c.user_id == user_tbl.c.id
                )
            )
            .where(ver_tbl.c.id == entity.id)
            .order_by(
                (ver_tbl.c.operation_type != 0).asc(),
                ver_tbl.c.transaction_id.asc(),
            )
        )

        rows = db.session.execute(stmt).mappings().all()

        op_type_label = {0: "baseline", 1: "update", 2: "delete"}

        # Batch-load change records for every listed transaction in one
        # query, then distribute per-tx (T050). ``entity_kind`` is
        # derived from the model class via the mapping in
        # ``superset.versioning.changes`` so the API filter
        # ``WHERE entity_kind = 'chart' AND entity_id = ?`` can be
        # precise when multiple versioned entities share a flush.
        # pylint: disable=import-outside-toplevel
        from superset.versioning.changes import _ENTITY_KIND_BY_CLASS_NAME

        entity_kind = _ENTITY_KIND_BY_CLASS_NAME.get(model_cls.__name__)
        tx_ids = [row["transaction_id"] for row in rows]
        changes_by_tx = (
            VersionDAO.list_change_records_batch(entity_kind, entity.id, tx_ids)
            if entity_kind is not None
            else {}
        )

        result: list[dict[str, Any]] = []
        for version_number, row in enumerate(rows):
            changed_by: Optional[dict[str, Any]]
            if row["user_id"] is None:
                changed_by = None
            else:
                changed_by = {
                    "id": row["user_id"],
                    "username": row["username"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                }

            result.append(
                {
                    "version_uuid": derive_version_uuid(
                        entity_uuid, row["transaction_id"]
                    ),
                    "version_number": version_number,
                    "transaction_id": row["transaction_id"],
                    "operation_type": op_type_label.get(
                        row["operation_type"], str(row["operation_type"])
                    ),
                    "issued_at": row["issued_at"],
                    "changed_by": changed_by,
                    "changes": changes_by_tx.get(row["transaction_id"], []),
                }
            )

        return result

    @staticmethod
    def resolve_version_uuid(
        model_cls: type, entity_uuid: UUID, version_uuid: UUID
    ) -> Optional[int]:
        """Translate a ``version_uuid`` into the 0-based ``version_number``
        that :meth:`restore_version` accepts, or ``None`` when the UUID does
        not match any version row of the given entity.

        Ordering matches :meth:`list_versions` — op=0 rows first, then by
        transaction_id — so the version_number returned here is the same
        index a client would see in the list response.
        """
        entity = VersionDAO._find_active_entity_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

        ver_cls = version_class(model_cls)
        tx_ids = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == entity.id)
            .order_by(
                (ver_cls.operation_type != 0).asc(),
                ver_cls.transaction_id.asc(),
            )
            .all()
        )
        for version_number, (tx_id,) in enumerate(tx_ids):
            if derive_version_uuid(entity_uuid, tx_id) == version_uuid:
                return version_number
        return None

    # Per-model relationships that Continuum's Reverter should recurse into.
    # Keys are model class names (__name__); values are the relationship
    # attribute names on the live class.
    #
    # Empty for every versioned model because the native Reverter can't
    # recurse safely here:
    #
    # * ``Dashboard.slices`` is excluded from Continuum versioning (see
    #   ADR-004 and the ``__versioned__['exclude']`` lists), so no
    #   ``dashboard_slices_version`` table exists for the Reverter to
    #   consult. Passing ``relations=["slices"]`` crashes in Continuum with
    #   an ``AttributeError`` on ``association_version_table``. Chart
    #   associations are not restored — follow-up work (transaction-replay
    #   per ADR-004).
    # * ``SqlaTable.columns`` / ``metrics`` hit ADR-004 Failure 1
    #   (``InvalidRequestError: Instance has been deleted`` from flush
    #   ordering) plus the ``override_columns`` deduplication problem.
    #   Instead, ``restore_version`` runs a custom path
    #   (:meth:`_restore_dataset_children`) that works from the version
    #   tables directly.
    _RESTORE_RELATIONS: dict[str, list[str]] = {
        "SqlaTable": [],
        "Dashboard": [],
        "Slice": [],
    }

    @staticmethod
    def get_version(
        model_cls: type,
        entity_uuid: UUID,
        version_uuid: UUID,
    ) -> Optional[dict[str, Any]]:
        """Return the entity's state at the specified version as a dict.

        Read-only — nothing in the live database is modified. The returned
        shape is intended to mirror a regular single-entity GET response
        (scalar columns plus restored ``columns`` / ``metrics`` lists for
        ``SqlaTable``), with a ``_version`` key holding the version-level
        metadata (uuid, transaction_id, operation_type, issued_at,
        changed_by) so callers can tell which version they're looking at.

        Returns ``None`` when either *entity_uuid* or *version_uuid* does
        not match — callers should translate to 404.
        """
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import versioning_manager

        from superset import security_manager
        from superset.connectors.sqla.models import SqlaTable

        entity = VersionDAO._find_active_entity_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

        version_num = VersionDAO.resolve_version_uuid(
            model_cls, entity_uuid, version_uuid
        )
        if version_num is None:
            return None

        ver_cls = version_class(model_cls)
        ver_tbl = ver_cls.__table__
        tx_tbl = versioning_manager.transaction_cls.__table__
        user_tbl = security_manager.user_model.__table__

        # Fetch the version row + its transaction metadata + acting user.
        stmt = (
            sa.select(
                ver_tbl,
                tx_tbl.c.issued_at,
                user_tbl.c.id.label("_user_id"),
                user_tbl.c.username,
                user_tbl.c.first_name,
                user_tbl.c.last_name,
            )
            .select_from(
                ver_tbl.join(tx_tbl, ver_tbl.c.transaction_id == tx_tbl.c.id).outerjoin(
                    user_tbl, tx_tbl.c.user_id == user_tbl.c.id
                )
            )
            .where(ver_tbl.c.id == entity.id)
            .order_by(
                (ver_tbl.c.operation_type != 0).asc(),
                ver_tbl.c.transaction_id.asc(),
            )
            .offset(version_num)
            .limit(1)
        )
        row = db.session.execute(stmt).mappings().first()
        if row is None:
            return None

        # Project the entity's own scalar fields, skipping versioning
        # metadata columns.
        meta_cols = {"transaction_id", "end_transaction_id", "operation_type"}
        result: dict[str, Any] = {}
        for col in ver_tbl.columns:
            if col.name in meta_cols:
                continue
            value = row[col.name]
            # uuid columns come back as UUID instances; make them JSON-safe.
            if isinstance(value, UUID):
                value = str(value)
            result[col.name] = value

        op_type_label = {0: "baseline", 1: "update", 2: "delete"}
        changed_by: Optional[dict[str, Any]]
        if row["_user_id"] is None:
            changed_by = None
        else:
            changed_by = {
                "id": row["_user_id"],
                "username": row["username"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
            }
        # pylint: disable=import-outside-toplevel
        from superset.versioning.changes import _ENTITY_KIND_BY_CLASS_NAME

        entity_kind = _ENTITY_KIND_BY_CLASS_NAME.get(model_cls.__name__)
        changes = (
            VersionDAO.list_change_records_batch(
                entity_kind, entity.id, [row["transaction_id"]]
            ).get(row["transaction_id"], [])
            if entity_kind is not None
            else []
        )
        result["_version"] = {
            "version_uuid": str(version_uuid),
            "version_number": version_num,
            "transaction_id": row["transaction_id"],
            "operation_type": op_type_label.get(
                row["operation_type"], str(row["operation_type"])
            ),
            "issued_at": row["issued_at"],
            "changed_by": changed_by,
            "changes": changes,
        }

        # For datasets, attach the JSON snapshot's columns/metrics so the
        # caller gets a full point-in-time view without mutating live
        # state. Empty lists when no snapshot exists for this tx (e.g. a
        # version predating the snapshot feature).
        if model_cls is SqlaTable:
            target_tx = row["transaction_id"]
            snapshot = db.session.execute(
                sa.text(
                    "SELECT columns_json, metrics_json "
                    "FROM dataset_snapshots "
                    "WHERE dataset_id = :dataset_id AND transaction_id = :tx"
                ),
                {"dataset_id": entity.id, "tx": target_tx},
            ).first()
            if snapshot is None:
                result["columns"] = []
                result["metrics"] = []
            else:
                result["columns"] = _coerce_snapshot_list(snapshot[0])
                result["metrics"] = _coerce_snapshot_list(snapshot[1])

        return result

    @staticmethod
    def restore_version(
        model_cls: type,
        entity_uuid: UUID,
        version_num: int,
    ) -> Optional[Any]:
        """Restore the entity identified by *entity_uuid* to the state captured
        by *version_num* (0-based, as returned by :meth:`list_versions`).

        Returns the live entity after the restore, or ``None`` when either the
        UUID does not match an active entity or ``version_num`` is out of
        range — callers should translate both to a 404.

        Uses SQLAlchemy-Continuum's native ``version_obj.revert(relations=...)``
        and delegates commit to the caller (expected to be a command decorated
        with ``@transaction()``). The ``relations`` list depends on the model
        type and is looked up in :attr:`_RESTORE_RELATIONS`.

        Audit fields on the live entity (``created_on/by_fk``,
        ``changed_on/by_fk``) are left untouched so the new version row
        produced by the restoring commit reflects the restoring user rather
        than the original author. See :data:`RESTORE_EXCLUDE_FIELDS`.
        """
        entity = VersionDAO._find_active_entity_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

        ver_cls = version_class(model_cls)

        # version_num is a 0-based positional index, matching what
        # ``list_versions`` emits. Ordering keeps op=0 rows first so
        # position 0 is always the baseline/INSERT.
        target_version = (
            db.session.query(ver_cls)
            .filter(ver_cls.id == entity.id)
            .order_by(
                (ver_cls.operation_type != 0).asc(),
                ver_cls.transaction_id.asc(),
            )
            .offset(version_num)
            .limit(1)
            .first()
        )
        if target_version is None:
            return None

        relations = VersionDAO._RESTORE_RELATIONS.get(model_cls.__name__, [])
        target_version.revert(relations=relations)

        # Continuum's revert() copies *every* versioned column from the
        # snapshot onto the live entity, including changed_on and
        # changed_by_fk. That leaves the audit trail showing the *original*
        # author, not the user who just performed the restore. Overwrite
        # those two fields with current values so the resulting version row
        # attributes the restore to the right user. created_on /
        # created_by_fk are intentionally left alone — they continue to
        # reflect when/who first created the entity.
        VersionDAO._stamp_audit_fields_for_restore(entity)

        # Datasets: column/metric children are excluded from Continuum's
        # native recursion (see _RESTORE_RELATIONS comment) and are rebuilt
        # below via direct SQL.
        if model_cls.__name__ == "SqlaTable":
            VersionDAO._restore_dataset_children(entity, target_version.transaction_id)
        # Dashboards: chart membership (dashboard_slices m:n) is rebuilt
        # from the JSON snapshot captured at the target tx. Tags, owners,
        # and roles are out of v1 scope (ADR-005).
        if model_cls.__name__ == "Dashboard":
            VersionDAO._restore_dashboard_children(
                entity, target_version.transaction_id
            )

        return entity

    @staticmethod
    def _stamp_audit_fields_for_restore(entity: Any) -> None:
        """Overwrite ``changed_on`` / ``changed_by_fk`` on *entity* with the
        current time and current user id, so that the restore is attributed
        to the restoring user rather than the version snapshot's original
        author."""
        # pylint: disable=import-outside-toplevel
        from datetime import datetime

        from superset.utils.core import get_user_id

        if hasattr(entity, "changed_on"):
            entity.changed_on = datetime.now()
        if hasattr(entity, "changed_by_fk"):
            entity.changed_by_fk = get_user_id()

    @staticmethod
    def _restore_dataset_children(dataset: Any, target_tx: int) -> None:
        """Rebuild a dataset's ``TableColumn`` and ``SqlMetric`` rows from
        the JSON snapshot captured at *target_tx*.

        Reads the single ``dataset_snapshots`` row keyed on
        ``(dataset_id, transaction_id)``, defensive-filters each column and
        metric dict against the currently-live table schema (so additions
        in the current schema get DB defaults; removals are silently
        dropped), then inside ``no_autoflush`` wipes the dataset's children
        and re-inserts them with auto-assigned PKs. Column identity across
        the restore is carried by the natural keys (``column_name`` /
        ``metric_name``).

        Silently no-ops if no snapshot exists for the target tx (e.g.
        restoring a version predating this feature).
        """
        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlMetric, TableColumn

        snapshot = db.session.execute(
            sa.text(
                "SELECT columns_json, metrics_json, snapshot_version "
                "FROM dataset_snapshots "
                "WHERE dataset_id = :dataset_id AND transaction_id = :tx"
            ),
            {"dataset_id": dataset.id, "tx": target_tx},
        ).first()

        if snapshot is None:
            logger.info(
                "No dataset_snapshots row for dataset_id=%s tx=%s; "
                "children left as-is during restore.",
                dataset.id,
                target_tx,
            )
            return

        columns_payload = _coerce_snapshot_list(snapshot[0])
        metrics_payload = _coerce_snapshot_list(snapshot[1])

        with db.session.no_autoflush:
            VersionDAO._apply_snapshot_children(
                dataset=dataset,
                child_cls=TableColumn,
                rows=columns_payload,
            )
            VersionDAO._apply_snapshot_children(
                dataset=dataset,
                child_cls=SqlMetric,
                rows=metrics_payload,
            )

    @staticmethod
    def _parse_slice_ids_json(raw: Any) -> list[int]:
        """Normalise ``dashboard_snapshots.slice_ids_json`` into a ``list[int]``.

        The driver may return the JSON as a pre-parsed list (PostgreSQL
        ``JSONB``) or as a string (SQLite ``JSON``). Strings that aren't
        integer-like are dropped silently.
        """
        parsed: list[Any]
        if isinstance(raw, str):
            # pylint: disable=import-outside-toplevel
            from superset.utils import json as superset_json

            try:
                decoded = superset_json.loads(raw)
            except Exception:  # pylint: disable=broad-except
                decoded = []
            parsed = decoded if isinstance(decoded, list) else []
        elif isinstance(raw, list):
            parsed = raw
        else:
            parsed = []

        result: list[int] = []
        for item in parsed:
            if isinstance(item, int):
                result.append(item)
            elif isinstance(item, str) and item.lstrip("-").isdigit():
                result.append(int(item))
        return result

    @staticmethod
    def _apply_dashboard_slices(dashboard: Any, slice_ids: list[int]) -> None:
        """Wipe ``dashboard_slices`` for *dashboard* and re-insert one row
        per chart id in *slice_ids*, all via raw SQL inside
        ``no_autoflush``."""
        with db.session.no_autoflush:
            # Expunge ORM children that reference this dashboard so a
            # subsequent ORM access doesn't surface stale collection state.
            for slc in list(getattr(dashboard, "slices", []) or []):
                if slc in db.session:
                    db.session.expunge(slc)

            conn = db.session.connection()
            conn.execute(
                sa.text(
                    "DELETE FROM dashboard_slices WHERE dashboard_id = :dashboard_id"
                ),
                {"dashboard_id": dashboard.id},
            )
            for slice_id in slice_ids:
                conn.execute(
                    sa.text(
                        "INSERT INTO dashboard_slices "
                        "(dashboard_id, slice_id) "
                        "VALUES (:dashboard_id, :slice_id)"
                    ),
                    {"dashboard_id": dashboard.id, "slice_id": slice_id},
                )

    @staticmethod
    def _restore_dashboard_children(dashboard: Any, target_tx: int) -> None:
        """Re-attach the chart set captured at *target_tx* to *dashboard*.

        Reads ``dashboard_snapshots.slice_ids_json`` for the target
        transaction, wipes the dashboard's current ``dashboard_slices``
        rows, and re-inserts one row per surviving chart ID. Chart IDs
        that no longer resolve to an active ``Slice`` (hard-deleted, or
        soft-deleted once sc-103157 lands) are silently skipped.

        Silently no-ops if no snapshot exists for the target tx (e.g.
        restoring a version predating this feature).
        """
        # pylint: disable=import-outside-toplevel
        from superset.models.slice import Slice

        snapshot = db.session.execute(
            sa.text(
                "SELECT slice_ids_json "
                "FROM dashboard_snapshots "
                "WHERE dashboard_id = :dashboard_id AND transaction_id = :tx"
            ),
            {"dashboard_id": dashboard.id, "tx": target_tx},
        ).first()

        if snapshot is None:
            logger.info(
                "No dashboard_snapshots row for dashboard_id=%s tx=%s; "
                "chart associations left as-is during restore.",
                dashboard.id,
                target_tx,
            )
            return

        slice_ids = VersionDAO._parse_slice_ids_json(snapshot[0])

        # Filter to charts that still exist. Soft-delete filtering will
        # come in via the standard visibility path once sc-103157 lands.
        if slice_ids:
            live_ids = {
                row[0]
                for row in db.session.execute(
                    sa.select(Slice.id).where(Slice.id.in_(slice_ids))
                ).all()
            }
        else:
            live_ids = set()
        valid_ids = [sid for sid in slice_ids if sid in live_ids]

        VersionDAO._apply_dashboard_slices(dashboard, valid_ids)

    @staticmethod
    def _apply_snapshot_children(
        dataset: Any,
        child_cls: Any,
        rows: list[dict[str, Any]],
    ) -> None:
        """Wipe *dataset*'s children of *child_cls* and re-INSERT from
        snapshot *rows*. Skips the primary key (DB auto-assigns) and any
        snapshot field that no longer exists in the live schema. Stamps
        the restoring user into ``changed_on`` / ``changed_by_fk``.
        """
        # pylint: disable=import-outside-toplevel
        from datetime import datetime

        from superset.utils.core import get_user_id

        child_live_tbl: sa.Table = child_cls.__table__
        live_cols = {c.name: c for c in child_live_tbl.columns}
        # Defensive schema filter: drop snapshot keys that aren't in the
        # live table (renames/removals). New columns on the live table
        # that aren't in the snapshot get DB defaults.
        skip_cols = {"id", "table_id"}

        # Expunge current ORM children so the subsequent direct-SQL DELETE
        # doesn't leave them as stale session state.
        tablename: str = child_cls.__tablename__
        current_children = (
            list(dataset.columns)
            if tablename == "table_columns"
            else list(dataset.metrics)
        )
        for child in current_children:
            if child in db.session:
                db.session.expunge(child)

        conn = db.session.connection()
        conn.execute(
            child_live_tbl.delete().where(child_live_tbl.c.table_id == dataset.id)
        )

        now = datetime.now()
        restoring_user_id = get_user_id()

        for row in rows:
            values: dict[str, Any] = {}
            for key, value in row.items():
                if key in skip_cols:
                    continue
                if key not in live_cols:
                    continue
                values[key] = _deserialize_snapshot_value(live_cols[key], value)

            # Always link to the live parent and stamp the restoring user.
            values["table_id"] = dataset.id
            if "changed_on" in live_cols:
                values["changed_on"] = now
            if "changed_by_fk" in live_cols:
                values["changed_by_fk"] = restoring_user_id

            conn.execute(child_live_tbl.insert().values(**values))
