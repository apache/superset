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
from sqlalchemy import column

from superset.db_engine_specs.druid import DruidEngineSpec
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestDruidDbEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        dttm = self.get_dttm()

        self.assertEqual(
            DruidEngineSpec.convert_dttm("DATETIME", dttm),
            "TIME_PARSE('2019-01-02T03:04:05')",
        )

        self.assertEqual(
            DruidEngineSpec.convert_dttm("TIMESTAMP", dttm),
            "TIME_PARSE('2019-01-02T03:04:05')",
        )

        self.assertEqual(
            DruidEngineSpec.convert_dttm("DATE", dttm),
            "CAST(TIME_PARSE('2019-01-02') AS DATE)",
        )

    def test_timegrain_expressions(self):
        """
        DB Eng Specs (druid): Test time grain expressions
        """
        col = "__time"
        sqla_col = column(col)
        test_cases = {
            "PT1S": f"FLOOR({col} TO SECOND)",
            "PT5M": f"TIME_FLOOR({col}, 'PT5M')",
        }
        for grain, expected in test_cases.items():
            actual = DruidEngineSpec.get_timestamp_expr(
                col=sqla_col, pdf=None, time_grain=grain
            )
            self.assertEqual(str(actual), expected)
