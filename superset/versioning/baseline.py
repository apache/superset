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
"""before_flush listener that captures a baseline version (version 0) for entities
being updated for the first time after the versioning migration.

The module reads top-down in stepdown order: the public entry point
(``register_baseline_listener``) is at the top; helpers descend to leaf
builders at the bottom. Module-level state (``VERSIONED_MODELS``,
``_CHILD_BASELINE_HANDLERS``) sits next to the helpers that consume it.

VERSIONED_MODELS is populated at app startup by the initialisation code after
make_versioned() has run and all versioned model classes have been defined.

**Inline imports.** Several helpers below use ``# pylint: disable=
import-outside-toplevel`` for imports of ``sqlalchemy_continuum`` and
Superset model classes. The reason is uniform: this module is imported
from ``init_versioning()`` in ``superset/initialization/__init__.py``
before all SQLAlchemy mappers are configured and before Continuum's
``make_versioned()`` has finished wiring shadow classes. Top-level
imports of model classes or Continuum helpers would either trip an
unresolved-mapper error or create an init-order cycle. The lazy form
defers resolution until the helper actually runs, by which point app
init is complete. Per-call ``why-`` comments are omitted to avoid
repeating the same explanation at every callsite; unusual cases (if
any are added) should be commented explicitly.
"""

import functools
import logging
from collections.abc import Callable
from typing import Any

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.exc import InvalidRequestError, OperationalError
from sqlalchemy.orm import attributes, Session

from superset.versioning.utils import read_row_outside_flush

logger = logging.getLogger(__name__)

# Populated at app startup (superset/initialization/__init__.py) before
# register_baseline_listener() is called.
VERSIONED_MODELS: list[type] = []


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def register_baseline_listener() -> None:
    """Attach the before_flush listener that captures baseline versions.

    Call this after VERSIONED_MODELS has been populated and make_versioned() has run.
    """
    from superset.extensions import db  # pylint: disable=import-outside-toplevel

    # insert=True prepends us in the listener chain so we run BEFORE
    # Continuum's before_flush. Continuum's pending Transaction object
    # (added in its own before_flush) would otherwise get a lower
    # auto-increment tx_id than our direct-SQL baseline insert, placing the
    # baseline row after the update in version_number order. Prepending
    # ensures our baseline's tx_id comes first.
    @event.listens_for(db.session, "before_flush", insert=True)
    def capture_baseline(session: Session, flush_context: Any, instances: Any) -> None:
        if not VERSIONED_MODELS:
            return
        # Make sure a child-only edit promotes the parent to ``session.dirty``
        # before Continuum's before_flush reads the dirty set.
        _force_parent_dirty_on_child_change(session)
        for obj in _collect_parents_to_baseline(session).values():
            if type(obj) not in VERSIONED_MODELS:
                continue
            version_table = _version_table_for(obj)
            if version_table is None:
                continue
            count = _shadow_row_count(session, obj, version_table)
            if count == 0:
                _insert_baseline_and_children(session, obj, version_table)


# ---------------------------------------------------------------------------
# High-level helpers used by ``capture_baseline``
# ---------------------------------------------------------------------------


