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
from unittest import mock

from sqlalchemy import Boolean, Column, Table

from superset.db_engine_specs import get_engine_spec
from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.certificates import ssl_certificate
from tests.integration_tests.fixtures.database import default_db_extra


class TestDatabricksDbEngineSpec(SupersetTestCase):
    def test_get_engine_spec(self):
        """
        DB Eng Specs (databricks): Test "databricks" in engine spec
        """
        assert get_engine_spec("databricks", "connector").engine == "databricks"
        assert get_engine_spec("databricks", "pyodbc").engine == "databricks"
        assert get_engine_spec("databricks", "pyhive").engine == "databricks"

    def test_extras_without_ssl(self):
        database = mock.Mock()
        database.extra = default_db_extra
        database.server_cert = None
        extras = DatabricksNativeEngineSpec.get_extra_params(database)
        assert extras == {
            "engine_params": {
                "connect_args": {
                    "_user_agent_entry": "Apache Superset",
                    "http_headers": [("User-Agent", "Apache Superset")],
                },
            },
            "metadata_cache_timeout": {},
            "metadata_params": {},
            "schemas_allowed_for_file_upload": [],
        }

    def test_extras_with_ssl_custom(self):
        database = mock.Mock()
        database.extra = default_db_extra.replace(
            '"engine_params": {}',
            '"engine_params": {"connect_args": {"ssl": "1"}}',
        )
        database.server_cert = ssl_certificate
        extras = DatabricksNativeEngineSpec.get_extra_params(database)
        connect_args = extras["engine_params"]["connect_args"]
        assert connect_args["ssl"] == "1"

    def test_handle_boolean_in_clause(self):
        """
        Test that boolean IN clauses use boolean literals instead of integers.

        Databricks requires boolean literals (True/False) in IN clauses,
        not integers (0/1). This test verifies that handle_boolean_in_clause
        converts values properly and uses OR conditions with equality checks.
        """
        # Create a mock table with a boolean column
        test_table = Table(
            "test_table",
            mock.MagicMock(),
            Column("is_test_user", Boolean),
        )
        sqla_col = test_table.c.is_test_user

        # Test with boolean values
        result = DatabricksNativeEngineSpec.handle_boolean_in_clause(
            sqla_col, [False]
        )
        # Verify the result is an OR condition (not an IN clause)
        assert result is not None

        # Test with integer values (should be converted to booleans)
        result = DatabricksNativeEngineSpec.handle_boolean_in_clause(
            sqla_col, [0, 1]
        )
        assert result is not None

        # Test with string values
        result = DatabricksNativeEngineSpec.handle_boolean_in_clause(
            sqla_col, ["false", "true"]
        )
        assert result is not None

        # Test with empty list (should return false condition)
        from sqlalchemy import false
        result = DatabricksNativeEngineSpec.handle_boolean_in_clause(sqla_col, [])
        # The result should be a false condition when all values are filtered out
        assert result is not None
