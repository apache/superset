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
from typing import Any, TYPE_CHECKING, Union
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


def test_build_metric_expression_adhoc(database: Database) -> None:
    """
    Test the `_build_metric_expression` method with adhoc metrics.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.utils.core import AdhocMetricExpressionType

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[
            TableColumn(column_name="sales", type="NUMERIC"),
            TableColumn(column_name="quantity", type="INTEGER"),
        ],
    )

    # Test adhoc metric with SIMPLE expression
    adhoc_metric = {
        "expressionType": AdhocMetricExpressionType.SIMPLE,
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
        "label": "total_sales",
    }

    columns_by_name = {col.column_name: col for col in table.columns}
    metrics_by_name: dict[str, Any] = {}

    # Mock the adhoc_metric_to_sqla method
    expected_result = Mock()
    with patch.object(
        table, "adhoc_metric_to_sqla", return_value=expected_result
    ) as mock_adhoc:
        result = table._build_metric_expression(
            adhoc_metric,  # type: ignore[arg-type]
            columns_by_name,
            metrics_by_name,
        )

        assert result == expected_result
        mock_adhoc.assert_called_once_with(
            metric=adhoc_metric,
            columns_by_name=columns_by_name,
            template_processor=None,
        )


def test_build_metric_expression_named(database: Database) -> None:
    """
    Test the `_build_metric_expression` method with named metrics.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    # Create a table with a named metric
    metric = SqlMetric(metric_name="avg_price", expression="AVG(price)")
    mock_col = Mock()
    mock_col.name = "avg_price_col"
    metric.get_sqla_col = Mock(return_value=mock_col)  # type: ignore[method-assign]

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="price", type="NUMERIC")],
        metrics=[metric],
    )

    columns_by_name = {col.column_name: col for col in table.columns}
    metrics_by_name = {m.metric_name: m for m in table.metrics}

    result = table._build_metric_expression(
        "avg_price", columns_by_name, metrics_by_name
    )

    # Should have called get_sqla_col on the metric
    metric.get_sqla_col.assert_called_once_with(template_processor=None)
    assert result == mock_col


