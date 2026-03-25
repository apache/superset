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
from superset.extensions import cache_manager
from superset.models import core as models
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sql.parse import Table
from superset.utils import core as utils, json
from superset.utils.core import backend
from superset.utils.database import get_example_database
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.test_app import app

from .base_tests import SupersetTestCase

logger = logging.getLogger(__name__)


@pytest.fixture(scope="module")
def cleanup():
    db.session.query(Query).delete()
    db.session.query(models.Log).delete()
    db.session.commit()
    return


class TestCore(SupersetTestCase):
    def setUp(self):
        self.table_ids = {
            tbl.table_name: tbl.id for tbl in (db.session.query(SqlaTable).all())
        }

    def tearDown(self):
        db.session.query(Query).delete()
        super().tearDown()

    def insert_dashboard_created_by(self, username: str) -> Dashboard:
        user = self.get_user(username)
        dashboard = self.insert_dashboard(
            f"create_title_test",  # noqa: F541
            f"create_slug_test",  # noqa: F541
            [user.id],
            created_by=user,
        )
        return dashboard

    @pytest.fixture
    def insert_dashboard_created_by_gamma(self):
        dashboard = self.insert_dashboard_created_by("gamma")
        yield dashboard
        db.session.delete(dashboard)
        db.session.commit()

    def test_dashboard_endpoint(self):
        self.login(ADMIN_USERNAME)
        resp = self.client.get("/superset/dashboard/-1/")
        assert resp.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_endpoint(self):
        self.login(ADMIN_USERNAME)
        resp = self.client.get("/superset/slice/-1/")
        assert resp.status_code == 404

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_viz_cache_key(self):
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Life Expectancy VS Rural %")

        viz = slc.viz
        qobj = viz.query_obj()
        cache_key = viz.cache_key(qobj)

        qobj["groupby"] = []
        cache_key_with_groupby = viz.cache_key(qobj)
        assert cache_key != cache_key_with_groupby

        assert viz.cache_key(qobj) != viz.cache_key(qobj, time_compare="12 weeks")

        assert viz.cache_key(qobj, time_compare="28 days") != viz.cache_key(
            qobj, time_compare="12 weeks"
        )

        qobj["inner_from_dttm"] = datetime.datetime(1901, 1, 1)

        assert cache_key_with_groupby == viz.cache_key(qobj)

    def test_admin_only_menu_views(self):
        def assert_admin_view_menus_in(role_name, assert_func):
            role = security_manager.find_role(role_name)
            view_menus = [p.view_menu.name for p in role.permissions]
            assert_func("ResetPasswordView", view_menus)
            assert_func("RoleRestAPI", view_menus)
            assert_func("Security", view_menus)
            assert_func("SQL Lab", view_menus)

        assert_admin_view_menus_in("Admin", self.assertIn)
        assert_admin_view_menus_in("Alpha", self.assertNotIn)
        assert_admin_view_menus_in("Gamma", self.assertNotIn)

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_save_slice(self):
        self.login(ADMIN_USERNAME)
        slice_name = f"Energy Sankey"  # noqa: F541
        slice_id = self.get_slice(slice_name).id
        copy_name_prefix = "Test Sankey"
        copy_name = f"{copy_name_prefix}[save]{random.random()}"  # noqa: S311
        tbl_id = self.table_ids.get("energy_usage")
        new_slice_name = f"{copy_name_prefix}[overwrite]{random.random()}"  # noqa: S311

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
        new_slice_id = resp.json["form_data"]["slice_id"]
        slc = db.session.query(Slice).filter_by(id=new_slice_id).one()

        assert slc.slice_name == copy_name
        form_data["datasource"] = f"{tbl_id}__table"
        form_data["slice_id"] = new_slice_id

        assert slc.form_data == form_data
        form_data.pop("slice_id")  # We don't save the slice id when saving as

        form_data = {
            "adhoc_filters": [],
            "datasource": f"{tbl_id}__table",
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
        slc = db.session.query(Slice).filter_by(id=new_slice_id).one()
        assert slc.slice_name == new_slice_name
        assert slc.form_data == form_data

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
        self.login(ADMIN_USERNAME)
        slc = self.get_slice(slice_name="Top 10 Girl Name Share")
        slc_data_attributes = slc.data.keys()
        assert "changed_on" in slc_data_attributes
        assert "modified" in slc_data_attributes
        assert "owners" in slc_data_attributes

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_slices(self):
        # Testing by hitting the two supported end points for all slices
        self.login(ADMIN_USERNAME)
        Slc = Slice  # noqa: N806
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, "explore", slc.slice_url),
            ]
        for name, method, url in urls:
            logger.info(f"[{name}]/[{method}]: {url}")
            print(f"[{name}]/[{method}]: {url}")
            resp = self.client.get(url)
            assert resp.status_code == 200

    def test_add_slice(self):
        self.login(ADMIN_USERNAME)
        # assert that /chart/add responds with 200
        url = "/chart/add"
        resp = self.client.get(url)
        assert resp.status_code == 200

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_slices_V2(self):  # noqa: N802
        # Add explore-v2-beta role to admin user
        # Test all slice urls as user with explore-v2-beta role
        security_manager.add_role("explore-v2-beta")

        security_manager.add_user(
            "explore_beta",
            "explore_beta",
            " user",
            "explore_beta@airbnb.com",
            security_manager.find_role("explore-v2-beta"),
            password="general",  # noqa: S106
        )
        self.login(username="explore_beta", password="general")  # noqa: S106

        Slc = Slice  # noqa: N806
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

        with mock.patch.dict(
            app.config, {"SQLALCHEMY_CUSTOM_PASSWORD_STORE": custom_password_store}
        ):
            conn = sqla.engine.url.make_url(database.sqlalchemy_uri_decrypted)
            if conn_pre.password:
                assert conn.password == "password_store_test"  # noqa: S105
                assert conn.password != conn_pre.password

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_warm_up_cache_error(self) -> None:
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Pivot Table v2")

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

    def test_gamma(self):
        self.login(GAMMA_USERNAME)
        assert "Charts" in self.get_resp("/chart/list/")
        assert "Dashboards" in self.get_resp("/dashboard/list/")

    def test_templated_sql_json(self):
        if superset.utils.database.get_example_database().backend == "presto":
            # TODO: make it work for presto
            return
        self.login(ADMIN_USERNAME)
        sql = "SELECT '{{ 1+1 }}' as test"
        data = self.run_sql(sql, "fdaklj3ws")
        assert data["data"][0]["test"] == "2"

    def test_fetch_datasource_metadata(self):
        self.login(ADMIN_USERNAME)
        url = "/superset/fetch_datasource_metadata?datasourceKey=1__table"
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
            assert k in resp.keys()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # explore case
        self.login(ADMIN_USERNAME)
        slc = db.session.query(Slice).filter_by(slice_name="Girls").one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        self.get_resp(slc.slice_url)
        assert 1 == qry.count()

    def create_sample_csvfile(self, filename: str, content: list[str]) -> None:
        with open(filename, "w+") as test_file:
            for l in content:  # noqa: E741
                test_file.write(f"{l}\n")

    def create_sample_excelfile(self, filename: str, content: dict[str, str]) -> None:
        pd.DataFrame(content).to_excel(filename)

    def enable_csv_upload(self, database: models.Database) -> None:
        """Enables csv upload in the given database."""
        database.allow_file_upload = True
        db.session.commit()
        add_datasource_page = self.get_resp("/databaseview/list/")
        assert "Upload a CSV" in add_datasource_page

    def test_dataframe_timezone(self):
        tz = pytz.FixedOffset(60)
        data = [
            (datetime.datetime(2017, 11, 18, 21, 53, 0, 219225, tzinfo=tz),),
            (datetime.datetime(2017, 11, 18, 22, 6, 30, tzinfo=tz),),
        ]
        results = SupersetResultSet(list(data), [["data"]], BaseEngineSpec)
        df = results.to_pandas_df()
        data = dataframe.df_to_records(df)
        json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
        self.assertDictEqual(  # noqa: PT009
            data[0], {"data": pd.Timestamp("2017-11-18 21:53:00.219225+0100", tz=tz)}
        )
        self.assertDictEqual(  # noqa: PT009
            data[1], {"data": pd.Timestamp("2017-11-18 22:06:30+0100", tz=tz)}
        )
        assert (
            json_str
            == '[{"data": "2017-11-18T21:53:00.219225+01:00"}, {"data": "2017-11-18T22:06:30+01:00"}]'  # noqa: E501
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
        assert len(data) == 2
        assert data[0] == {
            "col1": 1,
            "col2": 1,
            "col3": pd.Timestamp("2017-10-19 23:39:16.660000"),
        }

    def test_comments_in_sqlatable_query(self):
        clean_query = "SELECT\n  '/* val 1 */' AS c1,\n  '-- val 2' AS c2\nFROM tbl"
        commented_query = "/* comment 1 */" + clean_query + "-- comment 2"
        table = SqlaTable(
            table_name="test_comments_in_sqlatable_query_table",
            sql=commented_query,
            database=get_example_database(),
        )
        rendered_query = str(table.get_from_clause()[0])
        assert "comment 1" in rendered_query
        assert "comment 2" in rendered_query
        assert "FROM tbl" in rendered_query

    def test_slice_payload_no_datasource(self):
        form_data = {
            "viz_type": "dist_bar",
        }
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            "/superset/explore_json/",
            data={"form_data": json.dumps(form_data)},
        )
        data = json.loads(rv.data.decode("utf-8"))

        assert (
            data["errors"][0]["message"]
            == "The dataset associated with this chart no longer exists"
        )

    def test_explore_json_data_invalid_cache_key(self):
        self.login(ADMIN_USERNAME)
        cache_key = "invalid-cache-key"
        rv = self.client.get(f"/superset/explore_json/data/{cache_key}")
        data = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 404
        assert data["error"] == "Cached data not found"

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
        assert isinstance(serialized_payload, str)

        query_mock = mock.Mock()
        deserialized_payload = superset.views.utils._deserialize_results_payload(
            serialized_payload, query_mock, use_new_deserialization
        )

        self.assertDictEqual(deserialized_payload, payload)  # noqa: PT009
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
        assert isinstance(serialized_payload, bytes)

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

            self.assertDictEqual(deserialized_payload, payload)  # noqa: PT009
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
        self.login(ADMIN_USERNAME)

        encoded = json.dumps(
            {"FOO": lambda x: 1, "super": "set"},
            default=json.pessimistic_json_iso_dttm_ser,
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
            f"/explore/?datasource_type=table&datasource_id={tbl_id}",
        ]
        for url in urls:
            data = self.get_resp(url)
            assert html_string in data

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
        self.login(ADMIN_USERNAME)

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

        assert payload["label"] == "Untitled Query foo"

    def test_tabstate_update(self):
        self.login(ADMIN_USERNAME)
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
        assert response.status_code == 400
        # generate query
        db.session.add(Query(client_id=client_id, database_id=1))
        db.session.commit()
        # update tab state with a valid client_id
        response = self.client.put(f"/tabstateview/{tab_state_id}", data=data)
        assert response.status_code == 200
        # nulls should be ok too
        data["latest_query_id"] = "null"
        response = self.client.put(f"/tabstateview/{tab_state_id}", data=data)
        assert response.status_code == 200

    def test_virtual_table_explore_visibility(self):
        # test that default visibility it set to True
        database = superset.utils.database.get_example_database()
        assert database.allows_virtual_table_explore is True

        # test that visibility is disabled when extra is set to False
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = False
        database.extra = json.dumps(extra)
        assert database.allows_virtual_table_explore is False

        # test that visibility is enabled when extra is set to True
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = True
        database.extra = json.dumps(extra)
        assert database.allows_virtual_table_explore is True

        # test that visibility is not broken with bad values
        extra = database.get_extra()
        extra["allows_virtual_table_explore"] = "trash value"
        database.extra = json.dumps(extra)
        assert database.allows_virtual_table_explore is True

    def test_data_preview_visibility(self):
        # test that default visibility is allowed
        database = utils.get_example_database()
        assert database.disable_data_preview is False

        # test that visibility is disabled when extra is set to true
        extra = database.get_extra()
        extra["disable_data_preview"] = True
        database.extra = json.dumps(extra)
        assert database.disable_data_preview is True

        # test that visibility is enabled when extra is set to false
        extra = database.get_extra()
        extra["disable_data_preview"] = False
        database.extra = json.dumps(extra)
        assert database.disable_data_preview is False

        # test that visibility is not broken with bad values
        extra = database.get_extra()
        extra["disable_data_preview"] = "trash value"
        database.extra = json.dumps(extra)
        assert database.disable_data_preview is False

    def test_disable_drill_to_detail(self):
        # test that disable_drill_to_detail is False by default
        database = utils.get_example_database()
        assert database.disable_drill_to_detail is False

        # test that disable_drill_to_detail can be set to True
        extra = database.get_extra()
        extra["disable_drill_to_detail"] = True
        database.extra = json.dumps(extra)
        assert database.disable_drill_to_detail is True

        # test that disable_drill_to_detail can be set to False
        extra = database.get_extra()
        extra["disable_drill_to_detail"] = False
        database.extra = json.dumps(extra)
        assert database.disable_drill_to_detail is False

        # test that disable_drill_to_detail is not broken with bad values
        extra = database.get_extra()
        extra["disable_drill_to_detail"] = "trash value"
        database.extra = json.dumps(extra)
        assert database.disable_drill_to_detail is False

    def test_explore_database_id(self):
        database = superset.utils.database.get_example_database()
        explore_database = superset.utils.database.get_example_database()

        # test that explore_database_id is the regular database
        # id if none is set in the extra
        assert database.explore_database_id == database.id

        # test that explore_database_id is correct if the extra is set
        extra = database.get_extra()
        extra["explore_database_id"] = explore_database.id
        database.extra = json.dumps(extra)
        assert database.explore_database_id == explore_database.id

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

    @pytest.mark.skip(
        "TODO This test was wrong - 'Error message' was in the language pack"
    )
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

        self.login(ADMIN_USERNAME)
        data = self.get_resp(url)
        assert "Error message" in data

        # Assert we can handle a driver exception at the mutator level
        exception = SQLAlchemyError("Error message")
        mock_db_connection_mutator.side_effect = exception
        slice = db.session.query(Slice).first()
        url = f"/explore/?form_data=%7B%22slice_id%22%3A%20{slice.id}%7D"

        self.login(ADMIN_USERNAME)
        data = self.get_resp(url)
        assert "Error message" in data

    @pytest.mark.skip(
        "TODO This test was wrong - 'Error message' was in the language pack"
    )
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

        self.login(ADMIN_USERNAME)
        data = self.get_resp(url)
        assert "Error message" in data

        # Assert we can handle a driver exception at the mutator level
        exception = SQLAlchemyError("Error message")
        mock_db_connection_mutator.side_effect = exception
        dash = db.session.query(Dashboard).first()
        url = f"/superset/dashboard/{dash.id}/"

        self.login(ADMIN_USERNAME)
        data = self.get_resp(url)
        assert "Error message" in data

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_redirect(self, mock_command: mock.Mock):
        self.login(ADMIN_USERNAME)
        random_key = "random_key"
        mock_command.return_value = random_key
        slice_name = f"Energy Sankey"  # noqa: F541
        slice_id = self.get_slice(slice_name).id
        form_data = {"slice_id": slice_id, "viz_type": "line", "datasource": "1__table"}
        rv = self.client.get(
            f"/superset/explore/?form_data={quote(json.dumps(form_data))}"
        )
        assert rv.headers["Location"] == f"/explore/?form_data_key={random_key}"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_has_table(self):
        if backend() in ("sqlite", "mysql"):
            return
        example_db = superset.utils.database.get_example_database()
        assert example_db.has_table(Table("birth_names", "public")) is True

    @mock.patch("superset.views.core.request")
    @mock.patch(
        "superset.commands.dashboard.permalink.get.GetDashboardPermalinkCommand.run"
    )
    def test_dashboard_permalink(self, get_dashboard_permalink_mock, request_mock):
        request_mock.query_string = b"standalone=3"
        get_dashboard_permalink_mock.return_value = {"dashboardId": 1}
        self.login(ADMIN_USERNAME)
        resp = self.client.get("superset/dashboard/p/123/")

        expected_url = "/superset/dashboard/1/?permalink_key=123&standalone=3"

        assert resp.headers["Location"] == expected_url
        assert resp.status_code == 302


