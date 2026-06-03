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

Child-collection diffs (dataset ``TableColumn`` / ``SqlMetric``,
dashboard ``dashboard_slices``) read the pre- and post-state from
Continuum shadow tables via :func:`_shadow_rows_valid_at`, executed in
``after_flush`` once Continuum has written its tx-N rows.

``session.new`` entities are not processed in this listener:
operation_type=0 transactions (baseline capture and first-save INSERTs)
produce zero change records per spec §Clarifications 2026-04-24.

**Inline imports.** Several helpers below use ``# pylint: disable=
import-outside-toplevel`` for imports of ``sqlalchemy_continuum`` and
Superset model classes. The reason is uniform with ``baseline.py``:
this module is imported from ``init_versioning()`` before all SQLAlchemy
mappers are configured and before Continuum's ``make_versioned()`` has
finished wiring shadow classes. Top-level imports would either trip an
unresolved-mapper error or create an init-order cycle. The lazy form
defers resolution until the helper runs. Unusual cases (if any are
added) should be commented explicitly.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from superset.versioning.diff import (
    ChangeRecord,
    diff_dashboard,
    diff_dashboard_slices,
    diff_dataset,
    diff_dataset_columns,
    diff_dataset_metrics,
    diff_slice,
    fold_dashboard_layout_with_chart_changes,
    scalar_fields_for,
)
from superset.versioning.utils import read_row_outside_flush

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
    # pattern as the other versioning tables.
    sa.Column("transaction_id", sa.BigInteger, nullable=False),
    sa.Column("entity_kind", sa.String(32), nullable=False),
    sa.Column("entity_id", sa.Integer, nullable=False),
    sa.Column("sequence", sa.SmallInteger, nullable=False),
    sa.Column("kind", sa.String(32), nullable=False),
    sa.Column("operation", sa.String(16), nullable=False),
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

# Key on ``session.info`` that commands set to declare the high-level
# action that produced the current transaction. Read once per flush by
# the change-record listener and stamped onto the
# ``version_transaction.action_kind`` column via ``sa.update()``.
# Recognised values today: ``"restore"`` / ``"import"`` / ``"clone"``.
# ``None`` (the default) means "ordinary save".
#
# Commands set this immediately before ``db.session.commit()``:
#
#     db.session.info["_versioning_action_kind"] = "restore"
#     db.session.commit()
#
# The listener pops the key after stamping, and ``after_commit`` /
# ``after_rollback`` cleanup pop it again as a safety net, so a
# long-lived session can't accidentally carry the value into the next
# transaction.
ACTION_KIND_KEY = "_versioning_action_kind"

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

    Slice has ``last_saved_at`` (datetime), datasets have datetime
    columns, and any of these fields can land in ``from_value`` /
    ``to_value`` of a ``version_changes`` row, which is a JSON column.
    Python's default JSON encoder rejects ``datetime`` / ``UUID`` /
    ``bytes`` / ``Decimal``, so the whole bulk insert fails if a single
    record carries one. Convert to ISO / hex / str at record-construction
    time.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, Decimal):
        # Stringify rather than ``float()`` to preserve precision; the
        # diff engine compares string equality on ``from_value`` /
        # ``to_value``, so coercing both sides to the same form is what
        # matters.
        return str(value)
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
    """Read the entity's pre-flush row directly from the DB and convert
    non-JSON-safe types to strings so both sides of the diff compare on
    the same form. Delegates the autoflush-suppressed read itself to
    :func:`superset.versioning.utils.read_row_outside_flush`.

    Returns ``None`` if the row is missing (shouldn't happen for a dirty
    existing object, but defensive against race conditions).
    """
    table = model_cls.__table__  # type: ignore[attr-defined]
    result = read_row_outside_flush(session, table, entity_id)
    if result is None:
        return None
    # Convert non-JSON-safe types (datetime, UUID, bytes, Decimal) to
    # strings so both sides of the diff compare on the same form and
    # any value that ends up in ``from_value`` / ``to_value`` is
    # acceptable to the JSON column on insert.
    return {key: _jsonable(value) for key, value in result.items()}


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
                    "operation": r.operation,
                    "path": r.path,
                    "from_value": r.from_value,
                    "to_value": r.to_value,
                }
            )
    if rows:
        session.connection().execute(version_changes_table.insert(), rows)


