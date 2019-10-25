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
        label = BigQueryEngineSpec.make_label_compatible(column("Col").name)
        label_expected = "Col"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("SUM(x)").name)
        label_expected = "SUM_x__5f110"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("SUM[x]").name)
        label_expected = "SUM_x__7ebe1"
        self.assertEqual(label, label_expected)

        label = BigQueryEngineSpec.make_label_compatible(column("12345_col").name)
        label_expected = "_12345_col_8d390"
        self.assertEqual(label, label_expected)
