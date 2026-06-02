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
"""Unit tests for ``_pin_audit_columns`` in ``superset.versioning.baseline``.

Locks in the SA-version-dependent semantic the helper relies on: calling
``attributes.flag_modified(parent, "changed_by_fk")`` causes SQLAlchemy
to include the in-memory value in the next UPDATE statement instead of
invoking the column's ``onupdate=callable`` default. This is the
mechanism that prevents a stale ``g.user.id`` from being written into
the parent's ``changed_by_fk`` when the synthetic flag-flush triggers
an UPDATE during an autoflush at a time when the test user has already
been deleted from ``ab_user`` (the original failure mode that motivated
``_pin_audit_columns``; see ``baseline.py`` docstring).

If a future SQLAlchemy version changes this behavior — i.e. ``onupdate``
fires even when the column is in dirty attribute history — this test
fails and the cascade returns. That's the invariant we're guarding.
"""

from __future__ import annotations

from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import declarative_base, Session


def _make_dummy_mapped_class() -> tuple[Any, sa.engine.Engine]:
    """Build a minimal mapped class with an ``onupdate=callable`` column,
    backed by an in-memory SQLite engine. Returns ``(cls, engine)``."""

    Base = declarative_base()  # noqa: N806 — SA convention

    # Mutable counter so we can assert how many times onupdate fired.
    onupdate_calls = {"count": 0}

    def _bump_counter() -> int:
        onupdate_calls["count"] += 1
        return 9999  # the value onupdate would write if it fires

    class Parent(Base):
        __tablename__ = "parent"
        id = sa.Column(sa.Integer, primary_key=True)
        description = sa.Column(sa.Text)
        changed_by_fk = sa.Column(sa.Integer, onupdate=_bump_counter)

    Parent._onupdate_calls = onupdate_calls  # type: ignore[attr-defined]
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return Parent, engine


def test_flag_modified_suppresses_onupdate_callable() -> None:
    """The contract ``_pin_audit_columns`` depends on: when an attribute
    is marked dirty via ``flag_modified``, SQLAlchemy uses the in-memory
    value rather than invoking the column's ``onupdate=callable``.

    The cascade fixed in sc-103156 T062 (and in PR #40451's discussion)
    relied on this exact behavior — without it, the synthetic UPDATE that
    ``_force_parent_dirty_on_child_change`` triggers would stamp
    ``changed_by_fk`` with whatever ``get_user_id()`` resolves to at flush
    time, including stale user ids from a teardown autoflush.

    Setup note: uses ``expire_on_commit=False`` so the column stays
    loaded in instance state after the initial commit. This mirrors the
    listener's real-world flow, where the parent's attributes are
    already loaded (the listener reads them via ``getattr`` before
    calling ``flag_modified``, which forces a load). In the
    ``expire_on_commit=True`` path the attribute would be expired and
    ``flag_modified`` would raise ``InvalidRequestError`` — that case
    is the production path ``_pin_audit_columns`` catches and skips
    (covered in ``test_pin_audit_columns_tolerates_invalid_request_error``).
    """
    from sqlalchemy.orm import attributes, sessionmaker

    parent_cls, engine = _make_dummy_mapped_class()
    Parent = parent_cls  # noqa: N806 — declarative class, capitalized intentionally
    session_factory = sessionmaker(engine, expire_on_commit=False)
    with session_factory() as session:
        # Seed with a valid value (mimics a row that was committed earlier
        # with a real ``g.user.id``).
        parent = Parent(id=1, description="initial", changed_by_fk=42)
        session.add(parent)
        session.commit()

        # Now: edit ``description`` (the column the listener actually
        # flags) and pin ``changed_by_fk`` via ``flag_modified``.
        parent.description = "edited"
        attributes.flag_modified(parent, "changed_by_fk")

        baseline_count = Parent._onupdate_calls["count"]
        session.commit()

        # Re-read from a fresh session (no shared identity map) to check
        # what was actually written to the database.
        with Session(engine) as fresh:
            row = fresh.get(Parent, 1)
            assert row is not None
            # The invariant: ``changed_by_fk`` carries the in-memory
            # value (``42``), not the onupdate-callable's return (``9999``).
            assert row.changed_by_fk == 42, (
                f"Expected in-memory value 42, got {row.changed_by_fk} — "
                "SA may have changed flag_modified semantics; "
                "_pin_audit_columns would no longer suppress get_user_id()"
            )

        # And the onupdate callable was NOT invoked.
        assert Parent._onupdate_calls["count"] == baseline_count, (
            "onupdate fired despite the column being flag_modified — "
            "SA version regression"
        )


def test_onupdate_does_fire_without_flag_modified() -> None:
    """Sanity check / negative case: without ``flag_modified``, the
    ``onupdate`` callable DOES fire on a regular update. Pins the half
    of the contract we DON'T want for ``_pin_audit_columns``."""
    from sqlalchemy.orm import sessionmaker

    parent_cls, engine = _make_dummy_mapped_class()
    Parent = parent_cls  # noqa: N806 — declarative class, capitalized intentionally
    session_factory = sessionmaker(engine, expire_on_commit=False)
    with session_factory() as session:
        parent = Parent(id=1, description="initial", changed_by_fk=42)
        session.add(parent)
        session.commit()

        # Edit ``description``; do NOT touch ``changed_by_fk``.
        parent.description = "edited"
        baseline_count = Parent._onupdate_calls["count"]
        session.commit()

        # Confirm onupdate fired exactly once.
        assert Parent._onupdate_calls["count"] == baseline_count + 1

        with Session(engine) as fresh:
            row = fresh.get(Parent, 1)
            assert row is not None
            # And the value was overwritten by the onupdate callable.
            assert row.changed_by_fk == 9999


def test_pin_audit_columns_skips_missing_attribute() -> None:
    """``_pin_audit_columns`` must tolerate parents that don't carry the
    audit attributes (e.g., a model variant without ``AuditMixin``).
    Uses a bare object so ``hasattr`` returns False."""
    # pylint: disable=import-outside-toplevel
    from superset.versioning.baseline import _pin_audit_columns

    class NoAuditMixin:
        pass

    parent = NoAuditMixin()
    # Must not raise.
    _pin_audit_columns(parent)


def test_pin_audit_columns_tolerates_invalid_request_error() -> None:
    """``_pin_audit_columns`` catches ``InvalidRequestError`` raised when
    an attribute is unloaded in instance state — e.g., on a freshly
    constructed ``session.new`` instance whose attribute defaults haven't
    fired yet. Without this guard, the listener would crash mid-flush
    on dataset INSERTs."""
    # pylint: disable=import-outside-toplevel
    from unittest.mock import patch

    from sqlalchemy.exc import InvalidRequestError

    from superset.versioning.baseline import _pin_audit_columns

    class _HasAuditCols:
        changed_by_fk = 1
        changed_on = None

    parent = _HasAuditCols()

    with patch(
        "superset.versioning.baseline.attributes.flag_modified",
        side_effect=InvalidRequestError("not loaded"),
    ) as mock_flag:
        # Must not raise — must swallow the InvalidRequestError per
        # attribute and keep going.
        _pin_audit_columns(parent)
        assert mock_flag.call_count == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
