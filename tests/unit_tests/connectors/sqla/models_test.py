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

from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import (
    SqlaTable,
    SqlMetric,
    TableColumn,
    validate_stored_expression,
)
from superset.daos.dataset import DatasetDAO
from superset.exceptions import (
    OAuth2RedirectError,
    QueryObjectValidationError,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.models.helpers import (
    ExploreMixin,
    validate_adhoc_subquery,
    validate_rendered_expression,
)
from superset.sql.parse import Table
from superset.superset_typing import QueryObjectDict
from superset.utils import json


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


def _query_obj() -> QueryObjectDict:
    return {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "groupby": ["id"],
        "metrics": [],
        "is_timeseries": False,
        "filter": [],
    }


def _build_sqla_table_for_query(
    mocker: MockerFixture, sql: str, engine: str = "postgresql"
) -> SqlaTable:
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.engine = engine
    database = mocker.MagicMock()
    database.db_engine_spec = db_engine_spec
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )
    mocker.patch.object(
        SqlaTable,
        "db_engine_spec",
        new=property(lambda self: db_engine_spec),
    )
    mocker.patch.object(
        sqla_table,
        "get_query_str_extended",
        return_value=mocker.MagicMock(sql=sql, labels_expected=[]),
    )
    return sqla_table


def test_query_blocks_disallowed_function_on_chart_data_path(
    mocker: MockerFixture,
) -> None:
    mocker.patch.dict(
        "flask.current_app.config",
        {
            "DISALLOWED_SQL_FUNCTIONS": {"postgresql": {"version"}},
            "DISALLOWED_SQL_TABLES": {},
        },
        clear=False,
    )
    sqla_table = _build_sqla_table_for_query(mocker, "SELECT version()")
    with pytest.raises(SupersetDisallowedSQLFunctionException):
        sqla_table.query(_query_obj())
    sqla_table.database.get_df.assert_not_called()  # type: ignore[attr-defined]


def test_query_blocks_disallowed_table_on_chart_data_path(
    mocker: MockerFixture,
) -> None:
    mocker.patch.dict(
        "flask.current_app.config",
        {
            "DISALLOWED_SQL_FUNCTIONS": {},
            "DISALLOWED_SQL_TABLES": {"postgresql": {"pg_authid"}},
        },
        clear=False,
    )
    sqla_table = _build_sqla_table_for_query(mocker, "SELECT rolname FROM pg_authid")
    with pytest.raises(SupersetDisallowedSQLTableException):
        sqla_table.query(_query_obj())
    sqla_table.database.get_df.assert_not_called()  # type: ignore[attr-defined]


def test_query_disallowed_table_error_reports_only_matched_tables(
    mocker: MockerFixture,
) -> None:
    mocker.patch.dict(
        "flask.current_app.config",
        {
            "DISALLOWED_SQL_FUNCTIONS": {},
            "DISALLOWED_SQL_TABLES": {
                "postgresql": {"pg_authid", "pg_shadow", "pg_stat_activity"}
            },
        },
        clear=False,
    )
    sqla_table = _build_sqla_table_for_query(mocker, "SELECT rolname FROM pg_authid")
    with pytest.raises(SupersetDisallowedSQLTableException) as excinfo:
        sqla_table.query(_query_obj())
    message = str(excinfo.value)
    assert "pg_authid" in message
    assert "pg_shadow" not in message
    assert "pg_stat_activity" not in message


def test_query_allows_benign_sql_on_chart_data_path(mocker: MockerFixture) -> None:
    mocker.patch.dict(
        "flask.current_app.config",
        {
            "DISALLOWED_SQL_FUNCTIONS": {"postgresql": {"version"}},
            "DISALLOWED_SQL_TABLES": {"postgresql": {"pg_authid"}},
        },
        clear=False,
    )
    sqla_table = _build_sqla_table_for_query(mocker, "SELECT id FROM my_sqla_table")
    sqla_table.database.get_df.return_value = pd.DataFrame()  # type: ignore[attr-defined]
    result = sqla_table.query(_query_obj())
    sqla_table.database.get_df.assert_called_once()  # type: ignore[attr-defined]
    assert result is not None


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
    Test that the `_normalize_prequery_result_type` can handle custom SQL.
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


