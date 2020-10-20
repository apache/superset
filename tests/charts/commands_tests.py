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
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.commands.export import ExportChartsCommand
from superset.models.slice import Slice
from tests.base_tests import SupersetTestCase


class TestExportChartsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    def test_export_chart_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_chart = db.session.query(Slice).all()[0]
        command = ExportChartsCommand(chart_ids=[example_chart.id])
        contents = dict(command.run())

        expected = [
            "charts/energy_sankey.yaml",
            "datasets/examples/energy_usage.yaml",
            "databases/examples.yaml",
        ]
        assert expected == list(contents.keys())

        metadata = yaml.safe_load(contents["charts/energy_sankey.yaml"])
        assert metadata == {
            "slice_name": "Energy Sankey",
            "viz_type": "sankey",
            "params": {
                "collapsed_fieldsets": "",
                "groupby": ["source", "target",],
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
        command = ExportChartsCommand(chart_ids=[example_chart.id])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_chart_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportChartsCommand(chart_ids=[-1])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_chart_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_chart = db.session.query(Slice).all()[0]
        command = ExportChartsCommand(chart_ids=[example_chart.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(contents["charts/energy_sankey.yaml"])
        assert list(metadata.keys()) == [
            "slice_name",
            "viz_type",
            "params",
            "cache_timeout",
            "uuid",
            "version",
            "dataset_uuid",
        ]
