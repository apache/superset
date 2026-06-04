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
"""Parent-dirty force machinery for child-only saves.

When a versioned child (``TableColumn`` / ``SqlMetric``) is in
``session.dirty`` / ``new`` / ``deleted`` but its parent's scalar
columns haven't been touched, the parent is *missing* from the dirty
set — so Continuum's UnitOfWork never creates a parent UPDATE
operation, no parent shadow row is written, and the version-history
dropdown comes back empty for column/metric-only saves.

:func:`force_parent_dirty_on_child_change` walks dirty/new/deleted
children, looks them up in the child→parent registry (in
:mod:`.collection`), and ``attributes.flag_modified``s a deterministic
non-excluded column on the parent. SQLAlchemy adds the parent to
``session.dirty``; Continuum then writes a parent shadow row whose
scalars mirror the previous version (only the children actually
changed).

:func:`pin_audit_columns` is a companion: when the parent is force-
flagged, we pin ``changed_by_fk`` / ``changed_on`` to their current
in-memory values so the parent UPDATE doesn't invoke the audit
columns' ``onupdate=get_user_id`` / ``onupdate=datetime.now`` hooks
(which would attribute the synthetic flush to whoever ``g.user`` is
at the time, possibly a deleted test user under autoflush teardown).

**Inline imports.** Same init-order rationale as
:mod:`superset.versioning.baseline.collection`.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import attributes, Session

from superset.versioning.baseline.collection import child_to_parent_registry

logger = logging.getLogger(__name__)


def force_parent_dirty_on_child_change(session: Session) -> None:
    """Mark a versioned parent as dirty whenever one of its versioned
    children appears in ``session.dirty``/``new``/``deleted`` but the
    parent's own scalars haven't been edited.

    Without this hook, edits that only touch ``TableColumn`` or
    ``SqlMetric`` rows leave the parent ``SqlaTable`` out of
    ``session.dirty`` — so Continuum's UnitOfWork never creates a
    parent UPDATE operation and ``list_versions`` (which queries the
    parent shadow ``tables_version``) returns just the baseline. The
    user-visible symptom is "I edited a column description but the
    dataset's version history dropdown is empty".

    For each child that represents a real edit, we resolve its parent
    and ``attributes.flag_modified`` a deterministic non-excluded
    column so SQLAlchemy adds the parent to ``session.dirty`` without
    altering any column values. Continuum then writes a parent shadow
    row at this transaction; its scalar columns mirror the previous
    version (only the children changed).
    ``SkipUnmodifiedPlugin._is_no_op_update`` is taught to recognize
    the "scalars match but children dirty" case and keep the row.
    """
    child_map = child_to_parent_registry()
    new_set = session.new
    for child in _real_dirty_versioned_children(session, child_map):
        parent = _resolve_parent(child, child_map)
        if parent is None:
            continue
        if parent in new_set:
            # Already-new short-circuit. If the parent itself is in
            # ``session.new`` (typical during an import that adds a
            # ``SqlaTable`` plus 50 fresh ``TableColumn`` children), it
            # will INSERT in this flush regardless — the
            # ``flag_modified`` call is redundant (and the attribute-
            # default-not-yet-fired case in ``_flag_parent`` would just
            # swallow an ``InvalidRequestError``). Skip the work.
            continue
        if _flag_parent(parent):
            pin_audit_columns(parent)


def _real_dirty_versioned_children(
    session: Session, child_map: dict[type, Any]
) -> Iterator[Any]:
    """Yield child instances that are (a) of a versioned-child class
    registered in *child_map*, and (b) represent a real content edit —
    not a phantom-dirty entry from lazy-load side effects or audit-
    column auto-bumps.

    Phantom-dirty filter rationale: a child can appear in
    ``session.dirty`` for reasons that don't represent real content
    edits — lazy-load side effects, ``AuditMixin`` auto-bumps from
    prior code paths, M2M relationship-cascade artifacts (e.g.,
    ``rls_entry.tables.extend([dataset])`` in setUp), Reverter side
    passes. Force-touching the parent in those cases produces an
    incidental ``UPDATE tables SET description=…, changed_on=…,
    changed_by_fk=…`` that can violate FK integrity on some dialects
    (observed in ``test_rls_filter_alters_no_role_user_birth_names_query``).

    The filter applies ONLY to persistent rows in ``session.dirty``:
    ``session.new`` (creation) and ``session.deleted`` (removal) are
    always real content changes — deletion in particular is a state
    transition with no attribute history, so ``is_modified`` returns
    False there even when the change is real (column-removed records
    must still emit).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import is_modified

    # ``session.dirty`` / ``session.new`` are IdentitySets — ``__contains__``
    # uses identity comparison, which is what we need for the phantom-
    # dirty filter below.
    dirty_set = session.dirty
    for obj in list(session.dirty) + list(session.new) + list(session.deleted):
        if type(obj) not in child_map:
            continue
        if obj in dirty_set and not is_modified(obj):
            continue
        yield obj