def test_fetch_metadata_sets_expression_for_expanded_nested_columns(
    mocker: MockerFixture,
) -> None:
    """
    Test that fetch_metadata uses the `expression` hint provided by the db engine
    spec (e.g. Trino's expansion of nested `ROW` columns via `expand_rows`) to set
    the physical `TableColumn.expression`.

    Without this, a nested column like `metadata.uuid` would have no expression,
    causing SQLAlchemy to render the whole dotted `column_name` as a single quoted
    identifier (`"metadata.uuid"`), which Trino rejects, instead of the correct
    per-segment quoting (`"metadata"."uuid"`).

    See: https://github.com/apache/superset/issues/27034
    """
    # Mock database
    database: MagicMock = mocker.MagicMock()
    database.get_metrics.return_value = []

    # Mock db_engine_spec
    mock_db_engine_spec: MagicMock = mocker.MagicMock()
    mock_db_engine_spec.alter_new_orm_column = mocker.MagicMock()
    database.db_engine_spec = mock_db_engine_spec

    # Create table with a pre-existing (already synced) expanded column, to also
    # cover the "sync columns from source" (re-fetch) code path
    table: SqlaTable = SqlaTable(table_name="test_table_nested", database=database)
    table.id = 1

    existing_col: TableColumn = TableColumn(
        column_name="metadata.uuid",
        type="VARCHAR",
        table=table,
        expression="",
    )
    table.columns = [existing_col]

    mock_columns: list[dict[str, str]] = [
        {
            "column_name": "metadata",
            "type": "ROW",
        },
        {
            "column_name": "metadata.uuid",
            "type": "VARCHAR",
            "expression": '"metadata"."uuid"',
            "query_as": '"metadata"."uuid" AS "metadata.uuid"',
        },
    ]

    mock_session: MagicMock = mocker.patch("superset.connectors.sqla.models.db.session")
    mock_session.query.return_value.filter.return_value.all.return_value = [
        existing_col
    ]
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)
    mocker.patch(
        "superset.connectors.sqla.models.config", {"SQLA_TABLE_MUTATOR": lambda x: None}
    )

    table.fetch_metadata()

    columns_by_name: dict[str, TableColumn] = {
        col.column_name: col for col in table.columns
    }
    assert len(table.columns) == len(mock_columns)
    assert not columns_by_name["metadata"].expression
    assert columns_by_name["metadata.uuid"].expression == '"metadata"."uuid"'

    # Re-run fetch_metadata a second time to simulate re-syncing columns from
    # source. The previously synced physical column now carries a truthy
    # `expression`, which must not cause it to be duplicated in `self.columns`.
    mock_session_2 = mocker.patch("superset.connectors.sqla.models.db.session")
    mock_session_2.query.return_value.filter.return_value.all.return_value = list(
        table.columns
    )
    mocker.patch.object(table, "external_metadata", return_value=mock_columns)

    table.fetch_metadata()

    assert len(table.columns) == len(mock_columns)
    columns_by_name = {col.column_name: col for col in table.columns}
    assert not columns_by_name["metadata"].expression
    assert columns_by_name["metadata.uuid"].expression == '"metadata"."uuid"'


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
    assert not_expected_in_sql not in compiled, (
        f"Should not have {not_expected_in_sql} in SQL: {compiled}"
    )


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


def test_sqla_table_currency_code_column_property() -> None:
    """
    Test currency_code_column property on SqlaTable.
    """
    database = Database(database_name="my_db")
    table = SqlaTable(
        table_name="sales",
        database=database,
        currency_code_column="currency",
    )
    assert table.currency_code_column == "currency"


