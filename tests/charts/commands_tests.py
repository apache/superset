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

from superset import db, security_manager
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.commands.export import ExportChartsCommand
from superset.charts.commands.importers.v1 import ImportChartsCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.slice import Slice
from tests.base_tests import SupersetTestCase
from tests.fixtures.energy_dashboard import load_energy_table_with_slice
from tests.fixtures.importexport import (
    chart_config,
    chart_metadata_config,
    database_config,
    database_metadata_config,
    dataset_config,
)


class TestExportChartsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_chart = (
            db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        )
        command = ExportChartsCommand([example_chart.id])
        contents = dict(command.run())

        expected = [
            "metadata.yaml",
            f"charts/Energy_Sankey_{example_chart.id}.yaml",
            "datasets/examples/energy_usage.yaml",
            "databases/examples.yaml",
        ]
        assert expected == list(contents.keys())

        metadata = yaml.safe_load(
            contents[f"charts/Energy_Sankey_{example_chart.id}.yaml"]
        )
        assert metadata == {
            "slice_name": "Energy Sankey",
            "viz_type": "sankey",
            "params": {
                "collapsed_fieldsets": "",
                "groupby": ["source", "target"],
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Energy Sankey",
                "viz_type": "sankey",
            },
            "cache_timeout": None,
            "dataset_uuid": str(example_chart.table.uuid),
            "uuid": str(example_chart.uuid),
            "version": "1.0.0",
        }

    @patch("superset.security.manager.g")
    def test_export_chart_command_no_access(self, mock_g):
        """Test that users can't export datasets they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        example_chart = db.session.query(Slice).all()[0]
        command = ExportChartsCommand([example_chart.id])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_chart_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportChartsCommand([-1])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_chart = (
            db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        )
        command = ExportChartsCommand([example_chart.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(
            contents[f"charts/Energy_Sankey_{example_chart.id}.yaml"]
        )
        assert list(metadata.keys()) == [
            "slice_name",
            "viz_type",
            "params",
            "cache_timeout",
            "uuid",
            "version",
            "dataset_uuid",
        ]


class TestImportChartsCommand(SupersetTestCase):
    def test_import_v1_chart(self):
        """Test that we can import a chart"""
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents)
        command.run()

        chart = db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()
        assert json.loads(chart.params) == {
            "color_picker": {"a": 1, "b": 135, "g": 122, "r": 0},
            "datasource": "12__table",
            "js_columns": ["color"],
            "js_data_mutator": "data => data.map(d => ({\\n    ...d,\\n    color: colors.hexToRGB(d.extraProps.color)\\n}));",
            "js_onclick_href": "",
            "js_tooltip": "",
            "line_column": "path_json",
            "line_type": "json",
            "line_width": 150,
            "mapbox_style": "mapbox://styles/mapbox/light-v9",
            "reverse_long_lat": False,
            "row_limit": 5000,
            "slice_id": 43,
            "time_grain_sqla": None,
            "time_range": " : ",
            "viewport": {
                "altitude": 1.5,
                "bearing": 0,
                "height": 1094,
                "latitude": 37.73671752604488,
                "longitude": -122.18885402582598,
                "maxLatitude": 85.05113,
                "maxPitch": 60,
                "maxZoom": 20,
                "minLatitude": -85.05113,
                "minPitch": 0,
                "minZoom": 0,
                "pitch": 0,
                "width": 669,
                "zoom": 9.51847667620428,
            },
            "viz_type": "deck_path",
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert dataset.table_name == "imported_dataset"
        assert chart.table == dataset

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.database_name == "imported_database"
        assert chart.table.database == database

        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_chart_multiple(self):
        """Test that a dataset can be imported multiple times"""
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents, overwrite=True)
        command.run()
        command.run()

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        charts = db.session.query(Slice).filter_by(datasource_id=dataset.id).all()
        assert len(charts) == 1

        database = dataset.database

        db.session.delete(charts[0])
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_chart_validation(self):
        """Test different validations applied when importing a chart"""
        # metadata.yaml must be present
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Missing metadata.yaml"

        # version should be 1.0.0
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "2.0.0",
                "type": "SqlaTable",
                "timestamp": "2020-11-04T21:27:44.423819+00:00",
            }
        )
        command = ImportChartsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be Slice
        contents["metadata.yaml"] = yaml.safe_dump(database_metadata_config)
        command = ImportChartsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing chart"
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to Slice."]}
        }

        # must also validate datasets and databases
        broken_config = database_config.copy()
        del broken_config["database_name"]
        contents["metadata.yaml"] = yaml.safe_dump(chart_metadata_config)
        contents["databases/imported_database.yaml"] = yaml.safe_dump(broken_config)
        command = ImportChartsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing chart"
        assert excinfo.value.normalized_messages() == {
            "databases/imported_database.yaml": {
                "database_name": ["Missing data for required field."],
            }
        }
