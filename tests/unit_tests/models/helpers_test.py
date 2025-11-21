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
from sqlalchemy.sql.elements import ColumnElement

from superset.superset_typing import AdhocColumn

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
        # After our fix, GROUP BY expressions are NOT wrapped with
        # make_sqla_column_compatible, so it should be a raw CASE expression,
        # not a Mock with .name attribute. Verify it's different from the original
        assert category_groupby_result != category_expr

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
        # GROUP BY expression should be a CASE expression, not the original
        assert result_groupby_columns["category"] != category_expr


def test_apply_series_others_grouping_sql_compilation(database: Database) -> None:
    """
    Test that the `_apply_series_others_grouping` method properly quotes
    the 'Others' literal in both SELECT and GROUP BY clauses.

    This test verifies the fix for the bug where 'Others' was not quoted
    in the GROUP BY clause, causing SQL syntax errors.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Create a real table instance
    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[
            TableColumn(column_name="name", type="TEXT"),
            TableColumn(column_name="value", type="INTEGER"),
        ],
    )

    # Create real SQLAlchemy expressions
    name_col = sa.column("name")
    value_col = sa.column("value")

    select_exprs = [name_col, value_col]
    groupby_all_columns = {"name": name_col}
    groupby_series_columns = {"name": name_col}

    # Condition factory that checks if a subquery column is not null
    def condition_factory(col_name: str, expr):
        return sa.column("series_limit.name__").is_not(None)

    # Call the method
    result_select_exprs, result_groupby_columns = table._apply_series_others_grouping(
        select_exprs,
        groupby_all_columns,
        groupby_series_columns,
        condition_factory,
    )

    # Get the database dialect from the actual database
    with database.get_sqla_engine() as engine:
        dialect = engine.dialect

        # Test SELECT expression compilation
        select_case_expr = result_select_exprs[0]
        select_sql = str(
            select_case_expr.compile(
                dialect=dialect, compile_kwargs={"literal_binds": True}
            )
        )

        # Test GROUP BY expression compilation
        groupby_case_expr = result_groupby_columns["name"]
        groupby_sql = str(
            groupby_case_expr.compile(
                dialect=dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Different databases may use different quote characters
    # PostgreSQL/MySQL use single quotes, some might use double quotes
    # The key is that Others should be quoted, not bare

    # Check that 'Others' appears with some form of quotes
    # and not as a bare identifier
    assert " Others " not in select_sql, "Found unquoted 'Others' in SELECT"
    assert " Others " not in groupby_sql, "Found unquoted 'Others' in GROUP BY"

    # Check for common quoting patterns
    has_single_quotes = "'Others'" in select_sql and "'Others'" in groupby_sql
    has_double_quotes = '"Others"' in select_sql and '"Others"' in groupby_sql

    assert has_single_quotes or has_double_quotes, (
        "Others literal should be quoted with either single or double quotes"
    )

    # Verify the structure of the generated SQL
    assert "CASE WHEN" in select_sql
    assert "CASE WHEN" in groupby_sql

    # Check that ELSE is followed by a quoted value
    assert "ELSE " in select_sql
    assert "ELSE " in groupby_sql

    # The key test is that GROUP BY expression doesn't have a label
    # while SELECT might or might not have one depending on the database
    # What matters is that GROUP BY should NOT have label
    assert " AS " not in groupby_sql  # GROUP BY should NOT have label

    # Also verify that if SELECT has a label, it's different from GROUP BY
    if " AS " in select_sql:
        # If labeled, SELECT and GROUP BY should be different
        assert select_sql != groupby_sql


def test_apply_series_others_grouping_no_label_in_groupby(database: Database) -> None:
    """
    Test that GROUP BY expressions don't get wrapped with make_sqla_column_compatible.

    This is a specific test for the bug fix where make_sqla_column_compatible
    was causing issues with literal quoting in GROUP BY clauses.
    """
    from unittest.mock import ANY, call, Mock, patch

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Create a table instance
    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="category", type="TEXT")],
    )

    # Mock expressions
    category_expr = Mock()
    category_expr.name = "category"

    select_exprs = [category_expr]
    groupby_all_columns = {"category": category_expr}
    groupby_series_columns = {"category": category_expr}

    def condition_factory(col_name: str, expr):
        return True

    # Track calls to make_sqla_column_compatible
    with patch.object(
        table, "make_sqla_column_compatible", side_effect=lambda expr, name: expr
    ) as mock_make_compatible:
        result_select_exprs, result_groupby_columns = (
            table._apply_series_others_grouping(
                select_exprs,
                groupby_all_columns,
                groupby_series_columns,
                condition_factory,
            )
        )

        # Verify make_sqla_column_compatible was called for SELECT expressions
        # but NOT for GROUP BY expressions
        calls = mock_make_compatible.call_args_list

        # Should have exactly one call (for the SELECT expression)
        assert len(calls) == 1

        # The call should be for the SELECT expression with the column name
        # Using unittest.mock.ANY to match any CASE expression
        assert calls[0] == call(ANY, "category")

        # Verify the GROUP BY expression was NOT passed through
        # make_sqla_column_compatible - it should be the raw CASE expression
        assert "category" in result_groupby_columns
        # The GROUP BY expression should be different from the SELECT expression
        # because only SELECT gets make_sqla_column_compatible applied


def test_process_orderby_expression_basic(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test basic ORDER BY expression processing.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock _process_sql_expression to return a processed SELECT statement
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT 1 ORDER BY column_name DESC",
    )

    result = table._process_orderby_expression(
        expression="column_name DESC",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "column_name DESC"


def test_process_orderby_expression_with_case_insensitive_order_by(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test ORDER BY expression processing with case-insensitive matching.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock with lowercase "order by"
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT 1 order by column_name ASC",
    )

    result = table._process_orderby_expression(
        expression="column_name ASC",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "column_name ASC"


def test_process_orderby_expression_complex(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test ORDER BY expression with complex expressions.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    complex_orderby = "CASE WHEN status = 'active' THEN 1 ELSE 2 END, name DESC"
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=f"SELECT 1 ORDER BY {complex_orderby}",
    )

    result = table._process_orderby_expression(
        expression=complex_orderby,
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == complex_orderby


def test_process_orderby_expression_none(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test ORDER BY expression processing with None expression.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock should return None when input is None
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=None,
    )

    result = table._process_orderby_expression(
        expression=None,
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result is None


def test_process_orderby_expression_empty_string(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test ORDER BY expression processing with empty string.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock should return None for empty string
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=None,
    )

    result = table._process_orderby_expression(
        expression="",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result is None


def test_process_orderby_expression_strips_whitespace(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test that ORDER BY expression processing strips leading/trailing whitespace.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock with extra whitespace after ORDER BY
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT 1 ORDER BY   column_name DESC   ",
    )

    result = table._process_orderby_expression(
        expression="column_name DESC",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "column_name DESC"


def test_process_orderby_expression_with_template_processor(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test ORDER BY expression with template processor.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Create a mock template processor
    template_processor = Mock()

    # Mock the _process_sql_expression to verify it receives the prefixed expression
    mock_process = mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT 1 ORDER BY processed_column DESC",
    )

    result = table._process_orderby_expression(
        expression="column_name DESC",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=template_processor,
    )

    # Verify _process_sql_expression was called with SELECT prefix
    mock_process.assert_called_once()
    call_args = mock_process.call_args[1]
    assert call_args["expression"] == "SELECT 1 ORDER BY column_name DESC"
    assert call_args["template_processor"] is template_processor

    assert result == "processed_column DESC"


def test_process_select_expression_basic(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test basic SELECT expression processing.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock _process_sql_expression to return a processed SELECT statement
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT COUNT(*)",
    )

    result = table._process_select_expression(
        expression="COUNT(*)",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "COUNT(*)"


def test_process_select_expression_with_case_insensitive_select(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression processing with case-insensitive matching.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock with lowercase "select"
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="select column_name",
    )

    result = table._process_select_expression(
        expression="column_name",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "column_name"


def test_process_select_expression_complex(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression with complex expressions.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    complex_select = "CASE WHEN status = 'active' THEN 1 ELSE 0 END"
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=f"SELECT {complex_select}",
    )

    result = table._process_select_expression(
        expression=complex_select,
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == complex_select


def test_process_select_expression_none(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression processing with None expression.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock should return None when input is None
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=None,
    )

    result = table._process_select_expression(
        expression=None,
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result is None


def test_process_select_expression_empty_string(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression processing with empty string.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock should return None for empty string
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value=None,
    )

    result = table._process_select_expression(
        expression="",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result is None


def test_process_select_expression_strips_whitespace(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test that SELECT expression processing strips leading/trailing whitespace.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock with extra whitespace after SELECT
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT   column_name   ",
    )

    result = table._process_select_expression(
        expression="column_name",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "column_name"


def test_process_select_expression_with_template_processor(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression with template processor.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Create a mock template processor
    template_processor = Mock()

    # Mock the _process_sql_expression to verify it receives the prefixed expression
    mock_process = mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT processed_expression",
    )

    result = table._process_select_expression(
        expression="some_expression",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=template_processor,
    )

    # Verify _process_sql_expression was called with SELECT prefix
    mock_process.assert_called_once()
    call_args = mock_process.call_args[1]
    assert call_args["expression"] == "SELECT some_expression"
    assert call_args["template_processor"] is template_processor

    assert result == "processed_expression"


def test_process_select_expression_distinct_column(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test SELECT expression with DISTINCT keyword (e.g., "distinct owners").

    This test ensures that expressions like "distinct owners" used in adhoc
    metrics or columns are properly parsed and validated.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Mock _process_sql_expression to return a processed SELECT with DISTINCT
    mocker.patch.object(
        table,
        "_process_sql_expression",
        return_value="SELECT DISTINCT owners",
    )

    result = table._process_select_expression(
        expression="distinct owners",
        database_id=database.id,
        engine="sqlite",
        schema="",
        template_processor=None,
    )

    assert result == "DISTINCT owners"


def test_process_select_expression_end_to_end(database: Database) -> None:
    """
    End-to-end test that verifies the regex split works with real sqlglot processing.

    This test does NOT mock _process_sql_expression, allowing the full flow
    through sqlglot parsing and validation to ensure the regex extraction works.
    """
    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
    )

    # Test various real-world expressions
    test_cases = [
        # (input, expected_output)
        ("COUNT(*)", "COUNT(*)"),
        ("DISTINCT owners", "DISTINCT owners"),
        ("column_name", "column_name"),
        (
            "CASE WHEN status = 'active' THEN 1 ELSE 0 END",
            "CASE WHEN status = 'active' THEN 1 ELSE 0 END",
        ),
        ("SUM(amount) / COUNT(*)", "SUM(amount) / COUNT(*)"),
        ("UPPER(name)", "UPPER(name)"),
    ]

    for expression, expected in test_cases:
        result = table._process_select_expression(
            expression=expression,
            database_id=database.id,
            engine="sqlite",
            schema="",
            template_processor=None,
        )
        # sqlglot may normalize the SQL slightly, so we check the result exists
        # and doesn't contain the SELECT prefix
        assert result is not None, f"Failed to process: {expression}"
        assert not result.upper().startswith("SELECT"), (
            f"Result still has SELECT prefix: {result}"
        )
        # The result should contain the core expression (case-insensitive check)
        assert expected.replace(" ", "").lower() in result.replace(" ", "").lower(), (
            f"Expected '{expected}' to be in result '{result}' for input '{expression}'"
        )


def test_reapply_query_filters_with_granularity(database: Database) -> None:
    """
    Test that _reapply_query_filters correctly applies filters with granularity.

    When granularity is provided, both time_filters and where_clause_and should
    be combined in the WHERE clause.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="value", type="INTEGER")],
    )

    # Create a simple query
    qry = sa.select(sa.column("value"))

    # Create mock filter conditions
    time_filter = sa.column("time_col") >= "2025-01-01"
    where_filter = sa.column("value") > 10

    time_filters = [time_filter]
    where_clause_and = [where_filter]
    having_clause_and: list[ColumnElement] = []

    # Call the method
    result_qry = table._reapply_query_filters(
        qry=qry,
        apply_fetch_values_predicate=False,
        template_processor=None,
        granularity="time_col",
        time_filters=time_filters,
        where_clause_and=where_clause_and,
        having_clause_and=having_clause_and,
    )

    # Compile the query to SQL
    with database.get_sqla_engine() as engine:
        sql = str(
            result_qry.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Verify WHERE clause is present
    assert "WHERE" in sql
    # Both filters should be in the query
    assert "time_col" in sql
    assert "value" in sql


def test_reapply_query_filters_without_granularity(database: Database) -> None:
    """
    Test that _reapply_query_filters works correctly without granularity.

    This test verifies the bug fix where time_filters was not initialized
    when granularity is None. The method should handle empty time_filters
    gracefully and only apply where_clause_and.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="value", type="INTEGER")],
    )

    # Create a simple query
    qry = sa.select(sa.column("value"))

    # Empty time_filters (as would happen without granularity)
    time_filters: list[ColumnElement] = []
    where_filter = sa.column("value") > 10
    where_clause_and = [where_filter]
    having_clause_and: list[ColumnElement] = []

    # Call the method with granularity=None
    result_qry = table._reapply_query_filters(
        qry=qry,
        apply_fetch_values_predicate=False,
        template_processor=None,
        granularity=None,
        time_filters=time_filters,
        where_clause_and=where_clause_and,
        having_clause_and=having_clause_and,
    )

    # Compile the query to SQL
    with database.get_sqla_engine() as engine:
        sql = str(
            result_qry.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Verify WHERE clause is present with the where_filter
    assert "WHERE" in sql
    assert "value" in sql


def test_reapply_query_filters_with_having_clause(database: Database) -> None:
    """
    Test that _reapply_query_filters correctly applies HAVING clause.

    HAVING clauses are used for filtering on aggregated metrics.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="value", type="INTEGER")],
    )

    # Create a query with GROUP BY
    qry = sa.select(sa.column("category"), sa.func.sum(sa.column("value"))).group_by(
        sa.column("category")
    )

    # Create HAVING condition
    having_filter = sa.func.sum(sa.column("value")) > 100
    having_clause_and = [having_filter]

    # Call the method
    result_qry = table._reapply_query_filters(
        qry=qry,
        apply_fetch_values_predicate=False,
        template_processor=None,
        granularity=None,
        time_filters=[],
        where_clause_and=[],
        having_clause_and=having_clause_and,
    )

    # Compile the query to SQL
    with database.get_sqla_engine() as engine:
        sql = str(
            result_qry.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Verify HAVING clause is present
    assert "HAVING" in sql
    assert "sum" in sql.lower()


def test_reapply_query_filters_with_fetch_values_predicate(database: Database) -> None:
    """
    Test that _reapply_query_filters applies fetch_values_predicate when enabled.

    Fetch values predicate is used for filtering specific column values.
    """
    from unittest.mock import Mock

    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="value", type="INTEGER")],
    )

    # Mock fetch_values_predicate
    fetch_predicate = sa.column("value").in_([1, 2, 3])
    table.fetch_values_predicate = True

    # Mock get_fetch_values_predicate method
    mock_template_processor = Mock()
    with patch.object(
        table, "get_fetch_values_predicate", return_value=fetch_predicate
    ):
        # Create a simple query
        qry = sa.select(sa.column("value"))

        # Call the method with apply_fetch_values_predicate=True
        result_qry = table._reapply_query_filters(
            qry=qry,
            apply_fetch_values_predicate=True,
            template_processor=mock_template_processor,
            granularity=None,
            time_filters=[],
            where_clause_and=[],
            having_clause_and=[],
        )

        # Compile the query to SQL
        with database.get_sqla_engine() as engine:
            sql = str(
                result_qry.compile(
                    dialect=engine.dialect, compile_kwargs={"literal_binds": True}
                )
            )

        # Verify WHERE clause with IN condition is present
        assert "WHERE" in sql
        assert "IN" in sql


