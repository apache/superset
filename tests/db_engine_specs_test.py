# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import inspect

from six import text_type

from superset import db_engine_specs
from superset.db_engine_specs import (
    BaseEngineSpec, HiveEngineSpec, MssqlEngineSpec,
    MySQLEngineSpec, PrestoEngineSpec,
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
            text_type(e),
            HiveEngineSpec.extract_error_message(e))

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

        self.assertEqual(engine_spec_class.get_limit_from_sql(q0), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q1), 10)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q2), 20)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q3), None)
        self.assertEqual(engine_spec_class.get_limit_from_sql(q4), 20)

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
            """
            SELECT
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
            """
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT         1000            ;""",
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
            """
                SELECT
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
            """
                SELECT
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
            if inspect.isclass(cls) and issubclass(cls, BaseEngineSpec):
                # make sure that all defined time grains are supported
                defined_time_grains = {grain.duration for grain in cls.get_time_grains()}
                intersection = time_grains.intersection(defined_time_grains)
                self.assertSetEqual(defined_time_grains, intersection, cls_name)
