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

from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from tests.db_engine_specs.base_tests import DbEngineSpecTestCase


class BigQueryTestCase(DbEngineSpecTestCase):
    def test_bigquery_sqla_column_label(self):
        test_cases = {
            "Col": "Col",
            "SUM(x)": "SUM_x__5f110",
            "SUM[x]": "SUM_x__7ebe1",
            "12345_col": "_12345_col_8d390",
        }
        for original, expected in test_cases.items():
            actual = BigQueryEngineSpec.make_label_compatible(column(original).name)
            self.assertEqual(actual, expected)

    def test_convert_dttm(self):
        dttm = self.get_dttm()
        test_cases = {
            "DATE": "CAST('2019-01-02' AS DATE)",
            "DATETIME": "CAST('2019-01-02T03:04:05.678900' AS DATETIME)",
            "TIMESTAMP": "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)",
        }

        for target_type, expected in test_cases.items():
            actual = BigQueryEngineSpec.convert_dttm(target_type, dttm)
            self.assertEqual(actual, expected)

    def test_timegrain_expressions(self):
        col = column("temporal")
        test_cases = {
            "DATE": "DATE_TRUNC(temporal, HOUR)",
            "TIME": "TIME_TRUNC(temporal, HOUR)",
            "DATETIME": "DATETIME_TRUNC(temporal, HOUR)",
            "TIMESTAMP": "TIMESTAMP_TRUNC(temporal, HOUR)",
        }
        for type_, expected in test_cases.items():
            actual = BigQueryEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="PT1H", type_=type_
            )
            self.assertEqual(str(actual), expected)
