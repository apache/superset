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
"""Continuum-shaped shadow-row writer.

Two pieces:

* :data:`CONTINUUM_BOOKKEEPING_COLUMNS` — the set of column names
  Continuum uses for per-row bookkeeping (``transaction_id`` /
  ``end_transaction_id`` / ``operation_type``). Re-used outside this
  package as a filter (the change-record listener strips these from
  JSON record values).
* :func:`insert_baseline_shadow_row` — copies a live row into a
  shadow ``Table`` as a synthetic ``operation_type=0`` baseline at
  the given transaction id. The other modules in this package use it
  for every parent and child baseline insert.
"""

from __future__ import annotations

import logging
from typing import Any

import sqlalchemy as sa

logger = logging.getLogger(__name__)

# Continuum's per-shadow-row bookkeeping columns. Skipped when copying
# content from a live row into a synthetic baseline shadow row; set
# explicitly by the baseline writer so the row reads as a freshly-created
# live row at the baseline transaction.
CONTINUUM_BOOKKEEPING_COLUMNS: frozenset[str] = frozenset(
    {"transaction_id", "end_transaction_id", "operation_type"}
)


def insert_baseline_shadow_row(
    conn: Any,
    version_table: sa.Table,
    source_row: Any,
    tx_id: int,
) -> None:
    """Copy *source_row* into *version_table* as a synthetic baseline
    (``operation_type=0``) shadow row at *tx_id*.

    Content columns are copied through; the three Continuum bookkeeping
    columns are set explicitly so the row reads as a freshly-created
    live row at *tx_id*. Column objects (not names) are used as
    ``values()`` keys to avoid the "Unconsumed column names" error that
    a name-based dict hits when a Column's ``.key`` differs from its
    ``.name`` — a thing Continuum-generated tables occasionally produce.
    """
    col_values: dict[Any, Any] = {}
    dropped: list[str] = []
    for col in version_table.columns:
        if col.name in CONTINUUM_BOOKKEEPING_COLUMNS:
            continue
        if col.name in source_row:
            col_values[col] = source_row[col.name]
        else:
            dropped.append(col.name)
    if dropped:
        # A content column present on the shadow table but absent from the
        # live source row means the two schemas have diverged (a Continuum
        # shadow column whose name doesn't match the live column). The value
        # would be stored NULL — a silent history-fidelity gap — so surface
        # it rather than dropping it quietly.
        logger.warning(
            "versioning: baseline shadow row for %s is missing source "
            "values for column(s) %s; they will be stored NULL. This "
            "indicates a name divergence between the live table and its "
            "Continuum shadow table.",
            version_table.name,
            ", ".join(dropped),
        )
    col_values[version_table.c.transaction_id] = tx_id
    col_values[version_table.c.end_transaction_id] = None
    col_values[version_table.c.operation_type] = 0
    conn.execute(version_table.insert().values(col_values))
