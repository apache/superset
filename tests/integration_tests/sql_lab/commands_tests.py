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
from unittest.mock import patch

import pytest

from superset import db, sql_lab
from superset.common.db_query_status import QueryStatus
from superset.errors import SupersetErrorType
from superset.exceptions import SerializationError, SupersetErrorException
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sqllab.commands import results
from superset.utils import core as utils
from tests.integration_tests.base_tests import SupersetTestCase


class TestSqlExecutionResultsCommand(SupersetTestCase):
    @mock.patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_no_results_backend(self) -> None:
        results.results_backend = None

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert (
            ex_info.value.error.error_type
            == SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR
        )

    @mock.patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_data_cannot_be_retrieved(self) -> None:
        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = None

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    @mock.patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_query_not_found(self) -> None:
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

    @mock.patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
    def test_validation_query_not_found2(self) -> None:
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

        database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="foo",
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

    @mock.patch("superset.sqllab.commands.results.results_backend_use_msgpack", False)
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

        database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id="foo",
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

        command = results.SqlExecutionResultsCommand("test_abc", 1000)
        result = command.run()

        assert result.get("status") == "success"
        assert result.get("query").get("rows") == 104
        assert result.get("data") == data
