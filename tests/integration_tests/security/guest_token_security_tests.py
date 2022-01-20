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
from unittest import mock

import pytest
from flask import g

from superset import db, security_manager
from superset.dashboards.commands.exceptions import DashboardAccessDeniedError
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.security.guest_token import GuestTokenResourceType
from superset.sql_parse import Table
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", EMBEDDED_SUPERSET=True,
)
class TestGuestUserSecurity(SupersetTestCase):
    # This test doesn't use a dashboard fixture, the next test does.
    # That way tests are faster.

    resource_id = 42

    def authorized_guest(self):
        return security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": self.resource_id}]}
        )

    def test_is_guest_user__regular_user(self):
        is_guest = security_manager.is_guest_user(security_manager.find_user("admin"))
        self.assertFalse(is_guest)

    def test_is_guest_user__anonymous(self):
        is_guest = security_manager.is_guest_user(security_manager.get_anonymous_user())
        self.assertFalse(is_guest)

    def test_is_guest_user__guest_user(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest())
        self.assertTrue(is_guest)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=False,
    )
    def test_is_guest_user__flag_off(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest())
        self.assertFalse(is_guest)

    def test_get_guest_user__regular_user(self):
        g.user = security_manager.find_user("admin")
        guest_user = security_manager.get_current_guest_user_if_guest()
        self.assertIsNone(guest_user)

    def test_get_guest_user__anonymous_user(self):
        g.user = security_manager.get_anonymous_user()
        guest_user = security_manager.get_current_guest_user_if_guest()
        self.assertIsNone(guest_user)

    def test_get_guest_user__guest_user(self):
        g.user = self.authorized_guest()
        guest_user = security_manager.get_current_guest_user_if_guest()
        self.assertEqual(guest_user, g.user)

    def test_has_guest_access__regular_user(self):
        g.user = security_manager.find_user("admin")
        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertFalse(has_guest_access)

    def test_has_guest_access__anonymous_user(self):
        g.user = security_manager.get_anonymous_user()
        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertFalse(has_guest_access)

    def test_has_guest_access__authorized_guest_user(self):
        g.user = self.authorized_guest()
        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertTrue(has_guest_access)

    def test_has_guest_access__authorized_guest_user__non_zero_resource_index(self):
        guest = self.authorized_guest()
        guest.resources = [
            {"type": "dashboard", "id": self.resource_id - 1}
        ] + guest.resources
        g.user = guest

        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertTrue(has_guest_access)

    def test_has_guest_access__unauthorized_guest_user__different_resource_id(self):
        g.user = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [{"type": "dashboard", "id": self.resource_id - 1}],
            }
        )
        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertFalse(has_guest_access)

    def test_has_guest_access__unauthorized_guest_user__different_resource_type(self):
        g.user = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dirt", "id": self.resource_id}]}
        )
        has_guest_access = security_manager.has_guest_access(
            GuestTokenResourceType.DASHBOARD, self.resource_id
        )
        self.assertFalse(has_guest_access)

    def test_get_guest_user_roles_explicit(self):
        guest = self.authorized_guest()
        roles = security_manager.get_user_roles(guest)
        self.assertEqual(guest.roles, roles)

    def test_get_guest_user_roles_implicit(self):
        guest = self.authorized_guest()
        g.user = guest

        roles = security_manager.get_user_roles()
        self.assertEqual(guest.roles, roles)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestGuestUserDashboardAccess(SupersetTestCase):
    def setUp(self) -> None:
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.authorized_guest = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": self.dash.id}]}
        )
        self.unauthorized_guest = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": self.dash.id + 1}]}
        )

    def test_chart_raise_for_access_as_guest(self):
        chart = self.dash.slices[0]
        g.user = self.authorized_guest

        security_manager.raise_for_access(viz=chart)

    def test_chart_raise_for_access_as_unauthorized_guest(self):
        chart = self.dash.slices[0]
        g.user = self.unauthorized_guest

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(viz=chart)

    def test_dataset_raise_for_access_as_guest(self):
        dataset = self.dash.slices[0].datasource
        g.user = self.authorized_guest

        security_manager.raise_for_access(datasource=dataset)

    def test_dataset_raise_for_access_as_unauthorized_guest(self):
        dataset = self.dash.slices[0].datasource
        g.user = self.unauthorized_guest

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(datasource=dataset)

    def test_guest_token_does_not_grant_access_to_underlying_table(self):
        sqla_table = self.dash.slices[0].table
        table = Table(table=sqla_table.table_name)

        g.user = self.authorized_guest

        with self.assertRaises(Exception):
            security_manager.raise_for_access(table=table, database=sqla_table.database)

    def test_raise_for_dashboard_access_as_guest(self):
        g.user = self.authorized_guest

        security_manager.raise_for_dashboard_access(self.dash)

    def test_raise_for_dashboard_access_as_unauthorized_guest(self):
        g.user = self.unauthorized_guest

        with self.assertRaises(DashboardAccessDeniedError):
            security_manager.raise_for_dashboard_access(self.dash)
