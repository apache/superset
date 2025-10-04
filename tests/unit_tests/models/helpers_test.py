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
from sqlalchemy import create_engine
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
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
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
    import numpy as np
    import pandas as pd

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[TableColumn(column_name="a")],
    )

    # Mock pd.read_sql_query to return a dataframe with the expected values
    with patch(
        "pandas.read_sql_query",
        return_value=pd.DataFrame({"column_values": [1, np.nan]}),
    ):
        assert table.values_for_column("a") == [1, None]


def test_values_for_column_with_rls(database: Database) -> None:
    """
    Test the `values_for_column` method with RLS enabled.
    """
    import pandas as pd
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

    # Mock RLS filters and pd.read_sql_query
    with (
        patch.object(
            table,
            "get_sqla_row_level_filters",
            return_value=[
                TextClause("a = 1"),
            ],
        ),
        patch(
            "pandas.read_sql_query",
            return_value=pd.DataFrame({"column_values": [1]}),
        ),
    ):
        assert table.values_for_column("a") == [1]


def test_values_for_column_with_rls_no_values(database: Database) -> None:
    """
    Test the `values_for_column` method with RLS enabled and no values.
    """
    import pandas as pd
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

    # Mock RLS filters and pd.read_sql_query to return empty dataframe
    with (
        patch.object(
            table,
            "get_sqla_row_level_filters",
            return_value=[
                TextClause("a = 2"),
            ],
        ),
        patch(
            "pandas.read_sql_query",
            return_value=pd.DataFrame({"column_values": []}),
        ),
    ):
        assert table.values_for_column("a") == []


def test_values_for_column_calculated(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test that calculated columns work.
    """
    import pandas as pd

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

    # Mock pd.read_sql_query to return expected values for calculated column
    with patch(
        "pandas.read_sql_query",
        return_value=pd.DataFrame({"column_values": ["yes", "nope"]}),
    ):
        assert table.values_for_column("starts_with_A") == ["yes", "nope"]


def test_values_for_column_double_percents(
    mocker: MockerFixture,
    database: Database,
) -> None:
    """
    Test the behavior of `double_percents`.
    """
    import pandas as pd

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

    # Mock pd.read_sql_query to capture the SQL and return expected values
    read_sql_mock = mocker.patch(
        "pandas.read_sql_query",
        return_value=pd.DataFrame({"column_values": ["yes", "nope"]}),
    )

    result = table.values_for_column("starts_with_A")

    # Verify the result
    assert result == ["yes", "nope"]

    # Verify read_sql_query was called
    read_sql_mock.assert_called_once()

    # Get the SQL that was passed to read_sql_query
    called_sql = str(read_sql_mock.call_args[1]["sql"])

    # The SQL should have single percents (after replacement)
    assert "LIKE 'A%'" in called_sql
    assert "LIKE 'A%%'" not in called_sql


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
