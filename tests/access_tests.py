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
import json
import unittest
from unittest import mock

from superset import app, db, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.druid.models import DruidDatasource
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models

from .base_tests import SupersetTestCase

ROLE_TABLES_PERM_DATA = {
    "role_name": "override_me",
    "database": [
        {
            "datasource_type": "table",
            "name": "examples",
            "schema": [{"name": "", "datasources": ["birth_names"]}],
        }
    ],
}

ROLE_ALL_PERM_DATA = {
    "role_name": "override_me",
    "database": [
        {
            "datasource_type": "table",
            "name": "examples",
            "schema": [{"name": "", "datasources": ["birth_names"]}],
        },
        {
            "datasource_type": "druid",
            "name": "druid_test",
            "schema": [{"name": "", "datasources": ["druid_ds_1", "druid_ds_2"]}],
        },
    ],
}

EXTEND_ROLE_REQUEST = (
    "/superset/approve?datasource_type={}&datasource_id={}&"
    "created_by={}&role_to_extend={}"
)
GRANT_ROLE_REQUEST = (
    "/superset/approve?datasource_type={}&datasource_id={}&"
    "created_by={}&role_to_grant={}"
)
TEST_ROLE_1 = "test_role1"
TEST_ROLE_2 = "test_role2"
DB_ACCESS_ROLE = "db_access_role"
SCHEMA_ACCESS_ROLE = "schema_access_role"


def create_access_request(session, ds_type, ds_name, role_name, user_name):
    ds_class = ConnectorRegistry.sources[ds_type]
    # TODO: generalize datasource names
    if ds_type == "table":
        ds = session.query(ds_class).filter(ds_class.table_name == ds_name).first()
    else:
        ds = session.query(ds_class).filter(ds_class.datasource_name == ds_name).first()
    ds_perm_view = security_manager.find_permission_view_menu(
        "datasource_access", ds.perm
    )
    security_manager.add_permission_role(
        security_manager.find_role(role_name), ds_perm_view
    )
    access_request = models.DatasourceAccessRequest(
        datasource_id=ds.id,
        datasource_type=ds_type,
        created_by_fk=security_manager.find_user(username=user_name).id,
    )
    session.add(access_request)
    session.commit()
    return access_request


