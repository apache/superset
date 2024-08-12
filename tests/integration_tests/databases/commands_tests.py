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
from unittest import skip
from unittest.mock import patch

import pytest
import yaml
from func_timeout import FunctionTimedOut
from sqlalchemy.exc import DBAPIError

from superset import db, event_logger, security_manager  # noqa: F401
from superset.commands.database.create import CreateDatabaseCommand
from superset.commands.database.exceptions import (
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseSecurityUnsafeError,
    DatabaseTablesUnexpectedError,
    DatabaseTestConnectionDriverError,  # noqa: F401
    DatabaseTestConnectionUnexpectedError,
)
from superset.commands.database.export import ExportDatabasesCommand
from superset.commands.database.importers.v1 import ImportDatabasesCommand
from superset.commands.database.tables import TablesDatabaseCommand
from superset.commands.database.test_connection import TestConnectionDatabaseCommand
from superset.commands.database.validate import ValidateDatabaseParametersCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.databases.schemas import DatabaseTestConnectionSchema  # noqa: F401
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorsException,
    SupersetException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.models.core import Database
from superset.utils.core import backend
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)
from tests.integration_tests.fixtures.importexport import (
    database_config,
    database_metadata_config,
    database_with_ssh_tunnel_config_mix_credentials,
    database_with_ssh_tunnel_config_no_credentials,
    database_with_ssh_tunnel_config_password,
    database_with_ssh_tunnel_config_private_key,
    database_with_ssh_tunnel_config_private_pass_only,
    dataset_config,
    dataset_metadata_config,
)


class TestCreateDatabaseCommand(SupersetTestCase):
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_create_duplicate_error(self, mock_g, mock_logger):
        example_db = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        command = CreateDatabaseCommand(
            {"database_name": example_db.database_name},
        )
        with pytest.raises(DatabaseInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == ("Database parameters are invalid.")
        # logger should list classnames of all errors
        mock_logger.assert_called_with(
            action="db_connection_failed."
            "DatabaseInvalidError."
            "DatabaseExistsValidationError."
            "DatabaseRequiredFieldValidationError"
        )

    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_multiple_error_logging(self, mock_g, mock_logger):
        mock_g.user = security_manager.find_user("admin")
        command = CreateDatabaseCommand({})
        with pytest.raises(DatabaseInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == ("Database parameters are invalid.")
        # logger should list a unique set of errors with no duplicates
        mock_logger.assert_called_with(
            action="db_connection_failed."
            "DatabaseInvalidError."
            "DatabaseRequiredFieldValidationError"
        )


class TestExportDatabasesCommand(SupersetTestCase):
    @skip("Flaky")
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
            "datasets/examples/birth_names.yaml",
        }
        expected_extra = {
            "engine_params": {},
            "metadata_cache_timeout": {},
            "metadata_params": {},
            "schemas_allowed_for_file_upload": [],
        }
        if backend() == "presto":
            expected_extra = {
                **expected_extra,
                "engine_params": {"connect_args": {"poll_interval": 0.1}},
            }
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
        metadata = yaml.safe_load(contents["databases/examples.yaml"]())
        assert metadata == (
            {
                "allow_csv_upload": True,
                "allow_ctas": True,
                "allow_cvas": True,
                "allow_dml": True,
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

        metadata = yaml.safe_load(contents["datasets/examples/birth_names.yaml"]())
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
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
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
                    "type": (
                        "STRING" if example_db.backend == "hive" else "VARCHAR(255)"
                    ),
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
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
                    "advanced_data_type": None,
                    "verbose_name": None,
                },
            ],
            "database_uuid": str(db_uuid),
            "default_endpoint": None,
            "description": "",
            "extra": None,
            "fetch_values_predicate": "123 = 123",
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

        metadata = yaml.safe_load(contents["databases/examples.yaml"]())
        assert list(metadata.keys()) == [
            "database_name",
            "sqlalchemy_uri",
            "cache_timeout",
            "expose_in_sqllab",
            "allow_run_async",
            "allow_ctas",
            "allow_cvas",
            "allow_dml",
            "allow_csv_upload",
            "extra",
            "uuid",
            "version",
        ]

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
    )
    def test_export_database_command_no_related(self, mock_g):
        """
        Test that only databases are exported when export_related=False.
        """
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()

        command = ExportDatabasesCommand([example_db.id], export_related=False)
        contents = dict(command.run())
        prefixes = {path.split("/")[0] for path in contents}
        assert "metadata.yaml" in prefixes
        assert "databases" in prefixes
        assert "datasets" not in prefixes


class TestImportDatabasesCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database(self, mock_add_permissions, mock_g):
        """Test that a database can be imported"""
        mock_g.user = security_manager.find_user("admin")

        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_file_upload
        assert database.allow_ctas
        assert database.allow_cvas
        assert database.allow_dml
        assert not database.allow_run_async
        assert database.cache_timeout is None
        assert database.database_name == "imported_database"
        assert database.expose_in_sqllab
        assert database.extra == "{}"
        assert database.sqlalchemy_uri == "postgresql://user:pass@host1"

        db.session.delete(database)
        db.session.commit()

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_broken_csv_fields(self, mock_add_permissions, mock_g):
        """
        Test that a database can be imported with broken schema.

        https://github.com/apache/superset/pull/16756 renamed some fields, changing
        the V1 schema. This test ensures that we can import databases that were
        exported with the broken schema.
        """
        mock_g.user = security_manager.find_user("admin")

        broken_config = database_config.copy()
        broken_config["allow_file_upload"] = broken_config.pop("allow_csv_upload")
        broken_config["extra"] = {"schemas_allowed_for_file_upload": ["upload"]}

        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(broken_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_file_upload
        assert database.allow_ctas
        assert database.allow_cvas
        assert database.allow_dml
        assert not database.allow_run_async
        assert database.cache_timeout is None
        assert database.database_name == "imported_database"
        assert database.expose_in_sqllab
        assert database.extra == '{"schemas_allowed_for_file_upload": ["upload"]}'
        assert database.sqlalchemy_uri == "postgresql://user:pass@host1"

        db.session.delete(database)
        db.session.commit()

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_multiple(self, mock_add_permissions, mock_g):
        """Test that a database can be imported multiple times"""
        mock_g.user = security_manager.find_user("admin")

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
        assert database.allow_file_upload

        # update allow_file_upload to False
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
        assert not database.allow_file_upload

        # test that only one database was created
        new_num_databases = db.session.query(Database).count()
        assert new_num_databases == num_databases + 1

        db.session.delete(database)
        db.session.commit()

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_with_dataset(self, mock_add_permissions, mock_g):
        """Test that a database can be imported with datasets"""
        mock_g.user = security_manager.find_user("admin")

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

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_with_dataset_multiple(
        self, mock_add_permissions, mock_g
    ):
        """Test that a database can be imported multiple times w/o changing datasets"""
        mock_g.user = security_manager.find_user("admin")

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

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_validation(self, mock_add_permissions):
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

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_password(self, mock_add_permissions):
        """Test that database imports with masked passwords are rejected"""
        masked_database_config = database_config.copy()
        masked_database_config["sqlalchemy_uri"] = (
            "postgresql://username:XXXXXXXXXX@host:12345/db"
        )
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

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_ssh_tunnel_password(
        self,
        mock_add_permissions,
        mock_schema_is_feature_enabled,
    ):
        """Test that database imports with masked ssh_tunnel passwords are rejected"""
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_password.copy()
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
                "_schema": ["Must provide a password for the ssh tunnel"]
            }
        }

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_ssh_tunnel_private_key_and_password(
        self,
        mock_add_permissions,
        mock_schema_is_feature_enabled,
    ):
        """Test that database imports with masked ssh_tunnel private_key and private_key_password are rejected"""
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_private_key.copy()
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
                "_schema": [
                    "Must provide a private key for the ssh tunnel",
                    "Must provide a private key password for the ssh tunnel",
                ]
            }
        }

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_with_ssh_tunnel_password(
        self,
        mock_add_permissions,
        mock_g,
        mock_schema_is_feature_enabled,
    ):
        """Test that a database with ssh_tunnel password can be imported"""
        mock_g.user = security_manager.find_user("admin")
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_password.copy()
        masked_database_config["ssh_tunnel"]["password"] = "TEST"
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(masked_database_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_file_upload
        assert database.allow_ctas
        assert database.allow_cvas
        assert database.allow_dml
        assert not database.allow_run_async
        assert database.cache_timeout is None
        assert database.database_name == "imported_database"
        assert database.expose_in_sqllab
        assert database.extra == "{}"
        assert database.sqlalchemy_uri == "postgresql://user:pass@host1"

        model_ssh_tunnel = (
            db.session.query(SSHTunnel)
            .filter(SSHTunnel.database_id == database.id)
            .one()
        )
        self.assertEqual(model_ssh_tunnel.password, "TEST")

        db.session.delete(database)
        db.session.commit()

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_with_ssh_tunnel_private_key_and_password(
        self,
        mock_add_permissions,
        mock_g,
        mock_schema_is_feature_enabled,
    ):
        """Test that a database with ssh_tunnel private_key and private_key_password can be imported"""
        mock_g.user = security_manager.find_user("admin")

        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_private_key.copy()
        masked_database_config["ssh_tunnel"]["private_key"] = "TestPrivateKey"
        masked_database_config["ssh_tunnel"]["private_key_password"] = "TEST"
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(masked_database_config),
        }
        command = ImportDatabasesCommand(contents)
        command.run()

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.allow_file_upload
        assert database.allow_ctas
        assert database.allow_cvas
        assert database.allow_dml
        assert not database.allow_run_async
        assert database.cache_timeout is None
        assert database.database_name == "imported_database"
        assert database.expose_in_sqllab
        assert database.extra == "{}"
        assert database.sqlalchemy_uri == "postgresql://user:pass@host1"

        model_ssh_tunnel = (
            db.session.query(SSHTunnel)
            .filter(SSHTunnel.database_id == database.id)
            .one()
        )
        self.assertEqual(model_ssh_tunnel.private_key, "TestPrivateKey")
        self.assertEqual(model_ssh_tunnel.private_key_password, "TEST")

        db.session.delete(database)
        db.session.commit()

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_ssh_tunnel_no_credentials(
        self,
        mock_add_permissions,
        mock_schema_is_feature_enabled,
    ):
        """Test that databases with ssh_tunnels that have no credentials are rejected"""
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_no_credentials.copy()
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(masked_database_config),
        }
        command = ImportDatabasesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must provide credentials for the SSH Tunnel"

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_ssh_tunnel_multiple_credentials(
        self,
        mock_add_permissions,
        mock_schema_is_feature_enabled,
    ):
        """Test that databases with ssh_tunnels that have multiple credentials are rejected"""
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = database_with_ssh_tunnel_config_mix_credentials.copy()
        contents = {
            "metadata.yaml": yaml.safe_dump(database_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(masked_database_config),
        }
        command = ImportDatabasesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert (
            str(excinfo.value) == "Cannot have multiple credentials for the SSH Tunnel"
        )

    @patch("superset.databases.schemas.is_feature_enabled")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_database_masked_ssh_tunnel_only_priv_key_psswd(
        self,
        mock_add_permissions,
        mock_schema_is_feature_enabled,
    ):
        """Test that databases with ssh_tunnels that have multiple credentials are rejected"""
        mock_schema_is_feature_enabled.return_value = True
        masked_database_config = (
            database_with_ssh_tunnel_config_private_pass_only.copy()
        )
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
                "_schema": [
                    "Must provide a private key for the ssh tunnel",
                    "Must provide a private key password for the ssh tunnel",
                ]
            }
        }

    @patch("superset.commands.database.importers.v1.import_dataset")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_rollback(self, mock_add_permissions, mock_import_dataset):
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


