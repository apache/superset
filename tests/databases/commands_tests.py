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
from zipfile import is_zipfile, ZipFile

import yaml

from superset import db, security_manager
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.commands.export import ExportDatabaseCommand
from superset.models.core import Database
from superset.utils.core import get_example_database
from tests.base_tests import SupersetTestCase


class TestExportDatabaseCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    def test_export_database_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        command = ExportDatabaseCommand(database_id=example_db.id, filename="test.zip")
        buf = command.run()

        self.assertTrue(is_zipfile(buf))

        self.maxDiff = None
        with ZipFile(buf) as bundle:
            self.assertEqual(
                bundle.namelist(),
                [
                    "test/databases/examples.yaml",
                    "test/datasets/energy_usage.yaml",
                    "test/datasets/wb_health_population.yaml",
                    "test/datasets/birth_names.yaml",
                    "test/datasets/csv_upload.yaml",
                    "test/datasets/excel_upload.yaml",
                    "test/datasets/unicode_test.yaml",
                    "test/datasets/test_table.yaml",
                ],
            )

            with bundle.open("test/databases/examples.yaml") as database:
                metadata = yaml.safe_load(database.read())
                self.assertEqual(
                    metadata,
                    {
                        "allow_csv_upload": True,
                        "allow_ctas": True,
                        "allow_cvas": True,
                        "allow_run_async": False,
                        "cache_timeout": None,
                        "database_name": "examples",
                        "expose_in_sqllab": True,
                        "extra": {
                            "engine_params": {},
                            "metadata_cache_timeout": {},
                            "metadata_params": {},
                            "schemas_allowed_for_csv_upload": [],
                        },
                        "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
                        "uuid": str(example_db.uuid),
                        "version": "1.0.0",
                    },
                )

            with bundle.open("test/datasets/birth_names.yaml") as dataset:
                metadata = yaml.safe_load(dataset.read())
                metadata.pop("uuid")
                self.assertEqual(
                    metadata,
                    {
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
                    },
                )

    @patch("superset.security.manager.g")
    def test_export_database_command_no_access(self, mock_g):
        """Test that users can't export databases they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        example_db = get_example_database()
        command = ExportDatabaseCommand(database_id=example_db.id, filename="test.zip")
        with self.assertRaises(DatabaseNotFoundError):
            buf = command.run()

    @patch("superset.security.manager.g")
    def test_export_database_command_invalid_database(self, mock_g):
        """Test that an error is raised when exporting an invalid database"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportDatabaseCommand(database_id=-1, filename="test.zip")
        with self.assertRaises(DatabaseNotFoundError):
            buf = command.run()

    @patch("superset.security.manager.g")
    def test_export_database_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        command = ExportDatabaseCommand(database_id=example_db.id, filename="test.zip")
        buf = command.run()

        self.maxDiff = None
        with ZipFile(buf) as bundle:
            with bundle.open("test/databases/examples.yaml") as database:
                self.assertEqual(
                    database.read().decode("utf-8").strip(),
                    f"""
database_name: examples
sqlalchemy_uri: {example_db.sqlalchemy_uri_decrypted}
cache_timeout: null
expose_in_sqllab: true
allow_run_async: false
allow_ctas: true
allow_cvas: true
allow_csv_upload: true
extra:
  metadata_params: {{}}
  engine_params: {{}}
  metadata_cache_timeout: {{}}
  schemas_allowed_for_csv_upload: []
uuid: {str(example_db.uuid)}
version: 1.0.0
""".strip(),
                )