def test_sqla_table_data_includes_currency_code_column(mocker: MockerFixture) -> None:
    """
    Test that data property includes currency_code_column.
    """
    database = mocker.MagicMock()
    database.get_sqla_engine.return_value.__enter__ = mocker.MagicMock()
    database.get_sqla_engine.return_value.__exit__ = mocker.MagicMock()

    table = SqlaTable(
        table_name="sales",
        database=database,
        currency_code_column="currency_code",
        main_dttm_col="ds",
    )
    table.columns = []
    table.metrics = []

    # Mock the columns property to return empty list
    mocker.patch.object(SqlaTable, "columns", [])
    mocker.patch.object(SqlaTable, "metrics", [])

    data = table.data
    assert data["currency_code_column"] == "currency_code"
    assert data["main_dttm_col"] == "ds"


def test_sqla_table_link_escapes_url(mocker: MockerFixture) -> None:
    """
    Test that link property properly escapes URL to prevent XSS.
    """
    database = Database(database_name="my_db")
    table = SqlaTable(
        table_name='test<script>alert("xss")</script>',
        database=database,
        id=1,
    )

    # Mock explore_url to return a URL with special characters
    mocker.patch.object(
        SqlaTable,
        "explore_url",
        new_callable=mocker.PropertyMock,
        return_value='/explore/?datasource_type=table&datasource_id=1&name=<script>alert("xss")</script>',
    )

    link = table.link
    # Verify that special characters are escaped in both name and URL
    assert "&lt;script&gt;" in str(link)
    assert "<script>" not in str(link)


@pytest.mark.parametrize(
    "query",
    [
        {"columns": ["state"]},
        {"groupby": ["state"]},
        {"columns": [], "groupby": ["state"]},
    ],
)
def test_data_for_slices_handles_missing_datasource(
    mocker: MockerFixture,
    query: dict[str, object],
) -> None:
    """Test serialized columns do not require resolving a missing datasource."""
    database = mocker.MagicMock()
    database.id = 1

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[TableColumn(column_name="state")],
        metrics=[],
    )

    mock_slice = mocker.MagicMock()
    mock_slice.id = 1
    mock_slice.slice_name = "Test Chart"
    mock_slice.form_data = {}
    mock_slice.query_context = json.dumps(
        {
            "datasource": {"id": 999, "type": "table"},
            "queries": [query],
        }
    )

    result = table.data_for_slices([mock_slice])

    assert [column["column_name"] for column in result["columns"]] == ["state"]
    mock_slice.get_query_context.assert_not_called()


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        pytest.param(
            {"columns": ["country"], "groupby": ["region"]},
            {"country", "region"},
            id="both-fields",
        ),
        pytest.param(
            {"columns": ["country"], "groupby": []},
            {"country"},
            id="empty-deprecated-groupby",
        ),
        pytest.param(
            {"columns": [], "groupby": ["source", "target"]},
            {"source", "target"},
            id="sankey-v2",
        ),
    ],
)
def test_extract_query_context_columns_preserves_dimension_fields(
    query: dict[str, list[str]],
    expected: set[str],
) -> None:
    """Test canonical and deprecated dimension fields retain their metadata."""
    query_context = json.dumps(
        {
            "queries": [query],
        }
    )

    assert SqlaTable._extract_query_context_columns(query_context) == expected


