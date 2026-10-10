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
"""Per-entity child-baseline handlers.

After a parent baseline row lands in :mod:`.insertion`, this module's
handlers write the parent's child baselines under the same transaction
id. The dispatch table :data:`CHILD_BASELINE_HANDLERS` is keyed on
the parent class name (avoids an import-cycle with the entity modules,
which can't be loaded at app-init time).

The dataset handler baselines :class:`TableColumn` and
:class:`SqlMetric` children. The dashboard handler baselines the
``dashboard_slices`` M2M membership *and* synthesizes
``operation_type=0`` rows in ``slices_version`` for attached slices
that have no prior shadow — without those slice-side baselines,
Continuum's M2M revert query returns empty.

Leaf-level helpers (:func:`_insert_child_baseline_rows`,
:func:`_baseline_attached_slices`,
:func:`_insert_synthetic_slice_baseline`) live here too — they're
shared between the two parent-specific handlers.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session

from superset.versioning.baseline.shadow import insert_baseline_shadow_row


def _baseline_dataset_children(session: Session, dataset: Any, tx_id: int) -> None:
    """Baseline a dataset's ``TableColumn`` and ``SqlMetric`` children
    under the dataset's baseline tx.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.connectors.sqla.models import SqlMetric, TableColumn

    for child_cls in (TableColumn, SqlMetric):
        _insert_child_baseline_rows(
            session,
            dataset,
            child_cls.__table__,
            version_class(child_cls).__table__,
            "table_id",
            tx_id,
        )


def _baseline_dashboard_children(session: Session, dashboard: Any, tx_id: int) -> None:
    """Baseline a dashboard's ``dashboard_slices`` M2M plus synthesize
    ``operation_type=0`` rows in ``slices_version`` for attached slices
    with no prior shadow.

    Continuum's M2M version-side relationship for ``Dashboard.slices``
    joins through both ``dashboard_slices_version`` AND
    ``slices_version``: the second exists clause filters slices by
    "latest slices_version row with tx <= dashboard.tx". If a slice
    has no slices_version rows at all, that join produces no match
    and ``version_obj.slices`` returns empty — leaving the dashboard
    restore with no slices to append. The synthetic slice baseline at
    this dashboard's tx gives the M2M query a slice version it can match.

    Doesn't try to be clever about slices shared across dashboards: a
    slice is baselined at this dashboard's tx_id only when it has no
    shadow rows at all. If a later dashboard baseline references the
    same slice, this baseline (now at lower tx) is still found by
    that dashboard's restore. The reverse — a dashboard baselined
    AFTER the slice was first baselined under another dashboard at
    a higher tx — is a residual gap deferred to a future fix.
    """
    metadata = type(dashboard).__table__.metadata
    live_tbl = metadata.tables.get("dashboard_slices")
    shadow_tbl = metadata.tables.get("dashboard_slices_version")
    if live_tbl is None or shadow_tbl is None:
        return

    _insert_child_baseline_rows(
        session, dashboard, live_tbl, shadow_tbl, "dashboard_id", tx_id
    )
    _baseline_attached_slices(session, dashboard, live_tbl, tx_id)


# Dispatch table keyed by parent CLASS NAME rather than class, to avoid
# the import-cycle between baseline.py (loaded at app init) and the
# entity modules. The class-name string is set once at app start by
# the model definitions — typo-prone if extended. Declared after the
# handlers it references because module-level dict literals evaluate
# at import time and need the names already bound.
_ChildBaselineHandler = Callable[[Session, Any, int], None]
CHILD_BASELINE_HANDLERS: dict[str, _ChildBaselineHandler] = {
    "SqlaTable": _baseline_dataset_children,
    "Dashboard": _baseline_dashboard_children,
}


def _insert_child_baseline_rows(
    session: Session,
    parent_obj: Any,
    child_table: sa.Table,
    child_version_table: sa.Table,
    fk_column_name: str,
    tx_id: int,
) -> None:
    """Synthesize ``operation_type=0`` shadow rows for every live child of
    *parent_obj* under transaction id *tx_id*.

    Parallels :func:`~superset.versioning.baseline.insertion._insert_baseline_row`
    but iterates over child rows. Used to give Continuum's ``Reverter``
    baseline data for children of pre-existing parents (children that
    predate this commit have no shadow rows otherwise, so Reverter
    would treat them as "deleted at the target tx" and try to remove
    them on revert — the ADR-004 Failure 1 reproduction scenario).

    :param child_table: the live child SQLAlchemy ``Table`` (e.g.
        ``TableColumn.__table__`` or the bare ``dashboard_slices`` association)
    :param child_version_table: the corresponding Continuum shadow ``Table``
    :param fk_column_name: column on *child_table* that points to the parent
        (e.g. ``"table_id"`` for ``TableColumn``, ``"dashboard_id"`` for
        ``dashboard_slices``)
    """
    conn = session.connection()
    fk_col = getattr(child_table.c, fk_column_name)

    rows = (
        conn.execute(sa.select(child_table).where(fk_col == parent_obj.id))
        .mappings()
        .all()
    )
    if not rows:
        return

    for row in rows:
        insert_baseline_shadow_row(conn, child_version_table, row, tx_id)


def _baseline_attached_slices(
    session: Session, dashboard: Any, live_tbl: sa.Table, tx_id: int
) -> None:
    """Insert ``operation_type=0`` rows in ``slices_version`` for each
    slice attached to *dashboard* that has no shadow row yet.

    Batched: one membership SELECT, one existing-shadow SELECT, one live
    SELECT for the missing slices. Per-slice work happens only on
    ``_insert_synthetic_slice_baseline``. The previous per-slice
    ``COUNT(*)`` + ``SELECT`` pattern was O(N) round-trips and surfaced
    as a measurable first-save hotspot on dashboards with many charts.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    slice_ver_table = version_class(Slice).__table__
    slice_table = Slice.__table__
    conn = session.connection()

    attached_slice_ids = [
        r.slice_id
        for r in conn.execute(
            sa.select(live_tbl.c.slice_id).where(
                live_tbl.c.dashboard_id == dashboard.id
            )
        ).all()
    ]
    if not attached_slice_ids:
        return

    existing_shadow_ids = {
        row[0]
        for row in conn.execute(
            sa.select(slice_ver_table.c.id.distinct()).where(
                slice_ver_table.c.id.in_(attached_slice_ids)
            )
        ).all()
    }
    missing_ids = [sid for sid in attached_slice_ids if sid not in existing_shadow_ids]
    if not missing_ids:
        return

    slice_rows = (
        conn.execute(sa.select(slice_table).where(slice_table.c.id.in_(missing_ids)))
        .mappings()
        .all()
    )
    for slice_row in slice_rows:
        _insert_synthetic_slice_baseline(conn, slice_ver_table, slice_row, tx_id)


def _insert_synthetic_slice_baseline(
    conn: Any, slice_ver_table: sa.Table, slice_row: Any, tx_id: int
) -> None:
    insert_baseline_shadow_row(conn, slice_ver_table, slice_row, tx_id)
