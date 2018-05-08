# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from superset.db_engine_specs import MssqlEngineSpec, HiveEngineSpec, MySQLEngineSpec
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

    def test_wrapped_query(self):
        sql = "SELECT * FROM a"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MssqlEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = """SELECT * \nFROM (SELECT * FROM a) AS inner_qry \n LIMIT 1000"""
        self.assertEquals(expected, limited)

    def test_simple_limit_query(self):
        sql = "SELECT * FROM a"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MySQLEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = """SELECT * FROM a LIMIT 1000"""
        self.assertEquals(expected, limited)

    def test_modify_limit_query(self):
        sql = "SELECT * FROM a LIMIT 9999"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MySQLEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = """SELECT * FROM a LIMIT 1000"""
        self.assertEquals(expected, limited)

    def test_modify_newline_query(self):
        sql = "SELECT * FROM a\nLIMIT 9999"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MySQLEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = """SELECT * FROM a LIMIT 1000"""
        self.assertEquals(expected, limited)

    def test_modify_lcase_limit_query(self):
        sql = "SELECT * FROM a\tlimit 9999"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MySQLEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = """SELECT * FROM a LIMIT 1000"""
        self.assertEquals(expected, limited)

    def test_limit_query_with_limit_subquery(self):
        sql = "SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 9999"
        db = Database(sqlalchemy_uri="mysql://localhost")
        limited = MySQLEngineSpec.apply_limit_to_sql(sql, 1000, db)
        expected = "SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 1000"
        self.assertEquals(expected, limited)
