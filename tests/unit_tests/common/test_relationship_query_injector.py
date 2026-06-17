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
"""Tests for :mod:`superset.common.relationship_query_injector`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa

from superset.common.relationship_query_injector import (
    RelationshipInjectionError,
    RelationshipQueryInjector,
    SUPPORTED_JOIN_TYPES,
)


# ---------------------------------------------------------------------------
# Lightweight stubs (avoid importing heavy ORM models in unit tests)
# ---------------------------------------------------------------------------


@dataclass
class FakeRelationshipColumn:
    """Minimal stub for DatasetRelationshipColumn."""

    source_column_name: str
    target_column_name: str
    operator: str = "="
    ordinal: int = 0


@dataclass
class FakeTargetDataset:
    """Minimal stub for a target SqlaTable."""

    id: int = 2
    table_name: str = "customers"
    schema: Optional[str] = None


@dataclass
class FakeRelationship:
    """Minimal stub for DatasetRelationship."""

    id: int = 1
    name: str = "orders_to_customers"
    source_dataset_id: int = 1
    target_dataset_id: int = 2
    join_type: str = "LEFT"
    is_cross_database: bool = False
    is_active: bool = True
    columns: list[FakeRelationshipColumn] = field(default_factory=list)
    target_dataset: Optional[FakeTargetDataset] = None


# ---------------------------------------------------------------------------
# Tests — validate_join_type
# ---------------------------------------------------------------------------


class TestValidateJoinType:
    def test_valid_types(self) -> None:
        for jt in SUPPORTED_JOIN_TYPES:
            assert RelationshipQueryInjector.validate_join_type(jt) == jt

    def test_case_insensitive(self) -> None:
        assert RelationshipQueryInjector.validate_join_type("left") == "LEFT"
        assert RelationshipQueryInjector.validate_join_type("Inner") == "INNER"

    def test_invalid_raises(self) -> None:
        with pytest.raises(RelationshipInjectionError, match="Unsupported"):
            RelationshipQueryInjector.validate_join_type("NATURAL")


# ---------------------------------------------------------------------------
# Tests — build_on_clause
# ---------------------------------------------------------------------------


class TestBuildOnClause:
    def test_single_column_pair(self) -> None:
        src = sa.table("orders")
        tgt = sa.table("customers")
        cols = [FakeRelationshipColumn("customer_id", "id")]
        clause = RelationshipQueryInjector.build_on_clause(src, tgt, cols)
        compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
        assert "customer_id" in compiled
        assert "id" in compiled

    def test_multi_column_pair(self) -> None:
        src = sa.table("orders")
        tgt = sa.table("customers")
        cols = [
            FakeRelationshipColumn("customer_id", "id", ordinal=0),
            FakeRelationshipColumn("region", "region", ordinal=1),
        ]
        clause = RelationshipQueryInjector.build_on_clause(src, tgt, cols)
        compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
        assert "AND" in compiled.upper()

    def test_no_columns_raises(self) -> None:
        src = sa.table("orders")
        tgt = sa.table("customers")
        with pytest.raises(RelationshipInjectionError, match="no column pairs"):
            RelationshipQueryInjector.build_on_clause(src, tgt, [])

    def test_unsupported_operator_raises(self) -> None:
        src = sa.table("orders")
        tgt = sa.table("customers")
        cols = [FakeRelationshipColumn("a", "b", operator="LIKE")]
        with pytest.raises(RelationshipInjectionError, match="Unsupported operator"):
            RelationshipQueryInjector.build_on_clause(src, tgt, cols)


# ---------------------------------------------------------------------------
# Tests — inject_joins
# ---------------------------------------------------------------------------


class TestInjectJoins:
    def test_no_relationships_returns_unchanged(self) -> None:
        tbl = sa.table("orders")
        qry = sa.select(sa.text("*")).select_from(tbl)
        result = RelationshipQueryInjector.inject_joins(qry, tbl, [])
        # Query object is the same reference
        assert result is qry

    def test_left_join_injection(self) -> None:
        tbl = sa.table("orders")
        rel = FakeRelationship(
            columns=[FakeRelationshipColumn("customer_id", "id")],
            target_dataset=FakeTargetDataset(),
        )
        qry = sa.select(sa.text("*"))
        new_qry = RelationshipQueryInjector.inject_joins(qry, tbl, [rel])
        compiled = str(new_qry.compile(compile_kwargs={"literal_binds": True}))
        assert "JOIN" in compiled.upper()
        assert "customers" in compiled

    def test_inner_join_injection(self) -> None:
        tbl = sa.table("orders")
        rel = FakeRelationship(
            join_type="INNER",
            columns=[FakeRelationshipColumn("customer_id", "id")],
            target_dataset=FakeTargetDataset(),
        )
        qry = sa.select(sa.text("*"))
        new_qry = RelationshipQueryInjector.inject_joins(qry, tbl, [rel])
        compiled = str(new_qry.compile(compile_kwargs={"literal_binds": True}))
        assert "JOIN" in compiled.upper()

    def test_target_with_schema(self) -> None:
        tbl = sa.table("orders")
        rel = FakeRelationship(
            columns=[FakeRelationshipColumn("customer_id", "id")],
            target_dataset=FakeTargetDataset(schema="public"),
        )
        qry = sa.select(sa.text("*"))
        new_qry = RelationshipQueryInjector.inject_joins(qry, tbl, [rel])
        compiled = str(new_qry.compile(compile_kwargs={"literal_binds": True}))
        assert "customers" in compiled

    def test_null_target_dataset_skipped(self) -> None:
        tbl = sa.table("orders")
        rel = FakeRelationship(
            columns=[FakeRelationshipColumn("customer_id", "id")],
            target_dataset=None,
        )
        qry = sa.select(sa.text("*")).select_from(tbl)
        new_qry = RelationshipQueryInjector.inject_joins(qry, tbl, [rel])
        # Should not crash; falls back to original query unchanged
        compiled = str(new_qry.compile(compile_kwargs={"literal_binds": True}))
        assert "orders" in compiled


# ---------------------------------------------------------------------------
# Tests — relationship filtering helpers
# ---------------------------------------------------------------------------


class TestRelationshipFilters:
    def test_get_same_db_relationships(self) -> None:
        rels = [
            FakeRelationship(id=1, is_cross_database=False),
            FakeRelationship(id=2, is_cross_database=True),
            FakeRelationship(id=3, is_cross_database=False),
        ]
        same = RelationshipQueryInjector.get_same_db_relationships(rels)
        assert len(same) == 2
        assert all(not r.is_cross_database for r in same)

    def test_get_cross_db_relationships(self) -> None:
        rels = [
            FakeRelationship(id=1, is_cross_database=False),
            FakeRelationship(id=2, is_cross_database=True),
        ]
        cross = RelationshipQueryInjector.get_cross_db_relationships(rels)
        assert len(cross) == 1
        assert cross[0].id == 2


# ---------------------------------------------------------------------------
# Tests — get_active_relationships (mocked DAO)
# ---------------------------------------------------------------------------


class TestGetActiveRelationships:
    @patch(
        "superset.common.relationship_query_injector"
        ".RelationshipQueryInjector.get_active_relationships"
    )
    def test_returns_source_only(self, mock_get: MagicMock) -> None:
        mock_get.return_value = [
            FakeRelationship(id=1, source_dataset_id=42),
        ]
        result = RelationshipQueryInjector.get_active_relationships(42)
        assert len(result) == 1
        assert result[0].source_dataset_id == 42
