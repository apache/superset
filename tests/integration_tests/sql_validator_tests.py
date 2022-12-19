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

import pytest
from pyhive.exc import DatabaseError

from superset import app
from superset.sql_validators import SQLValidationAnnotation
from superset.sql_validators.base import BaseSQLValidator
from superset.sql_validators.postgres import PostgreSQLValidator
from superset.sql_validators.presto_db import (
    PrestoDBSQLValidator,
    PrestoSQLValidationError,
)
from superset.utils.database import get_example_database

from .base_tests import SupersetTestCase

PRESTO_SQL_VALIDATORS_BY_ENGINE = {
    "presto": "PrestoDBSQLValidator",
    "sqlite": "PrestoDBSQLValidator",
    "postgresql": "PrestoDBSQLValidator",
    "mysql": "PrestoDBSQLValidator",
}


class TestSqlValidatorEndpoint(SupersetTestCase):
    """Testing for Sql Lab querytext validation endpoint"""

    def tearDown(self):
        self.logout()

    @patch.dict(
        "superset.config.SQL_VALIDATORS_BY_ENGINE",
        {},
        clear=True,
    )
    def test_validate_sql_endpoint_noconfig(self):
        """Assert that validate_sql_json errors out when no validators are
        configured for any db"""
        self.login("admin")

        resp = self.validate_sql(
            "SELECT * FROM birth_names", client_id="1", raise_on_error=False
        )
        self.assertIn("error", resp)
        self.assertIn("no SQL validator is configured", resp["error"])

    @patch("superset.views.core.get_validator_by_name")
    @patch.dict(
        "superset.config.SQL_VALIDATORS_BY_ENGINE",
        PRESTO_SQL_VALIDATORS_BY_ENGINE,
        clear=True,
    )
    def test_validate_sql_endpoint_mocked(self, get_validator_by_name):
        """Assert that, with a mocked validator, annotations make it back out
        from the validate_sql_json endpoint as a list of json dictionaries"""
        if get_example_database().backend == "hive":
            pytest.skip("Hive validator is not implemented")
        self.login("admin")

        validator = MagicMock()
        get_validator_by_name.return_value = validator
        validator.validate.return_value = [
            SQLValidationAnnotation(
                message="I don't know what I expected, but it wasn't this",
                line_number=4,
                start_column=12,
                end_column=42,
            )
        ]

        resp = self.validate_sql(
            "SELECT * FROM somewhere_over_the_rainbow",
            client_id="1",
            raise_on_error=False,
        )

        self.assertEqual(1, len(resp))
        self.assertIn("expected,", resp[0]["message"])

    @patch("superset.views.core.get_validator_by_name")
    @patch.dict(
        "superset.config.SQL_VALIDATORS_BY_ENGINE",
        PRESTO_SQL_VALIDATORS_BY_ENGINE,
        clear=True,
    )
    def test_validate_sql_endpoint_mocked_params(self, get_validator_by_name):
        """Assert that, with a mocked validator, annotations make it back out
        from the validate_sql_json endpoint as a list of json dictionaries"""
        if get_example_database().backend == "hive":
            pytest.skip("Hive validator is not implemented")
        self.login("admin")

        validator = MagicMock()
        get_validator_by_name.return_value = validator
        validator.validate.return_value = [
            SQLValidationAnnotation(
                message="This worked",
                line_number=4,
                start_column=12,
                end_column=42,
            )
        ]

        resp = self.validate_sql(
            "SELECT * FROM somewhere_over_the_rainbow",
            client_id="1",
            raise_on_error=False,
            template_params="null",
        )

        self.assertEqual(1, len(resp))
        self.assertNotIn("error,", resp[0]["message"])

    @patch("superset.views.core.get_validator_by_name")
    @patch.dict(
        "superset.config.SQL_VALIDATORS_BY_ENGINE",
        PRESTO_SQL_VALIDATORS_BY_ENGINE,
        clear=True,
    )
    def test_validate_sql_endpoint_failure(self, get_validator_by_name):
        """Assert that validate_sql_json errors out when the selected validator
        raises an unexpected exception"""
        self.login("admin")

        validator = MagicMock()
        get_validator_by_name.return_value = validator
        validator.validate.side_effect = Exception("Kaboom!")

        resp = self.validate_sql(
            "SELECT * FROM birth_names", client_id="1", raise_on_error=False
        )
        # TODO(bkyryliuk): properly handle hive error
        if get_example_database().backend == "hive":
            assert resp["error"] == "no SQL validator is configured for hive"
        else:
            self.assertIn("error", resp)
            self.assertIn("Kaboom!", resp["error"])


