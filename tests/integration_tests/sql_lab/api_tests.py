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
"""Unit tests for Superset"""

import datetime
import random
import csv
import pandas as pd
import io

import pytest
import prison
from sqlalchemy.sql import func  # noqa: F401
from unittest import mock

from flask_appbuilder.security.sqla.models import Role
from tests.integration_tests.test_app import app
from superset import db, sql_lab
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database  # noqa: F401
from superset.utils.database import get_example_database, get_main_database  # noqa: F401
from superset.utils import core as utils, json
from superset.models.sql_lab import Query

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    GAMMA_SQLLAB_NO_DATA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import load_birth_names_data  # noqa: F401
from tests.integration_tests.fixtures.users import create_gamma_sqllab_no_data  # noqa: F401

QUERIES_FIXTURE_COUNT = 10


class TestSqlLabApi(SupersetTestCase):
    @pytest.mark.usefixtures("create_gamma_sqllab_no_data")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": False},
        clear=True,
    )
    def test_get_from_empty_bootsrap_data(self):
        if utils.backend() == "postgresql":
            # failing
            return

        self.login(GAMMA_SQLLAB_NO_DATA_USERNAME)
        resp = self.client.get("/api/v1/sqllab/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        result = data.get("result")
        assert result["active_tab"] is None  # noqa: E711
        assert result["tab_state_ids"] == []
        self.assertEqual(len(result["databases"]), 0)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": False},
        clear=True,
    )
    def test_get_from_bootstrap_data_for_non_persisted_tab_state(self):
        self.login(ADMIN_USERNAME)
        # create a tab
        data = {
            "queryEditor": json.dumps(
                {
                    "title": "Untitled Query 1",
                    "dbId": 1,
                    "schema": None,
                    "autorun": False,
                    "sql": "SELECT ...",
                    "queryLimit": 1000,
                }
            )
        }
        self.get_json_resp("/tabstateview/", data=data)
        resp = self.client.get("/api/v1/sqllab/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        result = data.get("result")
        assert result["active_tab"] is None  # noqa: E711
        assert result["tab_state_ids"] == []

    @pytest.mark.usefixtures("load_birth_names_data")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": True},
        clear=True,
    )
    def test_get_from_bootstrap_data_with_latest_query(self):
        self.login(ADMIN_USERNAME)

        # create a tab
        data = {
            "queryEditor": json.dumps(
                {
                    "title": "Untitled Query 1",
                    "dbId": 1,
                    "schema": None,
                    "autorun": False,
                    "sql": "SELECT ...",
                    "queryLimit": 1000,
                }
            )
        }
        resp = self.get_json_resp("/tabstateview/", data=data)
        tab_state_id = resp["id"]

        # we should have only 1 query returned, since the second one is not
        # associated with any tabs
        resp = self.get_json_resp("/api/v1/sqllab/")
        result = resp["result"]
        self.assertEqual(result["active_tab"]["id"], tab_state_id)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": True},
        clear=True,
    )
    def test_deleted_tab(self):
        username = "admin"
        self.login(username)
        data = {
            "queryEditor": json.dumps(
                {
                    "title": "Untitled Query 2",
                    "dbId": 1,
                    "schema": None,
                    "autorun": False,
                    "sql": "SELECT ...",
                    "queryLimit": 1000,
                }
            )
        }
        resp = self.get_json_resp("/tabstateview/", data=data)
        tab_state_id = resp["id"]
        resp = self.client.delete("/tabstateview/" + str(tab_state_id))
        assert resp.status_code == 200
        resp = self.client.get("/tabstateview/" + str(tab_state_id))
        assert resp.status_code == 404
        resp = self.client.put(
            "/tabstateview/" + str(tab_state_id),
            json=data,
        )
        assert resp.status_code == 404

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": True},
        clear=True,
    )
    def test_delete_tab_already_removed(self):
        username = "admin"
        self.login(username)
        data = {
            "queryEditor": json.dumps(
                {
                    "title": "Untitled Query 3",
                    "dbId": 1,
                    "schema": None,
                    "autorun": False,
                    "sql": "SELECT ...",
                    "queryLimit": 1000,
                }
            )
        }
        resp = self.get_json_resp("/tabstateview/", data=data)
        tab_state_id = resp["id"]
        resp = self.client.delete("/tabstateview/" + str(tab_state_id))
        assert resp.status_code == 200
        resp = self.client.delete("/tabstateview/" + str(tab_state_id))
        assert resp.status_code == 404

    def test_get_access_denied(self):
        new_role = Role(name="Dummy Role", permissions=[])
        db.session.add(new_role)
        db.session.commit()
        unauth_user = self.create_user(
            "unauth_user1",
            "password",
            "Dummy Role",
            email="unauth_user1@superset.org",  # noqa: F541
        )
        self.login(username="unauth_user1", password="password")
        rv = self.client.get("/api/v1/sqllab/")

        assert rv.status_code == 403

        db.session.delete(unauth_user)
        db.session.delete(new_role)
        db.session.commit()

    def test_estimate_required_params(self):
        self.login(ADMIN_USERNAME)

        rv = self.client.post(
            "/api/v1/sqllab/estimate/",
            json={},
        )
        failed_resp = {
            "message": {
                "sql": ["Missing data for required field."],
                "database_id": ["Missing data for required field."],
            }
        }
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

        data = {"sql": "SELECT 1"}
        rv = self.client.post(
            "/api/v1/sqllab/estimate/",
            json=data,
        )
        failed_resp = {"message": {"database_id": ["Missing data for required field."]}}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

        data = {"database_id": 1}
        rv = self.client.post(
            "/api/v1/sqllab/estimate/",
            json=data,
        )
        failed_resp = {"message": {"sql": ["Missing data for required field."]}}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

    def test_estimate_valid_request(self):
        self.login(ADMIN_USERNAME)

        formatter_response = [
            {
                "value": 100,
            }
        ]

        db_mock = mock.Mock()
        db_mock.db_engine_spec = mock.Mock()
        db_mock.db_engine_spec.estimate_query_cost = mock.Mock(return_value=100)
        db_mock.db_engine_spec.query_cost_formatter = mock.Mock(
            return_value=formatter_response
        )

        with mock.patch("superset.commands.sql_lab.estimate.db") as mock_superset_db:
            mock_superset_db.session.query().get.return_value = db_mock

            data = {"database_id": 1, "sql": "SELECT 1"}
            rv = self.client.post(
                "/api/v1/sqllab/estimate/",
                json=data,
            )

        success_resp = {"result": formatter_response}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, success_resp)
        self.assertEqual(rv.status_code, 200)

    def test_format_sql_request(self):
        self.login(ADMIN_USERNAME)

        data = {"sql": "select 1 from my_table"}
        rv = self.client.post(
            "/api/v1/sqllab/format_sql/",
            json=data,
        )
        success_resp = {"result": "SELECT 1\nFROM my_table"}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, success_resp)
        self.assertEqual(rv.status_code, 200)

    @mock.patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_execute_required_params(self):
        self.login(ADMIN_USERNAME)
        client_id = f"{random.getrandbits(64)}"[:10]

        data = {"client_id": client_id}
        rv = self.client.post(
            "/api/v1/sqllab/execute/",
            json=data,
        )
        failed_resp = {
            "message": {
                "sql": ["Missing data for required field."],
                "database_id": ["Missing data for required field."],
            }
        }
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

        data = {"sql": "SELECT 1", "client_id": client_id}
        rv = self.client.post(
            "/api/v1/sqllab/execute/",
            json=data,
        )
        failed_resp = {"message": {"database_id": ["Missing data for required field."]}}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

        data = {"database_id": 1, "client_id": client_id}
        rv = self.client.post(
            "/api/v1/sqllab/execute/",
            json=data,
        )
        failed_resp = {"message": {"sql": ["Missing data for required field."]}}
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertDictEqual(resp_data, failed_resp)
        self.assertEqual(rv.status_code, 400)

    @mock.patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_execute_valid_request(self) -> None:
        from superset import sql_lab as core

        core.results_backend = mock.Mock()
        core.results_backend.get.return_value = {}

        self.login(ADMIN_USERNAME)
        client_id = f"{random.getrandbits(64)}"[:10]

        data = {"sql": "SELECT 1", "database_id": 1, "client_id": client_id}
        rv = self.client.post(
            "/api/v1/sqllab/execute/",
            json=data,
        )
        resp_data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(resp_data.get("status"), "success")
        self.assertEqual(rv.status_code, 200)

    @mock.patch(
        "tests.integration_tests.superset_test_custom_template_processors.datetime"
    )
    @mock.patch("superset.sqllab.api.get_sql_results")
    def test_execute_custom_templated(self, sql_lab_mock, mock_dt) -> None:
        mock_dt.utcnow = mock.Mock(return_value=datetime.datetime(1970, 1, 1))
        self.login(ADMIN_USERNAME)
        sql = "SELECT '$DATE()' as test"
        resp = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 1},
            "data": [{"test": "'1970-01-01'"}],
        }
        sql_lab_mock.return_value = resp

        dbobj = self.create_fake_db_for_macros()
        json_payload = dict(database_id=dbobj.id, sql=sql)
        self.get_json_resp(
            "/api/v1/sqllab/execute/", raise_on_error=False, json_=json_payload
        )
        assert sql_lab_mock.called
        self.assertEqual(sql_lab_mock.call_args[0][1], "SELECT '1970-01-01' as test")

        self.delete_fake_db_for_macros()

    @mock.patch("superset.commands.sql_lab.results.results_backend_use_msgpack", False)
    def test_get_results_with_display_limit(self):
        from superset.commands.sql_lab import results as command

        command.results_backend = mock.Mock()
        self.login(ADMIN_USERNAME)

        data = [{"col_0": i} for i in range(100)]
        payload = {
            "status": QueryStatus.SUCCESS,
            "query": {"rows": 100},
            "data": data,
        }
        # limit results to 1
        expected_key = {"status": "success", "query": {"rows": 100}, "data": data}
        limited_data = data[:1]
        expected_limited = {
            "status": "success",
            "query": {"rows": 100},
            "data": limited_data,
            "displayLimitReached": True,
        }

        query_mock = mock.Mock()
        query_mock.sql = "SELECT *"
        query_mock.database = 1
        query_mock.schema = "superset"

        # do not apply msgpack serialization
        use_msgpack = app.config["RESULTS_BACKEND_USE_MSGPACK"]
        app.config["RESULTS_BACKEND_USE_MSGPACK"] = False
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)
        command.results_backend.get.return_value = compressed

        with mock.patch("superset.commands.sql_lab.results.db") as mock_superset_db:
            mock_superset_db.session.query().filter_by().one_or_none.return_value = (
                query_mock
            )
            # get all results
            arguments = {"key": "key"}
            result_key = json.loads(
                self.get_resp(f"/api/v1/sqllab/results/?q={prison.dumps(arguments)}")
            )
            arguments = {"key": "key", "rows": 1}
            result_limited = json.loads(
                self.get_resp(f"/api/v1/sqllab/results/?q={prison.dumps(arguments)}")
            )

        self.assertEqual(result_key, expected_key)
        self.assertEqual(result_limited, expected_limited)

        app.config["RESULTS_BACKEND_USE_MSGPACK"] = use_msgpack

    @mock.patch("superset.models.sql_lab.Query.raise_for_access", lambda _: None)
    @mock.patch("superset.models.core.Database.get_df")
    def test_export_results(self, get_df_mock: mock.Mock) -> None:
        self.login(ADMIN_USERNAME)

        database = get_example_database()
        query_obj = Query(
            client_id="test",
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
            results_key="test_abc",
        )

        db.session.add(query_obj)
        db.session.commit()

        get_df_mock.return_value = pd.DataFrame({"foo": [1, 2, 3]})

        resp = self.get_resp("/api/v1/sqllab/export/test/")
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(io.StringIO("foo\n1\n2"))

        self.assertEqual(list(expected_data), list(data))
        db.session.delete(query_obj)
        db.session.commit()
