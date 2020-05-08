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
"""Unit tests for Sql Lab"""
import json
from datetime import datetime, timedelta
from random import random
from unittest import mock

import prison

import tests.test_app
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs import BaseEngineSpec
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.utils.core import datetime_to_epoch, get_example_database

from .base_tests import SupersetTestCase

QUERY_1 = "SELECT * FROM birth_names LIMIT 1"
QUERY_2 = "SELECT * FROM NO_TABLE"
QUERY_3 = "SELECT * FROM birth_names LIMIT 10"


class SqlLabTests(SupersetTestCase):
    """Testings for Sql Lab"""

    def __init__(self, *args, **kwargs):
        super(SqlLabTests, self).__init__(*args, **kwargs)

    def run_some_queries(self):
        db.session.query(Query).delete()
        db.session.commit()
        self.run_sql(QUERY_1, client_id="client_id_1", user_name="admin")
        self.run_sql(QUERY_2, client_id="client_id_3", user_name="admin")
        self.run_sql(QUERY_3, client_id="client_id_2", user_name="gamma_sqllab")
        self.logout()

    def tearDown(self):
        self.logout()
        db.session.query(Query).delete()
        db.session.commit()
        db.session.close()

    def test_sql_json(self):
        self.login("admin")

        data = self.run_sql("SELECT * FROM birth_names LIMIT 10", "1")
        self.assertLess(0, len(data["data"]))

        data = self.run_sql("SELECT * FROM unexistant_table", "2")
        self.assertLess(0, len(data["error"]))

    @mock.patch(
        "superset.views.core.get_cta_schema_name",
        lambda d, u, s, sql: f"{u.username}_database",
    )
    def test_sql_json_cta_dynamic_db(self):
        main_db = get_example_database()
        if main_db.backend == "sqlite":
            # sqlite doesn't support database creation
            return

        old_allow_ctas = main_db.allow_ctas
        main_db.allow_ctas = True  # enable cta

        self.login("admin")
        self.run_sql(
            "SELECT * FROM birth_names",
            "1",
            database_name="examples",
            tmp_table_name="test_target",
            select_as_cta=True,
        )

        # assertions
        data = db.session.execute("SELECT * FROM admin_database.test_target").fetchall()
        self.assertEqual(
            75691, len(data)
        )  # SQL_MAX_ROW not applied due to the SQLLAB_CTAS_NO_LIMIT set to True

        # cleanup
        db.session.execute("DROP TABLE admin_database.test_target")
        main_db.allow_ctas = old_allow_ctas
        db.session.commit()

    def test_multi_sql(self):
        self.login("admin")

        multi_sql = """
        SELECT * FROM birth_names LIMIT 1;
        SELECT * FROM birth_names LIMIT 2;
        """
        data = self.run_sql(multi_sql, "2234")
        self.assertLess(0, len(data["data"]))

    def test_explain(self):
        self.login("admin")

        data = self.run_sql("EXPLAIN SELECT * FROM birth_names", "1")
        self.assertLess(0, len(data["data"]))

    def test_sql_json_has_access(self):
        examples_db = get_example_database()
        examples_db_permission_view = security_manager.add_permission_view_menu(
            "database_access", examples_db.perm
        )
        astronaut = security_manager.add_role("ExampleDBAccess")
        security_manager.add_permission_role(astronaut, examples_db_permission_view)
        # Gamma user, with sqllab and db permission
        self.create_user_with_roles("Gagarin", ["ExampleDBAccess", "Gamma", "sql_lab"])

        data = self.run_sql(QUERY_1, "1", user_name="Gagarin")
        db.session.query(Query).delete()
        db.session.commit()
        self.assertLess(0, len(data["data"]))

    def test_sql_json_schema_access(self):
        examples_db = get_example_database()
        db_backend = examples_db.backend
        if db_backend == "sqlite":
            # sqlite doesn't support database creation
            return

        sqllab_test_db_schema_permission_view = security_manager.add_permission_view_menu(
            "schema_access", f"[{examples_db.name}].[sqllab_test_db]"
        )
        schema_perm_role = security_manager.add_role("SchemaPermission")
        security_manager.add_permission_role(
            schema_perm_role, sqllab_test_db_schema_permission_view
        )
        self.create_user_with_roles(
            "SchemaUser", ["SchemaPermission", "Gamma", "sql_lab"]
        )

        db.session.execute(
            "CREATE TABLE IF NOT EXISTS sqllab_test_db.test_table AS SELECT 1 as c1, 2 as c2"
        )

        data = self.run_sql(
            "SELECT * FROM sqllab_test_db.test_table", "3", user_name="SchemaUser"
        )
        self.assertEqual(1, len(data["data"]))

        data = self.run_sql(
            "SELECT * FROM sqllab_test_db.test_table",
            "4",
            user_name="SchemaUser",
            schema="sqllab_test_db",
        )
        self.assertEqual(1, len(data["data"]))

        # postgres needs a schema as a part of the table name.
        if db_backend == "mysql":
            data = self.run_sql(
                "SELECT * FROM test_table",
                "5",
                user_name="SchemaUser",
                schema="sqllab_test_db",
            )
            self.assertEqual(1, len(data["data"]))

        db.session.query(Query).delete()
        db.session.execute("DROP TABLE IF EXISTS sqllab_test_db.test_table")
        db.session.commit()

    def test_queries_endpoint(self):
        self.run_some_queries()

        # Not logged in, should error out
        resp = self.client.get("/superset/queries/0")
        # Redirects to the login page
        self.assertEqual(403, resp.status_code)

        # Admin sees queries
        self.login("admin")
        data = self.get_json_resp("/superset/queries/0")
        self.assertEqual(2, len(data))

        # Run 2 more queries
        self.run_sql("SELECT * FROM birth_names LIMIT 1", client_id="client_id_4")
        self.run_sql("SELECT * FROM birth_names LIMIT 2", client_id="client_id_5")
        self.login("admin")
        data = self.get_json_resp("/superset/queries/0")
        self.assertEqual(4, len(data))

        now = datetime.now() + timedelta(days=1)
        query = (
            db.session.query(Query)
            .filter_by(sql="SELECT * FROM birth_names LIMIT 1")
            .first()
        )
        query.changed_on = now
        db.session.commit()

        data = self.get_json_resp(
            "/superset/queries/{}".format(int(datetime_to_epoch(now)) - 1000)
        )
        self.assertEqual(1, len(data))

        self.logout()
        resp = self.client.get("/superset/queries/0")
        # Redirects to the login page
        self.assertEqual(403, resp.status_code)

    def test_search_query_on_db_id(self):
        self.run_some_queries()
        self.login("admin")
        examples_dbid = get_example_database().id

        # Test search queries on database Id
        data = self.get_json_resp(
            f"/superset/search_queries?database_id={examples_dbid}"
        )
        self.assertEqual(3, len(data))
        db_ids = [k["dbId"] for k in data]
        self.assertEqual([examples_dbid for i in range(3)], db_ids)

        resp = self.get_resp("/superset/search_queries?database_id=-1")
        data = json.loads(resp)
        self.assertEqual(0, len(data))

    def test_search_query_on_user(self):
        self.run_some_queries()
        self.login("admin")

        # Test search queries on user Id
        user_id = security_manager.find_user("admin").id
        data = self.get_json_resp("/superset/search_queries?user_id={}".format(user_id))
        self.assertEqual(2, len(data))
        user_ids = {k["userId"] for k in data}
        self.assertEqual(set([user_id]), user_ids)

        user_id = security_manager.find_user("gamma_sqllab").id
        resp = self.get_resp("/superset/search_queries?user_id={}".format(user_id))
        data = json.loads(resp)
        self.assertEqual(1, len(data))
        self.assertEqual(data[0]["userId"], user_id)

    def test_search_query_on_status(self):
        self.run_some_queries()
        self.login("admin")
        # Test search queries on status
        resp = self.get_resp("/superset/search_queries?status=success")
        data = json.loads(resp)
        self.assertEqual(2, len(data))
        states = [k["state"] for k in data]
        self.assertEqual(["success", "success"], states)

        resp = self.get_resp("/superset/search_queries?status=failed")
        data = json.loads(resp)
        self.assertEqual(1, len(data))
        self.assertEqual(data[0]["state"], "failed")

    def test_search_query_on_text(self):
        self.run_some_queries()
        self.login("admin")
        url = "/superset/search_queries?search_text=birth"
        data = self.get_json_resp(url)
        self.assertEqual(2, len(data))
        self.assertIn("birth", data[0]["sql"])

    def test_search_query_on_time(self):
        self.run_some_queries()
        self.login("admin")
        first_query_time = (
            db.session.query(Query).filter_by(sql=QUERY_1).one()
        ).start_time
        second_query_time = (
            db.session.query(Query).filter_by(sql=QUERY_3).one()
        ).start_time
        # Test search queries on time filter
        from_time = "from={}".format(int(first_query_time))
        to_time = "to={}".format(int(second_query_time))
        params = [from_time, to_time]
        resp = self.get_resp("/superset/search_queries?" + "&".join(params))
        data = json.loads(resp)
        self.assertEqual(2, len(data))

    def test_search_query_only_owned(self) -> None:
        """
        Test a search query with a user that does not have can_access_all_queries.
        """
        # Test search_queries for Alpha user
        self.run_some_queries()
        self.login("gamma_sqllab")

        user_id = security_manager.find_user("gamma_sqllab").id
        data = self.get_json_resp("/superset/search_queries")

        self.assertEqual(1, len(data))
        user_ids = {k["userId"] for k in data}
        self.assertEqual(set([user_id]), user_ids)

    def test_alias_duplicate(self):
        self.run_sql(
            "SELECT name as col, gender as col FROM birth_names LIMIT 10",
            client_id="2e2df3",
            user_name="admin",
            raise_on_error=True,
        )

    def test_ps_conversion_no_dict(self):
        cols = [["string_col", "string"], ["int_col", "int"], ["float_col", "float"]]
        data = [["a", 4, 4.0]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_pa_conversion_tuple(self):
        cols = ["string_col", "int_col", "list_col", "float_col"]
        data = [("Text", 111, [123], 1.0)]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_pa_conversion_dict(self):
        cols = ["string_col", "dict_col", "int_col"]
        data = [["a", {"c1": 1, "c2": 2, "c3": 3}, 4]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_sqllab_viz(self):
        self.login("admin")
        examples_dbid = get_example_database().id
        payload = {
            "chartType": "dist_bar",
            "datasourceName": f"test_viz_flow_table_{random()}",
            "schema": "superset",
            "columns": [
                {"is_date": False, "type": "STRING", "name": f"viz_type_{random()}"},
                {"is_date": False, "type": "OBJECT", "name": f"ccount_{random()}"},
            ],
            "sql": """\
                SELECT *
                FROM birth_names
                LIMIT 10""",
            "dbId": examples_dbid,
        }
        data = {"data": json.dumps(payload)}
        resp = self.get_json_resp("/superset/sqllab_viz/", data=data)
        self.assertIn("table_id", resp)

        # ensure owner is set correctly
        table_id = resp["table_id"]
        table = db.session.query(SqlaTable).filter_by(id=table_id).one()
        self.assertEqual([owner.username for owner in table.owners], ["admin"])

    def test_sqllab_table_viz(self):
        self.login("admin")
        examples_dbid = get_example_database().id
        payload = {"datasourceName": "ab_role", "columns": [], "dbId": examples_dbid}

        data = {"data": json.dumps(payload)}
        resp = self.get_json_resp("/superset/get_or_create_table/", data=data)
        self.assertIn("table_id", resp)

        # ensure owner is set correctly
        table_id = resp["table_id"]
        table = db.session.query(SqlaTable).filter_by(id=table_id).one()
        self.assertEqual([owner.username for owner in table.owners], ["admin"])
        db.session.delete(table)
        db.session.commit()

    def test_sql_limit(self):
        self.login("admin")
        test_limit = 1
        data = self.run_sql("SELECT * FROM birth_names", client_id="sql_limit_1")
        self.assertGreater(len(data["data"]), test_limit)
        data = self.run_sql(
            "SELECT * FROM birth_names", client_id="sql_limit_2", query_limit=test_limit
        )
        self.assertEqual(len(data["data"]), test_limit)
        data = self.run_sql(
            "SELECT * FROM birth_names LIMIT {}".format(test_limit),
            client_id="sql_limit_3",
            query_limit=test_limit + 1,
        )
        self.assertEqual(len(data["data"]), test_limit)
        data = self.run_sql(
            "SELECT * FROM birth_names LIMIT {}".format(test_limit + 1),
            client_id="sql_limit_4",
            query_limit=test_limit,
        )
        self.assertEqual(len(data["data"]), test_limit)

    def test_queryview_filter(self) -> None:
        """
        Test queryview api without can_only_access_owned_queries perm added to
        Admin and make sure all queries show up.
        """
        self.run_some_queries()
        self.login(username="admin")

        url = "/queryview/api/read"
        data = self.get_json_resp(url)
        admin = security_manager.find_user("admin")
        gamma_sqllab = security_manager.find_user("gamma_sqllab")
        self.assertEqual(3, len(data["result"]))
        user_queries = [result.get("username") for result in data["result"]]
        assert admin.username in user_queries
        assert gamma_sqllab.username in user_queries

    def test_queryview_can_access_all_queries(self) -> None:
        """
        Test queryview api with can_access_all_queries perm added to
        gamma and make sure all queries show up.
        """
        session = db.session

        # Add all_query_access perm to Gamma user
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )

        security_manager.add_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )
        session.commit()

        # Test search_queries for Admin user
        self.run_some_queries()
        self.login("gamma_sqllab")
        url = "/queryview/api/read"
        data = self.get_json_resp(url)
        self.assertEqual(3, len(data["result"]))

        # Remove all_query_access from gamma sqllab
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )
        security_manager.del_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )

        session.commit()

    def test_queryview_admin_can_access_all_queries(self) -> None:
        """
        Test queryview api with all_query_access perm added to
        Admin and make sure only Admin queries show up. This is the default
        """
        # Test search_queries for Admin user
        self.run_some_queries()
        self.login("admin")

        url = "/queryview/api/read"
        data = self.get_json_resp(url)
        admin = security_manager.find_user("admin")
        self.assertEqual(3, len(data["result"]))

    def test_api_database(self):
        self.login("admin")
        self.create_fake_db()

        arguments = {
            "keys": [],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_column": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        url = f"api/v1/database/?q={prison.dumps(arguments)}"
        self.assertEqual(
            {"examples", "fake_db_100"},
            {r.get("database_name") for r in self.get_json_resp(url)["result"]},
        )
        self.delete_fake_db()
