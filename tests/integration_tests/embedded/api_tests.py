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
"""Tests for security api methods"""

from unittest import mock

import pytest

from superset import db
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


class TestEmbeddedDashboardApi(SupersetTestCase):
    resource_name = "embedded_dashboard"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=True,
    )
    def test_get_embedded_dashboard(self):
        self.login(ADMIN_USERNAME)
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        db.session.flush()
        uri = f"api/v1/{self.resource_name}/{self.embedded.uuid}"
        response = self.client.get(uri)
        self.assert200(response)

    def test_get_embedded_dashboard_non_found(self):
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/bad-uuid"
        response = self.client.get(uri)
        self.assert404(response)
