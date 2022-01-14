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
from unittest.mock import patch

import pytest

from superset import db, security_manager
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.public_role import public_role_like_gamma
from tests.integration_tests.fixtures.query_context import get_query_context


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestGuestTokenSecurity(SupersetTestCase):
    def setUp(self) -> None:
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.authorized_guest = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": self.dash.id}]}
        )
        self.unauthorized_guest = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": self.dash.id + 1}]}
        )

    @patch("superset.security.manager.g")
    def test_dashboard_access_filter_as_guest(self, mock_g):
        dataset = list(self.dash.datasources)[0]
        mock_g.user = self.authorized_guest

        security_manager.raise_for_access(datasource=dataset)

    @patch("superset.security.manager.g")
    def test_dashboard_access_filter_as_unauthorized_guest(self, mock_g):
        dataset = list(self.dash.datasources)[0]
        mock_g.user = self.unauthorized_guest

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(datasource=dataset)

    @patch("superset.security.manager.g")
    def test_chart_access_filter_as_guest(self, mock_g):
        chart = self.dash.slices[0]
        mock_g.user = self.authorized_guest

        security_manager.raise_for_access(viz=chart)

    @patch("superset.security.manager.g")
    def test_chart_access_filter_as_unauthorized_guest(self, mock_g):
        chart = self.dash.slices[0]
        mock_g.user = self.unauthorized_guest

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(viz=chart)

    def test_get_guest_user_roles_explicit(self):
        roles = security_manager.get_user_roles(self.authorized_guest)
        self.assertEqual(self.authorized_guest.roles, roles)

    @patch("superset.security.manager.g")
    def test_get_guest_user_roles_implicit(self, mock_g):
        mock_g.user = self.authorized_guest

        roles = security_manager.get_user_roles(self.authorized_guest)
        self.assertEqual(self.authorized_guest.roles, roles)

    def test_user_is_not_guest(self):
        is_guest = security_manager.is_guest_user(security_manager.find_user("admin"))
        self.assertTrue(is_guest)

    def test_anon_is_not_guest(self):
        is_guest = security_manager.is_guest_user(security_manager.get_anonymous_user())
        self.assertTrue(is_guest)

    def test_guest_is_guest(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest)
        self.assertTrue(is_guest)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=False,
    )
    def test_is_guest_user_flag_off(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest)
        self.assertFalse(is_guest)