def _shadow_rows_valid_at(
    session: Session,
    shadow_table: sa.Table,
    fk_col_name: str,
    fk_value: int,
    tx: int,
) -> list[dict[str, Any]]:
    """Return the live state of *shadow_table* rows whose FK column
    (``fk_col_name``) equals *fk_value*, as of transaction *tx*.

    Uses Continuum's validity-strategy semantics: a row is "valid at tx"
    when ``transaction_id <= tx`` AND (``end_transaction_id`` IS NULL OR
    ``end_transaction_id`` > tx) AND it isn't a DELETE shadow.

    The returned dicts mirror the live row's column set (no Continuum
    bookkeeping columns), so they can be passed straight to the
    natural-key diff helpers (``diff_dataset_columns`` etc.).
    """
    fk_col = getattr(shadow_table.c, fk_col_name)
    rows = (
        session.connection()
        .execute(
            sa.select(shadow_table).where(
                fk_col == fk_value,
                shadow_table.c.transaction_id <= tx,
                sa.or_(
                    shadow_table.c.end_transaction_id.is_(None),
                    shadow_table.c.end_transaction_id > tx,
                ),
                shadow_table.c.operation_type != 2,
            )
        )
        .mappings()
        .all()
    )
    # Coerce values to JSON-safe forms — raw shadow rows can carry
    # ``UUID``, ``datetime``, ``bytes`` etc. that don't survive the
    # ``version_changes.from_value/to_value`` JSON column write.
    meta_cols = {"transaction_id", "end_transaction_id", "operation_type"}
    return [
        {k: _jsonable(v) for k, v in dict(row).items() if k not in meta_cols}
        for row in rows
    ]


def _affected_dataset_ids_at_tx(session: Session, tx: int) -> set[int]:
    """Datasets touched at *tx* — directly (parent shadow at tx) or
    indirectly (column / metric shadow at tx)."""
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    dataset_ids: set[int] = set()
    parent_tbl = version_class(SqlaTable).__table__
    for row in session.connection().execute(
        sa.select(parent_tbl.c.id).where(parent_tbl.c.transaction_id == tx)
    ):
        dataset_ids.add(row[0])
    for child_cls in (TableColumn, SqlMetric):
        child_tbl = version_class(child_cls).__table__
        for row in session.connection().execute(
            sa.select(child_tbl.c.table_id).where(child_tbl.c.transaction_id == tx)
        ):
            if row[0] is not None:
                dataset_ids.add(row[0])
    return dataset_ids