def test_build_metric_expression_invalid(database: Database) -> None:
    """
    Test the `_build_metric_expression` method with invalid metric.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.exceptions import QueryObjectValidationError

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[TableColumn(column_name="sales", type="NUMERIC")],
    )

    columns_by_name = {col.column_name: col for col in table.columns}
    metrics_by_name: dict[str, Any] = {}

    # Test with non-existent metric name
    with pytest.raises(QueryObjectValidationError) as exc_info:
        table._build_metric_expression(
            "non_existent_metric", columns_by_name, metrics_by_name
        )

    assert "Metric 'non_existent_metric' does not exist" in str(exc_info.value)


def test_normalize_column_labels(database: Database) -> None:
    """
    Test the `_normalize_column_labels` method.
    """
    from unittest.mock import Mock, patch, PropertyMock

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Mock db_engine_spec
    mock_engine_spec = Mock()
    mock_engine_spec.make_label_compatible = lambda x: f"normalized_{x}"

    with patch.object(
        type(table), "db_engine_spec", new_callable=PropertyMock
    ) as mock_prop:
        mock_prop.return_value = mock_engine_spec

        # Test with series columns
        series_columns = ["col1", "col2", "col3"]
        result = table._normalize_column_labels(None, series_columns)

        assert result == ["normalized_col1", "normalized_col2", "normalized_col3"]

        # Test with no series columns
        result = table._normalize_column_labels(None, None)
        assert result == []

        # Test with empty series columns
        result = table._normalize_column_labels(None, [])
        assert result == []


def test_wrap_query_for_rowcount(database: Database) -> None:
    """
    Test the `_wrap_query_for_rowcount` method.
    """
    from unittest.mock import Mock, patch, PropertyMock

    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import QueryObjectValidationError

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Mock db_engine_spec
    mock_engine_spec = Mock()

    with patch.object(
        type(table), "db_engine_spec", new_callable=PropertyMock
    ) as mock_prop:
        mock_prop.return_value = mock_engine_spec
        # Test when subqueries are allowed
        mock_engine_spec.allows_subqueries = True

        # Create a mock query
        original_query = sa.select([sa.column("col1"), sa.column("col2")])

        # Mock make_sqla_column_compatible to return a real SQLAlchemy column
        from sqlalchemy import literal_column

        mock_col = literal_column("COUNT(*)")
        mock_col.key = "rowcount"

        with patch.object(
            table, "make_sqla_column_compatible", return_value=mock_col
        ) as mock_make:
            wrapped_query, labels_expected = table._wrap_query_for_rowcount(
                original_query
            )

            # Check that make_sqla_column_compatible was called correctly
            mock_make.assert_called_once()
            call_args = mock_make.call_args[0]
            # First argument should be a literal column with COUNT(*)
            assert str(call_args[0]) == "COUNT(*)"
            assert call_args[1] == "rowcount"

            # Check labels_expected
            assert labels_expected == ["rowcount"]

            # Verify the wrapped query structure
            assert wrapped_query is not None

        # Test when subqueries are not allowed
        mock_engine_spec.allows_subqueries = False

        with pytest.raises(QueryObjectValidationError) as exc_info:
            table._wrap_query_for_rowcount(original_query)

        assert "Database does not support subqueries" in str(exc_info.value)


def test_normalize_filter_value(database: Database) -> None:
    """
    Test the `_normalize_filter_value` method.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.utils.core import FilterOperator, GenericDataType

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Test TEMPORAL_RANGE - should pass through unchanged
    result = table._normalize_filter_value(
        "last 7 days", GenericDataType.TEMPORAL, FilterOperator.TEMPORAL_RANGE
    )
    assert result == "last 7 days"

    # Test numeric string conversion
    result = table._normalize_filter_value(
        "123.45", GenericDataType.NUMERIC, FilterOperator.EQUALS
    )
    assert result == 123.45

    # Test numeric string with LIKE operator - should not convert
    result = table._normalize_filter_value(
        "123", GenericDataType.NUMERIC, FilterOperator.LIKE
    )
    assert result == "123"

    # Test NULL_STRING conversion
    result = table._normalize_filter_value(
        "<NULL>", GenericDataType.STRING, FilterOperator.EQUALS
    )
    assert result is None

    # Test EMPTY_STRING conversion
    result = table._normalize_filter_value(
        "", GenericDataType.STRING, FilterOperator.EQUALS
    )
    assert result == ""

    # Test boolean conversion
    result = table._normalize_filter_value(
        "true", GenericDataType.BOOLEAN, FilterOperator.EQUALS
    )
    assert result is True

    result = table._normalize_filter_value(
        "false", GenericDataType.BOOLEAN, FilterOperator.EQUALS
    )
    assert result is False

    # Test string trimming (only removes \t and \n, not spaces)
    result = table._normalize_filter_value(
        "  hello\t\n", GenericDataType.STRING, FilterOperator.EQUALS
    )
    assert result == "  hello"


def test_deduplicate_select_columns(database: Database) -> None:
    """
    Test the `_deduplicate_select_columns` method.
    """
    from unittest.mock import Mock, patch, PropertyMock

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Mock db_engine_spec
    mock_engine_spec = Mock()

    # Create mock expressions with proper name attributes
    col1 = Mock()
    col1.name = "col1"
    col2 = Mock()
    col2.name = "col2"
    col3 = Mock()
    col3.name = "col3"
    metric1 = Mock()
    metric1.name = "col2"  # Duplicate name with col2
    metric2 = Mock()
    metric2.name = "metric2"
    orderby1 = Mock()
    orderby1.name = "orderby1"

    select_exprs = [col1, col2, col3]
    metrics_exprs = [metric1, metric2]
    orderby_exprs = [orderby1]

    with patch.object(
        type(table), "db_engine_spec", new_callable=PropertyMock
    ) as mock_prop:
        mock_prop.return_value = mock_engine_spec
        # Test with allows_hidden_orderby_agg = True
        mock_engine_spec.allows_hidden_orderby_agg = True

        result = table._deduplicate_select_columns(
            select_exprs, metrics_exprs, orderby_exprs
        )

        # Should have col1, col2 (not metric1 due to duplicate name), col3, metric2
        assert len(result) == 4
        assert col1 in result
        assert col2 in result
        assert col3 in result
        assert metric2 in result
        assert metric1 not in result  # Removed as duplicate of col2
        assert orderby1 not in result  # Not added when allows_hidden_orderby_agg = True

        # Test with allows_hidden_orderby_agg = False
        mock_engine_spec.allows_hidden_orderby_agg = False

        result = table._deduplicate_select_columns(
            select_exprs, metrics_exprs, orderby_exprs
        )

        # Should include orderby expressions
        assert len(result) == 5
        assert orderby1 in result


