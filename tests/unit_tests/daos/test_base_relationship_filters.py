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

"""Tests for BaseDAO.apply_column_operators with relationship columns.

`apply_column_operators` historically only worked on scalar columns. When a
caller asked for `{col: "<m2m_relationship>", opr: "eq", value: <id>}` the
SQLAlchemy backend raised "Can't compare a collection to an object."

The behavior now: detect the relationship attribute and dispatch to
`column.any(<related_pk> == value)`, so callers can use the natural shape
for both scalar columns and m2m relationships.
"""

from unittest.mock import MagicMock

import pytest

from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum
from superset.models.slice import Slice


class _SliceDAO(BaseDAO[Slice]):
    """Tiny concrete DAO so we can exercise the BaseDAO logic against the
    real Slice model + its m2m `dashboards` relationship without standing up
    a full database."""

    model_cls = Slice
    filterable_relationships = frozenset({"dashboards"})


class _SliceDAONoRelationships(BaseDAO[Slice]):
    """Same model but with no relationships opted into discovery. Used to
    verify the default behavior (empty ``filterable_relationships``)
    keeps relationship columns out of the schema-discovery output."""

    model_cls = Slice


class TestApplyColumnOperatorsRelationship:
    """`apply_column_operators` handles m2m relationship columns via .any()."""

    def test_eq_on_relationship_dispatches_to_any(self):
        """`{col: 'dashboards', opr: 'eq', value: 42}` calls .any() on the
        relationship and compares the related model's PK to 42."""
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query

        result = _SliceDAO.apply_column_operators(
            mock_query,
            [ColumnOperator(col="dashboards", opr=ColumnOperatorEnum.eq, value=42)],
        )

        assert result is mock_query
        # We applied exactly one filter
        assert mock_query.filter.call_count == 1
        # And the argument is a SQLAlchemy BinaryExpression that survives
        # being passed to .filter() — we can't easily inspect its structure
        # without rendering SQL, but we can verify the dispatch happened
        # without raising.

    def test_eq_on_scalar_column_unchanged(self):
        """Non-relationship columns continue using the old scalar path."""
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query

        _SliceDAO.apply_column_operators(
            mock_query,
            [
                ColumnOperator(
                    col="slice_name", opr=ColumnOperatorEnum.eq, value="Revenue"
                )
            ],
        )
        assert mock_query.filter.call_count == 1

    def test_invalid_column_still_raises(self):
        """Columns that don't exist on the model raise ValueError as before."""
        mock_query = MagicMock()
        with pytest.raises(ValueError, match="does not exist on Slice"):
            _SliceDAO.apply_column_operators(
                mock_query,
                [
                    ColumnOperator(
                        col="does_not_exist", opr=ColumnOperatorEnum.eq, value=1
                    )
                ],
            )

    @pytest.mark.parametrize(
        "operator",
        [
            ColumnOperatorEnum.eq,
            ColumnOperatorEnum.ne,
            ColumnOperatorEnum.in_,
            ColumnOperatorEnum.nin,
            ColumnOperatorEnum.is_null,
            ColumnOperatorEnum.is_not_null,
        ],
    )
    def test_supported_relationship_operators_dispatch(self, operator):
        """eq/ne/in/nin/is_null/is_not_null all dispatch to .any() variants."""
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query

        _SliceDAO.apply_column_operators(
            mock_query,
            [ColumnOperator(col="dashboards", opr=operator, value=[1, 2])],
        )
        assert mock_query.filter.call_count == 1

    @pytest.mark.parametrize(
        "operator",
        [
            ColumnOperatorEnum.sw,
            ColumnOperatorEnum.ew,
            ColumnOperatorEnum.like,
            ColumnOperatorEnum.ilike,
            ColumnOperatorEnum.gt,
            ColumnOperatorEnum.gte,
            ColumnOperatorEnum.lt,
            ColumnOperatorEnum.lte,
        ],
    )
    def test_unsupported_relationship_operators_raise(self, operator):
        """sw/ew/like/ilike/gt/gte/lt/lte on a relationship raise a clear
        error instead of producing a cryptic SQLAlchemy error at query time."""
        mock_query = MagicMock()
        with pytest.raises(ValueError, match="not supported on relationship column"):
            _SliceDAO.apply_column_operators(
                mock_query,
                [ColumnOperator(col="dashboards", opr=operator, value="x")],
            )


class TestRelationshipFilterDiscovery:
    """`get_filterable_columns_and_operators` advertises relationship columns
    so schema discovery (get_schema) stays in sync with runtime behavior."""

    def test_dashboards_relationship_appears_in_filter_metadata(self):
        """get_schema(model_type='chart') will now show dashboards as a
        valid filter column. Previously the runtime accepted it but
        discovery didn't list it — an API contract mismatch."""
        filterable = _SliceDAO.get_filterable_columns_and_operators()
        assert "dashboards" in filterable, (
            "schema discovery should advertise the dashboards relationship"
        )

    def test_relationship_operators_match_runtime_dispatch(self):
        """The set of operators advertised for a relationship column matches
        the set ``_apply_relationship_filter`` actually handles. If these
        ever drift, callers following schema discovery will get runtime
        errors on operators that look valid."""
        filterable = _SliceDAO.get_filterable_columns_and_operators()
        ops = set(filterable["dashboards"])
        assert ops == {"eq", "ne", "in", "nin", "is_null", "is_not_null"}

    def test_relationships_not_advertised_by_default(self):
        """``filterable_relationships`` is empty by default — a DAO that
        does not opt-in keeps relationship columns out of discovery, so
        the consumer's ``Literal`` allowlist isn't contradicted by a
        wider discovery output."""
        filterable = _SliceDAONoRelationships.get_filterable_columns_and_operators()
        assert "dashboards" not in filterable
        assert "owners" not in filterable
        assert "tags" not in filterable

    def test_only_opted_in_relationships_advertised(self):
        """A DAO that opts into only specific relationships advertises
        exactly those, even if the model has additional collection
        relationships SQLAlchemy could reflect on."""
        filterable = _SliceDAO.get_filterable_columns_and_operators()
        # Slice has many collection relationships (owners, tags, dashboards,
        # ...). Only the opted-in one appears in discovery.
        assert "dashboards" in filterable
        assert "owners" not in filterable
        assert "tags" not in filterable

    def test_chart_dao_opts_into_dashboards(self):
        """ChartDAO is the production DAO behind ``list_charts``;
        verify it advertises exactly the same relationship the tool's
        ``ChartFilter.col`` Literal exposes."""
        from superset.daos.chart import ChartDAO

        filterable = ChartDAO.get_filterable_columns_and_operators()
        assert "dashboards" in filterable
        # Other relationships on Slice must not leak into discovery.
        assert "owners" not in filterable
        assert "tags" not in filterable
