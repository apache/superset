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

# from sqlalchemy.dialects import databricks
from superset.constants import USER_AGENT
from superset.db_engine_specs import get_engine_spec
from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.sql_lab import Query
from superset.utils.core import GenericDataType
from tests.integration_tests.db_engine_specs.base_tests import (
    assert_generic_types,
    TestDbEngineSpec,
)
from tests.integration_tests.fixtures.certificates import ssl_certificate
from tests.integration_tests.fixtures.database import default_db_extra


class TestDatabricksDbEngineSpec(TestDbEngineSpec):
    # def test_get_table_names(self):
    #     """
    #     DB Eng Specs (databricks): Test get table names
    #     """

    #     """ Make sure databricks doesn't try to remove schema name from table name
    #     ie. when try_remove_schema_from_table_name == False. """
    #     inspector = mock.Mock()
    #     inspector.get_table_names = mock.Mock(
    #         return_value=["schema.table", "table_2"])
    #     inspector.get_foreign_table_names = mock.Mock(return_value=["table_3"])

    #     pg_result_expected = ["schema.table", "table_2", "table_3"]
    #     pg_result = DatabricksNativeEngineSpec.get_table_names(
    #         database=mock.ANY, schema="schema", inspector=inspector
    #     )
    #     self.assertListEqual(pg_result_expected, pg_result)

    # def test_time_exp_literal_no_grain(self):
    #     """
    #     DB Eng Specs (databricks): Test no grain literal column
    #     """
    #     col = literal_column("COALESCE(a, b)")
    #     expr = DatabricksNativeEngineSpec.get_timestamp_expr(col, None, None)
    #     result = str(expr.compile(None, dialect=databricks.dialect()))
    #     self.assertEqual(result, "COALESCE(a, b)")

    # def test_time_exp_literal_1y_grain(self):
    #     """
    #     DB Eng Specs (databricks): Test grain literal column 1 YEAR
    #     """
    #     col = literal_column("COALESCE(a, b)")
    #     expr = DatabricksNativeEngineSpec.get_timestamp_expr(col, None, "P1Y")
    #     result = str(expr.compile(None, dialect=databricks.dialect()))
    #     self.assertEqual(result, "DATE_TRUNC('year', COALESCE(a, b))")

    # def test_time_ex_lowr_col_no_grain(self):
    #     """
    #     DB Eng Specs (databricks): Test no grain expr lower case
    #     """
    #     col = column("lower_case")
    #     expr = DatabricksNativeEngineSpec.get_timestamp_expr(col, None, None)
    #     result = str(expr.compile(None, dialect=databricks.dialect()))
    #     self.assertEqual(result, "lower_case")

    # def test_time_exp_lowr_col_sec_1y(self):
    #     """
    #     DB Eng Specs (databricks): Test grain expr lower case 1 YEAR
    #     """
    #     col = column("lower_case")
    #     expr = DatabricksNativeEngineSpec.get_timestamp_expr(col, "epoch_s", "P1Y")
    #     result = str(expr.compile(None, dialect=databricks.dialect()))
    #     self.assertEqual(
    #         result,
    #         "DATE_TRUNC('year', "
    #         "(timestamp 'epoch' + lower_case * interval '1 second'))",
    #     )

    # def test_time_exp_mixd_case_col_1y(self):
    #     """
    #     DB Eng Specs (databricks): Test grain expr mixed case 1 YEAR
    #     """
    #     col = column("MixedCase")
    #     expr = DatabricksNativeEngineSpec.get_timestamp_expr(col, None, "P1Y")
    #     result = str(expr.compile(None, dialect=databricks.dialect()))
    #     self.assertEqual(result, "DATE_TRUNC('year', \"MixedCase\")")

    # def test_convert_dttm(self):
    #     """
    #     DB Eng Specs (databricks): Test conversion to date time
    #     """
    #     dttm = self.get_dttm()

    #     self.assertEqual(
    #         DatabricksNativeEngineSpec.convert_dttm("DATE", dttm),
    #         "TO_DATE('2019-01-02', 'YYYY-MM-DD')",
    #     )

    #     self.assertEqual(
    #         DatabricksNativeEngineSpec.convert_dttm("TIMESTAMP", dttm),
    #         "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
    #     )

    #     self.assertEqual(
    #         DatabricksNativeEngineSpec.convert_dttm("DATETIME", dttm),
    #         "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
    #     )

    #     self.assertEqual(DatabricksNativeEngineSpec.convert_dttm("TIME", dttm), None)

    # def test_empty_dbapi_cursor_description(self):
    #     """
    #     DB Eng Specs (databricks): Test empty cursor description (no columns)
    #     """
    #     cursor = mock.Mock()
    #     # empty description mean no columns, this mocks the following SQL: "SELECT"
    #     cursor.description = []
    #     results = DatabricksNativeEngineSpec.fetch_data(cursor, 1000)
    #     self.assertEqual(results, [])

    def test_engine_alias_name(self):
        """
        DB Eng Specs (databricks): Test "databricks" in engine spec
        """
        self.assertIn("databricks", get_engine_spec("databricks"))

    # def test_extras_without_ssl(self):
    #     db = mock.Mock()
    #     db.extra = default_db_extra
    #     db.server_cert = None
    #     extras = DatabricksNativeEngineSpec.get_extra_params(db)
    #     assert "connect_args" not in extras["engine_params"]

    def test_extras_with_user_agent(self):
        db = mock.Mock()
        db.extra = default_db_extra
        extras = DatabricksNativeEngineSpec.get_extra_params(db)
        _, user_agent = extras["http_headers"][0]
        user_agent_entry = extras["_user_agent_entry"]
        assert user_agent == USER_AGENT
        assert user_agent_entry == USER_AGENT

    # def test_extras_with_ssl_custom(self):
    #     db = mock.Mock()
    #     db.extra = default_db_extra.replace(
    #         '"engine_params": {}',
    #         '"engine_params": {"connect_args": {"ssl": "1"}}',
    #     )
    #     db.server_cert = ssl_certificate
    #     extras = DatabricksNativeEngineSpec.get_extra_params(db)
    #     connect_args = extras["engine_params"]["connect_args"]
    #     assert connect_args["ssl"] == "1"


