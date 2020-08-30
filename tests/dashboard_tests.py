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
import json
import unittest
from random import random

from flask import escape, url_for
from pytest import mark
from sqlalchemy import func

import tests.test_app
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

from .base_tests import SupersetTestCase
from .dashboards import utils as dashboard_utils

GET_DASHBOARDS_URL = "/api/v1/dashboard/"
GET_DASHBOARD_URL_FORMAT = "/superset/dashboard/{}/"
GET_DASHBOARD_URL_FORMAT = "/superset/dashboard/{}/"
DELETE_DASHBOARD_URL_FORMAT = "/dashboard/delete/{}"
SAVE_DASHBOARD_URL_FORMAT = "/superset/save_dash/{}/"
COPY_DASHBOARD_URL_FORMAT = "/superset/copy_dash/{}/"
NEW_DASHBOARD_URL = "/dashboard/new/"
GET_CHARTS_URL = "/api/v1/chart/"
ADD_SLICES_URL_FORMAT = "/superset/add_slices/{}/"

GAMMA_ROLE_NAME = "Gamma"

ADMIN_USERNAME = "admin"
ALPHA_USERNAME = "alpha"
GAMMA_USERNAME = "gamma"

DEFAULT_ACCESSIABLE_TABLE = "birth_names"
DASHBOARD_SLUG_OF_ACCESSABLE_TABLE = "births"
DEFAULT_DASHBOARD_SLUG_TO_TEST = "births"


