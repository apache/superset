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
from datetime import datetime
from unittest import mock

import pytest

from tests.test_app import app
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.exceptions import SupersetException
from superset.sql_parse import Table, ParsedQuery


def test_0_progress():
    log = """
        17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=compile from=org.apache.hadoop.hive.ql.Driver>
        17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=parse from=org.apache.hadoop.hive.ql.Driver>
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 0


def test_number_of_jobs_progress():
    log = """
        17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 0


def test_job_1_launched_progress():
    log = """
        17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 0


def test_job_1_launched_stage_1():
    log = """
        17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 0


def test_job_1_launched_stage_1_map_40_progress():  # pylint: disable=invalid-name
    log = """
        17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 10


def test_job_1_launched_stage_1_map_80_reduce_40_progress():  # pylint: disable=invalid-name
    log = """
        17/02/07 19:15:55 INFO ql.Driver: Total jobs = 2
        17/02/07 19:15:55 INFO ql.Driver: Launching Job 1 out of 2
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 0%,  reduce = 0%
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 40%,  reduce = 0%
        17/02/07 19:16:09 INFO exec.Task: 2017-02-07 19:16:09,173 Stage-1 map = 80%,  reduce = 40%
    """.split(
        "\n"
    )
    assert HiveEngineSpec.progress(log) == 30


def test_job_1_launched_stage_2_stages_progress():  # pylint: disable=invalid-name
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
    assert HiveEngineSpec.progress(log) == 12


def test_job_2_launched_stage_2_stages_progress():  # pylint: disable=invalid-name
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
    assert HiveEngineSpec.progress(log) == 60


def test_hive_error_msg():
    msg = (
        '{...} errorMessage="Error while compiling statement: FAILED: '
        "SemanticException [Error 10001]: Line 4"
        ":5 Table not found 'fact_ridesfdslakj'\", statusCode=3, "
        "sqlState='42S02', errorCode=10001)){...}"
    )
    assert HiveEngineSpec.extract_error_message(Exception(msg)) == (
        "hive error: Error while compiling statement: FAILED: "
        "SemanticException [Error 10001]: Line 4:5 "
        "Table not found 'fact_ridesfdslakj'"
    )

    e = Exception("Some string that doesn't match the regex")
    assert HiveEngineSpec.extract_error_message(e) == f"hive error: {e}"

    msg = (
        "errorCode=10001, "
        'errorMessage="Error while compiling statement"), operationHandle'
        '=None)"'
    )
    assert (
        HiveEngineSpec.extract_error_message(Exception(msg))
        == "hive error: Error while compiling statement"
    )


def test_hive_get_view_names_return_empty_list():  # pylint: disable=invalid-name
    assert HiveEngineSpec.get_view_names(mock.ANY, mock.ANY, mock.ANY) == []


def test_convert_dttm():
    dttm = datetime.strptime("2019-01-02 03:04:05.678900", "%Y-%m-%d %H:%M:%S.%f")
    assert HiveEngineSpec.convert_dttm("DATE", dttm) == "CAST('2019-01-02' AS DATE)"
    assert (
        HiveEngineSpec.convert_dttm("TIMESTAMP", dttm)
        == "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"
    )


def test_create_table_from_csv_append() -> None:

    with pytest.raises(SupersetException):
        HiveEngineSpec.create_table_from_csv(
            "foo.csv", Table("foobar"), mock.MagicMock(), {}, {"if_exists": "append"}
        )


def test_get_create_table_stmt() -> None:
    table = Table("employee")
    schema_def = """eid int, name String, salary String, destination String"""
    location = "s3a://directory/table"
    from unittest import TestCase

    TestCase.maxDiff = None
    assert HiveEngineSpec.get_create_table_stmt(
        table, schema_def, location, ",", 0, [""]
    ) == (
        """CREATE TABLE employee ( eid int, name String, salary String, destination String )
                ROW FORMAT DELIMITED FIELDS TERMINATED BY :delim
                STORED AS TEXTFILE LOCATION :location
                tblproperties ('skip.header.line.count'=:header_line_count, 'serialization.null.format'=:null_value)""",
        {
            "delim": ",",
            "location": "s3a://directory/table",
            "header_line_count": "1",
            "null_value": "",
        },
    )
    assert HiveEngineSpec.get_create_table_stmt(
        table, schema_def, location, ",", 1, ["1", "2"]
    ) == (
        """CREATE TABLE employee ( eid int, name String, salary String, destination String )
                ROW FORMAT DELIMITED FIELDS TERMINATED BY :delim
                STORED AS TEXTFILE LOCATION :location
                tblproperties ('skip.header.line.count'=:header_line_count, 'serialization.null.format'=:null_value)""",
        {
            "delim": ",",
            "location": "s3a://directory/table",
            "header_line_count": "2",
            "null_value": "1",
        },
    )
    assert HiveEngineSpec.get_create_table_stmt(
        table, schema_def, location, ",", 100, ["NaN"]
    ) == (
        """CREATE TABLE employee ( eid int, name String, salary String, destination String )
                ROW FORMAT DELIMITED FIELDS TERMINATED BY :delim
                STORED AS TEXTFILE LOCATION :location
                tblproperties ('skip.header.line.count'=:header_line_count, 'serialization.null.format'=:null_value)""",
        {
            "delim": ",",
            "location": "s3a://directory/table",
            "header_line_count": "101",
            "null_value": "NaN",
        },
    )
    assert HiveEngineSpec.get_create_table_stmt(
        table, schema_def, location, ",", None, None
    ) == (
        """CREATE TABLE employee ( eid int, name String, salary String, destination String )
                ROW FORMAT DELIMITED FIELDS TERMINATED BY :delim
                STORED AS TEXTFILE LOCATION :location""",
        {"delim": ",", "location": "s3a://directory/table"},
    )
    assert HiveEngineSpec.get_create_table_stmt(
        table, schema_def, location, ",", 100, []
    ) == (
        """CREATE TABLE employee ( eid int, name String, salary String, destination String )
                ROW FORMAT DELIMITED FIELDS TERMINATED BY :delim
                STORED AS TEXTFILE LOCATION :location
                tblproperties ('skip.header.line.count'=:header_line_count)""",
        {"delim": ",", "location": "s3a://directory/table", "header_line_count": "101"},
    )


def test_is_readonly():
    def is_readonly(sql: str) -> bool:
        return HiveEngineSpec.is_readonly_query(ParsedQuery(sql))

    assert not is_readonly("UPDATE t1 SET col1 = NULL")
    assert not is_readonly("INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA")
    assert is_readonly("SHOW LOCKS test EXTENDED")
    assert is_readonly("SET hivevar:desc='Legislators'")
    assert is_readonly("EXPLAIN SELECT 1")
    assert is_readonly("SELECT 1")
    assert is_readonly("WITH (SELECT 1) bla SELECT * from bla")
