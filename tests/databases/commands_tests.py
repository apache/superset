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

from superset import security_manager
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.commands.export import ExportDatabasesCommand
from superset.utils.core import backend, get_example_database
from tests.base_tests import SupersetTestCase


class TestExportDatabasesCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    def test_export_database_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        command = ExportDatabasesCommand(database_ids=[example_db.id])
        contents = dict(command.run())

        # TODO: this list shouldn't depend on the order in which unit tests are run
        # or on the backend; for now use a stable subset
        core_files = {
            "databases/examples.yaml",
            "datasets/examples/energy_usage.yaml",
            "datasets/examples/wb_health_population.yaml",
            "datasets/examples/birth_names.yaml",
        }
        expected_extra = {
            "engine_params": {},
            "metadata_cache_timeout": {},
            "metadata_params": {},
            "schemas_allowed_for_csv_upload": [],
        }
        if backend() == "presto":
            expected_extra = {"engine_params": {"connect_args": {"poll_interval": 0.1}}}

        assert core_files.issubset(set(contents.keys()))

        metadata = yaml.safe_load(contents["databases/examples.yaml"])
        assert metadata == (
            {
                "allow_csv_upload": True,
                "allow_ctas": True,
                "allow_cvas": True,
                "allow_run_async": False,
                "cache_timeout": None,
                "database_name": "examples",
                "expose_in_sqllab": True,
                "extra": expected_extra,
                "sqlalchemy_uri": example_db.sqlalchemy_uri,
                "uuid": str(example_db.uuid),
                "version": "1.0.0",
            }
        )

        metadata = yaml.safe_load(contents["datasets/examples/birth_names.yaml"])
        metadata.pop("uuid")
        assert metadata == {
            "table_name": "birth_names",
            "main_dttm_col": None,
            "description": "Adding a DESCRip",
            "default_endpoint": "",
            "offset": 66,
            "cache_timeout": 55,
            "schema": "",
            "sql": "",
            "params": None,
            "template_params": None,
            "filter_select_enabled": True,
            "fetch_values_predicate": None,
            "metrics": [
                {
                    "metric_name": "ratio",
                    "verbose_name": "Ratio Boys/Girls",
                    "metric_type": None,
                    "expression": "sum(sum_boys) / sum(sum_girls)",
                    "description": "This represents the ratio of boys/girls",
                    "d3format": ".2%",
                    "extra": None,
                    "warning_text": "no warning",
                },
                {
                    "metric_name": "sum__num",
                    "verbose_name": "Babies",
                    "metric_type": None,
                    "expression": "SUM(num)",
                    "description": "",
                    "d3format": "",
                    "extra": None,
                    "warning_text": "",
                },
                {
                    "metric_name": "count",
                    "verbose_name": "",
                    "metric_type": None,
                    "expression": "count(1)",
                    "description": None,
                    "d3format": None,
                    "extra": None,
                    "warning_text": None,
                },
            ],
            "columns": [
                {
                    "column_name": "num_california",
                    "verbose_name": None,
                    "is_dttm": False,
                    "is_active": None,
                    "type": "NUMBER",
                    "groupby": False,
                    "filterable": False,
                    "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "ds",
                    "verbose_name": "",
                    "is_dttm": True,
                    "is_active": None,
                    "type": "DATETIME",
                    "groupby": True,
                    "filterable": True,
                    "expression": "",
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "sum_girls",
                    "verbose_name": None,
                    "is_dttm": False,
                    "is_active": None,
                    "type": "BIGINT(20)",
                    "groupby": False,
                    "filterable": False,
                    "expression": "",
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "gender",
                    "verbose_name": None,
                    "is_dttm": False,
                    "is_active": None,
                    "type": "VARCHAR(16)",
                    "groupby": True,
                    "filterable": True,
                    "expression": "",
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "state",
                    "verbose_name": None,
                    "is_dttm": None,
                    "is_active": None,
                    "type": "VARCHAR(10)",
                    "groupby": True,
                    "filterable": True,
                    "expression": None,
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "sum_boys",
                    "verbose_name": None,
                    "is_dttm": None,
                    "is_active": None,
                    "type": "BIGINT(20)",
                    "groupby": True,
                    "filterable": True,
                    "expression": None,
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "num",
                    "verbose_name": None,
                    "is_dttm": None,
                    "is_active": None,
                    "type": "BIGINT(20)",
                    "groupby": True,
                    "filterable": True,
                    "expression": None,
                    "description": None,
                    "python_date_format": None,
                },
                {
                    "column_name": "name",
                    "verbose_name": None,
                    "is_dttm": None,
                    "is_active": None,
                    "type": "VARCHAR(255)",
                    "groupby": True,
                    "filterable": True,
                    "expression": None,
                    "description": None,
                    "python_date_format": None,
                },
            ],
            "version": "1.0.0",
            "database_uuid": str(example_db.uuid),
        }

    @patch("superset.security.manager.g")
    def test_export_database_command_no_access(self, mock_g):
        """Test that users can't export databases they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        example_db = get_example_database()
        command = ExportDatabasesCommand(database_ids=[example_db.id])
        contents = command.run()
        with self.assertRaises(DatabaseNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_database_command_invalid_database(self, mock_g):
        """Test that an error is raised when exporting an invalid database"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportDatabasesCommand(database_ids=[-1])
        contents = command.run()
        with self.assertRaises(DatabaseNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_database_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        command = ExportDatabasesCommand(database_ids=[example_db.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(contents["databases/examples.yaml"])
        assert list(metadata.keys()) == [
            "database_name",
            "sqlalchemy_uri",
            "cache_timeout",
            "expose_in_sqllab",
            "allow_run_async",
            "allow_ctas",
            "allow_cvas",
            "allow_csv_upload",
            "extra",
            "uuid",
            "version",
        ]
