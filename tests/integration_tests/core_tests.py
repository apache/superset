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
from typing import Dict, List
from urllib.parse import quote
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)

import pytest
import pytz
import random
import re
import unittest
from unittest import mock

import pandas as pd
import sqlalchemy as sqla
from sqlalchemy.exc import SQLAlchemyError
from superset.models.cache import CacheKey
from superset.utils.core import get_example_database
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,
)
from tests.integration_tests.test_app import app
import superset.views.utils
from superset import (
    dataframe,
    db,
    security_manager,
    sql_lab,
)
from superset.common.db_query_status import QueryStatus
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.exceptions import SupersetException
from superset.extensions import async_query_manager
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
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
)

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
        self.login()
        resp = self.client.get("/superset/dashboard/-1/")
        assert resp.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_endpoint(self):
        self.login(username="admin")
        slc = self.get_slice("Girls", db.session)
        resp = self.get_resp("/superset/slice/{}/".format(slc.id))
        assert "Original value" in resp
        assert "List Roles" in resp

        # Testing overrides
        resp = self.get_resp("/superset/slice/{}/?standalone=true".format(slc.id))
        assert '<div class="navbar' not in resp

        resp = self.client.get("/superset/slice/-1/")
        assert resp.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
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
        if example_db.backend in {"presto", "hive"}:
            # TODO: change table to the real table that is in examples.
            return
        self.login(username="admin")
        schema_name = self.default_schema_backend_map[example_db.backend]
        uri = f"superset/tables/{example_db.id}/{schema_name}/ab_role/"
        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)

        expected_response = {
            "options": [
                {
                    "label": "ab_role",
                    "schema": schema_name,
                    "title": "ab_role",
                    "type": "table",
                    "value": "ab_role",
                    "extra": None,
                }
            ],
            "tableLength": 1,
        }
        self.assertEqual(response, expected_response)

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

        self.login()
        resp_annotations = json.loads(
            self.get_resp("annotationlayermodelview/api/read")
        )
        # the UI needs id and name to function
        self.assertIn("id", resp_annotations["result"][0])
        self.assertIn("name", resp_annotations["result"][0])

        response = self.get_resp(
            f"/superset/annotation_json/{layer.id}?form_data="
            + quote(json.dumps({"time_range": "100 years ago : now"}))
        )
        assert "my_annotation" in response

        # Rollback changes
        db.session.delete(annotation)
        db.session.delete(layer)
        db.session.commit()

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

    @pytest.mark.usefixtures("load_energy_table_with_slice")
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

    @pytest.mark.usefixtures("load_energy_table_with_slice")
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
        assert "energy_target0" in resp

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
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

    @pytest.mark.usefixtures("load_energy_table_with_slice")
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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_user_slices_for_owners(self):
        self.login(username="alpha")
        user = security_manager.find_user("alpha")
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

    @pytest.mark.usefixtures("load_energy_table_with_slice")
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
            "error": "SQLiteDialect_pysqlite cannot be used as a data source for security reasons."
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

    @pytest.mark.usefixtures(
        "load_energy_table_with_slice", "load_birth_names_dashboard_with_slices"
    )
    def test_warm_up_cache(self):
        self.login()
        slc = self.get_slice("Girls", db.session)
        data = self.get_json_resp("/superset/warm_up_cache?slice_id={}".format(slc.id))
        self.assertEqual(
            data, [{"slice_id": slc.id, "viz_error": None, "viz_status": "success"}]
        )

        data = self.get_json_resp(
            "/superset/warm_up_cache?table_name=energy_usage&db_name=main"
        )
        assert len(data) > 0

        dashboard = self.get_dash_by_slug("births")

        assert self.get_json_resp(
            f"/superset/warm_up_cache?dashboard_id={dashboard.id}&slice_id={slc.id}"
        ) == [{"slice_id": slc.id, "viz_error": None, "viz_status": "success"}]

        assert self.get_json_resp(
            f"/superset/warm_up_cache?dashboard_id={dashboard.id}&slice_id={slc.id}&extra_filters="
            + quote(json.dumps([{"col": "name", "op": "in", "val": ["Jennifer"]}]))
        ) == [{"slice_id": slc.id, "viz_error": None, "viz_status": "success"}]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_cache_logging(self):
        self.login("admin")
        store_cache_keys = app.config["STORE_CACHE_KEYS_IN_METADATA_DB"]
        app.config["STORE_CACHE_KEYS_IN_METADATA_DB"] = True
        girls_slice = self.get_slice("Girls", db.session)
        self.get_json_resp("/superset/warm_up_cache?slice_id={}".format(girls_slice.id))
        ck = db.session.query(CacheKey).order_by(CacheKey.id.desc()).first()
        assert ck.datasource_uid == f"{girls_slice.table.id}__table"
        app.config["STORE_CACHE_KEYS_IN_METADATA_DB"] = store_cache_keys

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

    def test_shortner_invalid(self):
        self.login(username="admin")
        invalid_urls = [
            "hhttp://invalid.com",
            "hhttps://invalid.com",
            "www.invalid.com",
        ]
        for invalid_url in invalid_urls:
            resp = self.client.post("/r/shortner/", data=dict(data=invalid_url))
            assert resp.status_code == 400

    def test_redirect_invalid(self):
        model_url = models.Url(url="hhttp://invalid.com")
        db.session.add(model_url)
        db.session.commit()

        self.login(username="admin")
        response = self.client.get(f"/r/{model_url.id}")
        assert response.headers["Location"] == "http://localhost/"
        db.session.delete(model_url)
        db.session.commit()

    @with_feature_flags(KV_STORE=False)
    def test_kv_disabled(self):
        self.login(username="admin")

        resp = self.client.get("/kv/10001/")
        self.assertEqual(404, resp.status_code)

        value = json.dumps({"data": "this is a test"})
        resp = self.client.post("/kv/store/", data=dict(data=value))
        self.assertEqual(resp.status_code, 404)

    @with_feature_flags(KV_STORE=True)
    def test_kv_enabled(self):
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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_csv_endpoint(self):
        self.login()
        client_id = "{}".format(random.getrandbits(64))[:10]
        get_name_sql = """
                    SELECT name
                    FROM birth_names
                    LIMIT 1
                """
        resp = self.run_sql(get_name_sql, client_id, raise_on_error=True)
        name = resp["data"][0]["name"]
        sql = f"""
            SELECT name
            FROM birth_names
            WHERE name = '{name}'
            LIMIT 1
        """
        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp("/superset/csv/{}".format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(io.StringIO(f"name\n{name}\n"))

        client_id = "{}".format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp("/superset/csv/{}".format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(io.StringIO(f"name\n{name}\n"))

        self.assertEqual(list(expected_data), list(data))
        self.logout()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_extra_table_metadata(self):
        self.login()
        example_db = utils.get_example_database()
        schema = "default" if example_db.backend in {"presto", "hive"} else "superset"
        self.get_json_resp(
            f"/superset/extra_table_metadata/{example_db.id}/birth_names/{schema}/"
        )

    def test_templated_sql_json(self):
        if utils.get_example_database().backend == "presto":
            # TODO: make it work for presto
            return
        self.login()
        sql = "SELECT '{{ 1+1 }}' as test"
        data = self.run_sql(sql, "fdaklj3ws")
        self.assertEqual(data["data"][0]["test"], "2")

    @pytest.mark.ofek
    @mock.patch(
        "tests.integration_tests.superset_test_custom_template_processors.datetime"
    )
    @mock.patch("superset.views.core.get_sql_results")
    def test_custom_templated_sql_json(self, sql_lab_mock, mock_dt) -> None:
        """Test sqllab receives macros expanded query."""
        mock_dt.utcnow = mock.Mock(return_value=datetime.datetime(1970, 1, 1))
        self.login()
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
            "/superset/sql_json/", raise_on_error=False, json_=json_payload
        )
        assert sql_lab_mock.called
        self.assertEqual(sql_lab_mock.call_args[0][1], "SELECT '1970-01-01' as test")

        self.delete_fake_db_for_macros()

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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # superset/explore case
        self.login("admin")
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
            table_name="test_comments_in_sqlatable_query_table",
            sql=commented_query,
            database=get_example_database(),
        )
        rendered_query = str(table.get_from_clause())
        self.assertEqual(clean_query, rendered_query)

    def test_slice_payload_no_datasource(self):
        self.login(username="admin")
        data = self.get_json_resp("/superset/explore_json/", raise_on_error=False)

        self.assertEqual(
            data["errors"][0]["message"],
            "The dataset associated with this chart no longer exists",
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_explore_json(self):
        tbl_id = self.table_ids.get("birth_names")
        form_data = {
            "datasource": f"{tbl_id}__table",
            "viz_type": "dist_bar",
            "time_range_endpoints": ["inclusive", "exclusive"],
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/", data={"form_data": json.dumps(form_data)},
        )
        data = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(rv.status_code, 200)
        self.assertEqual(data["rowcount"], 2)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_explore_json_dist_bar_order(self):
        tbl_id = self.table_ids.get("birth_names")
        form_data = {
            "datasource": f"{tbl_id}__table",
            "viz_type": "dist_bar",
            "url_params": {},
            "time_range_endpoints": ["inclusive", "exclusive"],
            "granularity_sqla": "ds",
            "time_range": 'DATEADD(DATETIME("2021-01-22T00:00:00"), -100, year) : 2021-01-22T00:00:00',
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "column": {
                        "id": 334,
                        "column_name": "name",
                        "verbose_name": "null",
                        "description": "null",
                        "expression": "",
                        "filterable": True,
                        "groupby": True,
                        "is_dttm": False,
                        "type": "VARCHAR(255)",
                        "python_date_format": "null",
                    },
                    "aggregate": "COUNT",
                    "sqlExpression": "null",
                    "isNew": False,
                    "hasCustomLabel": False,
                    "label": "COUNT(name)",
                    "optionName": "metric_xdzsijn42f9_khi4h3v3vci",
                },
                {
                    "expressionType": "SIMPLE",
                    "column": {
                        "id": 332,
                        "column_name": "ds",
                        "verbose_name": "null",
                        "description": "null",
                        "expression": "",
                        "filterable": True,
                        "groupby": True,
                        "is_dttm": True,
                        "type": "TIMESTAMP WITHOUT TIME ZONE",
                        "python_date_format": "null",
                    },
                    "aggregate": "COUNT",
                    "sqlExpression": "null",
                    "isNew": False,
                    "hasCustomLabel": False,
                    "label": "COUNT(ds)",
                    "optionName": "metric_80g1qb9b6o7_ci5vquydcbe",
                },
            ],
            "order_desc": True,
            "adhoc_filters": [],
            "groupby": ["name"],
            "columns": [],
            "row_limit": 10,
            "color_scheme": "supersetColors",
            "label_colors": {},
            "show_legend": True,
            "y_axis_format": "SMART_NUMBER",
            "bottom_margin": "auto",
            "x_ticks_layout": "auto",
        }

        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/", data={"form_data": json.dumps(form_data)},
        )
        data = json.loads(rv.data.decode("utf-8"))

        resp = self.run_sql(
            """
            SELECT count(name) AS count_name, count(ds) AS count_ds
            FROM birth_names
            WHERE ds >= '1921-01-22 00:00:00.000000' AND ds < '2021-01-22 00:00:00.000000'
            GROUP BY name
            ORDER BY count_name DESC
            LIMIT 10;
            """,
            client_id="client_id_1",
            user_name="admin",
        )
        count_ds = []
        count_name = []
        for series in data["data"]:
            if series["key"] == "COUNT(ds)":
                count_ds = series["values"]
            if series["key"] == "COUNT(name)":
                count_name = series["values"]
        for expected, actual_ds, actual_name in zip(resp["data"], count_ds, count_name):
            assert expected["count_name"] == actual_name["y"]
            assert expected["count_ds"] == actual_ds["y"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_explore_json_async(self):
        tbl_id = self.table_ids.get("birth_names")
        form_data = {
            "datasource": f"{tbl_id}__table",
            "viz_type": "dist_bar",
            "time_range_endpoints": ["inclusive", "exclusive"],
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        async_query_manager.init_app(app)
        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/", data={"form_data": json.dumps(form_data)},
        )
        data = json.loads(rv.data.decode("utf-8"))
        keys = list(data.keys())

        self.assertEqual(rv.status_code, 202)
        self.assertCountEqual(
            keys, ["channel_id", "job_id", "user_id", "status", "errors", "result_url"]
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_explore_json_async_results_format(self):
        tbl_id = self.table_ids.get("birth_names")
        form_data = {
            "datasource": f"{tbl_id}__table",
            "viz_type": "dist_bar",
            "time_range_endpoints": ["inclusive", "exclusive"],
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        async_query_manager.init_app(app)
        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/?results=true",
            data={"form_data": json.dumps(form_data)},
        )
        self.assertEqual(rv.status_code, 200)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.utils.cache_manager.CacheManager.cache",
        new_callable=mock.PropertyMock,
    )
    @mock.patch("superset.viz.BaseViz.force_cached", new_callable=mock.PropertyMock)
    def test_explore_json_data(self, mock_force_cached, mock_cache):
        tbl_id = self.table_ids.get("birth_names")
        form_data = dict(
            {
                "form_data": {
                    "datasource": f"{tbl_id}__table",
                    "viz_type": "dist_bar",
                    "time_range_endpoints": ["inclusive", "exclusive"],
                    "granularity_sqla": "ds",
                    "time_range": "No filter",
                    "metrics": ["count"],
                    "adhoc_filters": [],
                    "groupby": ["gender"],
                    "row_limit": 100,
                }
            }
        )

        class MockCache:
            def get(self, key):
                return form_data

            def set(self):
                return None

        mock_cache.return_value = MockCache()
        mock_force_cached.return_value = False

        self.login(username="admin")
        rv = self.client.get("/superset/explore_json/data/valid-cache-key")
        data = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(rv.status_code, 200)
        self.assertEqual(data["rowcount"], 2)

    @mock.patch(
        "superset.utils.cache_manager.CacheManager.cache",
        new_callable=mock.PropertyMock,
    )
    def test_explore_json_data_no_login(self, mock_cache):
        tbl_id = self.table_ids.get("birth_names")
        form_data = dict(
            {
                "form_data": {
                    "datasource": f"{tbl_id}__table",
                    "viz_type": "dist_bar",
                    "time_range_endpoints": ["inclusive", "exclusive"],
                    "granularity_sqla": "ds",
                    "time_range": "No filter",
                    "metrics": ["count"],
                    "adhoc_filters": [],
                    "groupby": ["gender"],
                    "row_limit": 100,
                }
            }
        )

        class MockCache:
            def get(self, key):
                return form_data

            def set(self):
                return None

        mock_cache.return_value = MockCache()

        rv = self.client.get("/superset/explore_json/data/valid-cache-key")
        self.assertEqual(rv.status_code, 401)

    def test_explore_json_data_invalid_cache_key(self):
        self.login(username="admin")
        cache_key = "invalid-cache-key"
        rv = self.client.get(f"/superset/explore_json/data/{cache_key}")
        data = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(rv.status_code, 404)
        self.assertEqual(data["error"], "Cached data not found")

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
            url="/superset/schemas_access_for_file_upload?db_id={db_id}".format(
                db_id=dbobj.id
            )
        )
        assert data == ["this_schema_is_allowed_too"]
        self.delete_fake_db()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
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
        self.assertEqual(resp.status_code, 403)

    @mock.patch("superset.views.core.results_backend_use_msgpack", False)
    @mock.patch("superset.views.core.results_backend")
    def test_display_limit(self, mock_results_backend):
        self.login()

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
        mock_results_backend.get.return_value = compressed

        with mock.patch("superset.views.core.db") as mock_superset_db:
            mock_superset_db.session.query().filter_by().one_or_none.return_value = (
                query_mock
            )
            # get all results
            result_key = json.loads(self.get_resp("/superset/results/key/"))
            result_limited = json.loads(self.get_resp("/superset/results/key/?rows=1"))

        self.assertEqual(result_key, expected_key)
        self.assertEqual(result_limited, expected_limited)

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
            "status": QueryStatus.PENDING,
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
            "status": QueryStatus.SUCCESS,
            "state": QueryStatus.SUCCESS,
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
            "status": QueryStatus.PENDING,
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
            "status": QueryStatus.SUCCESS,
            "state": QueryStatus.SUCCESS,
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
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
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
        dash_id = db.session.query(Dashboard.id).first()[0]
        tbl_id = self.table_ids.get("wb_health_population")
        urls = [
            "/superset/sqllab",
            "/superset/welcome",
            f"/superset/dashboard/{dash_id}/",
            "/superset/profile/admin/",
            f"/superset/explore/table/{tbl_id}",
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
            sql_editor_id=str(tab_state_id),
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

    def test_get_column_names_from_metric(self):
        simple_metric = {
            "expressionType": utils.AdhocMetricExpressionType.SIMPLE.value,
            "column": {"column_name": "my_col"},
            "aggregate": "SUM",
            "label": "My Simple Label",
        }
        assert utils.get_column_name_from_metric(simple_metric) == "my_col"

        sql_metric = {
            "expressionType": utils.AdhocMetricExpressionType.SQL.value,
            "sqlExpression": "SUM(my_label)",
            "label": "My SQL Label",
        }
        assert utils.get_column_name_from_metric(sql_metric) is None
        assert utils.get_column_names_from_metrics([simple_metric, sql_metric]) == [
            "my_col"
        ]

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @mock.patch("superset.models.core.DB_CONNECTION_MUTATOR")
    def test_explore_injected_exceptions(self, mock_db_connection_mutator):
        """
        Handle injected exceptions from the db mutator
        """
        # Assert we can handle a custom exception at the mutator level
        exception = SupersetException("Error message")
        mock_db_connection_mutator.side_effect = exception
        slice = db.session.query(Slice).first()
        url = f"/superset/explore/?form_data=%7B%22slice_id%22%3A%20{slice.id}%7D"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)

        # Assert we can handle a driver exception at the mutator level
        exception = SQLAlchemyError("Error message")
        mock_db_connection_mutator.side_effect = exception
        slice = db.session.query(Slice).first()
        url = f"/superset/explore/?form_data=%7B%22slice_id%22%3A%20{slice.id}%7D"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @mock.patch("superset.models.core.DB_CONNECTION_MUTATOR")
    def test_dashboard_injected_exceptions(self, mock_db_connection_mutator):
        """
        Handle injected exceptions from the db mutator
        """

        # Assert we can handle a custom excetion at the mutator level
        exception = SupersetException("Error message")
        mock_db_connection_mutator.side_effect = exception
        dash = db.session.query(Dashboard).first()
        url = f"/superset/dashboard/{dash.id}/"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)

        # Assert we can handle a driver exception at the mutator level
        exception = SQLAlchemyError("Error message")
        mock_db_connection_mutator.side_effect = exception
        dash = db.session.query(Dashboard).first()
        url = f"/superset/dashboard/{dash.id}/"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)


if __name__ == "__main__":
    unittest.main()
