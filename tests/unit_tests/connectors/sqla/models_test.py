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

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.exceptions import OAuth2RedirectError
from superset.models.core import Database
from superset.sql.parse import Table
from superset.superset_typing import QueryObjectDict


def test_query_bubbles_errors(mocker: MockerFixture) -> None:
    """
    Test that the `query` method bubbles exceptions correctly.

    When a user needs to authenticate via OAuth2 to access data, a custom exception is
    raised. The exception needs to bubble up all the way to the frontend as a SIP-40
    compliant payload with the error type `DATABASE_OAUTH2_REDIRECT_URI` so that the
    frontend can initiate the OAuth2 authentication.

    This tests verifies that the method does not capture these exceptions; otherwise the
    user will be never be prompted to authenticate via OAuth2.
    """
    database = mocker.MagicMock()
    database.get_df.side_effect = OAuth2RedirectError(
        url="http://example.com",
        tab_id="1234",
        redirect_uri="http://redirect.example.com",
    )

    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )
    mocker.patch.object(
        sqla_table,
        "get_query_str_extended",
        return_value=mocker.MagicMock(sql="SELECT * FROM my_sqla_table"),
    )
    query_obj: QueryObjectDict = {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "groupby": ["id", "username", "email"],
        "metrics": [],
        "is_timeseries": False,
        "filter": [],
    }
    with pytest.raises(OAuth2RedirectError):
        sqla_table.query(query_obj)


def test_permissions_without_catalog() -> None:
    """
    Test permissions when the table has no catalog.
    """
    database = Database(database_name="my_db")
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
        schema="schema1",
        catalog=None,
        id=1,
    )

    assert sqla_table.get_perm() == "[my_db].[my_sqla_table](id:1)"
    assert sqla_table.get_catalog_perm() is None
    assert sqla_table.get_schema_perm() == "[my_db].[schema1]"


def test_permissions_with_catalog() -> None:
    """
    Test permissions when the table with a catalog set.
    """
    database = Database(database_name="my_db")
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
        schema="schema1",
        catalog="db1",
        id=1,
    )

    assert sqla_table.get_perm() == "[my_db].[my_sqla_table](id:1)"
    assert sqla_table.get_catalog_perm() == "[my_db].[db1]"
    assert sqla_table.get_schema_perm() == "[my_db].[db1].[schema1]"


def test_query_datasources_by_name(mocker: MockerFixture) -> None:
    """
    Test the `query_datasources_by_name` method.
    """
    db = mocker.patch("superset.connectors.sqla.models.db")

    database = Database(database_name="my_db", id=1)
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )

    sqla_table.query_datasources_by_name(database, "my_table")
    db.session.query().filter_by.assert_called_with(
        database_id=1,
        table_name="my_table",
    )

    sqla_table.query_datasources_by_name(database, "my_table", "db1", "schema1")
    db.session.query().filter_by.assert_called_with(
        database_id=1,
        table_name="my_table",
        catalog="db1",
        schema="schema1",
    )


def test_query_datasources_by_permissions(mocker: MockerFixture) -> None:
    """
    Test the `query_datasources_by_permissions` method.
    """
    db = mocker.patch("superset.connectors.sqla.models.db")

    engine = create_engine("sqlite://")
    database = Database(database_name="my_db", id=1)
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )

    sqla_table.query_datasources_by_permissions(database, set(), set(), set())
    db.session.query().filter_by.assert_called_with(database_id=1)
    clause = db.session.query().filter_by().filter.mock_calls[0].args[0]
    assert str(clause.compile(engine, compile_kwargs={"literal_binds": True})) == ""


def test_query_datasources_by_permissions_with_catalog_schema(
    mocker: MockerFixture,
) -> None:
    """
    Test the `query_datasources_by_permissions` method passing a catalog and schema.
    """
    db = mocker.patch("superset.connectors.sqla.models.db")

    engine = create_engine("sqlite://")
    database = Database(database_name="my_db", id=1)
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )
    sqla_table.query_datasources_by_permissions(
        database,
        {"[my_db].[table1](id:1)"},
        {"[my_db].[db1]"},
        # pass as list to have deterministic order for test
        ["[my_db].[db1].[schema1]", "[my_other_db].[schema]"],  # type: ignore
    )
    clause = db.session.query().filter_by().filter.mock_calls[0].args[0]
    assert (
        str(clause.compile(engine, compile_kwargs={"literal_binds": True}))
        == (
            "tables.perm IN ('[my_db].[table1](id:1)') OR "
            "tables.schema_perm IN ('[my_db].[db1].[schema1]', '[my_other_db].[schema]') OR "  # noqa: E501
            "tables.catalog_perm IN ('[my_db].[db1]')"
        )
    )


