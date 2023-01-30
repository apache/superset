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
from flask_babel import gettext as __

from superset import app, db, sql_lab
from superset.common.db_query_status import QueryStatus
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    SerializationError,
    SupersetErrorException,
    SupersetTimeoutException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sqllab.commands import estimate, results
from superset.utils import core as utils
from tests.integration_tests.base_tests import SupersetTestCase


class TestQueryEstimationCommand(SupersetTestCase):
    def test_validation_no_database(self) -> None:
        params = {"database_id": 1, "sql": "SELECT 1"}
        command = estimate.QueryEstimationCommand(params)

        with mock.patch("superset.sqllab.commands.estimate.db") as mock_superset_db:
            mock_superset_db.session.query().get.return_value = None
            with pytest.raises(SupersetErrorException) as ex_info:
                command.validate()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.RESULTS_BACKEND_ERROR
            )

    @patch("superset.tasks.scheduler.is_feature_enabled")
    def test_run_timeout(self, is_feature_enabled) -> None:
        params = {"database_id": 1, "sql": "SELECT 1", "template_params": {"temp": 123}}
        command = estimate.QueryEstimationCommand(params)

        db_mock = mock.Mock()
        db_mock.db_engine_spec = mock.Mock()
        db_mock.db_engine_spec.estimate_query_cost = mock.Mock(
            side_effect=SupersetTimeoutException(
                error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
                message=(
                    "Please check your connection details and database settings, "
                    "and ensure that your database is accepting connections, "
                    "then try connecting again."
                ),
                level=ErrorLevel.ERROR,
            )
        )
        db_mock.db_engine_spec.query_cost_formatter = mock.Mock(return_value=None)
        is_feature_enabled.return_value = False

        with mock.patch("superset.sqllab.commands.estimate.db") as mock_superset_db:
            mock_superset_db.session.query().get.return_value = db_mock
            with pytest.raises(SupersetErrorException) as ex_info:
                command.run()
            assert (
                ex_info.value.error.error_type == SupersetErrorType.SQLLAB_TIMEOUT_ERROR
            )
            assert ex_info.value.error.message == __(
                "The query estimation was killed after %(sqllab_timeout)s seconds. It might "
                "be too complex, or the database might be under heavy load.",
                sqllab_timeout=app.config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"],
            )

    def test_run_success(self) -> None:
        params = {"database_id": 1, "sql": "SELECT 1"}
        command = estimate.QueryEstimationCommand(params)

        payload = {"value": 100}

        db_mock = mock.Mock()
        db_mock.db_engine_spec = mock.Mock()
        db_mock.db_engine_spec.estimate_query_cost = mock.Mock(return_value=100)
        db_mock.db_engine_spec.query_cost_formatter = mock.Mock(return_value=payload)

        with mock.patch("superset.sqllab.commands.estimate.db") as mock_superset_db:
            mock_superset_db.session.query().get.return_value = db_mock
            result = command.run()
            assert result == payload


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
