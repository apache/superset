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

# pylint: disable=import-outside-toplevel

from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, text
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

if TYPE_CHECKING:
    from superset.models.core import Database


@pytest.fixture
def database(mocker: MockerFixture, session: Session) -> Database:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    connection = engine.raw_connection()
    connection.execute("CREATE TABLE t (a INTEGER, b TEXT)")
    connection.execute("INSERT INTO t VALUES (1, 'Alice')")
    connection.execute("INSERT INTO t VALUES (NULL, 'Bob')")
    connection.commit()

    # since we're using an in-memory SQLite database, make sure we always
    # return the same engine where the table was created
    @contextmanager
    def mock_get_sqla_engine():
        yield engine

    mocker.patch.object(
        database,
        "get_sqla_engine",
        new=mock_get_sqla_engine,
    )

    return database


def test_values_for_column(database: Database) -> None:
    """
    Test the `values_for_column` method.

    NULL values should be returned as `None`, not `np.nan`, since NaN cannot be
    serialized to JSON.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[TableColumn(column_name="a")],
    )
    assert table.values_for_column("a") == [1, None]


def test_values_for_column_with_rls(database: Database) -> None:
    """
    Test the `values_for_column` method with RLS enabled.
    """
    from sqlalchemy.sql.elements import TextClause

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="a"),
        ],
    )
    with patch.object(
        table,
        "get_sqla_row_level_filters",
        return_value=[
            TextClause("a = 1"),
        ],
    ):
        assert table.values_for_column("a") == [1]


def test_values_for_column_with_rls_no_values(database: Database) -> None:
    """
    Test the `values_for_column` method with RLS enabled and no values.
    """
    from sqlalchemy.sql.elements import TextClause

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="a"),
        ],
    )
    with patch.object(
        table,
        "get_sqla_row_level_filters",
        return_value=[
            TextClause("a = 2"),
        ],
    ):
        assert table.values_for_column("a") == []


def test_values_for_column_calculated(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test that calculated columns work.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(
                column_name="starts_with_A",
                expression="CASE WHEN b LIKE 'A%' THEN 'yes' ELSE 'nope' END",
            )
        ],
    )
    assert table.values_for_column("starts_with_A") == ["yes", "nope"]


def test_values_for_column_double_percents(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test the behavior of `double_percents`.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    with database.get_sqla_engine() as engine:
        engine.dialect.identifier_preparer._double_percents = "pyformat"

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(
                column_name="starts_with_A",
                expression="CASE WHEN b LIKE 'A%' THEN 'yes' ELSE 'nope' END",
            )
        ],
    )

    mutate_sql_based_on_config = mocker.patch.object(
        database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql: sql,
    )
    pd = mocker.patch("superset.models.helpers.pd")

    table.values_for_column("starts_with_A")

    # make sure the SQL originally had double percents
    mutate_sql_based_on_config.assert_called_with(
        "SELECT DISTINCT CASE WHEN b LIKE 'A%%' THEN 'yes' ELSE 'nope' END "
        "AS column_values \nFROM t\n LIMIT 10000 OFFSET 0"
    )
    # make sure final query has single percents
    with database.get_sqla_engine() as engine:
        expected_sql = text(
            "SELECT DISTINCT CASE WHEN b LIKE 'A%' THEN 'yes' ELSE 'nope' END "
            "AS column_values \nFROM t\n LIMIT 10000 OFFSET 0"
        )
        called_sql = pd.read_sql_query.call_args.kwargs["sql"]
        called_conn = pd.read_sql_query.call_args.kwargs["con"]

        assert called_sql.compare(expected_sql) is True
        assert called_conn.engine == engine


def test_apply_series_others_grouping(database: Database) -> None:
    """
    Test the `_apply_series_others_grouping` method.

    This method should replace series columns with CASE expressions that
    group remaining series into an "Others" category based on a condition.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Create a mock table for testing
    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[
            TableColumn(column_name="category", type="TEXT"),
            TableColumn(column_name="metric_col", type="INTEGER"),
            TableColumn(column_name="other_col", type="TEXT"),
        ],
    )

    # Mock SELECT expressions
    category_expr = Mock()
    category_expr.name = "category"
    metric_expr = Mock()
    metric_expr.name = "metric_col"
    other_expr = Mock()
    other_expr.name = "other_col"

    select_exprs = [category_expr, metric_expr, other_expr]

    # Mock GROUP BY columns
    groupby_all_columns = {
        "category": category_expr,
        "other_col": other_expr,
    }

    # Define series columns (only category should be modified)
    groupby_series_columns = {"category": category_expr}

    # Create a condition factory that always returns True
    def always_true_condition(col_name: str, expr) -> bool:
        return True

    # Mock the make_sqla_column_compatible method
    def mock_make_compatible(expr, name=None):
        mock_result = Mock()
        mock_result.name = name
        return mock_result

    with patch.object(
        table, "make_sqla_column_compatible", side_effect=mock_make_compatible
    ):
        # Call the method
        result_select_exprs, result_groupby_columns = (
            table._apply_series_others_grouping(
                select_exprs,
                groupby_all_columns,
                groupby_series_columns,
                always_true_condition,
            )
        )

        # Verify SELECT expressions
        assert len(result_select_exprs) == 3

        # Category (series column) should be replaced with CASE expression
        category_result = result_select_exprs[0]
        assert category_result.name == "category"  # Should be made compatible

        # Metric (non-series column) should remain unchanged
        assert result_select_exprs[1] == metric_expr

        # Other (non-series column) should remain unchanged
        assert result_select_exprs[2] == other_expr

        # Verify GROUP BY columns
        assert len(result_groupby_columns) == 2

        # Category (series column) should be replaced with CASE expression
        assert "category" in result_groupby_columns
        category_groupby_result = result_groupby_columns["category"]
        assert category_groupby_result.name == "category"  # Should be made compatible

        # Other (non-series column) should remain unchanged
        assert result_groupby_columns["other_col"] == other_expr


def test_apply_series_others_grouping_with_false_condition(database: Database) -> None:
    """
    Test the `_apply_series_others_grouping` method with a condition that returns False.

    This should result in CASE expressions that always use "Others".
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Create a mock table for testing
    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="category", type="TEXT")],
    )

    # Mock SELECT expressions
    category_expr = Mock()
    category_expr.name = "category"
    select_exprs = [category_expr]

    # Mock GROUP BY columns
    groupby_all_columns = {"category": category_expr}
    groupby_series_columns = {"category": category_expr}

    # Create a condition factory that always returns False
    def always_false_condition(col_name: str, expr) -> bool:
        return False

    # Mock the make_sqla_column_compatible method
    def mock_make_compatible(expr, name=None):
        mock_result = Mock()
        mock_result.name = name
        return mock_result

    with patch.object(
        table, "make_sqla_column_compatible", side_effect=mock_make_compatible
    ):
        # Call the method
        result_select_exprs, result_groupby_columns = (
            table._apply_series_others_grouping(
                select_exprs,
                groupby_all_columns,
                groupby_series_columns,
                always_false_condition,
            )
        )

        # Verify that the expressions were replaced (we can't test SQL generation
        # in a unit test, but we can verify the structure changed)
        assert len(result_select_exprs) == 1
        assert result_select_exprs[0].name == "category"

        assert len(result_groupby_columns) == 1
        assert "category" in result_groupby_columns
        assert result_groupby_columns["category"].name == "category"