class TestTestConnectionDatabaseCommand(SupersetTestCase):
    @patch("superset.daos.database.Database._get_sqla_engine")
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_connection_db_exception(
        self, mock_g, mock_event_logger, mock_get_sqla_engine
    ):
        """Test to make sure event_logger is called when an exception is raised"""
        database = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        mock_get_sqla_engine.side_effect = Exception("An error has occurred!")
        db_uri = database.sqlalchemy_uri_decrypted
        json_payload = {"sqlalchemy_uri": db_uri}
        command_without_db_name = TestConnectionDatabaseCommand(json_payload)

        with pytest.raises(DatabaseTestConnectionUnexpectedError) as excinfo:
            command_without_db_name.run()
            assert str(excinfo.value) == (
                "Unexpected error occurred, please check your logs for details"
            )
        mock_event_logger.assert_called()

    @patch("superset.daos.database.Database._get_sqla_engine")
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_connection_do_ping_exception(
        self, mock_g, mock_event_logger, mock_get_sqla_engine
    ):
        """Test to make sure do_ping exceptions gets captured"""
        database = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        mock_get_sqla_engine.return_value.dialect.do_ping.side_effect = Exception(
            "An error has occurred!"
        )
        db_uri = database.sqlalchemy_uri_decrypted
        json_payload = {"sqlalchemy_uri": db_uri}
        command_without_db_name = TestConnectionDatabaseCommand(json_payload)

        with pytest.raises(SupersetErrorsException) as excinfo:
            command_without_db_name.run()
        assert (
            excinfo.value.errors[0].error_type
            == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
        )

    @patch("superset.commands.database.test_connection.func_timeout")
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_connection_do_ping_timeout(
        self, mock_g, mock_event_logger, mock_func_timeout
    ):
        """Test to make sure do_ping exceptions gets captured"""
        database = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        mock_func_timeout.side_effect = FunctionTimedOut("Time out")
        db_uri = database.sqlalchemy_uri_decrypted
        json_payload = {"sqlalchemy_uri": db_uri}
        command_without_db_name = TestConnectionDatabaseCommand(json_payload)

        with pytest.raises(SupersetTimeoutException) as excinfo:
            command_without_db_name.run()
        assert excinfo.value.status == 408
        assert (
            excinfo.value.error.error_type
            == SupersetErrorType.CONNECTION_DATABASE_TIMEOUT
        )

    @patch("superset.daos.database.Database._get_sqla_engine")
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_connection_superset_security_connection(
        self, mock_g, mock_event_logger, mock_get_sqla_engine
    ):
        """Test to make sure event_logger is called when security
        connection exc is raised"""
        database = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        mock_get_sqla_engine.side_effect = SupersetSecurityException(
            SupersetError(error_type=500, message="test", level="info")
        )
        db_uri = database.sqlalchemy_uri_decrypted
        json_payload = {"sqlalchemy_uri": db_uri}
        command_without_db_name = TestConnectionDatabaseCommand(json_payload)

        with pytest.raises(DatabaseSecurityUnsafeError) as excinfo:
            command_without_db_name.run()
            assert str(excinfo.value) == ("Stopped an unsafe database connection")

        mock_event_logger.assert_called()

    @patch("superset.daos.database.Database._get_sqla_engine")
    @patch("superset.commands.database.test_connection.event_logger.log_with_context")
    @patch("superset.utils.core.g")
    def test_connection_db_api_exc(
        self, mock_g, mock_event_logger, mock_get_sqla_engine
    ):
        """Test to make sure event_logger is called when DBAPIError is raised"""
        database = get_example_database()
        mock_g.user = security_manager.find_user("admin")
        mock_get_sqla_engine.side_effect = DBAPIError(
            statement="error", params={}, orig={}
        )
        db_uri = database.sqlalchemy_uri_decrypted
        json_payload = {"sqlalchemy_uri": db_uri}
        command_without_db_name = TestConnectionDatabaseCommand(json_payload)

        with pytest.raises(SupersetErrorsException) as excinfo:
            command_without_db_name.run()
            assert str(excinfo.value) == (
                "Connection failed, please check your connection settings"
            )

        mock_event_logger.assert_called()