def test_apply_orderby_direction(database: Database) -> None:
    """
    Test the `_apply_orderby_direction` method.
    """
    from unittest.mock import Mock, patch, PropertyMock

    import sqlalchemy as sa
    from sqlalchemy.sql.expression import Label

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Mock db_engine_spec
    mock_engine_spec = Mock()
    mock_engine_spec.allows_alias_in_orderby = True
    mock_engine_spec.get_allows_alias_in_select = Mock(return_value=True)
    mock_engine_spec.allows_hidden_cc_in_orderby = True

    # Create a mock query
    query = Mock()
    query.order_by = Mock(return_value=query)

    # Create mock expressions
    col1 = Mock()
    col1.name = "col1"
    col1_label = Label("col1", sa.column("col1"))
    col2 = Mock()
    col2.name = "col2"

    orderby_exprs = [col1_label, col2]
    orderby: list[tuple[Union[str, Any], bool]] = [
        ("col1", True),
        ("col2", False),
    ]  # col1 ASC, col2 DESC
    select_exprs = [col1, col2]

    with patch.object(
        type(table), "db_engine_spec", new_callable=PropertyMock
    ) as mock_prop:
        mock_prop.return_value = mock_engine_spec
        # Test with allows_alias_in_orderby = False
        mock_engine_spec.allows_alias_in_orderby = False

        with patch.object(table, "database", database):
            result = table._apply_orderby_direction(
                query, orderby_exprs, orderby, select_exprs
            )

        # Should have called order_by twice
        assert query.order_by.call_count == 2

        # Reset for next test
        query.order_by.reset_mock()

        # Test with allows_alias_in_orderby = True
        mock_engine_spec.allows_alias_in_orderby = True

        with patch.object(table, "database", database):
            result = table._apply_orderby_direction(
                query, orderby_exprs, orderby, select_exprs
            )

        assert result == query
        assert query.order_by.call_count == 2


def test_create_others_case_expression(database: Database) -> None:
    """
    Test the `_create_others_case_expression` method.
    """
    from unittest.mock import Mock

    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Test with real SQLAlchemy expressions
    expr = sa.column("category")
    condition = sa.column("category").in_(["A", "B", "C"])

    # Test without label
    result = table._create_others_case_expression(expr, condition)

    # Compile to SQL to verify structure
    with database.get_sqla_engine() as engine:
        sql = str(
            result.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    assert "CASE WHEN" in sql
    assert "ELSE 'Others'" in sql

    # Test with label
    mock_result = Mock()
    with patch.object(
        table, "make_sqla_column_compatible", return_value=mock_result
    ) as mock_make:
        result = table._create_others_case_expression(expr, condition, "my_label")

        assert result == mock_result
        mock_make.assert_called_once()
        # First argument is the CASE expression, second is the label
        assert mock_make.call_args[0][1] == "my_label"


def test_process_adhoc_sql_expression(database: Database) -> None:
    """
    Test the `_process_adhoc_sql_expression` method.
    """
    from unittest.mock import Mock, patch

    from superset.connectors.sqla.models import SqlaTable

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    # Mock the _process_sql_expression method
    with patch.object(
        table, "_process_sql_expression", return_value="processed_sql"
    ) as mock_process:
        # Test with template processor
        template_processor = Mock()
        result = table._process_adhoc_sql_expression(
            "SELECT * FROM table", template_processor
        )

        assert result == "processed_sql"
        mock_process.assert_called_once_with(
            expression="SELECT * FROM table",
            database_id=table.database_id,
            engine=database.backend,
            schema=None,
            template_processor=template_processor,
        )

    # Test when _process_sql_expression returns None
    with patch.object(table, "_process_sql_expression", return_value=None):
        result = table._process_adhoc_sql_expression("SELECT * FROM table")
        assert result is None


def test_build_top_groups_filter(database: Database) -> None:
    """
    Test the `_build_top_groups_filter` method.
    """
    from unittest.mock import Mock, patch

    import pandas as pd

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[
            TableColumn(column_name="category", type="TEXT"),
            TableColumn(column_name="subcategory", type="TEXT"),
        ],
    )

    # Create test DataFrame
    df = pd.DataFrame(
        {
            "category": ["A", "A", "B", "B", "C"],
            "subcategory": ["X", "Y", "X", "Y", "Z"],
            "metric": [100, 200, 150, 250, 300],
        }
    )

    # Mock groupby_series_columns
    category_col = Mock()
    category_col.key = "category"
    subcategory_col = Mock()
    subcategory_col.key = "subcategory"

    groupby_series_columns = {
        "category": category_col,
        "subcategory": subcategory_col,
    }

    columns_by_name = {col.column_name: col for col in table.columns}

    # Mock _get_top_groups to return a mock filter expression
    mock_filter = Mock()
    mock_filter.__str__ = Mock(  # type: ignore[method-assign]
        return_value="category IN ('A', 'B') AND subcategory IN ('X', 'Y')"
    )
    with patch.object(table, "_get_top_groups", return_value=mock_filter):
        result = table._build_top_groups_filter(
            df, groupby_series_columns, columns_by_name
        )

        # Should call _get_top_groups with the right dimensions
        assert result == mock_filter
        table._get_top_groups.assert_called_once_with(  # type: ignore[attr-defined]
            df, ["category", "subcategory"], groupby_series_columns, columns_by_name
        )


