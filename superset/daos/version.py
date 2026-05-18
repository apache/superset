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
from superset.versioning.utils import single_flush_scope

logger = logging.getLogger(__name__)

# Fixed UUIDv5 namespace under which per-(entity, transaction) version UUIDs
# are derived. Never change this constant — changing it invalidates every
# version_uuid that clients may have cached, bookmarked, or stored.
VERSION_UUID_NAMESPACE = UUID("7a6f5d9b-4c3b-5d8e-9a1c-0e2b4c6d8f10")


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
    def find_active_by_uuid(
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

        Note: this index is *unstable under retention pruning*. The
        scheduled :func:`prune_old_versions` task drops shadow rows
        whose owning ``version_transaction`` is older than
        :envvar:`SUPERSET_VERSION_HISTORY_RETENTION_DAYS`, so the same
        integer can refer to different rows before and after a prune
        cycle. Use :meth:`current_live_transaction_id` for a stable
        identifier.
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

        entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
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
        entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
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

    # Per-model relationships that Continuum's Reverter recurses into during a
    # restore. Each restore replays the listed relationships from the version-
    # side shadow tables onto the live entity. Children versioned through
    # Continuum (``TableColumn`` / ``SqlMetric`` on ``SqlaTable``;
    # ``dashboard_slices`` M2M on ``Dashboard``) come back automatically;
    # ``Slice`` has no child collections to recurse into so its list is empty.
    _RESTORE_RELATIONS: dict[str, list[str]] = {
        "SqlaTable": ["columns", "metrics"],
        "Dashboard": ["slices"],
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

        entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
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

        # For datasets, attach the columns/metrics as they were at this
        # transaction by reading from Continuum's child shadow tables
        # (``table_columns_version`` / ``sql_metrics_version``). Empty
        # lists when the dataset had no children at this tx.
        if model_cls is SqlaTable:
            # pylint: disable=import-outside-toplevel
            from superset.connectors.sqla.models import SqlMetric, TableColumn
            from superset.versioning.changes import _shadow_rows_valid_at

            target_tx = row["transaction_id"]
            cols_tbl = version_class(TableColumn).__table__
            metrics_tbl = version_class(SqlMetric).__table__
            result["columns"] = _shadow_rows_valid_at(
                db.session, cols_tbl, "table_id", entity.id, target_tx
            )
            result["metrics"] = _shadow_rows_valid_at(
                db.session, metrics_tbl, "table_id", entity.id, target_tx
            )

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

        After the revert, ``changed_on`` / ``changed_by_fk`` are re-stamped
        with the current time and the restoring user's id (see
        :meth:`_stamp_audit_fields_for_restore`) so the new version row
        produced by the restoring commit reflects who clicked Restore,
        not the original author. ``created_on`` / ``created_by_fk`` are
        left alone.
        """
        entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
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

        # Run the whole multi-relationship revert inside a single flush
        # scope so SQLAlchemy-Continuum's ``Reverter`` can iterate
        # relations without tripping its autoflush race, and so the
        # change-records listener sees the complete shadow state in one
        # ``after_flush`` pass. See ``single_flush_scope`` for the full
        # rationale.
        relations = VersionDAO._RESTORE_RELATIONS.get(model_cls.__name__, [])
        try:
            with single_flush_scope(db.session):
                target_version.revert(relations=relations)
        except Exception:
            logger.exception(
                "Continuum revert() failed for %s id=%s tx=%s relations=%s",
                model_cls.__name__,
                entity.id,
                target_version.transaction_id,
                relations,
            )
            raise

        VersionDAO._stamp_audit_fields_for_restore(entity)
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

