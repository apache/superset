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
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.commands.exceptions import SavedQueryNotFoundError
from superset.queries.saved_queries.commands.export import ExportSavedQueriesCommand
from superset.utils.core import get_example_database
from tests.base_tests import SupersetTestCase


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