@pytest.mark.parametrize(
    ("query", "form_data", "expected"),
    [
        pytest.param(
            {"columns": ["state"]},
            {
                "tooltip_contents": [
                    "city",
                    {"item_type": "column", "column_name": "postal_code"},
                    {"item_type": "metric", "metric_name": "count"},
                ]
            },
            {"state", "city", "postal_code"},
            id="tooltip-columns",
        ),
        pytest.param(
            {"columns": ["event_time"], "granularity": "ds"},
            {},
            {"event_time", "ds"},
            id="granularity",
        ),
    ],
)
def test_extract_query_context_columns_preserves_factory_added_columns(
    query: dict[str, object],
    form_data: dict[str, object],
    expected: set[str],
) -> None:
    """Test lightweight extraction preserves QueryContextFactory dependencies."""
    query_context = json.dumps(
        {
            "queries": [query],
            "form_data": form_data,
        }
    )

    assert SqlaTable._extract_query_context_columns(query_context) == expected


def test_data_for_slices_preserves_dynamic_currency_column(
    mocker: MockerFixture,
) -> None:
    """Test dynamic currency metadata does not require rebuilding QueryContext."""
    database = mocker.MagicMock()
    database.id = 1

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[
            TableColumn(column_name="state"),
            TableColumn(column_name="currency_code"),
        ],
        metrics=[],
        currency_code_column="currency_code",
    )

    mock_slice = mocker.MagicMock()
    mock_slice.form_data = {}
    mock_slice.query_context = json.dumps(
        {
            "queries": [{"columns": ["state"]}],
            "form_data": {
                "viz_type": "pivot_table_v2",
                "currency_format": {"symbol": "AUTO"},
            },
        }
    )

    result = table.data_for_slices([mock_slice])

    assert [column["column_name"] for column in result["columns"]] == [
        "state",
        "currency_code",
    ]
    mock_slice.get_query_context.assert_not_called()


@pytest.mark.parametrize(
    "invalid_column",
    [
        None,
        {},
        {"label": ["state"]},
        {"label": {"column_name": "state"}},
    ],
)
def test_data_for_slices_falls_back_for_invalid_query_context_column(
    mocker: MockerFixture,
    invalid_column: object,
) -> None:
    """Test malformed query-context columns fall back to form data."""
    database = mocker.MagicMock()
    database.id = 1

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[TableColumn(column_name="state")],
        metrics=[],
    )

    mock_slice = mocker.MagicMock()
    mock_slice.form_data = {"groupby": ["state"]}
    mock_slice.query_context = json.dumps(
        {
            "datasource": {"id": 999, "type": "table"},
            "queries": [{"columns": [invalid_column]}],
        }
    )

    result = table.data_for_slices([mock_slice])

    assert [column["column_name"] for column in result["columns"]] == ["state"]
    mock_slice.get_query_context.assert_not_called()


@pytest.mark.parametrize(
    "invalid_query_context",
    [
        None,
        "{",
        json.dumps([]),
        json.dumps({}),
        json.dumps({"queries": []}),
        json.dumps({"queries": [None, {"columns": "state"}]}),
    ],
)
def test_data_for_slices_falls_back_for_invalid_query_context(
    mocker: MockerFixture,
    invalid_query_context: str | None,
) -> None:
    """Test invalid serialized query contexts fall back to form data."""
    database = mocker.MagicMock()
    database.id = 1

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[TableColumn(column_name="state")],
        metrics=[],
    )

    mock_slice = mocker.MagicMock()
    mock_slice.form_data = {"groupby": ["state"]}
    mock_slice.query_context = invalid_query_context

    result = table.data_for_slices([mock_slice])

    assert [column["column_name"] for column in result["columns"]] == ["state"]
    mock_slice.get_query_context.assert_not_called()


def test_data_for_slices_skips_invalid_query_context_entries(
    mocker: MockerFixture,
) -> None:
    """Test invalid query entries do not hide columns from valid entries."""
    database = mocker.MagicMock()
    database.id = 1

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[TableColumn(column_name="state")],
        metrics=[],
    )

    mock_slice = mocker.MagicMock()
    mock_slice.form_data = {}
    mock_slice.query_context = json.dumps(
        {
            "queries": [
                None,
                {"columns": "state"},
                {"columns": ["state"]},
            ],
        }
    )

    result = table.data_for_slices([mock_slice])

    assert [column["column_name"] for column in result["columns"]] == ["state"]
    mock_slice.get_query_context.assert_not_called()