def _dataset_child_records_for_tx_from_shadows(
    session: Session, transaction_id: int
) -> dict[int, list[ChangeRecord]]:
    """Compute column + metric diff records for each dataset touched at
    *transaction_id*, reading from Continuum shadow tables.

    For each dataset:
    * Post-state = rows valid at ``transaction_id`` in
      ``table_columns_version`` / ``sql_metrics_version``.
    * Pre-state = rows valid at ``transaction_id - 1`` in the same
      shadow tables.

    With Continuum's validity-strategy semantics, "valid at tx N - 1"
    is the state immediately before this transaction's effects (the
    row that gets superseded at tx=N has ``end_transaction_id=N``, so
    it satisfies ``end > N - 1``). Unrelated transactions between this
    dataset's edits are transparent — they don't change validity for
    this dataset's children.

    First-edit case: when there is no prior tx (the dataset's earliest
    shadow IS at *transaction_id*), pre-state is empty. We skip rather
    than emit "Added X" for every column — same "baseline = zero
    records" semantics as the snapshot path.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.connectors.sqla.models import SqlMetric, TableColumn

    cols_tbl = version_class(TableColumn).__table__
    metrics_tbl = version_class(SqlMetric).__table__

    result: dict[int, list[ChangeRecord]] = {}
    for dataset_id in _affected_dataset_ids_at_tx(session, transaction_id):
        # Skip the very first transaction for this dataset (no pre-state).
        prior_tx = (
            session.connection()
            .execute(
                sa.select(sa.func.max(cols_tbl.c.transaction_id)).where(
                    cols_tbl.c.table_id == dataset_id,
                    cols_tbl.c.transaction_id < transaction_id,
                )
            )
            .scalar()
        )
        if prior_tx is None:
            # No prior column shadow — could still be a metric-only edit;
            # check metrics shadow too.
            prior_tx = (
                session.connection()
                .execute(
                    sa.select(sa.func.max(metrics_tbl.c.transaction_id)).where(
                        metrics_tbl.c.table_id == dataset_id,
                        metrics_tbl.c.transaction_id < transaction_id,
                    )
                )
                .scalar()
            )
        if prior_tx is None:
            continue

        post_cols = _shadow_rows_valid_at(
            session, cols_tbl, "table_id", dataset_id, transaction_id
        )
        pre_cols = _shadow_rows_valid_at(
            session, cols_tbl, "table_id", dataset_id, prior_tx
        )
        post_metrics = _shadow_rows_valid_at(
            session, metrics_tbl, "table_id", dataset_id, transaction_id
        )
        pre_metrics = _shadow_rows_valid_at(
            session, metrics_tbl, "table_id", dataset_id, prior_tx
        )

        records: list[ChangeRecord] = []
        records.extend(diff_dataset_columns(pre_cols, post_cols))
        records.extend(diff_dataset_metrics(pre_metrics, post_metrics))
        if records:
            result[dataset_id] = records
    return result


def _affected_dashboard_ids_at_tx(session: Session, tx: int) -> set[int]:
    """Dashboards touched at *tx* — directly (parent shadow at tx) or
    indirectly (slice-membership shadow at tx)."""
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.dashboard import Dashboard

    dashboard_ids: set[int] = set()
    parent_tbl = version_class(Dashboard).__table__
    for row in session.connection().execute(
        sa.select(parent_tbl.c.id).where(parent_tbl.c.transaction_id == tx)
    ):
        dashboard_ids.add(row[0])

    # M2M shadow: ``dashboard_slices_version`` is auto-generated by
    # Continuum and lives in metadata — not a model class. Look it up
    # from the metadata bag rather than via ``version_class``.
    metadata = parent_tbl.metadata
    if (m2m_tbl := metadata.tables.get("dashboard_slices_version")) is not None:
        for row in session.connection().execute(
            sa.select(m2m_tbl.c.dashboard_id).where(m2m_tbl.c.transaction_id == tx)
        ):
            if row[0] is not None:
                dashboard_ids.add(row[0])
    return dashboard_ids


def _dashboard_slice_uuids_at_tx(
    session: Session, dashboard_id: int, tx: int
) -> list[str]:
    """Slice UUIDs attached to *dashboard_id* as of *tx*, read by joining
    ``dashboard_slices_version`` (M2M membership) against
    ``slices_version`` (slice content).

    Joining through both is necessary — and matches the same query
    Continuum's M2M ``Reverter`` uses — because a slice that's
    referenced by the M2M but has no slice-version row at this tx is
    treated as "not yet versioned" and excluded.

    Returns UUIDs (strings) so the result can be diffed by the existing
    :func:`diff_dashboard_slices` helper, which keys on uuid.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    metadata = version_class(Slice).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")
    slices_tbl = version_class(Slice).__table__
    if m2m_tbl is None:
        return []

    rows = (
        session.connection()
        .execute(
            sa.select(slices_tbl.c.uuid).where(
                slices_tbl.c.id == m2m_tbl.c.slice_id,
                m2m_tbl.c.dashboard_id == dashboard_id,
                m2m_tbl.c.transaction_id <= tx,
                sa.or_(
                    m2m_tbl.c.end_transaction_id.is_(None),
                    m2m_tbl.c.end_transaction_id > tx,
                ),
                m2m_tbl.c.operation_type != 2,
                slices_tbl.c.transaction_id <= tx,
                sa.or_(
                    slices_tbl.c.end_transaction_id.is_(None),
                    slices_tbl.c.end_transaction_id > tx,
                ),
                slices_tbl.c.operation_type != 2,
            )
        )
        .all()
    )
    return [str(r[0]) for r in rows if r[0] is not None]


