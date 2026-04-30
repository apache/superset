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
"""Capture listener for ``version_changes`` (T048).

Two session events cooperate:

- ``before_flush``: for each versioned entity in ``session.dirty``,
  reads the pre-save scalar state from the DB via raw SQL inside
  ``session.no_autoflush`` (same idiom as the baseline listener, not
  Continuum's internal ``units_of_work`` which is a private API), reads
  the post-save state from the in-memory ORM object, calls the diff
  engine, and buffers the resulting :class:`ChangeRecord` list on
  ``session.info``. This must run before the flush because after the
  flush the DB already reflects the post-state; we can't recover the
  pre-state from it.

- ``after_flush``: drains the buffer, resolves the current Continuum
  transaction id via ``versioning_manager.units_of_work``, and bulk-
  inserts one ``version_changes`` row per record with a monotonic
  ``sequence`` number. Records accumulated across multiple before_flush
  calls within one transaction share the same ``transaction_id`` and
  contiguous sequence numbers.

Scope in this iteration:
  - Slice, Dashboard, SqlaTable **scalar fields** (via
    :func:`scalar_fields_for` — new columns are picked up automatically
    without editing this module).
  - ``Slice.params`` kind-classification (filter / metric / time_range /
    color_palette / dimension, plus generic ``field`` fallback).

Deferred to T048b:
  - Dataset children (TableColumn / SqlMetric) — requires reading the
    prior ``dataset_snapshots`` row for pre-state and the just-written
    snapshot for post-state, which depends on listener ordering with
    :func:`superset.versioning.dataset_snapshots.register_dataset_snapshot_listener`.
  - Dashboard chart membership (``dashboard_slices``) — same pattern
    against ``dashboard_snapshots``.

``session.new`` entities are not processed in this listener:
operation_type=0 transactions (baseline capture and first-save INSERTs)
produce zero change records per spec §Clarifications 2026-04-24.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from superset.utils import json as _superset_json
from superset.versioning.diff import (
    ChangeRecord,
    diff_dashboard,
    diff_dashboard_slices,
    diff_dataset,
    diff_dataset_columns,
    diff_dataset_metrics,
    diff_slice,
    scalar_fields_for,
)

logger = logging.getLogger(__name__)

# Declared against the shared Model.metadata so integration tests that
# build schema via ``metadata.create_all()`` pick it up without the
# Alembic migration running. Mirrors the shape of the T046 migration
# (``e1f3c5a7b9d0_add_version_changes_table``) byte-for-byte. Typed
# columns (``sa.JSON`` for path / values) are required so the
# connection's bulk-insert path marshals Python lists/dicts into JSON
# — a lightweight ``sa.table(...)`` would not carry the type info and
# SQLite's driver would reject the ``list`` as an unsupported bind.
_metadata = Model.metadata  # pylint: disable=no-member

version_changes_table = sa.Table(
    "version_changes",
    _metadata,
    sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
    # ``transaction_id`` references ``version_transaction.id`` at the DB
    # level only — the FK + ON DELETE CASCADE live in the Alembic
    # migration. Declaring the FK here would fail to resolve at Table
    # creation time because ``version_transaction`` is built
    # dynamically by SQLAlchemy-Continuum at mapper-configuration time;
    # integration tests that materialise schema via ``metadata.create_all``
    # before Continuum runs would hit ``NoReferencedTableError``. Same
    # pattern as ``dataset_snapshots`` and ``dashboard_snapshots``.
    sa.Column("transaction_id", sa.BigInteger, nullable=False),
    sa.Column("entity_kind", sa.String(32), nullable=False),
    sa.Column("entity_id", sa.Integer, nullable=False),
    sa.Column("sequence", sa.SmallInteger, nullable=False),
    sa.Column("kind", sa.String(32), nullable=False),
    sa.Column("path", sa.JSON, nullable=False),
    sa.Column("from_value", sa.JSON, nullable=True),
    sa.Column("to_value", sa.JSON, nullable=True),
    sa.UniqueConstraint(
        "transaction_id",
        "entity_kind",
        "entity_id",
        "sequence",
        name="uq_version_changes_tx_entity_sequence",
    ),
    sa.Index("ix_version_changes_kind", "kind"),
    sa.Index("ix_version_changes_transaction_id", "transaction_id"),
    sa.Index("ix_version_changes_entity", "entity_kind", "entity_id"),
    extend_existing=True,
)

# Mapping from Python class name to the ``entity_kind`` value written
# to ``version_changes.entity_kind``. The API filters change records
# by this value (``WHERE entity_kind = 'chart'`` for the chart history
# endpoint, etc.) — kept short and user-facing-ish so downstream tools
# consuming the raw table read sensibly.
_ENTITY_KIND_BY_CLASS_NAME: dict[str, str] = {
    "Slice": "chart",
    "Dashboard": "dashboard",
    "SqlaTable": "dataset",
}

# Key under which the pending-records buffer is stored on ``session.info``.
# Using ``session.info`` (SQLAlchemy's user-data dict) avoids the need
# for a module-level WeakKeyDictionary and keeps buffers naturally scoped
# to the session's lifetime.
_BUFFER_KEY = "_version_changes_pending"

# Key for the set of Continuum transaction ids whose change records
# have already been written in this session. ``after_flush`` can fire
# more than once for a single transaction (e.g. autoflush triggered by
# a mid-commit query), and our child-diff path reads snapshot tables
# that don't care about the buffer state — without this marker we'd
# re-insert the same child records on the second flush and hit the
# UNIQUE(transaction_id, entity_kind, entity_id, sequence) constraint.
_PROCESSED_TXS_KEY = "_version_changes_processed_txs"

# Per-model-class cache of the scalar-field set. Populated lazily on
# first save of a model. Reading from ``__table__.columns`` is cheap
# but not free; memoising keeps the save-path overhead budget (FR-021)
# from slowly growing with the set of distinct model classes seen.
_SCALAR_FIELDS_CACHE: dict[type, frozenset[str]] = {}


def _cached_scalar_fields(model_cls: type) -> frozenset[str]:
    """Cached wrapper around :func:`scalar_fields_for`."""
    if model_cls not in _SCALAR_FIELDS_CACHE:
        # ``Slice.params`` is walked by ``diff_slice_params`` for kind
        # promotion; emitting it as one opaque ``field`` change would
        # defeat that and flood the log with meaningless records.
        # ``last_saved_at`` / ``last_saved_by_fk`` are stamped by
        # ``UpdateChartCommand`` on every chart save; they're audit
        # noise (same shape as ``changed_on`` / ``changed_by_fk``) and
        # don't carry user-authored signal.
        # ``Dashboard.json_metadata`` and ``position_json`` are JSON
        # blobs walked structurally by ``diff_json_field`` (one record
        # per changed top-level key); the raw scalar diff would emit
        # one giant multi-KB record per save and swamp the response.
        special: frozenset[str] = frozenset()
        audit: frozenset[str] = frozenset()
        if model_cls.__name__ == "Slice":
            special = frozenset({"params"})
            audit = frozenset({"last_saved_at", "last_saved_by_fk"})
        elif model_cls.__name__ == "Dashboard":
            special = frozenset({"json_metadata", "position_json"})
        _SCALAR_FIELDS_CACHE[model_cls] = scalar_fields_for(
            model_cls, special=special, audit=audit
        )
    return _SCALAR_FIELDS_CACHE[model_cls]


def _jsonable(value: Any) -> Any:
    """Convert a column value into a JSON-serialisable form.

    Mirrors the helper in :mod:`superset.versioning.dataset_snapshots`:
    Slice has ``last_saved_at`` (datetime), datasets have datetime
    columns, and any of these fields can land in ``from_value`` /
    ``to_value`` of a ``version_changes`` row, which is a JSON column.
    Python's default JSON encoder rejects ``datetime`` / ``UUID`` /
    ``bytes``, so the whole bulk insert fails if a single record
    carries one. Convert to ISO / hex / str at record-construction time.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return value


