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
"""Shadow-table queries that drive child-collection diffs.

Reads Continuum shadow tables (``table_columns_version`` /
``sql_metrics_version`` / ``dashboard_slices_version`` /
``slices_version``) under the validity-strategy semantics to compute
the pre/post state of child collections at a given transaction. Used
by the change-record listener's ``after_flush`` path once Continuum
has written the current transaction's shadow rows.

**Inline imports.** Continuum's ``version_class`` and the Superset
model classes are imported inside each helper because this package is
loaded from ``init_versioning()`` before all SQLAlchemy mappers are
configured. The deferred imports keep the module-load graph free of
mapper-resolution side effects.
"""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from superset.versioning.activity.kinds import Window

from superset.versioning.baseline import (
    CONTINUUM_BOOKKEEPING_COLUMNS,
    OPERATION_DELETE,
)
from superset.versioning.changes.state import jsonable
from superset.versioning.diff import (
    ChangeRecord,
    diff_dashboard_slices,
    diff_dataset_columns,
    diff_dataset_metrics,
)


def shadow_rows_valid_at(
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
                shadow_table.c.operation_type != OPERATION_DELETE,
            )
        )
        .mappings()
        .all()
    )
    # Coerce values to JSON-safe forms — raw shadow rows can carry
    # ``UUID``, ``datetime``, ``bytes`` etc. that don't survive the
    # ``version_changes.from_value/to_value`` JSON column write.
    return [
        {
            k: jsonable(v)
            for k, v in dict(row).items()
            if k not in CONTINUUM_BOOKKEEPING_COLUMNS
        }
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

        post_cols = shadow_rows_valid_at(
            session, cols_tbl, "table_id", dataset_id, transaction_id
        )
        pre_cols = shadow_rows_valid_at(
            session, cols_tbl, "table_id", dataset_id, prior_tx
        )
        post_metrics = shadow_rows_valid_at(
            session, metrics_tbl, "table_id", dataset_id, transaction_id
        )
        pre_metrics = shadow_rows_valid_at(
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
    session: Session, attached: list[tuple[int, Window]], tx: int
) -> list[str]:
    """Return the uuids of charts attached to a dashboard at *tx*.

    *attached* is :func:`~superset.versioning.membership.charts_attached_to_dashboard`'s
    output — ``(slice_id, window)`` pairs where each window is the chart's
    INSERT/DELETE-paired ``[attach, detach)`` interval — so membership at *tx*
    is simply the charts whose window contains *tx*. The raw association-shadow
    validity predicate (``end_transaction_id IS NULL OR > tx`` +
    ``operation_type != DELETE``) must NOT be used: Continuum never closes
    ``end_transaction_id`` on the M2M association shadow, so a chart attached at
    tx 1 and removed at tx 5 would still read as a member at tx 10 —
    over-reporting membership in the change-record diff (sc-120007, the third
    consumer of this pattern; restore and impact were fixed the same way in
    #44010 / #43837).

    The ``slices_version`` (content) shadow, by contrast, *does* close
    ``end_transaction_id`` correctly, so its validity predicate is trustworthy
    and is kept: a chart attached at *tx* but with no slice-version row at *tx*
    is "not yet versioned" and excluded, matching Continuum's M2M ``Reverter``.
    The read runs on the passed *session* — the committing connection whose
    flushed-but-uncommitted current-tx rows are visible only there.

    Returns UUIDs (strings) so the result can be diffed by the existing
    :func:`diff_dashboard_slices` helper, which keys on uuid.
    """
    attached_ids = {slice_id for slice_id, window in attached if window.contains(tx)}
    if not attached_ids:
        return []

    # pylint: disable=import-outside-toplevel
    # Deferred imports: ``version_class`` / ``Slice`` because this module loads
    # from ``init_versioning()`` before all mappers are configured (see the
    # module docstring); ``activity.kinds`` because it imports
    # ``ENTITY_KIND_BY_CLASS_NAME`` from ``superset.versioning.changes``, so a
    # module-top import would cycle back into this package during the
    # changes-listener bootstrap (activity.kinds → changes → listener →
    # shadow_queries).
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice
    from superset.versioning.activity.kinds import chunked_ids, ENTITY_ID_CHUNK_SIZE

    # Resolve each attached chart's uuid from the content shadow at tx. The id
    # set is a dashboard's simultaneous membership at one tx (realistically
    # dozens), but chunk the IN anyway to stay under SQLite's bind-variable
    # floor, mirroring the sibling impact rollup (#44010).
    slices_tbl = version_class(Slice).__table__
    uuids: list[str] = []
    for chunk in chunked_ids(attached_ids, ENTITY_ID_CHUNK_SIZE):
        rows = (
            session.connection()
            .execute(
                sa.select(slices_tbl.c.uuid).where(
                    slices_tbl.c.id.in_(chunk),
                    slices_tbl.c.transaction_id <= tx,
                    sa.or_(
                        slices_tbl.c.end_transaction_id.is_(None),
                        slices_tbl.c.end_transaction_id > tx,
                    ),
                    slices_tbl.c.operation_type != OPERATION_DELETE,
                )
            )
            .all()
        )
        uuids.extend(str(r[0]) for r in rows if r[0] is not None)
    return uuids


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
    from superset.versioning.membership import charts_attached_to_dashboard

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

        # Resolve the attachment windows once (threading the committing
        # *session* so the flushed-but-uncommitted current-tx association rows
        # are visible), then take the pre/post membership by which windows
        # contain each tx — the windows are tx-independent, so no need to
        # re-scan the association history for both reads.
        attached = charts_attached_to_dashboard(dashboard_id, session=session)
        post_uuids = _dashboard_slice_uuids_at_tx(session, attached, transaction_id)
        pre_uuids = _dashboard_slice_uuids_at_tx(session, attached, prior_tx)

        records = diff_dashboard_slices(pre_uuids, post_uuids)
        if records:
            result[dashboard_id] = records
    return result
