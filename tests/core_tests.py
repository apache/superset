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
"""Unit tests for Superset"""
import cgi
import csv
import datetime
import doctest
import io
import json
import logging
import os
import random
import re
import string
import unittest
from unittest import mock

import pandas as pd
import psycopg2
import sqlalchemy as sqla

from superset import app, dataframe, db, jinja_context, security_manager, sql_lab
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.models import core as models
from superset.models.sql_lab import Query
from superset.utils import core as utils
from superset.views import core as views
from superset.views.database.views import DatabaseView

from .base_tests import SupersetTestCase
from .fixtures.pyodbcRow import Row


class CoreTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(CoreTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        cls.table_ids = {
            tbl.table_name: tbl.id for tbl in (db.session.query(SqlaTable).all())
        }

    def setUp(self):
        db.session.query(Query).delete()
        db.session.query(models.DatasourceAccessRequest).delete()
        db.session.query(models.Log).delete()

    def tearDown(self):
        db.session.query(Query).delete()

    def test_login(self):
        resp = self.get_resp("/login/", data=dict(username="admin", password="general"))
        self.assertNotIn("User confirmation needed", resp)

        resp = self.get_resp("/logout/", follow_redirects=True)
        self.assertIn("User confirmation needed", resp)

        resp = self.get_resp(
            "/login/", data=dict(username="admin", password="wrongPassword")
        )
        self.assertIn("User confirmation needed", resp)

    def test_dashboard_endpoint(self):
        resp = self.client.get("/superset/dashboard/-1/")
        assert resp.status_code == 404

    def test_slice_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        resp = self.get_resp("/superset/slice/{}/".format(slc.id))
        assert "Time Column" in resp
        assert "List Roles" in resp

        # Testing overrides
        resp = self.get_resp("/superset/slice/{}/?standalone=true".format(slc.id))
        assert '<div class="navbar' not in resp

        resp = self.client.get("/superset/slice/-1/")
        assert resp.status_code == 404

    def test_cache_key(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        viz = slc.viz
        qobj = viz.query_obj()
        cache_key = viz.cache_key(qobj)
        self.assertEqual(cache_key, viz.cache_key(qobj))

        qobj["groupby"] = []
        self.assertNotEqual(cache_key, viz.cache_key(qobj))

    def test_api_v1_query_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girl Name Cloud", db.session)
        form_data = slc.form_data
        data = json.dumps(
            {
                "datasource": {"id": slc.datasource_id, "type": slc.datasource_type},
                "queries": [
                    {
                        "granularity": "ds",
                        "groupby": ["name"],
                        "metrics": ["sum__num"],
                        "filters": [],
                        "time_range": "{} : {}".format(
                            form_data.get("since"), form_data.get("until")
                        ),
                        "limit": 100,
                    }
                ],
            }
        )
        # TODO: update once get_data is implemented for QueryObject
        with self.assertRaises(Exception):
            self.get_resp("/api/v1/query/", {"query_context": data})

    def test_old_slice_json_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        json_endpoint = "/superset/explore_json/{}/{}/".format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_resp(
            json_endpoint, {"form_data": json.dumps(slc.viz.form_data)}
        )
        assert '"Jennifer"' in resp

    def test_slice_json_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        resp = self.get_resp(slc.explore_json_url)
        assert '"Jennifer"' in resp

    def test_old_slice_csv_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        csv_endpoint = "/superset/explore_json/{}/{}/?csv=true".format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_resp(csv_endpoint, {"form_data": json.dumps(slc.viz.form_data)})
        assert "Jennifer," in resp

    def test_slice_csv_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        csv_endpoint = "/superset/explore_json/?csv=true"
        resp = self.get_resp(
            csv_endpoint, {"form_data": json.dumps({"slice_id": slc.id})}
        )
        assert "Jennifer," in resp

    def test_admin_only_permissions(self):
        def assert_admin_permission_in(role_name, assert_func):
            role = security_manager.find_role(role_name)
            permissions = [p.permission.name for p in role.permissions]
            assert_func("can_sync_druid_source", permissions)
            assert_func("can_approve", permissions)

        assert_admin_permission_in("Admin", self.assertIn)
        assert_admin_permission_in("Alpha", self.assertNotIn)
        assert_admin_permission_in("Gamma", self.assertNotIn)

    def test_admin_only_menu_views(self):
        def assert_admin_view_menus_in(role_name, assert_func):
            role = security_manager.find_role(role_name)
            view_menus = [p.view_menu.name for p in role.permissions]
            assert_func("ResetPasswordView", view_menus)
            assert_func("RoleModelView", view_menus)
            assert_func("Security", view_menus)
            assert_func("SQL Lab", view_menus)

        assert_admin_view_menus_in("Admin", self.assertIn)
        assert_admin_view_menus_in("Alpha", self.assertNotIn)
        assert_admin_view_menus_in("Gamma", self.assertNotIn)

    def test_save_slice(self):
        self.login(username="admin")
        slice_name = "Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        copy_name = "Test Sankey Save"
        tbl_id = self.table_ids.get("energy_usage")
        new_slice_name = "Test Sankey Overwirte"

        url = (
            "/superset/explore/table/{}/?slice_name={}&"
            "action={}&datasource_name=energy_usage"
        )

        form_data = {
            "viz_type": "sankey",
            "groupby": "target",
            "metric": "sum__value",
            "row_limit": 5000,
            "slice_id": slice_id,
        }
        # Changing name and save as a new slice
        self.get_resp(
            url.format(tbl_id, copy_name, "saveas"),
            {"form_data": json.dumps(form_data)},
        )
        slices = db.session.query(models.Slice).filter_by(slice_name=copy_name).all()
        assert len(slices) == 1
        new_slice_id = slices[0].id

        form_data = {
            "viz_type": "sankey",
            "groupby": "source",
            "metric": "sum__value",
            "row_limit": 5000,
            "slice_id": new_slice_id,
            "time_range": "now",
        }
        # Setting the name back to its original name by overwriting new slice
        self.get_resp(
            url.format(tbl_id, new_slice_name, "overwrite"),
            {"form_data": json.dumps(form_data)},
        )
        slc = db.session.query(models.Slice).filter_by(id=new_slice_id).first()
        assert slc.slice_name == new_slice_name
        assert slc.viz.form_data == form_data
        db.session.delete(slc)

    def test_filter_endpoint(self):
        self.login(username="admin")
        slice_name = "Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        tbl_id = self.table_ids.get("energy_usage")
        table = db.session.query(SqlaTable).filter(SqlaTable.id == tbl_id)
        table.filter_select_enabled = True
        url = (
            "/superset/filter/table/{}/target/?viz_type=sankey&groupby=source"
            "&metric=sum__value&flt_col_0=source&flt_op_0=in&flt_eq_0=&"
            "slice_id={}&datasource_name=energy_usage&"
            "datasource_id=1&datasource_type=table"
        )

        # Changing name
        resp = self.get_resp(url.format(tbl_id, slice_id))
        assert len(resp) > 0
        assert "Carbon Dioxide" in resp

    def test_slice_data(self):
        # slice data should have some required attributes
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        slc_data_attributes = slc.data.keys()
        assert "changed_on" in slc_data_attributes
        assert "modified" in slc_data_attributes

    def test_slices(self):
        # Testing by hitting the two supported end points for all slices
        self.login(username="admin")
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, "explore", slc.slice_url),
                (slc.slice_name, "explore_json", slc.explore_json_url),
            ]
        for name, method, url in urls:
            logging.info(f"[{name}]/[{method}]: {url}")
            print(f"[{name}]/[{method}]: {url}")
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200)

    def test_tablemodelview_list(self):
        self.login(username="admin")

        url = "/tablemodelview/list/"
        resp = self.get_resp(url)

        # assert that a table is listed
        table = db.session.query(SqlaTable).first()
        assert table.name in resp
        assert "/superset/explore/table/{}".format(table.id) in resp

    def test_add_slice(self):
        self.login(username="admin")
        # assert that /chart/add responds with 200
        url = "/chart/add"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_get_user_slices(self):
        self.login(username="admin")
        userid = security_manager.find_user("admin").id
        url = "/sliceaddview/api/read?_flt_0_created_by={}".format(userid)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_slices_V2(self):
        # Add explore-v2-beta role to admin user
        # Test all slice urls as user with with explore-v2-beta role
        security_manager.add_role("explore-v2-beta")

        security_manager.add_user(
            "explore_beta",
            "explore_beta",
            " user",
            "explore_beta@airbnb.com",
            security_manager.find_role("explore-v2-beta"),
            password="general",
        )
        self.login(username="explore_beta", password="general")

        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [(slc.slice_name, "slice_url", slc.slice_url)]
        for name, method, url in urls:
            print(f"[{name}]/[{method}]: {url}")
            self.client.get(url)

    def test_doctests(self):
        modules = [utils, models, sql_lab]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.get_resp("/health") == "OK"
        assert self.get_resp("/healthcheck") == "OK"
        assert self.get_resp("/ping") == "OK"

    def test_testconn(self, username="admin"):
        self.login(username=username)
        database = utils.get_example_database()

        # validate that the endpoint works with the password-masked sqlalchemy uri
        data = json.dumps(
            {
                "uri": database.safe_sqlalchemy_uri(),
                "name": "examples",
                "impersonate_user": False,
            }
        )
        response = self.client.post(
            "/superset/testconn", data=data, content_type="application/json"
        )
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "application/json"

        # validate that the endpoint works with the decrypted sqlalchemy uri
        data = json.dumps(
            {
                "uri": database.sqlalchemy_uri_decrypted,
                "name": "examples",
                "impersonate_user": False,
            }
        )
        response = self.client.post(
            "/superset/testconn", data=data, content_type="application/json"
        )
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "application/json"

    def test_custom_password_store(self):
        database = utils.get_example_database()
        conn_pre = sqla.engine.url.make_url(database.sqlalchemy_uri_decrypted)

        def custom_password_store(uri):
            return "password_store_test"

        models.custom_password_store = custom_password_store
        conn = sqla.engine.url.make_url(database.sqlalchemy_uri_decrypted)
        if conn_pre.password:
            assert conn.password == "password_store_test"
            assert conn.password != conn_pre.password
        # Disable for password store for later tests
        models.custom_password_store = None

    def test_databaseview_edit(self, username="admin"):
        # validate that sending a password-masked uri does not over-write the decrypted
        # uri
        self.login(username=username)
        database = utils.get_example_database()
        sqlalchemy_uri_decrypted = database.sqlalchemy_uri_decrypted
        url = "databaseview/edit/{}".format(database.id)
        data = {k: database.__getattribute__(k) for k in DatabaseView.add_columns}
        data["sqlalchemy_uri"] = database.safe_sqlalchemy_uri()
        self.client.post(url, data=data)
        database = utils.get_example_database()
        self.assertEqual(sqlalchemy_uri_decrypted, database.sqlalchemy_uri_decrypted)

    def test_warm_up_cache(self):
        slc = self.get_slice("Girls", db.session)
        data = self.get_json_resp("/superset/warm_up_cache?slice_id={}".format(slc.id))
        assert data == [{"slice_id": slc.id, "slice_name": slc.slice_name}]

        data = self.get_json_resp(
            "/superset/warm_up_cache?table_name=energy_usage&db_name=main"
        )
        assert len(data) > 0

    def test_shortner(self):
        self.login(username="admin")
        data = (
            "//superset/explore/table/1/?viz_type=sankey&groupby=source&"
            "groupby=target&metric=sum__value&row_limit=5000&where=&having=&"
            "flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name="
            "Energy+Sankey&collapsed_fieldsets=&action=&datasource_name="
            "energy_usage&datasource_id=1&datasource_type=table&"
            "previous_viz_type=sankey"
        )
        resp = self.client.post("/r/shortner/", data=dict(data=data))
        assert re.search(r"\/r\/[0-9]+", resp.data.decode("utf-8"))

    def test_kv(self):
        self.logout()
        self.login(username="admin")

        try:
            resp = self.client.post("/kv/store/", data=dict())
        except Exception:
            self.assertRaises(TypeError)

        value = json.dumps({"data": "this is a test"})
        resp = self.client.post("/kv/store/", data=dict(data=value))
        self.assertEqual(resp.status_code, 200)
        kv = db.session.query(models.KeyValue).first()
        kv_value = kv.value
        self.assertEqual(json.loads(value), json.loads(kv_value))

        resp = self.client.get("/kv/{}/".format(kv.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(value), json.loads(resp.data.decode("utf-8")))

        try:
            resp = self.client.get("/kv/10001/")
        except Exception:
            self.assertRaises(TypeError)

    def test_gamma(self):
        self.login(username="gamma")
        assert "Charts" in self.get_resp("/chart/list/")
        assert "Dashboards" in self.get_resp("/dashboard/list/")

    def test_csv_endpoint(self):
        self.login("admin")
        sql = """
            SELECT name
            FROM birth_names
            WHERE name = 'James'
            LIMIT 1
        """
        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp("/superset/csv/{}".format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(io.StringIO("name\nJames\n"))

        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp("/superset/csv/{}".format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(io.StringIO("name\nJames\n"))

        self.assertEqual(list(expected_data), list(data))
        self.logout()

    def test_extra_table_metadata(self):
        self.login("admin")
        dbid = utils.get_example_database().id
        self.get_json_resp(
            f"/superset/extra_table_metadata/{dbid}/birth_names/superset/"
        )

    def test_process_template(self):
        maindb = utils.get_example_database()
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '2017-01-01T00:00:00'", rendered)

    def test_get_template_kwarg(self):
        maindb = utils.get_example_database()
        s = "{{ foo }}"
        tp = jinja_context.get_template_processor(database=maindb, foo="bar")
        rendered = tp.process_template(s)
        self.assertEqual("bar", rendered)

    def test_template_kwarg(self):
        maindb = utils.get_example_database()
        s = "{{ foo }}"
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(s, foo="bar")
        self.assertEqual("bar", rendered)

    def test_templated_sql_json(self):
        self.login("admin")
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}' as test"
        data = self.run_sql(sql, "fdaklj3ws")
        self.assertEqual(data["data"][0]["test"], "2017-01-01T00:00:00")

    def test_table_metadata(self):
        maindb = utils.get_example_database()
        data = self.get_json_resp(f"/superset/table/{maindb.id}/birth_names/null/")
        self.assertEqual(data["name"], "birth_names")
        assert len(data["columns"]) > 5
        assert data.get("selectStar").startswith("SELECT")

    def test_fetch_datasource_metadata(self):
        self.login(username="admin")
        url = "/superset/fetch_datasource_metadata?" "datasourceKey=1__table"
        resp = self.get_json_resp(url)
        keys = [
            "name",
            "type",
            "order_by_choices",
            "granularity_sqla",
            "time_grain_sqla",
            "id",
        ]
        for k in keys:
            self.assertIn(k, resp.keys())

    def test_user_profile(self, username="admin"):
        self.login(username=username)
        slc = self.get_slice("Girls", db.session)

        # Setting some faves
        url = "/superset/favstar/Slice/{}/select/".format(slc.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp["count"], 1)

        dash = db.session.query(models.Dashboard).filter_by(slug="births").first()
        url = "/superset/favstar/Dashboard/{}/select/".format(dash.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp["count"], 1)

        userid = security_manager.find_user("admin").id
        resp = self.get_resp("/superset/profile/admin/")
        self.assertIn('"app"', resp)
        data = self.get_json_resp("/superset/recent_activity/{}/".format(userid))
        self.assertNotIn("message", data)
        data = self.get_json_resp("/superset/created_slices/{}/".format(userid))
        self.assertNotIn("message", data)
        data = self.get_json_resp("/superset/created_dashboards/{}/".format(userid))
        self.assertNotIn("message", data)
        data = self.get_json_resp("/superset/fave_slices/{}/".format(userid))
        self.assertNotIn("message", data)
        data = self.get_json_resp("/superset/fave_dashboards/{}/".format(userid))
        self.assertNotIn("message", data)
        data = self.get_json_resp(
            "/superset/fave_dashboards_by_username/{}/".format(username)
        )
        self.assertNotIn("message", data)

    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # superset/explore case
        slc = db.session.query(models.Slice).filter_by(slice_name="Girls").one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        self.get_resp(slc.slice_url, {"form_data": json.dumps(slc.form_data)})
        self.assertEqual(1, qry.count())

    def test_slice_id_is_always_logged_correctly_on_ajax_request(self):
        # superset/explore_json case
        self.login(username="admin")
        slc = db.session.query(models.Slice).filter_by(slice_name="Girls").one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        slc_url = slc.slice_url.replace("explore", "explore_json")
        self.get_json_resp(slc_url, {"form_data": json.dumps(slc.form_data)})
        self.assertEqual(1, qry.count())

    def test_slice_query_endpoint(self):
        # API endpoint for query string
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        resp = self.get_resp("/superset/slice_query/{}/".format(slc.id))
        assert "query" in resp
        assert "language" in resp
        self.logout()

    def test_import_csv(self):
        self.login(username="admin")
        table_name = "".join(random.choice(string.ascii_uppercase) for _ in range(5))

        filename_1 = "testCSV.csv"
        test_file_1 = open(filename_1, "w+")
        test_file_1.write("a,b\n")
        test_file_1.write("john,1\n")
        test_file_1.write("paul,2\n")
        test_file_1.close()

        filename_2 = "testCSV2.csv"
        test_file_2 = open(filename_2, "w+")
        test_file_2.write("b,c,d\n")
        test_file_2.write("john,1,x\n")
        test_file_2.write("paul,2,y\n")
        test_file_2.close()

        example_db = utils.get_example_database()
        example_db.allow_csv_upload = True
        db_id = example_db.id
        db.session.commit()
        form_data = {
            "csv_file": open(filename_1, "rb"),
            "sep": ",",
            "name": table_name,
            "con": db_id,
            "if_exists": "fail",
            "index_label": "test_label",
            "mangle_dupe_cols": False,
        }
        url = "/databaseview/list/"
        add_datasource_page = self.get_resp(url)
        self.assertIn("Upload a CSV", add_datasource_page)

        url = "/csvtodatabaseview/form"
        form_get = self.get_resp(url)
        self.assertIn("CSV to Database configuration", form_get)

        try:
            # initial upload with fail mode
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'CSV file "{filename_1}" uploaded to table "{table_name}"', resp
            )

            # upload again with fail mode; should fail
            form_data["csv_file"] = open(filename_1, "rb")
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'Unable to upload CSV file "{filename_1}" to table "{table_name}"',
                resp,
            )

            # upload again with append mode
            form_data["csv_file"] = open(filename_1, "rb")
            form_data["if_exists"] = "append"
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'CSV file "{filename_1}" uploaded to table "{table_name}"', resp
            )

            # upload again with replace mode
            form_data["csv_file"] = open(filename_1, "rb")
            form_data["if_exists"] = "replace"
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'CSV file "{filename_1}" uploaded to table "{table_name}"', resp
            )

            # try to append to table from file with different schema
            form_data["csv_file"] = open(filename_2, "rb")
            form_data["if_exists"] = "append"
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'Unable to upload CSV file "{filename_2}" to table "{table_name}"',
                resp,
            )

            # replace table from file with different schema
            form_data["csv_file"] = open(filename_2, "rb")
            form_data["if_exists"] = "replace"
            resp = self.get_resp(url, data=form_data)
            self.assertIn(
                f'CSV file "{filename_2}" uploaded to table "{table_name}"', resp
            )
            table = (
                db.session.query(SqlaTable)
                .filter_by(table_name=table_name, database_id=db_id)
                .first()
            )
            # make sure the new column name is reflected in the table metadata
            self.assertIn("d", table.column_names)
        finally:
            os.remove(filename_1)
            os.remove(filename_2)

    def test_dataframe_timezone(self):
        tz = psycopg2.tz.FixedOffsetTimezone(offset=60, name=None)
        data = [
            (datetime.datetime(2017, 11, 18, 21, 53, 0, 219225, tzinfo=tz),),
            (datetime.datetime(2017, 11, 18, 22, 6, 30, 61810, tzinfo=tz),),
        ]
        df = dataframe.SupersetDataFrame(list(data), [["data"]], BaseEngineSpec)
        data = df.data
        self.assertDictEqual(
            data[0], {"data": pd.Timestamp("2017-11-18 21:53:00.219225+0100", tz=tz)}
        )
        self.assertDictEqual(
            data[1], {"data": pd.Timestamp("2017-11-18 22:06:30.061810+0100", tz=tz)}
        )

    def test_mssql_engine_spec_pymssql(self):
        # Test for case when tuple is returned (pymssql)
        data = [
            (1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000)),
            (2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000)),
        ]
        df = dataframe.SupersetDataFrame(
            list(data), [["col1"], ["col2"], ["col3"]], MssqlEngineSpec
        )
        data = df.data
        self.assertEqual(len(data), 2)
        self.assertEqual(
            data[0],
            {"col1": 1, "col2": 1, "col3": pd.Timestamp("2017-10-19 23:39:16.660000")},
        )

    def test_mssql_engine_spec_odbc(self):
        # Test for case when pyodbc.Row is returned (msodbc driver)
        data = [
            Row((1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000))),
            Row((2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000))),
        ]
        df = dataframe.SupersetDataFrame(
            list(data), [["col1"], ["col2"], ["col3"]], MssqlEngineSpec
        )
        data = df.data
        self.assertEqual(len(data), 2)
        self.assertEqual(
            data[0],
            {"col1": 1, "col2": 1, "col3": pd.Timestamp("2017-10-19 23:39:16.660000")},
        )

    def test_comments_in_sqlatable_query(self):
        clean_query = "SELECT '/* val 1 */' as c1, '-- val 2' as c2 FROM tbl"
        commented_query = "/* comment 1 */" + clean_query + "-- comment 2"
        table = SqlaTable(
            table_name="test_comments_in_sqlatable_query_table", sql=commented_query
        )
        rendered_query = str(table.get_from_clause())
        self.assertEqual(clean_query, rendered_query)

    def test_slice_payload_no_data(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        json_endpoint = "/superset/explore_json/"
        form_data = slc.form_data
        form_data.update(
            {
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "comparator": "NA",
                        "expressionType": "SIMPLE",
                        "operator": "==",
                        "subject": "gender",
                    }
                ]
            }
        )
        data = self.get_json_resp(json_endpoint, {"form_data": json.dumps(form_data)})
        self.assertEqual(data["status"], utils.QueryStatus.SUCCESS)
        self.assertEqual(data["error"], "No data")

    def test_slice_payload_invalid_query(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        form_data = slc.form_data
        form_data.update({"groupby": ["N/A"]})

        data = self.get_json_resp(
            "/superset/explore_json/", {"form_data": json.dumps(form_data)}
        )
        self.assertEqual(data["status"], utils.QueryStatus.FAILED)

    def test_slice_payload_no_datasource(self):
        self.login(username="admin")
        data = self.get_json_resp("/superset/explore_json/", raise_on_error=False)

        self.assertEqual(
            data["error"], "The datasource associated with this chart no longer exists"
        )

    @mock.patch("superset.security.SupersetSecurityManager.schemas_accessible_by_user")
    @mock.patch("superset.security.SupersetSecurityManager.database_access")
    @mock.patch("superset.security.SupersetSecurityManager.all_datasource_access")
    def test_schemas_access_for_csv_upload_endpoint(
        self, mock_all_datasource_access, mock_database_access, mock_schemas_accessible
    ):
        self.login(username="admin")
        dbobj = self.create_fake_db()
        mock_all_datasource_access.return_value = False
        mock_database_access.return_value = False
        mock_schemas_accessible.return_value = ["this_schema_is_allowed_too"]
        data = self.get_json_resp(
            url="/superset/schemas_access_for_csv_upload?db_id={db_id}".format(
                db_id=dbobj.id
            )
        )
        assert data == ["this_schema_is_allowed_too"]

    def test_select_star(self):
        self.login(username="admin")
        examples_db = utils.get_example_database()
        resp = self.get_resp(f"/superset/select_star/{examples_db.id}/birth_names")
        self.assertIn("gender", resp)

    @mock.patch("superset.views.core.results_backend_use_msgpack", False)
    @mock.patch("superset.views.core.results_backend")
    @mock.patch("superset.views.core.db")
    def test_display_limit(self, mock_superset_db, mock_results_backend):
        query_mock = mock.Mock()
        query_mock.sql = "SELECT *"
        query_mock.database = 1
        query_mock.schema = "superset"
        mock_superset_db.session.query().filter_by().one_or_none.return_value = (
            query_mock
        )

        data = [{"col_0": i} for i in range(100)]
        payload = {
            "status": utils.QueryStatus.SUCCESS,
            "query": {"rows": 100},
            "data": data,
        }
        # do not apply msgpack serialization
        use_msgpack = app.config["RESULTS_BACKEND_USE_MSGPACK"]
        app.config["RESULTS_BACKEND_USE_MSGPACK"] = False
        serialized_payload = sql_lab._serialize_payload(payload, False)
        compressed = utils.zlib_compress(serialized_payload)
        mock_results_backend.get.return_value = compressed

        # get all results
        result = json.loads(self.get_resp("/superset/results/key/"))
        expected = {"status": "success", "query": {"rows": 100}, "data": data}
        self.assertEqual(result, expected)

        # limit results to 1
        limited_data = data[:1]
        result = json.loads(self.get_resp("/superset/results/key/?rows=1"))
        expected = {
            "status": "success",
            "query": {"rows": 100},
            "data": limited_data,
            "displayLimitReached": True,
        }
        self.assertEqual(result, expected)

        app.config["RESULTS_BACKEND_USE_MSGPACK"] = use_msgpack

    def test_results_default_deserialization(self):
        use_new_deserialization = False
        data = [("a", 4, 4.0, "2019-08-18T16:39:16.660000")]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        cdf = dataframe.SupersetDataFrame(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": utils.QueryStatus.PENDING,
        }
        serialized_data, selected_columns, all_columns, expanded_columns = sql_lab._serialize_and_expand_data(
            cdf, db_engine_spec, use_new_deserialization
        )
        payload = {
            "query_id": 1,
            "status": utils.QueryStatus.SUCCESS,
            "state": utils.QueryStatus.SUCCESS,
            "data": serialized_data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
            "query": query,
        }

        serialized_payload = sql_lab._serialize_payload(
            payload, use_new_deserialization
        )
        self.assertIsInstance(serialized_payload, str)

        query_mock = mock.Mock()
        deserialized_payload = views._deserialize_results_payload(
            serialized_payload, query_mock, use_new_deserialization
        )

        self.assertDictEqual(deserialized_payload, payload)
        query_mock.assert_not_called()

    def test_results_msgpack_deserialization(self):
        use_new_deserialization = True
        data = [("a", 4, 4.0, "2019-08-18T16:39:16.660000")]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        cdf = dataframe.SupersetDataFrame(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": utils.QueryStatus.PENDING,
        }
        serialized_data, selected_columns, all_columns, expanded_columns = sql_lab._serialize_and_expand_data(
            cdf, db_engine_spec, use_new_deserialization
        )
        payload = {
            "query_id": 1,
            "status": utils.QueryStatus.SUCCESS,
            "state": utils.QueryStatus.SUCCESS,
            "data": serialized_data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
            "query": query,
        }

        serialized_payload = sql_lab._serialize_payload(
            payload, use_new_deserialization
        )
        self.assertIsInstance(serialized_payload, bytes)

        with mock.patch.object(
            db_engine_spec, "expand_data", wraps=db_engine_spec.expand_data
        ) as expand_data:
            query_mock = mock.Mock()
            query_mock.database.db_engine_spec.expand_data = expand_data

            deserialized_payload = views._deserialize_results_payload(
                serialized_payload, query_mock, use_new_deserialization
            )
            payload["data"] = dataframe.SupersetDataFrame.format_data(cdf.raw_df)

            self.assertDictEqual(deserialized_payload, payload)
            expand_data.assert_called_once()

    @mock.patch.dict("superset._feature_flags", {"FOO": lambda x: 1}, clear=True)
    def test_feature_flag_serialization(self):
        """
        Functions in feature flags don't break bootstrap data serialization.
        """
        self.login()

        encoded = json.dumps(
            {"FOO": lambda x: 1, "super": "set"},
            default=utils.pessimistic_json_iso_dttm_ser,
        )
        html = cgi.escape(encoded).replace("'", "&#39;").replace('"', "&#34;")

        urls = [
            "/superset/sqllab",
            "/superset/welcome",
            "/superset/dashboard/1/",
            "/superset/profile/admin/",
            "/superset/explore/table/1",
        ]
        for url in urls:
            data = self.get_resp(url)
            self.assertTrue(html in data)


if __name__ == "__main__":
    unittest.main()
