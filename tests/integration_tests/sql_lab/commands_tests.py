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
from typing import Any
from unittest import mock
from unittest.mock import Mock, patch

import pandas as pd
import pytest
from flask import current_app
from flask_babel import gettext as __
from jinja2.exceptions import TemplateError, TemplateSyntaxError
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import object_session

from superset import db, sql_lab
from superset.commands.sql_lab import estimate, export, results
from superset.common.db_query_status import QueryStatus
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SerializationError,
    SupersetErrorException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.models.core import Database  # noqa: F401
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sqllab.schemas import EstimateQueryCostSchema
from superset.utils import core as utils
from superset.utils.core import override_user
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase


class TestQueryEstimationCommand(SupersetTestCase):
    def test_validation_no_database(self) -> None:
        params = {"database_id": 1, "sql": "SELECT 1"}
        schema = EstimateQueryCostSchema()
        data: EstimateQueryCostSchema = schema.dump(params)
        command = estimate.QueryEstimationCommand(data)

        with mock.patch("superset.commands.sql_lab.estimate.DatabaseDAO") as mock_dao:
            mock_dao.find_by_id.return_value = None
            with pytest.raises(SupersetErrorException) as ex_info:
                command.validate()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.RESULTS_BACKEND_ERROR
            )

    @patch("superset.tasks.scheduler.is_feature_enabled")
    def test_run_timeout(self, is_feature_enabled) -> None:
        params = {"database_id": 1, "sql": "SELECT 1", "template_params": {"temp": 123}}
        schema = EstimateQueryCostSchema()
        data: EstimateQueryCostSchema = schema.dump(params)
        command = estimate.QueryEstimationCommand(data)

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

        with (
            mock.patch("superset.commands.sql_lab.estimate.DatabaseDAO") as mock_dao,
            mock.patch("superset.security_manager.raise_for_access"),
        ):
            mock_dao.find_by_id.return_value = db_mock
            with pytest.raises(SupersetErrorException) as ex_info:
                command.run()
            assert (
                ex_info.value.error.error_type == SupersetErrorType.SQLLAB_TIMEOUT_ERROR
            )
            assert ex_info.value.error.message == __(
                "The query estimation was killed after %(sqllab_timeout)s seconds. It might "  # noqa: E501
                "be too complex, or the database might be under heavy load.",
                sqllab_timeout=current_app.config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"],
            )

    def test_run_success(self) -> None:
        params = {"database_id": 1, "sql": "SELECT 1"}
        schema = EstimateQueryCostSchema()
        data: EstimateQueryCostSchema = schema.dump(params)
        command = estimate.QueryEstimationCommand(data)

        payload = {"value": 100}

        db_mock = mock.Mock()
        db_mock.db_engine_spec = mock.Mock()
        db_mock.db_engine_spec.estimate_query_cost = mock.Mock(return_value=100)
        db_mock.db_engine_spec.query_cost_formatter = mock.Mock(return_value=payload)

        with (
            mock.patch("superset.commands.sql_lab.estimate.DatabaseDAO") as mock_dao,
            mock.patch("superset.security_manager.raise_for_access"),
        ):
            mock_dao.find_by_id.return_value = db_mock
            result = command.run()
            assert result == payload

    @patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True)
    def test_apply_sql_security_rls_does_not_pollute_session(
        self, mock_is_feature_enabled: Mock
    ) -> None:
        """Regression test for the RLS schema-resolution probe Query.

        ``_apply_sql_security`` builds a transient ``Query`` so the engine spec
        can resolve the effective per-query schema. Because the ``database``
        backref cascades ``all, delete-orphan``, that transient joins the
        session; if it isn't expunged, the very next ``apply_rls`` call issues
        its own ``db.session`` query, autoflush fires, and the probe — whose
        ``client_id`` column is ``nullable=False`` — raises ``IntegrityError``.
        A mocked session (as in the unit tests) hides this entirely, so exercise
        the real session and real ``apply_rls`` here with ``RLS_IN_SQLLAB`` on.
        """
        database = get_example_database()
        params = {"database_id": database.id, "sql": "SELECT * FROM some_table"}
        schema = EstimateQueryCostSchema()
        data: EstimateQueryCostSchema = schema.dump(params)
        command = estimate.QueryEstimationCommand(data)
        command._database = database

        with override_user(self.get_user("admin")):
            # Must not raise IntegrityError from an autoflushed probe Query.
            command._apply_sql_security("SELECT * FROM some_table")

        # And no transient probe Query may be left pending in the session.
        assert not any(isinstance(obj, Query) for obj in db.session.new)


