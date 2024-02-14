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
from parameterized import parameterized
from sqlalchemy import column

from superset.constants import TimeGrain
from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestElasticsearchDbEngineSpec(TestDbEngineSpec):
    @parameterized.expand(
        [
            [TimeGrain.SECOND, "DATE_TRUNC('second', ts)"],
            [TimeGrain.MINUTE, "DATE_TRUNC('minute', ts)"],
            [TimeGrain.HOUR, "DATE_TRUNC('hour', ts)"],
            [TimeGrain.DAY, "DATE_TRUNC('day', ts)"],
            [TimeGrain.WEEK, "DATE_TRUNC('week', ts)"],
            [TimeGrain.MONTH, "DATE_TRUNC('month', ts)"],
            [TimeGrain.YEAR, "DATE_TRUNC('year', ts)"],
        ]
    )
    def test_time_grain_expressions(self, time_grain, expected_time_grain_expression):
        col = column("ts")
        col.type = "DATETIME"
        actual = ElasticSearchEngineSpec.get_timestamp_expr(
            col=col, pdf=None, time_grain=time_grain
        )
        self.assertEqual(str(actual), expected_time_grain_expression)