def _resolve_parent(child: Any, child_map: dict[type, Any]) -> Any | None:
    """Resolve the versioned parent for *child* via the child→parent
    registry; return ``None`` when the registered parent attribute
    isn't loaded or has been swapped for an unexpected type."""
    parent_attr, parent_cls = child_map[type(child)]
    parent = getattr(child, parent_attr, None)
    if parent is None or type(parent) is not parent_cls:  # noqa: E721
        return None
    return parent


def _flag_parent(parent: Any) -> bool:
    """``flag_modified`` a stable non-excluded column on *parent* so
    SQLAlchemy adds it to ``session.dirty`` without altering values.
    Returns ``True`` on success.

    Column choice: ``description`` is a plain ``Text`` column on all
    three versioned parent classes (Dashboard, Slice, SqlaTable) and is
    in none of their ``__versioned__`` excludes — pick it
    deterministically so the flagged attribute is stable across
    SQLAlchemy versions / mapper-configuration orders. We deliberately
    avoid ``uuid``: when a versioned-parent UPDATE goes through with
    ``uuid`` flagged, the column's ``UUIDType``/BLOB round-trip
    produces a memoryview that fails an FK integrity check on some
    dialects (observed in
    ``test_rls_filter_alters_no_role_user_birth_names_query`` and
    ``test_restore_applies_scalar_field``). ``description`` is a plain
    text column with no marshaling layer, so flagging it safely
    round-trips its current value. Falls back to ``uuid`` then
    ``col_keys[0]`` for forks that excluded ``description``.

    Returns ``False`` for the freshly-constructed ``session.new``
    instance whose attribute defaults haven't fired yet — the
    attribute is unloaded in instance state, so ``flag_modified``
    rejects it with ``InvalidRequestError``. The parent will INSERT in
    this flush regardless, so the flag was redundant; safely skip.
    Hit by ``test_create_dataset_item`` (POST /api/v1/dataset/).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum.utils import versioned_column_properties

    col_keys = [prop.key for prop in versioned_column_properties(parent)]
    if not col_keys:
        return False
    if "description" in col_keys:
        flag_col = "description"
    elif "uuid" in col_keys:
        flag_col = "uuid"
    else:
        flag_col = col_keys[0]
    try:
        attributes.flag_modified(parent, flag_col)
    except InvalidRequestError:
        return False
    return True


def pin_audit_columns(parent: Any) -> None:
    """Pin ``changed_by_fk`` and ``changed_on`` to their current in-memory
    values on a flag-flushed parent.

    ``changed_by_fk`` carries ``onupdate=get_user_id`` from ``AuditMixin``:
    any UPDATE statement that doesn't explicitly set this column lets
    SQLAlchemy invoke ``get_user_id()`` and write whoever ``g.user`` is
    at flush time. When the flush is autoflush-triggered during an
    earlier test's teardown (after the test user has been deleted from
    ``ab_user``), the bumped value points at a non-existent row and the
    parent UPDATE fails the FK to ``ab_user``. The same applies to
    ``changed_on``'s ``onupdate=datetime.now`` (cosmetic only, but it's
    cheap to pin together).

    ``flag_modified`` on both columns marks them as having dirty
    attribute history, which tells SQLAlchemy to use the in-memory
    (previously-committed) values instead of invoking ``onupdate`` —
    the parent UPDATE then carries the existing audit values rather
    than whatever ``g.user`` resolves to during the synthetic flag
    flush. Hits ``test_rls_filter_alters_no_role_user_birth_names_query``
    and ``TestDatasetRestoreApi::test_restore_applies_scalar_field``
    in CI's full-suite ordering (autoflush during teardown).
    """
    pinned_any = False
    for audit_col in ("changed_by_fk", "changed_on"):
        if hasattr(parent, audit_col):
            try:
                attributes.flag_modified(parent, audit_col)
                pinned_any = True
            except InvalidRequestError:
                continue
    if not pinned_any and hasattr(parent, "changed_by_fk"):
        # Both audit columns are present on the parent but neither
        # ``flag_modified`` succeeded — typically because the parent is
        # a freshly-constructed ``session.new`` instance whose attribute
        # defaults haven't fired yet. Without the pin, the synthetic
        # parent UPDATE in this flush invokes ``onupdate=get_user_id``
        # and writes whoever ``g.user`` is at flush time, which under
        # autoflush-during-teardown can point at a deleted test user
        # and fail the FK to ``ab_user``. Surface this so the failure
        # mode is debuggable from the log without inspection.
        logger.info(
            "baseline: skipped audit-column pin on %s id=%s "
            "(attribute defaults not loaded)",
            type(parent).__name__,
            getattr(parent, "id", None),
        )
