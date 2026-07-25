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
"""Discovery: figure out which parents need a baseline row.

Three helpers cooperate on the listener's "should I baseline" decision:

* :func:`collect_parents_to_baseline` — walks ``session.dirty`` /
  ``new`` / ``deleted`` and returns the unique parent entities to
  consider (directly-dirty versioned parents + parents reachable from
  dirty children via :func:`child_to_parent_registry`).
* :func:`version_table_for` — resolves a Continuum shadow Table for
  one parent object.
* :func:`shadow_row_count` — counts existing shadow rows for the
  parent's id; ``0`` is the signal to insert a baseline.

:func:`child_to_parent_registry` is also exposed because
:mod:`superset.versioning.factory` consumes it via inline import.

**Inline imports.** ``versioning.baseline`` is imported during
``init_versioning()`` before all SQLAlchemy mappers are configured;
the lazy imports defer Continuum + model resolution until call time.
"""

from __future__ import annotations

import functools
import logging
from typing import Any

import sqlalchemy as sa
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

# Populated at app startup (superset/initialization/__init__.py) before
# register_baseline_listener() is called.
VERSIONED_MODELS: list[type] = []

logger = logging.getLogger(__name__)


def collect_parents_to_baseline(session: Session) -> dict[int, Any]:
    """Return parents-to-baseline as ``{id(obj): obj}`` keyed by Python
    object identity to dedupe across ``session.dirty + new + deleted``.

    Includes both directly-dirty versioned parents and parents reachable
    from dirty/new/deleted children via the child→parent registry.
    """
    parents: dict[int, Any] = {}
    child_map = child_to_parent_registry()
    for obj in list(session.dirty) + list(session.new) + list(session.deleted):
        if type(obj) in VERSIONED_MODELS:
            parents[id(obj)] = obj
            continue
        entry = child_map.get(type(obj))
        if entry is None:
            continue
        parent_attr, parent_cls = entry
        parent = getattr(obj, parent_attr, None)
        if parent is not None and type(parent) is parent_cls:  # noqa: E721
            parents[id(parent)] = parent
    return parents


@functools.cache
def child_to_parent_registry() -> dict[type, tuple[str, type]]:
    """Map child entity class → (parent-relationship-attr, parent class).

    When a dirty child of a known type appears in session.dirty/new/deleted,
    we walk to its parent and baseline the parent (+ siblings) under the
    SAME flush so pre-edit child values land in the baseline shadow rows.
    Without this, edits that only touch child rows produce a "silent" flush
    A (just ``TableColumn``) followed by flush B (``SqlaTable.changed_on``);
    flush B reads children from DB AFTER flush A already pushed UPDATEs,
    capturing post-edit state.

    Cached because this is called from ``force_parent_dirty_on_child_change``
    and ``collect_parents_to_baseline`` on every save flush. The returned
    mapping depends only on the (fixed at import time) child model classes,
    so an unbounded ``functools.cache`` is the right shape — no invalidation
    needed.
    """
    # Lazy import: ``baseline`` is imported during ``init_versioning``, which
    # runs before all model mappers are configured. Importing model classes
    # at module load would either cycle or hit unresolved mappers.
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    return {
        TableColumn: ("table", SqlaTable),
        SqlMetric: ("table", SqlaTable),
    }


def version_table_for(obj: Any) -> Any:
    """Return Continuum's shadow ``Table`` for *obj*'s class, or ``None``
    when the class isn't registered (forks / plugins that subclass without
    ``__versioned__``).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class
    from sqlalchemy_continuum.exc import ClassNotVersioned

    try:
        return version_class(type(obj)).__table__
    except ClassNotVersioned:
        return None


def shadow_row_count(session: Session, obj: Any, version_table: Any) -> int | None:
    """Return number of shadow rows for *obj.id* in *version_table*, or
    ``None`` when the version table is missing (migration not yet applied)
    or the count query raised unexpectedly.
    """
    try:
        # SAVEPOINT so a missing-table probe can't poison the enclosing
        # transaction on PostgreSQL (a failed statement aborts the tx
        # there; subsequent statements would raise InFailedSqlTransaction
        # and fail the user's save despite the except below).
        with session.no_autoflush, session.connection().begin_nested():
            return (
                session.connection()
                .execute(
                    sa.select(sa.func.count())
                    .select_from(version_table)
                    .where(version_table.c.id == obj.id)
                )
                .scalar()
            )
    except (OperationalError, ProgrammingError):
        # Missing table: OperationalError on SQLite/MySQL,
        # ProgrammingError (UndefinedTable) on PostgreSQL.
        return None
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "baseline_listener: count query failed for %s id=%s",
            type(obj).__name__,
            getattr(obj, "id", None),
        )
        return None
