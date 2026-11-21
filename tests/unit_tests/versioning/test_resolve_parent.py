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

from sqlalchemy import Column, ForeignKeyConstraint, Integer
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.orm.session import Session

from superset.versioning.baseline.collection import (
    child_to_parent_registry,
    resolve_parent,
)


def test_new_metric_resolves_to_its_dataset_by_foreign_key(session: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    dataset = SqlaTable(
        table_name="t",
        database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()

    metric = SqlMetric(metric_name="m", expression="COUNT(*)", table_id=dataset.id)
    session.add(metric)

    assert metric.table is None
    assert resolve_parent(session, metric, child_to_parent_registry()) is dataset


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
