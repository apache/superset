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
import datetime
from unittest import mock

import pytest

from superset.db_engine_specs import engines
from superset.db_engine_specs.base import BaseEngineSpec, builtin_time_grains
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.sql_parse import ParsedQuery
from superset.utils.core import get_example_database
from tests.db_engine_specs.base_tests import TestDbEngineSpec
from tests.test_app import app

from ..fixtures.energy_dashboard import load_energy_table_with_slice
from ..fixtures.pyodbcRow import Row


class TestDbEngineSpecs(TestDbEngineSpec):
    def test_extract_limit_from_query(self, engine_spec_class=BaseEngineSpec):
        q0 = "select * from table"
        q1 = "select * from mytable limit 10"
        q2 = "select * from (select * from my_subquery limit 10) where col=1 limit 20"
        q3 = "select * from (select * from my_subquery limit 10);"
        q4 = "select * from (select * from my_subquery limit 10) where col=1 limit 20;"
        q5 = "select * from mytable limit 20, 10"
        q6 = "select * from mytable limit 10 offset 20"
        q7 = "select * from mytable limit"
        q8 = "select * from mytable limit 10.0"
        q9 = "select * from mytable limit x"
        q10 = "select * from mytable limit 20, x"
        q11 = "select * from mytable limit x offset 20"

        self.assertEqual(engine_spec_class.get_limit_from_sql(q0), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q1), 10)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q2), 20)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q3), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q4), 20)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q5), 10)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q6), 10)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q7), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q8), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q9), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q10), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q11), None)

    def test_wrapped_semi_tabs(self):
        self.sql_limit_regex(
            "SELECT * FROM a  \t \n   ; \t  \n  ", "SELECT * FROM a\nLIMIT 1000"
        )

    def test_simple_limit_query(self):
        self.sql_limit_regex("SELECT * FROM a", "SELECT * FROM a\nLIMIT 1000")

    def test_modify_limit_query(self):
        self.sql_limit_regex("SELECT * FROM a LIMIT 9999", "SELECT * FROM a LIMIT 1000")

    def test_limit_query_with_limit_subquery(self):  # pylint: disable=invalid-name
        self.sql_limit_regex(
            "SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 9999",
            "SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 1000",
        )

    def test_limit_with_expr(self):
        self.sql_limit_regex(
            """
            SELECT
                'LIMIT 777' AS a
                , b
            FROM
            table
            LIMIT 99990""",
            """SELECT
                'LIMIT 777' AS a
                , b
            FROM
            table
            LIMIT 1000""",
        )

    def test_limit_expr_and_semicolon(self):
        self.sql_limit_regex(
            """
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT         99990            ;""",
            """SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT         1000""",
        )

    def test_get_datatype(self):
        self.assertEqual("VARCHAR", BaseEngineSpec.get_datatype("VARCHAR"))

    def test_limit_with_implicit_offset(self):
        self.sql_limit_regex(
            """
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT 99990, 999999""",
            """SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT 99990, 1000""",
        )

    def test_limit_with_explicit_offset(self):
        self.sql_limit_regex(
            """
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT 99990
                OFFSET 999999""",
            """SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT 1000
                OFFSET 999999""",
        )

    def test_limit_with_non_token_limit(self):
        self.sql_limit_regex(
            """SELECT 'LIMIT 777'""", """SELECT 'LIMIT 777'\nLIMIT 1000"""
        )

    def test_time_grain_denylist(self):
        with app.app_context():
            app.config["TIME_GRAIN_DENYLIST"] = ["PT1M"]
            time_grain_functions = SqliteEngineSpec.get_time_grain_expressions()
            self.assertNotIn("PT1M", time_grain_functions)

    def test_time_grain_addons(self):
        with app.app_context():
            app.config["TIME_GRAIN_ADDONS"] = {"PTXM": "x seconds"}
            app.config["TIME_GRAIN_ADDON_EXPRESSIONS"] = {
                "sqlite": {"PTXM": "ABC({col})"}
            }
            time_grains = SqliteEngineSpec.get_time_grains()
            time_grain_addon = time_grains[-1]
            self.assertEqual("PTXM", time_grain_addon.duration)
            self.assertEqual("x seconds", time_grain_addon.label)

    def test_engine_time_grain_validity(self):
        time_grains = set(builtin_time_grains.keys())
        # loop over all subclasses of BaseEngineSpec
        for engine in engines.values():
            if engine is not BaseEngineSpec:
                # make sure time grain functions have been defined
                self.assertGreater(len(engine.get_time_grain_expressions()), 0)
                # make sure all defined time grains are supported
                defined_grains = {grain.duration for grain in engine.get_time_grains()}
                intersection = time_grains.intersection(defined_grains)
                self.assertSetEqual(defined_grains, intersection, engine)

    def test_get_table_names(self):
        inspector = mock.Mock()
        inspector.get_table_names = mock.Mock(return_value=["schema.table", "table_2"])
        inspector.get_foreign_table_names = mock.Mock(return_value=["table_3"])

        """ Make sure base engine spec removes schema name from table name
        ie. when try_remove_schema_from_table_name == True. """
        base_result_expected = ["table", "table_2"]
        base_result = BaseEngineSpec.get_table_names(
            database=mock.ANY, schema="schema", inspector=inspector
        )
        self.assertListEqual(base_result_expected, base_result)

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_column_datatype_to_string(self):
        example_db = get_example_database()
        sqla_table = example_db.get_table("energy_usage")
        dialect = example_db.get_dialect()

        # TODO: fix column type conversion for presto.
        if example_db.backend == "presto":
            return

        col_names = [
            example_db.db_engine_spec.column_datatype_to_string(c.type, dialect)
            for c in sqla_table.columns
        ]
        if example_db.backend == "postgresql":
            expected = ["VARCHAR(255)", "VARCHAR(255)", "DOUBLE PRECISION"]
        elif example_db.backend == "hive":
            expected = ["STRING", "STRING", "FLOAT"]
        else:
            expected = ["VARCHAR(255)", "VARCHAR(255)", "FLOAT"]
        self.assertEqual(col_names, expected)

    def test_convert_dttm(self):
        dttm = self.get_dttm()
        self.assertIsNone(BaseEngineSpec.convert_dttm("", dttm))

    def test_pyodbc_rows_to_tuples(self):
        # Test for case when pyodbc.Row is returned (odbc driver)
        data = [
            Row((1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000))),
            Row((2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000))),
        ]
        expected = [
            (1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000)),
            (2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000)),
        ]
        result = BaseEngineSpec.pyodbc_rows_to_tuples(data)
        self.assertListEqual(result, expected)

    def test_pyodbc_rows_to_tuples_passthrough(self):
        # Test for case when tuples are returned
        data = [
            (1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000)),
            (2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000)),
        ]
        result = BaseEngineSpec.pyodbc_rows_to_tuples(data)
        self.assertListEqual(result, data)


def test_is_readonly():
    def is_readonly(sql: str) -> bool:
        return BaseEngineSpec.is_readonly_query(ParsedQuery(sql))

    assert not is_readonly("SHOW LOCKS test EXTENDED")
    assert not is_readonly("SET hivevar:desc='Legislators'")
    assert not is_readonly("UPDATE t1 SET col1 = NULL")
    assert is_readonly("EXPLAIN SELECT 1")
    assert is_readonly("SELECT 1")
    assert is_readonly("WITH (SELECT 1) bla SELECT * from bla")