def _force_parent_dirty_on_child_change(session: Session) -> None:
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

    We use ``attributes.flag_modified`` against the parent's first
    non-excluded versioned column so SQLAlchemy adds the parent to
    ``session.dirty`` without altering any column values. Continuum
    then writes a parent shadow row at this transaction; its scalar
    columns mirror the previous version (only the children changed).
    ``SkipUnmodifiedPlugin._is_no_op_update`` is taught to recognize
    the "scalars match but children dirty" case and keep the row.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import is_modified
    from sqlalchemy_continuum.utils import versioned_column_properties

    # ``session.dirty`` is an IdentitySet — ``__contains__`` uses identity
    # comparison, which is what we need for the phantom-dirty filter below.
    dirty_set = session.dirty
    child_map = _child_to_parent_registry()
    for obj in list(session.dirty) + list(session.new) + list(session.deleted):
        entry = child_map.get(type(obj))
        if entry is None:
            continue
        # Phantom-dirty filter: a child can appear in ``session.dirty`` for
        # reasons that don't represent real content edits — lazy-load side
        # effects, ``AuditMixin`` auto-bumps from prior code paths, M2M
        # relationship-cascade artifacts (e.g., ``rls_entry.tables.extend(
        # [dataset])`` in setUp), Reverter side passes. Force-touching the
        # parent in those cases produces an incidental
        # ``UPDATE tables SET description=…, changed_on=…, changed_by_fk=…``
        # that can violate FK integrity on some dialects (observed in
        # ``test_rls_filter_alters_no_role_user_birth_names_query``).
        #
        # The filter applies ONLY to persistent rows in ``session.dirty``:
        # ``session.new`` (creation) and ``session.deleted`` (removal) are
        # always real content changes — deletion in particular is a state
        # transition with no attribute history, so ``is_modified`` returns
        # False there even when the change is real (column-removed records
        # must still emit).
        if obj in dirty_set and not is_modified(obj):
            continue
        parent_attr, parent_cls = entry
        parent = getattr(obj, parent_attr, None)
        if parent is None or type(parent) is not parent_cls:  # noqa: E721
            continue
        col_keys = [prop.key for prop in versioned_column_properties(parent)]
        if not col_keys:
            continue
        # ``description`` is a plain ``Text`` column on all three versioned
        # parent classes (Dashboard, Slice, SqlaTable) and is in none of
        # their ``__versioned__`` excludes — pick it deterministically so
        # the flagged attribute is stable across SQLAlchemy versions /
        # mapper-configuration orders. We deliberately avoid ``uuid``
        # here: when a versioned-parent UPDATE goes through with ``uuid``
        # flagged, the column's ``UUIDType``/BLOB round-trip produces a
        # memoryview that fails an FK integrity check on some dialects
        # (observed in ``test_rls_filter_alters_no_role_user_birth_names_query``
        # and ``test_restore_applies_scalar_field``). ``description`` is
        # a plain text column with no marshaling layer, so flagging it
        # safely round-trips its current value. Falls back to ``uuid``
        # then ``col_keys[0]`` for forks that excluded ``description``.
        if "description" in col_keys:
            flag_col = "description"
        elif "uuid" in col_keys:
            flag_col = "uuid"
        else:
            flag_col = col_keys[0]
        try:
            attributes.flag_modified(parent, flag_col)
        except InvalidRequestError:
            # The parent is a freshly-constructed ``session.new`` instance
            # whose attribute defaults haven't fired yet — the attribute
            # is unloaded in instance state, so ``flag_modified`` rejects
            # it. The parent will INSERT in this flush regardless, so the
            # flag was redundant; safely skip. Hit by
            # ``test_create_dataset_item`` (POST /api/v1/dataset/).
            continue
        _pin_audit_columns(parent)


def _pin_audit_columns(parent: Any) -> None:
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
    for audit_col in ("changed_by_fk", "changed_on"):
        if hasattr(parent, audit_col):
            try:
                attributes.flag_modified(parent, audit_col)
            except InvalidRequestError:
                pass


