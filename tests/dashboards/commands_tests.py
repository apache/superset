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

from unittest.mock import patch

import yaml

from superset import db, security_manager
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.commands.export import ExportDashboardsCommand
from superset.models.dashboard import Dashboard
from tests.base_tests import SupersetTestCase


class TestExportDashboardsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command(self, mock_g1, mock_g2):
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = db.session.query(Dashboard).filter_by(id=1).one()
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = dict(command.run())

        expected_paths = {
            "metadata.yaml",
            "dashboards/World_Banks_Data.yaml",
            "charts/Region_Filter.yaml",
            "datasets/examples/wb_health_population.yaml",
            "databases/examples.yaml",
            "charts/Worlds_Population.yaml",
            "charts/Most_Populated_Countries.yaml",
            "charts/Growth_Rate.yaml",
            "charts/Rural.yaml",
            "charts/Life_Expectancy_VS_Rural.yaml",
            "charts/Rural_Breakdown.yaml",
            "charts/Worlds_Pop_Growth.yaml",
            "charts/Box_plot.yaml",
            "charts/Treemap.yaml",
        }
        assert expected_paths == set(contents.keys())

        metadata = yaml.safe_load(contents["dashboards/World_Banks_Data.yaml"])

        # remove chart UUIDs from metadata so we can compare
        for chart_info in metadata["position"].values():
            if isinstance(chart_info, dict) and "uuid" in chart_info.get("meta", {}):
                del chart_info["meta"]["chartId"]
                del chart_info["meta"]["uuid"]

        assert metadata == {
            "dashboard_title": "World Bank's Data",
            "description": None,
            "css": "",
            "slug": "world_health",
            "uuid": str(example_dashboard.uuid),
            "position": {
                "DASHBOARD_CHART_TYPE-0": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-0",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-1": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-1",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-2": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-2",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-3": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-3",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-4": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-4",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-5": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-5",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-6": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-6",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-7": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-7",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-8": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-8",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_CHART_TYPE-9": {
                    "children": [],
                    "id": "DASHBOARD_CHART_TYPE-9",
                    "meta": {"height": 50, "width": 4},
                    "type": "CHART",
                },
                "DASHBOARD_VERSION_KEY": "v2",
            },
            "metadata": {
                "timed_refresh_immune_slices": [],
                "expanded_slices": {},
                "refresh_frequency": 0,
                "default_filters": "{}",
                "color_scheme": None,
            },
            "version": "1.0.0",
        }

    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_no_access(self, mock_g1, mock_g2):
        """Test that users can't export datasets they don't have access to"""
        mock_g1.user = security_manager.find_user("gamma")
        mock_g2.user = security_manager.find_user("gamma")

        example_dashboard = db.session.query(Dashboard).filter_by(id=1).one()
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = command.run()
        with self.assertRaises(DashboardNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_invalid_dataset(self, mock_g1, mock_g2):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")
        command = ExportDashboardsCommand([-1])
        contents = command.run()
        with self.assertRaises(DashboardNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_key_order(self, mock_g1, mock_g2):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = db.session.query(Dashboard).filter_by(id=1).one()
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(contents["dashboards/World_Banks_Data.yaml"])
        assert list(metadata.keys()) == [
            "dashboard_title",
            "description",
            "css",
            "slug",
            "uuid",
            "position",
            "metadata",
            "version",
        ]
