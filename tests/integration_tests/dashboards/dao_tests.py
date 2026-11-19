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
from typing import Any
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy import func, select

import tests.integration_tests.test_app  # pylint: disable=unused-import  # noqa: F401
from superset import db, security_manager
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json
from superset.daos.dashboard import DashboardDAO
from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.models.dashboard import Dashboard
from superset.models.helpers import skip_visibility_filter
from superset.models.slice import Slice
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
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    def test_set_dash_metadata_preserves_unsent_fields(self, mock_sm_g, mock_g):
        """
        set_dash_metadata must not reset metadata fields that are absent from the
        incoming payload, such as a ``refresh_frequency`` edited directly in the
        Advanced JSON editor (#42116). Fields that are present still override.
        """
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
        with self.client.application.test_request_context():
            dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").first()
            )
            original_json_metadata = dashboard.json_metadata
            try:
                # Seed existing values in the stored metadata, including
                # cross_filters_enabled=False -- its default is True, so this
                # is the field that actually exercises this PR's change (the
                # refresh_frequency preservation alone already landed in
                # #42354).
                metadata = json.loads(dashboard.json_metadata or "{}")
                metadata["refresh_frequency"] = 60
                metadata["cross_filters_enabled"] = False
                dashboard.json_metadata = json.dumps(metadata)
                db.session.commit()

                # Payload omits refresh_frequency and cross_filters_enabled:
                # both must be preserved, not reset to their defaults.
                DashboardDAO.set_dash_metadata(
                    dashboard, {"color_scheme": "d3Category10"}
                )
                db.session.commit()
                saved = json.loads(dashboard.json_metadata)
                assert saved["refresh_frequency"] == 60
                assert saved["cross_filters_enabled"] is False
                assert saved["color_scheme"] == "d3Category10"

                # An explicitly-sent value still overrides.
                DashboardDAO.set_dash_metadata(
                    dashboard,
                    {"refresh_frequency": 30, "cross_filters_enabled": True},
                )
                db.session.commit()
                saved = json.loads(dashboard.json_metadata)
                assert saved["refresh_frequency"] == 30
                assert saved["cross_filters_enabled"] is True
            finally:
                dashboard.json_metadata = original_json_metadata
                db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    @patch("superset.security.manager.g")
    def test_copy_dashboard(self, mock_sm_g, mock_g):
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
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
        admin = security_manager.find_user("admin")
        admin_subject = (
            db.session.query(Subject)
            .filter_by(user_id=admin.id, type=SubjectType.USER)
            .first()
        )
        assert dash.editors == [admin_subject]
        self.assertCountEqual(dash.slices, original_dash.slices)  # noqa: PT009

        db.session.delete(dash)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    @patch("superset.security.manager.g")
    def test_copy_dashboard_copies_native_filters(self, mock_sm_g, mock_g):
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
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
    @patch("superset.security.manager.g")
    def test_copy_dashboard_duplicate_slices(self, mock_sm_g, mock_g):
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
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
        admin = security_manager.find_user("admin")
        admin_subject = (
            db.session.query(Subject)
            .filter_by(user_id=admin.id, type=SubjectType.USER)
            .first()
        )
        assert dash.editors == [admin_subject]
        assert len(dash.slices) == len(original_dash.slices)
        for original_slc in original_dash.slices:
            for slc in dash.slices:
                assert slc.id != original_slc.id

        for slc in dash.slices:
            db.session.delete(slc)
        db.session.delete(dash)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    @patch("superset.security.manager.g")
    def test_copy_dashboard_duplicate_slices_with_hard_deleted_chart(
        self, mock_sm_g: MagicMock, mock_g: MagicMock
    ) -> None:
        """Repair absent chart slots before remapping the surviving chart clones."""
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
        original_dash: Dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        original_id: int = original_dash.id
        original_positions: str = original_dash.position_json
        original_metadata: str = original_dash.json_metadata
        original_slice_ids: set[int] = {slc.id for slc in original_dash.slices}
        metadata: dict[str, Any] = json.loads(original_metadata)
        positions: dict[str, Any] = original_dash.position
        live_node_key: str = next(
            key
            for key, node in positions.items()
            if isinstance(node, dict) and node.get("type") == "CHART"
        )
        with skip_visibility_filter(db.session, Slice):
            missing_id: int = (
                db.session.scalar(select(func.max(Slice.id))) or 0
            ) + 1000
        missing_node: dict[str, Any] = {
            "id": "CHART-hard-deleted",
            "type": "CHART",
            "parents": ["ROOT_ID", "GRID_ID", "ROW-hard-deleted"],
            "children": [],
            "meta": {"chartId": missing_id, "width": 6, "height": 42},
        }
        positions["ROW-hard-deleted"] = {
            "id": "ROW-hard-deleted",
            "type": "ROW",
            "parents": ["ROOT_ID", "GRID_ID"],
            "children": [missing_node["id"]],
        }
        positions["GRID_ID"]["children"].append("ROW-hard-deleted")
        positions[missing_node["id"]] = copy.deepcopy(missing_node)
        metadata["positions"] = positions
        dash_data: dict[str, Any] = {
            "dashboard_title": "copied dash with missing chart",
            "json_metadata": json.dumps(metadata),
            "duplicate_slices": True,
        }
        dash: Dashboard | None = None
        try:
            dash = DashboardDAO.copy_dashboard(original_dash, dash_data)
            copied_positions: dict[str, Any] = dash.position
            clones: dict[int, Slice] = {slc.id: slc for slc in dash.slices}
            live_meta: dict[str, Any] = copied_positions[live_node_key]["meta"]
            assert live_meta["chartId"] in clones
            assert live_meta["chartId"] not in original_slice_ids
            assert live_meta["uuid"] == str(clones[live_meta["chartId"]].uuid)
            repaired: dict[str, Any] = copied_positions[missing_node["id"]]
            assert repaired["type"] == "MARKDOWN"
            assert repaired["id"] == missing_node["id"]
            assert repaired["parents"] == missing_node["parents"]
            assert repaired["children"] == missing_node["children"]
            assert repaired["meta"]["width"] == 6
            assert repaired["meta"]["height"] == 42
            assert copied_positions["ROW-hard-deleted"] == positions["ROW-hard-deleted"]
            assert all(
                node.get("meta", {}).get("chartId") is not None
                for node in copied_positions.values()
                if isinstance(node, dict) and node.get("type") == "CHART"
            )
            assert len(clones) == len(original_slice_ids)
            assert set(clones).isdisjoint(original_slice_ids | {missing_id})
            db.session.flush()
            db.session.expire(original_dash)
            source: Dashboard = (
                db.session.query(Dashboard).filter_by(id=original_id).one()
            )
            assert source.position_json == original_positions
            assert source.json_metadata == original_metadata
        finally:
            # The copy is flushed but never committed. Roll it back rather
            # than generating CREATE and DELETE association versions in the
            # same Continuum transaction during fixture cleanup.
            db.session.rollback()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.daos.dashboard.g")
    @patch("superset.security.manager.g")
    def test_copy_dashboard_duplicate_slices_rejects_malformed_chart(
        self, mock_sm_g: MagicMock, mock_g: MagicMock
    ) -> None:
        """Keep rejecting chart nodes whose original chart ID is unusable."""
        mock_g.user = mock_sm_g.user = security_manager.find_user("admin")
        original_dash: Dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        metadata: dict[str, Any] = json.loads(original_dash.json_metadata)
        metadata["positions"] = original_dash.position
        metadata["positions"]["CHART-malformed"] = {
            "id": "CHART-malformed",
            "type": "CHART",
            "meta": {"chartId": "unreadable"},
        }
        dash_data: dict[str, Any] = {
            "dashboard_title": "malformed copy",
            "json_metadata": json.dumps(metadata),
            "duplicate_slices": True,
        }
        try:
            with pytest.raises(DashboardInvalidError):
                DashboardDAO.copy_dashboard(original_dash, dash_data)
        finally:
            db.session.rollback()