def _collect_parents_to_baseline(session: Session) -> dict[int, Any]:
    """Return parents-to-baseline as ``{id(obj): obj}`` keyed by Python
    object identity to dedupe across ``session.dirty + new + deleted``.

    Includes both directly-dirty versioned parents and parents reachable
    from dirty/new/deleted children via the child→parent registry.
    """
    parents: dict[int, Any] = {}
    child_map = _child_to_parent_registry()
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
def _child_to_parent_registry() -> dict[type, tuple[str, type]]:
    """Map child entity class → (parent-relationship-attr, parent class).

    When a dirty child of a known type appears in session.dirty/new/deleted,
    we walk to its parent and baseline the parent (+ siblings) under the
    SAME flush so pre-edit child values land in the baseline shadow rows.
    Without this, edits that only touch child rows produce a "silent" flush
    A (just ``TableColumn``) followed by flush B (``SqlaTable.changed_on``);
    flush B reads children from DB AFTER flush A already pushed UPDATEs,
    capturing post-edit state.

    Cached because this is called from ``_force_parent_dirty_on_child_change``
    and ``_collect_parents_to_baseline`` on every save flush. The returned
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


def _version_table_for(obj: Any) -> Any:
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


def _shadow_row_count(session: Session, obj: Any, version_table: Any) -> int | None:
    """Return number of shadow rows for *obj.id* in *version_table*, or
    ``None`` when the version table is missing (migration not yet applied)
    or the count query raised unexpectedly.
    """
    try:
        with session.no_autoflush:
            return (
                session.connection()
                .execute(
                    sa.select(sa.func.count())
                    .select_from(version_table)
                    .where(version_table.c.id == obj.id)
                )
                .scalar()
            )
    except OperationalError:
        return None
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "baseline_listener: count query failed for %s id=%s",
            type(obj).__name__,
            getattr(obj, "id", None),
        )
        return None


def _insert_baseline_and_children(
    session: Session, obj: Any, version_table: Any
) -> None:
    """Insert the parent baseline row, then baseline the parent's child
    collections under the same transaction id.

    Wrapped in ``no_autoflush`` so ``session.connection()`` inside
    ``_insert_baseline_row`` does not trigger a flush of Continuum's
    pending Transaction object before our direct-SQL insert claims its
    tx_id.
    """
    try:
        with session.no_autoflush:
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


# ---------------------------------------------------------------------------
# Mid-level builders: parent shadow + child dispatch
# ---------------------------------------------------------------------------


def _insert_baseline_row(
    session: Session, obj: Any, version_table: sa.Table
) -> int | None:
    """Insert a synthetic baseline row capturing the pre-edit DB state of *obj*.

    Creates a version_transaction entry and an operation_type=0 version row.
    All writes use the session's existing connection so they share the same
    database transaction as the triggering flush.

    Returns the allocated ``transaction_id`` so the caller can baseline child
    collections under the same tx (see :func:`_insert_child_baseline_rows`),
    or ``None`` when the entity has no live row.
    """
    from sqlalchemy_continuum import (
        versioning_manager,  # pylint: disable=import-outside-toplevel
    )

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

    # Build version row using Column objects as keys to avoid name/key mismatches
    # (string-based values(**dict) raises "Unconsumed column names" when a Column's
    # .key differs from its .name, which can happen with Continuum-generated tables).
    meta_col_names = {"transaction_id", "end_transaction_id", "operation_type"}
    col_values: dict[Any, Any] = {}
    for col in version_table.columns:
        if col.name in meta_col_names:
            continue
        if col.name in row:
            col_values[col] = row[col.name]

    col_values[version_table.c.transaction_id] = tx_id
    col_values[version_table.c.end_transaction_id] = None
    col_values[version_table.c.operation_type] = 0

    conn.execute(version_table.insert().values(col_values))
    return tx_id


def _baseline_children_for_parent(
    session: Session, parent_obj: Any, tx_id: int
) -> None:
    """Baseline a parent's child collections under the parent's baseline tx.

    Dispatches via :data:`_CHILD_BASELINE_HANDLERS` to per-entity handlers.
    A handler failure is logged but does not block the parent baseline.
    """
    parent_name = type(parent_obj).__name__
    handler = _CHILD_BASELINE_HANDLERS.get(parent_name)
    if handler is None:
        return
    try:
        handler(session, parent_obj, tx_id)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "baseline_listener: failed to baseline children of %s id=%s",
            parent_name,
            getattr(parent_obj, "id", None),
        )


# ---------------------------------------------------------------------------
# Per-entity child handlers
# ---------------------------------------------------------------------------


def _baseline_dataset_children(session: Session, dataset: Any, tx_id: int) -> None:
    """Baseline a dataset's ``TableColumn`` and ``SqlMetric`` children
    under the dataset's baseline tx.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.connectors.sqla.models import SqlMetric, TableColumn

    for child_cls in (TableColumn, SqlMetric):
        _insert_child_baseline_rows(
            session,
            dataset,
            child_cls.__table__,
            version_class(child_cls).__table__,
            "table_id",
            tx_id,
        )


def _baseline_dashboard_children(session: Session, dashboard: Any, tx_id: int) -> None:
    """Baseline a dashboard's ``dashboard_slices`` M2M plus synthesize
    ``operation_type=0`` rows in ``slices_version`` for attached slices
    with no prior shadow.

    Continuum's M2M version-side relationship for ``Dashboard.slices``
    joins through both ``dashboard_slices_version`` AND
    ``slices_version``: the second exists clause filters slices by
    "latest slices_version row with tx <= dashboard.tx". If a slice
    has no slices_version rows at all, that join produces no match
    and ``version_obj.slices`` returns empty — leaving the dashboard
    restore with no slices to append. The synthetic slice baseline at
    this dashboard's tx gives the M2M query a slice version it can match.

    Doesn't try to be clever about slices shared across dashboards: a
    slice is baselined at this dashboard's tx_id only when it has no
    shadow rows at all. If a later dashboard baseline references the
    same slice, this baseline (now at lower tx) is still found by
    that dashboard's restore. The reverse — a dashboard baselined
    AFTER the slice was first baselined under another dashboard at
    a higher tx — is a residual gap deferred to a future fix.
    """
    metadata = type(dashboard).__table__.metadata
    live_tbl = metadata.tables.get("dashboard_slices")
    shadow_tbl = metadata.tables.get("dashboard_slices_version")
    if live_tbl is None or shadow_tbl is None:
        return

    _insert_child_baseline_rows(
        session, dashboard, live_tbl, shadow_tbl, "dashboard_id", tx_id
    )
    _baseline_attached_slices(session, dashboard, live_tbl, tx_id)


