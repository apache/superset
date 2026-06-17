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
"""Same-database JOIN injection for the Dataset Relationship Engine.

When two related datasets reside in the **same** database, we can push the
JOIN down to the SQL engine rather than pulling both result sets into Pandas.
:class:`RelationshipQueryInjector` takes an existing SQLAlchemy ``Select``
object and the active :class:`DatasetRelationship` instances and returns a new
``Select`` that includes the appropriate ``JOIN … ON …`` clauses.

Typical usage::

    from superset.common.relationship_query_injector import (
        RelationshipQueryInjector,
    )

    injector = RelationshipQueryInjector()
    relationships = injector.get_active_relationships(dataset_id=42)
    if relationships:
        new_select = injector.inject_joins(
            sqla_query=original_select,
            source_table=source_tbl,
            relationships=relationships,
        )
"""

from __future__ import annotations

import logging
from typing import Any, Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import Alias, TableClause

from superset.exceptions import SupersetException

if TYPE_CHECKING:
    from superset.models.dataset_relationships import (
        DatasetRelationship,
        DatasetRelationshipColumn,
    )

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class RelationshipInjectionError(SupersetException):
    """Raised when JOIN injection fails."""


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SUPPORTED_JOIN_TYPES = frozenset({
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
    "LEFT OUTER",
    "RIGHT OUTER",
    "FULL OUTER",
})

_SA_JOIN_FLAGS: dict[str, dict[str, bool]] = {
    "INNER": {"isouter": False, "full": False},
    "LEFT": {"isouter": True, "full": False},
    "LEFT OUTER": {"isouter": True, "full": False},
    "RIGHT": {"isouter": True, "full": False},  # see note below
    "RIGHT OUTER": {"isouter": True, "full": False},
    "FULL": {"isouter": True, "full": True},
    "FULL OUTER": {"isouter": True, "full": True},
}

