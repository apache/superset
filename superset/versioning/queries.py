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
"""Read-side queries for the entity-versioning API.

Pure-read helpers that translate Continuum shadow rows and
``version_changes`` records into the shapes the API endpoints return.
The corresponding write side (restore) ships in a later PR; the
``VersionDAO`` façade in :mod:`superset.daos.version` re-exports the
read helpers here.

Also exposes the deterministic version-UUID derivation
(:data:`VERSION_UUID_NAMESPACE` + :func:`derive_version_uuid`) used by
both the read endpoints and the ETag emission path in
:mod:`superset.versioning.etag`.
"""

from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.versioning.baseline import CONTINUUM_BOOKKEEPING_COLUMNS

# Fixed UUIDv5 namespace under which per-(entity, transaction) version UUIDs
# are derived. Never change this constant — changing it invalidates every
# version_uuid that clients may have cached, bookmarked, or stored.
VERSION_UUID_NAMESPACE = UUID("7a6f5d9b-4c3b-5d8e-9a1c-0e2b4c6d8f10")

# Continuum's integer ``operation_type`` mapped to the string the API
# returns. Kept short and stable for downstream tooling consuming the
# raw response. Continuum guarantees 0/1/2; anything else is a Continuum
# version mismatch and surfaces as ``str(int)`` rather than crashing.
_OP_TYPE_LABELS: dict[int, str] = {0: "baseline", 1: "update", 2: "delete"}


def derive_version_uuid(entity_uuid: UUID, transaction_id: int) -> UUID:
    """Derive a deterministic UUIDv5 identifying one version row.

    The UUID is a function of the owning entity's UUID and the Continuum
    ``transaction_id`` of the version row, so it is stable across retention
    pruning (which never changes ``transaction_id``) and portable across
    replicas. It is not randomly generated — two Supersets with identical
    ``(entity.uuid, transaction_id)`` will compute the same version_uuid.
    """
    return uuid.uuid5(VERSION_UUID_NAMESPACE, f"{entity_uuid}:{transaction_id}")


def _resolve_version_tables(
    model_cls: type[Model],
) -> tuple[sa.Table, sa.Table, sa.Table]:
    """Return the (version, transaction, user) ``Table`` objects used by the
    listing and snapshot queries.

    All three lookups happen inside this module on every read; centralising
    the trio (a) keeps the imports in one place and (b) makes the join helper
    below take a uniform signature.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    from superset import security_manager

    ver_tbl = version_class(model_cls).__table__
    tx_tbl = versioning_manager.transaction_cls.__table__
    user_tbl = security_manager.user_model.__table__
    return ver_tbl, tx_tbl, user_tbl


def _version_with_tx_user_join(
    ver_tbl: sa.Table, tx_tbl: sa.Table, user_tbl: sa.Table
) -> Any:
    """Build the version → transaction → user left-join used by both
    :func:`list_versions` and :func:`get_version`. The user-side join is
    a left-outer so saves with no Flask user context (CLI, Celery, import)
    still surface in the result with ``changed_by = None``.
    """
    return ver_tbl.join(tx_tbl, ver_tbl.c.transaction_id == tx_tbl.c.id).outerjoin(
        user_tbl, tx_tbl.c.user_id == user_tbl.c.id
    )


def _baseline_first_ordering(ver_tbl: sa.Table) -> tuple[Any, ...]:
    """Order ``(operation_type != 0).asc(), transaction_id.asc()`` so any
    op=0 row — Continuum's INSERT or our synthetic baseline — sorts to
    position 0 regardless of its transaction_id. A single entity never has
    more than one op=0 row (Continuum tracks one creation per live entity;
    our baseline listener only fires when no prior version rows exist), so
    this gives a stable chronological order with the "original" version
    always first.
    """
    return (
        (ver_tbl.c.operation_type != 0).asc(),
        ver_tbl.c.transaction_id.asc(),
    )


def _user_select_cols(user_tbl: sa.Table) -> list[Any]:
    """Columns to select from ``user_tbl`` to build a ``changed_by`` dict.
    Labels ``user_tbl.c.id`` as ``"user_id"`` so callers can read the row
    by a stable key regardless of whether they also select the version
    table's ``id`` column.
    """
    return [
        user_tbl.c.id.label("user_id"),
        user_tbl.c.username,
        user_tbl.c.first_name,
        user_tbl.c.last_name,
    ]


def _changed_by_from_row(row: Any) -> dict[str, Any] | None:
    """Project the user columns from a query row onto the API's
    ``changed_by`` shape, or ``None`` for saves with no Flask user context
    (CLI / Celery / import / unauthenticated). Expects the user columns to
    have been selected via :func:`_user_select_cols` so the row keys are
    ``user_id`` / ``username`` / ``first_name`` / ``last_name``.
    """
    if row["user_id"] is None:
        return None
    return {
        "id": row["user_id"],
        "username": row["username"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
    }


def _entity_kind_for(model_cls: type[Model]) -> str | None:
    """Return the ``version_changes.entity_kind`` value for *model_cls*, or
    ``None`` when the class isn't in the change-records taxonomy."""
    # pylint: disable=import-outside-toplevel
    from superset.versioning.changes import ENTITY_KIND_BY_CLASS_NAME

    return ENTITY_KIND_BY_CLASS_NAME.get(model_cls.__name__)


