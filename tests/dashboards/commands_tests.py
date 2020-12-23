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
# pylint: disable=no-self-use, invalid-name

import json
from unittest.mock import patch

import pytest
import yaml
from werkzeug.utils import secure_filename

from superset import db, security_manager
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.commands.export import ExportDashboardsCommand
from superset.dashboards.commands.importers import v0, v1
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.base_tests import SupersetTestCase
from tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    dashboard_export,
    dashboard_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
)


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
            "datasets/examples/wb_health_population.yaml",
            "databases/examples.yaml",
        }
        for chart in example_dashboard.slices:
            chart_slug = secure_filename(chart.slice_name)
            expected_paths.add(f"charts/{chart_slug}_{chart.id}.yaml")
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


class TestImportDashboardsCommand(SupersetTestCase):
    def test_import_v0_dashboard_cli_export(self):
        num_dashboards = db.session.query(Dashboard).count()
        num_charts = db.session.query(Slice).count()
        num_datasets = db.session.query(SqlaTable).count()
        num_databases = db.session.query(Database).count()

        contents = {
            "20201119_181105.json": json.dumps(dashboard_export),
        }
        command = v0.ImportDashboardsCommand(contents)
        command.run()

        new_num_dashboards = db.session.query(Dashboard).count()
        new_num_charts = db.session.query(Slice).count()
        new_num_datasets = db.session.query(SqlaTable).count()
        new_num_databases = db.session.query(Database).count()
        assert new_num_dashboards == num_dashboards + 1
        assert new_num_charts == num_charts + 1
        assert new_num_datasets == num_datasets + 1
        assert new_num_databases == num_databases

        dashboard = (
            db.session.query(Dashboard).filter_by(dashboard_title="Births 2").one()
        )
        assert len(dashboard.slices) == 1
        chart = dashboard.slices[0]
        assert chart.slice_name == "Number of California Births"

        dataset = chart.table
        assert dataset.table_name == "birth_names_2"

        database = dataset.database
        assert database.database_name == "examples"

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.commit()

    def test_import_v1_dashboard(self):
        """Test that we can import a dashboard"""
        contents = {
            "metadata.yaml": yaml.safe_dump(dashboard_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }
        command = v1.ImportDashboardsCommand(contents)
        command.run()

        dashboard = (
            db.session.query(Dashboard).filter_by(uuid=dashboard_config["uuid"]).one()
        )

        assert len(dashboard.slices) == 1
        chart = dashboard.slices[0]
        assert str(chart.uuid) == chart_config["uuid"]
        new_chart_id = chart.id

        assert dashboard.dashboard_title == "Test dash"
        assert dashboard.description is None
        assert dashboard.css == ""
        assert dashboard.slug is None
        assert json.loads(dashboard.position_json) == {
            "CHART-SVAlICPOSJ": {
                "children": [],
                "id": "CHART-SVAlICPOSJ",
                "meta": {
                    "chartId": new_chart_id,
                    "height": 50,
                    "sliceName": "Number of California Births",
                    "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
                    "width": 4,
                },
                "parents": ["ROOT_ID", "GRID_ID", "ROW-dP_CHaK2q"],
                "type": "CHART",
            },
            "DASHBOARD_VERSION_KEY": "v2",
            "GRID_ID": {
                "children": ["ROW-dP_CHaK2q"],
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "HEADER_ID": {
                "id": "HEADER_ID",
                "meta": {"text": "Test dash"},
                "type": "HEADER",
            },
            "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
            "ROW-dP_CHaK2q": {
                "children": ["CHART-SVAlICPOSJ"],
                "id": "ROW-dP_CHaK2q",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "parents": ["ROOT_ID", "GRID_ID"],
                "type": "ROW",
            },
        }
        assert json.loads(dashboard.json_metadata) == {
            "color_scheme": None,
            "default_filters": "{}",
            "expanded_slices": {str(new_chart_id): True},
            "filter_scopes": {
                str(new_chart_id): {
                    "region": {"scope": ["ROOT_ID"], "immune": [new_chart_id]}
                },
            },
            "import_time": 1604342885,
            "refresh_frequency": 0,
            "remote_id": 7,
            "timed_refresh_immune_slices": [new_chart_id],
        }

        dataset = chart.table
        assert str(dataset.uuid) == dataset_config["uuid"]

        database = dataset.database
        assert str(database.uuid) == database_config["uuid"]

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_dashboard_multiple(self):
        """Test that a dashboard can be imported multiple times"""
        num_dashboards = db.session.query(Dashboard).count()

        contents = {
            "metadata.yaml": yaml.safe_dump(dashboard_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }
        command = v1.ImportDashboardsCommand(contents, overwrite=True)
        command.run()
        command.run()

        new_num_dashboards = db.session.query(Dashboard).count()
        assert new_num_dashboards == num_dashboards + 1

        dashboard = (
            db.session.query(Dashboard).filter_by(uuid=dashboard_config["uuid"]).one()
        )
        chart = dashboard.slices[0]
        dataset = chart.table
        database = dataset.database

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_dashboard_validation(self):
        """Test different validations applied when importing a dashboard"""
        # metadata.yaml must be present
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }
        command = v1.ImportDashboardsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Missing metadata.yaml"

        # version should be 1.0.0
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "2.0.0",
                "type": "Database",
                "timestamp": "2020-11-04T21:27:44.423819+00:00",
            }
        )
        command = v1.ImportDashboardsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be Database
        contents["metadata.yaml"] = yaml.safe_dump(dataset_metadata_config)
        command = v1.ImportDashboardsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing dashboard"
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to Dashboard."]}
        }

        # must also validate datasets
        broken_config = dataset_config.copy()
        del broken_config["table_name"]
        contents["metadata.yaml"] = yaml.safe_dump(dashboard_metadata_config)
        contents["datasets/imported_dataset.yaml"] = yaml.safe_dump(broken_config)
        command = v1.ImportDashboardsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing dashboard"
        assert excinfo.value.normalized_messages() == {
            "datasets/imported_dataset.yaml": {
                "table_name": ["Missing data for required field."],
            }
        }