# Dispatch table keyed by parent CLASS NAME rather than class, to avoid
# the import-cycle between baseline.py (loaded at app init) and the
# entity modules. The class-name string is set once at app start by
# the model definitions — typo-prone if extended. Declared after the
# handlers it references because module-level dict literals evaluate
# at import time and need the names already bound.
_ChildBaselineHandler = Callable[[Session, Any, int], None]
_CHILD_BASELINE_HANDLERS: dict[str, _ChildBaselineHandler] = {
    "SqlaTable": _baseline_dataset_children,
    "Dashboard": _baseline_dashboard_children,
}


# ---------------------------------------------------------------------------
# Leaf builders: child-row insert and synthetic slice baseline
# ---------------------------------------------------------------------------


def _insert_child_baseline_rows(
    session: Session,
    parent_obj: Any,
    child_table: sa.Table,
    child_version_table: sa.Table,
    fk_column_name: str,
    tx_id: int,
) -> None:
    """Synthesize ``operation_type=0`` shadow rows for every live child of
    *parent_obj* under transaction id *tx_id*.

    Parallels :func:`_insert_baseline_row` but iterates over child rows. Used
    to give Continuum's ``Reverter`` baseline data for children of pre-existing
    parents (children that predate this commit have no shadow rows otherwise,
    so Reverter would treat them as "deleted at the target tx" and try to
    remove them on revert — the ADR-004 Failure 1 reproduction scenario).

    :param child_table: the live child SQLAlchemy ``Table`` (e.g.
        ``TableColumn.__table__`` or the bare ``dashboard_slices`` association)
    :param child_version_table: the corresponding Continuum shadow ``Table``
    :param fk_column_name: column on *child_table* that points to the parent
        (e.g. ``"table_id"`` for ``TableColumn``, ``"dashboard_id"`` for
        ``dashboard_slices``)
    """
    conn = session.connection()
    fk_col = getattr(child_table.c, fk_column_name)

    rows = (
        conn.execute(sa.select(child_table).where(fk_col == parent_obj.id))
        .mappings()
        .all()
    )
    if not rows:
        return

    meta_col_names = {"transaction_id", "end_transaction_id", "operation_type"}
    for row in rows:
        col_values: dict[Any, Any] = {}
        for col in child_version_table.columns:
            if col.name in meta_col_names:
                continue
            if col.name in row:
                col_values[col] = row[col.name]
        col_values[child_version_table.c.transaction_id] = tx_id
        col_values[child_version_table.c.end_transaction_id] = None
        col_values[child_version_table.c.operation_type] = 0
        conn.execute(child_version_table.insert().values(col_values))


def _baseline_attached_slices(
    session: Session, dashboard: Any, live_tbl: sa.Table, tx_id: int
) -> None:
    """Insert ``operation_type=0`` rows in ``slices_version`` for each
    slice attached to *dashboard* that has no shadow row yet.

    Batched: one membership SELECT, one existing-shadow SELECT, one live
    SELECT for the missing slices. Per-slice work happens only on
    ``_insert_synthetic_slice_baseline``. The previous per-slice
    ``COUNT(*)`` + ``SELECT`` pattern was O(N) round-trips and surfaced
    as a measurable first-save hotspot on dashboards with many charts.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    slice_ver_table = version_class(Slice).__table__
    slice_table = Slice.__table__
    conn = session.connection()

    attached_slice_ids = [
        r.slice_id
        for r in conn.execute(
            sa.select(live_tbl.c.slice_id).where(
                live_tbl.c.dashboard_id == dashboard.id
            )
        ).all()
    ]
    if not attached_slice_ids:
        return

    existing_shadow_ids = {
        row[0]
        for row in conn.execute(
            sa.select(slice_ver_table.c.id.distinct()).where(
                slice_ver_table.c.id.in_(attached_slice_ids)
            )
        ).all()
    }
    missing_ids = [sid for sid in attached_slice_ids if sid not in existing_shadow_ids]
    if not missing_ids:
        return

    slice_rows = (
        conn.execute(sa.select(slice_table).where(slice_table.c.id.in_(missing_ids)))
        .mappings()
        .all()
    )
    for slice_row in slice_rows:
        _insert_synthetic_slice_baseline(conn, slice_ver_table, slice_row, tx_id)


def _insert_synthetic_slice_baseline(
    conn: Any, slice_ver_table: sa.Table, slice_row: Any, tx_id: int
) -> None:
    meta_col_names = {"transaction_id", "end_transaction_id", "operation_type"}
    col_values: dict[Any, Any] = {}
    for col in slice_ver_table.columns:
        if col.name in meta_col_names:
            continue
        if col.name in slice_row:
            col_values[col] = slice_row[col.name]
    col_values[slice_ver_table.c.transaction_id] = tx_id
    col_values[slice_ver_table.c.end_transaction_id] = None
    col_values[slice_ver_table.c.operation_type] = 0
    conn.execute(slice_ver_table.insert().values(col_values))