class TestLocalePatch(SupersetTestCase):
    MOCK_LANGUAGES = (
        "flask.current_app.config",
        {
            "LANGUAGES": {
                "es": {"flag": "es", "name": "Español"},
            },
        },
    )

    @mock.patch.dict(*MOCK_LANGUAGES)
    def test_lang_redirect(self):
        self.login(GAMMA_USERNAME)
        referer_url = "http://localhost/explore/"
        resp = self.client.get("/lang/es", headers={"Referer": referer_url})

        assert resp.status_code == 302
        assert resp.headers["Location"] == referer_url
        with self.client.session_transaction() as session:
            assert session["locale"] == "es"

    @mock.patch.dict(*MOCK_LANGUAGES)
    def test_lang_invalid_referer(self):
        self.login(GAMMA_USERNAME)
        referer_url = "http://someotherserver/explore/"
        resp = self.client.get("/lang/es", headers={"Referer": referer_url})

        assert resp.status_code == 302
        assert resp.headers["Location"] == "/"
        with self.client.session_transaction() as session:
            assert session["locale"] == "es"

    @mock.patch.dict(*MOCK_LANGUAGES)
    def test_lang_no_referer(self):
        self.login(GAMMA_USERNAME)
        resp = self.client.get("/lang/es")

        assert resp.status_code == 302
        assert resp.headers["Location"] == "/"
        with self.client.session_transaction() as session:
            assert session["locale"] == "es"

    def test_lang_invalid_locale(self):
        self.login(GAMMA_USERNAME)
        resp = self.client.get("/lang/es")

        assert resp.status_code == 500
        with self.client.session_transaction() as session:
            assert session["locale"] == "en"


if __name__ == "__main__":
    unittest.main()
