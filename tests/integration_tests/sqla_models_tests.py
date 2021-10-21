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
# isort:skip_file
import re
from typing import Any, Dict, NamedTuple, List, Pattern, Tuple, Union
from unittest.mock import patch
import pytest

import sqlalchemy as sa

from superset import db
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from superset.db_engine_specs.druid import DruidEngineSpec
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.utils.core import (
    AdhocMetricExpressionType,
    FilterOperator,
    GenericDataType,
    get_example_database,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)

from .base_tests import SupersetTestCase


VIRTUAL_TABLE_INT_TYPES: Dict[str, Pattern[str]] = {
    "hive": re.compile(r"^INT_TYPE$"),
    "mysql": re.compile("^LONGLONG$"),
    "postgresql": re.compile(r"^INT$"),
    "presto": re.compile(r"^INTEGER$"),
    "sqlite": re.compile(r"^INT$"),
}

VIRTUAL_TABLE_STRING_TYPES: Dict[str, Pattern[str]] = {
    "hive": re.compile(r"^STRING_TYPE$"),
    "mysql": re.compile(r"^VAR_STRING$"),
    "postgresql": re.compile(r"^STRING$"),
    "presto": re.compile(r"^VARCHAR*"),
    "sqlite": re.compile(r"^STRING$"),
}


