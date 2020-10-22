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

from operator import itemgetter
from unittest.mock import patch

import yaml

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.datasets.commands.export import ExportDatasetsCommand
from superset.utils.core import backend, get_example_database
from tests.base_tests import SupersetTestCase


class TestExportDatasetsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    def test_export_dataset_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        example_dataset = example_db.tables[0]
        command = ExportDatasetsCommand(dataset_ids=[example_dataset.id])
        contents = dict(command.run())

        assert list(contents.keys()) == [
            "datasets/examples/energy_usage.yaml",
            "databases/examples.yaml",
        ]

        metadata = yaml.safe_load(contents["datasets/examples/energy_usage.yaml"])

        # sort columns for deterministc comparison
        metadata["columns"] = sorted(metadata["columns"], key=itemgetter("column_name"))
        metadata["metrics"] = sorted(metadata["metrics"], key=itemgetter("metric_name"))

        # types are different depending on the backend
        type_map = {
            column.column_name: str(column.type) for column in example_dataset.columns
        }

        assert metadata == {
            "cache_timeout": None,
            "columns": [
                {
                    "column_name": "source",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["source"],
                    "verbose_name": None,
                },
                {
                    "column_name": "target",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["target"],
                    "verbose_name": None,
                },
                {
                    "column_name": "value",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["value"],
                    "verbose_name": None,
                },
            ],
            "database_uuid": str(example_db.uuid),
            "default_endpoint": None,
            "description": "Energy consumption",
            "fetch_values_predicate": None,
            "filter_select_enabled": False,
            "main_dttm_col": None,
            "metrics": [
                {
                    "d3format": None,
                    "description": None,
                    "expression": "COUNT(*)",
                    "extra": None,
                    "metric_name": "count",
                    "metric_type": "count",
                    "verbose_name": "COUNT(*)",
                    "warning_text": None,
                },
                {
                    "d3format": None,
                    "description": None,
                    "expression": "SUM(value)",
                    "extra": None,
                    "metric_name": "sum__value",
                    "metric_type": None,
                    "verbose_name": None,
                    "warning_text": None,
                },
            ],
            "offset": 0,
            "params": None,
            "schema": None,
            "sql": None,
            "table_name": "energy_usage",
            "template_params": None,
            "uuid": str(example_dataset.uuid),
            "version": "1.0.0",
        }

    @patch("superset.security.manager.g")
    def test_export_dataset_command_no_access(self, mock_g):
        """Test that users can't export datasets they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        example_db = get_example_database()
        example_dataset = example_db.tables[0]
        command = ExportDatasetsCommand(dataset_ids=[example_dataset.id])
        contents = command.run()
        with self.assertRaises(DatasetNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_dataset_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportDatasetsCommand(dataset_ids=[-1])
        contents = command.run()
        with self.assertRaises(DatasetNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_dataset_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        example_dataset = example_db.tables[0]
        command = ExportDatasetsCommand(dataset_ids=[example_dataset.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(contents["datasets/examples/energy_usage.yaml"])
        assert list(metadata.keys()) == [
            "table_name",
            "main_dttm_col",
            "description",
            "default_endpoint",
            "offset",
            "cache_timeout",
            "schema",
            "sql",
            "params",
            "template_params",
            "filter_select_enabled",
            "fetch_values_predicate",
            "uuid",
            "metrics",
            "columns",
            "version",
            "database_uuid",
        ]
