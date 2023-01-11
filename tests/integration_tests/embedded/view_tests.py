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
from unittest import mock

import pytest

from superset import db
from superset.embedded.dao import EmbeddedDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


class TestEmbeddedDashboardView(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=True,
    )
    def test_get_embedded_dashboard(self):
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.embedded = EmbeddedDAO.upsert(self.dash, [])
        uri = f"embedded/{self.embedded.uuid}"
        response = self.client.get(uri)
        self.assert200(response)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=True,
    )
    def test_get_embedded_dashboard_referrer_not_allowed(self):
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.embedded = EmbeddedDAO.upsert(self.dash, ["test.example.com"])
        uri = f"embedded/{self.embedded.uuid}"
        response = self.client.get(uri)
        self.assert403(response)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=True,
    )
    def test_get_embedded_dashboard_non_found(self):
        uri = f"embedded/bad-uuid"
        response = self.client.get(uri)
        self.assert404(response)
