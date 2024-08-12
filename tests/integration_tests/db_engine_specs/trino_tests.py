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

import pandas as pd
import pytest

from superset.db_engine_specs.trino import TrinoEngineSpec
from superset.exceptions import SupersetException
from superset.sql_parse import Table
from tests.integration_tests.test_app import app


def test_df_to_csv() -> None:
    with pytest.raises(SupersetException):
        TrinoEngineSpec.df_to_sql(
            mock.MagicMock(),
            Table("foobar"),
            pd.DataFrame(),
            {"if_exists": "append"},
        )


@mock.patch("superset.db_engine_specs.trino.g", spec={})
def test_df_to_sql_if_exists_fail(mock_g):
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    with pytest.raises(SupersetException, match="Table already exists"):
        TrinoEngineSpec.df_to_sql(
            mock_database, Table("foobar"), pd.DataFrame(), {"if_exists": "fail"}
        )


@mock.patch("superset.db_engine_specs.trino.g", spec={})
def test_df_to_sql_if_exists_fail_with_schema(mock_g):
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    with pytest.raises(SupersetException, match="Table already exists"):
        TrinoEngineSpec.df_to_sql(
            mock_database,
            Table(table="foobar", schema="schema"),
            pd.DataFrame(),
            {"if_exists": "fail"},
        )


@mock.patch("superset.db_engine_specs.trino.g", spec={})
@mock.patch("superset.db_engine_specs.trino.upload_to_s3")
def test_df_to_sql_if_exists_replace(mock_upload_to_s3, mock_g):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"]: lambda *args: ""  # noqa: F722
    mock_upload_to_s3.return_value = "mock-location"
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    mock_execute = mock.MagicMock(return_value=True)
    mock_database.get_sqla_engine.return_value.__enter__.return_value.execute = (
        mock_execute
    )
    table_name = "foobar"

    with app.app_context():
        TrinoEngineSpec.df_to_sql(
            mock_database,
            Table(table=table_name),
            pd.DataFrame(),
            {"if_exists": "replace", "header": 1, "na_values": "mock", "sep": "mock"},
        )

    mock_execute.assert_any_call(f"DROP TABLE IF EXISTS {table_name}")
    app.config = config


@mock.patch("superset.db_engine_specs.trino.g", spec={})
@mock.patch("superset.db_engine_specs.trino.upload_to_s3")
def test_df_to_sql_if_exists_replace_with_schema(mock_upload_to_s3, mock_g):
    config = app.config.copy()
    app.config["CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"]: lambda *args: ""  # noqa: F722
    mock_upload_to_s3.return_value = "mock-location"
    mock_g.user = True
    mock_database = mock.MagicMock()
    mock_database.get_df.return_value.empty = False
    mock_execute = mock.MagicMock(return_value=True)
    mock_database.get_sqla_engine.return_value.__enter__.return_value.execute = (
        mock_execute
    )
    table_name = "foobar"
    schema = "schema"

    with app.app_context():
        TrinoEngineSpec.df_to_sql(
            mock_database,
            Table(table=table_name, schema=schema),
            pd.DataFrame(),
            {"if_exists": "replace", "header": 1, "na_values": "mock", "sep": "mock"},
        )

    mock_execute.assert_any_call(f"DROP TABLE IF EXISTS {schema}.{table_name}")
    app.config = config