#     def test_estimate_statement_cost_select_star(self):
#         """
#         DB Eng Specs (databricks): Test estimate_statement_cost select star
#         """

#         cursor = mock.Mock()
#         cursor.fetchone.return_value = (
#             "Seq Scan on birth_names  (cost=0.00..1537.91 rows=75691 width=46)",
#         )
#         sql = "SELECT * FROM birth_names"
#         results = DatabricksNativeEngineSpec.estimate_statement_cost(sql, cursor)
#         self.assertEqual(
#             results,
#             {
#                 "Start-up cost": 0.00,
#                 "Total cost": 1537.91,
#             },
#         )

#     def test_estimate_statement_invalid_syntax(self):
#         """
#         DB Eng Specs (databricks): Test estimate_statement_cost invalid syntax
#         """
#         from psycopg2 import errors

#         cursor = mock.Mock()
#         cursor.execute.side_effect = errors.SyntaxError(
#             """
#             syntax error at or near "EXPLAIN"
#             LINE 1: EXPLAIN DROP TABLE birth_names
#                             ^
#             """
#         )
#         sql = "DROP TABLE birth_names"
#         with self.assertRaises(errors.SyntaxError):
#             DatabricksNativeEngineSpec.estimate_statement_cost(sql, cursor)

#     def test_query_cost_formatter_example_costs(self):
#         """
#         DB Eng Specs (databricks): Test test_query_cost_formatter example costs
#         """
#         raw_cost = [
#             {
#                 "Start-up cost": 0.00,
#                 "Total cost": 1537.91,
#             },
#             {
#                 "Start-up cost": 10.00,
#                 "Total cost": 1537.00,
#             },
#         ]
#         result = DatabricksNativeEngineSpec.query_cost_formatter(raw_cost)
#         self.assertEqual(
#             result,
#             [
#                 {
#                     "Start-up cost": "0.0",
#                     "Total cost": "1537.91",
#                 },
#                 {
#                     "Start-up cost": "10.0",
#                     "Total cost": "1537.0",
#                 },
#             ],
#         )

#     def test_extract_errors(self):
#         """
#         Test that custom error messages are extracted correctly.
#         """
#         msg = 'psql: error: FATAL:  role "testuser" does not exist'
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
#                 message='The username "testuser" does not exist.',
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1012,
#                             "message": (
#                                 "Issue 1012 - The username provided when "
#                                 "connecting to a database is not valid."
#                             ),
#                         },
#                     ],
#                     "invalid": ["username"],
#                 },
#             )
#         ]

#         msg = (
#             'psql: error: could not translate host name "locahost" to address: '
#             "nodename nor servname provided, or not known"
#         )
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
#                 message='The hostname "locahost" cannot be resolved.',
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1007,
#                             "message": "Issue 1007 - The hostname provided "
#                             "can't be resolved.",
#                         }
#                     ],
#                     "invalid": ["host"],
#                 },
#             )
#         ]

