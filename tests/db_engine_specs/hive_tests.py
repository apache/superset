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
from unittest import mock

from superset.db_engine_specs.hive import HiveEngineSpec
from tests.db_engine_specs.base_tests import DbEngineSpecTestCase


class HiveTests(DbEngineSpecTestCase):
    def test_0_progress(self):
        log = """
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=compile from=org.apache.hadoop.hive.ql.Driver>
            17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=parse from=org.apache.hadoop.hive.ql.Driver>
        """.split(
            "\n"
        )
        self.assertEqual(0, HiveEngineSpec.progress(log))

    def test_number_of_jobs_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        """.split(
            "\n"
        )
        self.assertEqual(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_progress(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        """.split(
            "\n"
        )
        self.assertEqual(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1(self):
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEqual(0, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_40_progress(
        self,
    ):  # pylint: disable=invalid-name
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        """.split(
            "\n"
        )
        self.assertEqual(10, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_1_map_80_reduce_40_progress(
        self,
    ):  # pylint: disable=invalid-name
        log = """
            17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
            17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
            17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 80%,  reduce = 40%
        """.split(
            "\n"
        )
        self.assertEqual(30, HiveEngineSpec.progress(log))

    def test_job_1_launched_stage_2_stages_progress(
        self,
    ):  # pylint: disable=invalid-name
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
        self.assertEqual(12, HiveEngineSpec.progress(log))

    def test_job_2_launched_stage_2_stages_progress(
        self,
    ):  # pylint: disable=invalid-name
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
        self.assertEqual(60, HiveEngineSpec.progress(log))

    def test_hive_error_msg(self):
        msg = (
            '{...} errorMessage="Error while compiling statement: FAILED: '
            "SemanticException [Error 10001]: Line 4"
            ":5 Table not found 'fact_ridesfdslakj'\", statusCode=3, "
            "sqlState='42S02', errorCode=10001)){...}"
        )
        self.assertEqual(
            (
                "hive error: Error while compiling statement: FAILED: "
                "SemanticException [Error 10001]: Line 4:5 "
                "Table not found 'fact_ridesfdslakj'"
            ),
            HiveEngineSpec.extract_error_message(Exception(msg)),
        )

        e = Exception("Some string that doesn't match the regex")
        self.assertEqual(f"hive error: {e}", HiveEngineSpec.extract_error_message(e))

        msg = (
            "errorCode=10001, "
            'errorMessage="Error while compiling statement"), operationHandle'
            '=None)"'
        )
        self.assertEqual(
            ("hive error: Error while compiling statement"),
            HiveEngineSpec.extract_error_message(Exception(msg)),
        )

    def test_hive_get_view_names_return_empty_list(
        self,
    ):  # pylint: disable=invalid-name
        self.assertEqual(
            [], HiveEngineSpec.get_view_names(mock.ANY, mock.ANY, mock.ANY)
        )

    def test_convert_dttm(self):
        dttm = self.get_dttm()

        self.assertEqual(
            HiveEngineSpec.convert_dttm("DATE", dttm), "CAST('2019-01-02' AS DATE)"
        )

        self.assertEqual(
            HiveEngineSpec.convert_dttm("TIMESTAMP", dttm),
            "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)",
        )
