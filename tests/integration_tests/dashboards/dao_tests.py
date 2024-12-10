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
import copy
import time
from unittest.mock import patch
import pytest

import tests.integration_tests.test_app  # pylint: disable=unused-import  # noqa: F401
from superset import db, security_manager
from superset.utils import json
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)


class TestDashboardDAO(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    def test_get_dashboard_changed_on(self, mock_sm_g, mock_g):
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
        with self.client.application.test_request_context():
            dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").first()
            )

            changed_on = dashboard.changed_on.replace(microsecond=0)
            assert changed_on == DashboardDAO.get_dashboard_changed_on(dashboard)
            assert changed_on == DashboardDAO.get_dashboard_changed_on("world_health")

            old_changed_on = dashboard.changed_on

            # freezegun doesn't work for some reason, so we need to sleep here :(
            time.sleep(1)
            data = dashboard.data
            positions = data["position_json"]
            data.update({"positions": positions})
            original_data = copy.deepcopy(data)

            data.update({"foo": "bar"})
            DashboardDAO.set_dash_metadata(dashboard, data)
            db.session.commit()
            new_changed_on = DashboardDAO.get_dashboard_changed_on(dashboard)
            assert old_changed_on.replace(microsecond=0) < new_changed_on
            assert new_changed_on == DashboardDAO.get_dashboard_and_datasets_changed_on(
                dashboard
            )
            assert new_changed_on == DashboardDAO.get_dashboard_and_slices_changed_on(
                dashboard
            )

            DashboardDAO.set_dash_metadata(dashboard, original_data)
            db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    def test_copy_dashboard(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        original_dash = (
            db.session.query(Dashboard).filter_by(slug="world_health").first()
        )
        metadata = json.loads(original_dash.json_metadata)
        metadata["positions"] = original_dash.position
        dash_data = {
            "dashboard_title": "copied dash",
            "json_metadata": json.dumps(metadata),
            "css": "<css>",
            "duplicate_slices": False,
        }
        dash = DashboardDAO.copy_dashboard(original_dash, dash_data)
        assert dash.id != original_dash.id
        assert len(dash.position) == len(original_dash.position)
        assert dash.dashboard_title == "copied dash"
        assert dash.css == "<css>"
        assert dash.owners == [security_manager.find_user("admin")]
        self.assertCountEqual(dash.slices, original_dash.slices)  # noqa: PT009

        db.session.delete(dash)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    def test_copy_dashboard_copies_native_filters(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        original_dash = (
            db.session.query(Dashboard).filter_by(slug="world_health").first()
        )
        # Give the original dash a "native filter"
        original_dash_params = original_dash.params_dict
        original_dash_params["native_filter_configuration"] = [{"mock": "filter"}]
        original_dash.json_metadata = json.dumps(original_dash_params)

        metadata = json.loads(original_dash.json_metadata)
        metadata["positions"] = original_dash.position
        dash_data = {
            "dashboard_title": "copied dash",
            "json_metadata": json.dumps(metadata),
            "css": "<css>",
            "duplicate_slices": False,
        }
        dash = DashboardDAO.copy_dashboard(original_dash, dash_data)
        assert dash.params_dict["native_filter_configuration"] == [{"mock": "filter"}]

        db.session.delete(dash)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    def test_copy_dashboard_duplicate_slices(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        original_dash = (
            db.session.query(Dashboard).filter_by(slug="world_health").first()
        )
        metadata = json.loads(original_dash.json_metadata)
        metadata["positions"] = original_dash.position
        dash_data = {
            "dashboard_title": "copied dash",
            "json_metadata": json.dumps(metadata),
            "css": "<css>",
            "duplicate_slices": True,
        }
        dash = DashboardDAO.copy_dashboard(original_dash, dash_data)
        assert dash.id != original_dash.id
        assert len(dash.position) == len(original_dash.position)
        assert dash.dashboard_title == "copied dash"
        assert dash.css == "<css>"
        assert dash.owners == [security_manager.find_user("admin")]
        assert len(dash.slices) == len(original_dash.slices)
        for original_slc in original_dash.slices:
            for slc in dash.slices:
                assert slc.id != original_slc.id

        for slc in dash.slices:
            db.session.delete(slc)
        db.session.delete(dash)
        db.session.commit()
