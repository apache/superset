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
from textwrap import dedent
from unittest import mock

from sqlalchemy import column, literal_column
from sqlalchemy.dialects import postgresql

from superset.db_engine_specs import engines
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.db_engine_specs.base_tests import TestDbEngineSpec
from tests.fixtures.certificates import ssl_certificate
from tests.fixtures.database import default_db_extra


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

        self.assertEqual(
            PostgresEngineSpec.convert_dttm("DATETIME", dttm),
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        )

        self.assertEqual(PostgresEngineSpec.convert_dttm("TIME", dttm), None)

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

    def test_extras_without_ssl(self):
        db = mock.Mock()
        db.extra = default_db_extra
        db.server_cert = None
        extras = PostgresEngineSpec.get_extra_params(db)
        assert "connect_args" not in extras["engine_params"]

    def test_extras_with_ssl_default(self):
        db = mock.Mock()
        db.extra = default_db_extra
        db.server_cert = ssl_certificate
        extras = PostgresEngineSpec.get_extra_params(db)
        connect_args = extras["engine_params"]["connect_args"]
        assert connect_args["sslmode"] == "verify-full"
        assert "sslrootcert" in connect_args

    def test_extras_with_ssl_custom(self):
        db = mock.Mock()
        db.extra = default_db_extra.replace(
            '"engine_params": {}',
            '"engine_params": {"connect_args": {"sslmode": "verify-ca"}}',
        )
        db.server_cert = ssl_certificate
        extras = PostgresEngineSpec.get_extra_params(db)
        connect_args = extras["engine_params"]["connect_args"]
        assert connect_args["sslmode"] == "verify-ca"
        assert "sslrootcert" in connect_args

    def test_estimate_statement_cost_select_star(self):
        """
        DB Eng Specs (postgres): Test estimate_statement_cost select star
        """

        cursor = mock.Mock()
        cursor.fetchone.return_value = (
            "Seq Scan on birth_names  (cost=0.00..1537.91 rows=75691 width=46)",
        )
        sql = "SELECT * FROM birth_names"
        results = PostgresEngineSpec.estimate_statement_cost(sql, cursor)
        self.assertEqual(
            results, {"Start-up cost": 0.00, "Total cost": 1537.91,},
        )

    def test_estimate_statement_invalid_syntax(self):
        """
        DB Eng Specs (postgres): Test estimate_statement_cost invalid syntax
        """
        from psycopg2 import errors

        cursor = mock.Mock()
        cursor.execute.side_effect = errors.SyntaxError(
            """
            syntax error at or near "EXPLAIN"
            LINE 1: EXPLAIN DROP TABLE birth_names
                            ^
            """
        )
        sql = "DROP TABLE birth_names"
        with self.assertRaises(errors.SyntaxError):
            PostgresEngineSpec.estimate_statement_cost(sql, cursor)

    def test_query_cost_formatter_example_costs(self):
        """
        DB Eng Specs (postgres): Test test_query_cost_formatter example costs
        """
        raw_cost = [
            {"Start-up cost": 0.00, "Total cost": 1537.91,},
            {"Start-up cost": 10.00, "Total cost": 1537.00,},
        ]
        result = PostgresEngineSpec.query_cost_formatter(raw_cost)
        self.assertEqual(
            result,
            [
                {"Start-up cost": "0.0", "Total cost": "1537.91",},
                {"Start-up cost": "10.0", "Total cost": "1537.0",},
            ],
        )

    def test_extract_errors(self):
        """
        Test that custom error messages are extracted correctly.
        """
        msg = 'psql: error: FATAL:  role "testuser" does not exist'
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_INVALID_USERNAME_ERROR,
                message='The username "testuser" does not exist.',
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 1012,
                            "message": (
                                "Issue 1012 - The username provided when "
                                "connecting to a database is not valid."
                            ),
                        },
                    ],
                },
            )
        ]

        msg = (
            'psql: error: could not translate host name "locahost" to address: '
            "nodename nor servname provided, or not known"
        )
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_INVALID_HOSTNAME_ERROR,
                message='The hostname "locahost" cannot be resolved.',
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 1007,
                            "message": "Issue 1007 - The hostname provided "
                            "can't be resolved.",
                        }
                    ],
                },
            )
        ]

        msg = dedent(
            """
psql: error: could not connect to server: Connection refused
        Is the server running on host "localhost" (::1) and accepting
        TCP/IP connections on port 12345?
could not connect to server: Connection refused
        Is the server running on host "localhost" (127.0.0.1) and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_PORT_CLOSED_ERROR,
                message='Port 12345 on hostname "localhost" refused the connection.',
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {"code": 1008, "message": "Issue 1008 - The port is closed."}
                    ],
                },
            )
        ]

        msg = dedent(
            """
psql: error: could not connect to server: Operation timed out
        Is the server running on host "example.com" (93.184.216.34) and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "example.com" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, "
                            "and can't be reached on the provided port.",
                        }
                    ],
                },
            )
        ]

        # response with IP only
        msg = dedent(
            """
psql: error: could not connect to server: Operation timed out
        Is the server running on host "93.184.216.34" and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "93.184.216.34" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, "
                            "and can't be reached on the provided port.",
                        }
                    ],
                },
            )
        ]

        msg = 'FATAL:  password authentication failed for user "postgres"'
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_INVALID_PASSWORD_ERROR,
                message=('The password provided for username "postgres" is incorrect.'),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 1013,
                            "message": (
                                "Issue 1013 - The password provided when "
                                "connecting to a database is not valid."
                            ),
                        },
                    ],
                },
            )
        ]

        msg = 'database "badDB" does not exist'
        result = PostgresEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.TEST_CONNECTION_UNKNOWN_DATABASE_ERROR,
                message='We were unable to connect to your database named "badDB".'
                " Please verify your database name and try again.",
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "PostgreSQL",
                    "issue_codes": [
                        {
                            "code": 10015,
                            "message": "Issue 1015 - Either the database is "
                            "spelled incorrectly or does not exist.",
                        }
                    ],
                },
            )
        ]