class RequestAccessTests(SupersetTestCase):
    @classmethod
    def setUpClass(cls):
        security_manager.add_role("override_me")
        security_manager.add_role(TEST_ROLE_1)
        security_manager.add_role(TEST_ROLE_2)
        security_manager.add_role(DB_ACCESS_ROLE)
        security_manager.add_role(SCHEMA_ACCESS_ROLE)
        db.session.commit()

    @classmethod
    def tearDownClass(cls):
        override_me = security_manager.find_role("override_me")
        db.session.delete(override_me)
        db.session.delete(security_manager.find_role(TEST_ROLE_1))
        db.session.delete(security_manager.find_role(TEST_ROLE_2))
        db.session.delete(security_manager.find_role(DB_ACCESS_ROLE))
        db.session.delete(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        db.session.commit()

    def setUp(self):
        self.login("admin")

    def tearDown(self):
        self.logout()
        override_me = security_manager.find_role("override_me")
        override_me.permissions = []
        db.session.commit()
        db.session.close()

    def test_override_role_permissions_is_admin_only(self):
        self.logout()
        self.login("alpha")
        response = self.client.post(
            "/superset/override_role_permissions/",
            data=json.dumps(ROLE_TABLES_PERM_DATA),
            content_type="application/json",
            follow_redirects=True,
        )
        self.assertNotEqual(405, response.status_code)

    def test_override_role_permissions_1_table(self):
        response = self.client.post(
            "/superset/override_role_permissions/",
            data=json.dumps(ROLE_TABLES_PERM_DATA),
            content_type="application/json",
        )
        self.assertEqual(201, response.status_code)

        updated_override_me = security_manager.find_role("override_me")
        self.assertEqual(1, len(updated_override_me.permissions))
        birth_names = self.get_table_by_name("birth_names")
        self.assertEqual(
            birth_names.perm, updated_override_me.permissions[0].view_menu.name
        )
        self.assertEqual(
            "datasource_access", updated_override_me.permissions[0].permission.name
        )

    def test_override_role_permissions_druid_and_table(self):
        response = self.client.post(
            "/superset/override_role_permissions/",
            data=json.dumps(ROLE_ALL_PERM_DATA),
            content_type="application/json",
        )
        self.assertEqual(201, response.status_code)

        updated_role = security_manager.find_role("override_me")
        perms = sorted(updated_role.permissions, key=lambda p: p.view_menu.name)
        druid_ds_1 = self.get_druid_ds_by_name("druid_ds_1")
        self.assertEqual(druid_ds_1.perm, perms[0].view_menu.name)
        self.assertEqual("datasource_access", perms[0].permission.name)

        druid_ds_2 = self.get_druid_ds_by_name("druid_ds_2")
        self.assertEqual(druid_ds_2.perm, perms[1].view_menu.name)
        self.assertEqual(
            "datasource_access", updated_role.permissions[1].permission.name
        )

        birth_names = self.get_table_by_name("birth_names")
        self.assertEqual(birth_names.perm, perms[2].view_menu.name)
        self.assertEqual(
            "datasource_access", updated_role.permissions[2].permission.name
        )
        self.assertEqual(3, len(perms))

    def test_override_role_permissions_drops_absent_perms(self):
        override_me = security_manager.find_role("override_me")
        override_me.permissions.append(
            security_manager.find_permission_view_menu(
                view_menu_name=self.get_table_by_name("energy_usage").perm,
                permission_name="datasource_access",
            )
        )
        db.session.flush()

        response = self.client.post(
            "/superset/override_role_permissions/",
            data=json.dumps(ROLE_TABLES_PERM_DATA),
            content_type="application/json",
        )
        self.assertEqual(201, response.status_code)
        updated_override_me = security_manager.find_role("override_me")
        self.assertEqual(1, len(updated_override_me.permissions))
        birth_names = self.get_table_by_name("birth_names")
        self.assertEqual(
            birth_names.perm, updated_override_me.permissions[0].view_menu.name
        )
        self.assertEqual(
            "datasource_access", updated_override_me.permissions[0].permission.name
        )

    def test_clean_requests_after_role_extend(self):
        session = db.session

        # Case 1. Gamma and gamma2 requested test_role1 on energy_usage access
        # Gamma already has role test_role1
        # Extend test_role1 with energy_usage access for gamma2
        # Check if access request for gamma at energy_usage was deleted

        # gamma2 and gamma request table_role on energy usage
        if app.config.get("ENABLE_ACCESS_REQUEST"):
            access_request1 = create_access_request(
                session, "table", "random_time_series", TEST_ROLE_1, "gamma2"
            )
            ds_1_id = access_request1.datasource_id
            create_access_request(
                session, "table", "random_time_series", TEST_ROLE_1, "gamma"
            )
            access_requests = self.get_access_requests("gamma", "table", ds_1_id)
            self.assertTrue(access_requests)
            # gamma gets test_role1
            self.get_resp(
                GRANT_ROLE_REQUEST.format("table", ds_1_id, "gamma", TEST_ROLE_1)
            )
            # extend test_role1 with access on energy usage
            self.client.get(
                EXTEND_ROLE_REQUEST.format("table", ds_1_id, "gamma2", TEST_ROLE_1)
            )
            access_requests = self.get_access_requests("gamma", "table", ds_1_id)
            self.assertFalse(access_requests)

            gamma_user = security_manager.find_user(username="gamma")
            gamma_user.roles.remove(security_manager.find_role("test_role1"))

    def test_clean_requests_after_alpha_grant(self):
        session = db.session

        # Case 2. Two access requests from gamma and gamma2
        # Gamma becomes alpha, gamma2 gets granted
        # Check if request by gamma has been deleted

        access_request1 = create_access_request(
            session, "table", "birth_names", TEST_ROLE_1, "gamma"
        )
        create_access_request(session, "table", "birth_names", TEST_ROLE_2, "gamma2")
        ds_1_id = access_request1.datasource_id
        # gamma becomes alpha
        alpha_role = security_manager.find_role("Alpha")
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(alpha_role)
        session.commit()
        access_requests = self.get_access_requests("gamma", "table", ds_1_id)
        self.assertTrue(access_requests)
        self.client.get(
            EXTEND_ROLE_REQUEST.format("table", ds_1_id, "gamma2", TEST_ROLE_2)
        )
        access_requests = self.get_access_requests("gamma", "table", ds_1_id)
        self.assertFalse(access_requests)

        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.remove(security_manager.find_role("Alpha"))
        session.commit()

    def test_clean_requests_after_db_grant(self):
        session = db.session

        # Case 3. Two access requests from gamma and gamma2
        # Gamma gets database access, gamma2 access request granted
        # Check if request by gamma has been deleted

        gamma_user = security_manager.find_user(username="gamma")
        access_request1 = create_access_request(
            session, "table", "energy_usage", TEST_ROLE_1, "gamma"
        )
        create_access_request(session, "table", "energy_usage", TEST_ROLE_2, "gamma2")
        ds_1_id = access_request1.datasource_id
        # gamma gets granted database access
        database = session.query(models.Database).first()

        security_manager.add_permission_view_menu("database_access", database.perm)
        ds_perm_view = security_manager.find_permission_view_menu(
            "database_access", database.perm
        )
        security_manager.add_permission_role(
            security_manager.find_role(DB_ACCESS_ROLE), ds_perm_view
        )
        gamma_user.roles.append(security_manager.find_role(DB_ACCESS_ROLE))
        session.commit()
        access_requests = self.get_access_requests("gamma", "table", ds_1_id)
        self.assertTrue(access_requests)
        # gamma2 request gets fulfilled
        self.client.get(
            EXTEND_ROLE_REQUEST.format("table", ds_1_id, "gamma2", TEST_ROLE_2)
        )
        access_requests = self.get_access_requests("gamma", "table", ds_1_id)

        self.assertFalse(access_requests)
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.remove(security_manager.find_role(DB_ACCESS_ROLE))
        session.commit()

    def test_clean_requests_after_schema_grant(self):
        session = db.session

        # Case 4. Two access requests from gamma and gamma2
        # Gamma gets schema access, gamma2 access request granted
        # Check if request by gamma has been deleted

        gamma_user = security_manager.find_user(username="gamma")
        access_request1 = create_access_request(
            session, "table", "wb_health_population", TEST_ROLE_1, "gamma"
        )
        create_access_request(
            session, "table", "wb_health_population", TEST_ROLE_2, "gamma2"
        )
        ds_1_id = access_request1.datasource_id
        ds = (
            session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )

        ds.schema = "temp_schema"
        security_manager.add_permission_view_menu("schema_access", ds.schema_perm)
        schema_perm_view = security_manager.find_permission_view_menu(
            "schema_access", ds.schema_perm
        )
        security_manager.add_permission_role(
            security_manager.find_role(SCHEMA_ACCESS_ROLE), schema_perm_view
        )
        gamma_user.roles.append(security_manager.find_role(SCHEMA_ACCESS_ROLE))
        session.commit()
        # gamma2 request gets fulfilled
        self.client.get(
            EXTEND_ROLE_REQUEST.format("table", ds_1_id, "gamma2", TEST_ROLE_2)
        )
        access_requests = self.get_access_requests("gamma", "table", ds_1_id)
        self.assertFalse(access_requests)
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.remove(security_manager.find_role(SCHEMA_ACCESS_ROLE))

        ds = (
            session.query(SqlaTable)
            .filter_by(table_name="wb_health_population")
            .first()
        )
        ds.schema = None

        session.commit()

    @mock.patch("superset.utils.core.send_MIME_email")
    def test_approve(self, mock_send_mime):
        if app.config.get("ENABLE_ACCESS_REQUEST"):
            session = db.session
            TEST_ROLE_NAME = "table_role"
            security_manager.add_role(TEST_ROLE_NAME)

            # Case 1. Grant new role to the user.

            access_request1 = create_access_request(
                session, "table", "unicode_test", TEST_ROLE_NAME, "gamma"
            )
            ds_1_id = access_request1.datasource_id
            self.get_resp(
                GRANT_ROLE_REQUEST.format("table", ds_1_id, "gamma", TEST_ROLE_NAME)
            )
            # Test email content.
            self.assertTrue(mock_send_mime.called)
            call_args = mock_send_mime.call_args[0]
            self.assertEqual(
                [
                    security_manager.find_user(username="gamma").email,
                    security_manager.find_user(username="admin").email,
                ],
                call_args[1],
            )
            self.assertEqual(
                "[Superset] Access to the datasource {} was granted".format(
                    self.get_table(ds_1_id).full_name
                ),
                call_args[2]["Subject"],
            )
            self.assertIn(TEST_ROLE_NAME, call_args[2].as_string())
            self.assertIn("unicode_test", call_args[2].as_string())

            access_requests = self.get_access_requests("gamma", "table", ds_1_id)
            # request was removed
            self.assertFalse(access_requests)
            # user was granted table_role
            user_roles = [r.name for r in security_manager.find_user("gamma").roles]
            self.assertIn(TEST_ROLE_NAME, user_roles)

            # Case 2. Extend the role to have access to the table

            access_request2 = create_access_request(
                session, "table", "energy_usage", TEST_ROLE_NAME, "gamma"
            )
            ds_2_id = access_request2.datasource_id
            energy_usage_perm = access_request2.datasource.perm

            self.client.get(
                EXTEND_ROLE_REQUEST.format(
                    "table", access_request2.datasource_id, "gamma", TEST_ROLE_NAME
                )
            )
            access_requests = self.get_access_requests("gamma", "table", ds_2_id)

            # Test email content.
            self.assertTrue(mock_send_mime.called)
            call_args = mock_send_mime.call_args[0]
            self.assertEqual(
                [
                    security_manager.find_user(username="gamma").email,
                    security_manager.find_user(username="admin").email,
                ],
                call_args[1],
            )
            self.assertEqual(
                "[Superset] Access to the datasource {} was granted".format(
                    self.get_table(ds_2_id).full_name
                ),
                call_args[2]["Subject"],
            )
            self.assertIn(TEST_ROLE_NAME, call_args[2].as_string())
            self.assertIn("energy_usage", call_args[2].as_string())

            # request was removed
            self.assertFalse(access_requests)
            # table_role was extended to grant access to the energy_usage table/
            perm_view = security_manager.find_permission_view_menu(
                "datasource_access", energy_usage_perm
            )
            TEST_ROLE = security_manager.find_role(TEST_ROLE_NAME)
            self.assertIn(perm_view, TEST_ROLE.permissions)

            # Case 3. Grant new role to the user to access the druid datasource.

            security_manager.add_role("druid_role")
            access_request3 = create_access_request(
                session, "druid", "druid_ds_1", "druid_role", "gamma"
            )
            self.get_resp(
                GRANT_ROLE_REQUEST.format(
                    "druid", access_request3.datasource_id, "gamma", "druid_role"
                )
            )

            # user was granted table_role
            user_roles = [r.name for r in security_manager.find_user("gamma").roles]
            self.assertIn("druid_role", user_roles)

            # Case 4. Extend the role to have access to the druid datasource

            access_request4 = create_access_request(
                session, "druid", "druid_ds_2", "druid_role", "gamma"
            )
            druid_ds_2_perm = access_request4.datasource.perm

            self.client.get(
                EXTEND_ROLE_REQUEST.format(
                    "druid", access_request4.datasource_id, "gamma", "druid_role"
                )
            )
            # druid_role was extended to grant access to the druid_access_ds_2
            druid_role = security_manager.find_role("druid_role")
            perm_view = security_manager.find_permission_view_menu(
                "datasource_access", druid_ds_2_perm
            )
            self.assertIn(perm_view, druid_role.permissions)

            # cleanup
            gamma_user = security_manager.find_user(username="gamma")
            gamma_user.roles.remove(security_manager.find_role("druid_role"))
            gamma_user.roles.remove(security_manager.find_role(TEST_ROLE_NAME))
            session.delete(security_manager.find_role("druid_role"))
            session.delete(security_manager.find_role(TEST_ROLE_NAME))
            session.commit()

    def test_request_access(self):
        if app.config.get("ENABLE_ACCESS_REQUEST"):
            session = db.session
            self.logout()
            self.login(username="gamma")
            gamma_user = security_manager.find_user(username="gamma")
            security_manager.add_role("dummy_role")
            gamma_user.roles.append(security_manager.find_role("dummy_role"))
            session.commit()

            ACCESS_REQUEST = (
                "/superset/request_access?"
                "datasource_type={}&"
                "datasource_id={}&"
                "action={}&"
            )
            ROLE_GRANT_LINK = (
                '<a href="/superset/approve?datasource_type={}&datasource_id={}&'
                'created_by={}&role_to_grant={}">Grant {} Role</a>'
            )

            # Request table access, there are no roles have this table.

            table1 = (
                session.query(SqlaTable)
                .filter_by(table_name="random_time_series")
                .first()
            )
            table_1_id = table1.id

            # request access to the table
            resp = self.get_resp(ACCESS_REQUEST.format("table", table_1_id, "go"))
            assert "Access was requested" in resp
            access_request1 = self.get_access_requests("gamma", "table", table_1_id)
            assert access_request1 is not None

            # Request access, roles exist that contains the table.
            # add table to the existing roles
            table3 = (
                session.query(SqlaTable).filter_by(table_name="energy_usage").first()
            )
            table_3_id = table3.id
            table3_perm = table3.perm

            security_manager.add_role("energy_usage_role")
            alpha_role = security_manager.find_role("Alpha")
            security_manager.add_permission_role(
                alpha_role,
                security_manager.find_permission_view_menu(
                    "datasource_access", table3_perm
                ),
            )
            security_manager.add_permission_role(
                security_manager.find_role("energy_usage_role"),
                security_manager.find_permission_view_menu(
                    "datasource_access", table3_perm
                ),
            )
            session.commit()

            self.get_resp(ACCESS_REQUEST.format("table", table_3_id, "go"))
            access_request3 = self.get_access_requests("gamma", "table", table_3_id)
            approve_link_3 = ROLE_GRANT_LINK.format(
                "table", table_3_id, "gamma", "energy_usage_role", "energy_usage_role"
            )
            self.assertEqual(
                access_request3.roles_with_datasource,
                "<ul><li>{}</li></ul>".format(approve_link_3),
            )

            # Request druid access, there are no roles have this table.
            druid_ds_4 = (
                session.query(DruidDatasource)
                .filter_by(datasource_name="druid_ds_1")
                .first()
            )
            druid_ds_4_id = druid_ds_4.id

            # request access to the table
            self.get_resp(ACCESS_REQUEST.format("druid", druid_ds_4_id, "go"))
            access_request4 = self.get_access_requests("gamma", "druid", druid_ds_4_id)

            self.assertEqual(
                access_request4.roles_with_datasource,
                "<ul></ul>".format(access_request4.id),
            )

            # Case 5. Roles exist that contains the druid datasource.
            # add druid ds to the existing roles
            druid_ds_5 = (
                session.query(DruidDatasource)
                .filter_by(datasource_name="druid_ds_2")
                .first()
            )
            druid_ds_5_id = druid_ds_5.id
            druid_ds_5_perm = druid_ds_5.perm

            druid_ds_2_role = security_manager.add_role("druid_ds_2_role")
            admin_role = security_manager.find_role("Admin")
            security_manager.add_permission_role(
                admin_role,
                security_manager.find_permission_view_menu(
                    "datasource_access", druid_ds_5_perm
                ),
            )
            security_manager.add_permission_role(
                druid_ds_2_role,
                security_manager.find_permission_view_menu(
                    "datasource_access", druid_ds_5_perm
                ),
            )
            session.commit()

            self.get_resp(ACCESS_REQUEST.format("druid", druid_ds_5_id, "go"))
            access_request5 = self.get_access_requests("gamma", "druid", druid_ds_5_id)
            approve_link_5 = ROLE_GRANT_LINK.format(
                "druid", druid_ds_5_id, "gamma", "druid_ds_2_role", "druid_ds_2_role"
            )
            self.assertEqual(
                access_request5.roles_with_datasource,
                "<ul><li>{}</li></ul>".format(approve_link_5),
            )

            # cleanup
            gamma_user = security_manager.find_user(username="gamma")
            gamma_user.roles.remove(security_manager.find_role("dummy_role"))
            session.commit()


if __name__ == "__main__":
    unittest.main()