#         msg = dedent(
#             """
# psql: error: could not connect to server: Connection refused
#         Is the server running on host "localhost" (::1) and accepting
#         TCP/IP connections on port 12345?
# could not connect to server: Connection refused
#         Is the server running on host "localhost" (127.0.0.1) and accepting
#         TCP/IP connections on port 12345?
#             """
#         )
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
#                 message='Port 12345 on hostname "localhost" refused the connection.',
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {"code": 1008, "message": "Issue 1008 - The port is closed."}
#                     ],
#                     "invalid": ["host", "port"],
#                 },
#             )
#         ]

#         msg = dedent(
#             """
# psql: error: could not connect to server: Operation timed out
#         Is the server running on host "example.com" (93.184.216.34) and accepting
#         TCP/IP connections on port 12345?
#             """
#         )
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
#                 message=(
#                     'The host "example.com" might be down, '
#                     "and can't be reached on port 12345."
#                 ),
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1009,
#                             "message": "Issue 1009 - The host might be down, "
#                             "and can't be reached on the provided port.",
#                         }
#                     ],
#                     "invalid": ["host", "port"],
#                 },
#             )
#         ]

#         # response with IP only
#         msg = dedent(
#             """
# psql: error: could not connect to server: Operation timed out
#         Is the server running on host "93.184.216.34" and accepting
#         TCP/IP connections on port 12345?
#             """
#         )
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
#                 message=(
#                     'The host "93.184.216.34" might be down, '
#                     "and can't be reached on port 12345."
#                 ),
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1009,
#                             "message": "Issue 1009 - The host might be down, "
#                             "and can't be reached on the provided port.",
#                         }
#                     ],
#                     "invalid": ["host", "port"],
#                 },
#             )
#         ]

#         msg = 'FATAL:  password authentication failed for user "databricks"'
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 error_type=SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
#                 message=(
#                     'The password provided for username "databricks" is incorrect.'),
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1013,
#                             "message": (
#                                 "Issue 1013 - The password provided when "
#                                 "connecting to a database is not valid."
#                             ),
#                         },
#                     ],
#                     "invalid": ["username", "password"],
#                 },
#             )
#         ]

#         msg = 'database "badDB" does not exist'
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 message='Unable to connect to database "badDB".',
#                 error_type=SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1015,
#                             "message": (
#                                 "Issue 1015 - Either the database is spelled "
#                                 "incorrectly or does not exist.",
#                             ),
#                         }
#                     ],
#                     "invalid": ["database"],
#                 },
#             )
#         ]

#         msg = "no password supplied"
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 message="Please re-enter the password.",
#                 error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "invalid": ["password"],
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1014,
#                             "message": "Issue 1014 - Either the username or the password is wrong.",
#                         },
#                         {
#                             "code": 1015,
#                             "message": "Issue 1015 - Either the database is spelled incorrectly or does not exist.",
#                         },
#                     ],
#                 },
#             )
#         ]

#         msg = 'syntax error at or near "fromm"'
#         result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))
#         assert result == [
#             SupersetError(
#                 message='Please check your query for syntax errors at or near "fromm". Then, try running your query again.',
#                 error_type=SupersetErrorType.SYNTAX_ERROR,
#                 level=ErrorLevel.ERROR,
#                 extra={
#                     "engine_name": "PostgreSQL",
#                     "issue_codes": [
#                         {
#                             "code": 1030,
#                             "message": "Issue 1030 - The query has a syntax error.",
#                         }
#                     ],
#                 },
#             )
#         ]

#     @mock.patch("sqlalchemy.engine.Engine.connect")
#     def test_get_cancel_query_id(self, engine_mock):
#         query = Query()
#         cursor_mock = engine_mock.return_value.__enter__.return_value
#         cursor_mock.fetchone.return_value = [123]
#         assert DatabricksNativeEngineSpec.get_cancel_query_id(
#             cursor_mock, query) == 123

#     @mock.patch("sqlalchemy.engine.Engine.connect")
#     def test_cancel_query(self, engine_mock):
#         query = Query()
#         cursor_mock = engine_mock.return_value.__enter__.return_value
#         assert DatabricksNativeEngineSpec.cancel_query(
#             cursor_mock, query, 123) is True

#     @mock.patch("sqlalchemy.engine.Engine.connect")
#     def test_cancel_query_failed(self, engine_mock):
#         query = Query()
#         cursor_mock = engine_mock.raiseError.side_effect = Exception()
#         assert DatabricksNativeEngineSpec.cancel_query(
#             cursor_mock, query, 123) is False