@patch("superset.db_engine_specs.base.is_hostname_valid")
@patch("superset.db_engine_specs.base.is_port_open")
@patch("superset.commands.database.validate.DatabaseDAO")
def test_validate(DatabaseDAO, is_port_open, is_hostname_valid, app_context):
    """
    Test parameter validation.
    """
    is_hostname_valid.return_value = True
    is_port_open.return_value = True

    payload = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "superset",
            "password": "superset",
            "database": "test",
            "query": {},
        },
    }
    command = ValidateDatabaseParametersCommand(payload)
    command.run()


@patch("superset.db_engine_specs.base.is_hostname_valid")
@patch("superset.db_engine_specs.base.is_port_open")
def test_validate_partial(is_port_open, is_hostname_valid, app_context):
    """
    Test parameter validation when only some parameters are present.
    """
    is_hostname_valid.return_value = True
    is_port_open.return_value = True

    payload = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "",
            "password": "superset",
            "database": "test",
            "query": {},
        },
    }
    command = ValidateDatabaseParametersCommand(payload)
    with pytest.raises(SupersetErrorsException) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            message="One or more parameters are missing: username",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "missing": ["username"],
                "issue_codes": [
                    {
                        "code": 1018,
                        "message": "Issue 1018 - One or more parameters needed to configure a database are missing.",
                    }
                ],
            },
        )
    ]