class TestBaseValidator(SupersetTestCase):
    """Testing for the base sql validator"""

    def setUp(self):
        self.validator = BaseSQLValidator

    def test_validator_excepts(self):
        with self.assertRaises(NotImplementedError):
            self.validator.validate(None, None, None)


class TestPrestoValidator(SupersetTestCase):
    """Testing for the prestodb sql validator"""

    def setUp(self):
        self.validator = PrestoDBSQLValidator
        self.database = MagicMock()
        self.database_engine = (
            self.database.get_sqla_engine_with_context.return_value.__enter__.return_value
        )
        self.database_conn = self.database_engine.raw_connection.return_value
        self.database_cursor = self.database_conn.cursor.return_value
        self.database_cursor.poll.return_value = None

    def tearDown(self):
        self.logout()

    PRESTO_ERROR_TEMPLATE = {
        "errorLocation": {"lineNumber": 10, "columnNumber": 20},
        "message": "your query isn't how I like it",
    }

    @patch("superset.utils.core.g")
    def test_validator_success(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        errors = self.validator.validate(sql, schema, self.database)

        self.assertEqual([], errors)

    @patch("superset.utils.core.g")
    def test_validator_db_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = DatabaseError("dummy db error")

        with self.assertRaises(PrestoSQLValidationError):
            self.validator.validate(sql, schema, self.database)

    @patch("superset.utils.core.g")
    def test_validator_unexpected_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = Exception("a mysterious failure")

        with self.assertRaises(Exception):
            self.validator.validate(sql, schema, self.database)

    @patch("superset.utils.core.g")
    def test_validator_query_error(self, flask_g):
        flask_g.user.username = "nobody"
        sql = "SELECT 1 FROM default.notarealtable"
        schema = "default"

        fetch_fn = self.database.db_engine_spec.fetch_data
        fetch_fn.side_effect = DatabaseError(self.PRESTO_ERROR_TEMPLATE)

        errors = self.validator.validate(sql, schema, self.database)

        self.assertEqual(1, len(errors))

    @patch.dict(
        "superset.config.SQL_VALIDATORS_BY_ENGINE",
        {},
        clear=True,
    )
    def test_validate_sql_endpoint(self):
        self.login("admin")
        # NB this is effectively an integration test -- when there's a default
        #    validator for sqlite, this test will fail because the validator
        #    will no longer error out.
        resp = self.validate_sql(
            "SELECT * FROM birth_names", client_id="1", raise_on_error=False
        )
        self.assertIn("error", resp)
        self.assertIn("no SQL validator is configured", resp["error"])


class TestPostgreSQLValidator(SupersetTestCase):
    def test_valid_syntax(self):
        if get_example_database().backend != "postgresql":
            return

        mock_database = MagicMock()
        annotations = PostgreSQLValidator.validate(
            sql='SELECT 1, "col" FROM "table"', schema="", database=mock_database
        )
        assert annotations == []

    def test_invalid_syntax(self):
        if get_example_database().backend != "postgresql":
            return

        mock_database = MagicMock()
        annotations = PostgreSQLValidator.validate(
            sql='SELECT 1, "col"\nFROOM "table"', schema="", database=mock_database
        )

        assert len(annotations) == 1
        annotation = annotations[0]
        assert annotation.line_number == 2
        assert annotation.start_column is None
        assert annotation.end_column is None
        assert annotation.message == 'ERROR: syntax error at or near """'


if __name__ == "__main__":
    unittest.main()
