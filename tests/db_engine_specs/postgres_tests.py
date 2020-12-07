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

from sqlalchemy import column, literal_column
from sqlalchemy.dialects import postgresql

from superset.db_engine_specs import engines
from superset.db_engine_specs.postgres import PostgresEngineSpec
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestPostgresDbEngineSpec(TestDbEngineSpec):
    def test_get_table_names(self):
        """
        DB Eng Specs (postgres): Test get table names
        """

        """ Make sure postgres doesn't try to remove schema name from table name
        ie. when try_remove_schema_from_table_name == False. """
        inspector = mock.Mock()
        inspector.get_table_names = mock.Mock(return_value=["schema.table", "table_2"])
        inspector.get_foreign_table_names = mock.Mock(return_value=["table_3"])

        pg_result_expected = ["schema.table", "table_2", "table_3"]
        pg_result = PostgresEngineSpec.get_table_names(
            database=mock.ANY, schema="schema", inspector=inspector
        )
        self.assertListEqual(pg_result_expected, pg_result)

    def test_time_exp_literal_no_grain(self):
        """
        DB Eng Specs (postgres): Test no grain literal column
        """
        col = literal_column("COALESCE(a, b)")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "COALESCE(a, b)")

    def test_time_exp_literal_1y_grain(self):
        """
        DB Eng Specs (postgres): Test grain literal column 1 YEAR
        """
        col = literal_column("COALESCE(a, b)")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', COALESCE(a, b))")

    def test_time_ex_lowr_col_no_grain(self):
        """
        DB Eng Specs (postgres): Test no grain expr lower case
        """
        col = column("lower_case")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "lower_case")

    def test_time_exp_lowr_col_sec_1y(self):
        """
        DB Eng Specs (postgres): Test grain expr lower case 1 YEAR
        """
        col = column("lower_case")
        expr = PostgresEngineSpec.get_timestamp_expr(col, "epoch_s", "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(
            result,
            "DATE_TRUNC('year', "
            "(timestamp 'epoch' + lower_case * interval '1 second'))",
        )

    def test_time_exp_mixd_case_col_1y(self):
        """
        DB Eng Specs (postgres): Test grain expr mixed case 1 YEAR
        """
        col = column("MixedCase")
        expr = PostgresEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', \"MixedCase\")")

    def test_convert_dttm(self):
        """
        DB Eng Specs (postgres): Test conversion to date time
        """
        dttm = self.get_dttm()

        self.assertEqual(
            PostgresEngineSpec.convert_dttm("DATE", dttm),
            "TO_DATE('2019-01-02', 'YYYY-MM-DD')",
        )

        self.assertEqual(
            PostgresEngineSpec.convert_dttm("TIMESTAMP", dttm),
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        )

        self.assertEqual(PostgresEngineSpec.convert_dttm("DATETIME", dttm), None)

    def test_empty_dbapi_cursor_description(self):
        """
        DB Eng Specs (postgres): Test empty cursor description (no columns)
        """
        cursor = mock.Mock()
        # empty description mean no columns, this mocks the following SQL: "SELECT"
        cursor.description = []
        results = PostgresEngineSpec.fetch_data(cursor, 1000)
        self.assertEqual(results, [])

    def test_engine_alias_name(self):
        """
        DB Eng Specs (postgres): Test "postgres" in engine spec
        """
        self.assertIn("postgres", engines)
