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
import itertools
from unittest.mock import MagicMock, patch  # noqa: F401

import pytest
import yaml
from werkzeug.utils import secure_filename

from superset import db, security_manager
from superset.commands.dashboard.copy import CopyDashboardCommand
from superset.commands.dashboard.delete import DeleteEmbeddedDashboardCommand
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNotFoundError,
)
from superset.commands.dashboard.export import (
    append_charts,
    ExportDashboardsCommand,
    get_default_position,
)
from superset.commands.dashboard.fave import AddFavoriteDashboardCommand
from superset.commands.dashboard.importers import v0, v1
from superset.commands.dashboard.unfave import DelFavoriteDashboardCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    dashboard_export,
    dashboard_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)


class TestExportDashboardsCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command(self, mock_g1, mock_g2):
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = dict(command.run())

        expected_paths = {
            "metadata.yaml",
            f"dashboards/World_Banks_Data_{example_dashboard.id}.yaml",
            "datasets/examples/wb_health_population.yaml",
            "databases/examples.yaml",
        }
        for chart in example_dashboard.slices:
            chart_slug = secure_filename(chart.slice_name)
            expected_paths.add(f"charts/{chart_slug}_{chart.id}.yaml")
        assert expected_paths == set(contents.keys())

        metadata = yaml.safe_load(
            contents[f"dashboards/World_Banks_Data_{example_dashboard.id}.yaml"]()
        )

        # remove chart UUIDs from metadata so we can compare
        for chart_info in metadata["position"].values():
            if isinstance(chart_info, dict) and "uuid" in chart_info.get("meta", {}):
                del chart_info["meta"]["chartId"]
                del chart_info["meta"]["uuid"]

        assert metadata == {
            "dashboard_title": "World Bank's Data",
            "description": None,
            "css": None,
            "slug": "world_health",
            "certified_by": None,
            "certification_details": None,
            "published": False,
            "uuid": str(example_dashboard.uuid),
            "position": {
                "CHART-37982887": {
                    "children": [],
                    "id": "CHART-37982887",
                    "meta": {
                        "height": 52,
                        "sliceName": "World's Population",
                        "width": 2,
                    },
                    "type": "CHART",
                },
                "CHART-17e0f8d8": {
                    "children": [],
                    "id": "CHART-17e0f8d8",
                    "meta": {
                        "height": 92,
                        "sliceName": "Most Populated Countries",
                        "width": 3,
                    },
                    "type": "CHART",
                },
                "CHART-2ee52f30": {
                    "children": [],
                    "id": "CHART-2ee52f30",
                    "meta": {"height": 38, "sliceName": "Growth Rate", "width": 6},
                    "type": "CHART",
                },
                "CHART-2d5b6871": {
                    "children": [],
                    "id": "CHART-2d5b6871",
                    "meta": {"height": 52, "sliceName": "% Rural", "width": 7},
                    "type": "CHART",
                },
                "CHART-0fd0d252": {
                    "children": [],
                    "id": "CHART-0fd0d252",
                    "meta": {
                        "height": 50,
                        "sliceName": "Life Expectancy VS Rural %",
                        "width": 8,
                    },
                    "type": "CHART",
                },
                "CHART-97f4cb48": {
                    "children": [],
                    "id": "CHART-97f4cb48",
                    "meta": {"height": 38, "sliceName": "Rural Breakdown", "width": 3},
                    "type": "CHART",
                },
                "CHART-b5e05d6f": {
                    "children": [],
                    "id": "CHART-b5e05d6f",
                    "meta": {
                        "height": 50,
                        "sliceName": "World's Pop Growth",
                        "width": 4,
                    },
                    "type": "CHART",
                },
                "CHART-e76e9f5f": {
                    "children": [],
                    "id": "CHART-e76e9f5f",
                    "meta": {"height": 50, "sliceName": "Box plot", "width": 4},
                    "type": "CHART",
                },
                "CHART-a4808bba": {
                    "children": [],
                    "id": "CHART-a4808bba",
                    "meta": {"height": 50, "sliceName": "Treemap", "width": 8},
                    "type": "CHART",
                },
                "COLUMN-071bbbad": {
                    "children": ["ROW-1e064e3c", "ROW-afdefba9"],
                    "id": "COLUMN-071bbbad",
                    "meta": {"background": "BACKGROUND_TRANSPARENT", "width": 9},
                    "type": "COLUMN",
                },
                "COLUMN-fe3914b8": {
                    "children": ["CHART-37982887"],
                    "id": "COLUMN-fe3914b8",
                    "meta": {"background": "BACKGROUND_TRANSPARENT", "width": 2},
                    "type": "COLUMN",
                },
                "GRID_ID": {
                    "children": ["ROW-46632bc2", "ROW-3fa26c5d", "ROW-812b3f13"],
                    "id": "GRID_ID",
                    "type": "GRID",
                },
                "HEADER_ID": {
                    "id": "HEADER_ID",
                    "meta": {"text": "World's Bank Data"},
                    "type": "HEADER",
                },
                "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
                "ROW-1e064e3c": {
                    "children": ["COLUMN-fe3914b8", "CHART-2d5b6871"],
                    "id": "ROW-1e064e3c",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "type": "ROW",
                },
                "ROW-3fa26c5d": {
                    "children": ["CHART-b5e05d6f", "CHART-0fd0d252"],
                    "id": "ROW-3fa26c5d",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "type": "ROW",
                },
                "ROW-46632bc2": {
                    "children": ["COLUMN-071bbbad", "CHART-17e0f8d8"],
                    "id": "ROW-46632bc2",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "type": "ROW",
                },
                "ROW-812b3f13": {
                    "children": ["CHART-a4808bba", "CHART-e76e9f5f"],
                    "id": "ROW-812b3f13",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "type": "ROW",
                },
                "ROW-afdefba9": {
                    "children": ["CHART-2ee52f30", "CHART-97f4cb48"],
                    "id": "ROW-afdefba9",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "type": "ROW",
                },
                "DASHBOARD_VERSION_KEY": "v2",
            },
            "metadata": {"mock_key": "mock_value"},
            "version": "1.0.0",
        }

    # @pytest.mark.usefixtures("load_covid_dashboard")
    @pytest.mark.skip(reason="missing covid fixture")
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_dataset_references(self, mock_g1, mock_g2):
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = (
            db.session.query(Dashboard)
            .filter_by(uuid="f4065089-110a-41fa-8dd7-9ce98a65e250")
            .one()
        )
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = dict(command.run())

        expected_paths = {
            "metadata.yaml",
            f"dashboards/COVID_Vaccine_Dashboard_{example_dashboard.id}.yaml",
            "datasets/examples/covid_vaccines.yaml",  # referenced dataset needs to be exported
            "databases/examples.yaml",
        }
        for chart in example_dashboard.slices:
            chart_slug = secure_filename(chart.slice_name)
            expected_paths.add(f"charts/{chart_slug}_{chart.id}.yaml")
        assert expected_paths == set(contents.keys())

        metadata = yaml.safe_load(
            contents[f"dashboards/World_Banks_Data_{example_dashboard.id}.yaml"]()
        )

        # find the dataset references in native filter and check if they are correct
        assert "native_filter_configuration" in metadata["metadata"]

        for filter_config in metadata["metadata"][
            "native_filter_configuration"
        ].values():
            assert "targets" in filter_config
            targets = filter_config["targets"]

            for column in targets:
                # we need to find the correct datasetUuid (not datasetId)
                assert "datasetUuid" in column
                assert column["datasetUuid"] == "974b7a1c-22ea-49cb-9214-97b7dbd511e0"

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_no_access(self, mock_g1, mock_g2):
        """Test that users can't export datasets they don't have access to"""
        mock_g1.user = security_manager.find_user("gamma")
        mock_g2.user = security_manager.find_user("gamma")

        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = command.run()
        with self.assertRaises(DashboardNotFoundError):
            next(contents)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
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

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_key_order(self, mock_g1, mock_g2):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        command = ExportDashboardsCommand([example_dashboard.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(
            contents[f"dashboards/World_Banks_Data_{example_dashboard.id}.yaml"]()
        )
        assert list(metadata.keys()) == [
            "dashboard_title",
            "description",
            "css",
            "slug",
            "certified_by",
            "certification_details",
            "published",
            "uuid",
            "position",
            "metadata",
            "version",
        ]

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.commands.dashboard.export.suffix")
    def test_append_charts(self, mock_suffix):
        """Test that orphaned charts are added to the dashboard position"""
        # return deterministic IDs
        mock_suffix.side_effect = (str(i) for i in itertools.count(1))

        position = get_default_position("example")
        chart_1 = (
            db.session.query(Slice).filter_by(slice_name="World's Population").one()
        )
        new_position = append_charts(position, {chart_1})
        assert new_position == {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
            "GRID_ID": {
                "children": ["ROW-N-2"],
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "HEADER_ID": {
                "id": "HEADER_ID",
                "meta": {"text": "example"},
                "type": "HEADER",
            },
            "ROW-N-2": {
                "children": ["CHART-1"],
                "id": "ROW-N-2",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "type": "ROW",
                "parents": ["ROOT_ID", "GRID_ID"],
            },
            "CHART-1": {
                "children": [],
                "id": "CHART-1",
                "meta": {
                    "chartId": chart_1.id,
                    "height": 50,
                    "sliceName": "World's Population",
                    "uuid": str(chart_1.uuid),
                    "width": 4,
                },
                "type": "CHART",
                "parents": ["ROOT_ID", "GRID_ID", "ROW-N-2"],
            },
        }

        chart_2 = (
            db.session.query(Slice).filter_by(slice_name="World's Population").one()
        )
        new_position = append_charts(new_position, {chart_2})
        assert new_position == {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
            "GRID_ID": {
                "children": ["ROW-N-2", "ROW-N-4"],
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "HEADER_ID": {
                "id": "HEADER_ID",
                "meta": {"text": "example"},
                "type": "HEADER",
            },
            "ROW-N-2": {
                "children": ["CHART-1"],
                "id": "ROW-N-2",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "type": "ROW",
                "parents": ["ROOT_ID", "GRID_ID"],
            },
            "ROW-N-4": {
                "children": ["CHART-3"],
                "id": "ROW-N-4",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "type": "ROW",
                "parents": ["ROOT_ID", "GRID_ID"],
            },
            "CHART-1": {
                "children": [],
                "id": "CHART-1",
                "meta": {
                    "chartId": chart_1.id,
                    "height": 50,
                    "sliceName": "World's Population",
                    "uuid": str(chart_1.uuid),
                    "width": 4,
                },
                "type": "CHART",
                "parents": ["ROOT_ID", "GRID_ID", "ROW-N-2"],
            },
            "CHART-3": {
                "children": [],
                "id": "CHART-3",
                "meta": {
                    "chartId": chart_2.id,
                    "height": 50,
                    "sliceName": "World's Population",
                    "uuid": str(chart_2.uuid),
                    "width": 4,
                },
                "type": "CHART",
                "parents": ["ROOT_ID", "GRID_ID", "ROW-N-4"],
            },
        }

        position = {"DASHBOARD_VERSION_KEY": "v2"}
        new_position = append_charts(position, [chart_1, chart_2])
        assert new_position == {
            "CHART-5": {
                "children": [],
                "id": "CHART-5",
                "meta": {
                    "chartId": chart_1.id,
                    "height": 50,
                    "sliceName": "World's Population",
                    "uuid": str(chart_1.uuid),
                    "width": 4,
                },
                "type": "CHART",
            },
            "CHART-6": {
                "children": [],
                "id": "CHART-6",
                "meta": {
                    "chartId": chart_2.id,
                    "height": 50,
                    "sliceName": "World's Population",
                    "uuid": str(chart_2.uuid),
                    "width": 4,
                },
                "type": "CHART",
            },
            "DASHBOARD_VERSION_KEY": "v2",
        }

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.security.manager.g")
    @patch("superset.views.base.g")
    def test_export_dashboard_command_no_related(self, mock_g1, mock_g2):
        """
        Test that only the dashboard is exported when export_related=False.
        """
        mock_g1.user = security_manager.find_user("admin")
        mock_g2.user = security_manager.find_user("admin")

        example_dashboard = (
            db.session.query(Dashboard).filter_by(slug="world_health").one()
        )
        command = ExportDashboardsCommand([example_dashboard.id], export_related=False)
        contents = dict(command.run())

        expected_paths = {
            "metadata.yaml",
            f"dashboards/World_Banks_Data_{example_dashboard.id}.yaml",
        }
        assert expected_paths == set(contents.keys())


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

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_dashboard(self, mock_add_permissions, sm_g, utils_g):
        """Test that we can import a dashboard"""
        admin = sm_g.user = utils_g.user = security_manager.find_user("admin")
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
            "expanded_slices": {str(new_chart_id): True},
            "import_time": 1604342885,
            "native_filter_configuration": [],
            "refresh_frequency": 0,
            "remote_id": 7,
            "timed_refresh_immune_slices": [new_chart_id],
        }

        dataset = chart.table
        assert str(dataset.uuid) == dataset_config["uuid"]

        assert json.loads(chart.query_context) == {
            "datasource": {"id": dataset.id, "type": "table"},
            "force": False,
            "queries": [
                {
                    "annotation_layers": [],
                    "applied_time_extras": {},
                    "columns": [],
                    "custom_form_data": {},
                    "custom_params": {},
                    "extras": {"having": "", "time_grain_sqla": None, "where": ""},
                    "filters": [],
                    "metrics": [],
                    "order_desc": True,
                    "row_limit": 5000,
                    "time_range": " : ",
                    "timeseries_limit": 0,
                    "url_params": {},
                }
            ],
            "result_format": "json",
            "result_type": "full",
        }
        assert json.loads(chart.params)["datasource"] == dataset.uid

        database = dataset.database
        assert str(database.uuid) == database_config["uuid"]

        assert dashboard.owners == [admin]

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_dashboard_multiple(self, mock_add_permissions, mock_g):
        """Test that a dashboard can be imported multiple times"""
        mock_g.user = security_manager.find_user("admin")

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


class TestCopyDashboardCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_command(self):
        """Test that an admin user can copy a dashboard"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )
            copy_data = {"dashboard_title": "Copied Dashboard", "json_metadata": "{}"}

            with override_user(security_manager.find_user("admin")):
                command = CopyDashboardCommand(example_dashboard, copy_data)
                copied_dashboard = command.run()

            assert copied_dashboard.dashboard_title == "Copied Dashboard"
            assert copied_dashboard.slug != example_dashboard.slug
            assert copied_dashboard.slices == example_dashboard.slices

            db.session.delete(copied_dashboard)
            db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_command_no_access(self):
        """Test that a non-owner user cannot copy a dashboard if DASHBOARD_RBAC is enabled"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )
            copy_data = {"dashboard_title": "Copied Dashboard", "json_metadata": "{}"}

            with override_user(security_manager.find_user("gamma")):
                with patch(
                    "superset.commands.dashboard.copy.is_feature_enabled",
                    return_value=True,
                ):
                    command = CopyDashboardCommand(example_dashboard, copy_data)
                    with self.assertRaises(DashboardForbiddenError):
                        command.run()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_command_invalid_data(self):
        """Test that invalid data raises a DashboardInvalidError"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )
        invalid_copy_data = {"dashboard_title": "", "json_metadata": "{}"}

        with override_user(security_manager.find_user("admin")):
            command = CopyDashboardCommand(example_dashboard, invalid_copy_data)
            with self.assertRaises(DashboardInvalidError):
                command.run()


class TestDeleteEmbeddedDashboardCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_delete_embedded_dashboard_command(self):
        """Test that an admin user can add and then delete an embedded dashboard"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )

            # Step 1: Add an embedded dashboard
            new_embedded_dashboard = EmbeddedDashboard(
                dashboard_id=example_dashboard.id
            )
            db.session.add(new_embedded_dashboard)
            db.session.commit()

            # Step 2: Assert that the embedded dashboard was added
            embedded_dashboards = example_dashboard.embedded
            assert len(embedded_dashboards) > 0
            assert new_embedded_dashboard in embedded_dashboards

            # Step 3: Delete the embedded dashboard
            with override_user(security_manager.find_user("admin")):
                command = DeleteEmbeddedDashboardCommand(example_dashboard)
                command.run()

            # Step 4: Assert that the embedded dashboard was deleted
            deleted_embedded_dashboard = (
                db.session.query(EmbeddedDashboard)
                .filter_by(uuid=new_embedded_dashboard.uuid)
                .one_or_none()
            )
            assert deleted_embedded_dashboard is None


class TestFavoriteDashboardCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_fave_unfave_dashboard_command(self):
        """Test that a user can fave/unfave a dashboard"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )

            # Assert that the dashboard exists
            assert example_dashboard is not None

            with override_user(security_manager.find_user("admin")):
                with patch(
                    "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
                    return_value=example_dashboard,
                ):
                    AddFavoriteDashboardCommand(example_dashboard.id).run()

                    # Assert that the dashboard was faved
                    ids = DashboardDAO.favorited_ids([example_dashboard])
                    assert example_dashboard.id in ids

                    DelFavoriteDashboardCommand(example_dashboard.id).run()

                    # Assert that the dashboard was unfaved
                    ids = DashboardDAO.favorited_ids([example_dashboard])
                    assert example_dashboard.id not in ids

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_fave_unfave_dashboard_command_not_found(self):
        """Test that faving / unfaving a non-existing dashboard raises an exception"""
        with self.client.application.test_request_context():
            example_dashboard_id = 1234

            with override_user(security_manager.find_user("admin")):
                with self.assertRaises(DashboardNotFoundError):
                    AddFavoriteDashboardCommand(example_dashboard_id).run()

                with self.assertRaises(DashboardNotFoundError):
                    DelFavoriteDashboardCommand(example_dashboard_id).run()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.models.dashboard.Dashboard.get")
    def test_fave_unfave_dashboard_command_forbidden(self, mock_get):
        """Test that faving / unfaving raises an exception for a dashboard the user doesn't own"""
        with self.client.application.test_request_context():
            example_dashboard = (
                db.session.query(Dashboard).filter_by(slug="world_health").one()
            )

            mock_get.return_value = example_dashboard

            # Assert that the dashboard exists
            assert example_dashboard is not None

            with override_user(security_manager.find_user("gamma")):
                with self.assertRaises(DashboardAccessDeniedError):
                    AddFavoriteDashboardCommand(example_dashboard.uuid).run()

                with self.assertRaises(DashboardAccessDeniedError):
                    DelFavoriteDashboardCommand(example_dashboard.uuid).run()