# NOTE: SQLAlchemy's ``join()`` does not have a native ``RIGHT`` flag.
# For RIGHT JOINs we swap source/target operands so that a LEFT JOIN
# achieves the same semantics.  This is handled in ``inject_joins()``.


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class RelationshipQueryInjector:
    """Detects active relationships and injects SQL JOINs.

    This class is stateless — all information it needs is passed explicitly
    through method parameters.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def get_active_relationships(
        dataset_id: int,
        active_only: bool = True,
    ) -> list["DatasetRelationship"]:
        """Return all relationships where *dataset_id* is the source.

        Parameters
        ----------
        dataset_id:
            The primary-key of the source dataset (``SqlaTable.id``).
        active_only:
            When ``True`` (default), only relationships with
            ``is_active=True`` are returned.

        Returns
        -------
        list[DatasetRelationship]
            Relationships ordered by ``id``.
        """
        # Import inside method to avoid circular imports at module level.
        from superset.daos.dataset_relationship import DatasetRelationshipDAO

        relationships = DatasetRelationshipDAO.find_by_dataset_id(
            dataset_id=dataset_id,
            active_only=active_only,
        )

        # Filter to only relationships where the given dataset is the source
        return [
            rel for rel in relationships
            if rel.source_dataset_id == dataset_id
        ]

    @staticmethod
    def get_same_db_relationships(
        relationships: list["DatasetRelationship"],
    ) -> list["DatasetRelationship"]:
        """Filter relationships to those that are same-database.

        Parameters
        ----------
        relationships:
            Full list of relationships to filter.

        Returns
        -------
        list[DatasetRelationship]
            Only relationships where ``is_cross_database`` is ``False``.
        """
        return [rel for rel in relationships if not rel.is_cross_database]

    @staticmethod
    def get_cross_db_relationships(
        relationships: list["DatasetRelationship"],
    ) -> list["DatasetRelationship"]:
        """Filter relationships to those that are cross-database.

        Parameters
        ----------
        relationships:
            Full list of relationships to filter.

        Returns
        -------
        list[DatasetRelationship]
            Only relationships where ``is_cross_database`` is ``True``.
        """
        return [rel for rel in relationships if rel.is_cross_database]

    @classmethod
    def validate_join_type(cls, join_type: str) -> str:
        """Normalise and validate a join type string.

        Returns the uppercased, stripped value if valid; raises otherwise.
        """
        normalised = join_type.upper().strip()
        if normalised not in SUPPORTED_JOIN_TYPES:
            raise RelationshipInjectionError(
                f"Unsupported JOIN type '{join_type}'. "
                f"Supported: {sorted(SUPPORTED_JOIN_TYPES)}"
            )
        return normalised

    @classmethod
    def build_on_clause(
        cls,
        source_table: Any,
        target_table: Any,
        columns: list["DatasetRelationshipColumn"],
    ) -> ColumnElement:
        """Build the ``ON`` clause for a JOIN from relationship column pairs.

        Parameters
        ----------
        source_table:
            SQLAlchemy table/alias for the source dataset.
        target_table:
            SQLAlchemy table/alias for the target dataset.
        columns:
            The column pair definitions from the relationship model.

        Returns
        -------
        ColumnElement
            A compound ``AND`` expression suitable for a ``JOIN … ON``.

        Raises
        ------
        RelationshipInjectionError
            If no columns are provided or an unsupported operator is used.
        """
        if not columns:
            raise RelationshipInjectionError(
                "Cannot build ON clause: no column pairs defined."
            )

        conditions: list[ColumnElement] = []
        for col_pair in sorted(columns, key=lambda c: c.ordinal):
            src_col = sa.column(col_pair.source_column_name, _selectable=source_table)
            tgt_col = sa.column(col_pair.target_column_name, _selectable=target_table)

            operator = (col_pair.operator or "=").strip()
            condition = cls._make_condition(src_col, tgt_col, operator)
            conditions.append(condition)

        return sa.and_(*conditions) if len(conditions) > 1 else conditions[0]

    @classmethod
    def inject_joins(
        cls,
        sqla_query: Select,
        source_table: Any,
        relationships: list["DatasetRelationship"],
    ) -> Select:
        """Inject JOIN clauses into an existing SQLAlchemy ``Select``.

        Each relationship produces one additional JOIN against the target
        dataset's table.  The caller is responsible for ensuring that all
        relationships are **same-database**.

        Parameters
        ----------
        sqla_query:
            The original SQLAlchemy ``Select`` statement.
        source_table:
            The SQLAlchemy selectable for the primary (source) dataset.
        relationships:
            Active, same-database relationships to inject.

        Returns
        -------
        Select
            A new ``Select`` with the JOINs applied.
        """
        if not relationships:
            return sqla_query

        joined = source_table
        for rel in relationships:
            join_type = cls.validate_join_type(rel.join_type)
            target_tbl = cls._resolve_target_table(rel)

            if target_tbl is None:
                logger.warning(
                    "Could not resolve target table for relationship %s (id=%d). "
                    "Skipping JOIN injection.",
                    rel.name,
                    rel.id,
                )
                continue

            on_clause = cls.build_on_clause(
                source_table=source_table,
                target_table=target_tbl,
                columns=list(rel.columns),
            )

            sa_flags = _SA_JOIN_FLAGS.get(join_type, {"isouter": True, "full": False})

            # For RIGHT JOINs, swap operands and use LEFT JOIN semantics
            if join_type in ("RIGHT", "RIGHT OUTER"):
                logger.debug(
                    "RIGHT JOIN detected; swapping source/target for relationship %s",
                    rel.name,
                )
                joined = target_tbl.join(
                    joined,
                    onclause=on_clause,
                    isouter=True,
                    full=False,
                )
            else:
                joined = joined.join(
                    target_tbl,
                    onclause=on_clause,
                    **sa_flags,
                )

            logger.info(
                "Injected %s JOIN for relationship '%s' (id=%d) "
                "between dataset %d → %d",
                join_type,
                rel.name or "<unnamed>",
                rel.id,
                rel.source_dataset_id,
                rel.target_dataset_id,
            )

        # Replace the FROM clause of the original query
        new_query = sqla_query.select_from(joined)
        return new_query

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_target_table(
        relationship: "DatasetRelationship",
    ) -> Optional[TableClause | Alias]:
        """Return a SQLAlchemy selectable for the target dataset.

        For physical tables this is a simple ``sa.table()``; for virtual
        datasets the rendered SQL would need to be wrapped in a subquery.
        Currently only physical tables are supported.
        """
        target_ds = relationship.target_dataset
        if target_ds is None:
            return None

        # Build a fully-qualified table reference
        table_name = target_ds.table_name
        schema = target_ds.schema

        if schema:
            return sa.table(table_name, schema=schema)

        return sa.table(table_name)

    @staticmethod
    def _make_condition(
        left: ColumnElement,
        right: ColumnElement,
        operator: str,
    ) -> ColumnElement:
        """Translate an operator string into a SQLAlchemy binary expression."""
        op_map: dict[str, Any] = {
            "=": lambda l, r: l == r,
            "!=": lambda l, r: l != r,
            "<>": lambda l, r: l != r,
            "<": lambda l, r: l < r,
            ">": lambda l, r: l > r,
            "<=": lambda l, r: l <= r,
            ">=": lambda l, r: l >= r,
        }
        func = op_map.get(operator)
        if func is None:
            raise RelationshipInjectionError(
                f"Unsupported operator '{operator}' in column pair condition. "
                f"Supported: {sorted(op_map.keys())}"
            )
        return func(left, right)