class TestDatabaseModel(SupersetTestCase):
    def test_is_time_druid_time_col(self):
        """Druid has a special __time column"""

        database = Database(database_name="druid_db", sqlalchemy_uri="druid://db")
        tbl = SqlaTable(table_name="druid_tbl", database=database)
        col = TableColumn(column_name="__time", type="INTEGER", table=tbl)
        self.assertEqual(col.is_dttm, None)
        DruidEngineSpec.alter_new_orm_column(col)
        self.assertEqual(col.is_dttm, True)

        col = TableColumn(column_name="__not_time", type="INTEGER", table=tbl)
        self.assertEqual(col.is_temporal, False)

    def test_temporal_varchar(self):
        """Ensure a column with is_dttm set to true evaluates to is_temporal == True"""

        database = get_example_database()
        tbl = SqlaTable(table_name="test_tbl", database=database)
        col = TableColumn(column_name="ds", type="VARCHAR", table=tbl)
        # by default, VARCHAR should not be assumed to be temporal
        assert col.is_temporal is False
        # changing to `is_dttm = True`, calling `is_temporal` should return True
        col.is_dttm = True
        assert col.is_temporal is True

    def test_db_column_types(self):
        test_cases: Dict[str, GenericDataType] = {
            # string
            "CHAR": GenericDataType.STRING,
            "VARCHAR": GenericDataType.STRING,
            "NVARCHAR": GenericDataType.STRING,
            "STRING": GenericDataType.STRING,
            "TEXT": GenericDataType.STRING,
            "NTEXT": GenericDataType.STRING,
            # numeric
            "INTEGER": GenericDataType.NUMERIC,
            "BIGINT": GenericDataType.NUMERIC,
            "DECIMAL": GenericDataType.NUMERIC,
            # temporal
            "DATE": GenericDataType.TEMPORAL,
            "DATETIME": GenericDataType.TEMPORAL,
            "TIME": GenericDataType.TEMPORAL,
            "TIMESTAMP": GenericDataType.TEMPORAL,
        }

        tbl = SqlaTable(table_name="col_type_test_tbl", database=get_example_database())
        for str_type, db_col_type in test_cases.items():
            col = TableColumn(column_name="foo", type=str_type, table=tbl)
            self.assertEqual(col.is_temporal, db_col_type == GenericDataType.TEMPORAL)
            self.assertEqual(col.is_numeric, db_col_type == GenericDataType.NUMERIC)
            self.assertEqual(col.is_string, db_col_type == GenericDataType.STRING)

        for str_type, db_col_type in test_cases.items():
            col = TableColumn(column_name="foo", type=str_type, table=tbl, is_dttm=True)
            self.assertTrue(col.is_temporal)

    @patch("superset.jinja_context.g")
    def test_extra_cache_keys(self, flask_g):
        flask_g.user.username = "abc"
        base_query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
        }

        # Table with Jinja callable.
        table1 = SqlaTable(
            table_name="test_has_extra_cache_keys_table",
            sql="SELECT '{{ current_username() }}' as user",
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={})
        extra_cache_keys = table1.get_extra_cache_keys(query_obj)
        self.assertTrue(table1.has_extra_cache_key_calls(query_obj))
        assert extra_cache_keys == ["abc"]

        # Table with Jinja callable disabled.
        table2 = SqlaTable(
            table_name="test_has_extra_cache_keys_disabled_table",
            sql="SELECT '{{ current_username(False) }}' as user",
            database=get_example_database(),
        )
        query_obj = dict(**base_query_obj, extras={})
        extra_cache_keys = table2.get_extra_cache_keys(query_obj)
        self.assertTrue(table2.has_extra_cache_key_calls(query_obj))
        self.assertListEqual(extra_cache_keys, [])

        # Table with no Jinja callable.
        query = "SELECT 'abc' as user"
        table3 = SqlaTable(
            table_name="test_has_no_extra_cache_keys_table",
            sql=query,
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={"where": "(user != 'abc')"})
        extra_cache_keys = table3.get_extra_cache_keys(query_obj)
        self.assertFalse(table3.has_extra_cache_key_calls(query_obj))
        self.assertListEqual(extra_cache_keys, [])

        # With Jinja callable in SQL expression.
        query_obj = dict(
            **base_query_obj, extras={"where": "(user != '{{ current_username() }}')"}
        )
        extra_cache_keys = table3.get_extra_cache_keys(query_obj)
        self.assertTrue(table3.has_extra_cache_key_calls(query_obj))
        assert extra_cache_keys == ["abc"]

        # Cleanup
        for table in [table1, table2, table3]:
            db.session.delete(table)
        db.session.commit()

    @patch("superset.jinja_context.g")
    def test_jinja_metrics_and_calc_columns(self, flask_g):
        flask_g.user.username = "abc"
        base_query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user", "expr"],
            "metrics": [
                {
                    "expressionType": AdhocMetricExpressionType.SQL,
                    "sqlExpression": "SUM(case when user = '{{ current_username() }}' "
                    "then 1 else 0 end)",
                    "label": "SUM(userid)",
                }
            ],
            "is_timeseries": False,
            "filter": [],
        }

        table = SqlaTable(
            table_name="test_has_jinja_metric_and_expr",
            sql="SELECT '{{ current_username() }}' as user",
            database=get_example_database(),
        )
        TableColumn(
            column_name="expr",
            expression="case when '{{ current_username() }}' = 'abc' "
            "then 'yes' else 'no' end",
            type="VARCHAR(100)",
            table=table,
        )
        db.session.commit()

        sqla_query = table.get_sqla_query(**base_query_obj)
        query = table.database.compile_sqla_query(sqla_query.sqla_query)
        # assert expression
        assert "case when 'abc' = 'abc' then 'yes' else 'no' end" in query
        # assert metric
        assert "SUM(case when user = 'abc' then 1 else 0 end)" in query
        # Cleanup
        db.session.delete(table)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_where_operators(self):
        class FilterTestCase(NamedTuple):
            operator: str
            value: Union[float, int, List[Any], str]
            expected: Union[str, List[str]]

        filters: Tuple[FilterTestCase, ...] = (
            FilterTestCase(FilterOperator.IS_NULL, "", "IS NULL"),
            FilterTestCase(FilterOperator.IS_NOT_NULL, "", "IS NOT NULL"),
            # Some db backends translate true/false to 1/0
            FilterTestCase(FilterOperator.IS_TRUE, "", ["IS 1", "IS true"]),
            FilterTestCase(FilterOperator.IS_FALSE, "", ["IS 0", "IS false"]),
            FilterTestCase(FilterOperator.GREATER_THAN, 0, "> 0"),
            FilterTestCase(FilterOperator.GREATER_THAN_OR_EQUALS, 0, ">= 0"),
            FilterTestCase(FilterOperator.LESS_THAN, 0, "< 0"),
            FilterTestCase(FilterOperator.LESS_THAN_OR_EQUALS, 0, "<= 0"),
            FilterTestCase(FilterOperator.EQUALS, 0, "= 0"),
            FilterTestCase(FilterOperator.NOT_EQUALS, 0, "!= 0"),
            FilterTestCase(FilterOperator.IN, ["1", "2"], "IN (1, 2)"),
            FilterTestCase(FilterOperator.NOT_IN, ["1", "2"], "NOT IN (1, 2)"),
        )
        table = self.get_table(name="birth_names")
        for filter_ in filters:
            query_obj = {
                "granularity": None,
                "from_dttm": None,
                "to_dttm": None,
                "groupby": ["gender"],
                "metrics": ["count"],
                "is_timeseries": False,
                "filter": [
                    {"col": "num", "op": filter_.operator, "val": filter_.value}
                ],
                "extras": {},
            }
            sqla_query = table.get_sqla_query(**query_obj)
            sql = table.database.compile_sqla_query(sqla_query.sqla_query)
            if isinstance(filter_.expected, list):
                self.assertTrue(
                    any([candidate in sql for candidate in filter_.expected])
                )
            else:
                self.assertIn(filter_.expected, sql)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_boolean_type_where_operators(self):
        table = self.get_table(name="birth_names")
        db.session.add(
            TableColumn(
                column_name="boolean_gender",
                expression="case when gender = 'boy' then True else False end",
                type="BOOLEAN",
                table=table,
            )
        )
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["boolean_gender"],
            "metrics": ["count"],
            "is_timeseries": False,
            "filter": [
                {
                    "col": "boolean_gender",
                    "op": FilterOperator.IN,
                    "val": ["true", "false"],
                }
            ],
            "extras": {},
        }
        sqla_query = table.get_sqla_query(**query_obj)
        sql = table.database.compile_sqla_query(sqla_query.sqla_query)
        dialect = table.database.get_dialect()
        operand = "(true, false)"
        # override native_boolean=False behavior in MySQLCompiler
        # https://github.com/sqlalchemy/sqlalchemy/blob/master/lib/sqlalchemy/dialects/mysql/base.py
        if not dialect.supports_native_boolean and dialect.name != "mysql":
            operand = "(1, 0)"
        self.assertIn(f"IN {operand}", sql)

    def test_incorrect_jinja_syntax_raises_correct_exception(self):
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
            "extras": {},
        }

        # Table with Jinja callable.
        table = SqlaTable(
            table_name="test_table",
            sql="SELECT '{{ abcd xyz + 1 ASDF }}' as user",
            database=get_example_database(),
        )
        # TODO(villebro): make it work with presto
        if get_example_database().backend != "presto":
            with pytest.raises(QueryObjectValidationError):
                table.get_sqla_query(**query_obj)

    def test_query_format_strip_trailing_semicolon(self):
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
            "extras": {},
        }

        # Table with Jinja callable.
        table = SqlaTable(
            table_name="test_table",
            sql="SELECT * from test_table;",
            database=get_example_database(),
        )
        sqlaq = table.get_sqla_query(**query_obj)
        sql = table.database.compile_sqla_query(sqlaq.sqla_query)
        assert sql[-1] != ";"

    def test_multiple_sql_statements_raises_exception(self):
        base_query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["grp"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
        }

        table = SqlaTable(
            table_name="test_has_extra_cache_keys_table",
            sql="SELECT 'foo' as grp, 1 as num; SELECT 'bar' as grp, 2 as num",
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={})
        with pytest.raises(QueryObjectValidationError):
            table.get_sqla_query(**query_obj)

    def test_dml_statement_raises_exception(self):
        base_query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["grp"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
        }

        table = SqlaTable(
            table_name="test_has_extra_cache_keys_table",
            sql="DELETE FROM foo",
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={})
        with pytest.raises(QueryObjectValidationError):
            table.get_sqla_query(**query_obj)

    def test_fetch_metadata_for_updated_virtual_table(self):
        table = SqlaTable(
            table_name="updated_sql_table",
            database=get_example_database(),
            sql="select 123 as intcol, 'abc' as strcol, 'abc' as mycase",
        )
        TableColumn(column_name="intcol", type="FLOAT", table=table)
        TableColumn(column_name="oldcol", type="INT", table=table)
        TableColumn(
            column_name="expr",
            expression="case when 1 then 1 else 0 end",
            type="INT",
            table=table,
        )
        TableColumn(
            column_name="mycase",
            expression="case when 1 then 1 else 0 end",
            type="INT",
            table=table,
        )

        # make sure the columns have been mapped properly
        assert len(table.columns) == 4
        table.fetch_metadata()
        # assert that the removed column has been dropped and
        # the physical and calculated columns are present
        assert {col.column_name for col in table.columns} == {
            "intcol",
            "strcol",
            "mycase",
            "expr",
        }
        cols: Dict[str, TableColumn] = {col.column_name: col for col in table.columns}
        # assert that the type for intcol has been updated (asserting CI types)
        backend = get_example_database().backend
        assert VIRTUAL_TABLE_INT_TYPES[backend].match(cols["intcol"].type)
        # assert that the expression has been replaced with the new physical column
        assert cols["mycase"].expression == ""
        assert VIRTUAL_TABLE_STRING_TYPES[backend].match(cols["mycase"].type)
        assert cols["expr"].expression == "case when 1 then 1 else 0 end"

    @patch("superset.models.core.Database.db_engine_spec", BigQueryEngineSpec)
    def test_labels_expected_on_mutated_query(self):
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "user"},
                    "aggregate": "COUNT_DISTINCT",
                    "label": "COUNT_DISTINCT(user)",
                }
            ],
            "is_timeseries": False,
            "filter": [],
            "extras": {},
        }

        database = Database(database_name="testdb", sqlalchemy_uri="sqlite://")
        table = SqlaTable(table_name="bq_table", database=database)
        db.session.add(database)
        db.session.add(table)
        db.session.commit()
        sqlaq = table.get_sqla_query(**query_obj)
        assert sqlaq.labels_expected == ["user", "COUNT_DISTINCT(user)"]
        sql = table.database.compile_sqla_query(sqlaq.sqla_query)
        assert "COUNT_DISTINCT_user__00db1" in sql
        db.session.delete(table)
        db.session.delete(database)
        db.session.commit()

    def test_values_for_column(self):
        table = SqlaTable(
            table_name="test_null_in_column",
            sql="SELECT 'foo' as foo UNION SELECT 'bar' UNION SELECT NULL",
            database=get_example_database(),
        )
        TableColumn(column_name="foo", type="VARCHAR(255)", table=table)

        with_null = table.values_for_column(
            column_name="foo", limit=10000, contain_null=True
        )
        assert None in with_null
        assert len(with_null) == 3

        without_null = table.values_for_column(
            column_name="foo", limit=10000, contain_null=False
        )
        assert None not in without_null
        assert len(without_null) == 2