def _dashboard_child_records_for_tx_from_shadows(
    session: Session, transaction_id: int
) -> dict[int, list[ChangeRecord]]:
    """Compute slice-membership diff records for each dashboard touched
    at *transaction_id*, reading from Continuum shadow tables.

    Same pre/post logic as
    :func:`_dataset_child_records_for_tx_from_shadows`.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.dashboard import Dashboard

    metadata = version_class(Dashboard).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")

    result: dict[int, list[ChangeRecord]] = {}
    for dashboard_id in _affected_dashboard_ids_at_tx(session, transaction_id):
        prior_tx = None
        if m2m_tbl is not None:
            prior_tx = (
                session.connection()
                .execute(
                    sa.select(sa.func.max(m2m_tbl.c.transaction_id)).where(
                        m2m_tbl.c.dashboard_id == dashboard_id,
                        m2m_tbl.c.transaction_id < transaction_id,
                    )
                )
                .scalar()
            )
        if prior_tx is None:
            continue

        post_uuids = _dashboard_slice_uuids_at_tx(session, dashboard_id, transaction_id)
        pre_uuids = _dashboard_slice_uuids_at_tx(session, dashboard_id, prior_tx)

        records = diff_dashboard_slices(pre_uuids, post_uuids)
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

    Runs in ``after_flush`` so the shadow tables already have the
    current-tx rows. Reads from Continuum shadow tables
    (``table_columns_version`` / ``sql_metrics_version`` /
    ``dashboard_slices_version`` / ``slices_version``).
    """
    try:
        for dataset_id, records in _dataset_child_records_for_tx_from_shadows(
            session, tx_id
        ).items():
            buffer.setdefault(("dataset", dataset_id), []).extend(records)
        for dashboard_id, records in (
            _dashboard_child_records_for_tx_from_shadows(session, tx_id)
        ).items():
            buffer.setdefault(("dashboard", dashboard_id), []).extend(records)

        # Post-merge fold: when a dashboard save adds/removes charts,
        # drop the redundant ``position_json.*`` records that mirror
        # the membership change. See
        # ``diff.fold_dashboard_layout_with_chart_changes``.
        for key in list(buffer.keys()):
            if key[0] == "dashboard":
                buffer[key] = fold_dashboard_layout_with_chart_changes(buffer[key])
                if not buffer[key]:
                    del buffer[key]
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_changes: child-diff failed for tx %s", tx_id)


def _current_transaction_id(session: Session) -> int | None:
    """Return the Continuum transaction id for *session*'s current unit of
    work, or ``None`` when Continuum has no active transaction (e.g. raw
    SQL execution outside the ORM's flush flow).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    uow = versioning_manager.units_of_work.get(session.connection())
    if uow is None or uow.current_transaction is None:
        return None
    return uow.current_transaction.id


def _stamp_action_kind_on_transaction(session: Session, tx_id: int) -> None:
    """Pop the per-tx action_kind from ``session.info`` and stamp it
    onto the ``version_transaction`` row identified by *tx_id*.

    No-op when no command set the action_kind (the default for
    ordinary saves). Emits via ``sa.update()`` against Continuum's
    transaction Table so the identifier is auto-quoted per dialect
    (MySQL would otherwise reject the unquoted column name if it ever
    collided with a reserved word) and the dialect-portable column
    binding is reused instead of hand-written SQL.

    The action_kind is popped (not just read) so a long-lived session
    can't accidentally carry the value into the next transaction. A
    failed stamp is logged and swallowed — action_kind is a
    descriptive enrichment, not a correctness invariant; refusing to
    write change records because an UPDATE on a single column failed
    would punish the user save for an audit-log nicety.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    action_kind = session.info.pop(ACTION_KIND_KEY, None)
    if action_kind is None:
        return
    tx_tbl = versioning_manager.transaction_cls.__table__
    try:
        session.connection().execute(
            sa.update(tx_tbl)
            .where(tx_tbl.c.id == tx_id)
            .values(action_kind=action_kind)
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: failed to stamp action_kind=%s on tx %s",
            action_kind,
            tx_id,
        )


