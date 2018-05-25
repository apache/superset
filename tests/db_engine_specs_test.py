# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import textwrap

from superset.db_engine_specs import (
    HiveEngineSpec, MssqlEngineSpec, MySQLEngineSpec)
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

    def get_generic_database(self):
        return Database(sqlalchemy_uri='mysql://localhost')

    def sql_limit_regex(
            self, sql, expected_sql,
            engine_spec_class=MySQLEngineSpec,
            limit=1000):
        main = self.get_generic_database()
        limited = engine_spec_class.apply_limit_to_sql(sql, limit, main)
        self.assertEquals(expected_sql, limited)

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

    def test_modify_newline_query(self):
        self.sql_limit_regex(
            'SELECT * FROM a\nLIMIT 9999',
            'SELECT * FROM a LIMIT 1000',
        )

    def test_modify_lcase_limit_query(self):
        self.sql_limit_regex(
            'SELECT * FROM a\tlimit 9999',
            'SELECT * FROM a LIMIT 1000',
        )

    def test_limit_query_with_limit_subquery(self):
        self.sql_limit_regex(
            'SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 9999',
            'SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 1000',
        )

    def test_limit_with_expr(self):
        self.sql_limit_regex(
            textwrap.dedent("""\
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT
                99990"""),
            textwrap.dedent("""\
            SELECT
                'LIMIT 777' AS a
                , b
            FROM
            table LIMIT 1000"""),
        )

    def test_limit_expr_and_semicolon(self):
        self.sql_limit_regex(
            textwrap.dedent("""\
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table
                LIMIT         99990            ;"""),
            textwrap.dedent("""\
                SELECT
                    'LIMIT 777' AS a
                    , b
                FROM
                table LIMIT 1000"""),
        )
