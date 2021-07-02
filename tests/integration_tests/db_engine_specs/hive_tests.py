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
import pandas as pd
from sqlalchemy.sql import select

from superset.db_engine_specs.hive import HiveEngineSpec, upload_to_s3
from superset.exceptions import SupersetException
from superset.sql_parse import Table, ParsedQuery
from tests.integration_tests.test_app import app


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


def test_df_to_csv() -> None:
    with pytest.raises(SupersetException):
        HiveEngineSpec.df_to_sql(
            mock.MagicMock(), Table("foobar"), pd.DataFrame(), {"if_exists": "append"},
        )


@mock.patch("superset.db_engine_specs.hive.g", spec={})
def test_df_to_sql_if_exists_fail(mock_g):
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    with pytest.raises(SupersetException, match="Table already exists"):
        HiveEngineSpec.df_to_sql(
            mock_database, Table("foobar"), pd.DataFrame(), {"if_exists": "fail"}
        )


@mock.patch("superset.db_engine_specs.hive.g", spec={})
def test_df_to_sql_if_exists_fail_with_schema(mock_g):
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    with pytest.raises(SupersetException, match="Table already exists"):
        HiveEngineSpec.df_to_sql(
            mock_database,
            Table(table="foobar", schema="schema"),
            pd.DataFrame(),
            {"if_exists": "fail"},
        )


@mock.patch("superset.db_engine_specs.hive.g", spec={})
@mock.patch("superset.db_engine_specs.hive.upload_to_s3")
def test_df_to_sql_if_exists_replace(mock_upload_to_s3, mock_g):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"]: lambda *args: ""
    mock_upload_to_s3.return_value = "mock-location"
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    mock_execute = mock.MagicMock(return_value=True)
    mock_database.get_sqla_engine.return_value.execute = mock_execute
    table_name = "foobar"

    with app.app_context():
        HiveEngineSpec.df_to_sql(
            mock_database,
            Table(table=table_name),
            pd.DataFrame(),
            {"if_exists": "replace", "header": 1, "na_values": "mock", "sep": "mock"},
        )

    mock_execute.assert_any_call(f"DROP TABLE IF EXISTS {table_name}")
    app.config = config


@mock.patch("superset.db_engine_specs.hive.g", spec={})
@mock.patch("superset.db_engine_specs.hive.upload_to_s3")
def test_df_to_sql_if_exists_replace_with_schema(mock_upload_to_s3, mock_g):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"]: lambda *args: ""
    mock_upload_to_s3.return_value = "mock-location"
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    mock_execute = mock.MagicMock(return_value=True)
    mock_database.get_sqla_engine.return_value.execute = mock_execute
    table_name = "foobar"
    schema = "schema"

    with app.app_context():
        HiveEngineSpec.df_to_sql(
            mock_database,
            Table(table=table_name, schema=schema),
            pd.DataFrame(),
            {"if_exists": "replace", "header": 1, "na_values": "mock", "sep": "mock"},
        )

    mock_execute.assert_any_call(f"DROP TABLE IF EXISTS {schema}.{table_name}")
    app.config = config


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


@pytest.mark.parametrize(
    "schema,upload_prefix",
    [("foo", "EXTERNAL_HIVE_TABLES/1/foo/"), (None, "EXTERNAL_HIVE_TABLES/1/")],
)
def test_s3_upload_prefix(schema: str, upload_prefix: str) -> None:
    mock_database = mock.MagicMock()
    mock_database.id = 1

    assert (
        app.config["CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"](
            database=mock_database, user=mock.MagicMock(), schema=schema
        )
        == upload_prefix
    )


def test_upload_to_s3_no_bucket_path():
    with app.app_context():
        with pytest.raises(
            Exception,
            match="No upload bucket specified. You can specify one in the config file.",
        ):
            upload_to_s3("filename", "prefix", Table("table"))


@mock.patch("boto3.client")
def test_upload_to_s3_client_error(client):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_S3_BUCKET"] = "bucket"
    from botocore.exceptions import ClientError

    client.return_value.upload_file.side_effect = ClientError(
        {"Error": {}}, "operation_name"
    )

    with app.app_context():
        with pytest.raises(ClientError):
            upload_to_s3("filename", "prefix", Table("table"))

    app.config = config


@mock.patch("boto3.client")
def test_upload_to_s3_success(client):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_S3_BUCKET"] = "bucket"
    client.return_value.upload_file.return_value = True

    with app.app_context():
        location = upload_to_s3("filename", "prefix", Table("table"))
        assert f"s3a://bucket/prefix/table" == location

    app.config = config


def test_fetch_data_query_error():
    from TCLIService import ttypes

    err_msg = "error message"
    cursor = mock.Mock()
    cursor.poll.return_value.operationState = ttypes.TOperationState.ERROR_STATE
    cursor.poll.return_value.errorMessage = err_msg
    with pytest.raises(Exception, match=f"('Query error', '{err_msg})'"):
        HiveEngineSpec.fetch_data(cursor)


@mock.patch("superset.db_engine_specs.base.BaseEngineSpec.fetch_data")
def test_fetch_data_programming_error(fetch_data_mock):
    from pyhive.exc import ProgrammingError

    fetch_data_mock.side_effect = ProgrammingError
    cursor = mock.Mock()
    assert HiveEngineSpec.fetch_data(cursor) == []


@mock.patch("superset.db_engine_specs.base.BaseEngineSpec.fetch_data")
def test_fetch_data_success(fetch_data_mock):
    return_value = ["a", "b"]
    fetch_data_mock.return_value = return_value
    cursor = mock.Mock()
    assert HiveEngineSpec.fetch_data(cursor) == return_value


@mock.patch("superset.db_engine_specs.hive.HiveEngineSpec._latest_partition_from_df")
def test_where_latest_partition(mock_method):
    mock_method.return_value = ("01-01-19", 1)
    db = mock.Mock()
    db.get_indexes = mock.Mock(return_value=[{"column_names": ["ds", "hour"]}])
    db.get_extra = mock.Mock(return_value={})
    db.get_df = mock.Mock()
    columns = [{"name": "ds"}, {"name": "hour"}]
    with app.app_context():
        result = HiveEngineSpec.where_latest_partition(
            "test_table", "test_schema", db, select(), columns
        )
    query_result = str(result.compile(compile_kwargs={"literal_binds": True}))
    assert "SELECT  \nWHERE ds = '01-01-19' AND hour = 1" == query_result


@mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.latest_partition")
def test_where_latest_partition_super_method_exception(mock_method):
    mock_method.side_effect = Exception()
    db = mock.Mock()
    columns = [{"name": "ds"}, {"name": "hour"}]
    with app.app_context():
        result = HiveEngineSpec.where_latest_partition(
            "test_table", "test_schema", db, select(), columns
        )
    assert result is None
    mock_method.assert_called()


@mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.latest_partition")
def test_where_latest_partition_no_columns_no_values(mock_method):
    mock_method.return_value = ("01-01-19", None)
    db = mock.Mock()
    with app.app_context():
        result = HiveEngineSpec.where_latest_partition(
            "test_table", "test_schema", db, select()
        )
    assert result is None
