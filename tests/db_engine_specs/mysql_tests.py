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
import unittest

from sqlalchemy.dialects import mysql
from sqlalchemy.dialects.mysql import DATE, NVARCHAR, TEXT, VARCHAR

from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.utils.core import DbColumnType
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestMySQLEngineSpecsDbEngineSpec(TestDbEngineSpec):
    @unittest.skipUnless(
        TestDbEngineSpec.is_module_installed("MySQLdb"), "mysqlclient not installed"
    )
    def test_get_datatype_mysql(self):
        """Tests related to datatype mapping for MySQL"""
        self.assertEqual("TINY", MySQLEngineSpec.get_datatype(1))
        self.assertEqual("VARCHAR", MySQLEngineSpec.get_datatype(15))

    def test_convert_dttm(self):
        dttm = self.get_dttm()

        self.assertEqual(
            MySQLEngineSpec.convert_dttm("DATE", dttm),
            "STR_TO_DATE('2019-01-02', '%Y-%m-%d')",
        )

        self.assertEqual(
            MySQLEngineSpec.convert_dttm("DATETIME", dttm),
            "STR_TO_DATE('2019-01-02 03:04:05.678900', '%Y-%m-%d %H:%i:%s.%f')",
        )

    def test_column_datatype_to_string(self):
        test_cases = (
            (DATE(), "DATE"),
            (VARCHAR(length=255), "VARCHAR(255)"),
            (
                VARCHAR(length=255, charset="latin1", collation="utf8mb4_general_ci"),
                "VARCHAR(255)",
            ),
            (NVARCHAR(length=128), "NATIONAL VARCHAR(128)"),
            (TEXT(), "TEXT"),
        )

        for original, expected in test_cases:
            actual = MySQLEngineSpec.column_datatype_to_string(
                original, mysql.dialect()
            )
            self.assertEqual(actual, expected)

    def test_is_db_column_type_match(self):
        type_expectations = (
            # Numeric
            ("TINYINT", DbColumnType.NUMERIC),
            ("SMALLINT", DbColumnType.NUMERIC),
            ("MEDIUMINT", DbColumnType.NUMERIC),
            ("INT", DbColumnType.NUMERIC),
            ("BIGINT", DbColumnType.NUMERIC),
            ("DECIMAL", DbColumnType.NUMERIC),
            ("FLOAT", DbColumnType.NUMERIC),
            ("DOUBLE", DbColumnType.NUMERIC),
            ("BIT", DbColumnType.NUMERIC),
            # String
            ("CHAR", DbColumnType.STRING),
            ("VARCHAR", DbColumnType.STRING),
            ("TINYTEXT", DbColumnType.STRING),
            ("MEDIUMTEXT", DbColumnType.STRING),
            ("LONGTEXT", DbColumnType.STRING),
            # Temporal
            ("DATE", DbColumnType.TEMPORAL),
            ("DATETIME", DbColumnType.TEMPORAL),
            ("TIMESTAMP", DbColumnType.TEMPORAL),
            ("TIME", DbColumnType.TEMPORAL),
        )

        for type_expectation in type_expectations:
            type_str = type_expectation[0]
            col_type = type_expectation[1]
            assert MySQLEngineSpec.is_db_column_type_match(
                type_str, DbColumnType.NUMERIC
            ) is (col_type == DbColumnType.NUMERIC)
            assert MySQLEngineSpec.is_db_column_type_match(
                type_str, DbColumnType.STRING
            ) is (col_type == DbColumnType.STRING)
            assert MySQLEngineSpec.is_db_column_type_match(
                type_str, DbColumnType.TEMPORAL
            ) is (col_type == DbColumnType.TEMPORAL)
