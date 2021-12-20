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

import pytest
import yaml

from superset import db, security_manager
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.models.core import Database
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.commands.exceptions import SavedQueryNotFoundError
from superset.queries.saved_queries.commands.export import ExportSavedQueriesCommand
from superset.queries.saved_queries.commands.importers.v1 import (
    ImportSavedQueriesCommand,
)
from superset.utils.core import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    database_config,
    database_metadata_config,
    saved_queries_config,
    saved_queries_metadata_config,
)


class TestExportSavedQueriesCommand(SupersetTestCase):
    def setUp(self):
        self.example_database = get_example_database()
        self.example_query = SavedQuery(
            database=self.example_database,
            created_by=self.get_user("admin"),
            sql="SELECT 42",
            label="The answer",
            schema="schema1",
            description="Answer to the Ultimate Question of Life, the Universe, and Everything",
        )
        db.session.add(self.example_query)
        db.session.commit()

    def tearDown(self):
        db.session.delete(self.example_query)
        db.session.commit()

    @patch("superset.queries.saved_queries.filters.g")
    def test_export_query_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        command = ExportSavedQueriesCommand([self.example_query.id])
        contents = dict(command.run())

        expected = [
            "metadata.yaml",
            "queries/examples/schema1/The_answer.yaml",
            "databases/examples.yaml",
        ]
        assert expected == list(contents.keys())

        metadata = yaml.safe_load(contents["queries/examples/schema1/The_answer.yaml"])
        assert metadata == {
            "schema": "schema1",
            "label": "The answer",
            "description": "Answer to the Ultimate Question of Life, the Universe, and Everything",
            "sql": "SELECT 42",
            "uuid": str(self.example_query.uuid),
            "version": "1.0.0",
            "database_uuid": str(self.example_database.uuid),
        }

    @patch("superset.queries.saved_queries.filters.g")
    def test_export_query_command_no_access(self, mock_g):
        """Test that users can't export datasets they don't have access to"""
        mock_g.user = security_manager.find_user("gamma")

        command = ExportSavedQueriesCommand([self.example_query.id])
        contents = command.run()
        with self.assertRaises(SavedQueryNotFoundError):
            next(contents)

    @patch("superset.queries.saved_queries.filters.g")
    def test_export_query_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")

        command = ExportSavedQueriesCommand([-1])
        contents = command.run()
        with self.assertRaises(SavedQueryNotFoundError):
            next(contents)

    @patch("superset.queries.saved_queries.filters.g")
    def test_export_query_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        command = ExportSavedQueriesCommand([self.example_query.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(contents["queries/examples/schema1/The_answer.yaml"])
        assert list(metadata.keys()) == [
            "schema",
            "label",
            "description",
            "sql",
            "uuid",
            "version",
            "database_uuid",
        ]


class TestImportSavedQueriesCommand(SupersetTestCase):
    def test_import_v1_saved_queries(self):
        """Test that we can import a saved query"""
        contents = {
            "metadata.yaml": yaml.safe_dump(saved_queries_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "queries/imported_query.yaml": yaml.safe_dump(saved_queries_config),
        }

        command = ImportSavedQueriesCommand(contents)
        command.run()

        saved_query = (
            db.session.query(SavedQuery)
            .filter_by(uuid=saved_queries_config["uuid"])
            .one()
        )

        assert saved_query.schema == "public"

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )

        db.session.delete(saved_query)
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_saved_queries_multiple(self):
        """Test that a saved query can be imported multiple times"""
        contents = {
            "metadata.yaml": yaml.safe_dump(saved_queries_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "queries/imported_query.yaml": yaml.safe_dump(saved_queries_config),
        }
        command = ImportSavedQueriesCommand(contents, overwrite=True)
        command.run()
        command.run()
        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        saved_query = db.session.query(SavedQuery).filter_by(db_id=database.id).all()
        assert len(saved_query) == 1

        db.session.delete(saved_query[0])
        db.session.delete(database)
        db.session.commit()

    def test_import_v1_saved_queries_validation(self):
        """Test different validations applied when importing a saved query"""
        # metadata.yaml must be present
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "queries/imported_query.yaml": yaml.safe_dump(saved_queries_config),
        }
        command = ImportSavedQueriesCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Missing metadata.yaml"

        # version should be 1.0.0
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "2.0.0",
                "type": "SavedQuery",
                "timestamp": "2021-03-30T20:37:54.791187+00:00",
            }
        )
        command = ImportSavedQueriesCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be a SavedQuery
        contents["metadata.yaml"] = yaml.safe_dump(database_metadata_config)
        command = ImportSavedQueriesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing saved_queries"
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to SavedQuery."]}
        }

        # must also validate databases
        broken_config = database_config.copy()
        del broken_config["database_name"]
        contents["metadata.yaml"] = yaml.safe_dump(saved_queries_metadata_config)
        contents["databases/imported_database.yaml"] = yaml.safe_dump(broken_config)
        command = ImportSavedQueriesCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Error importing saved_queries"
        assert excinfo.value.normalized_messages() == {
            "databases/imported_database.yaml": {
                "database_name": ["Missing data for required field."],
            }
        }
