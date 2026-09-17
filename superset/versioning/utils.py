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
"""Shared session helpers used by the entity-versioning machinery."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import sqlalchemy as sa
from flask import current_app
from sqlalchemy.orm import Session


def capture_enabled() -> bool:
    """Whether ``ENABLE_VERSIONING_CAPTURE`` is on for the current app.

    The single gate shared by the read helpers (which degrade to inert
    responses when off) and the write side (which must refuse: with
    Continuum's write listeners detached, a restore would mutate the live
    entity with no new version row — a destructive, untracked write that
    violates the append-only contract).

    Operational constraint: this reads config at call time, but the
    Continuum listeners themselves attach or detach only when
    ``init_versioning()`` runs at startup. The two agree only because the
    flag is static per-process — flipping it at runtime (dynamic config
    reload, a future admin toggle) without re-running ``init_versioning()``
    would let this gate pass while listeners stay detached, producing
    exactly the untracked write it exists to prevent. Restart the process
    (or re-run ``init_versioning()``) after changing the flag.
    """
    return bool(current_app.config.get("ENABLE_VERSIONING_CAPTURE", False))


@contextmanager
def single_flush_scope(session: Session) -> Iterator[None]:
    """Suppress autoflushes inside the block, flush once on clean exit.

    Intended for operations that (a) make multiple mutations across
    relationships and (b) issue intermediate queries which would
    otherwise autoflush. Iterating from one relationship to another
    inside SQLAlchemy-Continuum's ``Reverter`` is the canonical case:
    a mid-iteration autoflush transitions pending DELETEs to
    ``state.deleted=True``, and the subsequent
    ``session.add(version_parent)`` cascade walk trips on the
    deleted-state instances with ``InvalidRequestError``. Wrapping the
    whole revert keeps marked-for-deletion instances in
    ``state.persistent`` until the trailing flush drains DELETEs +
    INSERTs in one atomic step. That single flush is also load-bearing
    for the ``after_flush`` change-records listener — splitting the
    work across multiple flushes would split it across multiple
    Continuum transactions, and the listener's tx-dedup guard would
    silently drop the second pass's records.

    On exception, the trailing flush is skipped — the session's normal
    rollback flow handles cleanup, and flushing a partially-mutated
    state would be wrong.
    """
    with session.no_autoflush:
        yield
    session.flush()


def read_row_outside_flush(
    session: Session, table: sa.Table, entity_id: int
) -> dict[str, Any] | None:
    """Read the row with ``id == entity_id`` from *table* without triggering
    an autoflush. Returns the row as a plain dict, or ``None`` when no row
    matches.

    A read primitive for listeners that need pre-flush state (the row as it
    existed *before* the in-flight edit was staged) — without ``no_autoflush``,
    the
    ``session.connection().execute(...)`` would itself trigger a flush of
    the pending edit, leaving "pre" and "post" indistinguishable.

    Returns ``dict[str, Any]`` rather than ``RowMapping`` so callers don't
    accidentally hold a cursor-bound object past the listener boundary.
    """
    with session.no_autoflush:
        result = (
            session.connection()
            .execute(sa.select(table).where(table.c.id == entity_id))
            .mappings()
            .one_or_none()
        )
    return dict(result) if result else None