def test_get_series_orderby_expression(database: Database) -> None:
    """
    Test the `_get_series_orderby_expression` method.
    """
    from unittest.mock import Mock

    from superset.connectors.sqla.models import SqlaTable, SqlMetric

    metric = SqlMetric(metric_name="sum_sales", expression="SUM(sales)")
    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        metrics=[metric],
    )

    columns_by_name: dict[str, Any] = {}
    metrics_by_name = {"sum_sales": metric}

    # Mock the metric's get_sqla_col method
    mock_expr = Mock()
    mock_expr.name = "sum_sales_expr"
    metric.get_sqla_col = Mock(return_value=mock_expr)  # type: ignore[method-assign]

    # Test when series_limit_metric is None
    main_metric_expr = Mock()
    main_metric_expr.name = "main_metric"

    result = table._get_series_orderby_expression(
        series_limit_metric=None,
        main_metric_expr=main_metric_expr,
        metrics_by_name=metrics_by_name,
        columns_by_name=columns_by_name,
    )

    # Should return the main metric expression when series_limit_metric is None
    assert result == main_metric_expr

    # Test when series_limit_metric is provided
    mock_orderby_expr = Mock()
    with patch.object(table, "_get_series_orderby", return_value=mock_orderby_expr):
        result = table._get_series_orderby_expression(
            series_limit_metric="sum_sales",
            main_metric_expr=Mock(name="different_metric"),
            metrics_by_name=metrics_by_name,
            columns_by_name=columns_by_name,
            template_processor=None,
        )

        # Should call _get_series_orderby
        table._get_series_orderby.assert_called_once_with(  # type: ignore[attr-defined]
            series_limit_metric="sum_sales",
            metrics_by_name=metrics_by_name,
            columns_by_name=columns_by_name,
            template_processor=None,
        )
        assert result == mock_orderby_expr

    # Test with adhoc metric
    adhoc_metric = {"expressionType": "SQL", "sqlExpression": "COUNT(*)"}
    with patch.object(table, "_get_series_orderby", return_value=mock_orderby_expr):
        result = table._get_series_orderby_expression(
            series_limit_metric=adhoc_metric,  # type: ignore[arg-type]
            main_metric_expr=Mock(name="main"),
            metrics_by_name=metrics_by_name,
            columns_by_name=columns_by_name,
        )
        assert result == mock_orderby_expr


