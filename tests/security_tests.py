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
import inspect
import unittest
from unittest.mock import Mock, patch

import prison
from flask import g

import tests.test_app
from superset import app, appbuilder, db, security_manager, viz
from superset.connectors.druid.models import DruidCluster, DruidDatasource
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.models.slice import Slice
from superset.sql_parse import Table
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase


def get_perm_tuples(role_name):
    perm_set = set()
    for perm in security_manager.find_role(role_name).permissions:
        perm_set.add((perm.permission.name, perm.view_menu.name))
    return perm_set


SCHEMA_ACCESS_ROLE = "schema_access_role"


def create_schema_perm(view_menu_name: str) -> None:
    permission = "schema_access"
    security_manager.add_permission_view_menu(permission, view_menu_name)
    perm_view = security_manager.find_permission_view_menu(permission, view_menu_name)
    security_manager.add_permission_role(
        security_manager.find_role(SCHEMA_ACCESS_ROLE), perm_view
    )
    return None


def delete_schema_perm(view_menu_name: str) -> None:
    pv = security_manager.find_permission_view_menu("schema_access", "[examples].[2]")
    security_manager.del_permission_role(
        security_manager.find_role(SCHEMA_ACCESS_ROLE), pv
    )
    security_manager.del_permission_view_menu("schema_access", "[examples].[2]")
    return None