def _database_for_expression(mocker: MockerFixture) -> Database:
    database = mocker.MagicMock(spec=Database)
    database.backend = "sqlite"
    database.allow_multi_catalog = False
    return database


def test_validate_stored_expression_rejects_multi_statement(
    mocker: MockerFixture,
) -> None:
    database = _database_for_expression(mocker)
    with pytest.raises(SupersetSecurityException):
        validate_stored_expression(database, None, None, "1; DROP TABLE users")


def test_validate_stored_expression_rejects_set_operation(
    mocker: MockerFixture,
) -> None:
    database = _database_for_expression(mocker)
    with pytest.raises(SupersetSecurityException):
        validate_stored_expression(
            database, None, None, "1 UNION SELECT password FROM ab_user"
        )


def test_validate_stored_expression_accepts_case_expression(
    mocker: MockerFixture,
) -> None:
    database = _database_for_expression(mocker)
    validate_stored_expression(
        database, None, None, "CASE WHEN amount > 0 THEN 'a' ELSE 'b' END"
    )


def test_validate_stored_expression_rejects_subquery(
    mocker: MockerFixture,
) -> None:
    """
    With ``ALLOW_ADHOC_SUBQUERY=False`` (the default), a stored
    expression that contains a sub-query is rejected by the same
    ``validate_adhoc_subquery`` gate that already covers adhoc SQL.
    Locks in the sub-query branch so a future refactor that
    removes the ``validate_adhoc_subquery`` call gets a red test.
    """
    database = _database_for_expression(mocker)
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    with pytest.raises(SupersetSecurityException):
        validate_stored_expression(
            database,
            None,
            None,
            "(SELECT password FROM ab_user LIMIT 1)",
        )


@pytest.mark.parametrize(
    "expression",
    [
        "case when '{{ current_username() }}' = 'abc' then 'yes' else 'no' end",
        "SUM(price) * {{ url_param('multiplier') }}",
        "{# comment #} amount",
        "{% if 1 %}amount{% endif %}",
    ],
)
def test_validate_stored_expression_accepts_jinja(
    mocker: MockerFixture, expression: str
) -> None:
    """
    Stored expressions can contain Jinja templating. Balanced Jinja blocks
    are replaced with a placeholder so the surrounding SQL is still parsed;
    skeletons whose control flow leaves them unparseable defer to runtime.
    """
    database = _database_for_expression(mocker)
    validate_stored_expression(database, None, None, expression)


def test_validate_stored_expression_rejects_set_op_around_jinja(
    mocker: MockerFixture,
) -> None:
    """
    A ``UNION`` smuggled around a Jinja block must still be rejected: the
    Jinja substitution leaves the set operator visible to the parser.
    """
    database = _database_for_expression(mocker)
    with pytest.raises(SupersetSecurityException):
        validate_stored_expression(
            database,
            None,
            None,
            "'{{ current_username() }}' UNION SELECT password FROM ab_user",
        )


def test_validate_stored_expression_rejects_subquery_around_jinja(
    mocker: MockerFixture,
) -> None:
    """
    Sub-queries combined with a Jinja comment block must still be rejected:
    stripping the ``{# ... #}`` block leaves the sub-query visible to the
    ``validate_adhoc_subquery`` gate.
    """
    database = _database_for_expression(mocker)
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    with pytest.raises(SupersetSecurityException):
        validate_stored_expression(
            database,
            None,
            None,
            "(SELECT password FROM ab_user LIMIT 1) {# x #}",
        )


