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
from unittest import mock, skip
from unittest.mock import Mock, patch

import pandas as pd
import pytest

from superset import db, sql_lab
from superset.common.db_query_status import QueryStatus
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    SerializationError,
    SupersetError,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sqllab.commands import export, results
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils import core as utils
from tests.integration_tests.base_tests import SupersetTestCase


class TestSqlResultExportCommand(SupersetTestCase):
    def test_validation_query_not_found(self) -> None:
        command = export.SqlResultExportCommand("asdf")

        database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test1",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc1",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    def test_validation_invalid_access(self) -> None:
        command = export.SqlResultExportCommand("test2")

        database = Database(database_name="my_database2", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test2",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc2",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        with mock.patch(
            "superset.security_manager.raise_for_access",
            side_effect=SupersetSecurityException(
                SupersetError(
                    "dummy",
                    SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    ErrorLevel.ERROR,
                )
            ),
        ):
            with pytest.raises(SupersetErrorException) as ex_info:
                command.run()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR
            )

    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_select_sql(self, get_df_mock: Mock) -> None:
        command = export.SqlResultExportCommand("test3")

        database = Database(database_name="my_database3", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test3",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc3",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})

        result = command.run()

        data = result.get("data")
        count = result.get("count")
        query = result.get("query")

        assert data == "foo\n1\n2\n3\n"
        assert count == 3
        assert query.client_id == "test3"

    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_executed_sql(self, get_df_mock: Mock) -> None:
        command = export.SqlResultExportCommand("test4")

        database = Database(database_name="my_database4", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test4",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql=None,
            executed_sql="select * from bar limit 2",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc4",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})

        result = command.run()

        data = result.get("data")
        count = result.get("count")
        query = result.get("query")

        assert data == "foo\n1\n2\n"
        assert count == 2
        assert query.client_id == "test4"

    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_executed_sql_limiting_factor(
        self, get_df_mock: Mock
    ) -> None:
        command = export.SqlResultExportCommand("test5")

        database = Database(database_name="my_database5", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test5",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql=None,
            executed_sql="select * from bar limit 2",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc5",
            limiting_factor=LimitingFactor.DROPDOWN,
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})

        result = command.run()

        data = result.get("data")
        count = result.get("count")
        query = result.get("query")

        assert data == "foo\n1\n"
        assert count == 1
        assert query.client_id == "test5"

    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.sqllab.commands.export.results_backend_use_msgpack", False)
    def test_run_with_results_backend(self) -> None:
        command = export.SqlResultExportCommand("test6")

        database = Database(database_name="my_database6", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test6",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc6",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        data = [{"foo": i} for i in range(5)]
        payload = {
            "columns": [{"name": "foo"}],
            "data": data,
        }
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)

        export.results_backend = mock.Mock()
        export.results_backend.get.return_value = compressed

        result = command.run()

        data = result.get("data")
        count = result.get("count")
        query = result.get("query")

        assert data == "foo\n0\n1\n2\n3\n4\n"
        assert count == 5
        assert query.client_id == "test6"


class TestSqlExecutionResultsCommand(SupersetTestCase):
    @patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_no_results_backend(self) -> None:
        results.results_backend = None

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert (
            ex_info.value.error.error_type
            == SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR
        )

    @patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_data_cannot_be_retrieved(self) -> None:
        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = None

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    @patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_data_not_found(self) -> None:
        data = [{"col_0": i} for i in range(100)]
        payload = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 100},
            "data": data,
        }
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)

        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = compressed

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    @patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_query_not_found(self) -> None:
        data = [{"col_0": i} for i in range(104)]
        payload = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 104},
            "data": data,
        }
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)

        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = compressed

        database = Database(database_name="my_database7", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test8",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="abc7",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        with mock.patch(
            "superset.views.utils._deserialize_results_payload",
            side_effect=SerializationError(),
        ):
            with pytest.raises(SupersetErrorException) as ex_info:
                command = results.SqlExecutionResultsCommand("test", 1000)
                command.run()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.RESULTS_BACKEND_ERROR
            )

    @patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_run_succeeds(self) -> None:
        data = [{"col_0": i} for i in range(104)]
        payload = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 104},
            "data": data,
        }
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)

        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = compressed

        database = Database(database_name="my_database8", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="test9",
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select * from bar",
            select_sql="select * from bar",
            executed_sql="select * from bar",
            limit=100,
            select_as_cta=False,
            rows=104,
            error_message="none",
            results_key="test_abc",
        )

        db.session.add(database)
        db.session.add(query_obj)
        db.session.commit()

        command = results.SqlExecutionResultsCommand("test_abc", 1000)
        result = command.run()

        assert result.get("status") == "success"
        assert result.get("query").get("rows") == 104
        assert result.get("data") == data