class TestDashboard(SupersetTestCase):
    def tearDown(self) -> None:
        self.logout()

    def get_mock_positions(self, dash):
        positions = {"DASHBOARD_VERSION_KEY": "v2"}
        for i, slc in enumerate(dash.slices):
            id = "DASHBOARD_CHART_TYPE-{}".format(i)
            d = {
                "type": "CHART",
                "id": id,
                "children": [],
                "meta": {"width": 4, "height": 50, "chartId": slc.id},
            }
            positions[id] = d
        return positions

    def test_dashboard_access__admin_can_access_all(self):
        # arrange
        self.login(username=ADMIN_USERNAME)
        dashboard_title_by_url = {
            dash.url: dash.dashboard_title for dash in db.session.query(Dashboard).all()
        }

        # call
        responses_by_url = {
            url: self.client.get(url).data.decode("utf-8")
            for url in dashboard_title_by_url.keys()
        }

        # assert
        for dashboard_url, get_dashboard_response in responses_by_url.items():
            assert (
                escape(dashboard_title_by_url[dashboard_url]) in get_dashboard_response
            )

    def test_dashboard_access_with_created_by_can_be_accessed_by_public_users(self):
        # arrange
        self.logout()
        the_accessed_table_name = DEFAULT_ACCESSIABLE_TABLE
        the_accessed_dashboard_slug = DASHBOARD_SLUG_OF_ACCESSABLE_TABLE
        table_to_access = (
            db.session.query(SqlaTable)
            .filter_by(table_name=the_accessed_table_name)
            .one()
        )
        dashboard_to_access = (
            db.session.query(Dashboard)
            .filter_by(slug=the_accessed_dashboard_slug)
            .one()
        )
        original_owners = dashboard_to_access.owners
        original_created_by = dashboard_to_access.created_by
        admin_user = security_manager.find_user(ADMIN_USERNAME)
        dashboard_to_access.owners = [admin_user]
        dashboard_to_access.created_by = admin_user
        db.session.merge(dashboard_to_access)
        db.session.commit()
        self.grant_public_access_to_table(table_to_access)

        # call
        get_dashboard_response = self.get_resp(dashboard_to_access.url)
        try:
            # assert
            assert dashboard_to_access.dashboard_title in get_dashboard_response
        finally:
            # post test - bring back owner and created_by
            self.revoke_public_access_to_table(table_to_access)
            self.login(username=ADMIN_USERNAME)
            dashboard_to_access.owners = original_owners
            dashboard_to_access.created_by = original_created_by
            db.session.merge(dashboard_to_access)
            db.session.commit()

    def test_dashboard_access_in_edit_and_standalone_modes(self):
        # arrange
        self.login(username=ADMIN_USERNAME)
        dash = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        dashboard_url_with_modes = self.__add_dashboard_mode_parmas(dash.url)

        # call
        resp = self.get_resp(dashboard_url_with_modes)

        # assert
        self.assertIn("editMode&#34;: true", resp)
        self.assertIn("standalone_mode&#34;: true", resp)
        self.assertIn('<body class="standalone">', resp)

    def test_dashboard_url_generation_by_id(self):
        # arrange
        id = 1
        excepted_url = GET_DASHBOARD_URL_FORMAT.format(id)

        # call
        generated_url = url_for("Superset.dashboard", dashboard_id_or_slug=id)

        # assert
        self.assertEqual(generated_url, excepted_url)

    def test_dashboard_url_generation_by_slug(self):
        # arrange
        slug = "some_slug"
        excepted_url = GET_DASHBOARD_URL_FORMAT.format(slug)

        # call
        generated_url = url_for("Superset.dashboard", dashboard_id_or_slug=slug)

        # assert
        self.assertEqual(generated_url, excepted_url)

    def test_new_dashboard(self):
        # arrange
        self.login(username=ADMIN_USERNAME)
        dash_count_before_new = db.session.query(func.count(Dashboard.id)).first()[0]
        excepted_dashboard_title_in_response = "[ untitled dashboard ]"

        # call
        post_new_dashboard_response = self.get_resp(NEW_DASHBOARD_URL)

        # assert
        self.assertIn(excepted_dashboard_title_in_response, post_new_dashboard_response)
        dash_count_after_new = db.session.query(func.count(Dashboard.id)).first()[0]
        self.assertEqual(dash_count_before_new + 1, dash_count_after_new)
        dash = db.session.query(Dashboard).filter_by(id=dash_count_after_new)[0]
        dashboard_utils.assert_permission_was_created(self, dash)

        # post test - delete the new dashboard

    def test_delete_dashboard(self):
        # arrange
        self.login(username=ADMIN_USERNAME)
        dash_count_before_new = db.session.query(func.count(Dashboard.id)).first()[0]
        excepted_dashboard_title_in_response = "[ untitled dashboard ]"
        post_new_dashboard_response = self.get_resp(NEW_DASHBOARD_URL)
        self.assertIn(excepted_dashboard_title_in_response, post_new_dashboard_response)
        dash_count_after_new = db.session.query(func.count(Dashboard.id)).first()[0]
        self.assertEqual(dash_count_before_new + 1, dash_count_after_new)
        dash = db.session.query(Dashboard).filter_by(id=dash_count_after_new)[0]
        dashboard_utils.arrange_to_delete_dashboard_test(dash)

        # call
        self.__delete_dashboard(dash.id)

        # assert
        dash_count_after_delete = db.session.query(func.count(Dashboard.id)).first()[0]
        self.assertEqual(dash_count_before_new, dash_count_after_delete)
        dashboard_utils.assert_permissions_were_deleted(self, dash)
        dashboard_utils.clean_after_delete_dashboard_test()

    def __add_dashboard_mode_parmas(self, dashboard_url):
        full_url = dashboard_url
        if dashboard_url.find("?") == -1:
            full_url += "?"
        else:
            full_url += "&"
        return full_url + "edit=true&standalone=true"

    def test_save_dash(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dashboard_to_edit = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        data_before_change = {
            "positions": dashboard_to_edit.position,
            "dashboard_title": dashboard_to_edit.dashboard_title,
        }
        positions = self.get_mock_positions(dashboard_to_edit)
        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": dashboard_to_edit.dashboard_title,
        }
        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dashboard_to_edit.id)

        # call
        save_dash_response = self.get_resp(
            save_dash_url, data=dict(data=json.dumps(data))
        )

        # assert
        self.assertIn("SUCCESS", save_dash_response)

        # post test
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data_before_change)))

    def test_save_dash_with_filter(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dashboard_slug_to_test_with = DEFAULT_DASHBOARD_SLUG_TO_TEST
        # dashboard_to_edit = db.session.query(Dashboard).filter_by(slug="world_health").first()
        dashboard_to_edit = (
            db.session.query(Dashboard)
            .filter_by(slug=dashboard_slug_to_test_with)
            .first()
        )
        default_filters_before_change = dashboard_to_edit.params_dict.get(
            "default_filters", "{}"
        )
        data_before_change = {
            "positions": dashboard_to_edit.position,
            "dashboard_title": dashboard_to_edit.dashboard_title,
            "default_filters": default_filters_before_change,
        }
        positions = self.get_mock_positions(dashboard_to_edit)
        filters = {str(dashboard_to_edit.slices[0].id): {"region": ["North America"]}}
        default_filters = json.dumps(filters)
        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": dashboard_to_edit.dashboard_title,
            "default_filters": default_filters,
        }

        save_dash_url = "/superset/save_dash/{}/".format(dashboard_to_edit.id)

        # call
        save_dash_response = self.get_resp(
            save_dash_url, data=dict(data=json.dumps(data))
        )

        # assert
        self.assertIn("SUCCESS", save_dash_response)
        updatedDash = (
            db.session.query(Dashboard)
            .filter_by(slug=dashboard_slug_to_test_with)
            .first()
        )
        new_url = updatedDash.url
        self.assertIn("region", new_url)
        get_dash_response = self.get_resp(new_url)
        self.assertIn("North America", get_dash_response)

        # post test - revert changes
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data_before_change)))

    def test_save_dash_with_invalid_filters(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        default_filters_before_change = dash.params_dict.get("default_filters", "{}")
        data_before_change = {
            "positions": dash.position,
            "dashboard_title": dash.dashboard_title,
            "default_filters": default_filters_before_change,
        }
        positions = self.get_mock_positions(dash)
        invalid_filter_slice = {str(99999): {"region": ["North America"]}}
        default_filters = json.dumps(invalid_filter_slice)
        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": dash.dashboard_title,
            "default_filters": default_filters,
        }

        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dash.id)

        # call
        save_dash_response = self.get_resp(
            save_dash_url, data=dict(data=json.dumps(data))
        )

        # assert
        self.assertIn("SUCCESS", save_dash_response)

        updatedDash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        new_url = updatedDash.url
        self.assertNotIn("region", new_url)

        # post test
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data_before_change)))

    def test_save_dash_with_dashboard_title(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        new_title = "new title"
        dashboard_to_be_changed = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        original_title = dashboard_to_be_changed.dashboard_title
        view_menu_id = security_manager.find_view_menu(
            dashboard_to_be_changed.view_name
        ).id
        positions = self.get_mock_positions(dashboard_to_be_changed)
        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": new_title,
        }
        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dashboard_to_be_changed.id)

        # call
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data)))

        # assert
        updatedDash = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        self.assertEqual(updatedDash.dashboard_title, new_title)
        dashboard_utils.assert_permission_kept_and_changed(
            self, updatedDash, view_menu_id
        )

        # post test - bring back dashboard original title
        data["dashboard_title"] = original_title
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data)))

    def test_save_dash_with_colors(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dash = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        positions = self.get_mock_positions(dash)
        new_label_colors = {"data value": "random color"}
        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": dash.dashboard_title,
            "color_namespace": "Color Namespace Test",
            "color_scheme": "Color Scheme Test",
            "label_colors": new_label_colors,
        }
        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dash.id)

        # call
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data)))

        # assert
        updatedDash = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        self.assertIn("color_namespace", updatedDash.json_metadata)
        self.assertIn("color_scheme", updatedDash.json_metadata)
        self.assertIn("label_colors", updatedDash.json_metadata)

        # post test - bring back original dashboard
        del data["color_namespace"]
        del data["color_scheme"]
        del data["label_colors"]
        self.get_resp(save_dash_url, data=dict(data=json.dumps(data)))

    def test_save_dash__only_owners_can_save(self):
        # arrange
        dashboard_to_be_saved = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        alpha_user = security_manager.find_user(ALPHA_USERNAME)

        # arrange before #1
        dashboard_to_be_saved.owners = []
        db.session.merge(dashboard_to_be_saved)
        db.session.commit()
        self.logout()

        # call + assert #1
        self.assertRaises(Exception, self.test_save_dash, ALPHA_USERNAME)

        # arrange before call #2
        dashboard_to_be_saved.owners = [alpha_user]
        db.session.merge(dashboard_to_be_saved)
        db.session.commit()

        # call + assert #2
        self.test_save_dash(ALPHA_USERNAME)

    def test_copy_dash(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dashboard_to_copy = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        original_data = {
            "positions": dashboard_to_copy.position,
            "dashboard_title": dashboard_to_copy.dashboard_title,
            "label_colors": dashboard_to_copy.params_dict.get("label_colors"),
        }
        positions = self.get_mock_positions(dashboard_to_copy)
        new_label_colors = {"data value": "random color"}
        data = {
            "css": "",
            "duplicate_slices": False,
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": "Copy Of Births",
            "color_namespace": "Color Namespace Test",
            "color_scheme": "Color Scheme Test",
            "label_colors": new_label_colors,
        }

        # Save changes to Births dashboard and retrieve updated dash
        dash_id = dashboard_to_copy.id
        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dash_id)
        self.client.post(save_dash_url, data=dict(data=json.dumps(data)))
        dashboard_to_copy = db.session.query(Dashboard).filter_by(id=dash_id).first()
        orig_json_data = dashboard_to_copy.data
        copy_dash_url = COPY_DASHBOARD_URL_FORMAT.format(dash_id)

        # call
        copied_response = self.get_json_resp(
            copy_dash_url, data=dict(data=json.dumps(data))
        )

        # assert - Verify that copy matches original
        self.assertEqual(copied_response["dashboard_title"], "Copy Of Births")
        self.assertEqual(
            copied_response["position_json"], orig_json_data["position_json"]
        )
        self.assertEqual(copied_response["metadata"], orig_json_data["metadata"])
        # check every attribute in each dashboard's slices list,
        # exclude modified and changed_on attribute
        for index, slc in enumerate(orig_json_data["slices"]):
            for key in slc:
                if key not in ["modified", "changed_on", "changed_on_humanized"]:
                    self.assertEqual(slc[key], copied_response["slices"][index][key])

        # post test - bring the original dash and delete the copied one
        self.client.post(save_dash_url, data=dict(data=json.dumps(original_data)))
        copy_dashboard_id = copied_response.get("id")
        self.__delete_dashboard(copy_dashboard_id)

    def __delete_dashboard(self, copy_dashboard_id):
        delete_dashboard_url = DELETE_DASHBOARD_URL_FORMAT.format(copy_dashboard_id)
        self.get_resp(delete_dashboard_url, {})

    def test_add_slices(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        new_slice = (
            db.session.query(Slice).filter_by(slice_name="Energy Force Layout").first()
        )
        existing_slice = (
            db.session.query(Slice).filter_by(slice_name="Girl Name Cloud").first()
        )
        data = {
            "slice_ids": [new_slice.data["slice_id"], existing_slice.data["slice_id"]]
        }
        add_slices_url = ADD_SLICES_URL_FORMAT.format(dash.id)

        # call
        add_slices_response = self.client.post(
            add_slices_url, data=dict(data=json.dumps(data))
        )

        # assert
        assert "SLICES ADDED" in add_slices_response.data.decode("utf-8")

        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        new_slice = (
            db.session.query(Slice).filter_by(slice_name="Energy Force Layout").first()
        )
        assert new_slice in dash.slices
        assert len(set(dash.slices)) == len(dash.slices)

        # post test - cleaning up
        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        dash.slices = [o for o in dash.slices if o.slice_name != "Energy Force Layout"]
        db.session.commit()

    def test_remove_slices(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)

        dash_to_copy = (
            db.session.query(Dashboard)
            .filter_by(slug=DEFAULT_DASHBOARD_SLUG_TO_TEST)
            .first()
        )
        copy_dash_url = COPY_DASHBOARD_URL_FORMAT.format(dash_to_copy.id)
        data_for_copy = {
            "dashboard_title": "copy of " + dash_to_copy.dashboard_title,
            "duplicate_slices": False,
            "positions": dash_to_copy.position,
        }
        copied_dash_id = self.get_json_resp(
            copy_dash_url, data=dict(data=json.dumps(data_for_copy))
        ).get("id")

        copied_dash_before_removing = (
            db.session.query(Dashboard).filter_by(id=copied_dash_id).first()
        )
        origin_slices_length = len(copied_dash_before_removing.slices)

        positions = self.get_mock_positions(copied_dash_before_removing)
        # remove one chart
        chart_keys = []
        for key in positions.keys():
            if key.startswith("DASHBOARD_CHART_TYPE"):
                chart_keys.append(key)
        positions.pop(chart_keys[0])

        data = {
            "css": "",
            "expanded_slices": {},
            "positions": positions,
            "dashboard_title": copied_dash_before_removing.dashboard_title,
        }

        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(copied_dash_id)
        self.client.post(save_dash_url, data=dict(data=json.dumps(data)))
        copied_dash_after_removing = (
            db.session.query(Dashboard).filter_by(id=copied_dash_id).first()
        )

        # verify slices data
        data = copied_dash_after_removing.data
        self.assertEqual(len(data["slices"]), origin_slices_length - 1)

        # post test - delete the copied dashboard
        self.__delete_dashboard(copied_dash_id)

    def test_get_dashboards__public_user_get_published(self):
        # arrange #1

        the_accessed_table_name = "birth_names"
        not_accessed_table_name = "wb_health_population"
        url_of_the_not_accessed_dashboard = GET_DASHBOARD_URL_FORMAT.format(
            "world_health"
        )
        the_accessed_dashboard_slug = "births"
        table_to_access = (
            db.session.query(SqlaTable)
            .filter_by(table_name=the_accessed_table_name)
            .one()
        )
        dashboard_to_access = (
            db.session.query(Dashboard)
            .filter_by(slug=the_accessed_dashboard_slug)
            .one()
        )
        # Make the births dash published so it can be seen
        dashboard_to_access.published = True
        url_of_the_accessed_dashboard = dashboard_to_access.url
        title_of_the_access_dashboard = dashboard_to_access.dashboard_title
        db.session.merge(dashboard_to_access)
        db.session.commit()

        self.revoke_public_access_to_table(table_to_access)
        self.logout()

        # call #1 - Try access before adding appropriate permissions
        get_charts_response = self.get_resp(GET_CHARTS_URL)
        get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

        # assert #1
        self.assertNotIn(the_accessed_table_name, get_charts_response)
        self.assertNotIn(url_of_the_accessed_dashboard, get_dashboards_response)

        # arrange #2 - grant permissions
        self.grant_access_to_all_dashboards()
        self.grant_public_access_to_table(table_to_access)

        try:
            # call #2 - Try access after adding appropriate permissions.
            get_charts_response = self.get_resp(GET_CHARTS_URL)
            get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

            # assert #2
            self.assertIn(the_accessed_table_name, get_charts_response)
            self.assertIn(url_of_the_accessed_dashboard, get_dashboards_response)
            self.assertIn(
                title_of_the_access_dashboard,
                self.get_resp(url_of_the_accessed_dashboard),
            )
            self.assertNotIn(not_accessed_table_name, get_charts_response)
            self.assertNotIn(url_of_the_not_accessed_dashboard, get_dashboards_response)

        finally:
            self.revoke_public_access_to_table(table_to_access)
            self.revoke_access_to_all_dashboards()

    def test_get_dashboards__users_without_dashboard_permissions_can_not_view_published_dashboards(
        self,
    ):
        # arrange
        accessed_table_name = "energy_usage"
        accessed_table = (
            db.session.query(SqlaTable).filter_by(table_name=accessed_table_name).one()
        )
        # get a slice from the allowed accessed_table
        slice_name_to_add = "Energy Sankey"
        slice_to_add_to_dashboards = (
            db.session.query(Slice).filter_by(slice_name=slice_name_to_add).one()
        )
        self.grant_public_access_to_table(accessed_table)
        try:
            hidden_dash_slug = f"hidden_dash_{random()}"
            published_dash_slug = f"published_dash_{random()}"

            # Create a published and hidden dashboard and add them to the database
            published_dash = Dashboard()
            published_dash.dashboard_title = "Published Dashboard"
            published_dash.slug = published_dash_slug
            published_dash.slices = [slice_to_add_to_dashboards]
            published_dash.published = True
            published_dash_url = published_dash.url

            hidden_dash = Dashboard()
            hidden_dash.dashboard_title = "Hidden Dashboard"
            hidden_dash.slug = hidden_dash_slug
            hidden_dash.slices = [slice_to_add_to_dashboards]
            hidden_dash.published = False
            hidden_dash_url = hidden_dash.url

            db.session.merge(published_dash)
            db.session.merge(hidden_dash)
            db.session.commit()

            # call
            get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

            # assert
            self.assertNotIn(hidden_dash_url, get_dashboards_response)
            self.assertNotIn(published_dash_url, get_dashboards_response)
        finally:
            self.revoke_public_access_to_table(accessed_table)

    def test_get_dashboards__users_with_all_dashboard_access_can_view_published_dashboard(
        self,
    ):
        # arrange
        accessed_table_name = "energy_usage"
        accessed_table = (
            db.session.query(SqlaTable).filter_by(table_name=accessed_table_name).one()
        )
        # get a slice from the allowed table
        slice_name_to_add = "Energy Sankey"
        slice_to_add_to_dashboards = (
            db.session.query(Slice).filter_by(slice_name=slice_name_to_add).one()
        )
        self.grant_access_to_all_dashboards()
        self.grant_public_access_to_table(accessed_table)
        try:
            hidden_dash_slug = f"hidden_dash_{random()}"
            published_dash_slug = f"published_dash_{random()}"

            # Create a published and hidden dashboard and add them to the database
            published_dash = Dashboard()
            published_dash.dashboard_title = "Published Dashboard"
            published_dash.slug = published_dash_slug
            published_dash.slices = [slice_to_add_to_dashboards]
            published_dash.published = True
            published_dash_url = published_dash.url

            hidden_dash = Dashboard()
            hidden_dash.dashboard_title = "Hidden Dashboard"
            hidden_dash.slug = hidden_dash_slug
            hidden_dash.slices = [slice_to_add_to_dashboards]
            hidden_dash.published = False
            hidden_dash_url = hidden_dash.url

            db.session.merge(published_dash)
            db.session.merge(hidden_dash)
            db.session.commit()

            # call
            get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

            # assert
            self.assertNotIn(hidden_dash_url, get_dashboards_response)
            self.assertIn(published_dash_url, get_dashboards_response)
        finally:
            self.revoke_public_access_to_table(accessed_table)
            self.revoke_access_to_all_dashboards()

    def test_get_dashboards__users_can_view_permitted_dashboard(self):
        # arrange
        accessed_table_name = "energy_usage"
        accessed_table = (
            db.session.query(SqlaTable).filter_by(table_name=accessed_table_name).one()
        )
        self.grant_public_access_to_table(accessed_table)
        # get a slice from the allowed table
        slice_name_to_add = "Energy Sankey"
        slice_to_add_to_dashboards = (
            db.session.query(Slice).filter_by(slice_name=slice_name_to_add).one()
        )
        first_dash_slug = f"first_dash_{random()}"
        second_dash_slug = f"second_dash_{random()}"

        # Create a published and hidden dashboard and add them to the database
        first_dash = Dashboard()
        first_dash.dashboard_title = "Published Dashboard"
        first_dash.slug = first_dash_slug
        first_dash.slices = [slice_to_add_to_dashboards]
        first_dash.published = True
        first_dash_url = first_dash.url

        second_dash = Dashboard()
        second_dash.dashboard_title = "Hidden Dashboard"
        second_dash.slug = second_dash_slug
        second_dash.slices = [slice_to_add_to_dashboards]
        second_dash.published = True
        second_dash_url = second_dash.url

        self.grant_access_to_dashboard(first_dash)
        self.grant_access_to_dashboard(second_dash)

        try:
            db.session.merge(first_dash)
            db.session.merge(second_dash)
            db.session.commit()

            # call
            get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

            # assert
            self.assertIn(second_dash_url, get_dashboards_response)
            self.assertIn(first_dash_url, get_dashboards_response)
        finally:
            db.session.delete(first_dash)
            db.session.delete(second_dash)
            db.session.commit()
            self.revoke_access_to_dashboard(first_dash)
            self.revoke_access_to_dashboard(second_dash)
            self.revoke_public_access_to_table(accessed_table)

    def test_get_dashboards__users_without_dashboard_permission(self):
        # arrange
        accessed_table_name = "energy_usage"
        accessed_table = (
            db.session.query(SqlaTable).filter_by(table_name=accessed_table_name).one()
        )
        # get a slice from the allowed table
        slice_name_to_add = "Energy Sankey"
        slice_to_add_to_dashboards = (
            db.session.query(Slice).filter_by(slice_name=slice_name_to_add).one()
        )
        self.grant_public_access_to_table(accessed_table)
        first_dash_slug = f"first_dash_{random()}"
        second_dash_slug = f"second_dash_{random()}"

        # Create a published and hidden dashboard and add them to the database
        first_dash = Dashboard()
        first_dash.dashboard_title = "Published Dashboard"
        first_dash.slug = first_dash_slug
        first_dash.slices = [slice_to_add_to_dashboards]
        first_dash.published = True
        first_dash_url = first_dash.url

        second_dash = Dashboard()
        second_dash.dashboard_title = "Hidden Dashboard"
        second_dash.slug = second_dash_slug
        second_dash.slices = [slice_to_add_to_dashboards]
        second_dash.published = True
        second_dash_url = second_dash.url

        try:
            db.session.merge(first_dash)
            db.session.merge(second_dash)
            db.session.commit()

            # call
            get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

            # assert
            self.assertNotIn(second_dash_url, get_dashboards_response)
            self.assertNotIn(first_dash_url, get_dashboards_response)
        finally:
            db.session.delete(first_dash)
            db.session.delete(second_dash)
            db.session.commit()
            self.revoke_public_access_to_table(accessed_table)

    def test_get_dashboards__users_are_dsahboards_owners(self):
        # arrange
        user = security_manager.find_user("gamma")
        my_dash_slug = f"my_dash_{random()}"
        not_my_dash_slug = f"not_my_dash_{random()}"

        my_owned_dashboard = Dashboard()
        my_owned_dashboard.dashboard_title = "My Dashboard"
        my_owned_dashboard.slug = my_dash_slug
        my_owned_dashboard.owners = [user]
        my_owned_dashboard.slices = []
        my_owned_dashboard_url = my_owned_dashboard.url

        not_my_owned_dashboard = Dashboard()
        not_my_owned_dashboard.dashboard_title = "Not My Dashboard"
        not_my_owned_dashboard.slug = not_my_dash_slug
        not_my_owned_dashboard.slices = []
        not_my_owned_dashboard.owners = []
        not_my_owned_dashboard_url = not_my_owned_dashboard.url

        db.session.merge(my_owned_dashboard)
        db.session.merge(not_my_owned_dashboard)
        db.session.commit()

        self.login(user.username)

        # call
        get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

        # assert
        self.assertIn(my_owned_dashboard_url, get_dashboards_response)
        self.assertNotIn(not_my_owned_dashboard_url, get_dashboards_response)

    def test_get_dashboards__owners_can_view_empty_dashboard(self):
        # arrange
        dash = db.session.query(Dashboard).filter_by(slug="empty_dashboard").first()
        is_not_exists_dash = not dash
        if is_not_exists_dash:
            dash = Dashboard()
            dash.dashboard_title = "Empty Dashboard"
            dash.slug = "empty_dashboard"
        else:
            dash.slices = []
            dash.owners = []
        dashboard_url = dash.url
        db.session.merge(dash)
        db.session.commit()
        gamma_user = security_manager.find_user("gamma")
        self.login(gamma_user.username)

        # call
        get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

        # assert
        self.assertNotIn(dashboard_url, get_dashboards_response)

    def test_get_dashboards__users_can_view_favorited_dashboards(self):
        # arrange
        user = security_manager.find_user("gamma")
        fav_dash_slug = f"my_favorite_dash_{random()}"
        regular_dash_slug = f"regular_dash_{random()}"

        favorite_dash = Dashboard()
        favorite_dash.dashboard_title = "My Favorite Dashboard"
        favorite_dash.slug = fav_dash_slug

        regular_dash = Dashboard()
        regular_dash.dashboard_title = "A Plain Ol Dashboard"
        regular_dash.slug = regular_dash_slug

        db.session.merge(favorite_dash)
        db.session.merge(regular_dash)
        db.session.commit()

        dash = db.session.query(Dashboard).filter_by(slug=fav_dash_slug).first()

        favorites = models.FavStar()
        favorites.obj_id = dash.id
        favorites.class_name = "Dashboard"
        favorites.user_id = user.id

        db.session.merge(favorites)
        db.session.commit()

        self.login(user.username)

        # call
        get_dashboards_response = self.get_resp(GET_DASHBOARDS_URL)

        # assert
        self.assertIn(f"/superset/dashboard/{fav_dash_slug}/", get_dashboards_response)

    def test_get_dashboards__user_can_not_view_unpublished_dash(self):
        # arrange
        admin_user = security_manager.find_user("admin")
        gamma_user = security_manager.find_user("gamma")
        slug = f"admin_owned_unpublished_dash_{random()}"

        admin_and_not_published_dashboard = Dashboard()
        admin_and_not_published_dashboard.dashboard_title = "My Dashboard"
        admin_and_not_published_dashboard.slug = slug
        admin_and_not_published_dashboard.owners = [admin_user]
        admin_and_not_published_dashboard.slices = []
        admin_and_not_published_dashboard.published = False
        url_of_admin_and_not_published_dashboard = admin_and_not_published_dashboard.url

        db.session.merge(admin_and_not_published_dashboard)
        db.session.commit()

        self.login(gamma_user.username)

        # call - list dashboards as a gamma user
        get_dashboards_response_as_gamma = self.get_resp(GET_DASHBOARDS_URL)

        # assert
        self.assertNotIn(
            url_of_admin_and_not_published_dashboard, get_dashboards_response_as_gamma
        )


if __name__ == "__main__":
    unittest.main()