def test_dataset_uniqueness(session: Session) -> None:
    """
    Test dataset uniqueness constraints.
    """
    Database.metadata.create_all(session.bind)

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")

    # add prod.schema.table
    dataset = SqlaTable(
        database=database,
        catalog="prod",
        schema="schema",
        table_name="table",
    )
    session.add(dataset)
    session.commit()

    # add dev.schema.table
    dataset = SqlaTable(
        database=database,
        catalog="dev",
        schema="schema",
        table_name="table",
    )
    session.add(dataset)
    session.commit()

    # try to add dev.schema.table again, fails
    dataset = SqlaTable(
        database=database,
        catalog="dev",
        schema="schema",
        table_name="table",
    )
    session.add(dataset)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    # add schema.table
    dataset = SqlaTable(
        database=database,
        catalog=None,
        schema="schema",
        table_name="table",
    )
    session.add(dataset)
    session.commit()

    # add schema.table again, works because in SQL `NULlL != NULL`
    dataset = SqlaTable(
        database=database,
        catalog=None,
        schema="schema",
        table_name="table",
    )
    session.add(dataset)
    session.commit()

    # but the DAO enforces application logic for uniqueness
    assert not DatasetDAO.validate_uniqueness(
        database,
        Table("table", "schema", None),
    )

    assert DatasetDAO.validate_uniqueness(
        database,
        Table("table", "schema", "some_catalog"),
    )


def test_normalize_prequery_result_type_custom_sql() -> None:
    """
    Test that the `_normalize_prequery_result_type` can hanndle custom SQL.
    """
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=Database(database_name="my_db", sqlalchemy_uri="sqlite://"),
    )
    row: pd.Series = {
        "custom_sql": "Car",
    }
    dimension: str = "custom_sql"
    columns_by_name: dict[str, TableColumn] = {
        "product_line": TableColumn(column_name="product_line"),
    }
    assert (
        sqla_table._normalize_prequery_result_type(row, dimension, columns_by_name)
        == "Car"
    )


def test_fetch_metadata_with_comment_field_new_columns(mocker: MockerFixture) -> None:
    """Test that fetch_metadata correctly assigns comment field to description
    for new columns
    """
    # Mock database
    database = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table
    table = SqlaTable(
        table_name="test_table",
        database=database,
    )

    # Mock external_metadata to return columns with comment fields
    mock_columns = [
        {
            "column_name": "id",
            "type": "INTEGER",
            "comment": "Primary key identifier",
        },
        {
            "column_name": "name",
            "type": "VARCHAR",
            "comment": "Full name of the user",
        },
        {
            "column_name": "status",
            "type": "VARCHAR",
            # No comment field for this column
        },
    ]

    # Mock dependencies
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch("superset.connectors.sqla.models.db.session")
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    # Execute fetch_metadata
    result = table.fetch_metadata()

    # Verify results
    assert len(result.added) == 3
    assert set(result.added) == {"id", "name", "status"}

    # Check that descriptions were set correctly from comments
    columns_by_name = {col.column_name: col for col in table.columns}

    assert columns_by_name["id"].description == "Primary key identifier"
    assert columns_by_name["name"].description == "Full name of the user"
    # Column without comment should have None description
    assert columns_by_name["status"].description is None