class TestSqlResultExportCommand(SupersetTestCase):
    @pytest.fixture
    def create_database_and_query(self):
        with self.create_app().app_context():
            database = get_example_database()
            query_obj = Query(
                client_id="test",
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
                results_key="abc_query",
            )

            db.session.add(query_obj)
            db.session.commit()

            yield

            db.session.delete(query_obj)
            db.session.commit()

    @pytest.mark.usefixtures("create_database_and_query")
    def test_validation_query_not_found(self) -> None:
        command = export.SqlResultExportCommand("asdf")

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    @pytest.mark.usefixtures("create_database_and_query")
    def test_validation_invalid_access(self) -> None:
        command = export.SqlResultExportCommand("test")

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

    @pytest.mark.usefixtures("create_database_and_query")
    def test_validation_malformed_jinja(self) -> None:
        command = export.SqlResultExportCommand("test")

        with mock.patch(
            "superset.models.sql_lab.Query.raise_for_access",
            side_effect=TemplateSyntaxError("unexpected end of template", lineno=1),
        ):
            with pytest.raises(SupersetErrorException) as ex_info:
                command.run()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.GENERIC_COMMAND_ERROR
            )
            assert ex_info.value.status == 400

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_select_sql(self, get_df_mock: Mock) -> None:
        command = export.SqlResultExportCommand("test")

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})
        result = command.run()

        assert result["data"] == b"\xef\xbb\xbffoo\n1\n2\n3\n"
        assert result["count"] == 3
        assert result["query"].client_id == "test"

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_executed_sql(self, get_df_mock: Mock) -> None:
        query_obj = db.session.query(Query).filter_by(client_id="test").one()
        query_obj.executed_sql = "select * from bar limit 2"
        query_obj.select_sql = None
        db.session.commit()

        command = export.SqlResultExportCommand("test")

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})
        result = command.run()

        assert result["data"] == b"\xef\xbb\xbffoo\n1\n2\n"
        assert result["count"] == 2
        assert result["query"].client_id == "test"

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.models.core.Database.get_df")
    def test_run_no_results_backend_executed_sql_limiting_factor(
        self, get_df_mock: Mock
    ) -> None:
        query_obj = db.session.query(Query).filter_by(results_key="abc_query").one()
        query_obj.executed_sql = "select * from bar limit 2"
        query_obj.select_sql = None
        query_obj.limiting_factor = LimitingFactor.DROPDOWN
        db.session.commit()

        command = export.SqlResultExportCommand("test")

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})

        result = command.run()

        assert result["data"] == b"\xef\xbb\xbffoo\n1\n"
        assert result["count"] == 1
        assert result["query"].client_id == "test"

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @patch("superset.commands.sql_lab.export.results_backend_use_msgpack", False)
    def test_run_with_results_backend(self) -> None:
        command = export.SqlResultExportCommand("test")

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

        assert result["data"] == b"\xef\xbb\xbffoo\n0\n1\n2\n3\n4\n"
        assert result["count"] == 5
        assert result["query"].client_id == "test"


