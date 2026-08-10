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
"""Tests for SoftDeleteMixin and the do_orm_execute visibility filter.

Synthetic models (``_SoftDeletable`` + ``_SoftDeletableTwo``) rather than
real Superset entities so the infrastructure is exercised in isolation
from any concrete adoption. Two soft-deletable models lets us pin
per-class scoping: a bypass for one class must not unhide soft-deleted
rows of the other.
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime
from unittest.mock import patch

import pytest
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import aliased, declarative_base, relationship
from sqlalchemy.orm.session import Session

from superset.models.helpers import (
    skip_visibility_filter,
    SKIP_VISIBILITY_FILTER_CLASSES,
    SoftDeleteMixin,
)

_TestBase = declarative_base()


class _SoftDeletable(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    """In-memory synthetic model for exercising SoftDeleteMixin."""

    __tablename__ = "_soft_deletable_test"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class _SoftDeletableTwo(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    """A second soft-deletable model so isolation tests can prove a
    bypass for one class does not affect the other."""

    __tablename__ = "_soft_deletable_test_two"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class _SoftDeletableParent(_TestBase):  # type: ignore[misc, valid-type]
    """A non-soft-deletable parent so relationship-load tests can verify
    that ``with_loader_criteria``'s ``propagate_to_loaders`` carries the
    per-class criteria along to lazy/selectin loads."""

    __tablename__ = "_soft_deletable_parent"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    children = relationship("_SoftDeletableChild", back_populates="parent")


class _SoftDeletableChild(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    __tablename__ = "_soft_deletable_child"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("_soft_deletable_parent.id"))
    parent = relationship("_SoftDeletableParent", back_populates="children")


@pytest.fixture
def _synthetic_tables(session: Session) -> Generator[None, None, None]:
    """Create the synthetic tables for the test session and drop them after."""
    _TestBase.metadata.create_all(session.get_bind())
    yield
    _TestBase.metadata.drop_all(session.get_bind())


@pytest.fixture(autouse=True)
def _soft_delete_gate_on() -> Generator[None, None, None]:
    """The ``do_orm_execute`` visibility listener is gated by the temporary
    ``SOFT_DELETE`` rollout flag, default off. These tests exercise
    the listener's filtering, so enable the gate for the whole module. The
    gate-off (listener-noop) behaviour is pinned separately by
    ``test_listener_noop_when_gate_off``.
    """
    with patch("superset.models.helpers.is_feature_enabled", return_value=True):
        yield


@pytest.mark.usefixtures("_synthetic_tables")
def test_soft_delete_sets_deleted_at(app_context: None, session: Session) -> None:
    """soft_delete() sets deleted_at to a non-null datetime."""
    obj = _SoftDeletable(name="row1")
    session.add(obj)
    session.flush()

    assert obj.deleted_at is None
    assert not obj.is_deleted

    obj.soft_delete()
    session.flush()

    assert obj.deleted_at is not None
    assert isinstance(obj.deleted_at, datetime)
    assert obj.is_deleted


@pytest.mark.usefixtures("_synthetic_tables")
def test_restore_clears_deleted_at(app_context: None, session: Session) -> None:
    """restore() clears deleted_at back to None."""
    obj = _SoftDeletable(name="row1")
    session.add(obj)
    session.flush()

    obj.soft_delete()
    session.flush()
    assert obj.is_deleted

    obj.restore()
    session.flush()
    assert obj.deleted_at is None
    assert not obj.is_deleted


@pytest.mark.usefixtures("_synthetic_tables")
def test_where_not_deleted_filter_clause(app_context: None, session: Session) -> None:
    """where_not_deleted() returns a SQL WHERE clause usable in queries."""
    active = _SoftDeletable(name="active")
    deleted = _SoftDeletable(name="deleted")
    session.add_all([active, deleted])
    session.flush()

    deleted.soft_delete()
    session.flush()

    results = (
        session.query(_SoftDeletable)
        .filter(_SoftDeletable.where_not_deleted())
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .all()
    )

    assert len(results) == 1
    assert results[0].name == "active"


@pytest.mark.usefixtures("_synthetic_tables")
def test_global_filter_excludes_soft_deleted_rows(
    app_context: None, session: Session
) -> None:
    """The do_orm_execute listener excludes soft-deleted rows by default."""
    obj = _SoftDeletable(name="will_be_deleted")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    result = (
        session.query(_SoftDeletable).filter(_SoftDeletable.id == obj_id).one_or_none()
    )
    assert result is None


@pytest.mark.usefixtures("_synthetic_tables")
def test_listener_noop_when_gate_off(app_context: None, session: Session) -> None:
    """With the ``SOFT_DELETE`` gate OFF, the listener attaches no criteria, so a
    soft-deleted row is NOT hidden — the substrate is dark. (While
    the gate is off the delete path also doesn't create such rows; this pins the
    listener side.)"""
    obj: _SoftDeletable = _SoftDeletable(name="visible_when_gate_off")
    session.add(obj)
    session.flush()
    obj_id: int = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    with patch("superset.models.helpers.is_feature_enabled", return_value=False):
        result: _SoftDeletable | None = (
            session.query(_SoftDeletable)
            .filter(_SoftDeletable.id == obj_id)
            .one_or_none()
        )
    assert result is not None
    assert result.id == obj_id


@pytest.mark.usefixtures("_synthetic_tables")
def test_listener_adapts_criteria_to_aliased_table_in_joins(
    app_context: None, session: Session
) -> None:
    """When the same soft-deletable table appears under an alias in a
    JOIN (e.g., ``slices AS chart``), the listener's loader_criteria
    must reference the **alias**, not the raw table name. Passing the
    criteria as ``Slice.deleted_at.is_(None)`` (a concrete SQL
    expression bound to the base class) renders as
    ``slices.deleted_at`` even when the statement aliases
    ``slices AS chart`` — producing
    ``Unknown column 'slices.deleted_at' in 'on clause'``. The fix is
    to pass the criteria as a lambda so SQLAlchemy adapts the column
    reference per occurrence.

    This regression test reproduces the FAB shape that surfaced the
    bug on the chart-rollout PR: a parent table joined to an aliased
    soft-deletable child. The query must run without
    ``OperationalError``.
    """
    parent_a = _SoftDeletableParent(name="p_with_child")
    child = _SoftDeletableChild(name="c1")
    parent_a.children = [child]
    session.add(parent_a)
    session.flush()
    session.expunge_all()

    # Alias the child so the JOIN renders as ``_soft_deletable_child AS
    # aliased_child`` — same shape as FAB's ``slices AS chart``.
    aliased_child = aliased(_SoftDeletableChild)
    results = (
        session.query(_SoftDeletableParent, aliased_child)
        .outerjoin(aliased_child, _SoftDeletableParent.id == aliased_child.parent_id)
        .all()
    )
    # Query must execute without OperationalError. The exact result
    # shape isn't the point — that the listener-attached criteria
    # references the alias rather than the raw table name is.
    assert len(results) == 1


@pytest.mark.usefixtures("_synthetic_tables")
def test_listener_does_not_affect_non_soft_deletable_queries(
    app_context: None, session: Session
) -> None:
    """Queries against a class that does NOT inherit ``SoftDeleteMixin``
    pass through the listener unchanged. The listener still iterates
    soft-delete subclasses and attaches a ``with_loader_criteria`` per
    class to every primary SELECT, but each is a no-op when the targeted
    class isn't in the statement. Pins that the listener does not
    silently break unrelated queries.
    """
    parent_a = _SoftDeletableParent(name="a")
    parent_b = _SoftDeletableParent(name="b")
    session.add_all([parent_a, parent_b])
    session.flush()

    rows = session.query(_SoftDeletableParent).order_by(_SoftDeletableParent.id).all()
    assert [r.name for r in rows] == ["a", "b"]


@pytest.mark.usefixtures("_synthetic_tables")
def test_per_query_class_bypass_returns_soft_deleted_rows(
    app_context: None, session: Session
) -> None:
    """Per-query bypass set on ``execution_options`` (scoped to a specific
    class) makes that class's soft-deleted rows visible. Used by
    ``BaseDAO.find_by_id(skip_visibility_filter=True)``,
    ``find_existing_for_import``, and ``raise_for_editorship``.
    """
    obj = _SoftDeletable(name="soon_deleted")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    visible = (
        session.query(_SoftDeletable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .filter(_SoftDeletable.id == obj_id)
        .one_or_none()
    )
    assert visible is not None
    assert visible.name == "soon_deleted"


@pytest.mark.usefixtures("_synthetic_tables")
def test_per_query_bypass_for_one_class_does_not_unhide_other(
    app_context: None, session: Session
) -> None:
    """A per-query bypass scoped to ``_SoftDeletable`` does not let a
    statement that also queries ``_SoftDeletableTwo`` see its soft-deleted
    rows. Pins per-class scoping at the listener level: the loader
    criteria evaluates the bypass set per concrete subclass, not as a
    blanket exemption.
    """
    one = _SoftDeletable(name="one")
    two = _SoftDeletableTwo(name="two")
    session.add_all([one, two])
    session.flush()
    one.soft_delete()
    two.soft_delete()
    session.flush()
    session.expire_all()

    # Bypass scoped to _SoftDeletable only.
    one_seen = (
        session.query(_SoftDeletable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .one_or_none()
    )
    assert one_seen is not None
    assert one_seen.name == "one"

    # Same execution_options on a query for the OTHER class. _SoftDeletableTwo
    # is not in the bypass set, so it stays filtered.
    two_seen = (
        session.query(_SoftDeletableTwo)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .one_or_none()
    )
    assert two_seen is None


@pytest.mark.usefixtures("_synthetic_tables")
def test_get_without_bypass_filters_out_soft_deleted_row(
    app_context: None, session: Session
) -> None:
    """Baseline: ``Query.get()`` without bypass does not find soft-deleted
    rows. ``session.expunge_all()`` empties the identity map so ``.get()``
    is forced to issue SQL through the listener.
    """
    obj = _SoftDeletable(name="hidden_by_listener")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expunge_all()

    result = session.query(_SoftDeletable).get(obj_id)
    assert result is None, (
        ".get() with no bypass and an empty identity map should be filtered "
        "by the listener"
    )


@pytest.mark.usefixtures("_synthetic_tables")
def test_per_query_bypass_via_get_finds_soft_deleted_row(
    app_context: None, session: Session
) -> None:
    """Per-query class bypass propagates through ``Query.get()`` — the
    path ``security_manager.raise_for_editorship`` relies on. Identity-map
    cleared via ``session.expunge_all()`` to force SQL through the
    listener.
    """
    obj = _SoftDeletable(name="per_query_via_get")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expunge_all()

    result = (
        session.query(_SoftDeletable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .get(obj_id)
    )

    assert result is not None, (
        "per-query class bypass should let .get() find soft-deleted row"
    )
    assert result.deleted_at is not None


@pytest.mark.usefixtures("_synthetic_tables")
def test_session_bypass_survives_query_reconstruction(
    app_context: None, session: Session
) -> None:
    """The FAB list-endpoint failure mode: a derived query is built from
    a fresh ``session.query(Model)`` (no ``execution_options``) and
    joined to a previously-filtered subquery. Per-query
    ``execution_options`` would not survive that construction. Per-session
    bypass via ``session.info`` does — because the listener reads from
    ``execute_state.session.info`` regardless of how the statement was
    built.
    """
    obj = _SoftDeletable(name="visible_via_session_bypass")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    # Set up a FAB-style fork: an "inner" query that selects the row's id
    # via the bypass, then an outer query that joins to the inner as a
    # subquery — but the outer query is built fresh from session.query()
    # and has NO execution_options on it. This is exactly the shape that
    # SQLAInterface.get_outer_query_from_inner_query produces.
    session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {_SoftDeletable}

    inner_subquery = (
        session.query(_SoftDeletable.id).filter(_SoftDeletable.id == obj_id).subquery()
    )
    outer = session.query(_SoftDeletable).join(
        inner_subquery, _SoftDeletable.id == inner_subquery.c.id
    )
    rows = outer.all()

    # Clean up so subsequent tests in the same session see a fresh state.
    session.info.pop(SKIP_VISIBILITY_FILTER_CLASSES, None)

    assert len(rows) == 1
    assert rows[0].id == obj_id
    assert rows[0].deleted_at is not None


@pytest.mark.usefixtures("_synthetic_tables")
def test_session_bypass_does_not_leak_across_classes(
    app_context: None, session: Session
) -> None:
    """A session-level bypass for ``_SoftDeletable`` only does NOT make
    soft-deleted ``_SoftDeletableTwo`` rows visible — even though both
    queries run on the same session that has the bypass flag set. The
    per-class scoping in the listener's loader-criteria lambda is what
    prevents this leak.
    """
    one = _SoftDeletable(name="one")
    two = _SoftDeletableTwo(name="two")
    session.add_all([one, two])
    session.flush()
    one.soft_delete()
    two.soft_delete()
    session.flush()
    session.expire_all()

    session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {_SoftDeletable}
    try:
        one_seen = session.query(_SoftDeletable).one_or_none()
        two_seen = session.query(_SoftDeletableTwo).one_or_none()
    finally:
        session.info.pop(SKIP_VISIBILITY_FILTER_CLASSES, None)

    assert one_seen is not None
    assert one_seen.name == "one"
    assert two_seen is None, (
        "_SoftDeletableTwo should still be filtered — only _SoftDeletable "
        "is in the bypass set"
    )


@pytest.mark.usefixtures("_synthetic_tables")
def test_context_manager_adds_and_removes_bypass(
    app_context: None, session: Session
) -> None:
    """``skip_visibility_filter`` context manager adds classes on entry,
    removes them on exit, restoring the prior visibility state.
    """
    obj = _SoftDeletable(name="cm_target")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    # Filtered before the block.
    assert (
        session.query(_SoftDeletable).filter(_SoftDeletable.id == obj_id).one_or_none()
        is None
    )

    # Visible inside the block.
    with skip_visibility_filter(session, _SoftDeletable):
        inside = (
            session.query(_SoftDeletable)
            .filter(_SoftDeletable.id == obj_id)
            .one_or_none()
        )
        assert inside is not None
        assert inside.id == obj_id

    # Filtered again after the block (state restored).
    session.expire_all()
    assert (
        session.query(_SoftDeletable).filter(_SoftDeletable.id == obj_id).one_or_none()
        is None
    )


@pytest.mark.usefixtures("_synthetic_tables")
def test_context_manager_nested_preserves_outer_scope(
    app_context: None, session: Session
) -> None:
    """Nested ``skip_visibility_filter`` blocks compose correctly: an
    inner block only removes the classes it added, so the outer block's
    bypass remains in effect after the inner exits.
    """
    one = _SoftDeletable(name="outer_target")
    two = _SoftDeletableTwo(name="inner_target")
    session.add_all([one, two])
    session.flush()
    one.soft_delete()
    two.soft_delete()
    session.flush()
    session.expire_all()

    with skip_visibility_filter(session, _SoftDeletable):
        # Outer bypass: _SoftDeletable visible, _SoftDeletableTwo still filtered.
        assert session.query(_SoftDeletable).one_or_none() is not None
        assert session.query(_SoftDeletableTwo).one_or_none() is None

        with skip_visibility_filter(session, _SoftDeletableTwo):
            # Both visible inside the inner block.
            session.expire_all()
            assert session.query(_SoftDeletable).one_or_none() is not None
            assert session.query(_SoftDeletableTwo).one_or_none() is not None

        # Inner exited — _SoftDeletableTwo back to filtered, outer still
        # in effect.
        session.expire_all()
        assert session.query(_SoftDeletable).one_or_none() is not None
        assert session.query(_SoftDeletableTwo).one_or_none() is None

    # Outermost exited — both filtered.
    session.expire_all()
    assert session.query(_SoftDeletable).one_or_none() is None
    assert session.query(_SoftDeletableTwo).one_or_none() is None


@pytest.mark.usefixtures("_synthetic_tables")
def test_relationship_load_filters_child_independently_of_parent_bypass(
    app_context: None, session: Session
) -> None:
    """``with_loader_criteria(..., propagate_to_loaders=True)`` carries
    the criteria *function* along to relationship loads, where it is
    re-evaluated per concrete child class. So even if the parent's
    statement is processed with a bypass set, a lazy/selectin load of
    soft-deletable children whose class is NOT in the bypass set still
    gets filtered.
    """
    parent = _SoftDeletableParent(name="p")
    live_child = _SoftDeletableChild(name="live")
    deleted_child = _SoftDeletableChild(name="deleted")
    parent.children = [live_child, deleted_child]
    session.add(parent)
    session.flush()
    deleted_child.soft_delete()
    session.flush()
    session.expunge_all()

    # Parent itself isn't soft-deletable; bypass set has no effect on the
    # parent query. But _SoftDeletableChild is soft-deletable, and is NOT
    # in the bypass set, so children should be filtered via propagation.
    session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {_SoftDeletable}
    try:
        p = session.query(_SoftDeletableParent).first()
        assert p is not None
        kids = list(p.children)
    finally:
        session.info.pop(SKIP_VISIBILITY_FILTER_CLASSES, None)

    assert [c.name for c in kids] == ["live"]


@pytest.mark.usefixtures("_synthetic_tables")
def test_session_delete_permanently_removes_row(
    app_context: None, session: Session
) -> None:
    """session.delete() permanently removes the row (hard delete). The
    mixin does not intercept session.delete() — that is handled by
    BaseDAO.delete() routing to soft_delete() at the DAO level."""
    obj = _SoftDeletable(name="hard_delete_test")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    session.delete(obj)
    session.flush()
    session.expire_all()

    result = (
        session.query(_SoftDeletable)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {_SoftDeletable}})
        .filter(_SoftDeletable.id == obj_id)
        .one_or_none()
    )
    assert result is None
