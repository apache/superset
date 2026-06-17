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
"""Unit tests for DatasetRelationshipDAO."""
from __future__ import annotations

import pytest
from sqlalchemy.orm.session import Session

from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationships import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)


@pytest.fixture(autouse=True)
def _create_tables(session: Session) -> None:
    """Ensure all required tables exist in the test DB."""
    DatasetRelationship.metadata.create_all(session.get_bind())  # pylint: disable=no-member


def _make_relationship(
    session: Session,
    source_id: int = 1,
    target_id: int = 2,
    relationship_type: str = "many_to_one",
    join_type: str = "LEFT",
    is_active: bool = True,
    columns: list[dict] | None = None,
) -> DatasetRelationship:
    """Helper to create a :class:`DatasetRelationship` in the session."""
    rel = DatasetRelationship(
        source_dataset_id=source_id,
        target_dataset_id=target_id,
        relationship_type=relationship_type,
        join_type=join_type,
        is_active=is_active,
    )
    for col_data in columns or [
        {"source_column_name": "col_a", "target_column_name": "col_b"}
    ]:
        rel.columns.append(DatasetRelationshipColumn(**col_data))
    session.add(rel)
    session.flush()
    return rel


# ── find_by_id ──────────────────────────────────────────────────────────


def test_find_by_id_returns_relationship(session: Session) -> None:
    rel = _make_relationship(session)
    found = DatasetRelationshipDAO.find_by_id(rel.id)
    assert found is not None
    assert found.id == rel.id
    assert found.source_dataset_id == 1
    assert len(found.columns) == 1


def test_find_by_id_returns_none_for_missing(session: Session) -> None:
    assert DatasetRelationshipDAO.find_by_id(9999) is None


# ── find_by_datasets ────────────────────────────────────────────────────


def test_find_by_datasets_returns_match(session: Session) -> None:
    _make_relationship(session, source_id=10, target_id=20)
    found = DatasetRelationshipDAO.find_by_datasets(10, 20)
    assert found is not None
    assert found.source_dataset_id == 10
    assert found.target_dataset_id == 20


def test_find_by_datasets_returns_none_when_no_match(session: Session) -> None:
    _make_relationship(session, source_id=10, target_id=20)
    assert DatasetRelationshipDAO.find_by_datasets(20, 10) is None


# ── find_active ─────────────────────────────────────────────────────────


def test_find_active_returns_only_active(session: Session) -> None:
    _make_relationship(session, source_id=1, target_id=2, is_active=True)
    _make_relationship(session, source_id=3, target_id=4, is_active=False)
    active = DatasetRelationshipDAO.find_active()
    assert len(active) == 1
    assert active[0].source_dataset_id == 1


# ── find_by_dataset_id ──────────────────────────────────────────────────


def test_find_by_dataset_id_returns_source_and_target(session: Session) -> None:
    _make_relationship(session, source_id=5, target_id=6)
    _make_relationship(session, source_id=7, target_id=5)
    results = DatasetRelationshipDAO.find_by_dataset_id(5)
    assert len(results) == 2


def test_find_by_dataset_id_active_only(session: Session) -> None:
    _make_relationship(session, source_id=5, target_id=6, is_active=True)
    _make_relationship(session, source_id=7, target_id=5, is_active=False)
    active = DatasetRelationshipDAO.find_by_dataset_id(5, active_only=True)
    assert len(active) == 1
    all_rels = DatasetRelationshipDAO.find_by_dataset_id(5, active_only=False)
    assert len(all_rels) == 2


# ── validate_uniqueness ─────────────────────────────────────────────────


def test_validate_uniqueness_passes_for_new_pair(session: Session) -> None:
    assert DatasetRelationshipDAO.validate_uniqueness(1, 2) is True


def test_validate_uniqueness_fails_for_existing_pair(session: Session) -> None:
    _make_relationship(session, source_id=1, target_id=2)
    assert DatasetRelationshipDAO.validate_uniqueness(1, 2) is False


def test_validate_uniqueness_excludes_self(session: Session) -> None:
    rel = _make_relationship(session, source_id=1, target_id=2)
    assert (
        DatasetRelationshipDAO.validate_uniqueness(1, 2, relationship_id=rel.id)
        is True
    )


# ── create ──────────────────────────────────────────────────────────────


def test_create_with_attributes(session: Session) -> None:
    rel = DatasetRelationshipDAO.create(
        attributes={
            "source_dataset_id": 100,
            "target_dataset_id": 200,
            "relationship_type": "one_to_many",
            "join_type": "INNER",
            "columns": [
                {
                    "source_column_name": "id",
                    "target_column_name": "fk_id",
                    "operator": "=",
                    "ordinal": 0,
                },
            ],
        }
    )
    session.flush()
    assert rel.id is not None
    assert rel.source_dataset_id == 100
    assert rel.relationship_type == "one_to_many"
    assert len(rel.columns) == 1
    assert rel.columns[0].source_column_name == "id"


# ── update ──────────────────────────────────────────────────────────────


def test_update_attributes(session: Session) -> None:
    rel = _make_relationship(session)
    updated = DatasetRelationshipDAO.update(
        item=rel,
        attributes={"join_type": "INNER", "is_active": False},
    )
    session.flush()
    assert updated.join_type == "INNER"
    assert updated.is_active is False


def test_update_replaces_columns(session: Session) -> None:
    rel = _make_relationship(session)
    assert len(rel.columns) == 1
    DatasetRelationshipDAO.update(
        item=rel,
        attributes={
            "columns": [
                {
                    "source_column_name": "new_src",
                    "target_column_name": "new_tgt",
                },
                {
                    "source_column_name": "src2",
                    "target_column_name": "tgt2",
                    "ordinal": 1,
                },
            ]
        },
    )
    session.flush()
    assert len(rel.columns) == 2
    assert rel.columns[0].source_column_name == "new_src"


# ── delete ──────────────────────────────────────────────────────────────


def test_delete_removes_relationship(session: Session) -> None:
    rel = _make_relationship(session, source_id=50, target_id=60)
    rel_id = rel.id
    DatasetRelationshipDAO.delete([rel])
    session.flush()
    assert DatasetRelationshipDAO.find_by_id(rel_id) is None
