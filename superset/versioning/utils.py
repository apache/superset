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

from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session


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