def find_active_by_uuid(model_cls: type[Model], entity_uuid: UUID) -> Any | None:
    """Return the live entity matching *entity_uuid*, or None if not found."""
    return (
        db.session.query(model_cls).filter(model_cls.uuid == entity_uuid).one_or_none()
    )


def _get_version_count(model_cls: type[Model], entity_id: int) -> int:
    """Return the number of historical version rows for *entity_id*."""
    ver_cls = version_class(model_cls)
    return (
        db.session.query(sa.func.count())
        .select_from(ver_cls)
        .filter(ver_cls.id == entity_id)
        .scalar()
        or 0
    )


def current_version_number(model_cls: type[Model], entity_id: int) -> int | None:
    """Return the 0-based ``version_number`` of the live row for *entity_id*
    — equivalent to the index of the most recent entry that
    :func:`list_versions` would return, or ``None`` when the entity has no
    version rows yet.

    Note: this index is *unstable under retention pruning*. The scheduled
    retention task drops shadow rows older than the configured
    retention window, so the same integer can refer to different rows
    before and after a prune cycle. Use
    :func:`current_live_transaction_id` for a stable identifier.
    """
    count = _get_version_count(model_cls, entity_id)
    return count - 1 if count > 0 else None


def current_live_transaction_id(model_cls: type[Model], entity_id: int) -> int | None:
    """Return the Continuum ``transaction_id`` of the live row for
    *entity_id* — stable across retention pruning, unlike the index
    returned by :func:`current_version_number`.
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


def current_live_version_uuid(
    model_cls: type[Model], entity_id: int, entity_uuid: UUID
) -> UUID | None:
    """Return the deterministic ``version_uuid`` of the live row, or
    ``None`` when the entity has no version rows yet."""
    tx_id = current_live_transaction_id(model_cls, entity_id)
    if tx_id is None:
        return None
    return derive_version_uuid(entity_uuid, tx_id)


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
    transactions are represented by an empty list in the result so
    callers can use ``result.get(tx_id, [])`` without guarding.

    If the ``version_changes`` table is missing (pre-migration or
    freshly downgraded), returns an empty dict rather than propagating
    the error — consistent with this being a descriptive layer that
    should not break the list endpoint.
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.changes import version_changes_table

    if not transaction_ids:
        return {}

    # SAVEPOINT so a missing-table failure can't poison the enclosing
    # transaction: on PostgreSQL a failed statement aborts the tx, and
    # every later query in the request would raise InFailedSqlTransaction
    # even though the exception below was caught.
    try:
        with db.session.connection().begin_nested():
            rows = (
                db.session.connection()
                .execute(
                    sa.select(
                        version_changes_table.c.transaction_id,
                        version_changes_table.c.sequence,
                        version_changes_table.c.kind,
                        version_changes_table.c.operation,
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
    except (sa.exc.OperationalError, sa.exc.ProgrammingError):
        # Missing version_changes table: OperationalError on SQLite/MySQL,
        # ProgrammingError (UndefinedTable) on PostgreSQL.
        return {}

    grouped: dict[int, list[dict[str, Any]]] = {tx: [] for tx in transaction_ids}
    for row in rows:
        grouped[row["transaction_id"]].append(
            {
                "kind": row["kind"],
                "operation": row["operation"],
                "path": row["path"],
                "from_value": row["from_value"],
                "to_value": row["to_value"],
            }
        )
    return grouped


def list_versions(
    model_cls: type[Model],
    entity_uuid: UUID,
    *,
    entity: Any | None = None,
) -> list[dict[str, Any]] | None:
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

    Pass *entity* to skip the ``find_active_by_uuid`` lookup when the
    caller has already resolved the entity (API handlers do this to enforce
    ``raise_for_ownership`` before calling here). The skip saves one
    ``WHERE uuid = ?`` query — that lookup isn't identity-map-cacheable
    because ``uuid`` is a unique non-PK column.
    """
    if entity is None:
        entity = find_active_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

    ver_tbl, tx_tbl, user_tbl = _resolve_version_tables(model_cls)
    stmt = (
        sa.select(
            ver_tbl.c.transaction_id,
            ver_tbl.c.operation_type,
            tx_tbl.c.issued_at,
            *_user_select_cols(user_tbl),
        )
        .select_from(_version_with_tx_user_join(ver_tbl, tx_tbl, user_tbl))
        .where(ver_tbl.c.id == entity.id)
        .order_by(*_baseline_first_ordering(ver_tbl))
    )
    rows = db.session.execute(stmt).mappings().all()

    # Batch-load change records for every listed transaction in one query.
    # ``entity_kind`` is derived from the model class so the API
    # filter ``WHERE entity_kind = 'chart' AND entity_id = ?`` can be
    # precise when multiple versioned entities share a flush.
    changes_by_tx: dict[int, list[dict[str, Any]]] = {}
    if (entity_kind := _entity_kind_for(model_cls)) is not None:
        tx_ids = [row["transaction_id"] for row in rows]
        changes_by_tx = list_change_records_batch(entity_kind, entity.id, tx_ids)

    return [
        {
            "version_uuid": derive_version_uuid(entity_uuid, row["transaction_id"]),
            "version_number": version_number,
            "transaction_id": row["transaction_id"],
            "operation_type": _OP_TYPE_LABELS.get(
                row["operation_type"], str(row["operation_type"])
            ),
            "issued_at": row["issued_at"],
            "changed_by": _changed_by_from_row(row),
            "changes": changes_by_tx.get(row["transaction_id"], []),
        }
        for version_number, row in enumerate(rows)
    ]