def _stored_col(expression: str, engine: str, mocker: MockerFixture) -> TableColumn:
    """
    Build a ``TableColumn`` whose sinks run the *real* query-time validator
    against ``engine``, so the tests pin the sub-query policy rather than the
    wiring to a mocked validator.
    """
    tc = TableColumn(column_name="ds", expression=expression)
    tc.table = mocker.MagicMock()
    tc.table.database = _database_for_expression(mocker)
    tc.table.catalog = None
    tc.table.schema = "public"
    tc.db_engine_spec.engine = engine
    return tc


def test_get_sqla_col_rejects_stored_subquery(mocker: MockerFixture) -> None:
    """
    A stored calculated-column expression is validated at the query sink, not
    only at save time, so a disallowed sub-query is rejected even when it
    reaches the query without having been checked on save (templating, v1
    import, dataset duplication, or rows predating the save-time check). It
    surfaces as a chart-level ``QueryObjectValidationError`` to match the adhoc
    sinks.
    """
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    tc = _stored_col("(SELECT password FROM ab_user LIMIT 1)", "mysql", mocker)
    with pytest.raises(QueryObjectValidationError):
        tc.get_sqla_col()


def test_get_timestamp_expression_rejects_stored_subquery(
    mocker: MockerFixture,
) -> None:
    """The time-grained sink enforces the same query-time gate as ``get_sqla_col``."""
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    tc = _stored_col("(SELECT ts FROM ab_user LIMIT 1)", "mysql", mocker)
    with pytest.raises(QueryObjectValidationError):
        tc.get_timestamp_expression(time_grain=None)


def test_metric_get_sqla_col_rejects_stored_subquery(mocker: MockerFixture) -> None:
    """The stored-metric sink enforces the same query-time gate."""
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    metric = SqlMetric(metric_name="leak", expression="(SELECT 1)")
    metric.table = mocker.MagicMock()
    metric.table.database = _database_for_expression(mocker)
    metric.table.catalog = None
    metric.table.schema = "public"
    metric.table.db_engine_spec.engine = "mysql"
    with pytest.raises(QueryObjectValidationError):
        metric.get_sqla_col()


def test_convert_tbl_column_to_sqla_col_rejects_stored_subquery(
    mocker: MockerFixture,
) -> None:
    """The virtual-dataset column sink enforces the same query-time gate."""
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    datasource = mocker.MagicMock()
    datasource.database = _database_for_expression(mocker)
    datasource.catalog = None
    datasource.schema = "public"
    datasource.db_engine_spec.engine = "mysql"
    datasource._validate_stored_expression = (
        ExploreMixin._validate_stored_expression.__get__(datasource)
    )
    datasource.convert_tbl_column_to_sqla_col = (
        ExploreMixin.convert_tbl_column_to_sqla_col.__get__(datasource)
    )
    tbl_column = TableColumn(column_name="leak", expression="(SELECT 1)")
    with pytest.raises(QueryObjectValidationError):
        datasource.convert_tbl_column_to_sqla_col(tbl_column)


def test_get_sqla_col_falls_back_when_stored_expression_unparseable(
    mocker: MockerFixture,
) -> None:
    """
    A stored expression using dialect-specific syntax that sqlglot cannot parse
    (e.g. ``DATE_ADD(ds, 1)`` on MySQL) pre-dates the query-time gate and went
    to the query unparsed. The engine dialect fails to parse it, the permissive
    dialect confirms there is no sub-query, so it falls back to the raw
    expression rather than breaking the query.
    """
    spy = mocker.patch(
        "superset.models.helpers.validate_adhoc_subquery",
        wraps=validate_adhoc_subquery,
    )
    literal = mocker.patch("superset.connectors.sqla.models.literal_column")
    _stored_col("DATE_ADD(ds, 1)", "mysql", mocker).get_sqla_col()
    assert literal.call_args.args[0] == "DATE_ADD(ds, 1)"
    # The gate ran rather than being skipped: the bare expression on the engine
    # dialect, then the wrapped form on the permissive dialect as a detector.
    assert [(call.args[0], call.args[-1]) for call in spy.call_args_list] == [
        ("DATE_ADD(ds, 1)", "mysql"),
        ("SELECT DATE_ADD(ds, 1)", "base"),
    ]


