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
import pytest

import tests.integration_tests.test_app  # pylint: disable=unused-import  # noqa: F401
from superset import db
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)


class TestEmbeddedDashboardDAO(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_upsert(self):
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        assert not dash.embedded
        EmbeddedDashboardDAO.upsert(dash, ["test.example.com"])
        db.session.flush()
        assert dash.embedded
        self.assertEqual(dash.embedded[0].allowed_domains, ["test.example.com"])
        original_uuid = dash.embedded[0].uuid
        self.assertIsNotNone(original_uuid)
        EmbeddedDashboardDAO.upsert(dash, [])
        db.session.flush()
        self.assertEqual(dash.embedded[0].allowed_domains, [])
        self.assertEqual(dash.embedded[0].uuid, original_uuid)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_by_uuid(self):
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        EmbeddedDashboardDAO.upsert(dash, ["test.example.com"])
        db.session.flush()
        uuid = str(dash.embedded[0].uuid)
        embedded = EmbeddedDashboardDAO.find_by_id(uuid)
        self.assertIsNotNone(embedded)
