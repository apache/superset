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

from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.models.core import Database
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestSnowflakeDbEngineSpec(TestDbEngineSpec):
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
