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
"""Pre/post-state reading and the per-entity diff dispatch.

Three concerns live here:

1. **JSON-safety coercion** — raw column values (``datetime``, ``UUID``,
   ``bytes``, ``Decimal``) get converted to strings before they land in
   the ``version_changes.from_value`` / ``to_value`` JSON columns.
2. **State capture** — :func:`_orm_to_post_state` serialises the
   in-memory ORM object; :func:`_read_pre_state` reads the corresponding
   pre-flush row directly from the DB inside ``session.no_autoflush``.
3. **Diff dispatch** — :func:`compute_records_from_state` routes to the
   right :mod:`superset.versioning.diff` helper based on the model
   class name (string dispatch keeps this module free of hard imports
   on the three entity classes, which avoids import-order coupling at
   app-init time).

Bulk insert of the computed records into the ``version_changes`` table
lives here too — it's the tail of the per-entity compute pipeline.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import Session

from superset.versioning.changes.table import version_changes_table
from superset.versioning.diff import (
    cap_records,
    ChangeRecord,
    diff_dashboard,
    diff_dataset,
    diff_slice,
    scalar_fields_for,
)
from superset.versioning.utils import read_row_outside_flush

logger = logging.getLogger(__name__)


# Per-model-class cache of the scalar-field set. Populated lazily on
# first save of a model. Reading from ``__table__.columns`` is cheap
# but not free; memoising keeps the save-path overhead budget
# from slowly growing with the set of distinct model classes seen.
_SCALAR_FIELDS_CACHE: dict[type, frozenset[str]] = {}


def _cached_scalar_fields(model_cls: type[Model]) -> frozenset[str]:
    """Cached wrapper around :func:`scalar_fields_for`."""
    if model_cls not in _SCALAR_FIELDS_CACHE:
        # ``Slice.params`` is walked by ``diff_slice_params`` for kind
        # promotion; emitting it as one opaque ``field`` change would
        # defeat that and flood the log with meaningless records.
        # ``last_saved_at`` / ``last_saved_by_fk`` are stamped by
        # ``UpdateChartCommand`` on every chart save; they're audit
        # noise (same shape as ``changed_on`` / ``changed_by_fk``) and
        # don't carry user-authored signal.
        # ``Dashboard.json_metadata`` and ``position_json`` are JSON
        # blobs walked structurally by ``diff_json_field`` (one record
        # per changed top-level key); the raw scalar diff would emit
        # one giant multi-KB record per save and swamp the response.
        special: frozenset[str] = frozenset()
        audit: frozenset[str] = frozenset()
        if model_cls.__name__ == "Slice":
            special = frozenset({"params"})
            audit = frozenset({"last_saved_at", "last_saved_by_fk"})
        elif model_cls.__name__ == "Dashboard":
            special = frozenset({"json_metadata", "position_json"})
        _SCALAR_FIELDS_CACHE[model_cls] = scalar_fields_for(
            model_cls, special=special, audit=audit
        )
    return _SCALAR_FIELDS_CACHE[model_cls]


def jsonable(value: Any) -> Any:
    """Convert a column value into a JSON-serialisable form.

    Slice has ``last_saved_at`` (datetime), datasets have datetime
    columns, and any of these fields can land in ``from_value`` /
    ``to_value`` of a ``version_changes`` row, which is a JSON column.
    Python's default JSON encoder rejects ``datetime`` / ``UUID`` /
    ``bytes`` / ``Decimal``, so the whole bulk insert fails if a single
    record carries one. Convert to ISO / hex / str at record-construction
    time.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, Decimal):
        # Stringify rather than ``float()`` to preserve precision; the
        # diff engine compares string equality on ``from_value`` /
        # ``to_value``, so coercing both sides to the same form is what
        # matters.
        return str(value)
    return value


def _orm_to_post_state(obj: Any) -> dict[str, Any]:
    """Serialise an ORM object's column attributes to a plain dict.

    We only read declared column attributes — not relationships or
    hybrid properties — because the diff engine operates on scalar
    values per its documented API. Values are passed through
    :func:`jsonable` so the dict is JSON-safe end-to-end.
    """
    state = sa.inspect(obj)
    return {
        col.key: jsonable(getattr(obj, col.key)) for col in state.mapper.column_attrs
    }


def _read_pre_state(
    session: Session, model_cls: type[Model], entity_id: int
) -> dict[str, Any] | None:
    """Read the entity's pre-flush row directly from the DB and convert
    non-JSON-safe types to strings so both sides of the diff compare on
    the same form. Delegates the autoflush-suppressed read itself to
    :func:`superset.versioning.utils.read_row_outside_flush`.

    Returns ``None`` if the row is missing (shouldn't happen for a dirty
    existing object, but defensive against race conditions).
    """
    table = model_cls.__table__
    result = read_row_outside_flush(session, table, entity_id)
    if result is None:
        return None
    # Convert non-JSON-safe types (datetime, UUID, bytes, Decimal) to
    # strings so both sides of the diff compare on the same form and
    # any value that ends up in ``from_value`` / ``to_value`` is
    # acceptable to the JSON column on insert.
    return {key: jsonable(value) for key, value in result.items()}


def capture_initial_state(session: Session, obj: Any) -> dict[str, Any] | None:
    """Capture an entity's database state before its first transaction flush."""
    entity_id = getattr(obj, "id", None)
    if entity_id is None:
        return None
    try:
        return _read_pre_state(session, type(obj), entity_id)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: initial-state read failed for %s id=%s",
            type(obj).__name__,
            entity_id,
        )
        return None


def compute_records_from_state(
    obj: Any, pre_state: dict[str, Any]
) -> list[ChangeRecord]:
    """Diff a retained transaction pre-state against an entity's final state."""
    post_state = _orm_to_post_state(obj)
    model_cls = type(obj)
    fields = _cached_scalar_fields(model_cls)
    name = model_cls.__name__
    if name == "Slice":
        return diff_slice(pre_state, post_state, fields=fields)
    if name == "Dashboard":
        return diff_dashboard(pre_state, post_state, fields=fields)
    if name == "SqlaTable":
        return diff_dataset(pre_state, post_state, fields=fields)
    return []


def bulk_insert_records(
    session: Session,
    transaction_id: int,
    buffered: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Insert ``version_changes`` rows for one transaction via raw SQL.

    Uses the module-level :data:`version_changes_table` Table object
    (which carries JSON column types, unlike ``sa.table(...)``) so the
    connection marshals ``path`` / ``from_value`` / ``to_value`` Python
    structures into JSON on insert. Skips the ORM flush round that
    ``session.bulk_insert_mappings`` would cost inside an already-
    active flush.

    ``buffered`` is a dict keyed on ``(entity_kind, entity_id)`` so
    records for one entity — scalars from ``before_flush`` plus
    children collected in ``after_flush`` — merge naturally under the
    same key. ``sequence`` resets per entity so each entity's records
    form a self-contained replay sequence.
    """
    if not buffered:
        return
    rows = []
    for (entity_kind, entity_id), records in buffered.items():
        # Bound a single save's output: collapse field-level record explosions
        # and truncate over-large values before they hit version_changes.
        for seq, r in enumerate(cap_records(records)):
            rows.append(
                {
                    "transaction_id": transaction_id,
                    "entity_kind": entity_kind,
                    "entity_id": entity_id,
                    "sequence": seq,
                    "kind": r.kind,
                    "operation": r.operation,
                    "path": r.path,
                    "from_value": r.from_value,
                    "to_value": r.to_value,
                }
            )
    if rows:
        session.connection().execute(version_changes_table.insert(), rows)
