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
from typing import Any, List
from unittest.mock import patch

import pytest
import yaml
from sqlalchemy.exc import SQLAlchemyError

from superset import db, security_manager
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.databases.commands.importers.v1 import ImportDatabasesCommand
from superset.datasets.commands.create import CreateDatasetCommand
from superset.datasets.commands.exceptions import (
    DatasetInvalidError,
    DatasetNotFoundError,
)
from superset.datasets.commands.export import ExportDatasetsCommand
from superset.datasets.commands.importers import v0, v1
from superset.models.core import Database
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,
    load_energy_table_with_slice,
)
from tests.integration_tests.fixtures.importexport import (
    database_config,
    database_metadata_config,
    dataset_cli_export,
    dataset_config,
    dataset_metadata_config,
    dataset_ui_export,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)


class TestExportDatasetsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_dataset_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        example_dataset = _get_table_from_list_by_name(
            "energy_usage", example_db.tables
        )
        command = ExportDatasetsCommand([example_dataset.id])
        contents = dict(command.run())

        assert list(contents.keys()) == [
            "metadata.yaml",
            "datasets/examples/energy_usage.yaml",
            "databases/examples.yaml",
        ]

        metadata = yaml.safe_load(contents["datasets/examples/energy_usage.yaml"])

        # sort columns for deterministic comparison
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
                    "expression": "",
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["source"],
                    "advanced_data_type": None,
                    "verbose_name": None,
                    "extra": None,
                },
                {
                    "column_name": "target",
                    "description": None,
                    "expression": "",
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["target"],
                    "advanced_data_type": None,
                    "verbose_name": None,
                    "extra": None,
                },
                {
                    "column_name": "value",
                    "description": None,
                    "expression": "",
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": type_map["value"],
                    "advanced_data_type": None,
                    "verbose_name": None,
                    "extra": None,
                },
            ],
            "database_uuid": str(example_db.uuid),
            "default_endpoint": None,
            "description": "Energy consumption",
            "extra": None,
            "fetch_values_predicate": None,
            "filter_select_enabled": True,
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
            "schema": get_example_default_schema(),
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
        command = ExportDatasetsCommand([example_dataset.id])
        contents = command.run()
        with self.assertRaises(DatasetNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_dataset_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportDatasetsCommand([-1])
        contents = command.run()
        with self.assertRaises(DatasetNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_dataset_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        example_dataset = _get_table_from_list_by_name(
            "energy_usage", example_db.tables
        )
        command = ExportDatasetsCommand([example_dataset.id])
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
            "extra",
            "uuid",
            "metrics",
            "columns",
            "version",
            "database_uuid",
        ]

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_dataset_command_no_related(self, mock_g):
        """
        Test that only datasets are exported when export_related=False.
        """
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        example_dataset = _get_table_from_list_by_name(
            "energy_usage", example_db.tables
        )
        command = ExportDatasetsCommand([example_dataset.id], export_related=False)
        contents = dict(command.run())

        assert list(contents.keys()) == [
            "metadata.yaml",
            "datasets/examples/energy_usage.yaml",
        ]


class TestImportDatasetsCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_import_v0_dataset_cli_export(self):
        num_datasets = db.session.query(SqlaTable).count()

        contents = {
            "20201119_181105.yaml": yaml.safe_dump(dataset_cli_export),
        }
        command = v0.ImportDatasetsCommand(contents)
        command.run()

        new_num_datasets = db.session.query(SqlaTable).count()
        assert new_num_datasets == num_datasets + 1

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="birth_names_2").one()
        )
        assert (
            dataset.params
            == '{"remote_id": 3, "database_name": "examples", "import_time": 1604342885}'
        )
        assert len(dataset.metrics) == 2
        assert dataset.main_dttm_col == "ds"
        assert dataset.filter_select_enabled
        dataset.columns.sort(key=lambda obj: obj.column_name)
        expected_columns = [
            "num_california",
            "ds",
            "state",
            "gender",
            "name",
            "num_boys",
            "num_girls",
            "num",
        ]
        expected_columns.sort()
        assert [col.column_name for col in dataset.columns] == expected_columns

        db.session.delete(dataset)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_import_v0_dataset_ui_export(self):
        num_datasets = db.session.query(SqlaTable).count()

        contents = {
            "20201119_181105.yaml": yaml.safe_dump(dataset_ui_export),
        }
        command = v0.ImportDatasetsCommand(contents)
        command.run()

        new_num_datasets = db.session.query(SqlaTable).count()
        assert new_num_datasets == num_datasets + 1

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="birth_names_2").one()
        )
        assert (
            dataset.params
            == '{"remote_id": 3, "database_name": "examples", "import_time": 1604342885}'
        )
        assert len(dataset.metrics) == 2
        assert dataset.main_dttm_col == "ds"
        assert dataset.filter_select_enabled
        assert set(col.column_name for col in dataset.columns) == {
            "num_california",
            "ds",
            "state",
            "gender",
            "name",
            "num_boys",
            "num_girls",
            "num",
        }

        db.session.delete(dataset)
        db.session.commit()

    @patch("superset.datasets.commands.importers.v1.utils.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_import_v1_dataset(self, sm_g, utils_g):
        """Test that we can import a dataset"""
        admin = sm_g.user = utils_g.user = security_manager.find_user("admin")
        contents = {
            "metadata.yaml": yaml.safe_dump(dataset_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
        }
        command = v1.ImportDatasetsCommand(contents)
        command.run()

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert dataset.table_name == "imported_dataset"
        assert dataset.main_dttm_col is None
        assert dataset.description == "This is a dataset that was exported"
        assert dataset.default_endpoint == ""
        assert dataset.offset == 66
        assert dataset.cache_timeout == 55
        assert dataset.schema == ""
        assert dataset.sql == ""
        assert dataset.params is None
        assert dataset.template_params == "{}"
        assert dataset.filter_select_enabled
        assert dataset.fetch_values_predicate is None
        assert (
            dataset.extra
            == '{"certification": {"certified_by": "Data Platform Team", "details": "This table is the source of truth."}, "warning_markdown": "This is a warning."}'
        )

        # user should be included as one of the owners
        assert dataset.owners == [admin]

        # database is also imported
        assert str(dataset.database.uuid) == "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89"

        assert len(dataset.metrics) == 1
        metric = dataset.metrics[0]
        assert metric.metric_name == "count"
        assert metric.verbose_name == ""
        assert metric.metric_type is None
        assert metric.expression == "count(1)"
        assert metric.description is None
        assert metric.d3format is None
        assert metric.extra == "{}"
        assert metric.warning_text is None

        assert len(dataset.columns) == 1
        column = dataset.columns[0]
        assert column.column_name == "cnt"
        assert column.verbose_name == "Count of something"
        assert not column.is_dttm
        assert column.is_active  # imported columns are set to active
        assert column.type == "NUMBER"
        assert not column.groupby
        assert column.filterable
        assert column.expression == ""
        assert column.description is None
        assert column.python_date_format is None

        dataset.owners = []
        dataset.database.owners = []
        db.session.delete(dataset)
        db.session.delete(dataset.database)
        db.session.commit()

    @patch("superset.security.manager.g")
    def test_import_v1_dataset_multiple(self, mock_g):
        """Test that a dataset can be imported multiple times"""
        mock_g.user = security_manager.find_user("admin")

        contents = {
            "metadata.yaml": yaml.safe_dump(dataset_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
        }
        command = v1.ImportDatasetsCommand(contents, overwrite=True)
        command.run()
        command.run()
        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert dataset.table_name == "imported_dataset"

        # test that columns and metrics sync, ie, old ones not the import
        # are removed
        new_config = dataset_config.copy()
        new_config["metrics"][0]["metric_name"] = "count2"
        new_config["columns"][0]["column_name"] = "cnt2"
        contents = {
            "metadata.yaml": yaml.safe_dump(dataset_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(new_config),
        }
        command = v1.ImportDatasetsCommand(contents, overwrite=True)
        command.run()
        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert len(dataset.metrics) == 1
        assert dataset.metrics[0].metric_name == "count2"
        assert len(dataset.columns) == 1
        assert dataset.columns[0].column_name == "cnt2"

        db.session.delete(dataset)
        db.session.delete(dataset.database)
        db.session.commit()

    def test_import_v1_dataset_validation(self):
        """Test different validations applied when importing a dataset"""
        # metadata.yaml must be present
        contents = {
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
        }
        command = v1.ImportDatasetsCommand(contents)
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
        command = v1.ImportDatasetsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be SqlaTable
        contents["metadata.yaml"] = yaml.safe_dump(database_metadata_config)
        command = v1.ImportDatasetsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing dataset"
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to SqlaTable."]}
        }

        # must also validate databases
        broken_config = database_config.copy()
        del broken_config["database_name"]
        contents["metadata.yaml"] = yaml.safe_dump(dataset_metadata_config)
        contents["databases/imported_database.yaml"] = yaml.safe_dump(broken_config)
        command = v1.ImportDatasetsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing dataset"
        assert excinfo.value.normalized_messages() == {
            "databases/imported_database.yaml": {
                "database_name": ["Missing data for required field."],
            }
        }

    @patch("superset.security.manager.g")
    def test_import_v1_dataset_existing_database(self, mock_g):
        """Test that a dataset can be imported when the database already exists"""
        mock_g.user = security_manager.find_user("admin")

        # first import database...
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert len(database.tables) == 0

        # ...then dataset
        contents = {
            "metadata.yaml": yaml.safe_dump(dataset_metadata_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
        }
        command = v1.ImportDatasetsCommand(contents, overwrite=True)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert len(database.tables) == 1

        database.tables[0].owners = []
        database.owners = []
        db.session.delete(database.tables[0])
        db.session.delete(database)
        db.session.commit()


def _get_table_from_list_by_name(name: str, tables: List[Any]):
    for table in tables:
        if table.table_name == name:
            return table
    raise ValueError(f"Table {name} does not exists in database")


class TestCreateDatasetCommand(SupersetTestCase):
    def test_database_not_found(self):
        self.login(username="admin")
        with self.assertRaises(DatasetInvalidError):
            CreateDatasetCommand({"table_name": "table", "database": 9999}).run()

    @patch("superset.models.core.Database.get_table")
    def test_get_table_from_database_error(self, get_table_mock):
        self.login(username="admin")
        get_table_mock.side_effect = SQLAlchemyError
        with self.assertRaises(DatasetInvalidError):
            CreateDatasetCommand(
                {"table_name": "table", "database": get_example_database().id}
            ).run()

    @patch("superset.security.manager.g")
    @patch("superset.commands.utils.g")
    def test_create_dataset_command(self, mock_g, mock_g2):
        mock_g.user = security_manager.find_user("admin")
        mock_g2.user = mock_g.user
        examples_db = get_example_database()
        with examples_db.get_sqla_engine_with_context() as engine:
            engine.execute("DROP TABLE IF EXISTS test_create_dataset_command")
            engine.execute(
                "CREATE TABLE test_create_dataset_command AS SELECT 2 as col"
            )

        table = CreateDatasetCommand(
            {"table_name": "test_create_dataset_command", "database": examples_db.id}
        ).run()
        fetched_table = (
            db.session.query(SqlaTable)
            .filter_by(table_name="test_create_dataset_command")
            .one()
        )
        self.assertEqual(table, fetched_table)
        self.assertEqual([owner.username for owner in table.owners], ["admin"])

        db.session.delete(table)
        with examples_db.get_sqla_engine_with_context() as engine:
            engine.execute("DROP TABLE test_create_dataset_command")
        db.session.commit()