class RolePermissionTests(SupersetTestCase):
    """Testing export role permissions."""

    def setUp(self):
        session = db.session
        security_manager.add_role(SCHEMA_ACCESS_ROLE)
        session.commit()

        ds = (
            db.session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )
        ds.schema = "temp_schema"
        ds.schema_perm = ds.get_schema_perm()

        ds_slices = (
            session.query(Slice)
            .filter_by(datasource_type="table")
            .filter_by(datasource_id=ds.id)
            .all()
        )
        for s in ds_slices:
            s.schema_perm = ds.schema_perm
        create_schema_perm("[examples].[temp_schema]")
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        session.commit()

    def tearDown(self):
        session = db.session
        ds = (
            session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )
        schema_perm = ds.schema_perm
        ds.schema = None
        ds.schema_perm = None
        ds_slices = (
            session.query(Slice)
            .filter_by(datasource_type="table")
            .filter_by(datasource_id=ds.id)
            .all()
        )
        for s in ds_slices:
            s.schema_perm = None

        delete_schema_perm(schema_perm)
        session.delete(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        session.commit()

    def test_set_perm_sqla_table(self):
        session = db.session
        table = SqlaTable(
            schema="tmp_schema",
            table_name="tmp_perm_table",
            database=get_example_database(),
        )
        session.add(table)
        session.commit()

        stored_table = (
            session.query(SqlaTable).filter_by(table_name="tmp_perm_table").one()
        )
        self.assertEquals(
            stored_table.perm, f"[examples].[tmp_perm_table](id:{stored_table.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
        )
        self.assertEquals(stored_table.schema_perm, "[examples].[tmp_schema]")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "schema_access", stored_table.schema_perm
            )
        )

        # table name change
        stored_table.table_name = "tmp_perm_table_v2"
        session.commit()
        stored_table = (
            session.query(SqlaTable).filter_by(table_name="tmp_perm_table_v2").one()
        )
        self.assertEquals(
            stored_table.perm, f"[examples].[tmp_perm_table_v2](id:{stored_table.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
        )
        # no changes in schema
        self.assertEquals(stored_table.schema_perm, "[examples].[tmp_schema]")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "schema_access", stored_table.schema_perm
            )
        )

        # schema name change
        stored_table.schema = "tmp_schema_v2"
        session.commit()
        stored_table = (
            session.query(SqlaTable).filter_by(table_name="tmp_perm_table_v2").one()
        )
        self.assertEquals(
            stored_table.perm, f"[examples].[tmp_perm_table_v2](id:{stored_table.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
        )
        # no changes in schema
        self.assertEquals(stored_table.schema_perm, "[examples].[tmp_schema_v2]")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "schema_access", stored_table.schema_perm
            )
        )

        # database change
        new_db = Database(sqlalchemy_uri="some_uri", database_name="tmp_db")
        session.add(new_db)
        stored_table.database = (
            session.query(Database).filter_by(database_name="tmp_db").one()
        )
        session.commit()
        stored_table = (
            session.query(SqlaTable).filter_by(table_name="tmp_perm_table_v2").one()
        )
        self.assertEquals(
            stored_table.perm, f"[tmp_db].[tmp_perm_table_v2](id:{stored_table.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
        )
        # no changes in schema
        self.assertEquals(stored_table.schema_perm, "[tmp_db].[tmp_schema_v2]")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "schema_access", stored_table.schema_perm
            )
        )

        # no schema
        stored_table.schema = None
        session.commit()
        stored_table = (
            session.query(SqlaTable).filter_by(table_name="tmp_perm_table_v2").one()
        )
        self.assertEquals(
            stored_table.perm, f"[tmp_db].[tmp_perm_table_v2](id:{stored_table.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_table.perm
            )
        )
        self.assertIsNone(stored_table.schema_perm)

        session.delete(new_db)
        session.delete(stored_table)
        session.commit()

    def test_set_perm_druid_datasource(self):
        session = db.session
        druid_cluster = (
            session.query(DruidCluster).filter_by(cluster_name="druid_test").one()
        )
        datasource = DruidDatasource(
            datasource_name="tmp_datasource",
            cluster=druid_cluster,
            cluster_id=druid_cluster.id,
        )
        session.add(datasource)
        session.commit()

        # store without a schema
        stored_datasource = (
            session.query(DruidDatasource)
            .filter_by(datasource_name="tmp_datasource")
            .one()
        )
        self.assertEquals(
            stored_datasource.perm,
            f"[druid_test].[tmp_datasource](id:{stored_datasource.id})",
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_datasource.perm
            )
        )
        self.assertIsNone(stored_datasource.schema_perm)

        # store with a schema
        stored_datasource.datasource_name = "tmp_schema.tmp_datasource"
        session.commit()
        self.assertEquals(
            stored_datasource.perm,
            f"[druid_test].[tmp_schema.tmp_datasource](id:{stored_datasource.id})",
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "datasource_access", stored_datasource.perm
            )
        )
        self.assertIsNotNone(stored_datasource.schema_perm, "[druid_test].[tmp_schema]")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "schema_access", stored_datasource.schema_perm
            )
        )

        session.delete(stored_datasource)
        session.commit()

    def test_set_perm_druid_cluster(self):
        session = db.session
        cluster = DruidCluster(cluster_name="tmp_druid_cluster")
        session.add(cluster)

        stored_cluster = (
            session.query(DruidCluster)
            .filter_by(cluster_name="tmp_druid_cluster")
            .one()
        )
        self.assertEquals(
            stored_cluster.perm, f"[tmp_druid_cluster].(id:{stored_cluster.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "database_access", stored_cluster.perm
            )
        )

        stored_cluster.cluster_name = "tmp_druid_cluster2"
        session.commit()
        self.assertEquals(
            stored_cluster.perm, f"[tmp_druid_cluster2].(id:{stored_cluster.id})"
        )
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "database_access", stored_cluster.perm
            )
        )

        session.delete(stored_cluster)
        session.commit()

    def test_set_perm_database(self):
        session = db.session
        database = Database(
            database_name="tmp_database", sqlalchemy_uri="sqlite://test"
        )
        session.add(database)

        stored_db = (
            session.query(Database).filter_by(database_name="tmp_database").one()
        )
        self.assertEquals(stored_db.perm, f"[tmp_database].(id:{stored_db.id})")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "database_access", stored_db.perm
            )
        )

        stored_db.database_name = "tmp_database2"
        session.commit()
        stored_db = (
            session.query(Database).filter_by(database_name="tmp_database2").one()
        )
        self.assertEquals(stored_db.perm, f"[tmp_database2].(id:{stored_db.id})")
        self.assertIsNotNone(
            security_manager.find_permission_view_menu(
                "database_access", stored_db.perm
            )
        )

        session.delete(stored_db)
        session.commit()

    def test_set_perm_slice(self):
        session = db.session
        database = Database(
            database_name="tmp_database", sqlalchemy_uri="sqlite://test"
        )
        table = SqlaTable(table_name="tmp_perm_table", database=database)
        session.add(database)
        session.add(table)
        session.commit()

        # no schema permission
        slice = Slice(
            datasource_id=table.id,
            datasource_type="table",
            datasource_name="tmp_perm_table",
            slice_name="slice_name",
        )
        session.add(slice)
        session.commit()

        slice = session.query(Slice).filter_by(slice_name="slice_name").one()
        self.assertEquals(slice.perm, table.perm)
        self.assertEquals(slice.perm, f"[tmp_database].[tmp_perm_table](id:{table.id})")
        self.assertEquals(slice.schema_perm, table.schema_perm)
        self.assertIsNone(slice.schema_perm)

        table.schema = "tmp_perm_schema"
        table.table_name = "tmp_perm_table_v2"
        session.commit()
        # TODO(bogdan): modify slice permissions on the table update.
        self.assertNotEquals(slice.perm, table.perm)
        self.assertEquals(slice.perm, f"[tmp_database].[tmp_perm_table](id:{table.id})")
        self.assertEquals(
            table.perm, f"[tmp_database].[tmp_perm_table_v2](id:{table.id})"
        )
        # TODO(bogdan): modify slice schema permissions on the table update.
        self.assertNotEquals(slice.schema_perm, table.schema_perm)
        self.assertIsNone(slice.schema_perm)

        # updating slice refreshes the permissions
        slice.slice_name = "slice_name_v2"
        session.commit()
        self.assertEquals(slice.perm, table.perm)
        self.assertEquals(
            slice.perm, f"[tmp_database].[tmp_perm_table_v2](id:{table.id})"
        )
        self.assertEquals(slice.schema_perm, table.schema_perm)
        self.assertEquals(slice.schema_perm, "[tmp_database].[tmp_perm_schema]")

        session.delete(slice)
        session.delete(table)
        session.delete(database)

        session.commit()

        # TODO test slice permission

    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_admin(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, ["1", "2", "3"]
            )
            self.assertEquals(schemas, ["1", "2", "3"])  # no changes

    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_schema_access(self, mock_g):
        # User has schema access to the schema 1
        create_schema_perm("[examples].[1]")
        mock_g.user = security_manager.find_user("gamma")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, ["1", "2", "3"]
            )
            # temp_schema is not passed in the params
            self.assertEquals(schemas, ["1"])
        delete_schema_perm("[examples].[1]")

    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_datasource_access(self, mock_g):
        # User has schema access to the datasource temp_schema.wb_health_population in examples DB.
        mock_g.user = security_manager.find_user("gamma")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, ["temp_schema", "2", "3"]
            )
            self.assertEquals(schemas, ["temp_schema"])

    @patch("superset.security.manager.g")
    def test_schemas_accessible_by_user_datasource_and_schema_access(self, mock_g):
        # User has schema access to the datasource temp_schema.wb_health_population in examples DB.
        create_schema_perm("[examples].[2]")
        mock_g.user = security_manager.find_user("gamma")
        with self.client.application.test_request_context():
            database = get_example_database()
            schemas = security_manager.get_schemas_accessible_by_user(
                database, ["temp_schema", "2", "3"]
            )
            self.assertEquals(schemas, ["temp_schema", "2"])
        vm = security_manager.find_permission_view_menu(
            "schema_access", "[examples].[2]"
        )
        self.assertIsNotNone(vm)
        delete_schema_perm("[examples].[2]")

    def test_gamma_user_schema_access_to_dashboards(self):
        self.login(username="gamma")
        data = str(self.client.get("api/v1/dashboard/").data)
        self.assertIn("/superset/dashboard/world_health/", data)
        self.assertNotIn("/superset/dashboard/births/", data)

    def test_gamma_user_schema_access_to_tables(self):
        self.login(username="gamma")
        data = str(self.client.get("tablemodelview/list/").data)
        self.assertIn("wb_health_population", data)
        self.assertNotIn("birth_names", data)

    def test_gamma_user_schema_access_to_charts(self):
        self.login(username="gamma")
        data = str(self.client.get("api/v1/chart/").data)
        self.assertIn(
            "Life Expectancy VS Rural %", data
        )  # wb_health_population slice, has access
        self.assertIn(
            "Parallel Coordinates", data
        )  # wb_health_population slice, has access
        self.assertNotIn("Girl Name Cloud", data)  # birth_names slice, no access

    def test_sqllab_gamma_user_schema_access_to_sqllab(self):
        session = db.session

        example_db = session.query(Database).filter_by(database_name="examples").one()
        example_db.expose_in_sqllab = True
        session.commit()

        arguments = {
            "keys": ["none"],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_columns": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        NEW_FLASK_GET_SQL_DBS_REQUEST = f"/api/v1/database/?q={prison.dumps(arguments)}"
        self.login(username="gamma")
        databases_json = self.client.get(NEW_FLASK_GET_SQL_DBS_REQUEST).json
        self.assertEquals(databases_json["count"], 1)
        self.logout()

    def assert_can_read(self, view_menu, permissions_set):
        self.assertIn(("can_list", view_menu), permissions_set)

    def assert_can_write(self, view_menu, permissions_set):
        self.assertIn(("can_add", view_menu), permissions_set)
        self.assertIn(("can_delete", view_menu), permissions_set)
        self.assertIn(("can_edit", view_menu), permissions_set)

    def assert_cannot_write(self, view_menu, permissions_set):
        self.assertNotIn(("can_add", view_menu), permissions_set)
        self.assertNotIn(("can_delete", view_menu), permissions_set)
        self.assertNotIn(("can_edit", view_menu), permissions_set)
        self.assertNotIn(("can_save", view_menu), permissions_set)

    def assert_can_all(self, view_menu, permissions_set):
        self.assert_can_read(view_menu, permissions_set)
        self.assert_can_write(view_menu, permissions_set)

    def assert_can_gamma(self, perm_set):
        self.assert_can_read("TableModelView", perm_set)

        # make sure that user can create slices and dashboards
        self.assert_can_all("SliceModelView", perm_set)
        self.assert_can_all("DashboardModelView", perm_set)

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
        self.assert_can_all("TableModelView", perm_set)

        self.assertIn(("all_datasource_access", "all_datasource_access"), perm_set)

    def assert_cannot_alpha(self, perm_set):
        if app.config["ENABLE_ACCESS_REQUEST"]:
            self.assert_cannot_write("AccessRequestsModelView", perm_set)
            self.assert_can_all("AccessRequestsModelView", perm_set)
        self.assert_cannot_write("Queries", perm_set)
        self.assert_cannot_write("RoleModelView", perm_set)
        self.assert_cannot_write("UserDBModelView", perm_set)

    def assert_can_admin(self, perm_set):
        self.assert_can_all("DatabaseView", perm_set)
        self.assert_can_all("RoleModelView", perm_set)
        self.assert_can_all("UserDBModelView", perm_set)

        self.assertIn(("all_database_access", "all_database_access"), perm_set)
        self.assertIn(("can_override_role_permissions", "Superset"), perm_set)
        self.assertIn(("can_sync_druid_source", "Superset"), perm_set)
        self.assertIn(("can_override_role_permissions", "Superset"), perm_set)
        self.assertIn(("can_approve", "Superset"), perm_set)

    def test_is_admin_only(self):
        self.assertFalse(
            security_manager._is_admin_only(
                security_manager.find_permission_view_menu("can_list", "TableModelView")
            )
        )
        self.assertFalse(
            security_manager._is_admin_only(
                security_manager.find_permission_view_menu(
                    "all_datasource_access", "all_datasource_access"
                )
            )
        )

        log_permissions = ["can_list", "can_show"]
        for log_permission in log_permissions:
            self.assertTrue(
                security_manager._is_admin_only(
                    security_manager.find_permission_view_menu(
                        log_permission, "LogModelView"
                    )
                )
            )

        if app.config["ENABLE_ACCESS_REQUEST"]:
            self.assertTrue(
                security_manager._is_admin_only(
                    security_manager.find_permission_view_menu(
                        "can_list", "AccessRequestsModelView"
                    )
                )
            )
        self.assertTrue(
            security_manager._is_admin_only(
                security_manager.find_permission_view_menu(
                    "can_edit", "UserDBModelView"
                )
            )
        )
        self.assertTrue(
            security_manager._is_admin_only(
                security_manager.find_permission_view_menu("can_approve", "Superset")
            )
        )

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_is_alpha_only(self):
        self.assertFalse(
            security_manager._is_alpha_only(
                security_manager.find_permission_view_menu("can_list", "TableModelView")
            )
        )

        self.assertTrue(
            security_manager._is_alpha_only(
                security_manager.find_permission_view_menu(
                    "muldelete", "TableModelView"
                )
            )
        )
        self.assertTrue(
            security_manager._is_alpha_only(
                security_manager.find_permission_view_menu(
                    "all_datasource_access", "all_datasource_access"
                )
            )
        )
        self.assertTrue(
            security_manager._is_alpha_only(
                security_manager.find_permission_view_menu(
                    "all_database_access", "all_database_access"
                )
            )
        )

    def test_is_gamma_pvm(self):
        self.assertTrue(
            security_manager._is_gamma_pvm(
                security_manager.find_permission_view_menu("can_list", "TableModelView")
            )
        )

    def test_gamma_permissions_basic(self):
        self.assert_can_gamma(get_perm_tuples("Gamma"))
        self.assert_cannot_alpha(get_perm_tuples("Alpha"))

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_alpha_permissions(self):
        alpha_perm_tuples = get_perm_tuples("Alpha")
        self.assert_can_gamma(alpha_perm_tuples)
        self.assert_can_alpha(alpha_perm_tuples)
        self.assert_cannot_alpha(alpha_perm_tuples)

    @unittest.skipUnless(
        SupersetTestCase.is_module_installed("pydruid"), "pydruid not installed"
    )
    def test_admin_permissions(self):
        self.assert_can_gamma(get_perm_tuples("Admin"))
        self.assert_can_alpha(get_perm_tuples("Admin"))
        self.assert_can_admin(get_perm_tuples("Admin"))

    def test_sql_lab_permissions(self):
        sql_lab_set = get_perm_tuples("sql_lab")
        self.assertIn(("can_sql_json", "Superset"), sql_lab_set)
        self.assertIn(("can_csv", "Superset"), sql_lab_set)
        self.assertIn(("can_search_queries", "Superset"), sql_lab_set)

        self.assert_cannot_alpha(sql_lab_set)

    def test_granter_permissions(self):
        granter_set = get_perm_tuples("granter")
        self.assertIn(("can_override_role_permissions", "Superset"), granter_set)
        self.assertIn(("can_approve", "Superset"), granter_set)

        self.assert_cannot_alpha(granter_set)

    def test_gamma_permissions(self):
        def assert_can_read(view_menu):
            self.assertIn(("can_list", view_menu), gamma_perm_set)

        def assert_can_write(view_menu):
            self.assertIn(("can_add", view_menu), gamma_perm_set)
            self.assertIn(("can_delete", view_menu), gamma_perm_set)
            self.assertIn(("can_edit", view_menu), gamma_perm_set)

        def assert_cannot_write(view_menu):
            self.assertNotIn(("can_add", view_menu), gamma_perm_set)
            self.assertNotIn(("can_delete", view_menu), gamma_perm_set)
            self.assertNotIn(("can_edit", view_menu), gamma_perm_set)
            self.assertNotIn(("can_save", view_menu), gamma_perm_set)

        def assert_can_all(view_menu):
            assert_can_read(view_menu)
            assert_can_write(view_menu)

        gamma_perm_set = set()
        for perm in security_manager.find_role("Gamma").permissions:
            gamma_perm_set.add((perm.permission.name, perm.view_menu.name))

        # check read only perms
        assert_can_read("TableModelView")

        # make sure that user can create slices and dashboards
        assert_can_all("SliceModelView")
        assert_can_all("DashboardModelView")

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
            ["SupersetIndexView", "index"],
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


class SecurityManagerTests(SupersetTestCase):
    """
    Testing the Security Manager.
    """

    @patch("superset.security.SupersetSecurityManager.raise_for_access")
    def test_can_access_datasource(self, mock_raise_for_access):
        datasource = self.get_datasource_mock()

        mock_raise_for_access.return_value = None
        self.assertTrue(security_manager.can_access_datasource(datasource=datasource))

        mock_raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                "dummy",
                SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                ErrorLevel.ERROR,
            )
        )

        self.assertFalse(security_manager.can_access_datasource(datasource=datasource))

    @patch("superset.security.SupersetSecurityManager.raise_for_access")
    def test_can_access_table(self, mock_raise_for_access):
        database = get_example_database()
        table = Table("bar", "foo")

        mock_raise_for_access.return_value = None
        self.assertTrue(security_manager.can_access_table(database, table))

        mock_raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                "dummy",
                SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                ErrorLevel.ERROR,
            )
        )

        self.assertFalse(security_manager.can_access_table(database, table))

    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_datasource(self, mock_can_access_schema, mock_can_access):
        datasource = self.get_datasource_mock()

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(datasource=datasource)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(datasource=datasource)

    @patch("superset.security.SupersetSecurityManager.can_access")
    def test_raise_for_access_query(self, mock_can_access):
        query = Mock(
            database=get_example_database(), schema="bar", sql="SELECT * FROM foo"
        )

        mock_can_access.return_value = True
        security_manager.raise_for_access(query=query)

        mock_can_access.return_value = False

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(query=query)

    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_query_context(
        self, mock_can_access_schema, mock_can_access
    ):
        query_context = Mock(datasource=self.get_datasource_mock())

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(query_context=query_context)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(query_context=query_context)

    @patch("superset.security.SupersetSecurityManager.can_access")
    def test_raise_for_access_table(self, mock_can_access):
        database = get_example_database()
        table = Table("bar", "foo")

        mock_can_access.return_value = True
        security_manager.raise_for_access(database=database, table=table)

        mock_can_access.return_value = False

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(database=database, table=table)

    @patch("superset.security.SupersetSecurityManager.can_access")
    @patch("superset.security.SupersetSecurityManager.can_access_schema")
    def test_raise_for_access_viz(self, mock_can_access_schema, mock_can_access):
        test_viz = viz.TableViz(self.get_datasource_mock(), form_data={})

        mock_can_access_schema.return_value = True
        security_manager.raise_for_access(viz=test_viz)

        mock_can_access.return_value = False
        mock_can_access_schema.return_value = False

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(viz=test_viz)