def test_fetch_metadata_with_comment_field_existing_columns(
    mocker: MockerFixture,
) -> None:
    """Test that fetch_metadata correctly updates description for existing columns"""
    # Mock database
    database = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table with existing columns
    table = SqlaTable(
        table_name="test_table_existing",
        database=database,
    )
    table.id = 1  # Set ID so it's treated as existing table

    # Create existing columns
    existing_col1 = TableColumn(
        column_name="id",
        type="INTEGER",
        table=table,
        description="Old description",
    )
    existing_col2 = TableColumn(
        column_name="name",
        type="VARCHAR",
        table=table,
    )
    table.columns = [existing_col1, existing_col2]

    # Mock external_metadata to return updated columns with comments
    mock_columns = [
        {
            "column_name": "id",
            "type": "INTEGER",
            "comment": "Updated primary key description",
        },
        {
            "column_name": "name",
            "type": "VARCHAR",
            "comment": "Updated name description",
        },
    ]

    # Mock dependencies
    mock_session = mocker.patch("superset.connectors.sqla.models.db.session")
    mock_session.query.return_value.filter.return_value.all.return_value = [
        existing_col1,
        existing_col2,
    ]
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    # Execute fetch_metadata
    result = table.fetch_metadata()

    # Verify no new columns were added
    assert len(result.added) == 0

    # Check that descriptions were updated from comments
    columns_by_name = {col.column_name: col for col in table.columns}

    assert columns_by_name["id"].description == "Updated primary key description"
    assert columns_by_name["name"].description == "Updated name description"


def test_fetch_metadata_mixed_comment_scenarios(mocker: MockerFixture) -> None:
    """Test fetch_metadata with mix of new/existing columns and with/without
    comments
    """
    # Mock database
    database = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table with one existing column
    table = SqlaTable(
        table_name="test_table_mixed",
        database=database,
    )
    table.id = 1

    existing_col = TableColumn(
        column_name="existing_col",
        type="INTEGER",
        table=table,
        description="Existing description",
    )
    table.columns = [existing_col]

    # Mock external_metadata with mixed scenarios
    mock_columns = [
        {
            "column_name": "existing_col",
            "type": "INTEGER",
            "comment": "Updated existing column comment",
        },
        {
            "column_name": "new_with_comment",
            "type": "VARCHAR",
            "comment": "New column with comment",
        },
        {
            "column_name": "new_without_comment",
            "type": "VARCHAR",
            # No comment field
        },
    ]

    # Mock dependencies
    mock_session = mocker.patch("superset.connectors.sqla.models.db.session")
    mock_session.query.return_value.filter.return_value.all.return_value = [
        existing_col
    ]
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    # Execute fetch_metadata
    result = table.fetch_metadata()

    # Check added columns
    assert len(result.added) == 2
    assert set(result.added) == {"new_with_comment", "new_without_comment"}

    # Check all column descriptions
    columns_by_name = {col.column_name: col for col in table.columns}

    # Existing column should have updated description
    assert (
        columns_by_name["existing_col"].description == "Updated existing column comment"
    )

    # New column with comment should have description set
    assert columns_by_name["new_with_comment"].description == "New column with comment"

    # New column without comment should have None description
    assert columns_by_name["new_without_comment"].description is None


def test_fetch_metadata_no_comment_field_safe_handling(
    mocker: MockerFixture,
) -> None:
    """Test that fetch_metadata safely handles columns with no comment field"""
    # Mock database
    database = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table
    table = SqlaTable(
        table_name="test_table_no_comments",
        database=database,
    )

    # Mock external_metadata with columns that have no comment fields
    mock_columns = [
        {"column_name": "col1", "type": "INTEGER"},
        {"column_name": "col2", "type": "VARCHAR"},
    ]

    # Mock dependencies
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch("superset.connectors.sqla.models.db.session")
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    # Execute fetch_metadata - should not raise any exceptions
    result = table.fetch_metadata()

    # Check that columns were added successfully
    assert len(result.added) == 2
    assert set(result.added) == {"col1", "col2"}

    # Check that descriptions are None (not set)
    columns_by_name = {col.column_name: col for col in table.columns}
    assert columns_by_name["col1"].description is None
    assert columns_by_name["col2"].description is None