def test_build_time_filter_expression(database: Database) -> None:
    """
    Test the `_build_time_filter_expression` method.
    """
    from datetime import datetime
    from unittest.mock import Mock, patch, PropertyMock

    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
        columns=[
            TableColumn(column_name="timestamp_col", type="TIMESTAMP"),
        ],
    )

    # Create a mock column
    col = sa.column("timestamp_col")
    time_col = table.columns[0]  # Use the TableColumn we created

    # Mock db_engine_spec and dttm_sql_literal
    mock_engine_spec = Mock()
    mock_engine_spec.get_text_clause = lambda x: sa.text(x)

    with patch.object(
        type(table), "db_engine_spec", new_callable=PropertyMock
    ) as mock_prop:
        mock_prop.return_value = mock_engine_spec

        with patch.object(table, "dttm_sql_literal") as mock_dttm:
            mock_dttm.side_effect = lambda dt, _: f"'{dt.isoformat()}'"

            # Test with both start and end times
            start_dttm = datetime(2023, 1, 1, 0, 0, 0)
            end_dttm = datetime(2023, 12, 31, 23, 59, 59)

            result = table._build_time_filter_expression(
                col, start_dttm, end_dttm, time_col
            )

            # Should create an AND condition with >= and <
            assert result is not None
            result_str = str(result)
            assert "AND" in result_str
            assert ">=" in result_str
            assert "<" in result_str

            # Test with only start time
            result = table._build_time_filter_expression(
                col, start_dttm, None, time_col
            )
            result_str = str(result)
            assert ">=" in result_str
            assert "<" not in result_str

            # Test with only end time
            result = table._build_time_filter_expression(col, None, end_dttm, time_col)
            result_str = str(result)
            assert "<" in result_str
            assert ">=" not in result_str

            # Test with no times - should return true()
            result = table._build_time_filter_expression(col, None, None, time_col)
            result_str = str(result)
            assert "true" in result_str.lower()


def test_apply_advanced_data_type_filter(database: Database) -> None:
    """
    Test the `_apply_advanced_data_type_filter` method.
    """
    from unittest.mock import Mock, patch

    import sqlalchemy as sa

    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import AdvancedDataTypeResponseError
    from superset.utils.core import FilterOperator

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="test_table",
    )

    col = sa.column("test_col")

    # Mock advanced data type handler
    mock_adt_handler = Mock()
    mock_adt_handler.translate_type = Mock(
        return_value={"values": ["translated"], "error_message": None}
    )
    mock_adt_handler.translate_filter = Mock(return_value=sa.text("filtered_expr"))

    # Mock current_app.config
    with patch("superset.models.helpers.current_app") as mock_app:
        mock_config = {"ADVANCED_DATA_TYPES": {"SPATIAL": mock_adt_handler}}
        mock_app.config.get = Mock(
            return_value=mock_config.get("ADVANCED_DATA_TYPES", {})
        )

        # Test successful filtering
        result = table._apply_advanced_data_type_filter(
            col, "SPATIAL", FilterOperator.EQUALS, "POINT(0 0)"
        )

        assert result is not None
        mock_adt_handler.translate_type.assert_called_once_with(
            {"type": "SPATIAL", "values": ["POINT(0 0)"]}
        )
        mock_adt_handler.translate_filter.assert_called_once_with(
            col, FilterOperator.EQUALS, ["translated"]
        )

        # Test with list values (IN operator)
        mock_adt_handler.translate_type.reset_mock()
        mock_adt_handler.translate_filter.reset_mock()

        result = table._apply_advanced_data_type_filter(
            col, "SPATIAL", FilterOperator.IN, ["POINT(0 0)", "POINT(1 1)"]
        )

        mock_adt_handler.translate_type.assert_called_once_with(
            {"type": "SPATIAL", "values": ["POINT(0 0)", "POINT(1 1)"]}
        )

        # Test error handling
        mock_adt_handler.translate_type.return_value = {
            "values": [],
            "error_message": "Invalid spatial data",
        }

        with pytest.raises(AdvancedDataTypeResponseError) as exc_info:
            table._apply_advanced_data_type_filter(
                col, "SPATIAL", FilterOperator.EQUALS, "INVALID"
            )

        assert "Invalid spatial data" in str(exc_info.value)
