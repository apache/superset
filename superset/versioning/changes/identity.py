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
"""Incarnation-safe identity for dashboard attachment windows."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.engine import Connection


def attachment_uuid_at_tx(
    versions: list[tuple[Any, int, int | None, int]],
    start_tx: int,
    tx: int,
    *,
    live_uuid: Any = None,
    live_created_on: datetime | None = None,
    attached_at: datetime | None = None,
) -> str | None:
    """Pin a window to its opening incarnation, then respect identity boundaries.

    Content edits may leave validity gaps; they do not change membership.
    DELETE or a different UUID ends the incarnation even if a detach witness
    is missing. For a late first content row, the live row's creation time
    must strictly predate attachment. This independent witness prevents a new
    chart from filling an old window after the old shadow chain was pruned.
    Equal/missing timestamps are ambiguous and deliberately not extrapolated.
    """
    rows = sorted(versions, key=lambda row: row[1])
    prior = [row for row in rows if row[1] <= start_tx]
    anchor = prior[-1] if prior else None
    if (
        anchor is None
        or anchor[3] == 2
        or (anchor[2] is not None and anchor[2] <= start_tx)
    ):
        future = next((row for row in rows if row[1] > start_tx), None)
        if (
            future is None
            or future[3] == 2
            or live_uuid is None
            or str(future[0]) != str(live_uuid)
            or live_created_on is None
            or attached_at is None
            or live_created_on >= attached_at
        ):
            return None
        anchor = future
    uuid = anchor[0]
    if uuid is None:
        return None
    if any(start_tx < row[1] <= tx and (row[3] == 2 or row[0] != uuid) for row in rows):
        return None
    return str(uuid)


def attachment_uuids(
    conn: Connection,
    attached: list[tuple[int, int]],
    tx: int,
    *,
    versions_table: sa.Table,
    live_table: sa.Table,
    transactions_table: sa.Table,
    chunk_size: int,
) -> list[str]:
    """Read identity witnesses in bounded queries on the caller's connection.

    ``attached`` contains only windows which contain the target transaction,
    represented as (chart id, attachment transaction). Selecting only identity
    columns keeps chart definitions out of the history scan.
    """
    starts = list({start for _, start in attached})
    issued_at = {}
    for offset in range(0, len(starts), chunk_size):
        issued_at.update(
            conn.execute(
                sa.select(
                    transactions_table.c.id, transactions_table.c.issued_at
                ).where(
                    transactions_table.c.id.in_(starts[offset : offset + chunk_size])
                )
            ).all()
        )
    versions: dict[int, list[Any]] = {}
    live = {}
    ids = list({sid for sid, _ in attached})
    for offset in range(0, len(ids), chunk_size):
        chunk = ids[offset : offset + chunk_size]
        rows = conn.execute(
            sa.select(
                versions_table.c.id,
                versions_table.c.uuid,
                versions_table.c.transaction_id,
                versions_table.c.end_transaction_id,
                versions_table.c.operation_type,
            )
            .where(versions_table.c.id.in_(chunk))
            .order_by(versions_table.c.transaction_id)
        ).all()
        for sid, uuid, start, end, operation in rows:
            versions.setdefault(sid, []).append((uuid, start, end, operation))
        for sid, uuid, created_on in conn.execute(
            sa.select(
                live_table.c.id, live_table.c.uuid, live_table.c.created_on
            ).where(live_table.c.id.in_(chunk))
        ).all():
            live[sid] = (uuid, created_on)
    uuids = set()
    for sid, start in attached:
        live_uuid, created_on = live.get(sid, (None, None))
        uuid = attachment_uuid_at_tx(
            versions.get(sid, []),
            start,
            tx,
            live_uuid=live_uuid,
            live_created_on=created_on,
            attached_at=issued_at.get(start),
        )
        if uuid is not None:
            uuids.add(uuid)
    return sorted(uuids)
