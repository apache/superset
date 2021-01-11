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
from unittest.mock import patch

import pytest
import yaml

from superset import db, security_manager
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.commands.export import ExportDatabasesCommand
from superset.databases.commands.importers.v1 import ImportDatabasesCommand
from superset.models.core import Database
from superset.utils.core import backend, get_example_database
from tests.base_tests import SupersetTestCase
from tests.fixtures.birth_names_dashboard import load_birth_names_dashboard_with_slices
from tests.fixtures.energy_dashboard import load_energy_table_with_slice
from tests.fixtures.importexport import (
    database_config,
    database_metadata_config,
    dataset_config,
    dataset_metadata_config,
)


class TestExportDatabasesCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
    )
    def test_export_database_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        db_uuid = example_db.uuid

        command = ExportDatabasesCommand([example_db.id])
        contents = dict(command.run())

        # TODO: this list shouldn't depend on the order in which unit tests are run
        # or on the backend; for now use a stable subset
        core_files = {
            "metadata.yaml",
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

        if example_db.backend == "postgresql":
            ds_type = "TIMESTAMP WITHOUT TIME ZONE"
        elif example_db.backend == "hive":
            ds_type = "TIMESTAMP"
        elif example_db.backend == "presto":
            ds_type = "VARCHAR(255)"
        else:
            ds_type = "DATETIME"
        if example_db.backend == "mysql":
            big_int_type = "BIGINT(20)"
        else:
            big_int_type = "BIGINT"
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

        metadata["columns"].sort(key=lambda x: x["column_name"])
        expected_metadata = {
            "cache_timeout": None,
            "columns": [
                {
                    "column_name": "ds",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": True,
                    "python_date_format": None,
                    "type": ds_type,
                    "verbose_name": None,
                },
                {
                    "column_name": "gender",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "STRING" if example_db.backend == "hive" else "VARCHAR(16)",
                    "verbose_name": None,
                },
                {
                    "column_name": "name",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "STRING"
                    if example_db.backend == "hive"
                    else "VARCHAR(255)",
                    "verbose_name": None,
                },
                {
                    "column_name": "num",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": big_int_type,
                    "verbose_name": None,
                },
                {
                    "column_name": "num_california",
                    "description": None,
                    "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": None,
                    "verbose_name": None,
                },
                {
                    "column_name": "state",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "STRING" if example_db.backend == "hive" else "VARCHAR(10)",
                    "verbose_name": None,
                },
                {
                    "column_name": "num_boys",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": big_int_type,
                    "verbose_name": None,
                },
                {
                    "column_name": "num_girls",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": big_int_type,
                    "verbose_name": None,
                },
            ],
            "database_uuid": str(db_uuid),
            "default_endpoint": None,
            "description": "",
            "extra": None,
            "fetch_values_predicate": None,
            "filter_select_enabled": True,
            "main_dttm_col": "ds",
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
                    "expression": "SUM(num)",
                    "extra": None,
                    "metric_name": "sum__num",
                    "metric_type": None,
                    "verbose_name": None,
                    "warning_text": None,
                },
            ],
            "offset": 0,
            "params": None,
            "schema": None,
            "sql": None,
            "table_name": "birth_names",
            "template_params": None,
            "version": "1.0.0",
        }
        expected_metadata["columns"].sort(key=lambda x: x["column_name"])
        assert metadata == expected_metadata

    @patch("superset.security.manager.g")
    def test_export_database_command_no_access(self, mock_g):
        """Test that users can't export databases they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        example_db = get_example_database()
        command = ExportDatabasesCommand([example_db.id])
        contents = command.run()
        with self.assertRaises(DatabaseNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_database_command_invalid_database(self, mock_g):
        """Test that an error is raised when exporting an invalid database"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportDatabasesCommand([-1])
        contents = command.run()
        with self.assertRaises(DatabaseNotFoundError):
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_database_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()
        command = ExportDatabasesCommand([example_db.id])
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