def test_reapply_query_filters_with_empty_filters(database: Database) -> None:
    """
    Test that _reapply_query_filters handles empty filter lists gracefully.

    This is an edge case test to ensure the method doesn't fail when
    all filter lists are empty.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="value", type="INTEGER")],
    )

    # Create a simple query
    qry = sa.select(sa.column("value"))

    # All empty filter lists
    time_filters: list[ColumnElement] = []
    where_clause_and: list[ColumnElement] = []
    having_clause_and: list[ColumnElement] = []

    # Call the method with empty filters
    result_qry = table._reapply_query_filters(
        qry=qry,
        apply_fetch_values_predicate=False,
        template_processor=None,
        granularity=None,
        time_filters=time_filters,
        where_clause_and=where_clause_and,
        having_clause_and=having_clause_and,
    )

    # Should not raise an error
    # Compile the query to verify it's valid
    with database.get_sqla_engine() as engine:
        sql = str(
            result_qry.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Query should be valid without WHERE or HAVING
    assert "SELECT" in sql
    assert "value" in sql


def test_adhoc_column_to_sqla_with_column_reference(database: Database) -> None:
    """
    Test that adhoc_column_to_sqla properly handles column references
    by looking up the column in metadata instead of quoting and processing through
    SQLGlot.

    This tests the fix for column names with spaces being properly handled
    without going through SQLGlot which could misinterpret "column AS alias" patterns.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[
            TableColumn(column_name="Customer Name", type="TEXT"),
        ],
    )

    # Test: Column reference with spaces should be found in metadata
    col_with_spaces: AdhocColumn = {
        "sqlExpression": "Customer Name",
        "label": "Customer Name",
        "isColumnReference": True,
    }

    result = table.adhoc_column_to_sqla(col_with_spaces)

    # Should return a valid SQLAlchemy column
    assert result is not None
    result_str = str(result)

    # The column name should be present (may or may not be quoted depending on dialect)
    assert "Customer Name" in result_str or '"Customer Name"' in result_str