def test_fetch_metadata_empty_comment_field_handling(mocker: MockerFixture) -> None:
    """Test that fetch_metadata handles empty comment fields correctly"""
    # Mock database
    database = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table
    table = SqlaTable(
        table_name="test_table_empty_comments",
        database=database,
    )

    # Mock external_metadata with empty comment fields
    mock_columns = [
        {
            "column_name": "col_with_empty_comment",
            "type": "INTEGER",
            "comment": "",  # Empty string comment
        },
        {
            "column_name": "col_with_none_comment",
            "type": "VARCHAR",
            "comment": None,  # None comment
        },
        {
            "column_name": "col_with_valid_comment",
            "type": "VARCHAR",
            "comment": "Valid comment",
        },
    ]

    # Mock dependencies
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch("superset.connectors.sqla.models.db.session")
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    # Execute fetch_metadata
    result = table.fetch_metadata()

    # Check that all columns were added
    assert len(result.added) == 3

    columns_by_name = {col.column_name: col for col in table.columns}

    # Empty string comment should not be set (falsy)
    assert columns_by_name["col_with_empty_comment"].description is None

    # None comment should not be set
    assert columns_by_name["col_with_none_comment"].description is None

    # Valid comment should be set
    assert columns_by_name["col_with_valid_comment"].description == "Valid comment"


@pytest.mark.parametrize(
    "supports_cross_catalog,table_name,catalog,schema,expected_name,expected_schema",
    [
        # Database supports cross-catalog queries (like BigQuery)
        (
            True,
            "test_table",
            "test_project",
            "test_dataset",
            '"test_project"."test_dataset"."test_table"',
            None,
        ),
        # Database supports cross-catalog queries, catalog only (no schema)
        (
            True,
            "test_table",
            "test_project",
            None,
            '"test_project"."test_table"',
            None,
        ),
        # Database supports cross-catalog queries, schema only (no catalog)
        (
            True,
            "test_table",
            None,
            "test_schema",
            "test_table",
            "test_schema",
        ),
        # Database supports cross-catalog queries, no catalog or schema
        (
            True,
            "test_table",
            None,
            None,
            "test_table",
            None,
        ),
        # Database doesn't support cross-catalog queries, catalog ignored
        (
            False,
            "test_table",
            "test_catalog",
            "test_schema",
            "test_table",
            "test_schema",
        ),
        # Database doesn't support cross-catalog queries, no schema
        (
            False,
            "test_table",
            "test_catalog",
            None,
            "test_table",
            None,
        ),
    ],
)
def test_get_sqla_table_with_catalog(
    mocker: MockerFixture,
    supports_cross_catalog: bool,
    table_name: str,
    catalog: str | None,
    schema: str | None,
    expected_name: str,
    expected_schema: str | None,
) -> None:
    """
    Test that `get_sqla_table` handles catalog inclusion correctly.
    """
    # Mock database with specified cross-catalog support
    database = mocker.MagicMock()
    database.db_engine_spec.supports_cross_catalog_queries = supports_cross_catalog
    # Provide a simple quote_identifier
    database.quote_identifier = lambda x: f'"{x}"'

    # Create table with specified parameters
    table = SqlaTable(
        table_name=table_name,
        database=database,
        schema=schema,
        catalog=catalog,
    )

    # Get the SQLAlchemy table representation
    sqla_table = table.get_sqla_table()

    # Verify expected table name and schema
    assert sqla_table.name == expected_name
    assert sqla_table.schema == expected_schema


@pytest.mark.parametrize(
    "table_name, catalog, schema, expected_in_sql, not_expected_in_sql",
    [
        (
            "My-Table",
            "My-DB",
            "My-Schema",
            '"My-DB"."My-Schema"."My-Table"',
            '"My-DB.My-Schema.My-Table"',  # Should NOT be one quoted string
        ),
        (
            "ORDERS",
            "PROD_DB",
            "SALES",
            '"PROD_DB"."SALES"."ORDERS"',
            '"PROD_DB.SALES.ORDERS"',  # Should NOT be one quoted string
        ),
        (
            "My Table",
            "My DB",
            "My Schema",
            '"My DB"."My Schema"."My Table"',
            '"My DB.My Schema.My Table"',  # Should NOT be one quoted string
        ),
    ],
)
def test_get_sqla_table_quoting_for_cross_catalog(
    mocker: MockerFixture,
    table_name: str,
    catalog: str | None,
    schema: str | None,
    expected_in_sql: str,
    not_expected_in_sql: str,
) -> None:
    """
    Test that `get_sqla_table` properly quotes each component of the identifier.
    """
    from sqlalchemy import create_engine, select

    # Create a Postgres-like engine to test proper quoting
    engine = create_engine("postgresql://user:pass@host/db")

    # Mock database with cross-catalog support and proper quote_identifier
    database = mocker.MagicMock()
    database.db_engine_spec.supports_cross_catalog_queries = True
    database.quote_identifier = engine.dialect.identifier_preparer.quote

    # Create table
    table = SqlaTable(
        table_name=table_name,
        database=database,
        schema=schema,
        catalog=catalog,
    )

    # Get the SQLAlchemy table representation
    sqla_table = table.get_sqla_table()
    query = select(sqla_table)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # The compiled SQL should contain each part quoted separately
    assert expected_in_sql in compiled, f"Expected {expected_in_sql} in SQL: {compiled}"
    # Should NOT have the entire identifier quoted as one string
    assert (
        not_expected_in_sql not in compiled
    ), f"Should not have {not_expected_in_sql} in SQL: {compiled}"


