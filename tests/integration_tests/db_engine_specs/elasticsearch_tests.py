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

from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestElasticsearchDbEngineSpec(TestDbEngineSpec):
    def test_time_grain_week_expression(self):
        col = column("ts")
        col.type = "datetime"
        expected_time_grain_expression = "DATE_TRUNC('week', ts)"
        actual = ElasticSearchEngineSpec.get_timestamp_expr(
            col=col, pdf=None, time_grain="P1W"
        )
        self.assertEqual(str(actual), expected_time_grain_expression)

    def test_time_grain_hour_expression(self):
        col = column("ts")
        col.type = "datetime"
        expected_time_grain_expression = "HISTOGRAM(ts, INTERVAL 1 HOUR)"
        actual = ElasticSearchEngineSpec.get_timestamp_expr(
            col=col, pdf=None, time_grain="PT1H"
        )
        self.assertEqual(str(actual), expected_time_grain_expression)
