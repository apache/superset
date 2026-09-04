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
"""Tests for the examples importer: orchestration, transpilation, normalization."""

from unittest.mock import MagicMock, patch

from superset.commands.importers.v1.examples import transpile_virtual_dataset_sql
from superset.examples.utils import _normalize_dataset_schema


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
    """Test successful SQL transpilation with source engine."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "mysql"
    mock_db.session.query.return_value.get.return_value = mock_database

    mock_transpile.return_value = "SELECT * FROM `foo`"

    config = {
        "table_name": "my_table",
        "sql": "SELECT * FROM foo",
        "source_db_engine": "postgresql",
    }
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == "SELECT * FROM `foo`"
    mock_transpile.assert_called_once_with("SELECT * FROM foo", "mysql", "postgresql")


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_no_source_engine(mock_transpile, mock_db):
    """Test transpilation when source_db_engine is not specified (legacy)."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "mysql"
    mock_db.session.query.return_value.get.return_value = mock_database

    mock_transpile.return_value = "SELECT * FROM `foo`"

    # No source_db_engine - should default to None (generic dialect)
    config = {"table_name": "my_table", "sql": "SELECT * FROM foo"}
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == "SELECT * FROM `foo`"
    mock_transpile.assert_called_once_with("SELECT * FROM foo", "mysql", None)


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_no_change(mock_transpile, mock_db):
    """Test when transpilation returns same SQL (no dialect differences)."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "postgresql"
    mock_db.session.query.return_value.get.return_value = mock_database

    original_sql = "SELECT * FROM foo"
    mock_transpile.return_value = original_sql

    config = {
        "table_name": "my_table",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }
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

    mock_transpile.side_effect = QueryClauseValidationException("Parse error")

    original_sql = "SELECT SOME_POSTGRES_SPECIFIC_FUNCTION() FROM foo"
    config = {
        "table_name": "my_table",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }

    # Should not raise, should keep original SQL
    transpile_virtual_dataset_sql(config, 1)
    assert config["sql"] == original_sql


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_postgres_to_duckdb(mock_transpile, mock_db):
    """Test transpilation from PostgreSQL to DuckDB."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "duckdb"
    mock_db.session.query.return_value.get.return_value = mock_database

    original_sql = """
        SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt
        FROM orders WHERE status = 'completed' GROUP BY 1
    """
    transpiled_sql = """
        SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt
        FROM orders WHERE status = 'completed' GROUP BY 1
    """
    mock_transpile.return_value = transpiled_sql

    config = {
        "table_name": "monthly_orders",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == transpiled_sql
    mock_transpile.assert_called_once_with(original_sql, "duckdb", "postgresql")


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_postgres_to_clickhouse(mock_transpile, mock_db):
    """Test transpilation from PostgreSQL to ClickHouse.

    ClickHouse has different syntax for date functions, so this tests
    real dialect differences.
    """
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "clickhouse"
    mock_db.session.query.return_value.get.return_value = mock_database

    # PostgreSQL syntax
    original_sql = "SELECT DATE_TRUNC('month', created_at) AS month FROM orders"
    # ClickHouse uses toStartOfMonth instead
    transpiled_sql = "SELECT toStartOfMonth(created_at) AS month FROM orders"
    mock_transpile.return_value = transpiled_sql

    config = {
        "table_name": "monthly_orders",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == transpiled_sql
    mock_transpile.assert_called_once_with(original_sql, "clickhouse", "postgresql")


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_postgres_to_mysql(mock_transpile, mock_db):
    """Test transpilation from PostgreSQL to MySQL.

    MySQL uses backticks for identifiers and has different casting syntax.
    """
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "mysql"
    mock_db.session.query.return_value.get.return_value = mock_database

    # PostgreSQL syntax with :: casting
    original_sql = "SELECT created_at::DATE AS date_only FROM orders"
    # MySQL syntax with CAST
    transpiled_sql = "SELECT CAST(created_at AS DATE) AS date_only FROM `orders`"
    mock_transpile.return_value = transpiled_sql

    config = {
        "table_name": "orders_dates",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == transpiled_sql
    mock_transpile.assert_called_once_with(original_sql, "mysql", "postgresql")


@patch("superset.commands.importers.v1.examples.db")
@patch("superset.commands.importers.v1.examples.transpile_to_dialect")
def test_transpile_virtual_dataset_sql_postgres_to_sqlite(mock_transpile, mock_db):
    """Test transpilation from PostgreSQL to SQLite."""
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "sqlite"
    mock_db.session.query.return_value.get.return_value = mock_database

    original_sql = "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days'"
    transpiled_sql = (
        "SELECT * FROM orders WHERE created_at > DATETIME('now', '-7 days')"
    )
    mock_transpile.return_value = transpiled_sql

    config = {
        "table_name": "recent_orders",
        "sql": original_sql,
        "source_db_engine": "postgresql",
    }
    transpile_virtual_dataset_sql(config, 1)

    assert config["sql"] == transpiled_sql
    mock_transpile.assert_called_once_with(original_sql, "sqlite", "postgresql")


@patch(
    "superset.commands.importers.v1.examples.safe_insert_dashboard_chart_relationships"
)
@patch("superset.commands.importers.v1.examples.import_dashboard")
@patch("superset.commands.importers.v1.examples.import_chart")
@patch("superset.commands.importers.v1.examples.import_dataset")
@patch("superset.commands.importers.v1.examples.import_database")
def test_import_passes_ignore_permissions_to_all_importers(
    mock_import_db,
    mock_import_dataset,
    mock_import_chart,
    mock_import_dashboard,
    mock_safe_insert,
):
    """_import() must pass ignore_permissions=True to all importers.

    This is the key wiring test: the security bypass for system imports
    only works if _import() passes ignore_permissions=True to each
    sub-importer. Without this, SQLite example databases are blocked
    by PREVENT_UNSAFE_DB_CONNECTIONS.
    """
    from superset.commands.importers.v1.examples import ImportExamplesCommand

    db_uuid = "a2dc77af-e654-49bb-b321-40f6b559a1ee"
    dataset_uuid = "14f48794-ebfa-4f60-a26a-582c49132f1b"
    chart_uuid = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    dashboard_uuid = "dddddddd-dddd-dddd-dddd-dddddddddddd"

    # Mock database import
    mock_db_obj = MagicMock()
    mock_db_obj.uuid = db_uuid
    mock_db_obj.id = 1
    mock_import_db.return_value = mock_db_obj

    # Mock dataset import
    mock_dataset_obj = MagicMock()
    mock_dataset_obj.uuid = dataset_uuid
    mock_dataset_obj.id = 10
    mock_dataset_obj.table_name = "test_table"
    mock_import_dataset.return_value = mock_dataset_obj

    # Mock chart import
    mock_chart_obj = MagicMock()
    mock_chart_obj.uuid = chart_uuid
    mock_chart_obj.id = 100
    mock_import_chart.return_value = mock_chart_obj

    # Mock dashboard import
    mock_dashboard_obj = MagicMock()
    mock_dashboard_obj.id = 1000
    mock_import_dashboard.return_value = mock_dashboard_obj

    configs = {
        "databases/examples.yaml": {
            "uuid": db_uuid,
            "database_name": "examples",
            "sqlalchemy_uri": "sqlite:///test.db",
        },
        "datasets/examples/test.yaml": {
            "uuid": dataset_uuid,
            "table_name": "test_table",
            "database_uuid": db_uuid,
            "schema": None,
            "sql": None,
        },
        "charts/test/chart.yaml": {
            "uuid": chart_uuid,
            "dataset_uuid": dataset_uuid,
        },
        "dashboards/test.yaml": {
            "uuid": dashboard_uuid,
            "position": {},
        },
    }

    with patch(
        "superset.commands.importers.v1.examples.get_example_default_schema",
        return_value=None,
    ):
        with patch(
            "superset.commands.importers.v1.examples.find_chart_uuids",
            return_value=[],
        ):
            with patch(
                "superset.commands.importers.v1.examples.update_id_refs",
                return_value=configs["dashboards/test.yaml"],
            ):
                ImportExamplesCommand._import(configs)

    # Verify ALL importers received ignore_permissions=True
    mock_import_db.assert_called_once()
    assert mock_import_db.call_args[1].get("ignore_permissions") is True

    mock_import_dataset.assert_called_once()
    assert mock_import_dataset.call_args[1].get("ignore_permissions") is True

    mock_import_chart.assert_called_once()
    assert mock_import_chart.call_args[1].get("ignore_permissions") is True

    mock_import_dashboard.assert_called_once()
    assert mock_import_dashboard.call_args[1].get("ignore_permissions") is True


def test_normalize_dataset_schema_converts_main_to_null():
    """SQLite 'main' schema must be normalized to null in YAML content.

    This normalization happens in the YAML import path (utils.py), which is
    separate from the data_loading.py normalization. Both paths must handle
    SQLite's default 'main' schema correctly.
    """
    content = "table_name: test\nschema: main\nuuid: abc-123"
    result = _normalize_dataset_schema(content)
    assert "schema: null" in result
    assert "schema: main" not in result


def test_normalize_dataset_schema_preserves_other_schemas():
    """Non-'main' schemas should be left unchanged."""
    content = "table_name: test\nschema: public\nuuid: abc-123"
    result = _normalize_dataset_schema(content)
    assert "schema: public" in result


def test_normalize_dataset_schema_preserves_null_schema():
    """Already-null schemas should remain null."""
    content = "table_name: test\nschema: null\nuuid: abc-123"
    result = _normalize_dataset_schema(content)
    assert "schema: null" in result