class RowLevelSecurityTests(SupersetTestCase):
    """
    Testing Row Level Security
    """

    rls_entry = None

    def setUp(self):
        session = db.session

        # Create the RowLevelSecurityFilter
        self.rls_entry = RowLevelSecurityFilter()
        self.rls_entry.tables.extend(
            session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["energy_usage", "unicode_test"]))
            .all()
        )
        self.rls_entry.clause = "value > 1"
        self.rls_entry.roles.append(
            security_manager.find_role("Gamma")
        )  # db.session.query(Role).filter_by(name="Gamma").first())
        self.rls_entry.roles.append(security_manager.find_role("Alpha"))
        db.session.add(self.rls_entry)

        db.session.commit()

    def tearDown(self):
        session = db.session
        session.delete(self.rls_entry)
        session.commit()

    # Do another test to make sure it doesn't alter another query
    def test_rls_filter_alters_query(self):
        g.user = self.get_user(
            username="alpha"
        )  # self.login() doesn't actually set the user
        tbl = self.get_table_by_name("energy_usage")
        query_obj = dict(
            groupby=[],
            metrics=[],
            filter=[],
            is_timeseries=False,
            columns=["value"],
            granularity=None,
            from_dttm=None,
            to_dttm=None,
            extras={},
        )
        sql = tbl.get_query_str(query_obj)
        self.assertIn("value > 1", sql)

    def test_rls_filter_doesnt_alter_query(self):
        g.user = self.get_user(
            username="admin"
        )  # self.login() doesn't actually set the user
        tbl = self.get_table_by_name("energy_usage")
        query_obj = dict(
            groupby=[],
            metrics=[],
            filter=[],
            is_timeseries=False,
            columns=["value"],
            granularity=None,
            from_dttm=None,
            to_dttm=None,
            extras={},
        )
        sql = tbl.get_query_str(query_obj)
        self.assertNotIn("value > 1", sql)

    def test_multiple_table_filter_alters_another_tables_query(self):
        g.user = self.get_user(
            username="alpha"
        )  # self.login() doesn't actually set the user
        tbl = self.get_table_by_name("unicode_test")
        query_obj = dict(
            groupby=[],
            metrics=[],
            filter=[],
            is_timeseries=False,
            columns=["value"],
            granularity=None,
            from_dttm=None,
            to_dttm=None,
            extras={},
        )
        sql = tbl.get_query_str(query_obj)
        self.assertIn("value > 1", sql)
