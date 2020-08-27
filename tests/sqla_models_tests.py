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
from typing import Any, Dict, NamedTuple, List, Tuple, Union
from unittest.mock import patch
import pytest

import tests.test_app
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.db_engine_specs.druid import DruidEngineSpec
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.utils.core import DbColumnType, get_example_database, FilterOperator

from .base_tests import SupersetTestCase


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

    def test_db_column_types(self):
        test_cases: Dict[str, DbColumnType] = {
            # string
            "CHAR": DbColumnType.STRING,
            "VARCHAR": DbColumnType.STRING,
            "NVARCHAR": DbColumnType.STRING,
            "STRING": DbColumnType.STRING,
            "TEXT": DbColumnType.STRING,
            "NTEXT": DbColumnType.STRING,
            # numeric
            "INT": DbColumnType.NUMERIC,
            "BIGINT": DbColumnType.NUMERIC,
            "FLOAT": DbColumnType.NUMERIC,
            "DECIMAL": DbColumnType.NUMERIC,
            "MONEY": DbColumnType.NUMERIC,
            # temporal
            "DATE": DbColumnType.TEMPORAL,
            "DATETIME": DbColumnType.TEMPORAL,
            "TIME": DbColumnType.TEMPORAL,
            "TIMESTAMP": DbColumnType.TEMPORAL,
        }

        tbl = SqlaTable(table_name="col_type_test_tbl", database=get_example_database())
        for str_type, db_col_type in test_cases.items():
            col = TableColumn(column_name="foo", type=str_type, table=tbl)
            self.assertEqual(col.is_temporal, db_col_type == DbColumnType.TEMPORAL)
            self.assertEqual(col.is_numeric, db_col_type == DbColumnType.NUMERIC)
            self.assertEqual(col.is_string, db_col_type == DbColumnType.STRING)

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
        table = SqlaTable(
            table_name="test_has_extra_cache_keys_table",
            sql="SELECT '{{ current_username() }}' as user",
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={})
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertTrue(table.has_extra_cache_key_calls(query_obj))
        assert extra_cache_keys == ["abc"]

        # Table with Jinja callable disabled.
        table = SqlaTable(
            table_name="test_has_extra_cache_keys_disabled_table",
            sql="SELECT '{{ current_username(False) }}' as user",
            database=get_example_database(),
        )
        query_obj = dict(**base_query_obj, extras={})
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertTrue(table.has_extra_cache_key_calls(query_obj))
        self.assertListEqual(extra_cache_keys, [])

        # Table with no Jinja callable.
        query = "SELECT 'abc' as user"
        table = SqlaTable(
            table_name="test_has_no_extra_cache_keys_table",
            sql=query,
            database=get_example_database(),
        )

        query_obj = dict(**base_query_obj, extras={"where": "(user != 'abc')"})
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertFalse(table.has_extra_cache_key_calls(query_obj))
        self.assertListEqual(extra_cache_keys, [])

        # With Jinja callable in SQL expression.
        query_obj = dict(
            **base_query_obj, extras={"where": "(user != '{{ current_username() }}')"}
        )
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertTrue(table.has_extra_cache_key_calls(query_obj))
        assert extra_cache_keys == ["abc"]

    def test_where_operators(self):
        class FilterTestCase(NamedTuple):
            operator: str
            value: Union[float, int, List[Any], str]
            expected: str

        filters: Tuple[FilterTestCase, ...] = (
            FilterTestCase(FilterOperator.IS_NULL, "", "IS NULL"),
            FilterTestCase(FilterOperator.IS_NOT_NULL, "", "IS NOT NULL"),
            FilterTestCase(FilterOperator.GREATER_THAN, 0, "> 0"),
            FilterTestCase(FilterOperator.GREATER_THAN_OR_EQUALS, 0, ">= 0"),
            FilterTestCase(FilterOperator.LESS_THAN, 0, "< 0"),
            FilterTestCase(FilterOperator.LESS_THAN_OR_EQUALS, 0, "<= 0"),
            FilterTestCase(FilterOperator.EQUALS, 0, "= 0"),
            FilterTestCase(FilterOperator.NOT_EQUALS, 0, "!= 0"),
            FilterTestCase(FilterOperator.IN, ["1", "2"], "IN (1, 2)"),
            FilterTestCase(FilterOperator.NOT_IN, ["1", "2"], "NOT IN (1, 2)"),
        )
        table = self.get_table_by_name("birth_names")
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
            self.assertIn(filter_.expected, sql)

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
