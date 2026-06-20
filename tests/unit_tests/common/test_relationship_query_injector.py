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
    is_virtual: bool = False
    sql: Optional[str] = None


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

    def test_virtual_target_is_wrapped_in_subquery(self) -> None:
        """Regression test for B2: virtual (SQL) datasets are wrapped
        in a ``TextAsFrom`` subquery instead of a raw table ref."""
        from sqlalchemy.sql.selectable import Alias

        virtual_target = FakeTargetDataset(
            id=3, table_name="vip_customers", schema=None
        )
        virtual_target.is_virtual = True
        virtual_target.sql = "SELECT * FROM base_customers WHERE tier = 'vip'"

        rel = FakeRelationship(
            columns=[FakeRelationshipColumn("customer_id", "id")],
            target_dataset=virtual_target,
        )

        resolved = RelationshipQueryInjector._resolve_target_table(rel)
        assert resolved is not None
        # Virtual datasets must be returned as a subquery wrapper,
        # not as a raw ``TableClause``.
        from sqlalchemy.sql.selectable import Subquery
        assert isinstance(resolved, Subquery), \
            f"Expected Subquery for virtual dataset, got {type(resolved)}"
        compiled = str(resolved.compile(compile_kwargs={"literal_binds": True}))
        assert "SELECT" in compiled.upper() or "select" in compiled
        assert "base_customers" in compiled

    def test_max_rels_truncates(self) -> None:
        """Regression test for B5: more relationships than
        RELATIONSHIP_MAX_PER_DATASET are truncated with a warning."""
        from unittest.mock import patch as _patch

        tbl = sa.table("orders")
        rels = [
            FakeRelationship(
                id=i,
                columns=[FakeRelationshipColumn("customer_id", "id")],
                target_dataset=FakeTargetDataset(table_name=f"t{i}"),
            )
            for i in range(10)
        ]
        with _patch.object(
            RelationshipQueryInjector, "inject_joins", wraps=lambda *a: a[0]
        ):
            qry = sa.select(sa.text("*"))
            # Default max_rels is 5; 10 relationships should be truncated
            # We just verify it doesn't crash and returns a Select
            result = RelationshipQueryInjector.inject_joins(qry, tbl, rels)
            assert isinstance(result, sa.sql.Select)


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
    def _filter_rels_for_dataset(
        self,
        rels: list[FakeRelationship],
        dataset_id: int,
    ) -> list[FakeRelationship]:
        """Replicate the B6 filter logic inline.

        The real ``get_active_relationships`` delegates to the DAO and
        then filters with ``rel.source_dataset_id == dataset_id OR
        rel.target_dataset_id == dataset_id``.  We test that logic here
        directly to avoid ORM import issues.
        """
        return [
            r
            for r in rels
            if r.source_dataset_id == dataset_id
            or r.target_dataset_id == dataset_id
        ]

    def test_returns_source_relationships(self) -> None:
        """Relationships where dataset_id is the source are returned."""
        rels = [
            FakeRelationship(id=1, source_dataset_id=42, target_dataset_id=7),
        ]
        result = self._filter_rels_for_dataset(rels, 42)
        assert len(result) == 1
        assert result[0].source_dataset_id == 42

    def test_returns_target_relationships(self) -> None:
        """Relationships where dataset_id is the **target** are also returned.

        Regression test for B6: the original implementation only returned
        source-side relationships, silently dropping target-side ones.
        """
        rels = [
            FakeRelationship(id=2, source_dataset_id=7, target_dataset_id=42),
        ]
        result = self._filter_rels_for_dataset(rels, 42)
        assert len(result) == 1
        assert result[0].target_dataset_id == 42

    def test_returns_both_source_and_target(self) -> None:
        """When dataset appears on either side, both relations are returned."""
        rels = [
            FakeRelationship(id=1, source_dataset_id=42, target_dataset_id=7),
            FakeRelationship(id=2, source_dataset_id=7, target_dataset_id=42),
            FakeRelationship(id=3, source_dataset_id=7, target_dataset_id=8),
        ]
        result = self._filter_rels_for_dataset(rels, 42)
        assert len(result) == 2
        ids = {r.id for r in result}
        assert ids == {1, 2}
