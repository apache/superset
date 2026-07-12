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
"""Tests for version-change listener transaction lifecycle behavior."""

from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from superset.versioning.changes import listener
from superset.versioning.diff import ChangeRecord

Base: Any = sa.orm.declarative_base()


class LifecycleRow(Base):
    """Minimal row used to characterize SQLAlchemy session events."""

    __tablename__ = "versioning_listener_lifecycle"

    id = sa.Column(sa.Integer, primary_key=True)
    value = sa.Column(sa.String, nullable=False)


@pytest.fixture
def lifecycle_session() -> Iterator[Session]:
    """Yield an isolated SQLAlchemy session backed by in-memory SQLite."""
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_before_commit_can_force_final_flush_without_reentry(
    lifecycle_session: Session,
) -> None:
    """A before-commit finalizer can flush once before commit preparation."""
    events: list[str] = []

    @sa.event.listens_for(lifecycle_session, "before_flush")
    def before_flush(
        _session: Session, _flush_context: object, _instances: object
    ) -> None:
        events.append("before_flush")

    @sa.event.listens_for(lifecycle_session, "after_flush")
    def after_flush(_session: Session, _flush_context: object) -> None:
        events.append("after_flush")

    @sa.event.listens_for(lifecycle_session, "before_commit")
    def before_commit(session: Session) -> None:
        events.append("before_commit:start")
        session.flush()
        events.append("before_commit:end")

    lifecycle_session.add(LifecycleRow(value="saved"))
    lifecycle_session.commit()

    assert events == [
        "before_commit:start",
        "before_flush",
        "after_flush",
        "before_commit:end",
    ]


def test_before_commit_with_no_work_does_not_flush(
    lifecycle_session: Session,
) -> None:
    """A no-work commit invokes the finalizer without a flush cycle."""
    events: list[str] = []

    @sa.event.listens_for(lifecycle_session, "before_flush")
    def before_flush(
        _session: Session, _flush_context: object, _instances: object
    ) -> None:
        events.append("before_flush")

    @sa.event.listens_for(lifecycle_session, "before_commit")
    def before_commit(session: Session) -> None:
        events.append("before_commit")
        session.flush()

    lifecycle_session.commit()

    assert events == ["before_commit"]


def test_rollback_event_can_clear_transaction_state(
    lifecycle_session: Session,
) -> None:
    """Rollback cleanup runs while session-scoped state is still accessible."""
    state_key = "_versioning_test_state"
    lifecycle_session.info[state_key] = {"pending": True}

    @sa.event.listens_for(lifecycle_session, "after_rollback")
    def after_rollback(session: Session) -> None:
        session.info.pop(state_key, None)

    lifecycle_session.add(LifecycleRow(value="rolled back"))
    lifecycle_session.flush()
    lifecycle_session.rollback()

    assert state_key not in lifecycle_session.info


def test_capture_retains_the_first_pre_flush_state(
    lifecycle_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Repeated flushes retain the entity's initial database state once."""

    class Slice:
        id = 7

    entity = Slice()
    initial = {"slice_name": "initial"}
    captures: list[object] = []

    def capture(_session: Session, obj: object) -> dict[str, str]:
        captures.append(obj)
        return initial

    monkeypatch.setattr(listener, "capture_initial_state", capture)
    states: dict[tuple[str, int], tuple[object, dict[str, object]]] = {}

    listener._capture_dirty_entity_initial_state(lifecycle_session, entity, states)
    listener._capture_dirty_entity_initial_state(lifecycle_session, entity, states)

    assert states == {("chart", 7): (entity, initial)}
    assert captures == [entity]


def test_scalar_buffer_materializes_one_final_net_diff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Final materialization diffs each retained entity exactly once."""
    entity = object()
    initial = {"slice_name": "initial"}
    record = ChangeRecord(
        kind="property",
        operation="edit",
        path=["slice_name"],
        from_value="initial",
        to_value="final",
    )
    calls: list[tuple[object, dict[str, object]]] = []

    def compute(obj: object, pre_state: dict[str, object]) -> list[ChangeRecord]:
        calls.append((obj, pre_state))
        return [record]

    monkeypatch.setattr(listener, "compute_records_from_state", compute)

    buffer = listener._build_scalar_buffer({("chart", 7): (entity, initial)})

    assert buffer == {("chart", 7): [record]}
    assert calls == [(entity, initial)]


@pytest.mark.parametrize("terminal_event", ["commit", "rollback"])
def test_terminal_event_clears_transaction_state(
    lifecycle_session: Session, terminal_event: str
) -> None:
    """Commit and rollback cleanup discard all transaction-scoped state."""
    lifecycle_session.info.update(
        {
            listener.ACTION_KIND_KEY: "restore",
            listener.ACTION_META_KEY: {"headline": "restored"},
            listener._INITIAL_STATES_KEY: {("chart", 7): object()},
            listener._FINALIZING_KEY: True,
            "unrelated": "preserved",
        }
    )
    sa.event.listen(
        lifecycle_session,
        "after_transaction_end",
        listener._reset_after_outer_transaction,
    )
    lifecycle_session.add(LifecycleRow(value=terminal_event))
    lifecycle_session.flush()

    getattr(lifecycle_session, terminal_event)()

    assert lifecycle_session.info == {"unrelated": "preserved"}
