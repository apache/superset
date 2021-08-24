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
import unittest.mock as mock
from textwrap import dedent

from sqlalchemy import column, table
from sqlalchemy.dialects import mssql
from sqlalchemy.dialects.mssql import DATE, NTEXT, NVARCHAR, TEXT, VARCHAR
from sqlalchemy.sql import select
from sqlalchemy.types import String, UnicodeText

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.core import GenericDataType
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestMssqlEngineSpec(TestDbEngineSpec):
    def test_mssql_column_types(self):
        def assert_type(type_string, type_expected, generic_type_expected):
            if type_expected is None:
                type_assigned = MssqlEngineSpec.get_sqla_column_type(type_string)
                self.assertIsNone(type_assigned)
            else:
                column_spec = MssqlEngineSpec.get_column_spec(type_string)
                if column_spec != None:
                    self.assertIsInstance(column_spec.sqla_type, type_expected)
                    self.assertEquals(column_spec.generic_type, generic_type_expected)

        assert_type("STRING", String, GenericDataType.STRING)
        assert_type("CHAR(10)", String, GenericDataType.STRING)
        assert_type("VARCHAR(10)", String, GenericDataType.STRING)
        assert_type("TEXT", String, GenericDataType.STRING)
        assert_type("NCHAR(10)", UnicodeText, GenericDataType.STRING)
        assert_type("NVARCHAR(10)", UnicodeText, GenericDataType.STRING)
        assert_type("NTEXT", UnicodeText, GenericDataType.STRING)

    def test_where_clause_n_prefix(self):
        dialect = mssql.dialect()
        spec = MssqlEngineSpec
        type_, _ = spec.get_sqla_column_type("VARCHAR(10)")
        str_col = column("col", type_=type_)
        type_, _ = spec.get_sqla_column_type("NTEXT")
        unicode_col = column("unicode_col", type_=type_)
        tbl = table("tbl")
        sel = (
            select([str_col, unicode_col])
            .select_from(tbl)
            .where(str_col == "abc")
            .where(unicode_col == "abc")
        )

        query = str(
            sel.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
        )
        query_expected = (
            "SELECT col, unicode_col \n"
            "FROM tbl \n"
            "WHERE col = 'abc' AND unicode_col = N'abc'"
        )
        self.assertEqual(query, query_expected)

    def test_time_exp_mixd_case_col_1y(self):
        col = column("MixedCase")
        expr = MssqlEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(None, dialect=mssql.dialect()))
        self.assertEqual(result, "DATEADD(year, DATEDIFF(year, 0, [MixedCase]), 0)")

    def test_convert_dttm(self):
        dttm = self.get_dttm()
        test_cases = (
            (
                MssqlEngineSpec.convert_dttm("DATE", dttm),
                "CONVERT(DATE, '2019-01-02', 23)",
            ),
            (
                MssqlEngineSpec.convert_dttm("DATETIME", dttm),
                "CONVERT(DATETIME, '2019-01-02T03:04:05.678', 126)",
            ),
            (
                MssqlEngineSpec.convert_dttm("SMALLDATETIME", dttm),
                "CONVERT(SMALLDATETIME, '2019-01-02 03:04:05', 20)",
            ),
        )

        for actual, expected in test_cases:
            self.assertEqual(actual, expected)

    def test_extract_error_message(self):
        test_mssql_exception = Exception(
            "(8155, b\"No column name was specified for column 1 of 'inner_qry'."
            "DB-Lib error message 20018, severity 16:\\nGeneral SQL Server error: "
            'Check messages from the SQL Server\\n")'
        )
        error_message = MssqlEngineSpec.extract_error_message(test_mssql_exception)
        expected_message = (
            "mssql error: All your SQL functions need to "
            "have an alias on MSSQL. For example: SELECT COUNT(*) AS C1 FROM TABLE1"
        )
        self.assertEqual(expected_message, error_message)

        test_mssql_exception = Exception(
            '(8200, b"A correlated expression is invalid because it is not in a '
            "GROUP BY clause.\\n\")'"
        )
        error_message = MssqlEngineSpec.extract_error_message(test_mssql_exception)
        expected_message = "mssql error: " + MssqlEngineSpec._extract_error_message(
            test_mssql_exception
        )
        self.assertEqual(expected_message, error_message)

    @mock.patch.object(
        MssqlEngineSpec, "pyodbc_rows_to_tuples", return_value="converted"
    )
    def test_fetch_data(self, mock_pyodbc_rows_to_tuples):
        data = [(1, "foo")]
        with mock.patch.object(
            BaseEngineSpec, "fetch_data", return_value=data
        ) as mock_fetch:
            result = MssqlEngineSpec.fetch_data(None, 0)
            mock_pyodbc_rows_to_tuples.assert_called_once_with(data)
            self.assertEqual(result, "converted")

    def test_column_datatype_to_string(self):
        test_cases = (
            (DATE(), "DATE"),
            (VARCHAR(length=255), "VARCHAR(255)"),
            (VARCHAR(length=255, collation="utf8_general_ci"), "VARCHAR(255)"),
            (NVARCHAR(length=128), "NVARCHAR(128)"),
            (TEXT(), "TEXT"),
            (NTEXT(collation="utf8_general_ci"), "NTEXT"),
        )

        for original, expected in test_cases:
            actual = MssqlEngineSpec.column_datatype_to_string(
                original, mssql.dialect()
            )
            self.assertEqual(actual, expected)

    def test_extract_errors(self):
        """
        Test that custom error messages are extracted correctly.
        """
        msg = dedent(
            """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (locahost)
            """
        )
        result = MssqlEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                message='The hostname "locahost" cannot be resolved.',
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Microsoft SQL Server",
                    "issue_codes": [
                        {
                            "code": 1007,
                            "message": "Issue 1007 - The hostname provided can't be resolved.",
                        }
                    ],
                },
            )
        ]

        msg = dedent(
            """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (localhost)
Net-Lib error during Connection refused (61)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (localhost)
Net-Lib error during Connection refused (61)
            """
        )
        result = MssqlEngineSpec.extract_errors(
            Exception(msg), context={"port": 12345, "hostname": "localhost"}
        )
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                message='Port 12345 on hostname "localhost" refused the connection.',
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Microsoft SQL Server",
                    "issue_codes": [
                        {"code": 1008, "message": "Issue 1008 - The port is closed."}
                    ],
                },
            )
        ]

        msg = dedent(
            """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (example.com)
Net-Lib error during Operation timed out (60)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (example.com)
Net-Lib error during Operation timed out (60)
            """
        )
        result = MssqlEngineSpec.extract_errors(
            Exception(msg), context={"port": 12345, "hostname": "example.com"}
        )
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "example.com" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Microsoft SQL Server",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, and can't be reached on the provided port.",
                        }
                    ],
                },
            )
        ]

        msg = dedent(
            """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (93.184.216.34)
Net-Lib error during Operation timed out (60)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (93.184.216.34)
Net-Lib error during Operation timed out (60)
            """
        )
        result = MssqlEngineSpec.extract_errors(
            Exception(msg), context={"port": 12345, "hostname": "93.184.216.34"}
        )
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "93.184.216.34" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Microsoft SQL Server",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, and can't be reached on the provided port.",
                        }
                    ],
                },
            )
        ]

        msg = dedent(
            """
DB-Lib error message 20018, severity 14:
General SQL Server error: Check messages from the SQL Server
DB-Lib error message 20002, severity 9:
Adaptive Server connection failed (mssqldb.cxiotftzsypc.us-west-2.rds.amazonaws.com)
DB-Lib error message 20002, severity 9:
Adaptive Server connection failed (mssqldb.cxiotftzsypc.us-west-2.rds.amazonaws.com)
            """
        )
        result = MssqlEngineSpec.extract_errors(
            Exception(msg), context={"username": "testuser", "database": "testdb"}
        )
        assert result == [
            SupersetError(
                message='Either the username "testuser", password, or database name "testdb" is incorrect.',
                error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Microsoft SQL Server",
                    "issue_codes": [
                        {
                            "code": 1014,
                            "message": "Issue 1014 - Either the username or "
                            "the password is wrong.",
                        },
                        {
                            "code": 1015,
                            "message": "Issue 1015 - Either the database is "
                            "spelled incorrectly or does not exist.",
                        },
                    ],
                },
            )
        ]
