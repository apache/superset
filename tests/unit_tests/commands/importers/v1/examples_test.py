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
"""Tests for the examples importer, specifically SQL transpilation."""

from unittest.mock import MagicMock, patch

from superset.commands.importers.v1.examples import transpile_virtual_dataset_sql


def test_transpile_virtual_dataset_sql_no_sql():
    """Test that configs without SQL are unchanged."""
    config = {"table_name": "my_table", "sql": None}
    transpile_virtual_dataset_sql(config, 1)
    assert config["sql"] is None


def test_transpile_virtual_dataset_sql_empty_sql():
    """Test that configs with empty SQL are unchanged."""
    config = {"table_name": "my_table", "sql": ""}
    transpile_virtual_dataset_sql(config, 1)
    assert config["sql"] == ""


@patch("superset.commands.importers.v1.examples.db")
def test_transpile_virtual_dataset_sql_database_not_found(mock_db):
    """Test graceful handling when database is not found."""
    mock_db.session.query.return_value.get.return_value = None

    config = {"table_name": "my_table", "sql": "SELECT * FROM foo"}
    original_sql = config["sql"]

    transpile_virtual_dataset_sql(config, 999)

    # SQL should remain unchanged
    assert config["sql"] == original_sql


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_success(mock_transpile, mock_db):
    """Test successful SQL transpilation."""
    # Setup mock database
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "mysql"
    mock_db.session.query.return_value.get.return_value = mock_database

    # Setup mock transpilation
    mock_transpile.return_value = "SELECT * FROM `foo`"

    config = {"table_name": "my_table", "sql": "SELECT * FROM foo"}
    transpile_virtual_dataset_sql(config, 1)

    # SQL should be transpiled
    assert config["sql"] == "SELECT * FROM `foo`"
    mock_transpile.assert_called_once_with("SELECT * FROM foo", "mysql")


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_no_change(mock_transpile, mock_db):
    """Test when transpilation returns same SQL (no dialect differences)."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "postgresql"
    mock_db.session.query.return_value.get.return_value = mock_database

    original_sql = "SELECT * FROM foo"
    mock_transpile.return_value = original_sql

    config = {"table_name": "my_table", "sql": original_sql}
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == original_sql


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_error_fallback(mock_transpile, mock_db):
    """Test graceful fallback when transpilation fails."""
    from superset.exceptions import QueryClauseValidationException

    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "mysql"
    mock_db.session.query.return_value.get.return_value = mock_database

    # Simulate transpilation failure
    mock_transpile.side_effect = QueryClauseValidationException("Parse error")

    original_sql = "SELECT SOME_POSTGRES_SPECIFIC_FUNCTION() FROM foo"
    config = {"table_name": "my_table", "sql": original_sql}

    # Should not raise, should keep original SQL
    transpile_virtual_dataset_sql(config, 1)
    assert config["sql"] == original_sql


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_complex_query(mock_transpile, mock_db):
    """Test transpilation of a more complex SQL query."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "duckdb"
    mock_db.session.query.return_value.get.return_value = mock_database

    original_sql = """
        SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count
        FROM orders
        WHERE status = 'completed'
        GROUP BY 1
    """
    transpiled_sql = """
        SELECT
            DATE_TRUNC('month', created_at) AS month,
            COUNT(*) AS count
        FROM orders
        WHERE status = 'completed'
        GROUP BY 1
    """
    mock_transpile.return_value = transpiled_sql

    config = {"table_name": "monthly_orders", "sql": original_sql}
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == transpiled_sql
    mock_transpile.assert_called_once_with(original_sql, "duckdb")