class TestImportDatabasesCommand(SupersetTestCase):
    def test_import_v1_database(self):
        """Test that a database can be imported"""
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_csv_upload
        assert database.allow_ctas
        assert database.allow_cvas
        assert not database.allow_run_async
        assert database.cache_timeout is None
        assert database.database_name == "imported_database"
        assert database.expose_in_sqllab
        assert database.extra == "{}"
        assert database.sqlalchemy_uri == "sqlite:///test.db"

        db.session.delete(database)
        db.session.commit()

    def test_import_v1_database_multiple(self):
        """Test that a database can be imported multiple times"""
        num_databases = db.session.query(Database).count()

        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents, overwrite=True)

        # import twice
        command.run()
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_csv_upload

        # update allow_csv_upload to False
        new_config = database_config.copy()
        new_config["allow_csv_upload"] = False
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(new_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents, overwrite=True)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert not database.allow_csv_upload

        # test that only one database was created
        new_num_databases = db.session.query(Database).count()
        assert new_num_databases == num_databases + 1

        db.session.delete(database)
        db.session.commit()

    def test_import_v1_database_with_dataset(self):
        """Test that a database can be imported with datasets"""
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert len(database.tables) == 1
        assert str(database.tables[0].uuid) == "10808100-158b-42c4-842e-f32b99d88dfb"

        db.session.delete(database.tables[0])
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_database_with_dataset_multiple(self):
        """Test that a database can be imported multiple times w/o changing datasets"""
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert dataset.offset == 66

        new_config = dataset_config.copy()
        new_config["offset"] = 67
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(new_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents, overwrite=True)
        command.run()

        # the underlying dataset should not be modified by the second import, since
        # we're importing a database, not a dataset
        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        assert dataset.offset == 66

        db.session.delete(dataset)
        db.session.delete(dataset.database)
        db.session.commit()

    def test_import_v1_database_validation(self):
        """Test different validations applied when importing a database"""
        # metadata.yaml must be present
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
        }
        command = ImportDatabasesCommand(contents)
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
        command = ImportDatabasesCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be Database
        contents["metadata.yaml"] = yaml.safe_dump(dataset_metadata_config)
        command = ImportDatabasesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing database"
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to Database."]}
        }

        # must also validate datasets
        broken_config = dataset_config.copy()
        del broken_config["table_name"]
        contents["metadata.yaml"] = yaml.safe_dump(database_metadata_config)
        contents["datasets/imported_dataset.yaml"] = yaml.safe_dump(broken_config)
        command = ImportDatabasesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing database"
        assert excinfo.value.normalized_messages() == {
            "datasets/imported_dataset.yaml": {
                "table_name": ["Missing data for required field."],
            }
        }

    def test_import_v1_database_masked_password(self):
        """Test that database imports with masked passwords are rejected"""
        masked_database_config = database_config.copy()
        masked_database_config[
            "sqlalchemy_uri"
        ] = "postgresql://username:XXXXXXXXXX@host:12345/db"
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(masked_database_config),
        }
        command = ImportDatabasesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing database"
        assert excinfo.value.normalized_messages() == {
            "databases/imported_database.yaml": {
                "_schema": ["Must provide a password for the database"]
            }
        }

    @patch("superset.databases.commands.importers.v1.import_dataset")
    def test_import_v1_rollback(self, mock_import_dataset):
        """Test than on an exception everything is rolled back"""
        num_databases = db.session.query(Database).count()

        # raise an exception when importing the dataset, after the database has
        # already been imported
        mock_import_dataset.side_effect = Exception("A wild exception appears!")

        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
        }
        command = ImportDatabasesCommand(contents)
        with pytest.raises(Exception) as excinfo:
            command.run()
        assert str(excinfo.value) == "Import database failed for an unknown reason"

        # verify that the database was not added
        new_num_databases = db.session.query(Database).count()
        assert new_num_databases == num_databases