class TestSqlExecutionResultsCommand(SupersetTestCase):
    @pytest.fixture
    def create_database_and_query(self):
        with self.create_app().app_context():
            database = get_example_database()
            admin = self.get_user("admin")
            query_obj = Query(
                client_id="test",
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
                results_key="abc_query",
                user_id=admin.id,
            )

            db.session.add(query_obj)
            db.session.commit()

            yield

            db.session.delete(query_obj)
            db.session.commit()

    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    @patch("superset.commands.sql_lab.results.results_backend", None)
    def test_validation_no_results_backend(self) -> None:
        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert (
            ex_info.value.error.error_type
            == SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR
        )

    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_validation_data_cannot_be_retrieved(self) -> None:
        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = None

        command = results.SqlExecutionResultsCommand("test", 1000)

        with pytest.raises(SupersetErrorException) as ex_info:
            command.run()
        assert ex_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR

    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
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

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
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

        with mock.patch(
            "superset.views.utils._deserialize_results_payload",
            side_effect=SerializationError(),
        ):
            with pytest.raises(SupersetErrorException) as ex_info:  # noqa: PT012
                command = results.SqlExecutionResultsCommand("test_other", 1000)
                command.run()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.RESULTS_BACKEND_ERROR
            )

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_validation_unauthorized_access(self) -> None:
        command = results.SqlExecutionResultsCommand("abc_query", 1000)

        with mock.patch(
            "superset.models.sql_lab.Query.raise_for_access",
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
            assert ex_info.value.status == 403

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_validation_malformed_jinja(self) -> None:
        # ``raise_for_access`` re-parses the query's unrendered Jinja via
        # ``process_jinja_sql`` and can raise a raw ``TemplateError`` (e.g. an
        # unclosed ``{% if %}``). ``TemplateSyntaxError`` is a subclass of
        # ``TemplateError``. It must surface as a 400, not an opaque 500.
        assert issubclass(TemplateSyntaxError, TemplateError)

        command = results.SqlExecutionResultsCommand("abc_query", 1000)

        with mock.patch(
            "superset.models.sql_lab.Query.raise_for_access",
            side_effect=TemplateSyntaxError("unexpected end of template", lineno=1),
        ):
            with pytest.raises(SupersetErrorException) as ex_info:
                command.run()
            assert (
                ex_info.value.error.error_type
                == SupersetErrorType.GENERIC_COMMAND_ERROR
            )
            assert ex_info.value.status == 400

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_validation_releases_db_connection_before_fetching_from_results_backend(
        self,
    ) -> None:
        # The DB connection must be released back to the pool (via
        # warm_and_release_connection(), not a full session close -- see
        # ``test_validation_warms_database_relationship_before_releasing_connection``
        # for why) before the (potentially slow) results-backend fetch, so a
        # large download doesn't hold a connection out of the pool for its
        # duration.
        #
        # This spies on ``warm_and_release_connection`` itself rather than on
        # ``db.session.commit`` -- the latter is a ``scoped_session`` proxy
        # method, and patching it wouldn't be observed by the real
        # ``Session`` object that ``warm_and_release_connection`` commits
        # (see the fix for the analogous ``expire_on_commit`` proxy pitfall).
        call_order: list[str] = []
        original_warm_and_release_connection = results.warm_and_release_connection

        def tracked_warm_and_release_connection(
            instance: Any, *relationships: str
        ) -> None:
            call_order.append("connection_released")
            original_warm_and_release_connection(instance, *relationships)

        def tracked_get(key: str) -> None:
            call_order.append("results_backend_get")
            return None

        results.results_backend = mock.Mock()
        results.results_backend.get.side_effect = tracked_get

        command = results.SqlExecutionResultsCommand("abc_query", 1000)

        admin = self.get_user("admin")
        with current_app.test_request_context():
            with override_user(admin):
                with mock.patch(
                    "superset.commands.sql_lab.results.warm_and_release_connection",
                    side_effect=tracked_warm_and_release_connection,
                ):
                    with pytest.raises(SupersetErrorException):
                        # ``get`` returns ``None`` above, so validation goes
                        # on to raise the "results missing" (410) error --
                        # irrelevant here, we only care about the call order
                        # leading up to it.
                        command.validate()

        assert call_order == ["connection_released", "results_backend_get"]

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_validation_warms_database_relationship_before_releasing_connection(
        self,
    ) -> None:
        # ``run`` needs ``self._query.database.db_engine_spec`` after the
        # connection has been released by ``validate``. The relationship
        # must therefore already be loaded by then, and the query must stay
        # attached to the session (unlike a full ``db.session.close()``,
        # which would detach every object in the session -- including
        # ``g.user`` -- not just the query), or accessing it later would
        # either raise (detached instance with an unloaded attribute) or
        # silently open a fresh, unwanted connection.
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

        command = results.SqlExecutionResultsCommand("abc_query", 1000)

        admin = self.get_user("admin")
        with current_app.test_request_context():
            with override_user(admin):
                command.validate()

        assert object_session(command._query) is not None
        assert "database" not in sa_inspect(command._query).unloaded
        assert command._query.database is not None

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
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

        admin = self.get_user("admin")
        with current_app.test_request_context():
            with override_user(admin):
                command = results.SqlExecutionResultsCommand("abc_query", 1000)
                result = command.run()

        assert result.get("status") == "success"
        assert result["query"].get("rows") == 104

    @pytest.mark.usefixtures("create_database_and_query")
    @patch("superset.commands.sql_lab.results.results_backend_use_msgpack", True)
    def test_run_succeeds_with_msgpack(self) -> None:
        # ``query.database.db_engine_spec`` is only touched in the
        # ``use_msgpack=True`` branch of ``_deserialize_results_payload`` --
        # which is the production default. All the other tests here run
        # with msgpack off, so this exercises the full ``run()`` path with
        # msgpack on, to catch a regression that leaves ``query.database``
        # unloaded or detached after ``validate()`` releases the connection.
        cursor_descr = (
            ("a", "string", None, None, None, None, True),
            ("b", "int", None, None, None, None, True),
            ("c", "float", None, None, None, None, True),
        )
        result_set = SupersetResultSet(
            [("a", 4, 4.0)],
            cursor_descr,
            BaseEngineSpec,
        )
        (
            serialized_data,
            selected_columns,
            all_columns,
            expanded_columns,
        ) = sql_lab._serialize_and_expand_data(result_set, BaseEngineSpec(), True)
        payload = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 1},
            "data": serialized_data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
        }
        serialized_payload = sql_lab._serialize_payload(payload, True)
        compressed = utils.zlib_compress(serialized_payload)

        results.results_backend = mock.Mock()
        results.results_backend.get.return_value = compressed

        admin = self.get_user("admin")
        with current_app.test_request_context():
            with override_user(admin):
                command = results.SqlExecutionResultsCommand("abc_query", 1000)
                result = command.run()

        assert result.get("status") == "success"
        assert result["data"]
