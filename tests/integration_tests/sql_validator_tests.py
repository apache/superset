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
# isort:skip_file
"""Unit tests for Sql Lab"""

import unittest
from unittest.mock import MagicMock, patch

from pyhive.exc import DatabaseError

from superset.sql_validators.postgres import PostgreSQLValidator
from superset.sql_validators.presto_db import (
    PrestoDBSQLValidator,
    PrestoSQLValidationError,
)
from superset.utils.database import get_example_database

from .base_tests import SupersetTestCase


class TestPrestoValidator(SupersetTestCase):
    """Testing for the prestodb sql validator"""

    def setUp(self):
        self.validator = PrestoDBSQLValidator
        self.database = MagicMock()
        self.database_engine = (
            self.database.get_sqla_engine.return_value.__enter__.return_value
        )
        self.database_conn = self.database_engine.raw_connection.return_value
        self.database_cursor = self.database_conn.cursor.return_value
        self.database_cursor.poll.return_value = None

    PRESTO_ERROR_TEMPLATE = {
        "errorLocation": {"lineNumber": 10, "columnNumber": 20},
        "message": "your query isn't how I like it",
    }

    @patch("superset.utils.core.g")
    def test_validator_success(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        errors = self.validator.validate(sql, None, schema, self.database)

        self.assertEqual([], errors)

    @patch("superset.utils.core.g")
    def test_validator_db_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = DatabaseError("dummy db error")

        with self.assertRaises(PrestoSQLValidationError):
            self.validator.validate(sql, None, schema, self.database)

    @patch("superset.utils.core.g")
    def test_validator_unexpected_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = Exception("a mysterious failure")

        with self.assertRaises(Exception):
            self.validator.validate(sql, None, schema, self.database)

    @patch("superset.utils.core.g")
    def test_validator_query_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = DatabaseError(self.PRESTO_ERROR_TEMPLATE)

        errors = self.validator.validate(sql, None, schema, self.database)

        self.assertEqual(1, len(errors))


class TestPostgreSQLValidator(SupersetTestCase):
    def test_valid_syntax(self):
        if get_example_database().backend != "postgresql":
            return

        mock_database = MagicMock()
        annotations = PostgreSQLValidator.validate(
            sql='SELECT 1, "col" FROM "table"',
            catalog=None,
            schema="",
            database=mock_database,
        )
        assert annotations == []

    def test_invalid_syntax(self):
        if get_example_database().backend != "postgresql":
            return

        mock_database = MagicMock()
        annotations = PostgreSQLValidator.validate(
            sql='SELECT 1, "col"\nFROOM "table"',
            catalog=None,
            schema="",
            database=mock_database,
        )

        assert len(annotations) == 1
        annotation = annotations[0]
        assert annotation.line_number == 2
        assert annotation.start_column is None
        assert annotation.end_column is None
        assert annotation.message == 'ERROR: syntax error at or near """'


if __name__ == "__main__":
    unittest.main()