def test_get_sqla_col_rejects_stored_subquery_in_select_list_fragment(
    mocker: MockerFixture,
) -> None:
    """
    ``DISTINCT (SELECT ...)`` only parses inside a select list, so parsing the
    bare expression fails in every dialect. The detector wraps it the way the
    save-time validator does, which parses, so the sub-query is still rejected
    instead of falling through to the raw expression.
    """
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    tc = _stored_col("DISTINCT (SELECT password FROM ab_user)", "mysql", mocker)
    with pytest.raises(QueryObjectValidationError):
        tc.get_sqla_col()


def test_get_sqla_col_rejects_stored_multi_statement_expression(
    mocker: MockerFixture,
) -> None:
    """
    A stored expression carrying a second statement is unparseable as a single
    statement in every dialect, so it would otherwise take the fallback. The
    detector parses the wrapped form as a script and rejects it, matching the
    save-time validator.
    """
    tc = _stored_col("1; DROP TABLE ab_user", "mysql", mocker)
    with pytest.raises(QueryObjectValidationError):
        tc.get_sqla_col()


def test_get_sqla_col_allows_semicolon_inside_string_literal(
    mocker: MockerFixture,
) -> None:
    """
    The multi-statement detector must not treat a semicolon inside a string
    literal as a second statement, or a legitimate calculated column breaks.
    """
    literal = mocker.patch("superset.connectors.sqla.models.literal_column")
    expression = "CASE WHEN x = 'a;b' THEN 1 END"
    _stored_col(expression, "mysql", mocker).get_sqla_col()
    assert literal.call_args.args[0] == expression


def test_get_sqla_col_catches_subquery_beside_unparseable_syntax(
    mocker: MockerFixture,
) -> None:
    """
    A sub-query hidden next to syntax the engine dialect cannot parse
    (``DATE_ADD(ds, 1) + (SELECT 1)`` on MySQL) must not slip through the
    fallback: the permissive dialect parses it as a detector and the sub-query
    is still rejected.
    """
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    tc = _stored_col("DATE_ADD(ds, 1) + (SELECT 1)", "mysql", mocker)
    with pytest.raises(QueryObjectValidationError):
        tc.get_sqla_col()


def test_validate_rendered_expression_rejects_multi_statement(
    mocker: MockerFixture,
) -> None:
    database = _database_for_expression(mocker)
    with pytest.raises(QueryObjectValidationError):
        validate_rendered_expression("1; DROP TABLE users", database, None, "public")


def test_validate_rendered_expression_rejects_set_operation(
    mocker: MockerFixture,
) -> None:
    database = _database_for_expression(mocker)
    with pytest.raises(QueryObjectValidationError):
        validate_rendered_expression(
            "1 UNION SELECT password FROM ab_user", database, None, "public"
        )


def test_validate_rendered_expression_rejects_subquery(
    mocker: MockerFixture,
) -> None:
    """
    With ``ALLOW_ADHOC_SUBQUERY=False`` (the default), a rendered expression
    containing a sub-query is rejected by the same ``validate_adhoc_subquery``
    gate used for stored and adhoc expressions.
    """
    database = _database_for_expression(mocker)
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    with pytest.raises(QueryObjectValidationError):
        validate_rendered_expression(
            "(SELECT password FROM ab_user LIMIT 1)", database, None, "public"
        )


def test_validate_rendered_expression_accepts_valid_expression(
    mocker: MockerFixture,
) -> None:
    """A benign rendered expression is returned unchanged (no RLS applied)."""
    database = _database_for_expression(mocker)
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    result = validate_rendered_expression("SUM(amount)", database, None, "public")
    assert result == "SUM(amount)"


