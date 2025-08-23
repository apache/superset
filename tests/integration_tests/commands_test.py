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
import copy
from unittest.mock import patch

import yaml
from flask import g

from superset import db
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.assets import ImportAssetsCommand
from superset.commands.importers.v1.utils import is_valid_config
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    database_config,
    dataset_config,
)

metadata_config = {
    "version": "1.0.0",
    "type": "assets",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}


class TestCommandsExceptions(SupersetTestCase):
    def test_command_invalid_error(self):
        exception = CommandInvalidError("A test")
        assert str(exception) == "A test"


class TestImportersV1Utils(SupersetTestCase):
    def test_is_valid_config(self):
        assert is_valid_config("metadata.yaml")
        assert is_valid_config("databases/examples.yaml")
        assert not is_valid_config(".DS_Store")
        assert not is_valid_config(
            "__MACOSX/chart_export_20210111T145253/databases/._examples.yaml"
        )


class TestImportAssetsCommand(SupersetTestCase):
    def setUp(self):
        user = self.get_user("admin")
        self.user = user
        setattr(g, "user", user)

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_assets(self, mock_add_permissions):
        """Test that we can import multiple assets"""

        contents = {
            "metadata.yaml": yaml.safe_dump(metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }
        command = ImportAssetsCommand(contents)
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

        assert dashboard.owners == [self.user]

        mock_add_permissions.assert_called_with(database, None)

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_dashboard_overwrite(self, mock_add_permissions):
        """Test that assets can be overwritten"""
        contents = {
            "metadata.yaml": yaml.safe_dump(metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }

        command = ImportAssetsCommand(contents)
        command.run()
        chart = db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()
        assert chart.cache_timeout is None

        modified_chart_config = copy.deepcopy(chart_config)
        modified_chart_config["cache_timeout"] = 3600
        contents = {
            "metadata.yaml": yaml.safe_dump(metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(modified_chart_config),
            "dashboards/imported_dashboard.yaml": yaml.safe_dump(dashboard_config),
        }
        command = ImportAssetsCommand(contents)
        command.run()
        chart = db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()
        assert chart.cache_timeout == 3600

        dashboard = (
            db.session.query(Dashboard).filter_by(uuid=dashboard_config["uuid"]).one()
        )
        chart = dashboard.slices[0]
        dataset = chart.table
        database = dataset.database

        mock_add_permissions.assert_called_with(database, None)

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()
