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
import datetime
import doctest
import html
import json
import logging
import random
import unittest
from unittest import mock
from urllib.parse import quote

import pandas as pd
import pytest
import pytz
import sqlalchemy as sqla
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError

import superset.utils.database
import superset.views.utils
from superset import dataframe, db, security_manager, sql_lab
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.common.db_query_status import QueryStatus
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.exceptions import SupersetException
from superset.extensions import async_query_manager_factory, cache_manager
from superset.models import core as models
from superset.models.cache import CacheKey
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.utils import core as utils
from superset.utils.core import backend
from superset.utils.database import get_example_database
from superset.views.database.views import DatabaseView
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,
    load_energy_table_with_slice,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app

from .base_tests import SupersetTestCase

logger = logging.getLogger(__name__)


@pytest.fixture(scope="module")
def cleanup():
    db.session.query(Query).delete()
    db.session.query(models.Log).delete()
    db.session.commit()
    yield


class TestCore(SupersetTestCase):
    def setUp(self):
        self.table_ids = {
            tbl.table_name: tbl.id for tbl in (db.session.query(SqlaTable).all())
        }
        self.original_unsafe_db_setting = app.config["PREVENT_UNSAFE_DB_CONNECTIONS"]

    def tearDown(self):
        db.session.query(Query).delete()
        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = self.original_unsafe_db_setting

    def insert_dashboard_created_by(self, username: str) -> Dashboard:
        user = self.get_user(username)
        dashboard = self.insert_dashboard(
            f"create_title_test",
            f"create_slug_test",
            [user.id],
            created_by=user,
        )
        return dashboard

    @pytest.fixture()
    def insert_dashboard_created_by_gamma(self):
        dashboard = self.insert_dashboard_created_by("gamma")
        yield dashboard
        db.session.delete(dashboard)
        db.session.commit()

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
        resp = self.client.get("/superset/slice/-1/")
        assert resp.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_viz_cache_key(self):
        self.login(username="admin")
        slc = self.get_slice("Top 10 Girl Name Share", db.session)

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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_data(self):
        # slice data should have some required attributes
        self.login(username="admin")
        slc = self.get_slice(
            slice_name="Top 10 Girl Name Share",
            session=db.session,
            expunge_from_session=False,
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

    def test_add_slice(self):
        self.login(username="admin")
        # assert that /chart/add responds with 200
        url = "/chart/add"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_get_user_slices(self):
        self.login(username="admin")
        userid = security_manager.find_user("admin").id
        url = f"/sliceasync/api/read?_flt_0_created_by={userid}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_slices_V2(self):
        # Add explore-v2-beta role to admin user
        # Test all slice urls as user with explore-v2-beta role
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

    def test_custom_password_store(self):
        database = superset.utils.database.get_example_database()
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
        database = superset.utils.database.get_example_database()
        sqlalchemy_uri_decrypted = database.sqlalchemy_uri_decrypted
        url = f"databaseview/edit/{database.id}"
        data = {k: database.__getattribute__(k) for k in DatabaseView.add_columns}
        data["sqlalchemy_uri"] = database.safe_sqlalchemy_uri()
        self.client.post(url, data=data)
        database = superset.utils.database.get_example_database()
        self.assertEqual(sqlalchemy_uri_decrypted, database.sqlalchemy_uri_decrypted)

        # Need to clean up after ourselves
        database.impersonate_user = False
        database.allow_dml = False
        database.allow_run_async = False
        db.session.commit()

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices",
        "load_energy_table_with_slice",
    )
    def test_warm_up_cache(self):
        self.login()
        slc = self.get_slice("Top 10 Girl Name Share", db.session)
        data = self.get_json_resp(f"/superset/warm_up_cache?slice_id={slc.id}")
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
    def test_warm_up_cache_error(self) -> None:
        self.login()
        slc = self.get_slice("Pivot Table v2", db.session)

        with mock.patch.object(
            ChartDataCommand,
            "run",
            side_effect=ChartDataQueryFailedError(
                _(
                    "Error: %(error)s",
                    error=_("Empty query?"),
                )
            ),
        ):
            assert self.get_json_resp(f"/superset/warm_up_cache?slice_id={slc.id}") == [
                {
                    "slice_id": slc.id,
                    "viz_error": "Error: Empty query?",
                    "viz_status": None,
                }
            ]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_cache_logging(self):
        self.login("admin")
        store_cache_keys = app.config["STORE_CACHE_KEYS_IN_METADATA_DB"]
        app.config["STORE_CACHE_KEYS_IN_METADATA_DB"] = True
        slc = self.get_slice("Top 10 Girl Name Share", db.session)
        self.get_json_resp(f"/superset/warm_up_cache?slice_id={slc.id}")
        ck = db.session.query(CacheKey).order_by(CacheKey.id.desc()).first()
        assert ck.datasource_uid == f"{slc.table.id}__table"
        db.session.delete(ck)
        app.config["STORE_CACHE_KEYS_IN_METADATA_DB"] = store_cache_keys

    def test_redirect_invalid(self):
        model_url = models.Url(url="hhttp://invalid.com")
        db.session.add(model_url)
        db.session.commit()

        self.login(username="admin")
        response = self.client.get(f"/r/{model_url.id}")
        assert response.headers["Location"] == "/"
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

        resp = self.client.get(f"/kv/{kv.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(json.loads(value), json.loads(resp.data.decode("utf-8")))

    def test_gamma(self):
        self.login(username="gamma")
        assert "Charts" in self.get_resp("/chart/list/")
        assert "Dashboards" in self.get_resp("/dashboard/list/")

    def test_templated_sql_json(self):
        if superset.utils.database.get_example_database().backend == "presto":
            # TODO: make it work for presto
            return
        self.login()
        sql = "SELECT '{{ 1+1 }}' as test"
        data = self.run_sql(sql, "fdaklj3ws")
        self.assertEqual(data["data"][0]["test"], "2")

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
    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # explore case
        self.login("admin")
        slc = db.session.query(Slice).filter_by(slice_name="Girls").one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        self.get_resp(slc.slice_url)
        self.assertEqual(1, qry.count())

    def create_sample_csvfile(self, filename: str, content: list[str]) -> None:
        with open(filename, "w+") as test_file:
            for l in content:
                test_file.write(f"{l}\n")

    def create_sample_excelfile(self, filename: str, content: dict[str, str]) -> None:
        pd.DataFrame(content).to_excel(filename)

    def enable_csv_upload(self, database: models.Database) -> None:
        """Enables csv upload in the given database."""
        database.allow_file_upload = True
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
        rendered_query = str(table.get_from_clause()[0])
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
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/",
            data={"form_data": json.dumps(form_data)},
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
            "/superset/explore_json/",
            data={"form_data": json.dumps(form_data)},
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
            username="admin",
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
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        self.login(username="admin")
        rv = self.client.post(
            "/superset/explore_json/",
            data={"form_data": json.dumps(form_data)},
        )
        data = json.loads(rv.data.decode("utf-8"))
        keys = list(data.keys())

        # If chart is cached, it will return 200, otherwise 202
        assert rv.status_code in {200, 202}
        if rv.status_code == 202:
            assert keys == [
                "channel_id",
                "job_id",
                "user_id",
                "status",
                "errors",
                "result_url",
            ]

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
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
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
        # feature flags are cached
        cache_manager.cache.clear()
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
            "/superset/welcome",
            f"/superset/dashboard/{dash_id}/",
            "/superset/profile/",
            f"/explore/?datasource_type=table&datasource_id={tbl_id}",
        ]
        for url in urls:
            data = self.get_resp(url)
            self.assertTrue(html_string in data)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"SQLLAB_BACKEND_PERSISTENCE": True},
        clear=True,
    )
    def test_tabstate_with_name(self):
        """
        The tabstateview endpoint GET should be able to take name or title
        for backward compatibility
        """
        username = "admin"
        self.login(username)

        # create a tab
        data = {
            "queryEditor": json.dumps(
                {
                    "name": "Untitled Query foo",
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
        payload = self.get_json_resp(f"/tabstateview/{tab_state_id}")

        self.assertEqual(payload["label"], "Untitled Query foo")

    def test_tabstate_update(self):
        username = "admin"
        self.login(username)
        # create a tab
        data = {
            "queryEditor": json.dumps(
                {
                    "name": "Untitled Query foo",
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
        # update tab state with non-existing client_id
        client_id = "asdfasdf"
        data = {"sql": json.dumps("select 1"), "latest_query_id": json.dumps(client_id)}
        response = self.client.put(f"/tabstateview/{tab_state_id}", data=data)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"], "Bad request")
        # generate query
        db.session.add(Query(client_id=client_id, database_id=1))
        db.session.commit()
        # update tab state with a valid client_id
        response = self.client.put(f"/tabstateview/{tab_state_id}", data=data)
        self.assertEqual(response.status_code, 200)
        # nulls should be ok too
        data["latest_query_id"] = "null"
        response = self.client.put(f"/tabstateview/{tab_state_id}", data=data)
        self.assertEqual(response.status_code, 200)

    def test_virtual_table_explore_visibility(self):
        # test that default visibility it set to True
        database = superset.utils.database.get_example_database()
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

    def test_data_preview_visibility(self):
        # test that default visibility is allowed
        database = utils.get_example_database()
        self.assertEqual(database.disable_data_preview, False)

        # test that visibility is disabled when extra is set to true
        extra = database.get_extra()
        extra["disable_data_preview"] = True
        database.extra = json.dumps(extra)
        self.assertEqual(database.disable_data_preview, True)

        # test that visibility is enabled when extra is set to false
        extra = database.get_extra()
        extra["disable_data_preview"] = False
        database.extra = json.dumps(extra)
        self.assertEqual(database.disable_data_preview, False)

        # test that visibility is not broken with bad values
        extra = database.get_extra()
        extra["disable_data_preview"] = "trash value"
        database.extra = json.dumps(extra)
        self.assertEqual(database.disable_data_preview, False)

    def test_explore_database_id(self):
        database = superset.utils.database.get_example_database()
        explore_database = superset.utils.database.get_example_database()

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
        url = f"/explore/?form_data=%7B%22slice_id%22%3A%20{slice.id}%7D"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)

        # Assert we can handle a driver exception at the mutator level
        exception = SQLAlchemyError("Error message")
        mock_db_connection_mutator.side_effect = exception
        slice = db.session.query(Slice).first()
        url = f"/explore/?form_data=%7B%22slice_id%22%3A%20{slice.id}%7D"

        self.login()
        data = self.get_resp(url)
        self.assertIn("Error message", data)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @mock.patch("superset.models.core.DB_CONNECTION_MUTATOR")
    def test_dashboard_injected_exceptions(self, mock_db_connection_mutator):
        """
        Handle injected exceptions from the db mutator
        """

        # Assert we can handle a custom exception at the mutator level
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

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_redirect(self, mock_command: mock.Mock):
        self.login(username="admin")
        random_key = "random_key"
        mock_command.return_value = random_key
        slice_name = f"Energy Sankey"
        slice_id = self.get_slice(slice_name, db.session).id
        form_data = {"slice_id": slice_id, "viz_type": "line", "datasource": "1__table"}
        rv = self.client.get(
            f"/superset/explore/?form_data={quote(json.dumps(form_data))}"
        )
        self.assertEqual(
            rv.headers["Location"], f"/explore/?form_data_key={random_key}"
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_has_table_by_name(self):
        if backend() in ("sqlite", "mysql"):
            return
        example_db = superset.utils.database.get_example_database()
        assert (
            example_db.has_table_by_name(table_name="birth_names", schema="public")
            is True
        )

    def test_redirect_new_profile(self):
        self.login(username="admin")
        resp = self.client.get("/superset/profile/")
        assert resp.status_code == 302

    def test_redirect_new_sqllab(self):
        self.login(username="admin")
        resp = self.client.get(
            "/superset/sqllab?savedQueryId=1&testParams=2",
            follow_redirects=True,
        )
        assert resp.request.path == "/sqllab/"
        assert (
            resp.request.query_string.decode("utf-8") == "savedQueryId=1&testParams=2"
        )

        resp = self.client.post("/superset/sqllab/")
        assert resp.status_code == 302

    def test_redirect_new_sqllab_history(self):
        self.login(username="admin")
        resp = self.client.get("/superset/sqllab/history/")
        assert resp.status_code == 302


if __name__ == "__main__":
    unittest.main()