def test_get_sqla_table_without_cross_catalog_ignores_catalog(
    mocker: MockerFixture,
) -> None:
    """
    Test that databases without cross-catalog support ignore the catalog field.
    """
    from sqlalchemy import create_engine, select

    # Create a PostgreSQL engine (doesn't support cross-catalog queries)
    engine = create_engine("postgresql://user:pass@localhost/db")

    # Mock database without cross-catalog support
    database = mocker.MagicMock()
    database.db_engine_spec.supports_cross_catalog_queries = False
    database.quote_identifier = engine.dialect.identifier_preparer.quote

    # Create table with catalog - should be ignored
    table = SqlaTable(
        table_name="my_table",
        database=database,
        schema="my_schema",
        catalog="my_catalog",
    )

    # Get the SQLAlchemy table representation
    sqla_table = table.get_sqla_table()

    # Compile to SQL
    query = select(sqla_table)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should only have schema.table, not catalog.schema.table
    assert "my_schema" in compiled
    assert "my_table" in compiled
    assert "my_catalog" not in compiled


def test_quoted_name_prevents_double_quoting(mocker: MockerFixture) -> None:
    """
    Test that `quoted_name(..., quote=False)` does not cause double quoting.
    """
    from sqlalchemy import create_engine, select

    engine = create_engine("postgresql://user:pass@host/db")

    # Mock database
    database = mocker.MagicMock()
    database.db_engine_spec.supports_cross_catalog_queries = True
    database.quote_identifier = engine.dialect.identifier_preparer.quote

    # Use uppercase table name to force quoting
    table = SqlaTable(
        table_name="MY_TABLE",
        database=database,
        schema="MY_SCHEMA",
        catalog="MY_DB",
    )

    # Get the SQLAlchemy table representation
    sqla_table = table.get_sqla_table()

    # Compile to SQL
    query = select(sqla_table)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should NOT have the entire identifier quoted as one:
    # BAD:  '"MY_DB.MY_SCHEMA.MY_TABLE"'
    # This would cause: SQL compilation error: Object '"MY_DB.MY_SCHEMA.MY_TABLE"'
    # does not exist
    assert '"MY_DB.MY_SCHEMA.MY_TABLE"' not in compiled

    # Should have each part quoted separately:
    # GOOD: "MY_DB"."MY_SCHEMA"."MY_TABLE"
    assert '"MY_DB"."MY_SCHEMA"."MY_TABLE"' in compiled


def test_apply_what_if_transform_single_modification(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform correctly transforms a single column.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    # Create table with columns
    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="revenue"),
        ],
    )

    # Get the base table
    source = table.get_sqla_table()

    # Apply what-if transformation
    what_if = {
        "modifications": [{"column": "ad_spend", "multiplier": 1.1}],
        "needed_columns": {"date", "ad_spend", "revenue"},
    }
    result = table._apply_what_if_transform(source, what_if)

    # Compile to SQL and verify
    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have the subquery alias
    assert "__what_if" in compiled
    # Should have the multiplication
    assert "ad_spend * 1.1" in compiled