def test_get_sqla_col_revalidates_rendered_jinja_expression(
    mocker: MockerFixture,
) -> None:
    """
    A Jinja block that renders into a sub-query must be rejected at query
    time: save-time validation only sees the block as a placeholder, so the
    rendered expression is re-validated before it is embedded via
    ``literal_column``. The failure surfaces as a chart-level
    ``QueryObjectValidationError``, matching the stored-expression path,
    rather than a raw ``SupersetSecurityException``.
    """
    # A real Database (not a MagicMock) so the ORM relationship assignment on
    # SqlaTable has a valid instance state; sqlite gives a concrete backend.
    database = Database(database_name="t", sqlalchemy_uri="sqlite://")
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=False)
    table = SqlaTable(table_name="t", database=database)
    tbl_column = TableColumn(
        column_name="c",
        expression='{{ "(SELECT password FROM ab_user LIMIT 1)" }}',
        table=table,
    )
    template_processor = mocker.MagicMock()
    template_processor.process_template.return_value = (
        "(SELECT password FROM ab_user LIMIT 1)"
    )
    with pytest.raises(QueryObjectValidationError):
        tbl_column.get_sqla_col(template_processor=template_processor)


def test_has_extra_cache_key_calls_scans_guest_token_rls(
    mocker: MockerFixture,
) -> None:
    """
    Guest-token RLS clauses are templated when the query is built, so a macro
    appearing only in a guest-token RLS clause must still trigger extra cache
    key extraction; otherwise its value never reaches the cache key and two
    guests can share a cache entry.
    """
    mocker.patch(
        "superset.connectors.sqla.models.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_rls_filters",
        return_value=[],
    )
    get_guest_rls = mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[
            {"clause": "tenant = '{{ get_guest_user_attribute(\"tenant\") }}'"}
        ],
    )

    table = SqlaTable(
        table_name="tenanted",
        sql="SELECT 1 AS tenant",
        database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
    )
    query_obj: QueryObjectDict = {"metrics": [], "columns": [], "extras": {}}

    assert table.has_extra_cache_key_calls(query_obj) is True

    get_guest_rls.return_value = [{"clause": "tenant = 'acme'"}]
    assert table.has_extra_cache_key_calls(query_obj) is False


def test_dttm_cols_excludes_column_after_temporal_flag_removed(
    session: Session,
) -> None:
    """
    Regression for #30510: when a column is mistakenly marked temporal, set as the
    dataset's default datetime (``main_dttm_col``) and saved, then later has its
    ``is_dttm`` flag removed, the dataset must stop treating that column as temporal.

    Otherwise ``dttm_cols`` (which feeds time-column selection and the default time
    filter for every chart built on the dataset) keeps returning a non-temporal
    column, corrupting the dataset with a time filter that cannot be removed.
    """
    Database.metadata.create_all(session.bind)
    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")

    # A column the user mistakenly marks as temporal ("Is Temporal") and then picks
    # as the dataset "Default Datetime" (``main_dttm_col``).
    column = TableColumn(column_name="not_really_a_date", type="VARCHAR", is_dttm=True)
    dataset = SqlaTable(
        database=database,
        table_name="my_table",
        columns=[column],
        main_dttm_col="not_really_a_date",
    )
    session.add(dataset)
    session.commit()

    # While flagged temporal, the column is (expectedly) exposed as a datetime column.
    assert dataset.dttm_cols == ["not_really_a_date"]

    # The user realizes the mistake and unchecks "Is Temporal", then saves. Persisting
    # the update clears ``is_dttm`` on the column.
    column.is_dttm = False
    session.commit()

    # The column is no longer temporal...
    assert column.is_temporal is False
    # ...so it must no longer be reported as a datetime column. On master
    # ``main_dttm_col`` is never cleared, so ``dttm_cols`` still contains the stale,
    # non-temporal column and this assertion fails (bug reproduced).
    assert "not_really_a_date" not in dataset.dttm_cols