def _orm_to_post_state(obj: Any) -> dict[str, Any]:
    """Serialise an ORM object's column attributes to a plain dict.

    We only read declared column attributes — not relationships or
    hybrid properties — because the diff engine operates on scalar
    values per its documented API. Values are passed through
    :func:`_jsonable` so the dict is JSON-safe end-to-end.
    """
    state = sa.inspect(obj)
    return {
        col.key: _jsonable(getattr(obj, col.key)) for col in state.mapper.column_attrs
    }


def _read_pre_state(
    session: Session, model_cls: type, entity_id: int
) -> dict[str, Any] | None:
    """Read the entity's pre-flush row directly from the DB.

    Uses ``session.no_autoflush`` + a raw connection execute — the same
    pattern as ``register_baseline_listener`` — to avoid a re-entrant
    flush that would apply the pending edit before we've captured the
    pre-state.

    Returns ``None`` if the row is missing (shouldn't happen for a
    dirty existing object, but defensive against race conditions).
    """
    table = model_cls.__table__  # type: ignore[attr-defined]
    with session.no_autoflush:
        result = (
            session.connection()
            .execute(sa.select(table).where(table.c.id == entity_id))
            .mappings()
            .one_or_none()
        )
    if result is None:
        return None
    # Convert non-JSON-safe types (datetime, UUID, bytes) to strings so
    # both sides of the diff compare on the same form and any value
    # that ends up in ``from_value`` / ``to_value`` is acceptable to
    # the JSON column on insert.
    return {key: _jsonable(value) for key, value in dict(result).items()}


