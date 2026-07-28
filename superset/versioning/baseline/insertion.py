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
"""Parent baseline insertion + child-handler dispatch.

Two complementary helpers:

* :func:`insert_baseline_and_children` — top-level glue called by
  the listener. Wraps the work in ``session.no_autoflush`` (so
  ``session.connection()`` doesn't trigger a flush of Continuum's
  pending Transaction object before our direct-SQL insert claims its
  tx_id) and logs any failures as listener-boundary errors.
* :func:`_insert_baseline_row` — actually writes the
  ``version_transaction`` row and the parent shadow row. Returns the
  allocated ``transaction_id``.
* :func:`_baseline_children_for_parent` — dispatches to the per-
  entity handler in :mod:`.children` under the same tx_id.
"""

from __future__ import annotations

import logging
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session

from superset.versioning.baseline.children import CHILD_BASELINE_HANDLERS
from superset.versioning.baseline.shadow import insert_baseline_shadow_row
from superset.versioning.utils import read_row_outside_flush

logger = logging.getLogger(__name__)


def insert_baseline_and_children(
    session: Session, obj: Any, version_table: Any
) -> None:
    """Insert one atomic baseline for a parent and its children.

    Wrapped in ``no_autoflush`` so ``session.connection()`` inside
    ``_insert_baseline_row`` does not trigger a flush of Continuum's
    pending Transaction object before our direct-SQL insert claims its
    tx_id. A connection-level SAVEPOINT is required because this helper runs
    inside ``before_flush``, where ``Session.begin_nested()`` would flush
    recursively. One SAVEPOINT contains the transaction row, parent shadow,
    and every child shadow so optional baseline capture is all-or-nothing and
    a failed PostgreSQL statement cannot poison the user's transaction.

    Continuum runs later in the same ``before_flush`` listener chain. The
    PostgreSQL failure tests assert that releasing or rolling back this
    SAVEPOINT preserves Continuum's canonical update shadow and transaction.
    """
    try:
        with session.no_autoflush, session.connection().begin_nested():
            tx_id = _insert_baseline_row(session, obj, version_table)
            if tx_id is None:
                return
            _baseline_children_for_parent(session, obj, tx_id)
            logger.debug(
                "baseline_listener: inserted baseline tx_id=%s for %s id=%s",
                tx_id,
                type(obj).__name__,
                getattr(obj, "id", None),
            )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "baseline_listener: failed to insert baseline for %s id=%s",
            type(obj).__name__,
            getattr(obj, "id", None),
        )


def _insert_baseline_row(
    session: Session, obj: Any, version_table: sa.Table
) -> int | None:
    """Insert a synthetic baseline row capturing the pre-edit DB state of *obj*.

    Creates a version_transaction entry and an operation_type=0 version row.
    All writes use the session's existing connection so they share the same
    database transaction as the triggering flush.

    Returns the allocated ``transaction_id`` so the caller can baseline child
    collections under the same tx (see
    :func:`~superset.versioning.baseline.children._insert_child_baseline_rows`),
    or ``None`` when the entity has no live row.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    main_table = type(obj).__table__
    row = read_row_outside_flush(session, main_table, obj.id)
    if row is None:
        return None

    conn = session.connection()

    # Insert a version_transaction row for the baseline.
    #
    # ``issued_at`` and ``user_id`` are sourced from the entity's audit fields
    # (``changed_on`` / ``changed_by_fk``, falling back to ``created_on`` /
    # ``created_by_fk`` if the row was never edited), so the baseline reads
    # in the version-history UI as "this is the state at the time of the
    # last pre-versioning edit, by that user." Using ``now()`` and the
    # current user would have made the baseline look chronologically newer
    # than subsequent edits and attributed historical content to the user
    # who happened to trigger the first save under versioning.
    baseline_issued_at = row.get("changed_on") or row.get("created_on") or sa.func.now()
    baseline_user_id = row.get("changed_by_fk") or row.get("created_by_fk")
    tx_table = versioning_manager.transaction_cls.__table__
    result = conn.execute(
        tx_table.insert().values(
            issued_at=baseline_issued_at,
            user_id=baseline_user_id,
            remote_addr=None,
        )
    )
    tx_id = result.inserted_primary_key[0]
    insert_baseline_shadow_row(conn, version_table, row, tx_id)
    return tx_id


def _baseline_children_for_parent(
    session: Session, parent_obj: Any, tx_id: int
) -> None:
    """Baseline a parent's child collections under the parent's baseline tx.

    Dispatches via the
    :data:`~superset.versioning.baseline.children.CHILD_BASELINE_HANDLERS`
    table to per-entity handlers. Handler failures propagate to
    :func:`insert_baseline_and_children`, which rolls back the complete
    optional baseline unit before logging the failure.
    """
    parent_name = type(parent_obj).__name__
    handler = CHILD_BASELINE_HANDLERS.get(parent_name)
    if handler is None:
        return
    handler(session, parent_obj, tx_id)