def _persist_buffered_records(
    session: Session,
    tx_id: int,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Bulk-insert *buffer*'s records under *tx_id* and reset the buffer.

    Catches ``OperationalError`` to handle the pre-migration startup race
    (version_changes table missing), and ``Exception`` as the listener-
    boundary safety net so a malformed record can't crash the user's save.
    """
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


def register_change_record_listener() -> None:  # noqa: C901
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
        buffer: dict[tuple[str, int], list[ChangeRecord]] = session.info.setdefault(
            _BUFFER_KEY, {}
        )

        tx_id = _current_transaction_id(session)
        if tx_id is None:
            session.info[_BUFFER_KEY] = {}
            return

        # Skip if we've already written records for this tx (after_flush
        # can fire more than once per commit — e.g. autoflush from a
        # mid-commit query). Without this guard the child-diff path would
        # re-read the same shadow rows and re-emit the same records,
        # tripping the UNIQUE(transaction_id, entity_kind, entity_id,
        # sequence) constraint on insert.
        processed: set[int] = session.info.setdefault(_PROCESSED_TXS_KEY, set())
        if tx_id in processed:
            return

        # Stamp action_kind eagerly, before the buffer-empty short-
        # circuit. Restores / imports / clones may flush across multiple
        # cycles; the FIRST firing for this tx is the one with the
        # value still on ``session.info``. The helper pops on success
        # so subsequent firings see ``None`` and short-circuit cleanly.
        _stamp_action_kind_on_transaction(session, tx_id)

        _append_child_records_to_buffer(session, tx_id, buffer)

        if not buffer:
            # Don't mark tx as processed when nothing was inserted. A
            # later after_flush firing for the same tx may carry the
            # records — e.g. when an entity's edit lands across two
            # flushes (a child-only flush followed by a parent-dirty
            # flush): the parent shadow only lands in the parent-dirty
            # flush, so the child-diff path can't find a prior tx to
            # compare against until then.
            session.info[_BUFFER_KEY] = {}
            return

        try:
            _persist_buffered_records(session, tx_id, buffer)
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
        # If a command set the action_kind but no flush fired (e.g. a
        # save that touched nothing versioned), the value would
        # otherwise leak into the next transaction. Drop it here as a
        # belt-and-suspenders cleanup; the
        # ``_stamp_action_kind_on_transaction`` helper already pops on
        # the normal path.
        session.info.pop(ACTION_KIND_KEY, None)

    def reset_action_kind_after_rollback(session: Session) -> None:
        # When a command sets ``ACTION_KIND_KEY`` and then an exception
        # fires before flush (e.g. validation error after the key is
        # set), the transaction rolls back without the listener ever
        # popping the key. The next save on the same session would
        # then inherit the stale value and label an unrelated commit
        # as "restore" / "import" / "clone". Pop here so a rolled-back
        # action's intent doesn't leak forward.
        session.info.pop(ACTION_KIND_KEY, None)

    event.listen(db.session, "before_flush", compute_change_records)
    event.listen(db.session, "after_flush", flush_change_records)
    event.listen(db.session, "after_commit", reset_processed_after_commit)
    event.listen(db.session, "after_rollback", reset_action_kind_after_rollback)
    setattr(db.session, _REGISTERED_SENTINEL, True)