def _compute_records_for_entity(session: Session, obj: Any) -> list[ChangeRecord]:
    """Diff the pre-state (from DB) against the post-state (in memory).

    Dispatches to :func:`diff_slice` / :func:`diff_dashboard` /
    :func:`diff_dataset` based on the model class name — string-based
    dispatch is used to keep this module free of hard imports on the
    three entity classes, which in turn avoids import-order coupling
    at app-init time.
    """
    model_cls = type(obj)
    entity_id = getattr(obj, "id", None)
    if entity_id is None:
        return []

    try:
        pre_state = _read_pre_state(session, model_cls, entity_id)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: pre-state read failed for %s id=%s",
            model_cls.__name__,
            entity_id,
        )
        return []

    if pre_state is None:
        return []

    post_state = _orm_to_post_state(obj)
    fields = _cached_scalar_fields(model_cls)

    name = model_cls.__name__
    if name == "Slice":
        return diff_slice(pre_state, post_state, fields=fields)
    if name == "Dashboard":
        return diff_dashboard(pre_state, post_state, fields=fields)
    if name == "SqlaTable":
        return diff_dataset(pre_state, post_state, fields=fields)
    return []


def _bulk_insert_records(
    session: Session,
    transaction_id: int,
    buffered: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Insert ``version_changes`` rows for one transaction via raw SQL.

    Uses the module-level :data:`version_changes_table` Table object
    (which carries JSON column types, unlike ``sa.table(...)``) so the
    connection marshals ``path`` / ``from_value`` / ``to_value`` Python
    structures into JSON on insert. Skips the ORM flush round that
    ``session.bulk_insert_mappings`` would cost inside an already-
    active flush.

    ``buffered`` is a dict keyed on ``(entity_kind, entity_id)`` so
    records for one entity — scalars from ``before_flush`` plus
    children collected in ``after_flush`` — merge naturally under the
    same key. ``sequence`` resets per entity so each entity's records
    form a self-contained replay sequence.
    """
    if not buffered:
        return
    rows = []
    for (entity_kind, entity_id), records in buffered.items():
        for seq, r in enumerate(records):
            rows.append(
                {
                    "transaction_id": transaction_id,
                    "entity_kind": entity_kind,
                    "entity_id": entity_id,
                    "sequence": seq,
                    "kind": r.kind,
                    "path": r.path,
                    "from_value": r.from_value,
                    "to_value": r.to_value,
                }
            )
    if rows:
        session.connection().execute(version_changes_table.insert(), rows)


def _coerce_json_list(raw: Any) -> list[Any]:
    """JSON columns come back as either a parsed list or a string
    depending on dialect (SQLite returns str for JSON; Postgres JSONB
    returns the parsed value). Normalise to a Python list.
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = _superset_json.loads(raw)
        except Exception:  # pylint: disable=broad-except
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _dataset_child_records_for_tx(
    session: Session, transaction_id: int
) -> dict[int, list[ChangeRecord]]:
    """Compute column + metric diff records for each dataset that has
    a ``dataset_snapshots`` row written for ``transaction_id``.

    Pre-state comes from the most recent ``dataset_snapshots`` row
    strictly before ``transaction_id``; post-state from the current-tx
    row. When no prior row exists (first save of a pre-existing
    dataset that was brought under versioning, or first create under
    versioning), the entity's child set is being captured for the
    first time — no diff records emit (consistent with M4's
    "baseline = zero records" rule at the child level).
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.dataset_snapshots import dataset_snapshots_table

    try:
        current_rows = (
            session.connection()
            .execute(
                sa.select(
                    dataset_snapshots_table.c.dataset_id,
                    dataset_snapshots_table.c.columns_json,
                    dataset_snapshots_table.c.metrics_json,
                ).where(dataset_snapshots_table.c.transaction_id == transaction_id)
            )
            .mappings()
            .all()
        )
    except sa.exc.OperationalError:
        return {}

    result: dict[int, list[ChangeRecord]] = {}
    for row in current_rows:
        dataset_id = row["dataset_id"]
        prior = (
            session.connection()
            .execute(
                sa.select(
                    dataset_snapshots_table.c.columns_json,
                    dataset_snapshots_table.c.metrics_json,
                )
                .where(dataset_snapshots_table.c.dataset_id == dataset_id)
                .where(dataset_snapshots_table.c.transaction_id < transaction_id)
                .order_by(dataset_snapshots_table.c.transaction_id.desc())
                .limit(1)
            )
            .mappings()
            .first()
        )
        if prior is None:
            continue
        records: list[ChangeRecord] = []
        records.extend(
            diff_dataset_columns(
                _coerce_json_list(prior["columns_json"]),
                _coerce_json_list(row["columns_json"]),
            )
        )
        records.extend(
            diff_dataset_metrics(
                _coerce_json_list(prior["metrics_json"]),
                _coerce_json_list(row["metrics_json"]),
            )
        )
        if records:
            result[dataset_id] = records
    return result


def _dashboard_child_records_for_tx(
    session: Session, transaction_id: int
) -> dict[int, list[ChangeRecord]]:
    """Compute chart-membership diff records for each dashboard that
    has a ``dashboard_snapshots`` row written for ``transaction_id``.

    Same pre/post logic as :func:`_dataset_child_records_for_tx`.
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.dashboard_snapshots import dashboard_snapshots_table

    try:
        current_rows = (
            session.connection()
            .execute(
                sa.select(
                    dashboard_snapshots_table.c.dashboard_id,
                    dashboard_snapshots_table.c.slice_ids_json,
                ).where(dashboard_snapshots_table.c.transaction_id == transaction_id)
            )
            .mappings()
            .all()
        )
    except sa.exc.OperationalError:
        return {}

    result: dict[int, list[ChangeRecord]] = {}
    for row in current_rows:
        dashboard_id = row["dashboard_id"]
        prior = (
            session.connection()
            .execute(
                sa.select(dashboard_snapshots_table.c.slice_ids_json)
                .where(dashboard_snapshots_table.c.dashboard_id == dashboard_id)
                .where(dashboard_snapshots_table.c.transaction_id < transaction_id)
                .order_by(dashboard_snapshots_table.c.transaction_id.desc())
                .limit(1)
            )
            .mappings()
            .first()
        )
        if prior is None:
            continue
        records = diff_dashboard_slices(
            _coerce_json_list(prior["slice_ids_json"]),
            _coerce_json_list(row["slice_ids_json"]),
        )
        if records:
            result[dashboard_id] = records
    return result


# Sentinel attribute set on the session target after first successful
# registration. Subsequent calls become no-ops. Storing the flag on the
# target itself (rather than module-level state) keeps the guard
# naturally scoped — a fresh session proxy gets a fresh registration —
# and avoids the TOCTOU race between ``event.contains`` and
# ``event.listen`` that a module-level ref would have under concurrent
# init. In test fixtures that instantiate multiple Superset apps per
# process, the shared ``db.session`` carries the sentinel and re-entry
# is correctly deduped.
_REGISTERED_SENTINEL = "_versioning_change_listener_registered"


def _process_dirty_entity_into_buffer(
    session: Session,
    obj: Any,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Compute scalar change records for one dirty entity + append to buffer."""
    entity_kind = _ENTITY_KIND_BY_CLASS_NAME.get(type(obj).__name__)
    if entity_kind is None:
        return
    entity_id = getattr(obj, "id", None)
    if entity_id is None:
        return
    try:
        records = _compute_records_for_entity(session, obj)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: diff failed for %s id=%s",
            type(obj).__name__,
            entity_id,
        )
        return
    if records:
        buffer.setdefault((entity_kind, entity_id), []).extend(records)


def _append_child_records_to_buffer(
    session: Session,
    tx_id: int,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Compute dataset + dashboard child-collection records + append to buffer.

    Runs in ``after_flush`` so the snapshot tables have the current-tx
    rows. The signal "this entity needs child diffing" is "a snapshot
    row exists for this tx" — more robust than relying on
    ``session.dirty`` to include the parent when only children moved.
    """
    try:
        for dataset_id, records in _dataset_child_records_for_tx(
            session, tx_id
        ).items():
            buffer.setdefault(("dataset", dataset_id), []).extend(records)
        for dashboard_id, records in _dashboard_child_records_for_tx(
            session, tx_id
        ).items():
            buffer.setdefault(("dashboard", dashboard_id), []).extend(records)
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_changes: child-diff failed for tx %s", tx_id)


def register_change_record_listener() -> None:
    """Attach the before_flush + after_flush listeners.

    Registered from :class:`superset.initialization.SupersetAppInitializer`
    (``init_versioning``) alongside the baseline, dataset-snapshot,
    and dashboard-snapshot listeners. Must run after Continuum's
    ``make_versioned()`` so the ``versioning_manager`` is available
    and has installed its own before_flush hook.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import db
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    if getattr(db.session, _REGISTERED_SENTINEL, False):
        return

    versioned_classes: tuple[type, ...] = (Dashboard, Slice, SqlaTable)

    def compute_change_records(
        session: Session, _flush_context: Any, _instances: Any
    ) -> None:
        # session.info persists across before_flush/after_flush within
        # a single transaction. The buffer is keyed on
        # ``(entity_kind, entity_id)`` so scalar records captured here
        # and child records captured in after_flush (T048b) merge
        # under the same entity without duplication.
        buffer: dict[tuple[str, int], list[ChangeRecord]] = session.info.setdefault(
            _BUFFER_KEY, {}
        )
        for obj in list(session.dirty):
            if isinstance(obj, versioned_classes):
                _process_dirty_entity_into_buffer(session, obj, buffer)

    def flush_change_records(session: Session, _flush_context: Any) -> None:
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import versioning_manager

        buffer: dict[tuple[str, int], list[ChangeRecord]] = session.info.setdefault(
            _BUFFER_KEY, {}
        )

        uow = versioning_manager.units_of_work.get(session.connection())
        if uow is None or uow.current_transaction is None:
            session.info[_BUFFER_KEY] = {}
            return

        tx_id = uow.current_transaction.id

        # Skip if we've already written records for this tx (after_flush
        # can fire more than once per commit — e.g. autoflush from a
        # mid-commit query, snapshot listeners that themselves flush).
        # Without this guard the child-diff path would re-read the same
        # snapshot pair and re-emit the same records, tripping the
        # UNIQUE(transaction_id, entity_kind, entity_id, sequence)
        # constraint on insert.
        processed: set[int] = session.info.setdefault(_PROCESSED_TXS_KEY, set())
        if tx_id in processed:
            return

        _append_child_records_to_buffer(session, tx_id, buffer)

        if not buffer:
            session.info[_BUFFER_KEY] = {}
            processed.add(tx_id)
            return

        try:
            _bulk_insert_records(session, tx_id, buffer)
        except OperationalError:
            # version_changes table missing (migration not yet applied).
            pass
        except Exception:  # pylint: disable=broad-except
            logger.exception(
                "version_changes: bulk insert failed for tx %s (%d entities)",
                tx_id,
                len(buffer),
            )
        finally:
            session.info[_BUFFER_KEY] = {}
            processed.add(tx_id)

    def reset_processed_after_commit(session: Session) -> None:
        # ``_PROCESSED_TXS_KEY`` accumulates Continuum tx ids whose change
        # records have already been written, to dedup against multiple
        # ``after_flush`` firings within one transaction. After commit
        # the tx is closed and its id will never recur on this session
        # — drop the set so a long-lived session (Celery worker, CLI)
        # doesn't grow it without bound.
        session.info.pop(_PROCESSED_TXS_KEY, None)

    event.listen(db.session, "before_flush", compute_change_records)
    event.listen(db.session, "after_flush", flush_change_records)
    event.listen(db.session, "after_commit", reset_processed_after_commit)
    setattr(db.session, _REGISTERED_SENTINEL, True)
