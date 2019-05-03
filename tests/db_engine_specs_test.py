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
import inspect
from unittest import mock

from sqlalchemy import column, select, table
from sqlalchemy.dialects.mssql import pymssql
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.types import String, UnicodeText

from superset import db_engine_specs
from superset.db_engine_specs import (
    BaseEngineSpec, BQEngineSpec, HiveEngineSpec, MssqlEngineSpec,
    MySQLEngineSpec, OracleEngineSpec, PrestoEngineSpec,
)
from superset.models.core import Database
from .base_tests import SupersetTestCase


class DbEngineSpecsTestCase(SupersetTestCase):
    def test_0_progress(self):
        log = """
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=compile from=org.apache.hadoop.hive.ql.Driver>
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=parse from=org.apache.hadoop.hive.ql.Driver>
        """.split('\n')  # noqa ignore: E501
        self.assertEquals(
            0, HiveEngineSpec.progress(log))

    def test_number_of_jobs_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        """.split('\n')
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        """.split('\n')
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_0_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
        """.split('\n')  # noqa ignore: E501
        self.assertEquals(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_40_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        """.split('\n')  # noqa ignore: E501
        self.assertEquals(10, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_80_reduce_40_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 80%,  reduce = 40%
        """.split('\n')  # noqa ignore: E501
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
        """.split('\n')  # noqa ignore: E501
        self.assertEquals(12, HiveEngineSpec.progress(log))

    def test_job_2_launched_stage_2_stages_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 100%,  reduce = 0%
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 2 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        """.split('\n')  # noqa ignore: E501
        self.assertEquals(60, HiveEngineSpec.progress(log))

    def test_hive_error_msg(self):
        msg = (
            '{...} errorMessage="Error while compiling statement: FAILED: '
            'SemanticException [Error 10001]: Line 4'
            ':5 Table not found \'fact_ridesfdslakj\'", statusCode=3, '
            'sqlState=\'42S02\', errorCode=10001)){...}')
        self.assertEquals((
            'Error while compiling statement: FAILED: '
            'SemanticException [Error 10001]: Line 4:5 '
            "Table not found 'fact_ridesfdslakj'"),
            HiveEngineSpec.extract_error_message(Exception(msg)))

        e = Exception("Some string that doesn't match the regex")
        self.assertEquals(
            str(e), HiveEngineSpec.extract_error_message(e))

        msg = (
            'errorCode=10001, '
            'errorMessage="Error while compiling statement"), operationHandle'
            '=None)"'
        )
        self.assertEquals((
            'Error while compiling statement'),
            HiveEngineSpec.extract_error_message(Exception(msg)))

    def get_generic_database(self):
        return Database(sqlalchemy_uri='mysql://localhost')

    def sql_limit_regex(
            self, sql, expected_sql,
            engine_spec_class=MySQLEngineSpec,
            limit=1000):
        main = self.get_generic_database()
        limited = engine_spec_class.apply_limit_to_sql(sql, limit, main)
        self.assertEquals(expected_sql, limited)

    def test_extract_limit_from_query(self, engine_spec_class=MySQLEngineSpec):
        q0 = 'select * from table'
        q1 = 'select * from mytable limit 10'
        q2 = 'select * from (select * from my_subquery limit 10) where col=1 limit 20'
        q3 = 'select * from (select * from my_subquery limit 10);'
        q4 = 'select * from (select * from my_subquery limit 10) where col=1 limit 20;'
        q5 = 'select * from mytable limit 10, 20'
        q6 = 'select * from mytable limit 10 offset 20'
        q7 = 'select * from mytable limit'
        q8 = 'select * from mytable limit 10.0'
        q9 = 'select * from mytable limit x'
        q10 = 'select * from mytable limit x, 20'
        q11 = 'select * from mytable limit x offset 20'

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
            'SELECT * FROM a',
            'SELECT * \nFROM (SELECT * FROM a) AS inner_qry \n LIMIT 1000',
            MssqlEngineSpec,
        )

    def test_wrapped_semi(self):
        self.sql_limit_regex(
            'SELECT * FROM a;',
            'SELECT * \nFROM (SELECT * FROM a) AS inner_qry \n LIMIT 1000',
            MssqlEngineSpec,
        )

    def test_wrapped_semi_tabs(self):
        self.sql_limit_regex(
            'SELECT * FROM a  \t \n   ; \t  \n  ',
            'SELECT * \nFROM (SELECT * FROM a) AS inner_qry \n LIMIT 1000',
            MssqlEngineSpec,
        )

    def test_simple_limit_query(self):
        self.sql_limit_regex(
            'SELECT * FROM a',
            'SELECT * FROM a LIMIT 1000',
        )

    def test_modify_limit_query(self):
        self.sql_limit_regex(
            'SELECT * FROM a LIMIT 9999',
            'SELECT * FROM a LIMIT 1000',
        )

    def test_limit_query_with_limit_subquery(self):
        self.sql_limit_regex(
            'SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 9999',
            'SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 1000',
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
        self.assertEquals('STRING', PrestoEngineSpec.get_datatype('string'))
        self.assertEquals('TINY', MySQLEngineSpec.get_datatype(1))
        self.assertEquals('VARCHAR', MySQLEngineSpec.get_datatype(15))
        self.assertEquals('VARCHAR', BaseEngineSpec.get_datatype('VARCHAR'))

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
            """
                SELECT
                    'LIMIT 777'""",
            """
                SELECT
                    'LIMIT 777' LIMIT 1000""",
        )

    def test_time_grain_blacklist(self):
        blacklist = ['PT1M']
        time_grains = {
            'PT1S': 'second',
            'PT1M': 'minute',
        }
        time_grain_functions = {
            'PT1S': '{col}',
            'PT1M': '{col}',
        }
        time_grains = db_engine_specs._create_time_grains_tuple(time_grains,
                                                                time_grain_functions,
                                                                blacklist)
        self.assertEqual(1, len(time_grains))
        self.assertEqual('PT1S', time_grains[0].duration)

    def test_engine_time_grain_validity(self):
        time_grains = set(db_engine_specs.builtin_time_grains.keys())
        # loop over all subclasses of BaseEngineSpec
        for cls_name, cls in inspect.getmembers(db_engine_specs):
            if inspect.isclass(cls) and issubclass(cls, BaseEngineSpec) \
                    and cls is not BaseEngineSpec:
                # make sure time grain functions have been defined
                self.assertGreater(len(cls.time_grain_functions), 0)
                # make sure that all defined time grains are supported
                defined_time_grains = {grain.duration for grain in cls.get_time_grains()}
                intersection = time_grains.intersection(defined_time_grains)
                self.assertSetEqual(defined_time_grains, intersection, cls_name)

    def test_presto_get_view_names_return_empty_list(self):
        self.assertEquals([], PrestoEngineSpec.get_view_names(mock.ANY, mock.ANY))

    def verify_presto_column(self, column, expected_results):
        inspector = mock.Mock()
        inspector.engine.dialect.identifier_preparer.quote_identifier = mock.Mock()
        keymap = {'Column': (None, None, 0),
                  'Type': (None, None, 1),
                  'Null': (None, None, 2)}
        row = RowProxy(mock.Mock(), column, [None, None, None, None], keymap)
        inspector.bind.execute = mock.Mock(return_value=[row])
        results = PrestoEngineSpec.get_columns(inspector, '', '')
        self.assertEqual(len(expected_results), len(results))
        for expected_result, result in zip(expected_results, results):
            self.assertEqual(expected_result[0], result['name'])
            self.assertEqual(expected_result[1], str(result['type']))

    def test_presto_get_column(self):
        presto_column = ('column_name', 'boolean', '')
        expected_results = [('column_name', 'BOOLEAN')]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_simple_row_column(self):
        presto_column = ('column_name', 'row(nested_obj double)', '')
        expected_results = [
            ('column_name', 'ROW'),
            ('column_name.nested_obj', 'FLOAT')]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_simple_row_column_with_tricky_name(self):
        presto_column = ('column_name', 'row("Field Name(Tricky, Name)" double)', '')
        expected_results = [
            ('column_name', 'ROW'),
            ('column_name."Field Name(Tricky, Name)"', 'FLOAT')]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_simple_array_column(self):
        presto_column = ('column_name', 'array(double)', '')
        expected_results = [('column_name', 'ARRAY')]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_row_within_array_within_row_column(self):
        presto_column = (
            'column_name',
            'row(nested_array array(row(nested_row double)), nested_obj double)', '')
        expected_results = [
            ('column_name', 'ROW'),
            ('column_name.nested_array', 'ARRAY'),
            ('column_name.nested_array.nested_row', 'FLOAT'),
            ('column_name.nested_obj', 'FLOAT'),
        ]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_array_within_row_within_array_column(self):
        presto_column = (
            'column_name',
            'array(row(nested_array array(double), nested_obj double))', '')
        expected_results = [
            ('column_name', 'ARRAY'),
            ('column_name.nested_array', 'ARRAY'),
            ('column_name.nested_obj', 'FLOAT')]
        self.verify_presto_column(presto_column, expected_results)

    def test_presto_get_fields(self):
        cols = [
            {'name': 'column'},
            {'name': 'column.nested_obj'},
            {'name': 'column."quoted.nested obj"'}]
        actual_results = PrestoEngineSpec._get_fields(cols)
        expected_results = [
            {'name': '"column"', 'label': 'column'},
            {'name': '"column"."nested_obj"', 'label': 'column.nested_obj'},
            {'name': '"column"."quoted.nested obj"',
             'label': 'column."quoted.nested obj"'}]
        for actual_result, expected_result in zip(actual_results, expected_results):
            self.assertEqual(actual_result.element.name, expected_result['name'])
            self.assertEqual(actual_result.name, expected_result['label'])

    def test_presto_filter_presto_cols(self):
        cols = [
            {'name': 'column', 'type': 'ARRAY'},
            {'name': 'column.nested_obj', 'type': 'FLOAT'}]
        actual_results = PrestoEngineSpec._filter_presto_cols(cols)
        expected_results = [cols[0]]
        self.assertEqual(actual_results, expected_results)

    def test_hive_get_view_names_return_empty_list(self):
        self.assertEquals([], HiveEngineSpec.get_view_names(mock.ANY, mock.ANY))

    def test_bigquery_sqla_column_label(self):
        label = BQEngineSpec.make_label_compatible(column('Col').name)
        label_expected = 'Col'
        self.assertEqual(label, label_expected)

        label = BQEngineSpec.make_label_compatible(column('SUM(x)').name)
        label_expected = 'SUM_x__5f110b965a993675bc4953bb3e03c4a5'
        self.assertEqual(label, label_expected)

        label = BQEngineSpec.make_label_compatible(column('SUM[x]').name)
        label_expected = 'SUM_x__7ebe14a3f9534aeee125449b0bc083a8'
        self.assertEqual(label, label_expected)

        label = BQEngineSpec.make_label_compatible(column('12345_col').name)
        label_expected = '_12345_col_8d3906e2ea99332eb185f7f8ecb2ffd6'
        self.assertEqual(label, label_expected)

    def test_oracle_sqla_column_name_length_exceeded(self):
        col = column('This_Is_32_Character_Column_Name')
        label = OracleEngineSpec.make_label_compatible(col.name)
        self.assertEqual(label.quote, True)
        label_expected = '3b26974078683be078219674eeb8f5'
        self.assertEqual(label, label_expected)

    def test_mssql_column_types(self):
        def assert_type(type_string, type_expected):
            type_assigned = MssqlEngineSpec.get_sqla_column_type(type_string)
            if type_expected is None:
                self.assertIsNone(type_assigned)
            else:
                self.assertIsInstance(type_assigned, type_expected)

        assert_type('INT', None)
        assert_type('STRING', String)
        assert_type('CHAR(10)', String)
        assert_type('VARCHAR(10)', String)
        assert_type('TEXT', String)
        assert_type('NCHAR(10)', UnicodeText)
        assert_type('NVARCHAR(10)', UnicodeText)
        assert_type('NTEXT', UnicodeText)

    def test_mssql_where_clause_n_prefix(self):
        dialect = pymssql.dialect()
        spec = MssqlEngineSpec
        str_col = column('col', type_=spec.get_sqla_column_type('VARCHAR(10)'))
        unicode_col = column('unicode_col', type_=spec.get_sqla_column_type('NTEXT'))
        tbl = table('tbl')
        sel = select([str_col, unicode_col]).\
            select_from(tbl).\
            where(str_col == 'abc').\
            where(unicode_col == 'abc')

        query = str(sel.compile(dialect=dialect, compile_kwargs={'literal_binds': True}))
        query_expected = "SELECT col, unicode_col \nFROM tbl \nWHERE col = 'abc' AND unicode_col = N'abc'"  # noqa
        self.assertEqual(query, query_expected)