def test_adhoc_column_to_sqla_preserves_column_type_for_time_grain(
    database: Database,
) -> None:
    """
    Test that adhoc_column_to_sqla preserves column type info in column references.

    This tests the fix where column references now look up metadata first, preserving
    type information needed for time grain operations. Previously, quoting the column
    name before metadata lookup would cause the column to not be found, resulting in
    NULL type and failing to apply time grain transformations properly.

    The test verifies that:
    1. Column metadata is found by looking up the unquoted column name
    2. The column type (DATE) is preserved when creating the SQLAlchemy column
    3. The get_timestamp_expr method is properly called with the column type info
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Create a table with a temporal column
    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[
            TableColumn(
                column_name="local_date",
                type="DATE",
                is_dttm=True,
            )
        ],
    )

    # Test with a DATE column reference with time grain
    date_col: AdhocColumn = {
        "sqlExpression": "local_date",
        "label": "local_date",
        "isColumnReference": True,
        "timeGrain": "P1D",  # Daily time grain
        "columnType": "BASE_AXIS",
    }

    # Should not raise ColumnNotFoundException
    result = table.adhoc_column_to_sqla(date_col)

    assert result is not None
    result_str = str(result)

    # Verify the column name is present (may be quoted depending on dialect)
    assert "local_date" in result_str


def test_adhoc_column_to_sqla_with_temporal_column_types(database: Database) -> None:
    """
    Test that adhoc_column_to_sqla correctly handles different temporal column types.

    This verifies that for different temporal types (DATE, DATETIME, TIMESTAMP),
    the column metadata is properly found and the column type is preserved,
    allowing time grain operations to work correctly.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    # Test different temporal types
    temporal_types = ["DATE", "DATETIME", "TIMESTAMP"]

    for type_name in temporal_types:
        table = SqlaTable(
            table_name="test_table",
            database=database,
            columns=[
                TableColumn(
                    column_name="time_col",
                    type=type_name,
                    is_dttm=True,
                )
            ],
        )

        time_col: AdhocColumn = {
            "sqlExpression": "time_col",
            "label": "time_col",
            "isColumnReference": True,
            "timeGrain": "P1D",
            "columnType": "BASE_AXIS",
        }

        result = table.adhoc_column_to_sqla(time_col)

        assert result is not None
        result_str = str(result)

        # Verify the column name is present
        assert "time_col" in result_str


