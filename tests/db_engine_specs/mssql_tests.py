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
from sqlalchemy import column, table
from sqlalchemy.dialects import mssql
from sqlalchemy.sql import select
from sqlalchemy.types import String, UnicodeText

from superset.db_engine_specs.mssql import MssqlEngineSpec
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
