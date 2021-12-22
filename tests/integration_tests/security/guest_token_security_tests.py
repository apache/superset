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

from integration_tests.base_tests import SupersetTestCase
from superset import db, security_manager
from superset.models.dashboard import Dashboard
from superset.security.guest_token import GuestUser
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.public_role import public_role_like_gamma
from tests.integration_tests.fixtures.query_context import get_query_context


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", EMBEDDED_SUPERSET=True,
)
class TestDashboardGuestTokenSecurity(SupersetTestCase):

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_dashboard_access_filter_as_guest(self):
        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        g.user = security_manager.get_guest_user_from_token({
            "user": {},
            "resources": [{"type": "dashboard", "id": dash.id}]
        })

        security_manager.raise_for_access(datasource=dash.datasources[0])
