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

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.datasource.commands.create_table import CreateSqlaTableCommand
from superset.datasource.commands.exceptions import GetTableFromDatabaseFailedError
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase


class TestCreateSqlaTableCommand(SupersetTestCase):
    def test_database_not_found(self):
        self.login(username="admin")
        with self.assertRaises(DatabaseNotFoundError):
            CreateSqlaTableCommand("table", 9999).run()

    @patch("superset.security.manager.g")
    @patch("superset.models.core.Database.get_table")
    def test_get_table_from_database_error(self, get_table_mock, mock_g):
        mock_g.user = security_manager.find_user("admin")
        get_table_mock.side_effect = Exception
        with self.assertRaises(GetTableFromDatabaseFailedError):
            CreateSqlaTableCommand("table", get_example_database().id).run()

    @patch("superset.security.manager.g")
    @patch("superset.datasource.commands.create_table.g")
    def test_create_sqla_table_command(self, mock_g, mock_g2):
        mock_g.user = security_manager.find_user("admin")
        mock_g2.user = mock_g.user
        examples_db = get_example_database()
        with examples_db.get_sqla_engine_with_context() as engine:
            engine.execute("DROP TABLE IF EXISTS test_create_sqla_table_command")
            engine.execute(
                "CREATE TABLE test_create_sqla_table_command AS SELECT 2 as col"
            )

        table = CreateSqlaTableCommand(
            "test_create_sqla_table_command", examples_db.id
        ).run()
        fetched_table = (
            db.session.query(SqlaTable)
            .filter_by(table_name="test_create_sqla_table_command")
            .one()
        )
        self.assertEqual(table, fetched_table)
        self.assertEqual([owner.username for owner in table.owners], ["admin"])

        db.session.delete(table)
        with examples_db.get_sqla_engine_with_context() as engine:
            engine.execute("DROP TABLE test_create_sqla_table_command")
        db.session.commit()
