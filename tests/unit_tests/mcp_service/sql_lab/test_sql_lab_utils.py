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

"""Unit tests for MCP SQL Lab utility functions."""

from superset.mcp_service.sql_lab.sql_lab_utils import _apply_limit
from superset.sql.parse import SQLScript


class TestSQLScriptMutationDetection:
    """Tests for SQLScript.has_mutation() used in query type detection."""

    def test_simple_select_no_mutation(self):
        """Test simple SELECT query is not a mutation."""
        script = SQLScript("SELECT * FROM table1", "sqlite")
        assert script.has_mutation() is False

    def test_cte_query_no_mutation(self):
        """Test CTE (WITH clause) query is not a mutation."""
        cte_sql = """
        WITH cte_name AS (
            SELECT * FROM table1
        )
        SELECT * FROM cte_name
        """
        script = SQLScript(cte_sql, "sqlite")
        assert script.has_mutation() is False

    def test_recursive_cte_no_mutation(self):
        """Test recursive CTE is not a mutation."""
        recursive_cte = """
        WITH RECURSIVE cte AS (
            SELECT 1 AS n
            UNION ALL
            SELECT n + 1 FROM cte WHERE n < 10
        )
        SELECT n FROM cte
        """
        script = SQLScript(recursive_cte, "sqlite")
        assert script.has_mutation() is False

    def test_multiple_ctes_no_mutation(self):
        """Test query with multiple CTEs is not a mutation."""
        multiple_ctes = """
        WITH
            cte1 AS (SELECT 1 as a),
            cte2 AS (SELECT 2 as b)
        SELECT * FROM cte1, cte2
        """
        script = SQLScript(multiple_ctes, "sqlite")
        assert script.has_mutation() is False

    def test_insert_is_mutation(self):
        """Test INSERT query is a mutation."""
        script = SQLScript("INSERT INTO table1 VALUES (1)", "sqlite")
        assert script.has_mutation() is True

    def test_update_is_mutation(self):
        """Test UPDATE query is a mutation."""
        script = SQLScript("UPDATE table1 SET col = 1", "sqlite")
        assert script.has_mutation() is True

    def test_delete_is_mutation(self):
        """Test DELETE query is a mutation."""
        script = SQLScript("DELETE FROM table1", "sqlite")
        assert script.has_mutation() is True

    def test_create_is_mutation(self):
        """Test CREATE query is a mutation."""
        script = SQLScript("CREATE TABLE table1 (id INT)", "sqlite")
        assert script.has_mutation() is True


class TestApplyLimit:
    """Tests for _apply_limit function."""

    def test_adds_limit_to_select(self):
        """Test LIMIT is added to SELECT query."""
        result = _apply_limit("SELECT * FROM table1", 100)
        assert result == "SELECT * FROM table1 LIMIT 100"

    def test_adds_limit_to_cte(self):
        """Test LIMIT is added to CTE query."""
        cte_sql = "WITH cte AS (SELECT 1) SELECT * FROM cte"
        result = _apply_limit(cte_sql, 50)
        assert result == "WITH cte AS (SELECT 1) SELECT * FROM cte LIMIT 50"

    def test_removes_trailing_semicolon(self):
        """Test trailing semicolon is removed before adding LIMIT."""
        result = _apply_limit("SELECT * FROM table1;", 100)
        assert result == "SELECT * FROM table1 LIMIT 100"

    def test_preserves_existing_limit(self):
        """Test existing LIMIT is not modified."""
        sql = "SELECT * FROM table1 LIMIT 10"
        result = _apply_limit(sql, 100)
        assert result == sql

    def test_preserves_existing_limit_in_cte(self):
        """Test existing LIMIT in CTE query is not modified."""
        cte_sql = "WITH cte AS (SELECT 1) SELECT * FROM cte LIMIT 5"
        result = _apply_limit(cte_sql, 100)
        assert result == cte_sql

    def test_no_limit_on_insert(self):
        """Test LIMIT is not added to INSERT query."""
        sql = "INSERT INTO table1 VALUES (1)"
        result = _apply_limit(sql, 100)
        assert result == sql

    def test_no_limit_on_update(self):
        """Test LIMIT is not added to UPDATE query."""
        sql = "UPDATE table1 SET col = 1"
        result = _apply_limit(sql, 100)
        assert result == sql
