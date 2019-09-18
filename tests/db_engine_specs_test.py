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
import unittest
from unittest import mock

import pandas as pd
from sqlalchemy import column, literal_column, table
from sqlalchemy.dialects import mssql, oracle, postgresql
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.sql import select
from sqlalchemy.types import String, UnicodeText

from superset import app
from superset.db_engine_specs import engines
from superset.db_engine_specs.base import BaseEngineSpec, builtin_time_grains
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.oracle import OracleEngineSpec
from superset.db_engine_specs.pinot import PinotEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.models.core import Database
from superset.utils.core import get_example_database
from .base_tests import SupersetTestCase


class DbEngineSpecsTestCase(SupersetTestCase):
    def test_0_progress(self):
        log = """
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=compile from=org.apache.hadoop.hive.ql.Driver>
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=parse from=org.apache.hadoop.hive.ql.Driver>
        """.split(
            "\n"
        )
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_number_of_jobs_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        """.split(
            "\n"
        )
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        """.split(
            "\n"
        )
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_0_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_40_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEquals(10, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_80_reduce_40_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 80%,  reduce = 40%
        """.split(
            "\n"
        )
        self.assertEquals(30, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_2_stages_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 80%,  reduce = 40%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-2 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 100%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEquals(12, HiveEngineSpec.progress(log))

    def test_job_2_launched_stage_2_stages_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 100%,  reduce = 0%
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 2 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEquals(60, HiveEngineSpec.progress(log))

    def test_hive_error_msg(self):
        msg = (
            '{...} errorMessage="Error while compiling statement: FAILED: '
            "SemanticException [Error 10001]: Line 4"
            ":5 Table not found 'fact_ridesfdslakj'\", statusCode=3, "
            "sqlState='42S02', errorCode=10001)){...}"
        )
        self.assertEquals(
            (
                "hive error: Error while compiling statement: FAILED: "
                "SemanticException [Error 10001]: Line 4:5 "
                "Table not found 'fact_ridesfdslakj'"
            ),
            HiveEngineSpec.extract_error_message(Exception(msg)),
        )

        e = Exception("Some string that doesn't match the regex")
        self.assertEquals(f"hive error: {e}", HiveEngineSpec.extract_error_message(e))

        msg = (
            "errorCode=10001, "
            'errorMessage="Error while compiling statement"), operationHandle'
            '=None)"'
        )
        self.assertEquals(
            ("hive error: Error while compiling statement"),
            HiveEngineSpec.extract_error_message(Exception(msg)),
        )

    def get_generic_database(self):
        return Database(sqlalchemy_uri="sqlite://")

    def sql_limit_regex(
        self, sql, expected_sql, engine_spec_class=MySQLEngineSpec, limit=1000
    ):
        main = self.get_generic_database()
        limited = engine_spec_class.apply_limit_to_sql(sql, limit, main)
        self.assertEquals(expected_sql, limited)

    def test_extract_limit_from_query(self, engine_spec_class=MySQLEngineSpec):
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

    def test_wrapped_query(self):
        self.sql_limit_regex(
            "SELECT * FROM a",
            "SELECT * \nFROM (SELECT * FROM a) AS inner_qry\n LIMIT 1000 OFFSET 0",
            MssqlEngineSpec,
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_wrapped_semi_tabs(self):
        self.sql_limit_regex(
            "SELECT * FROM a  \t \n   ; \t  \n  ", "SELECT * FROM a\nLIMIT 1000"
        )

    def test_simple_limit_query(self):
        self.sql_limit_regex("SELECT * FROM a", "SELECT * FROM a\nLIMIT 1000")

    def test_modify_limit_query(self):
        self.sql_limit_regex("SELECT * FROM a LIMIT 9999", "SELECT * FROM a LIMIT 1000")

    def test_limit_query_with_limit_subquery(self):
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

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_get_datatype_mysql(self):
        self.assertEquals("TINY", MySQLEngineSpec.get_datatype(1))
        self.assertEquals("VARCHAR", MySQLEngineSpec.get_datatype(15))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pyhive"), "pyhive not installed"
    )
    def test_get_datatype_presto(self):
        self.assertEquals("STRING", PrestoEngineSpec.get_datatype("string"))

    def test_get_datatype(self):
        self.assertEquals("VARCHAR", BaseEngineSpec.get_datatype("VARCHAR"))

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

    def test_time_grain_blacklist(self):
        with app.app_context():
            app.config["TIME_GRAIN_BLACKLIST"] = ["PT1M"]
            time_grain_functions = SqliteEngineSpec.get_time_grain_functions()
            self.assertNotIn("PT1M", time_grain_functions)

    def test_time_grain_addons(self):
        with app.app_context():
            app.config["TIME_GRAIN_ADDONS"] = {"PTXM": "x seconds"}
            app.config["TIME_GRAIN_ADDON_FUNCTIONS"] = {
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
                self.assertGreater(len(engine.get_time_grain_functions()), 0)
                # make sure all defined time grains are supported
                defined_grains = {grain.duration for grain in engine.get_time_grains()}
                intersection = time_grains.intersection(defined_grains)
                self.assertSetEqual(defined_grains, intersection, engine)

    def test_presto_get_view_names_return_empty_list(self):
        self.assertEquals(
            [], PrestoEngineSpec.get_view_names(mock.ANY, mock.ANY, mock.ANY)
        )

    def verify_presto_column(self, column, expected_results):
        inspector = mock.Mock()
        inspector.engine.dialect.identifier_preparer.quote_identifier = mock.Mock()
        keymap = {
            "Column": (None, None, 0),
            "Type": (None, None, 1),
            "Null": (None, None, 2),
        }
        row = RowProxy(mock.Mock(), column, [None, None, None, None], keymap)
        inspector.bind.execute = mock.Mock(return_value=[row])
        results = PrestoEngineSpec.get_columns(inspector, "", "")
        self.assertEqual(len(expected_results), len(results))
        for expected_result, result in zip(expected_results, results):
            self.assertEqual(expected_result[0], result["name"])
            self.assertEqual(expected_result[1], str(result["type"]))

    def test_presto_get_column(self):
        presto_column = ("column_name", "boolean", "")
        expected_results = [("column_name", "BOOLEAN")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_simple_row_column(self):
        presto_column = ("column_name", "row(nested_obj double)", "")
        expected_results = [("column_name", "ROW"), ("column_name.nested_obj", "FLOAT")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_simple_row_column_with_name_containing_whitespace(self):
        presto_column = ("column name", "row(nested_obj double)", "")
        expected_results = [("column name", "ROW"), ("column name.nested_obj", "FLOAT")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_simple_row_column_with_tricky_nested_field_name(self):
        presto_column = ("column_name", 'row("Field Name(Tricky, Name)" double)', "")
        expected_results = [
            ("column_name", "ROW"),
            ('column_name."Field Name(Tricky, Name)"', "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_simple_array_column(self):
        presto_column = ("column_name", "array(double)", "")
        expected_results = [("column_name", "ARRAY")]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_row_within_array_within_row_column(self):
        presto_column = (
            "column_name",
            "row(nested_array array(row(nested_row double)), nested_obj double)",
            "",
        )
        expected_results = [
            ("column_name", "ROW"),
            ("column_name.nested_array", "ARRAY"),
            ("column_name.nested_array.nested_row", "FLOAT"),
            ("column_name.nested_obj", "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_get_array_within_row_within_array_column(self):
        presto_column = (
            "column_name",
            "array(row(nested_array array(double), nested_obj double))",
            "",
        )
        expected_results = [
            ("column_name", "ARRAY"),
            ("column_name.nested_array", "ARRAY"),
            ("column_name.nested_obj", "FLOAT"),
        ]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_fields(self):
        cols = [
            {"name": "column"},
            {"name": "column.nested_obj"},
            {"name": 'column."quoted.nested obj"'},
        ]
        actual_results = PrestoEngineSpec._get_fields(cols)
        expected_results = [
            {"name": '"column"', "label": "column"},
            {"name": '"column"."nested_obj"', "label": "column.nested_obj"},
            {
                "name": '"column"."quoted.nested obj"',
                "label": 'column."quoted.nested obj"',
            },
        ]
        for actual_result, expected_result in zip(actual_results, expected_results):
            self.assertEqual(actual_result.element.name, expected_result["name"])
            self.assertEqual(actual_result.name, expected_result["label"])

    def test_presto_filter_out_array_nested_cols(self):
        cols = [
            {"name": "column", "type": "ARRAY"},
            {"name": "column.nested_obj", "type": "FLOAT"},
        ]
        actual_filtered_cols, actual_array_cols = PrestoEngineSpec._filter_out_array_nested_cols(  # noqa ignore: E50
            cols
        )
        expected_filtered_cols = [{"name": "column", "type": "ARRAY"}]
        self.assertEqual(actual_filtered_cols, expected_filtered_cols)
        self.assertEqual(actual_array_cols, cols)

    def test_presto_create_row_and_array_hierarchy(self):
        cols = [
            {
                "name": "row_column",
                "type": "ROW(NESTED_OBJ1 VARCHAR, NESTED_ROW ROW(NESTED_OBJ2 VARCHAR)",
            },
            {
                "name": "array_column",
                "type": "ARRAY(ROW(NESTED_ARRAY ARRAY(ROW(NESTED_OBJ VARCHAR))))",
            },
        ]
        actual_row_col_hierarchy, actual_array_col_hierarchy, actual_expanded_cols = PrestoEngineSpec._create_row_and_array_hierarchy(  # noqa ignore: E50
            cols
        )
        expected_row_col_hierarchy = {
            "row_column": {
                "type": "ROW",
                "children": ["row_column.nested_obj1", "row_column.nested_row"],
            },
            "row_column.nested_row": {
                "type": "ROW",
                "children": ["row_column.nested_row.nested_obj2"],
            },
        }
        expected_array_col_hierarchy = {
            "array_column": {
                "type": "ARRAY",
                "children": ["array_column.nested_array"],
            },
            "array_column.nested_array": {
                "type": "ARRAY",
                "children": ["array_column.nested_array.nested_obj"],
            },
        }
        expected_expanded_cols = [
            {"name": "row_column.nested_obj1", "type": "VARCHAR"},
            {"name": "row_column.nested_row", "type": "ROW"},
            {"name": "row_column.nested_row.nested_obj2", "type": "VARCHAR"},
            {"name": "array_column.nested_array", "type": "ARRAY"},
            {"name": "array_column.nested_array.nested_obj", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_row_col_hierarchy, expected_row_col_hierarchy)
        self.assertEqual(actual_array_col_hierarchy, expected_array_col_hierarchy)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    def test_presto_expand_row_data(self):
        datum = {"row_col": [1, "a"]}
        row_column = "row_col"
        row_col_hierarchy = {
            "row_col": {
                "type": "ROW",
                "children": ["row_col.nested_int", "row_col.nested_str"],
            }
        }
        PrestoEngineSpec._expand_row_data(datum, row_column, row_col_hierarchy)
        expected_datum = {
            "row_col": [1, "a"],
            "row_col.nested_int": 1,
            "row_col.nested_str": "a",
        }
        self.assertEqual(datum, expected_datum)

    def test_split_array_columns_by_process_state(self):
        array_cols = ["array_column", "array_column.nested_array"]
        array_col_hierarchy = {
            "array_column": {
                "type": "ARRAY",
                "children": ["array_column.nested_array"],
            },
            "array_column.nested_array": {
                "type": "ARRAY",
                "children": ["array_column.nested_array.nested_obj"],
            },
        }
        datum = {"array_column": [[[1], [2]]]}
        actual_array_cols_to_process, actual_unprocessed_array_cols = PrestoEngineSpec._split_array_columns_by_process_state(  # noqa ignore: E50
            array_cols, array_col_hierarchy, datum
        )
        expected_array_cols_to_process = ["array_column"]
        expected_unprocessed_array_cols = {"array_column.nested_array"}
        self.assertEqual(actual_array_cols_to_process, expected_array_cols_to_process)
        self.assertEqual(actual_unprocessed_array_cols, expected_unprocessed_array_cols)

    def test_presto_convert_data_list_to_array_data_dict(self):
        data = [
            {"array_column": [1, 2], "int_column": 3},
            {"array_column": [11, 22], "int_column": 33},
        ]
        array_columns_to_process = ["array_column"]
        actual_array_data_dict = PrestoEngineSpec._convert_data_list_to_array_data_dict(
            data, array_columns_to_process
        )
        expected_array_data_dict = {
            0: [{"array_column": [1, 2]}],
            1: [{"array_column": [11, 22]}],
        }
        self.assertEqual(actual_array_data_dict, expected_array_data_dict)

    def test_presto_process_array_data(self):
        data = [
            {"array_column": [[1], [2]], "int_column": 3},
            {"array_column": [[11], [22]], "int_column": 33},
        ]
        all_columns = [
            {"name": "array_column", "type": "ARRAY"},
            {"name": "array_column.nested_row", "type": "BIGINT"},
            {"name": "int_column", "type": "BIGINT"},
        ]
        array_column_hierarchy = {
            "array_column": {"type": "ARRAY", "children": ["array_column.nested_row"]}
        }
        actual_array_data = PrestoEngineSpec._process_array_data(
            data, all_columns, array_column_hierarchy
        )
        expected_array_data = {
            0: [
                {"array_column": [[1], [2]], "array_column.nested_row": 1},
                {"array_column": "", "array_column.nested_row": 2, "int_column": ""},
            ],
            1: [
                {"array_column": [[11], [22]], "array_column.nested_row": 11},
                {"array_column": "", "array_column.nested_row": 22, "int_column": ""},
            ],
        }
        self.assertEqual(actual_array_data, expected_array_data)

    def test_presto_consolidate_array_data_into_data(self):
        data = [
            {"arr_col": [[1], [2]], "int_col": 3},
            {"arr_col": [[11], [22]], "int_col": 33},
        ]
        array_data = {
            0: [
                {"arr_col": [[1], [2]], "arr_col.nested_row": 1},
                {"arr_col": "", "arr_col.nested_row": 2, "int_col": ""},
            ],
            1: [
                {"arr_col": [[11], [22]], "arr_col.nested_row": 11},
                {"arr_col": "", "arr_col.nested_row": 22, "int_col": ""},
            ],
        }
        PrestoEngineSpec._consolidate_array_data_into_data(data, array_data)
        expected_data = [
            {"arr_col": [[1], [2]], "arr_col.nested_row": 1, "int_col": 3},
            {"arr_col": "", "arr_col.nested_row": 2, "int_col": ""},
            {"arr_col": [[11], [22]], "arr_col.nested_row": 11, "int_col": 33},
            {"arr_col": "", "arr_col.nested_row": 22, "int_col": ""},
        ]
        self.assertEqual(data, expected_data)

    def test_presto_remove_processed_array_columns(self):
        array_col_hierarchy = {
            "array_column": {
                "type": "ARRAY",
                "children": ["array_column.nested_array"],
            },
            "array_column.nested_array": {
                "type": "ARRAY",
                "children": ["array_column.nested_array.nested_obj"],
            },
        }
        unprocessed_array_cols = {"array_column.nested_array"}
        PrestoEngineSpec._remove_processed_array_columns(
            unprocessed_array_cols, array_col_hierarchy
        )
        expected_array_col_hierarchy = {
            "array_column.nested_array": {
                "type": "ARRAY",
                "children": ["array_column.nested_array.nested_obj"],
            }
        }
        self.assertEqual(array_col_hierarchy, expected_array_col_hierarchy)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_expand_data_with_simple_structural_columns(self):
        cols = [
            {"name": "row_column", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "array_column", "type": "ARRAY(BIGINT)"},
        ]
        data = [
            {"row_column": ["a"], "array_column": [1, 2, 3]},
            {"row_column": ["b"], "array_column": [4, 5, 6]},
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "__row_id", "type": "BIGINT"},
            {"name": "row_column", "type": "ROW(NESTED_OBJ VARCHAR)"},
            {"name": "row_column.nested_obj", "type": "VARCHAR"},
            {"name": "array_column", "type": "ARRAY(BIGINT)"},
        ]

        expected_data = [
            {
                "__row_id": 0,
                "array_column": 1,
                "row_column": ["a"],
                "row_column.nested_obj": "a",
            },
            {
                "__row_id": "",
                "array_column": 2,
                "row_column": "",
                "row_column.nested_obj": "",
            },
            {
                "__row_id": "",
                "array_column": 3,
                "row_column": "",
                "row_column.nested_obj": "",
            },
            {
                "__row_id": 1,
                "array_column": 4,
                "row_column": ["b"],
                "row_column.nested_obj": "b",
            },
            {
                "__row_id": "",
                "array_column": 5,
                "row_column": "",
                "row_column.nested_obj": "",
            },
            {
                "__row_id": "",
                "array_column": 6,
                "row_column": "",
                "row_column.nested_obj": "",
            },
        ]

        expected_expanded_cols = [{"name": "row_column.nested_obj", "type": "VARCHAR"}]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_expand_data_with_complex_row_columns(self):
        cols = [
            {
                "name": "row_column",
                "type": "ROW(NESTED_OBJ1 VARCHAR, NESTED_ROW ROW(NESTED_OBJ2 VARCHAR))",
            }
        ]
        data = [{"row_column": ["a1", ["a2"]]}, {"row_column": ["b1", ["b2"]]}]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "__row_id", "type": "BIGINT"},
            {
                "name": "row_column",
                "type": "ROW(NESTED_OBJ1 VARCHAR, NESTED_ROW ROW(NESTED_OBJ2 VARCHAR))",
            },
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ2 VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj2", "type": "VARCHAR"},
            {"name": "row_column.nested_obj1", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "__row_id": 0,
                "row_column": ["a1", ["a2"]],
                "row_column.nested_obj1": "a1",
                "row_column.nested_row": ["a2"],
                "row_column.nested_row.nested_obj2": "a2",
            },
            {
                "__row_id": 1,
                "row_column": ["b1", ["b2"]],
                "row_column.nested_obj1": "b1",
                "row_column.nested_row": ["b2"],
                "row_column.nested_row.nested_obj2": "b2",
            },
        ]

        expected_expanded_cols = [
            {"name": "row_column.nested_obj1", "type": "VARCHAR"},
            {"name": "row_column.nested_row", "type": "ROW(NESTED_OBJ2 VARCHAR)"},
            {"name": "row_column.nested_row.nested_obj2", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    @mock.patch.dict(
        "superset._feature_flags", {"PRESTO_EXPAND_DATA": True}, clear=True
    )
    def test_presto_expand_data_with_complex_array_columns(self):
        cols = [
            {"name": "int_column", "type": "BIGINT"},
            {
                "name": "array_column",
                "type": "ARRAY(ROW(NESTED_ARRAY ARRAY(ROW(NESTED_OBJ VARCHAR))))",
            },
        ]
        data = [
            {"int_column": 1, "array_column": [[[["a"], ["b"]]], [[["c"], ["d"]]]]},
            {"int_column": 2, "array_column": [[[["e"], ["f"]]], [[["g"], ["h"]]]]},
        ]
        actual_cols, actual_data, actual_expanded_cols = PrestoEngineSpec.expand_data(
            cols, data
        )
        expected_cols = [
            {"name": "__row_id", "type": "BIGINT"},
            {"name": "int_column", "type": "BIGINT"},
            {
                "name": "array_column",
                "type": "ARRAY(ROW(NESTED_ARRAY ARRAY(ROW(NESTED_OBJ VARCHAR))))",
            },
            {
                "name": "array_column.nested_array",
                "type": "ARRAY(ROW(NESTED_OBJ VARCHAR))",
            },
            {"name": "array_column.nested_array.nested_obj", "type": "VARCHAR"},
        ]
        expected_data = [
            {
                "__row_id": 0,
                "array_column": [[["a"], ["b"]]],
                "array_column.nested_array": ["a"],
                "array_column.nested_array.nested_obj": "a",
                "int_column": 1,
            },
            {
                "__row_id": "",
                "array_column": "",
                "array_column.nested_array": ["b"],
                "array_column.nested_array.nested_obj": "b",
                "int_column": "",
            },
            {
                "__row_id": "",
                "array_column": [[["c"], ["d"]]],
                "array_column.nested_array": ["c"],
                "array_column.nested_array.nested_obj": "c",
                "int_column": "",
            },
            {
                "__row_id": "",
                "array_column": "",
                "array_column.nested_array": ["d"],
                "array_column.nested_array.nested_obj": "d",
                "int_column": "",
            },
            {
                "__row_id": 1,
                "array_column": [[["e"], ["f"]]],
                "array_column.nested_array": ["e"],
                "array_column.nested_array.nested_obj": "e",
                "int_column": 2,
            },
            {
                "__row_id": "",
                "array_column": "",
                "array_column.nested_array": ["f"],
                "array_column.nested_array.nested_obj": "f",
                "int_column": "",
            },
            {
                "__row_id": "",
                "array_column": [[["g"], ["h"]]],
                "array_column.nested_array": ["g"],
                "array_column.nested_array.nested_obj": "g",
                "int_column": "",
            },
            {
                "__row_id": "",
                "array_column": "",
                "array_column.nested_array": ["h"],
                "array_column.nested_array.nested_obj": "h",
                "int_column": "",
            },
        ]
        expected_expanded_cols = [
            {
                "name": "array_column.nested_array",
                "type": "ARRAY(ROW(NESTED_OBJ VARCHAR))",
            },
            {"name": "array_column.nested_array.nested_obj", "type": "VARCHAR"},
        ]
        self.assertEqual(actual_cols, expected_cols)
        self.assertEqual(actual_data, expected_data)
        self.assertEqual(actual_expanded_cols, expected_expanded_cols)

    def test_presto_extra_table_metadata(self):
        db = mock.Mock()
        db.get_indexes = mock.Mock(return_value=[{"column_names": ["ds", "hour"]}])
        db.get_extra = mock.Mock(return_value={})
        df = pd.DataFrame({"ds": ["01-01-19"], "hour": [1]})
        db.get_df = mock.Mock(return_value=df)
        PrestoEngineSpec.get_create_view = mock.Mock(return_value=None)
        result = PrestoEngineSpec.extra_table_metadata(db, "test_table", "test_schema")
        self.assertEqual({"ds": "01-01-19", "hour": 1}, result["partitions"]["latest"])

    def test_presto_where_latest_partition(self):
        db = mock.Mock()
        db.get_indexes = mock.Mock(return_value=[{"column_names": ["ds", "hour"]}])
        db.get_extra = mock.Mock(return_value={})
        df = pd.DataFrame({"ds": ["01-01-19"], "hour": [1]})
        db.get_df = mock.Mock(return_value=df)
        columns = [{"name": "ds"}, {"name": "hour"}]
        result = PrestoEngineSpec.where_latest_partition(
            "test_table", "test_schema", db, select(), columns
        )
        query_result = str(result.compile(compile_kwargs={"literal_binds": True}))
        self.assertEqual("SELECT  \nWHERE ds = '01-01-19' AND hour = 1", query_result)

    def test_hive_get_view_names_return_empty_list(self):
        self.assertEquals(
            [], HiveEngineSpec.get_view_names(mock.ANY, mock.ANY, mock.ANY)
        )

    def test_bigquery_sqla_column_label(self):
        label = BigQueryEngineSpec.make_label_compatible(column("Col").name)
        label_expected = "Col"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("SUM(x)").name)
        label_expected = "SUM_x__5f110"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("SUM[x]").name)
        label_expected = "SUM_x__7ebe1"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("12345_col").name)
        label_expected = "_12345_col_8d390"
        self.assertEqual(label, label_expected)

    def test_oracle_sqla_column_name_length_exceeded(self):
        col = column("This_Is_32_Character_Column_Name")
        label = OracleEngineSpec.make_label_compatible(col.name)
        self.assertEqual(label.quote, True)
        label_expected = "3b26974078683be078219674eeb8f5"
        self.assertEqual(label, label_expected)

    def test_mssql_column_types(self):
        def assert_type(type_string, type_expected):
            type_assigned = MssqlEngineSpec.get_sqla_column_type(type_string)
            if type_expected is None:
                self.assertIsNone(type_assigned)
            else:
                self.assertIsInstance(type_assigned, type_expected)

        assert_type("INT", None)
        assert_type("STRING", String)
        assert_type("CHAR(10)", String)
        assert_type("VARCHAR(10)", String)
        assert_type("TEXT", String)
        assert_type("NCHAR(10)", UnicodeText)
        assert_type("NVARCHAR(10)", UnicodeText)
        assert_type("NTEXT", UnicodeText)

    def test_mssql_where_clause_n_prefix(self):
        dialect = mssql.dialect()
        spec = MssqlEngineSpec
        str_col = column("col", type_=spec.get_sqla_column_type("VARCHAR(10)"))
        unicode_col = column("unicode_col", type_=spec.get_sqla_column_type("NTEXT"))
        tbl = table("tbl")
        sel = (
            select([str_col, unicode_col])
            .select_from(tbl)
            .where(str_col == "abc")
            .where(unicode_col == "abc")
        )

        query = str(
            sel.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
        )
        query_expected = (
            "SELECT col, unicode_col \n"
            "FROM tbl \n"
            "WHERE col = 'abc' AND unicode_col = N'abc'"
        )
        self.assertEqual(query, query_expected)

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

        """ Make sure postgres doesn't try to remove schema name from table name
        ie. when try_remove_schema_from_table_name == False. """
        pg_result_expected = ["schema.table", "table_2", "table_3"]
        pg_result = PostgresEngineSpec.get_table_names(
            database=mock.ANY, schema="schema", inspector=inspector
        )
        self.assertListEqual(pg_result_expected, pg_result)

    def test_pg_time_expression_literal_no_grain(self):
        col = literal_column("COALESCE(a, b)")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(dialect=postgresql.dialect()))
        self.assertEqual(result, "COALESCE(a, b)")

    def test_pg_time_expression_literal_1y_grain(self):
        col = literal_column("COALESCE(a, b)")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', COALESCE(a, b))")

    def test_pg_time_expression_lower_column_no_grain(self):
        col = column("lower_case")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(dialect=postgresql.dialect()))
        self.assertEqual(result, "lower_case")

    def test_pg_time_expression_lower_case_column_sec_1y_grain(self):
        col = column("lower_case")
        expr = PostgresEngineSpec.get_timestamp_expr(col, "epoch_s", "P1Y")
        result = str(expr.compile(dialect=postgresql.dialect()))
        self.assertEqual(
            result,
            "DATE_TRUNC('year', (timestamp 'epoch' + lower_case * interval '1 second'))",  # noqa ignore: E50
        )

    def test_pg_time_expression_mixed_case_column_1y_grain(self):
        col = column("MixedCase")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', \"MixedCase\")")

    def test_mssql_time_expression_mixed_case_column_1y_grain(self):
        col = column("MixedCase")
        expr = MssqlEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(dialect=mssql.dialect()))
        self.assertEqual(result, "DATEADD(year, DATEDIFF(year, 0, [MixedCase]), 0)")

    def test_oracle_time_expression_reserved_keyword_1m_grain(self):
        col = column("decimal")
        expr = OracleEngineSpec.get_timestamp_expr(col, None, "P1M")
        result = str(expr.compile(dialect=oracle.dialect()))
        self.assertEqual(result, "TRUNC(CAST(\"decimal\" as DATE), 'MONTH')")

    def test_pinot_time_expression_sec_1m_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "epoch_s", "P1M")
        result = str(expr.compile())
        self.assertEqual(
            result,
            'DATETIMECONVERT(tstamp, "1:SECONDS:EPOCH", "1:SECONDS:EPOCH", "1:MONTHS")',
        )  # noqa

    def test_column_datatype_to_string(self):
        example_db = get_example_database()
        sqla_table = example_db.get_table("energy_usage")
        dialect = example_db.get_dialect()
        col_names = [
            example_db.db_engine_spec.column_datatype_to_string(c.type, dialect)
            for c in sqla_table.columns
        ]
        if example_db.backend == "postgresql":
            expected = ["VARCHAR(255)", "VARCHAR(255)", "DOUBLE PRECISION"]
        else:
            expected = ["VARCHAR(255)", "VARCHAR(255)", "FLOAT"]
        self.assertEquals(col_names, expected)