def test_apply_what_if_transform_multiple_modifications(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform correctly transforms multiple columns.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="revenue"),
            TableColumn(column_name="conversions"),
        ],
    )

    source = table.get_sqla_table()

    what_if = {
        "modifications": [
            {"column": "ad_spend", "multiplier": 1.1},
            {"column": "revenue", "multiplier": 0.95},
        ],
        "needed_columns": {"date", "ad_spend", "revenue"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    assert "ad_spend * 1.1" in compiled
    assert "revenue * 0.95" in compiled
    # conversions should not be in the query since it's not in needed_columns
    assert "conversions" not in compiled


def test_apply_what_if_transform_no_modifications(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform returns source unchanged when no modifications.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    source = table.get_sqla_table()

    what_if = {
        "modifications": [],
        "needed_columns": {"date", "ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    # Should return source unchanged
    assert result is source


def test_apply_what_if_transform_only_needed_columns(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform only includes needed
    columns plus modified columns.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    # Create table with many columns
    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="col1"),
            TableColumn(column_name="col2"),
            TableColumn(column_name="col3"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="col5"),
        ],
    )

    source = table.get_sqla_table()

    # Only need col1, but modifying ad_spend
    what_if = {
        "modifications": [{"column": "ad_spend", "multiplier": 1.1}],
        "needed_columns": {"col1"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have col1 (needed) and ad_spend (modified)
    assert "col1" in compiled
    assert "ad_spend" in compiled
    # Should NOT have other columns
    assert "col2" not in compiled
    assert "col3" not in compiled
    assert "col5" not in compiled


def test_apply_what_if_transform_nonexistent_column(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform handles modifications for non-existent columns.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="revenue"),
        ],
    )

    source = table.get_sqla_table()

    # Try to modify a column that doesn't exist
    what_if = {
        "modifications": [{"column": "nonexistent_column", "multiplier": 1.1}],
        "needed_columns": {"date", "revenue"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should still work, just without the nonexistent column
    assert "date" in compiled
    assert "revenue" in compiled
    assert "nonexistent_column" not in compiled


def test_collect_needed_columns(mocker: MockerFixture) -> None:
    """
    Test that _collect_needed_columns extracts columns from query parameters.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="region"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="revenue"),
        ],
    )

    # Test with various query parameters
    needed = table._collect_needed_columns(
        columns=["date", "region"],
        groupby=["date"],
        metrics=[
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "ad_spend"},
                "aggregate": "SUM",
            }
        ],
        filter=[{"col": "revenue", "op": ">", "val": 100}],
        orderby=[("date", True)],
        granularity="date",
    )

    # Should include all referenced columns
    assert "date" in needed  # from columns, groupby, orderby, granularity
    assert "region" in needed  # from columns
    assert "ad_spend" in needed  # from metrics
    assert "revenue" in needed  # from filter


def test_collect_needed_columns_empty(mocker: MockerFixture) -> None:
    """
    Test that _collect_needed_columns handles empty/None parameters.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[TableColumn(column_name="col1")],
    )

    needed = table._collect_needed_columns(
        columns=None,
        groupby=None,
        metrics=None,
        filter=None,
        orderby=None,
        granularity=None,
    )

    assert needed == set()


def test_collect_needed_columns_returns_none_for_sql_metrics(
    mocker: MockerFixture,
) -> None:
    """
    Test that _collect_needed_columns returns None for SQL-type adhoc metrics,
    indicating all columns should be included.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[TableColumn(column_name="col1")],
    )

    # SQL-type adhoc metric - can't determine columns
    needed = table._collect_needed_columns(
        columns=["date"],
        metrics=[
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(hidden_column)",
            }
        ],
    )

    # Should return None to signal all columns needed
    assert needed is None


def test_collect_needed_columns_returns_none_for_saved_metrics(
    mocker: MockerFixture,
) -> None:
    """
    Test that _collect_needed_columns returns None for saved metrics (strings),
    indicating all columns should be included.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[TableColumn(column_name="col1")],
    )

    # Saved metric (string) - can't determine columns
    needed = table._collect_needed_columns(
        columns=["date"],
        metrics=["saved_metric_name"],
    )

    # Should return None to signal all columns needed
    assert needed is None


def test_apply_what_if_transform_all_columns_when_needed_none(
    mocker: MockerFixture,
) -> None:
    """
    Test that _apply_what_if_transform includes all columns when needed_columns is None.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="col1"),
            TableColumn(column_name="col2"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="col4"),
        ],
    )

    source = table.get_sqla_table()

    # needed_columns is None - should include all columns
    what_if = {
        "modifications": [{"column": "ad_spend", "multiplier": 1.1}],
        "needed_columns": None,
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have all columns
    assert "col1" in compiled
    assert "col2" in compiled
    assert "ad_spend" in compiled
    assert "col4" in compiled


def test_collect_needed_columns_returns_none_for_adhoc_columns(
    mocker: MockerFixture,
) -> None:
    """
    Test that _collect_needed_columns returns None for adhoc columns
    with SQL expressions, indicating all columns should be included.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[TableColumn(column_name="col1")],
    )

    # Adhoc column with SQL expression in columns list
    needed = table._collect_needed_columns(
        columns=[
            "date",
            {"label": "custom_col", "sqlExpression": "CONCAT(first_name, last_name)"},
        ],
        metrics=[],
    )

    # Should return None to signal all columns needed
    assert needed is None


def test_collect_needed_columns_returns_none_for_adhoc_groupby(
    mocker: MockerFixture,
) -> None:
    """
    Test that _collect_needed_columns returns None for adhoc columns in groupby.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[TableColumn(column_name="col1")],
    )

    # Adhoc column in groupby
    needed = table._collect_needed_columns(
        groupby=[
            {"label": "year", "sqlExpression": "EXTRACT(YEAR FROM date)"},
        ],
        metrics=[],
    )

    assert needed is None


def test_apply_what_if_transform_with_single_filter(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform generates CASE WHEN for filtered modifications.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="product"),
            TableColumn(column_name="ad_spend"),
            TableColumn(column_name="revenue"),
        ],
    )

    source = table.get_sqla_table()

    # Apply what-if with filter: only modify ad_spend where product = 'Widget'
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.2,
                "filters": [{"col": "product", "op": "==", "val": "Widget"}],
            }
        ],
        "needed_columns": {"date", "ad_spend", "revenue"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have CASE WHEN with the filter condition
    assert "CASE WHEN" in compiled
    assert "product" in compiled
    assert "'Widget'" in compiled
    assert "ad_spend * 1.2" in compiled
    assert "__what_if" in compiled


def test_apply_what_if_transform_with_multiple_filters(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform ANDs multiple filter conditions together.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="product"),
            TableColumn(column_name="region"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    source = table.get_sqla_table()

    # Multiple filters: product = 'Widget' AND region = 'US'
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.5,
                "filters": [
                    {"col": "product", "op": "==", "val": "Widget"},
                    {"col": "region", "op": "==", "val": "US"},
                ],
            }
        ],
        "needed_columns": {"date", "ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have both conditions ANDed
    assert "CASE WHEN" in compiled
    assert "product" in compiled
    assert "'Widget'" in compiled
    assert "region" in compiled
    assert "'US'" in compiled
    assert "AND" in compiled
    assert "ad_spend * 1.5" in compiled


def test_apply_what_if_transform_with_in_operator(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform handles IN operator correctly.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="product"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    source = table.get_sqla_table()

    # Filter: product IN ['Widget', 'Gadget']
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.1,
                "filters": [
                    {"col": "product", "op": "IN", "val": ["Widget", "Gadget"]}
                ],
            }
        ],
        "needed_columns": {"ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have IN clause
    assert "CASE WHEN" in compiled
    assert "product IN" in compiled
    assert "'Widget'" in compiled
    assert "'Gadget'" in compiled


def test_apply_what_if_transform_filter_columns_included(mocker: MockerFixture) -> None:
    """
    Test that filter columns are included in the subquery even if not in needed_columns.
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="date"),
            TableColumn(column_name="product"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    source = table.get_sqla_table()

    # needed_columns doesn't include 'product', but it's used in filter
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.2,
                "filters": [{"col": "product", "op": "==", "val": "Widget"}],
            }
        ],
        "needed_columns": {"date", "ad_spend"},  # product NOT included
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # product should still be in the SELECT list because it's used in filter
    assert "product" in compiled
    assert "CASE WHEN" in compiled


