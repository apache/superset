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
import inspect

from superset import app, appbuilder, security_manager
from .base_tests import SupersetTestCase


def get_perm_tuples(role_name):
    perm_set = set()
    for perm in security_manager.find_role(role_name).permissions:
        perm_set.add((perm.permission.name, perm.view_menu.name))
    return perm_set


class RolePermissionTests(SupersetTestCase):
    """Testing export import functionality for dashboards"""

    def assert_can_read(self, view_menu, permissions_set):
        self.assertIn(("can_read", view_menu), permissions_set)

    def assert_can_write(self, view_menu, permissions_set):
        self.assertIn(("can_write", view_menu), permissions_set)

    def assert_cannot_write(self, view_menu, permissions_set):
        self.assertNotIn(("can_write", view_menu), permissions_set)

    def assert_can_all(self, view_menu, permissions_set):
        self.assert_can_read(view_menu, permissions_set)
        self.assert_can_write(view_menu, permissions_set)

    def assert_cannot_gamma(self, perm_set):
        self.assert_cannot_write("DruidColumnInlineView", perm_set)

    def assert_can_gamma(self, perm_set):
        self.assert_can_read("Database", perm_set)
        self.assert_can_read("Datasource", perm_set)

        # make sure that user can create slices and dashboards
        self.assert_can_all("Slice", perm_set)
        self.assert_can_all("Dashboard", perm_set)

        self.assertIn(("can_add_slices", "Superset"), perm_set)
        self.assertIn(("can_copy_dash", "Superset"), perm_set)
        self.assertIn(("can_created_dashboards", "Superset"), perm_set)
        self.assertIn(("can_created_slices", "Superset"), perm_set)
        self.assertIn(("can_csv", "Superset"), perm_set)
        self.assertIn(("can_dashboard", "Superset"), perm_set)
        self.assertIn(("can_explore", "Superset"), perm_set)
        self.assertIn(("can_explore_json", "Superset"), perm_set)
        self.assertIn(("can_fave_dashboards", "Superset"), perm_set)
        self.assertIn(("can_fave_slices", "Superset"), perm_set)
        self.assertIn(("can_save_dash", "Superset"), perm_set)
        self.assertIn(("can_slice", "Superset"), perm_set)
        self.assertIn(("can_explore", "Superset"), perm_set)
        self.assertIn(("can_explore_json", "Superset"), perm_set)
        self.assertIn(("can_userinfo", "UserDBModelView"), perm_set)

    def assert_can_alpha(self, perm_set):
        self.assert_can_all("Datasource", perm_set)

        self.assertIn(("all_datasource_access", "all_datasource_access"), perm_set)
        self.assertIn(("muldelete", "DruidDatasourceModelView"), perm_set)

    def assert_cannot_alpha(self, perm_set):
        if app.config.get("ENABLE_ACCESS_REQUEST"):
            self.assert_cannot_write("AccessRequestsModelView", perm_set)
            self.assert_can_all("AccessRequestsModelView", perm_set)
        self.assert_cannot_write("Queries", perm_set)
        self.assert_cannot_write("RoleModelView", perm_set)
        self.assert_cannot_write("UserDBModelView", perm_set)

    def assert_can_admin(self, perm_set):
        self.assert_can_all("Database", perm_set)
        self.assertIn(("can_edit", "RoleModelView"), perm_set)
        self.assertIn(("can_show", "RoleModelView"), perm_set)
        self.assertIn(("can_edit", "UserDBModelView"), perm_set)
        self.assertIn(("can_show", "UserDBModelView"), perm_set)

        self.assertIn(("all_database_access", "all_database_access"), perm_set)
        self.assertIn(("can_override_role_permissions", "Superset"), perm_set)
        self.assertIn(("can_sync_druid_source", "Superset"), perm_set)
        self.assertIn(("can_override_role_permissions", "Superset"), perm_set)
        self.assertIn(("can_approve", "Superset"), perm_set)

    def test_is_admin_only(self):
        self.assertFalse(
            security_manager.is_admin_only(
                security_manager.find_permission_view_menu("can_read", "Datasource")
            )
        )
        self.assertFalse(
            security_manager.is_admin_only(
                security_manager.find_permission_view_menu(
                    "all_datasource_access", "all_datasource_access"
                )
            )
        )

        self.assertTrue(
            security_manager.is_admin_only(
                security_manager.find_permission_view_menu("can_delete", "Database")
            )
        )
        if app.config.get("ENABLE_ACCESS_REQUEST"):
            self.assertTrue(
                security_manager.is_admin_only(
                    security_manager.find_permission_view_menu(
                        "can_read", "AccessRequestsModelView"
                    )
                )
            )
        self.assertTrue(
            security_manager.is_admin_only(
                security_manager.find_permission_view_menu(
                    "can_edit", "UserDBModelView"
                )
            )
        )
        self.assertTrue(
            security_manager.is_admin_only(
                security_manager.find_permission_view_menu("can_approve", "Superset")
            )
        )

    def test_is_alpha_only(self):
        self.assertFalse(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu("can_read", "Datasource")
            )
        )

        self.assertTrue(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu("muldelete", "Datasource")
            )
        )
        self.assertTrue(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu(
                    "all_datasource_access", "all_datasource_access"
                )
            )
        )
        self.assertTrue(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu("can_edit", "Datasource")
            )
        )
        self.assertTrue(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu("can_delete", "Datasource")
            )
        )
        self.assertTrue(
            security_manager.is_alpha_only(
                security_manager.find_permission_view_menu(
                    "all_database_access", "all_database_access"
                )
            )
        )

    def test_is_gamma_pvm(self):
        self.assertTrue(
            security_manager.is_gamma_pvm(
                security_manager.find_permission_view_menu("can_read", "Datasource")
            )
        )

    def test_gamma_permissions_basic(self):
        self.assert_can_gamma(get_perm_tuples("Gamma"))
        self.assert_cannot_gamma(get_perm_tuples("Gamma"))
        self.assert_cannot_alpha(get_perm_tuples("Alpha"))

    def test_alpha_permissions(self):
        pvms = get_perm_tuples("Alpha")
        self.assert_can_gamma(pvms)
        self.assert_can_alpha(pvms)
        self.assert_cannot_alpha(pvms)

    def test_admin_permissions(self):
        pvms = get_perm_tuples("Admin")
        self.assert_can_gamma(pvms)
        self.assert_can_alpha(pvms)
        self.assert_can_admin(pvms)

    def test_sql_lab_permissions(self):
        sql_lab_set = get_perm_tuples("sql_lab")
        self.assertIn(("can_sql_json", "Superset"), sql_lab_set)
        self.assertIn(("can_csv", "Superset"), sql_lab_set)
        self.assertIn(("can_search_queries", "Superset"), sql_lab_set)

        self.assert_cannot_gamma(sql_lab_set)
        self.assert_cannot_alpha(sql_lab_set)

    def test_granter_permissions(self):
        granter_set = get_perm_tuples("granter")
        self.assertIn(("can_override_role_permissions", "Superset"), granter_set)
        self.assertIn(("can_approve", "Superset"), granter_set)

        self.assert_cannot_gamma(granter_set)
        self.assert_cannot_alpha(granter_set)

    def test_gamma_permissions(self):

        gamma_perm_set = set()
        for perm in security_manager.find_role("Gamma").permissions:
            gamma_perm_set.add((perm.permission.name, perm.view_menu.name))

        def assert_can_read(view_menu):
            self.assertIn(("can_read", view_menu), gamma_perm_set)

        def assert_can_write(view_menu):
            self.assertIn(("can_write", view_menu), gamma_perm_set)

        def assert_cannot_write(view_menu):
            self.assertNotIn(("can_write", view_menu), gamma_perm_set)

        def assert_can_all(view_menu):
            assert_can_read(view_menu)
            assert_can_write(view_menu)

        # check read only perms
        self.assertIn(("can_read", "Datasource"), gamma_perm_set)
        self.assertNotIn(("can_write", "Datasource"), gamma_perm_set)
        self.assertNotIn(("can_edit", "Datasource"), gamma_perm_set)

        # make sure that user can read & write slices and dashboards
        self.assertIn(("can_read", "Slice"), gamma_perm_set)
        self.assertIn(("can_write", "Slice"), gamma_perm_set)
        self.assertIn(("can_read", "Dashboard"), gamma_perm_set)
        self.assertIn(("can_write", "Dashboard"), gamma_perm_set)

        self.assertIn(("can_add_slices", "Superset"), gamma_perm_set)
        self.assertIn(("can_copy_dash", "Superset"), gamma_perm_set)
        self.assertIn(("can_created_dashboards", "Superset"), gamma_perm_set)
        self.assertIn(("can_created_slices", "Superset"), gamma_perm_set)
        self.assertIn(("can_csv", "Superset"), gamma_perm_set)
        self.assertIn(("can_dashboard", "Superset"), gamma_perm_set)
        self.assertIn(("can_explore", "Superset"), gamma_perm_set)
        self.assertIn(("can_explore_json", "Superset"), gamma_perm_set)
        self.assertIn(("can_fave_dashboards", "Superset"), gamma_perm_set)
        self.assertIn(("can_fave_slices", "Superset"), gamma_perm_set)
        self.assertIn(("can_save_dash", "Superset"), gamma_perm_set)
        self.assertIn(("can_slice", "Superset"), gamma_perm_set)
        self.assertIn(("can_userinfo", "UserDBModelView"), gamma_perm_set)

    def test_views_are_secured(self):
        """Preventing the addition of unsecured views without has_access decorator"""
        # These FAB views are secured in their body as opposed to by decorators
        method_whitelist = ("action", "action_post")
        # List of redirect & other benign views
        views_whitelist = [
            ["MyIndexView", "index"],
            ["UtilView", "back"],
            ["LocaleView", "index"],
            ["AuthDBView", "login"],
            ["AuthDBView", "logout"],
            ["R", "index"],
            ["Superset", "log"],
            ["Superset", "theme"],
            ["Superset", "welcome"],
            ["SecurityApi", "login"],
            ["SecurityApi", "refresh"],
        ]
        unsecured_views = []
        for view_class in appbuilder.baseviews:
            class_name = view_class.__class__.__name__
            for name, value in inspect.getmembers(
                view_class, predicate=inspect.ismethod
            ):
                if (
                    name not in method_whitelist
                    and [class_name, name] not in views_whitelist
                    and hasattr(value, "_urls")
                    and not hasattr(value, "_permission_name")
                ):
                    unsecured_views.append((class_name, name))
        if unsecured_views:
            view_str = "\n".join([str(v) for v in unsecured_views])
            raise Exception(f"Some views are not secured:\n{view_str}")
