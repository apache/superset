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
import json

from sqlalchemy import column

from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.core import Database
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestSnowflakeDbEngineSpec(TestDbEngineSpec):
    def test_snowflake_sqla_column_label(self):
        """
        DB Eng Specs (snowflake): Test column label
        """
        test_cases = {
            "Col": "Col",
            "SUM(x)": "SUM(x)",
            "SUM[x]": "SUM[x]",
            "12345_col": "12345_col",
        }
        for original, expected in test_cases.items():
            actual = SnowflakeEngineSpec.make_label_compatible(column(original).name)
            self.assertEqual(actual, expected)

    def test_convert_dttm(self):
        dttm = self.get_dttm()

        test_cases = {
            "DATE": "TO_DATE('2019-01-02')",
            "DATETIME": "CAST('2019-01-02T03:04:05.678900' AS DATETIME)",
            "TIMESTAMP": "TO_TIMESTAMP('2019-01-02T03:04:05.678900')",
        }

        for type_, expected in test_cases.items():
            self.assertEqual(SnowflakeEngineSpec.convert_dttm(type_, dttm), expected)

    def test_database_connection_test_mutator(self):
        database = Database(sqlalchemy_uri="snowflake://abc")
        SnowflakeEngineSpec.mutate_db_for_connection_test(database)
        engine_params = json.loads(database.extra or "{}")

        self.assertDictEqual(
            {"engine_params": {"connect_args": {"validate_default_parameters": True}}},
            engine_params,
        )

    def test_extract_errors(self):
        msg = "Object dumbBrick does not exist or not authorized."
        result = SnowflakeEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message="dumbBrick does not exist in this database.",
                error_type=SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Snowflake",
                    "issue_codes": [
                        {
                            "code": 1029,
                            "message": "Issue 1029 - The object does not exist in the given database.",
                        }
                    ],
                },
            )
        ]

        msg = "syntax error line 1 at position 10 unexpected 'limmmited'."
        result = SnowflakeEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='Please check your query for syntax errors at or near "limmmited". Then, try running your query again.',
                error_type=SupersetErrorType.SYNTAX_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Snowflake",
                    "issue_codes": [
                        {
                            "code": 1030,
                            "message": "Issue 1030 - The query has a syntax error.",
                        }
                    ],
                },
            )
        ]
