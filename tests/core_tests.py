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
import csv
import datetime
import doctest
import html
import io
import json
import logging
import os
from typing import Dict, List, Optional
from urllib.parse import quote

import pytz
import random
import re
import string
import unittest
from unittest import mock, skipUnless

import pandas as pd
import sqlalchemy as sqla

from tests.test_app import app  # isort:skip
import superset.views.utils
from superset import (
    dataframe,
    db,
    jinja_context,
    security_manager,
    sql_lab,
    is_feature_enabled,
)
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.dao import DatasetDAO
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.models import core as models
from superset.models.annotations import Annotation, AnnotationLayer
from superset.models.dashboard import Dashboard
from superset.models.datasource_access_request import DatasourceAccessRequest
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.utils import core as utils
from superset.views import core as views
from superset.views.database.views import DatabaseView

from .base_tests import SupersetTestCase

logger = logging.getLogger(__name__)


class TestCore(SupersetTestCase):
    def setUp(self):
        db.session.query(Query).delete()
        db.session.query(DatasourceAccessRequest).delete()
        db.session.query(models.Log).delete()
        self.table_ids = {
            tbl.table_name: tbl.id for tbl in (db.session.query(SqlaTable).all())
        }
        self.original_unsafe_db_setting = app.config["PREVENT_UNSAFE_DB_CONNECTIONS"]

    def tearDown(self):
        db.session.query(Query).delete()
        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = self.original_unsafe_db_setting

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

    def test_viz_cache_key(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)

        viz = slc.viz
        qobj = viz.query_obj()
        cache_key = viz.cache_key(qobj)

        qobj["groupby"] = []
        cache_key_with_groupby = viz.cache_key(qobj)
        self.assertNotEqual(cache_key, cache_key_with_groupby)

        self.assertNotEqual(
            viz.cache_key(qobj), viz.cache_key(qobj, time_compare="12 weeks")
        )

        self.assertNotEqual(
            viz.cache_key(qobj, time_compare="28 days"),
            viz.cache_key(qobj, time_compare="12 weeks"),
        )

        qobj["inner_from_dttm"] = datetime.datetime(1901, 1, 1)

        self.assertEqual(cache_key_with_groupby, viz.cache_key(qobj))

    def test_get_superset_tables_not_allowed(self):
        example_db = utils.get_example_database()
        schema_name = self.default_schema_backend_map[example_db.backend]
        self.login(username="gamma")
        uri = f"superset/tables/{example_db.id}/{schema_name}/undefined/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_superset_tables_substr(self):
        example_db = utils.get_example_database()
        self.login(username="admin")
        schema_name = self.default_schema_backend_map[example_db.backend]
        uri = f"superset/tables/{example_db.id}/{schema_name}/ab_role/"
        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)

        expeted_response = {
            "options": [
                {
                    "label": "ab_role",
                    "schema": schema_name,
                    "title": "ab_role",
                    "type": "table",
                    "value": "ab_role",
                }
            ],
            "tableLength": 1,
        }
        self.assertEqual(response, expeted_response)

    def test_get_superset_tables_not_found(self):
        self.login(username="admin")
        uri = f"superset/tables/invalid/public/undefined/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_annotation_json_endpoint(self):
        # Set up an annotation layer and annotation
        layer = AnnotationLayer(name="foo", descr="bar")
        db.session.add(layer)
        db.session.commit()

        annotation = Annotation(
            layer_id=layer.id,
            short_descr="my_annotation",
            start_dttm=datetime.datetime(2020, 5, 20, 18, 21, 51),
            end_dttm=datetime.datetime(2020, 5, 20, 18, 31, 51),
        )

        db.session.add(annotation)
        db.session.commit()

        resp_annotations = json.loads(
            self.get_resp("annotationlayermodelview/api/read")
        )
        # the UI needs id and name to function
        self.assertIn("id", resp_annotations["result"][0])
        self.assertIn("name", resp_annotations["result"][0])

        layer = self.get_resp(
            f"/superset/annotation_json/{layer.id}?form_data="
            + quote(json.dumps({"time_range": "100 years ago : now"}))
        )
        self.assertIn("my_annotation", layer)

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
        slice_name = f"Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        copy_name_prefix = "Test Sankey"
        copy_name = f"{copy_name_prefix}[save]{random.random()}"
        tbl_id = self.table_ids.get("energy_usage")
        new_slice_name = f"{copy_name_prefix}[overwrite]{random.random()}"

        url = (
            "/superset/explore/table/{}/?slice_name={}&"
            "action={}&datasource_name=energy_usage"
        )

        form_data = {
            "adhoc_filters": [],
            "viz_type": "sankey",
            "groupby": ["target"],
            "metric": "sum__value",
            "row_limit": 5000,
            "slice_id": slice_id,
            "time_range_endpoints": ["inclusive", "exclusive"],
        }
        # Changing name and save as a new slice
        resp = self.client.post(
            url.format(tbl_id, copy_name, "saveas"),
            data={"form_data": json.dumps(form_data)},
        )
        db.session.expunge_all()
        new_slice_id = resp.json["form_data"]["slice_id"]
        slc = db.session.query(Slice).filter_by(id=new_slice_id).one()

        self.assertEqual(slc.slice_name, copy_name)
        form_data.pop("slice_id")  # We don't save the slice id when saving as
        self.assertEqual(slc.viz.form_data, form_data)

        form_data = {
            "adhoc_filters": [],
            "viz_type": "sankey",
            "groupby": ["source"],
            "metric": "sum__value",
            "row_limit": 5000,
            "slice_id": new_slice_id,
            "time_range": "now",
            "time_range_endpoints": ["inclusive", "exclusive"],
        }
        # Setting the name back to its original name by overwriting new slice
        self.client.post(
            url.format(tbl_id, new_slice_name, "overwrite"),
            data={"form_data": json.dumps(form_data)},
        )
        db.session.expunge_all()
        slc = db.session.query(Slice).filter_by(id=new_slice_id).one()
        self.assertEqual(slc.slice_name, new_slice_name)
        self.assertEqual(slc.viz.form_data, form_data)

        # Cleanup
        slices = (
            db.session.query(Slice)
            .filter(Slice.slice_name.like(copy_name_prefix + "%"))
            .all()
        )
        for slc in slices:
            db.session.delete(slc)
        db.session.commit()

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
        slc = self.get_slice(
            slice_name="Girls", session=db.session, expunge_from_session=False
        )
        slc_data_attributes = slc.data.keys()
        assert "changed_on" in slc_data_attributes
        assert "modified" in slc_data_attributes
        assert "owners" in slc_data_attributes

    def test_slices(self):
        # Testing by hitting the two supported end points for all slices
        self.login(username="admin")
        Slc = Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, "explore", slc.slice_url),
            ]
        for name, method, url in urls:
            logger.info(f"[{name}]/[{method}]: {url}")
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

    def test_get_user_slices_for_owners(self):
        self.login(username="admin")
        user = security_manager.find_user("admin")
        slice_name = "Girls"

        # ensure user is not owner of any slices
        url = f"/superset/user_slices/{user.id}/"
        resp = self.client.get(url)
        data = json.loads(resp.data)
        self.assertEqual(data, [])

        # make user owner of slice and verify that endpoint returns said slice
        slc = self.get_slice(
            slice_name=slice_name, session=db.session, expunge_from_session=False
        )
        slc.owners = [user]
        db.session.merge(slc)
        db.session.commit()
        url = f"/superset/user_slices/{user.id}/"
        resp = self.client.get(url)
        data = json.loads(resp.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], slice_name)

        # remove ownership and ensure user no longer gets slice
        slc = self.get_slice(
            slice_name=slice_name, session=db.session, expunge_from_session=False
        )
        slc.owners = []
        db.session.merge(slc)
        db.session.commit()
        url = f"/superset/user_slices/{user.id}/"
        resp = self.client.get(url)
        data = json.loads(resp.data)
        self.assertEqual(data, [])

    def test_get_user_slices(self):
        self.login(username="admin")
        userid = security_manager.find_user("admin").id
        url = f"/sliceasync/api/read?_flt_0_created_by={userid}"
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

        Slc = Slice
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
        # need to temporarily allow sqlite dbs, teardown will undo this
        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = False
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

    def test_testconn_failed_conn(self, username="admin"):
        self.login(username=username)

        data = json.dumps(
            {"uri": "broken://url", "name": "examples", "impersonate_user": False}
        )
        response = self.client.post(
            "/superset/testconn", data=data, content_type="application/json"
        )
        assert response.status_code == 400
        assert response.headers["Content-Type"] == "application/json"
        response_body = json.loads(response.data.decode("utf-8"))
        expected_body = {"error": "Could not load database driver: broken"}
        assert response_body == expected_body, "%s != %s" % (
            response_body,
            expected_body,
        )

        data = json.dumps(
            {
                "uri": "mssql+pymssql://url",
                "name": "examples",
                "impersonate_user": False,
            }
        )
        response = self.client.post(
            "/superset/testconn", data=data, content_type="application/json"
        )
        assert response.status_code == 400
        assert response.headers["Content-Type"] == "application/json"
        response_body = json.loads(response.data.decode("utf-8"))
        expected_body = {"error": "Could not load database driver: mssql+pymssql"}
        assert response_body == expected_body, "%s != %s" % (
            response_body,
            expected_body,
        )

    def test_testconn_unsafe_uri(self, username="admin"):
        self.login(username=username)
        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = True

        response = self.client.post(
            "/superset/testconn",
            data=json.dumps(
                {
                    "uri": "sqlite:///home/superset/unsafe.db",
                    "name": "unsafe",
                    "impersonate_user": False,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(400, response.status_code)
        response_body = json.loads(response.data.decode("utf-8"))
        expected_body = {
            "error": "SQLite database cannot be used as a data source for security reasons."
        }
        self.assertEqual(expected_body, response_body)

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

        # Need to clean up after ourselves
        database.impersonate_user = False
        database.allow_dml = False
        database.allow_run_async = False
        db.session.commit()

    def test_warm_up_cache(self):
        slc = self.get_slice("Girls", db.session)
        data = self.get_json_resp("/superset/warm_up_cache?slice_id={}".format(slc.id))
        self.assertEqual(
            data, [{"slice_id": slc.id, "viz_error": None, "viz_status": "success"}]
        )

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

    @skipUnless(
        (is_feature_enabled("KV_STORE")), "skipping as /kv/ endpoints are not enabled"
    )
    def test_kv(self):
        self.login(username="admin")

        resp = self.client.get("/kv/10001/")
        self.assertEqual(404, resp.status_code)

        value = json.dumps({"data": "this is a test"})
        resp = self.client.post("/kv/store/", data=dict(data=value))
        self.assertEqual(resp.status_code, 200)
        kv = db.session.query(models.KeyValue).first()
        kv_value = kv.value
        self.assertEqual(json.loads(value), json.loads(kv_value))

        resp = self.client.get("/kv/{}/".format(kv.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(value), json.loads(resp.data.decode("utf-8")))

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

    @mock.patch("tests.superset_test_custom_template_processors.datetime")
    def test_custom_process_template(self, mock_dt) -> None:
        """Test macro defined in custom template processor works."""
        mock_dt.utcnow = mock.Mock(return_value=datetime.datetime(1970, 1, 1))
        db = mock.Mock()
        db.backend = "presto"
        tp = jinja_context.get_template_processor(database=db)

        sql = "SELECT '$DATE()'"
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '{}'".format("1970-01-01"), rendered)

        sql = "SELECT '$DATE(1, 2)'"
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '{}'".format("1970-01-02"), rendered)

    def test_custom_get_template_kwarg(self):
        """Test macro passed as kwargs when getting template processor
        works in custom template processor."""
        db = mock.Mock()
        db.backend = "presto"
        s = "$foo()"
        tp = jinja_context.get_template_processor(database=db, foo=lambda: "bar")
        rendered = tp.process_template(s)
        self.assertEqual("bar", rendered)

    def test_custom_template_kwarg(self) -> None:
        """Test macro passed as kwargs when processing template
        works in custom template processor."""
        db = mock.Mock()
        db.backend = "presto"
        s = "$foo()"
        tp = jinja_context.get_template_processor(database=db)
        rendered = tp.process_template(s, foo=lambda: "bar")
        self.assertEqual("bar", rendered)

    def test_custom_template_processors_overwrite(self) -> None:
        """Test template processor for presto gets overwritten by custom one."""
        db = mock.Mock()
        db.backend = "presto"
        tp = jinja_context.get_template_processor(database=db)

        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        rendered = tp.process_template(sql)
        self.assertEqual(sql, rendered)

        sql = "SELECT '{{ DATE(1, 2) }}'"
        rendered = tp.process_template(sql)
        self.assertEqual(sql, rendered)

    def test_custom_template_processors_ignored(self) -> None:
        """Test custom template processor is ignored for a difference backend
        database."""
        maindb = utils.get_example_database()
        sql = "SELECT '$DATE()'"
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        self.assertEqual(sql, rendered)

    @mock.patch("tests.superset_test_custom_template_processors.datetime")
    @mock.patch("superset.sql_lab.get_sql_results")
    def test_custom_templated_sql_json(self, sql_lab_mock, mock_dt) -> None:
        """Test sqllab receives macros expanded query."""
        mock_dt.utcnow = mock.Mock(return_value=datetime.datetime(1970, 1, 1))
        self.login("admin")
        sql = "SELECT '$DATE()' as test"
        resp = {
            "status": utils.QueryStatus.SUCCESS,
            "query": {"rows": 1},
            "data": [{"test": "'1970-01-01'"}],
        }
        sql_lab_mock.return_value = resp

        dbobj = self.create_fake_presto_db()
        json_payload = dict(database_id=dbobj.id, sql=sql)
        self.get_json_resp(
            "/superset/sql_json/", raise_on_error=False, json_=json_payload
        )
        assert sql_lab_mock.called
        self.assertEqual(sql_lab_mock.call_args[0][1], "SELECT '1970-01-01' as test")

        self.delete_fake_presto_db()

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
        url = f"/superset/favstar/Slice/{slc.id}/select/"
        resp = self.get_json_resp(url)
        self.assertEqual(resp["count"], 1)

        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        url = f"/superset/favstar/Dashboard/{dash.id}/select/"
        resp = self.get_json_resp(url)
        self.assertEqual(resp["count"], 1)

        userid = security_manager.find_user("admin").id
        resp = self.get_resp(f"/superset/profile/{username}/")
        self.assertIn('"app"', resp)
        data = self.get_json_resp(f"/superset/recent_activity/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/created_slices/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/created_dashboards/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/fave_slices/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/fave_dashboards/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/user_slices/{userid}/")
        self.assertNotIn("message", data)
        data = self.get_json_resp(f"/superset/fave_dashboards_by_username/{username}/")
        self.assertNotIn("message", data)

    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # superset/explore case
        slc = db.session.query(Slice).filter_by(slice_name="Girls").one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        self.get_resp(slc.slice_url, {"form_data": json.dumps(slc.form_data)})
        self.assertEqual(1, qry.count())

    def create_sample_csvfile(self, filename: str, content: List[str]) -> None:
        with open(filename, "w+") as test_file:
            for l in content:
                test_file.write(f"{l}\n")

    def create_sample_excelfile(self, filename: str, content: Dict[str, str]) -> None:
        pd.DataFrame(content).to_excel(filename)

    def enable_csv_upload(self, database: models.Database) -> None:
        """Enables csv upload in the given database."""
        database.allow_csv_upload = True
        db.session.commit()
        add_datasource_page = self.get_resp("/databaseview/list/")
        self.assertIn("Upload a CSV", add_datasource_page)

        form_get = self.get_resp("/csvtodatabaseview/form")
        self.assertIn("CSV to Database configuration", form_get)

    def upload_csv(
        self, filename: str, table_name: str, extra: Optional[Dict[str, str]] = None
    ):
        form_data = {
            "csv_file": open(filename, "rb"),
            "sep": ",",
            "name": table_name,
            "con": utils.get_example_database().id,
            "if_exists": "fail",
            "index_label": "test_label",
            "mangle_dupe_cols": False,
        }
        if extra:
            form_data.update(extra)
        return self.get_resp("/csvtodatabaseview/form", data=form_data)

    def upload_excel(
        self, filename: str, table_name: str, extra: Optional[Dict[str, str]] = None
    ):
        form_data = {
            "excel_file": open(filename, "rb"),
            "name": table_name,
            "con": utils.get_example_database().id,
            "sheet_name": "Sheet1",
            "if_exists": "fail",
            "index_label": "test_label",
            "mangle_dupe_cols": False,
        }
        if extra:
            form_data.update(extra)
        return self.get_resp("/exceltodatabaseview/form", data=form_data)

    @mock.patch(
        "superset.models.core.config",
        {**app.config, "ALLOWED_USER_CSV_SCHEMA_FUNC": lambda d, u: ["admin_database"]},
    )
    def test_import_csv_enforced_schema(self):
        if utils.get_example_database().backend == "sqlite":
            # sqlite doesn't support schema / database creation
            return
        self.login(username="admin")
        table_name = "".join(random.choice(string.ascii_lowercase) for _ in range(5))
        full_table_name = f"admin_database.{table_name}"
        filename = "testCSV.csv"
        self.create_sample_csvfile(filename, ["a,b", "john,1", "paul,2"])
        try:
            self.enable_csv_upload(utils.get_example_database())

            # no schema specified, fail upload
            resp = self.upload_csv(filename, table_name)
            self.assertIn(
                'Database "examples" schema "None" is not allowed for csv uploads', resp
            )

            # user specified schema matches the expected schema, append
            success_msg = f'CSV file "{filename}" uploaded to table "{full_table_name}"'
            resp = self.upload_csv(
                filename,
                table_name,
                extra={"schema": "admin_database", "if_exists": "append"},
            )
            self.assertIn(success_msg, resp)

            resp = self.upload_csv(
                filename,
                table_name,
                extra={"schema": "admin_database", "if_exists": "replace"},
            )
            self.assertIn(success_msg, resp)

            # user specified schema doesn't match, fail
            resp = self.upload_csv(filename, table_name, extra={"schema": "gold"})
            self.assertIn(
                'Database "examples" schema "gold" is not allowed for csv uploads',
                resp,
            )
        finally:
            os.remove(filename)

    def test_import_csv_explore_database(self):
        if utils.get_example_database().backend == "sqlite":
            # sqlite doesn't support schema / database creation
            return
        explore_db_id = utils.get_example_database().id

        upload_db = utils.get_or_create_db(
            "csv_explore_db", app.config["SQLALCHEMY_DATABASE_URI"]
        )
        upload_db_id = upload_db.id
        extra = upload_db.get_extra()
        extra["explore_database_id"] = explore_db_id
        upload_db.extra = json.dumps(extra)
        db.session.commit()

        self.login(username="admin")
        self.enable_csv_upload(DatasetDAO.get_database_by_id(upload_db_id))
        table_name = "".join(random.choice(string.ascii_uppercase) for _ in range(5))

        f = "testCSV.csv"
        self.create_sample_csvfile(f, ["a,b", "john,1", "paul,2"])
        # initial upload with fail mode
        resp = self.upload_csv(f, table_name)
        self.assertIn(f'CSV file "{f}" uploaded to table "{table_name}"', resp)
        table = self.get_table_by_name(table_name)
        self.assertEqual(table.database_id, explore_db_id)

        # cleanup
        db.session.delete(table)
        db.session.delete(DatasetDAO.get_database_by_id(upload_db_id))
        db.session.commit()
        os.remove(f)

    def test_import_csv(self):
        self.login(username="admin")
        table_name = "".join(random.choice(string.ascii_lowercase) for _ in range(5))

        f1 = "testCSV.csv"
        self.create_sample_csvfile(f1, ["a,b", "john,1", "paul,2"])
        f2 = "testCSV2.csv"
        self.create_sample_csvfile(f2, ["b,c,d", "john,1,x", "paul,2,"])
        self.enable_csv_upload(utils.get_example_database())

        try:
            success_msg_f1 = f'CSV file "{f1}" uploaded to table "{table_name}"'

            # initial upload with fail mode
            resp = self.upload_csv(f1, table_name)
            self.assertIn(success_msg_f1, resp)

            # upload again with fail mode; should fail
            fail_msg = f'Unable to upload CSV file "{f1}" to table "{table_name}"'
            resp = self.upload_csv(f1, table_name)
            self.assertIn(fail_msg, resp)

            # upload again with append mode
            resp = self.upload_csv(f1, table_name, extra={"if_exists": "append"})
            self.assertIn(success_msg_f1, resp)

            # upload again with replace mode
            resp = self.upload_csv(f1, table_name, extra={"if_exists": "replace"})
            self.assertIn(success_msg_f1, resp)

            # try to append to table from file with different schema
            resp = self.upload_csv(f2, table_name, extra={"if_exists": "append"})
            fail_msg_f2 = f'Unable to upload CSV file "{f2}" to table "{table_name}"'
            self.assertIn(fail_msg_f2, resp)

            # replace table from file with different schema
            resp = self.upload_csv(f2, table_name, extra={"if_exists": "replace"})
            success_msg_f2 = f'CSV file "{f2}" uploaded to table "{table_name}"'
            self.assertIn(success_msg_f2, resp)

            table = self.get_table_by_name(table_name)
            # make sure the new column name is reflected in the table metadata
            self.assertIn("d", table.column_names)

            # null values are set
            self.upload_csv(
                f2,
                table_name,
                extra={"null_values": '["", "john"]', "if_exists": "replace"},
            )
            # make sure that john and empty string are replaced with None
            data = db.session.execute(f"SELECT * from {table_name}").fetchall()
            assert data == [(None, 1, "x"), ("paul", 2, None)]

            # default null values
            self.upload_csv(f2, table_name, extra={"if_exists": "replace"})
            # make sure that john and empty string are replaced with None
            data = db.session.execute(f"SELECT * from {table_name}").fetchall()
            assert data == [("john", 1, "x"), ("paul", 2, None)]

        finally:
            os.remove(f1)
            os.remove(f2)

    def test_import_excel(self):
        self.login(username="admin")
        table_name = "".join(random.choice(string.ascii_lowercase) for _ in range(5))
        f1 = "testExcel.xlsx"
        self.create_sample_excelfile(f1, {"a": ["john", "paul"], "b": [1, 2]})
        self.enable_csv_upload(utils.get_example_database())

        try:
            success_msg_f1 = f'Excel file "{f1}" uploaded to table "{table_name}"'

            # initial upload with fail mode
            resp = self.upload_excel(f1, table_name)
            self.assertIn(success_msg_f1, resp)

            # upload again with fail mode; should fail
            fail_msg = f'Unable to upload Excel file "{f1}" to table "{table_name}"'
            resp = self.upload_excel(f1, table_name)
            self.assertIn(fail_msg, resp)

            # upload again with append mode
            resp = self.upload_excel(f1, table_name, extra={"if_exists": "append"})
            self.assertIn(success_msg_f1, resp)

            # upload again with replace mode
            resp = self.upload_excel(f1, table_name, extra={"if_exists": "replace"})
            self.assertIn(success_msg_f1, resp)

            # make sure that john and empty string are replaced with None
            data = db.session.execute(f"SELECT * from {table_name}").fetchall()
            assert data == [(0, "john", 1), (1, "paul", 2)]
        finally:
            os.remove(f1)

    def test_dataframe_timezone(self):
        tz = pytz.FixedOffset(60)
        data = [
            (datetime.datetime(2017, 11, 18, 21, 53, 0, 219225, tzinfo=tz),),
            (datetime.datetime(2017, 11, 18, 22, 6, 30, tzinfo=tz),),
        ]
        results = SupersetResultSet(list(data), [["data"]], BaseEngineSpec)
        df = results.to_pandas_df()
        data = dataframe.df_to_records(df)
        json_str = json.dumps(data, default=utils.pessimistic_json_iso_dttm_ser)
        self.assertDictEqual(
            data[0], {"data": pd.Timestamp("2017-11-18 21:53:00.219225+0100", tz=tz)}
        )
        self.assertDictEqual(
            data[1], {"data": pd.Timestamp("2017-11-18 22:06:30+0100", tz=tz)}
        )
        self.assertEqual(
            json_str,
            '[{"data": "2017-11-18T21:53:00.219225+01:00"}, {"data": "2017-11-18T22:06:30+01:00"}]',
        )

    def test_mssql_engine_spec_pymssql(self):
        # Test for case when tuple is returned (pymssql)
        data = [
            (1, 1, datetime.datetime(2017, 10, 19, 23, 39, 16, 660000)),
            (2, 2, datetime.datetime(2018, 10, 19, 23, 39, 16, 660000)),
        ]
        results = SupersetResultSet(
            list(data), [["col1"], ["col2"], ["col3"]], MssqlEngineSpec
        )
        df = results.to_pandas_df()
        data = dataframe.df_to_records(df)
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

    def test_slice_payload_no_datasource(self):
        self.login(username="admin")
        data = self.get_json_resp("/superset/explore_json/", raise_on_error=False)

        self.assertEqual(
            data["errors"][0]["message"],
            "The datasource associated with this chart no longer exists",
        )

    @mock.patch(
        "superset.security.SupersetSecurityManager.get_schemas_accessible_by_user"
    )
    @mock.patch("superset.security.SupersetSecurityManager.can_access_database")
    @mock.patch("superset.security.SupersetSecurityManager.can_access_all_datasources")
    def test_schemas_access_for_csv_upload_endpoint(
        self,
        mock_can_access_all_datasources,
        mock_can_access_database,
        mock_schemas_accessible,
    ):
        self.login(username="admin")
        dbobj = self.create_fake_db()
        mock_can_access_all_datasources.return_value = False
        mock_can_access_database.return_value = False
        mock_schemas_accessible.return_value = ["this_schema_is_allowed_too"]
        data = self.get_json_resp(
            url="/superset/schemas_access_for_csv_upload?db_id={db_id}".format(
                db_id=dbobj.id
            )
        )
        assert data == ["this_schema_is_allowed_too"]
        self.delete_fake_db()

    def test_select_star(self):
        self.login(username="admin")
        examples_db = utils.get_example_database()
        resp = self.get_resp(f"/superset/select_star/{examples_db.id}/birth_names")
        self.assertIn("gender", resp)

    def test_get_select_star_not_allowed(self):
        """
            Database API: Test get select star not allowed
        """
        self.login(username="gamma")
        example_db = utils.get_example_database()
        resp = self.client.get(f"/superset/select_star/{example_db.id}/birth_names")
        self.assertEqual(resp.status_code, 404)

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
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": utils.QueryStatus.PENDING,
        }
        (
            serialized_data,
            selected_columns,
            all_columns,
            expanded_columns,
        ) = sql_lab._serialize_and_expand_data(
            results, db_engine_spec, use_new_deserialization
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
        deserialized_payload = superset.views.utils._deserialize_results_payload(
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
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": utils.QueryStatus.PENDING,
        }
        (
            serialized_data,
            selected_columns,
            all_columns,
            expanded_columns,
        ) = sql_lab._serialize_and_expand_data(
            results, db_engine_spec, use_new_deserialization
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

            deserialized_payload = superset.views.utils._deserialize_results_payload(
                serialized_payload, query_mock, use_new_deserialization
            )
            df = results.to_pandas_df()
            payload["data"] = dataframe.df_to_records(df)

            self.assertDictEqual(deserialized_payload, payload)
            expand_data.assert_called_once()

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"FOO": lambda x: 1},
        clear=True,
    )
    def test_feature_flag_serialization(self):
        """
        Functions in feature flags don't break bootstrap data serialization.
        """
        self.login()

        encoded = json.dumps(
            {"FOO": lambda x: 1, "super": "set"},
            default=utils.pessimistic_json_iso_dttm_ser,
        )
        html_string = (
            html.escape(encoded, quote=False)
            .replace("'", "&#39;")
            .replace('"', "&#34;")
        )

        urls = [
            "/superset/sqllab",
            "/superset/welcome",
            "/superset/dashboard/1/",
            "/superset/profile/admin/",
            "/superset/explore/table/1",
        ]
        for url in urls:
            data = self.get_resp(url)
            self.assertTrue(html_string in data)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": True},
        clear=True,
    )
    def test_sqllab_backend_persistence_payload(self):
        username = "admin"
        self.login(username)
        user_id = security_manager.find_user(username).id

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

        # run a query in the created tab
        self.run_sql(
            "SELECT name FROM birth_names",
            "client_id_1",
            user_name=username,
            raise_on_error=True,
            sql_editor_id=tab_state_id,
        )
        # run an orphan query (no tab)
        self.run_sql(
            "SELECT name FROM birth_names",
            "client_id_2",
            user_name=username,
            raise_on_error=True,
        )

        # we should have only 1 query returned, since the second one is not
        # associated with any tabs
        payload = views.Superset._get_sqllab_tabs(user_id=user_id)
        self.assertEqual(len(payload["queries"]), 1)

    def test_virtual_table_explore_visibility(self):
        # test that default visibility it set to True
        database = utils.get_example_database()
        self.assertEqual(database.allows_virtual_table_explore, True)

        # test that visibility is disabled when extra is set to False
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = False
        database.extra = json.dumps(extra)
        self.assertEqual(database.allows_virtual_table_explore, False)

        # test that visibility is enabled when extra is set to True
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = True
        database.extra = json.dumps(extra)
        self.assertEqual(database.allows_virtual_table_explore, True)

        # test that visibility is not broken with bad values
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = "trash value"
        database.extra = json.dumps(extra)
        self.assertEqual(database.allows_virtual_table_explore, True)

    def test_explore_database_id(self):
        database = utils.get_example_database()
        explore_database = utils.get_example_database()

        # test that explore_database_id is the regular database
        # id if none is set in the extra
        self.assertEqual(database.explore_database_id, database.id)

        # test that explore_database_id is correct if the extra is set
        extra = database.get_extra()
        extra["explore_database_id"] = explore_database.id
        database.extra = json.dumps(extra)
        self.assertEqual(database.explore_database_id, explore_database.id)


if __name__ == "__main__":
    unittest.main()
