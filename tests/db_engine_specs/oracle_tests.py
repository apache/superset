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

import pytest
from sqlalchemy import column
from sqlalchemy.dialects import oracle
from sqlalchemy.dialects.oracle import DATE, NVARCHAR, VARCHAR

from superset.db_engine_specs.oracle import OracleEngineSpec
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestOracleDbEngineSpec(TestDbEngineSpec):
    def test_oracle_sqla_column_name_length_exceeded(self):
        col = column("This_Is_32_Character_Column_Name")
        label = OracleEngineSpec.make_label_compatible(col.name)
        self.assertEqual(label.quote, True)
        label_expected = "3b26974078683be078219674eeb8f5"
        self.assertEqual(label, label_expected)

    def test_oracle_time_expression_reserved_keyword_1m_grain(self):
        col = column("decimal")
        expr = OracleEngineSpec.get_timestamp_expr(col, None, "P1M")
        result = str(expr.compile(dialect=oracle.dialect()))
        self.assertEqual(result, "TRUNC(CAST(\"decimal\" as DATE), 'MONTH')")
        dttm = self.get_dttm()

    def test_column_datatype_to_string(self):
        test_cases = (
            (DATE(), "DATE"),
            (VARCHAR(length=255), "VARCHAR(255 CHAR)"),
            (VARCHAR(length=255, collation="utf8"), "VARCHAR(255 CHAR)"),
            (NVARCHAR(length=128), "NVARCHAR2(128)"),
        )

        for original, expected in test_cases:
            actual = OracleEngineSpec.column_datatype_to_string(
                original, oracle.dialect()
            )
            self.assertEqual(actual, expected)

    def test_fetch_data_no_description(self):
        cursor = mock.MagicMock()
        cursor.description = []
        assert OracleEngineSpec.fetch_data(cursor) == []

    def test_fetch_data(self):
        cursor = mock.MagicMock()
        result = ["a", "b"]
        cursor.fetchall.return_value = result
        assert OracleEngineSpec.fetch_data(cursor) == result


@pytest.mark.parametrize(
    "date_format,expected",
    [
        ("DATE", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        ("DATETIME", """TO_DATE('2019-01-02T03:04:05', 'YYYY-MM-DD"T"HH24:MI:SS')"""),
        (
            "TIMESTAMP",
            """TO_TIMESTAMP('2019-01-02T03:04:05.678900', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')""",
        ),
        (
            "timestamp",
            """TO_TIMESTAMP('2019-01-02T03:04:05.678900', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')""",
        ),
        ("Other", None),
    ],
)
def test_convert_dttm(date_format, expected):
    dttm = TestOracleDbEngineSpec.get_dttm()
    assert OracleEngineSpec.convert_dttm(date_format, dttm) == expected