def test_apply_what_if_transform_comparison_operators(mocker: MockerFixture) -> None:
    """
    Test that _apply_what_if_transform handles comparison operators (>, <, >=, <=).
    """
    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="quantity"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    source = table.get_sqla_table()

    # Filter: quantity >= 100
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.3,
                "filters": [{"col": "quantity", "op": ">=", "val": 100}],
            }
        ],
        "needed_columns": {"ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    assert "CASE WHEN" in compiled
    assert "quantity >= 100" in compiled
    assert "ad_spend * 1.3" in compiled


def test_build_what_if_filter_condition_skips_nonexistent_columns(
    mocker: MockerFixture,
) -> None:
    """
    Test that _build_what_if_filter_condition skips filters for non-existent columns.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="product"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    # Filter references non-existent column
    filters = [
        {"col": "nonexistent", "op": "==", "val": "test"},
        {"col": "product", "op": "==", "val": "Widget"},
    ]
    condition = table._build_what_if_filter_condition(filters)

    # Should still return a condition (just for product)
    assert condition is not None
    compiled = str(condition)
    assert "product" in compiled
    assert "nonexistent" not in compiled


def test_build_what_if_filter_condition_returns_none_for_all_invalid(
    mocker: MockerFixture,
) -> None:
    """
    Test that _build_what_if_filter_condition returns None if all filters are invalid.
    """
    database = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="product"),
        ],
    )

    # All filters reference non-existent columns
    filters = [
        {"col": "nonexistent1", "op": "==", "val": "test"},
        {"col": "nonexistent2", "op": "==", "val": "test"},
    ]
    condition = table._build_what_if_filter_condition(filters)

    assert condition is None


def test_apply_what_if_transform_with_temporal_range_filter(
    mocker: MockerFixture,
) -> None:
    """
    Test that _apply_what_if_transform handles TEMPORAL_RANGE filter correctly.
    """
    from datetime import datetime

    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="order_date"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    # Mock get_since_until_from_time_range to avoid Flask app context requirement
    mocker.patch(
        "superset.common.utils.time_range_utils.get_since_until_from_time_range",
        return_value=(datetime(2024, 1, 1), datetime(2024, 3, 31)),
    )

    source = table.get_sqla_table()

    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.2,
                "filters": [
                    {
                        "col": "order_date",
                        "op": "TEMPORAL_RANGE",
                        "val": "2024-01-01 : 2024-03-31",
                    }
                ],
            }
        ],
        "needed_columns": {"ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have CASE WHEN with time range conditions
    assert "CASE WHEN" in compiled
    assert "order_date >=" in compiled
    assert "order_date <" in compiled
    assert "ad_spend * 1.2" in compiled


def test_apply_what_if_transform_with_combined_filters(
    mocker: MockerFixture,
) -> None:
    """
    Test that _apply_what_if_transform handles combined product + time range filters.
    """
    from datetime import datetime

    engine = create_engine("sqlite://")
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "sqlite"

    table = SqlaTable(
        table_name="sales",
        database=database,
        columns=[
            TableColumn(column_name="order_date"),
            TableColumn(column_name="product"),
            TableColumn(column_name="ad_spend"),
        ],
    )

    # Mock get_since_until_from_time_range to avoid Flask app context requirement
    mocker.patch(
        "superset.common.utils.time_range_utils.get_since_until_from_time_range",
        return_value=(datetime(2024, 1, 1), datetime(2024, 4, 1)),
    )

    source = table.get_sqla_table()

    # Combined filter: product = 'Widget' AND order_date in Q1 2024
    what_if = {
        "modifications": [
            {
                "column": "ad_spend",
                "multiplier": 1.5,
                "filters": [
                    {"col": "product", "op": "==", "val": "Widget"},
                    {
                        "col": "order_date",
                        "op": "TEMPORAL_RANGE",
                        "val": "2024-01-01 : 2024-04-01",
                    },
                ],
            }
        ],
        "needed_columns": {"ad_spend"},
    }
    result = table._apply_what_if_transform(source, what_if)

    query = select(result)
    compiled = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

    # Should have CASE WHEN with all conditions ANDed together
    assert "CASE WHEN" in compiled
    assert "product" in compiled
    assert "'Widget'" in compiled
    assert "order_date >=" in compiled
    assert "order_date <" in compiled
    assert "AND" in compiled
    assert "ad_spend * 1.5" in compiled
    # Both filter columns should be in the SELECT list
    assert "order_date" in compiled
