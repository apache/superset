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
"""Complete newly captured parent snapshots after an uncaptured write interval."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy_continuum import version_class
from sqlalchemy_continuum.operation import Operation

from superset.versioning.baseline.shadow import CONTINUUM_BOOKKEEPING_COLUMNS


def reconcile_parent_snapshots(session: Session, transaction_id: int) -> None:
    """Complete captured parents after the final flush and semantic audit diff.

    Native capture records changed rows, not complete relationship snapshots.
    Record uncaptured child state at the resumed transaction without inventing
    earlier events. Reconciliation adds no semantic change records for untouched
    children; native edits in the resuming save retain their ordinary diff.
    All writes share the committing connection; failures must abort the save.
    """
    # Deferred because model imports need the initialized application.
    from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
        SqlaTable,
        SqlMetric,
        TableColumn,
    )
    from superset.models.dashboard import (
        Dashboard,  # pylint: disable=import-outside-toplevel
    )

    connection: sa.engine.Connection = session.connection()
    model: type[Any]
    for model in (SqlaTable, Dashboard):
        shadow: sa.Table = version_class(model).__table__
        live: sa.Table = model.__table__
        parent_ids: list[int] = list(
            connection.scalars(
                sa.select(shadow.c.id)
                .join(
                    live,
                    sa.and_(live.c.id == shadow.c.id, live.c.uuid == shadow.c.uuid),
                )
                .where(
                    shadow.c.transaction_id == transaction_id,
                    shadow.c.operation_type != Operation.DELETE,
                )
            )
        )
        if not parent_ids:
            continue
        if model is SqlaTable:
            # One pass per child model over every captured parent: the child
            # shadow key ``(id, transaction_id)`` is global, so a child id that
            # moved between captured parents during the gap must be settled
            # once, not once per parent.
            child: type[Any]
            for child in (TableColumn, SqlMetric):
                _reconcile_children(connection, child, parent_ids, transaction_id)
            continue
        parent_id: int
        for parent_id in parent_ids:
            _reconcile_membership(
                connection, shadow.metadata, parent_id, transaction_id
            )


def _reconcile_children(
    connection: sa.engine.Connection,
    model: type[Any],
    parent_ids: list[int],
    transaction_id: int,
) -> None:
    """Record the complete final child state, closing its prior validity interval.

    Child identity is the child's own ``id``; the shadow key is
    ``(id, transaction_id)`` across every parent. A child id recycled under a
    different captured parent during the gap therefore gets exactly one row
    at this transaction: an INSERT under its new parent, which also closes the
    old parent's open row. The old parent's absence is proved by that closure
    (see ``restore._child_state_provable_at``); the new parent's presence by
    the row itself, whichever parent reconciliation would have met first.
    """
    live: sa.Table = model.__table__
    shadow: sa.Table = version_class(model).__table__
    current: dict[int, dict[str, Any]] = {
        row.id: dict(row._mapping)
        for row in connection.execute(
            sa.select(live).where(live.c.table_id.in_(parent_ids))
        )
    }
    latest: dict[int, dict[str, Any]] = {
        row.id: dict(row._mapping)
        for row in connection.execute(
            sa.select(shadow)
            .where(
                shadow.c.table_id.in_(parent_ids),
                shadow.c.end_transaction_id.is_(None),
            )
            .order_by(shadow.c.transaction_id)
        )
    }
    identifier: int
    for identifier in current.keys() | latest.keys():
        row: dict[str, Any] | None = current.get(identifier)
        prior: dict[str, Any] | None = latest.get(identifier)
        active: bool = prior is not None and prior["operation_type"] != Operation.DELETE
        # A prior row under another parent is that parent's history, not this
        # child's presence under its current parent.
        reassigned: bool = (
            row is not None
            and prior is not None
            and prior["table_id"] != row["table_id"]
        )
        if (
            prior is not None
            and prior["transaction_id"] == transaction_id
            and prior["operation_type"] == Operation.UPDATE
            and not connection.scalar(
                sa.select(
                    sa.exists().where(
                        shadow.c.id == identifier,
                        shadow.c.table_id == prior["table_id"],
                        shadow.c.transaction_id < transaction_id,
                    )
                )
            )
        ):
            # A gap-born child first edited during this save has no same-parent
            # predecessor. INSERT records its first captured presence, allowing
            # older restores to recognize it as absent rather than as a pruned
            # unknown chain.
            connection.execute(
                shadow.update()
                .where(
                    shadow.c.id == identifier,
                    shadow.c.transaction_id == transaction_id,
                )
                .values(operation_type=Operation.INSERT)
            )
            prior["operation_type"] = Operation.INSERT
        if row is None and not active:
            continue
        columns: list[str] = [
            column.name
            for column in shadow.columns
            if column.name not in CONTINUUM_BOOKKEEPING_COLUMNS
        ]
        if (
            row is not None
            and prior is not None
            and active
            and not reassigned
            and all(row[key] == prior[key] for key in columns)
        ):
            continue
        source: dict[str, Any] | None = row if row is not None else prior
        assert source is not None
        kind: int = (
            Operation.DELETE
            if row is None
            else Operation.UPDATE
            if active and not reassigned
            else Operation.INSERT
        )
        values: dict[sa.Column[Any], Any] = {
            column: source[column.name]
            for column in shadow.columns
            if column.name not in CONTINUUM_BOOKKEEPING_COLUMNS
        }
        values[shadow.c.operation_type] = kind
        values[shadow.c.end_transaction_id] = None
        if prior is not None and prior["transaction_id"] == transaction_id:
            connection.execute(
                shadow.update()
                .where(
                    shadow.c.id == identifier,
                    shadow.c.transaction_id == transaction_id,
                )
                .values(values)
            )
        else:
            connection.execute(
                shadow.update()
                .where(
                    shadow.c.id == identifier,
                    shadow.c.end_transaction_id.is_(None),
                    shadow.c.transaction_id < transaction_id,
                )
                .values(end_transaction_id=transaction_id)
            )
            values[shadow.c.transaction_id] = transaction_id
            connection.execute(shadow.insert().values(values))


def _reconcile_membership(
    connection: sa.engine.Connection,
    metadata: sa.MetaData,
    dashboard_id: int,
    transaction_id: int,
) -> None:
    """Record missing association transitions without modifying chart content."""
    live: sa.Table = metadata.tables["dashboard_slices"]
    shadow: sa.Table = metadata.tables["dashboard_slices_version"]
    current: set[int] = set(
        connection.scalars(
            sa.select(live.c.slice_id).where(live.c.dashboard_id == dashboard_id)
        )
    )
    # Reduce history in SQL; the association PK leads with dashboard/slice/tx.
    # Materialize only one effective row per link, not every attachment episode.
    latest_transactions: sa.sql.Subquery = (
        sa.select(shadow.c.slice_id, sa.func.max(shadow.c.transaction_id).label("tx"))
        .where(shadow.c.dashboard_id == dashboard_id)
        .group_by(shadow.c.slice_id)
        .subquery()
    )
    latest: dict[int, int] = {
        row.slice_id: row.operation_type
        for row in connection.execute(
            sa.select(
                shadow.c.slice_id,
                sa.func.max(shadow.c.operation_type).label("operation_type"),
            )
            .join(
                latest_transactions,
                sa.and_(
                    shadow.c.slice_id == latest_transactions.c.slice_id,
                    shadow.c.transaction_id == latest_transactions.c.tx,
                ),
            )
            .where(shadow.c.dashboard_id == dashboard_id)
            .group_by(shadow.c.slice_id)
        )
    }
    identifier: int
    for identifier in current | latest.keys():
        attached: bool = identifier in current
        if attached == (latest.get(identifier) == Operation.INSERT):
            continue
        # Multiple flushes share a transaction; retain only its final membership.
        connection.execute(
            shadow.delete().where(
                shadow.c.dashboard_id == dashboard_id,
                shadow.c.slice_id == identifier,
                shadow.c.transaction_id == transaction_id,
            )
        )
        connection.execute(
            shadow.insert().values(
                dashboard_id=dashboard_id,
                slice_id=identifier,
                transaction_id=transaction_id,
                end_transaction_id=None,
                operation_type=Operation.INSERT if attached else Operation.DELETE,
            )
        )