def resolve_version_uuid(
    model_cls: type[Model],
    entity_uuid: UUID,
    version_uuid: UUID,
    *,
    entity: Any | None = None,
) -> int | None:
    """Translate a ``version_uuid`` into the 0-based ``version_number`` that the
    restore path (ships in a later PR) accepts, or ``None`` when the UUID does
    not match any version row of the given entity.

    Ordering matches :func:`list_versions` — op=0 rows first, then by
    transaction_id — so the version_number returned here is the same index
    a client would see in the list response.

    Implementation note: the loop re-derives ``version_uuid`` per
    transaction in Python because there's no portable SQL form for a
    UUIDv5 derivation across PostgreSQL / MySQL / SQLite (Postgres has
    ``uuid_generate_v5``; the other two do not). The iteration count is
    bounded by the configured retention window worth of edits — the
    retention task ages older shadow rows out — so the
    practical N is at most a few hundred. If retention is ever
    disabled on a heavily-edited entity, this loop is the
    place to revisit.

    Pass *entity* to skip the ``find_active_by_uuid`` lookup; see
    :func:`list_versions` for the rationale.
    """
    if entity is None:
        entity = find_active_by_uuid(model_cls, entity_uuid)
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


def get_version(
    model_cls: type[Model],
    entity_uuid: UUID,
    version_uuid: UUID,
    *,
    entity: Any | None = None,
) -> dict[str, Any] | None:
    """Return the entity's state at the specified version as a dict.

    Read-only — nothing in the live database is modified. The returned
    shape is intended to mirror a regular single-entity GET response
    (scalar columns plus restored ``columns`` / ``metrics`` lists for
    ``SqlaTable``), with a ``_version`` key holding the version-level
    metadata (uuid, transaction_id, operation_type, issued_at,
    changed_by) so callers can tell which version they're looking at.

    Returns ``None`` when either *entity_uuid* or *version_uuid* does not
    match — callers should translate to 404.

    Pass *entity* to skip the ``find_active_by_uuid`` lookup; see
    :func:`list_versions` for the rationale. The same *entity* is threaded
    into :func:`resolve_version_uuid` to eliminate a second redundant
    lookup on the same request.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable

    if entity is None:
        entity = find_active_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None

    version_num = resolve_version_uuid(
        model_cls, entity_uuid, version_uuid, entity=entity
    )
    if version_num is None:
        return None

    ver_tbl, tx_tbl, user_tbl = _resolve_version_tables(model_cls)
    stmt = (
        sa.select(
            ver_tbl,
            tx_tbl.c.issued_at,
            *_user_select_cols(user_tbl),
        )
        .select_from(_version_with_tx_user_join(ver_tbl, tx_tbl, user_tbl))
        .where(ver_tbl.c.id == entity.id)
        .order_by(*_baseline_first_ordering(ver_tbl))
        .offset(version_num)
        .limit(1)
    )
    row = db.session.execute(stmt).mappings().first()
    if row is None:
        return None

    # Project the entity's own scalar fields, skipping versioning
    # metadata columns.
    result: dict[str, Any] = {}
    for col in ver_tbl.columns:
        if col.name in CONTINUUM_BOOKKEEPING_COLUMNS:
            continue
        value = row[col.name]
        # uuid columns come back as UUID instances; make them JSON-safe.
        if isinstance(value, UUID):
            value = str(value)
        result[col.name] = value

    changes: list[dict[str, Any]] = []
    if (entity_kind := _entity_kind_for(model_cls)) is not None:
        changes = list_change_records_batch(
            entity_kind, entity.id, [row["transaction_id"]]
        ).get(row["transaction_id"], [])

    result["_version"] = {
        "version_uuid": str(version_uuid),
        "version_number": version_num,
        "transaction_id": row["transaction_id"],
        "operation_type": _OP_TYPE_LABELS.get(
            row["operation_type"], str(row["operation_type"])
        ),
        "issued_at": row["issued_at"],
        "changed_by": _changed_by_from_row(row),
        "changes": changes,
    }

    # For datasets, attach the columns/metrics as they were at this
    # transaction by reading from Continuum's child shadow tables
    # (``table_columns_version`` / ``sql_metrics_version``). Empty lists
    # when the dataset had no children at this tx.
    if model_cls is SqlaTable:
        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlMetric, TableColumn
        from superset.versioning.changes import shadow_rows_valid_at

        target_tx = row["transaction_id"]
        cols_tbl = version_class(TableColumn).__table__
        metrics_tbl = version_class(SqlMetric).__table__
        result["columns"] = shadow_rows_valid_at(
            db.session, cols_tbl, "table_id", entity.id, target_tx
        )
        result["metrics"] = shadow_rows_valid_at(
            db.session, metrics_tbl, "table_id", entity.id, target_tx
        )

    return result
