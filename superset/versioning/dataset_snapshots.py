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
"""Capture JSON snapshots of a dataset's ``TableColumn`` and ``SqlMetric``
children on every commit that touches the dataset.

This is a purpose-built replacement for SQLAlchemy-Continuum's shadow-table
child versioning, which proved fragile against Superset's
``override_columns=True`` delete+reinsert pattern. Each snapshot row is
keyed on the ``(dataset_id, transaction_id)`` pair and stores the full
column/metric state at commit time as JSON. Restore is then a direct
wipe-and-reinsert from the snapshot — no validity intervals, no op-types,
no ghost filtering.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SNAPSHOT_VERSION = 1

_metadata = Model.metadata  # pylint: disable=no-member

# Core Table declaration so the ORM metadata knows about dataset_snapshots.
# Integration tests create schema from metadata; without this the table is
# only present in the Alembic migration and tests that exercise restore
# hit "no such table" on SQLite.
dataset_snapshots_table = sa.Table(
    "dataset_snapshots",
    _metadata,
    sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
    sa.Column(
        "dataset_id",
        sa.Integer,
        sa.ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
    ),
    # ``transaction_id`` references ``version_transaction.id`` at the DB
    # level (created by the Alembic migration). The FK is deliberately
    # omitted from this Table declaration because ``version_transaction``
    # is built dynamically by SQLAlchemy-Continuum at mapper-configuration
    # time; declaring the FK here would fail to resolve at Table-creation
    # time in contexts that instantiate the metadata before Continuum has
    # run (e.g. unit tests). The live DB integrity is enforced by the
    # migration.
    sa.Column("transaction_id", sa.BigInteger, nullable=False),
    sa.Column("snapshot_version", sa.Integer, nullable=False, server_default="1"),
    sa.Column("columns_json", sa.JSON, nullable=False),
    sa.Column("metrics_json", sa.JSON, nullable=False),
    sa.Column("created_on", sa.DateTime, nullable=True),
    sa.Column(
        "created_by_fk",
        sa.Integer,
        sa.ForeignKey("ab_user.id"),
        nullable=True,
    ),
    sa.UniqueConstraint(
        "dataset_id",
        "transaction_id",
        name="uq_dataset_snapshots_dataset_tx",
    ),
    sa.Index("ix_dataset_snapshots_dataset_id", "dataset_id"),
    sa.Index("ix_dataset_snapshots_transaction_id", "transaction_id"),
    extend_existing=True,
)


def _jsonable(value: Any) -> Any:
    """Convert ORM column values into JSON-safe forms."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return value


def _serialize_row(instance: Any) -> dict[str, Any]:
    """Return a JSON-safe dict of *instance*'s column values."""
    mapper = sa.inspect(type(instance))
    result: dict[str, Any] = {}
    for col in mapper.columns:
        result[col.key] = _jsonable(getattr(instance, col.key))
    return result


def _read_child_rows(
    conn: Any, child_table: sa.Table, dataset_id: int
) -> list[dict[str, Any]]:
    """Read every row of *child_table* for *dataset_id* directly from the
    database, bypassing any ORM identity-map cache. This ensures the
    snapshot reflects whatever was last written — including rows
    created by non-ORM code paths (e.g. the version restore flow)."""
    result = conn.execute(
        sa.select(child_table).where(child_table.c.table_id == dataset_id)
    ).mappings()
    return [{k: _jsonable(v) for k, v in row.items()} for row in result]


def _capture_if_dataset(session: Session, dataset: Any, transaction_id: int) -> None:
    """Serialize *dataset*'s columns + metrics and upsert a row into
    ``dataset_snapshots`` for the given ``transaction_id``.

    Children are read via raw SQL (not ``dataset.columns`` / ``dataset.metrics``)
    so the snapshot reflects the real DB state even when the ORM
    relationship collection is stale — e.g. immediately after the
    version restore path wipes and re-inserts children through direct
    ``conn.execute()``."""
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlMetric, TableColumn
    from superset.utils.core import get_user_id

    conn = session.connection()
    columns_json = _read_child_rows(conn, TableColumn.__table__, dataset.id)
    metrics_json = _read_child_rows(conn, SqlMetric.__table__, dataset.id)
    # Skip writing a snapshot if both children lists are empty. A dataset
    # with zero columns/metrics is not a meaningful version; this most
    # commonly happens during (a) fixture teardowns that delete all
    # children — where the parent is left dirty via a collection-only
    # side-effect — and (b) autoflushes in the middle of a fixture
    # setup that hasn't appended children yet. In both cases the useful
    # capture happens on a subsequent flush with the real children.
    if not columns_json and not metrics_json:
        return
    # Use raw SQL to stay out of the ORM identity map during after_flush.
    # Upsert pattern: delete any pre-existing snapshot for the same
    # (dataset_id, transaction_id) before insert. Subsequent flushes
    # within the same Continuum transaction overwrite earlier snapshots
    # with the final state.
    conn.execute(
        sa.text(
            "DELETE FROM dataset_snapshots "
            "WHERE dataset_id = :dataset_id AND transaction_id = :tx"
        ),
        {"dataset_id": dataset.id, "tx": transaction_id},
    )
    conn.execute(
        sa.text(
            "INSERT INTO dataset_snapshots "
            "(dataset_id, transaction_id, snapshot_version, "
            " columns_json, metrics_json, created_on, created_by_fk) "
            "VALUES (:dataset_id, :tx, :sv, :cols, :metrics, :now, :user)"
        ),
        {
            "dataset_id": dataset.id,
            "tx": transaction_id,
            "sv": SNAPSHOT_VERSION,
            "cols": _dump_json(columns_json),
            "metrics": _dump_json(metrics_json),
            "now": datetime.now(),
            "user": get_user_id(),
        },
    )


def _dump_json(value: Any) -> str:
    """Stable JSON dump for snapshot columns."""
    # pylint: disable=import-outside-toplevel
    from superset.utils import json as superset_json

    return superset_json.dumps(value, sort_keys=True, default=str)


def register_dataset_snapshot_listener() -> None:
    """Attach the after_flush listener that captures dataset snapshots.

    Must be called after Continuum's ``make_versioned`` has run so the
    versioning_manager has a transaction class, and after
    ``db.session`` is available.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import db

    @event.listens_for(db.session, "after_flush")
    def capture_dataset_snapshots(session: Session, _flush_context: Any) -> None:
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import versioning_manager

        uow = versioning_manager.units_of_work.get(session.connection())
        if uow is None or uow.current_transaction is None:
            # No Continuum transaction — nothing to key the snapshot on.
            return
        tx_id = uow.current_transaction.id

        # Candidates = any SqlaTable that's new or dirty in this flush.
        # ``_capture_if_dataset`` skips writing a snapshot when both
        # children lists are empty, which keeps fixture teardown flushes
        # (parent-dirty-via-collection-only after children were deleted)
        # from clobbering legitimate snapshots.
        candidates = [
            obj
            for obj in list(session.dirty) + list(session.new)
            if isinstance(obj, SqlaTable)
        ]

        for dataset in candidates:
            if dataset.id is None:
                # Shouldn't happen in after_flush, but be safe.
                continue
            try:
                _capture_if_dataset(session, dataset, tx_id)
            except Exception:  # pylint: disable=broad-except
                logger.exception(
                    "dataset_snapshots: capture failed for dataset id=%s",
                    getattr(dataset, "id", None),
                )