@patch("superset.db_engine_specs.base.is_hostname_valid")
def test_validate_partial_invalid_hostname(is_hostname_valid, app_context):
    """
    Test parameter validation when only some parameters are present.
    """
    is_hostname_valid.return_value = False

    payload = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": None,
            "username": "",
            "password": "",
            "database": "",
            "query": {},
        },
    }
    command = ValidateDatabaseParametersCommand(payload)
    with pytest.raises(SupersetErrorsException) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            message="One or more parameters are missing: database, port, username",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "missing": ["database", "port", "username"],
                "issue_codes": [
                    {
                        "code": 1018,
                        "message": "Issue 1018 - One or more parameters needed to configure a database are missing.",
                    }
                ],
            },
        ),
        SupersetError(
            message="The hostname provided can't be resolved.",
            error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "invalid": ["host"],
                "issue_codes": [
                    {
                        "code": 1007,
                        "message": "Issue 1007 - The hostname provided can't be resolved.",
                    }
                ],
            },
        ),
    ]


class TestTablesDatabaseCommand(SupersetTestCase):
    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    def test_database_tables_list_with_unknown_database(self, mock_find_by_id):
        mock_find_by_id.return_value = None
        command = TablesDatabaseCommand(1, None, "test", False)

        with pytest.raises(DatabaseNotFoundError) as excinfo:
            command.run()
            assert str(excinfo.value) == ("Database not found.")

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @patch("superset.security.manager.SupersetSecurityManager.can_access_database")
    @patch("superset.utils.core.g")
    def test_database_tables_superset_exception(
        self, mock_g, mock_can_access_database, mock_find_by_id
    ):
        database = get_example_database()
        if database.backend == "mysql":
            return

        mock_find_by_id.return_value = database
        mock_can_access_database.side_effect = SupersetException("Test Error")
        mock_g.user = security_manager.find_user("admin")

        command = TablesDatabaseCommand(database.id, None, "main", False)
        with pytest.raises(SupersetException) as excinfo:
            command.run()
            assert str(excinfo.value) == "Test Error"

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @patch("superset.security.manager.SupersetSecurityManager.can_access_database")
    @patch("superset.utils.core.g")
    def test_database_tables_exception(
        self, mock_g, mock_can_access_database, mock_find_by_id
    ):
        database = get_example_database()
        mock_find_by_id.return_value = database
        mock_can_access_database.side_effect = Exception("Test Error")
        mock_g.user = security_manager.find_user("admin")

        command = TablesDatabaseCommand(database.id, None, "main", False)
        with pytest.raises(DatabaseTablesUnexpectedError) as excinfo:
            command.run()
            assert (
                str(excinfo.value)
                == "Unexpected error occurred, please check your logs for details"
            )

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @patch("superset.security.manager.SupersetSecurityManager.can_access_database")
    @patch("superset.utils.core.g")
    def test_database_tables_list_tables(
        self, mock_g, mock_can_access_database, mock_find_by_id
    ):
        database = get_example_database()
        mock_find_by_id.return_value = database
        mock_can_access_database.return_value = True
        mock_g.user = security_manager.find_user("admin")

        schema_name = self.default_schema_backend_map[database.backend]
        if database.backend == "postgresql" or database.backend == "mysql":
            return

        command = TablesDatabaseCommand(database.id, None, schema_name, False)
        result = command.run()

        assert result["count"] > 0
        assert len(result["result"]) > 0
        assert len(result["result"]) == result["count"]
