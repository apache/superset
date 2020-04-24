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
from typing import Optional

from sqlalchemy import column, table
from sqlalchemy.dialects import mssql
from sqlalchemy.dialects.mssql import DATE, NTEXT, NVARCHAR, TEXT, VARCHAR
from sqlalchemy.sql import select, Select
from sqlalchemy.types import String, UnicodeText

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.mssql import MssqlEngineSpec
from superset.extensions import db
from superset.models.core import Database
from tests.db_engine_specs.base_tests import DbEngineSpecTestCase


class MssqlEngineSpecTest(DbEngineSpecTestCase):
    def test_mssql_column_types(self):
        def assert_type(type_string, type_expected):
            type_assigned = MssqlEngineSpec.get_sqla_column_type(type_string)
            if type_expected is None:
                self.assertIsNone(type_assigned)
            else:
                self.assertIsInstance(type_assigned, type_expected)

        assert_type("INT", None)
        assert_type("STRING", String)
        assert_type("CHAR(10)", String)
        assert_type("VARCHAR(10)", String)
        assert_type("TEXT", String)
        assert_type("NCHAR(10)", UnicodeText)
        assert_type("NVARCHAR(10)", UnicodeText)
        assert_type("NTEXT", UnicodeText)

    def test_where_clause_n_prefix(self):
        dialect = mssql.dialect()
        spec = MssqlEngineSpec
        str_col = column("col", type_=spec.get_sqla_column_type("VARCHAR(10)"))
        unicode_col = column("unicode_col", type_=spec.get_sqla_column_type("NTEXT"))
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

    def test_apply_limit(self):
        def compile_sqla_query(qry: Select, schema: Optional[str] = None) -> str:
            return str(
                qry.compile(
                    dialect=mssql.dialect(), compile_kwargs={"literal_binds": True}
                )
            )

        database = Database(
            database_name="mssql_test",
            sqlalchemy_uri="mssql+pymssql://sa:Password_123@localhost:1433/msdb",
        )
        db.session.add(database)
        db.session.commit()

        with mock.patch.object(database, "compile_sqla_query", new=compile_sqla_query):
            test_sql = "SELECT COUNT(*) FROM FOO_TABLE"

            limited_sql = MssqlEngineSpec.apply_limit_to_sql(test_sql, 1000, database)

            expected_sql = (
                "SELECT TOP 1000 * \n"
                "FROM (SELECT COUNT(*) AS COUNT_1 FROM FOO_TABLE) AS inner_qry"
            )
            self.assertEqual(expected_sql, limited_sql)

            test_sql = "SELECT COUNT(*), SUM(id) FROM FOO_TABLE"
            limited_sql = MssqlEngineSpec.apply_limit_to_sql(test_sql, 1000, database)

            expected_sql = (
                "SELECT TOP 1000 * \n"
                "FROM (SELECT COUNT(*) AS COUNT_1, SUM(id) AS SUM_2 FROM FOO_TABLE) "
                "AS inner_qry"
            )
            self.assertEqual(expected_sql, limited_sql)

            test_sql = "SELECT COUNT(*), FOO_COL1 FROM FOO_TABLE GROUP BY FOO_COL1"
            limited_sql = MssqlEngineSpec.apply_limit_to_sql(test_sql, 1000, database)

            expected_sql = (
                "SELECT TOP 1000 * \n"
                "FROM (SELECT COUNT(*) AS COUNT_1, "
                "FOO_COL1 FROM FOO_TABLE GROUP BY FOO_COL1)"
                " AS inner_qry"
            )
            self.assertEqual(expected_sql, limited_sql)

            test_sql = "SELECT COUNT(*), COUNT(*) FROM FOO_TABLE"
            limited_sql = MssqlEngineSpec.apply_limit_to_sql(test_sql, 1000, database)
            expected_sql = (
                "SELECT TOP 1000 * \n"
                "FROM (SELECT COUNT(*) AS COUNT_1, COUNT(*) AS COUNT_2 FROM FOO_TABLE)"
                " AS inner_qry"
            )
            self.assertEqual(expected_sql, limited_sql)

        db.session.delete(database)
        db.session.commit()

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
