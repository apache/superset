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
"""A child row added by foreign key alone (``SqlMetric(table_id=...)``) still
resolves to its dataset, so the versioning hooks can give that save a new
dataset version."""

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any

from sqlalchemy import Column, event, ForeignKeyConstraint, Integer
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.orm.session import Session

from superset.versioning.baseline.collection import (
    child_to_parent_registry,
    resolve_parent,
)


def _dataset(session: Session, name: str = "t") -> Any:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    dataset = SqlaTable(
        table_name=name,
        database=Database(database_name=f"db_{name}", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()
    return dataset


@contextmanager
def _recorded_statements(session: Session) -> Iterator[list[str]]:
    statements: list[str] = []

    def record(*args: Any) -> None:
        statements.append(args[2])

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def _new_metric(dataset: Any) -> Any:
    from superset.connectors.sqla.models import SqlMetric

    return SqlMetric(metric_name="m", expression="COUNT(*)", table_id=dataset.id)


def test_new_metric_resolves_to_its_dataset_by_foreign_key(session: Session) -> None:
    dataset = _dataset(session)
    metric = _new_metric(dataset)
    session.add(metric)

    assert metric.table is None
    assert resolve_parent(session, metric, child_to_parent_registry()) is dataset


def test_lookup_of_a_loaded_dataset_issues_no_query(session: Session) -> None:
    dataset = _dataset(session)
    metric = _new_metric(dataset)
    session.add(metric)
    with _recorded_statements(session) as statements:
        assert resolve_parent(session, metric, child_to_parent_registry()) is dataset

    assert statements == []


def test_metric_removed_from_its_dataset_resolves_without_a_query(
    session: Session,
) -> None:
    """Removing a metric from ``dataset.metrics`` (delete-orphan) clears its
    ``table`` but keeps ``table_id`` until the flush; the dataset is the one
    being edited, so it's found in the identity map."""
    dataset = _dataset(session)
    metric = _new_metric(dataset)
    session.add(metric)
    session.flush()
    dataset.metrics.remove(metric)
    with _recorded_statements(session) as statements:
        assert metric.table is None
        assert resolve_parent(session, metric, child_to_parent_registry()) is dataset

    assert statements == []


def test_no_op_check_keeps_the_dataset_row_for_a_new_metric(session: Session) -> None:
    """The dataset's own columns are unchanged in a metric-only save, so the
    plugin would skip its version row unless it sees the new metric as the
    dataset's child."""
    from superset.versioning.factory import _has_dirty_versioned_children

    dataset = _dataset(session)
    other = _dataset(session, "other")
    metric = _new_metric(dataset)
    session.add(metric)
    uow = SimpleNamespace(operations={"insert": SimpleNamespace(target=metric)})

    assert _has_dirty_versioned_children(dataset, session, uow) is True
    assert _has_dirty_versioned_children(other, session, uow) is False


def test_child_without_a_foreign_key_resolves_to_nothing(session: Session) -> None:
    from superset.connectors.sqla.models import SqlMetric

    metric = SqlMetric(metric_name="m", expression="COUNT(*)")

    assert resolve_parent(session, metric, child_to_parent_registry()) is None


def test_parent_behind_a_multi_column_key_is_not_guessed(session: Session) -> None:
    base = declarative_base()

    class Parent(base):  # type: ignore[misc, valid-type]
        __tablename__ = "composite_parent"
        a = Column(Integer, primary_key=True)
        b = Column(Integer, primary_key=True)

    class Child(base):  # type: ignore[misc, valid-type]
        __tablename__ = "composite_child"
        __table_args__ = (
            ForeignKeyConstraint(
                ["parent_a", "parent_b"],
                ["composite_parent.a", "composite_parent.b"],
            ),
        )
        id = Column(Integer, primary_key=True)
        parent_a = Column(Integer)
        parent_b = Column(Integer)
        parent = relationship(Parent)

    child = Child(parent_a=1, parent_b=2)

    assert resolve_parent(session, child, {Child: ("parent", Parent)}) is None
