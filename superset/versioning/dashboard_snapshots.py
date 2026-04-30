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
"""Capture a JSON snapshot of a dashboard's attached chart IDs on every
commit that touches the dashboard.

Mirrors ``superset.versioning.dataset_snapshots`` for the dashboard m:n
``dashboard_slices`` relation. Each row stores the set of ``slice_id``
values attached at a given Continuum ``transaction_id``; restore reads
the snapshot, wipes current associations for the dashboard, and
re-inserts from JSON (skipping any chart that has since been
hard-deleted).

Tags, owners, and roles are intentionally not captured — see ADR-005.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SNAPSHOT_VERSION = 1

_metadata = Model.metadata  # pylint: disable=no-member

# Core Table declaration so the ORM metadata knows about dashboard_snapshots.
# Integration tests build schema from metadata; without this the table is
# only present in the Alembic migration and tests that exercise restore
# hit "no such table" on SQLite.
dashboard_snapshots_table = sa.Table(
    "dashboard_snapshots",
    _metadata,
    sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
    sa.Column(
        "dashboard_id",
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
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
    sa.Column("slice_ids_json", sa.JSON, nullable=False),
    sa.Column("created_on", sa.DateTime, nullable=True),
    sa.Column(
        "created_by_fk",
        sa.Integer,
        sa.ForeignKey("ab_user.id"),
        nullable=True,
    ),
    sa.UniqueConstraint(
        "dashboard_id",
        "transaction_id",
        name="uq_dashboard_snapshots_dashboard_tx",
    ),
    sa.Index("ix_dashboard_snapshots_dashboard_id", "dashboard_id"),
    sa.Index("ix_dashboard_snapshots_transaction_id", "transaction_id"),
    extend_existing=True,
)


def _dump_json(value: Any) -> str:
    """Stable JSON dump for snapshot columns."""
    # pylint: disable=import-outside-toplevel
    from superset.utils import json as superset_json

    return superset_json.dumps(value, sort_keys=True, default=str)


def _read_slice_ids(conn: Any, dashboard_id: int) -> list[int]:
    """Return the current list of ``slice_id`` values attached to
    *dashboard_id* via raw SQL, ordered deterministically."""
    result = conn.execute(
        sa.text(
            "SELECT slice_id FROM dashboard_slices "
            "WHERE dashboard_id = :dashboard_id "
            "ORDER BY slice_id"
        ),
        {"dashboard_id": dashboard_id},
    )
    return [int(row[0]) for row in result if row[0] is not None]


def _capture_if_dashboard(
    session: Session, dashboard: Any, transaction_id: int
) -> None:
    """Serialize *dashboard*'s current chart-ID set and upsert a row into
    ``dashboard_snapshots`` for the given ``transaction_id``.

    Chart IDs are read via raw SQL (not ``dashboard.slices``) so the
    snapshot reflects real DB state even when the ORM relationship
    collection is stale — matching the dataset_snapshots convention.
    """
    # pylint: disable=import-outside-toplevel
    from superset.utils.core import get_user_id

    conn = session.connection()
    slice_ids = _read_slice_ids(conn, dashboard.id)
    # Skip writing a snapshot for an empty chart set. A dashboard with no
    # attached charts is not a meaningful version; this most commonly
    # happens during fixture teardowns that delete all attached slices —
    # where the parent is left dirty via a collection-only side-effect.
    if not slice_ids:
        return

    conn.execute(
        sa.text(
            "DELETE FROM dashboard_snapshots "
            "WHERE dashboard_id = :dashboard_id AND transaction_id = :tx"
        ),
        {"dashboard_id": dashboard.id, "tx": transaction_id},
    )
    conn.execute(
        sa.text(
            "INSERT INTO dashboard_snapshots "
            "(dashboard_id, transaction_id, snapshot_version, "
            " slice_ids_json, created_on, created_by_fk) "
            "VALUES (:dashboard_id, :tx, :sv, :ids, :now, :user)"
        ),
        {
            "dashboard_id": dashboard.id,
            "tx": transaction_id,
            "sv": SNAPSHOT_VERSION,
            "ids": _dump_json(slice_ids),
            "now": datetime.now(),
            "user": get_user_id(),
        },
    )


def register_dashboard_snapshot_listener() -> None:
    """Attach the after_flush listener that captures dashboard snapshots.

    Must be called after Continuum's ``make_versioned`` has run and after
    ``db.session`` is available.
    """
    # pylint: disable=import-outside-toplevel
    from superset.extensions import db
    from superset.models.dashboard import Dashboard

    @event.listens_for(db.session, "after_flush")
    def capture_dashboard_snapshots(session: Session, _flush_context: Any) -> None:
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import versioning_manager

        uow = versioning_manager.units_of_work.get(session.connection())
        if uow is None or uow.current_transaction is None:
            return
        tx_id = uow.current_transaction.id

        # Candidates = any Dashboard that's new or dirty in this flush.
        # ``_capture_if_dashboard`` skips writing an empty-slices
        # snapshot, which keeps fixture teardown flushes from clobbering
        # legitimate snapshots.
        candidates = [
            obj
            for obj in list(session.dirty) + list(session.new)
            if isinstance(obj, Dashboard)
        ]

        for dashboard in candidates:
            if dashboard.id is None:
                continue
            try:
                _capture_if_dashboard(session, dashboard, tx_id)
            except Exception:  # pylint: disable=broad-except
                logger.exception(
                    "dashboard_snapshots: capture failed for dashboard id=%s",
                    getattr(dashboard, "id", None),
                )