def test_adhoc_column_with_spaces_generates_quoted_sql(database: Database) -> None:
    """
    Test that column names with spaces are properly quoted in the generated SQL.

    This verifies that even though we look up columns using unquoted names,
    the final SQL still properly quotes column names that need quoting (like those with
    spaces).
    """

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[
            TableColumn(column_name="Customer Name", type="TEXT"),
            TableColumn(column_name="Order Total", type="NUMERIC"),
        ],
    )

    # Test column reference with spaces
    col_with_spaces: AdhocColumn = {
        "sqlExpression": "Customer Name",
        "label": "Customer Name",
        "isColumnReference": True,
    }

    result = table.adhoc_column_to_sqla(col_with_spaces)

    # Compile the column to SQL to see how it's rendered
    with database.get_sqla_engine() as engine:
        sql = str(
            result.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # The SQL should quote the column name (SQLite uses double quotes)
    # Column names with spaces MUST be quoted in SQL
    assert '"Customer Name"' in sql, f"Expected quoted column name in SQL: {sql}"

    # Also test that it works in a query context
    col_numeric: AdhocColumn = {
        "sqlExpression": "Order Total",
        "label": "Order Total",
        "isColumnReference": True,
    }

    result_numeric = table.adhoc_column_to_sqla(col_numeric)

    with database.get_sqla_engine() as engine:
        sql_numeric = str(
            result_numeric.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    assert '"Order Total"' in sql_numeric, (
        f"Expected quoted column name in SQL: {sql_numeric}"
    )


def test_adhoc_column_with_spaces_in_full_query(database: Database) -> None:
    """
    Test that column names with spaces work correctly in a full SELECT query.

    This demonstrates that the fix properly handles column names with spaces
    throughout the entire query generation process, with proper quoting in the final
    SQL.
    """
    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        table_name="test_table",
        database=database,
        columns=[
            TableColumn(column_name="Customer Name", type="TEXT"),
            TableColumn(column_name="Order Total", type="NUMERIC"),
        ],
    )

    # Create adhoc columns for both columns with spaces
    customer_col: AdhocColumn = {
        "sqlExpression": "Customer Name",
        "label": "Customer Name",
        "isColumnReference": True,
    }

    order_col: AdhocColumn = {
        "sqlExpression": "Order Total",
        "label": "Order Total",
        "isColumnReference": True,
    }

    # Get SQLAlchemy columns
    customer_sqla = table.adhoc_column_to_sqla(customer_col)
    order_sqla = table.adhoc_column_to_sqla(order_col)

    # Build a full query
    tbl = table.get_sqla_table()
    query = sa.select(customer_sqla, order_sqla).select_from(tbl)

    # Compile to SQL
    with database.get_sqla_engine() as engine:
        sql = str(
            query.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    # Verify both column names are quoted in the final SQL
    assert '"Customer Name"' in sql, f"Customer Name not properly quoted in SQL: {sql}"
    assert '"Order Total"' in sql, f"Order Total not properly quoted in SQL: {sql}"

    # Verify SELECT and FROM clauses are present
    assert "SELECT" in sql
    assert "FROM" in sql
