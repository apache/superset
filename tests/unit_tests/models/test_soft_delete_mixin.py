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

These tests use a synthetic model (``_SoftDeletable``) rather than a real
Superset entity (Slice / Dashboard / SqlaTable). Real entities acquire
the mixin in their respective entity-rollout PRs; the infrastructure
itself is verified here in isolation.
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm.session import Session

from superset.models.helpers import SKIP_VISIBILITY_FILTER, SoftDeleteMixin

_TestBase = declarative_base()


class _SoftDeletable(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    """In-memory synthetic model for exercising SoftDeleteMixin."""

    __tablename__ = "_soft_deletable_test"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


@pytest.fixture
def _synthetic_table(session: Session) -> Generator[None, None, None]:
    """Create the synthetic table for the test session and drop it after."""
    _SoftDeletable.metadata.create_all(session.get_bind())
    yield
    _SoftDeletable.metadata.drop_all(session.get_bind())


@pytest.mark.usefixtures("_synthetic_table")
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


@pytest.mark.usefixtures("_synthetic_table")
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


@pytest.mark.usefixtures("_synthetic_table")
def test_not_deleted_filter_clause(app_context: None, session: Session) -> None:
    """not_deleted() returns a filter clause usable in queries."""
    active = _SoftDeletable(name="active")
    deleted = _SoftDeletable(name="deleted")
    session.add_all([active, deleted])
    session.flush()

    deleted.soft_delete()
    session.flush()

    results = (
        session.query(_SoftDeletable)
        .filter(_SoftDeletable.not_deleted())
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .all()
    )

    assert len(results) == 1
    assert results[0].name == "active"


@pytest.mark.usefixtures("_synthetic_table")
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


@pytest.mark.usefixtures("_synthetic_table")
def test_skip_visibility_filter_returns_soft_deleted_rows(
    app_context: None, session: Session
) -> None:
    """The skip_visibility_filter execution option makes soft-deleted rows
    visible (needed by restore commands and admin tooling)."""
    obj = _SoftDeletable(name="soon_deleted")
    session.add(obj)
    session.flush()
    obj_id = obj.id

    obj.soft_delete()
    session.flush()
    session.expire_all()

    visible = (
        session.query(_SoftDeletable)
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .filter(_SoftDeletable.id == obj_id)
        .one_or_none()
    )
    assert visible is not None
    assert visible.name == "soon_deleted"


@pytest.mark.usefixtures("_synthetic_table")
def test_get_without_bypass_filters_out_soft_deleted_row(
    app_context: None, session: Session
) -> None:
    """Baseline: ``Query.get()`` without the bypass option does not find
    soft-deleted rows. ``session.expunge_all()`` removes the instance
    from the identity map so ``.get()`` is forced to issue SQL through
    the listener (otherwise it short-circuits on the cached instance
    and never exercises the filter).
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


@pytest.mark.usefixtures("_synthetic_table")
def test_per_query_bypass_via_get_finds_soft_deleted_row(
    app_context: None, session: Session
) -> None:
    """The per-query ``execution_options(skip_visibility_filter=True)`` bypass
    propagates through ``Query.get()`` to the listener. This is the
    path ``security_manager.raise_for_ownership`` relies on so it can
    look up the resource's current owners even when the resource is
    soft-deleted.

    Uses ``session.expunge_all()`` rather than ``expire_all()`` so the
    instance is removed from the identity map entirely, forcing
    ``.get()`` to issue SQL through the listener — the path where the
    bypass actually matters.
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
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .get(obj_id)
    )

    assert result is not None, (
        "per-query bypass should let .get() find soft-deleted row"
    )
    assert result.deleted_at is not None


@pytest.mark.usefixtures("_synthetic_table")
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
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .filter(_SoftDeletable.id == obj_id)
        .one_or_none()
    )
    assert result is None
