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
from superset.sql_parse import Table
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
