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
from typing import Dict

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.db_engine_specs.druid import DruidEngineSpec
from superset.models.core import Database
from superset.utils.core import DbColumnType, get_example_database

from .base_tests import SupersetTestCase


class DatabaseModelTestCase(SupersetTestCase):
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

    def test_has_extra_cache_keys(self):
        query = "SELECT '{{ cache_key_wrapper('user_1') }}' as user"
        table = SqlaTable(
            table_name="test_has_extra_cache_keys_table",
            sql=query,
            database=get_example_database(),
        )
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
            "extras": {"where": "(user != '{{ cache_key_wrapper('user_2') }}')"},
        }
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertTrue(table.has_calls_to_cache_key_wrapper(query_obj))
        self.assertListEqual(extra_cache_keys, ["user_1", "user_2"])

    def test_has_no_extra_cache_keys(self):
        query = "SELECT 'abc' as user"
        table = SqlaTable(
            table_name="test_has_no_extra_cache_keys_table",
            sql=query,
            database=get_example_database(),
        )
        query_obj = {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "groupby": ["user"],
            "metrics": [],
            "is_timeseries": False,
            "filter": [],
            "extras": {"where": "(user != 'abc')"},
        }
        extra_cache_keys = table.get_extra_cache_keys(query_obj)
        self.assertFalse(table.has_calls_to_cache_key_wrapper(query_obj))
        self.assertListEqual(extra_cache_keys, [])
