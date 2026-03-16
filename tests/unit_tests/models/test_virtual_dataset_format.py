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
"""
Tests for virtual dataset SQL handling with RLS and sqlglot formatting.

Two issues are covered:

1. **Unnecessary sqlglot round-trip** – ``get_from_clause()`` used to call
   ``format()`` even when no RLS rules applied, which could silently rewrite
   dialect-specific SQL (e.g. ``NVL`` → ``COALESCE`` on Redshift).

2. **RLS subquery alias mismatch** – ``RLSAsSubqueryTransformer`` used the
   fully-qualified table name (``"schema.table"``) as the subquery alias,
   which broke column references that used just the table name
   (``table.column``), producing Redshift errors like
   ``column "X" does not exist in virtual_table``.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from sqlalchemy.sql.elements import TextClause

from superset.models.helpers import ExploreMixin
from superset.sql.parse import RLSMethod, SQLStatement, Table

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def virtual_datasource() -> MagicMock:
    """
    Create a mock datasource that behaves like a virtual dataset.
    """
    datasource = MagicMock(spec=ExploreMixin)

    # Wire up real methods from ExploreMixin
    datasource.get_from_clause = ExploreMixin.get_from_clause.__get__(datasource)
    datasource.text = lambda sql: TextClause(sql)

    # Mock the database and db_engine_spec
    datasource.db_engine_spec.engine = "redshift"
    datasource.db_engine_spec.get_cte_query.return_value = None
    datasource.db_engine_spec.cte_alias = "__cte"
    datasource.database.get_default_schema.return_value = "public"
    datasource.catalog = None
    datasource.schema = "public"

    return datasource


def _set_virtual_sql(datasource: MagicMock, sql: str) -> None:
    """
    Configure the mock datasource to return the given SQL.
    """
    datasource.get_rendered_sql.return_value = sql


def _get_subquery_sql(datasource: MagicMock) -> str:
    """
    Run get_from_clause and extract the inner SQL from the virtual_table alias.
    """
    from_clause, _ = datasource.get_from_clause(template_processor=None)
    return str(from_clause.element).strip()


# ---------------------------------------------------------------------------
# 1. format() should only run when RLS predicates were actually applied
# ---------------------------------------------------------------------------


class TestVirtualDatasetNoRLS:
    """
    When no RLS predicates apply, the virtual dataset SQL must not be
    round-tripped through sqlglot's formatter.
    """

    @patch("superset.models.helpers.apply_rls", return_value=False)
    def test_sql_preserved_when_no_rls(
        self,
        mock_apply_rls: MagicMock,
        virtual_datasource: MagicMock,
        app: Flask,
    ) -> None:
        """
        The original SQL should be used verbatim when apply_rls returns False.
        """
        original_sql = "SELECT pen_id, is_green FROM public.pens"
        _set_virtual_sql(virtual_datasource, original_sql)

        inner_sql = _get_subquery_sql(virtual_datasource)
        assert inner_sql == original_sql

    @patch("superset.models.helpers.apply_rls", return_value=False)
    def test_redshift_nvl_preserved_when_no_rls(
        self,
        mock_apply_rls: MagicMock,
        virtual_datasource: MagicMock,
        app: Flask,
    ) -> None:
        """
        sqlglot rewrites ``NVL(a, b)`` → ``COALESCE(a, b)`` for Redshift.
        Without the fix the inner SQL would be silently rewritten.
        """
        original_sql = "SELECT pen_id, NVL(burn_flag, false) FROM pens"
        _set_virtual_sql(virtual_datasource, original_sql)

        inner_sql = _get_subquery_sql(virtual_datasource)
        assert "NVL" in inner_sql
        assert "COALESCE" not in inner_sql

    @patch("superset.models.helpers.apply_rls", return_value=False)
    def test_redshift_current_timestamp_preserved_when_no_rls(
        self,
        mock_apply_rls: MagicMock,
        virtual_datasource: MagicMock,
        app: Flask,
    ) -> None:
        """
        sqlglot rewrites ``current_timestamp`` → ``GETDATE()`` for Redshift.
        """
        original_sql = "SELECT pen_id, current_timestamp FROM pens"
        _set_virtual_sql(virtual_datasource, original_sql)

        inner_sql = _get_subquery_sql(virtual_datasource)
        assert "current_timestamp" in inner_sql
        assert "GETDATE" not in inner_sql

    @patch("superset.models.helpers.apply_rls", return_value=False)
    def test_redshift_cast_syntax_preserved_when_no_rls(
        self,
        mock_apply_rls: MagicMock,
        virtual_datasource: MagicMock,
        app: Flask,
    ) -> None:
        """
        sqlglot rewrites Redshift ``::`` cast syntax to ``CAST(... AS ...)``.
        """
        original_sql = (
            "SELECT pen_name::varchar(256) AS name, " "is_green FROM public.pens"
        )
        _set_virtual_sql(virtual_datasource, original_sql)

        inner_sql = _get_subquery_sql(virtual_datasource)
        assert "::varchar(256)" in inner_sql


class TestVirtualDatasetWithRLS:
    """
    When RLS predicates are applied, the SQL must be regenerated via
    sqlglot to serialize the AST modifications.
    """

    @patch("superset.models.helpers.apply_rls", return_value=True)
    def test_sql_reformatted_when_rls_applied(
        self,
        mock_apply_rls: MagicMock,
        virtual_datasource: MagicMock,
        app: Flask,
    ) -> None:
        """
        When apply_rls returns True, the SQL should be regenerated through
        sqlglot's format() to serialize the AST modifications.
        """
        original_sql = "SELECT pen_id, is_green FROM public.pens"
        _set_virtual_sql(virtual_datasource, original_sql)

        inner_sql = _get_subquery_sql(virtual_datasource)

        # After format(), sqlglot pretty-prints (adds newlines, etc.)
        assert inner_sql != original_sql
        # But the column must still be present
        assert "is_green" in inner_sql


# ---------------------------------------------------------------------------
# 2. apply_rls() return value
# ---------------------------------------------------------------------------


class TestApplyRlsReturnValue:
    """
    Test that apply_rls correctly reports whether predicates were applied.
    """

    def test_returns_false_when_no_tables(self, app: Flask) -> None:
        """
        apply_rls should return False when the statement has no tables.
        """
        from superset.utils.rls import apply_rls

        database = MagicMock()
        database.db_engine_spec.get_rls_method.return_value = MagicMock()
        database.get_default_catalog.return_value = None

        statement = MagicMock()
        statement.tables = []

        result = apply_rls(
            database=database,
            catalog=None,
            schema="public",
            parsed_statement=statement,
        )
        assert result is False

    @patch("superset.utils.rls.get_predicates_for_table")
    def test_returns_false_when_predicates_empty(
        self,
        mock_get_predicates: MagicMock,
        app: Flask,
    ) -> None:
        """
        apply_rls should return False when tables exist but have no RLS rules.
        """
        from superset.utils.rls import apply_rls

        mock_get_predicates.return_value = []

        database = MagicMock()
        database.db_engine_spec.get_rls_method.return_value = MagicMock()
        database.get_default_catalog.return_value = None

        mock_table = MagicMock()
        mock_table.qualify.return_value = Table("pens", "public", None)

        statement = MagicMock()
        statement.tables = [mock_table]

        result = apply_rls(
            database=database,
            catalog=None,
            schema="public",
            parsed_statement=statement,
        )
        assert result is False

    @patch("superset.utils.rls.get_predicates_for_table")
    def test_returns_true_when_predicates_exist(
        self,
        mock_get_predicates: MagicMock,
        app: Flask,
    ) -> None:
        """
        apply_rls should return True when RLS predicates are found.
        """
        from superset.utils.rls import apply_rls

        mock_get_predicates.return_value = ["user_id = 42"]

        database = MagicMock()
        database.db_engine_spec.get_rls_method.return_value = MagicMock()
        database.get_default_catalog.return_value = None

        mock_table = MagicMock()
        mock_table.qualify.return_value = Table("pens", "public", None)

        statement = MagicMock()
        statement.tables = [mock_table]
        statement.parse_predicate.return_value = MagicMock()

        result = apply_rls(
            database=database,
            catalog=None,
            schema="public",
            parsed_statement=statement,
        )
        assert result is True
        statement.apply_rls.assert_called_once()


# ---------------------------------------------------------------------------
# 3. RLS subquery alias must use just the table name, not schema-qualified
# ---------------------------------------------------------------------------


class TestRLSSubqueryAlias:
    """
    When RLSAsSubqueryTransformer replaces a table with a filtered subquery,
    the subquery alias must match what column references in the query expect.

    If the SQL says ``SELECT pens.col FROM public.pens``, the subquery
    must be aliased as ``"pens"`` (not ``"public.pens"``), otherwise
    ``pens.col`` won't resolve and Redshift returns::

        column "col" does not exist in virtual_table
    """

    def test_table_qualified_columns_no_alias(self, app: Flask) -> None:
        """
        Column references like ``pens.col`` must resolve after RLS wraps
        ``public.pens`` in a subquery.
        """
        sql = "SELECT pens.pen_id, pens.is_green " "FROM public.pens"
        statement = SQLStatement(sql, engine="redshift")
        predicate = statement.parse_predicate("user_id = 1")
        statement.apply_rls(
            None,
            "public",
            {Table("pens", "public", None): [predicate]},
            RLSMethod.AS_SUBQUERY,
        )
        result = statement.format()

        # The subquery alias must be just "pens", not "public.pens"
        assert 'AS "pens"' in result
        assert 'AS "public.pens"' not in result
        assert "pens.is_green" in result

    def test_catalog_schema_qualified_table_no_alias(self, app: Flask) -> None:
        """
        Even with a catalog-qualified table, the subquery alias should be
        just the table name so that ``table.col`` references still work.
        """
        sql = "SELECT pens.pen_id, pens.is_green " "FROM mycat.public.pens"
        statement = SQLStatement(sql, engine="redshift")
        predicate = statement.parse_predicate("user_id = 1")
        statement.apply_rls(
            None,
            "public",
            {Table("pens", "public", "mycat"): [predicate]},
            RLSMethod.AS_SUBQUERY,
        )
        result = statement.format()

        assert 'AS "pens"' in result
        assert 'AS "mycat.public.pens"' not in result

    def test_explicit_alias_preserved(self, app: Flask) -> None:
        """
        When the table already has an explicit alias, it should be reused.
        """
        sql = "SELECT p.pen_id, p.is_green FROM public.pens p"
        statement = SQLStatement(sql, engine="redshift")
        predicate = statement.parse_predicate("user_id = 1")
        statement.apply_rls(
            None,
            "public",
            {Table("pens", "public", None): [predicate]},
            RLSMethod.AS_SUBQUERY,
        )
        result = statement.format()

        assert "AS p" in result
        assert "p.is_green" in result

    def test_unqualified_columns_work(self, app: Flask) -> None:
        """
        Unqualified column references should work regardless of the alias.
        """
        sql = "SELECT pen_id, is_green FROM public.pens"
        statement = SQLStatement(sql, engine="redshift")
        predicate = statement.parse_predicate("user_id = 1")
        statement.apply_rls(
            None,
            "public",
            {Table("pens", "public", None): [predicate]},
            RLSMethod.AS_SUBQUERY,
        )
        result = statement.format()

        assert "is_green" in result
        assert "WHERE" in result  # RLS predicate applied
