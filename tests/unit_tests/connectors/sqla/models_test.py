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
from sqlalchemy import create_engine
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
    assert str(clause.compile(engine, compile_kwargs={"literal_binds": True})) == (
        "tables.perm IN ('[my_db].[table1](id:1)') OR "
        "tables.schema_perm IN ('[my_db].[db1].[schema1]', '[my_other_db].[schema]') OR "  # noqa: E501
        "tables.catalog_perm IN ('[my_db].[db1]')"
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
            "test_project.test_dataset.test_table",
            None,
        ),
        # Database supports cross-catalog queries, catalog only (no schema)
        (
            True,
            "test_table",
            "test_project",
            None,
            "test_project.test_table",
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
    """Test that get_sqla_table handles catalog inclusion correctly based on
    database cross-catalog support
    """
    # Mock database with specified cross-catalog support
    database = mocker.MagicMock()
    database.db_engine_spec.supports_cross_catalog_queries = supports_cross_catalog

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
