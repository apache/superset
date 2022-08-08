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

from sqlalchemy import column

from superset.db_engine_specs.druid import DruidEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec
from tests.integration_tests.fixtures.certificates import ssl_certificate
from tests.integration_tests.fixtures.database import default_db_extra


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
            "PT1S": f"TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT1S')",
            "PT5M": f"TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT5M')",
            "P1W/1970-01-03T00:00:00Z": f"TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST({col} AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', 5)",
            "1969-12-28T00:00:00Z/P1W": f"TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST({col} AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', -1)",
        }
        for grain, expected in test_cases.items():
            actual = DruidEngineSpec.get_timestamp_expr(
                col=sqla_col, pdf=None, time_grain=grain
            )
            self.assertEqual(str(actual), expected)

    def test_extras_without_ssl(self):
        db = mock.Mock()
        db.extra = default_db_extra
        db.server_cert = None
        extras = DruidEngineSpec.get_extra_params(db)
        assert "connect_args" not in extras["engine_params"]

    def test_extras_with_ssl(self):
        db = mock.Mock()
        db.extra = default_db_extra
        db.server_cert = ssl_certificate
        extras = DruidEngineSpec.get_extra_params(db)
        connect_args = extras["engine_params"]["connect_args"]
        assert connect_args["scheme"] == "https"
        assert "ssl_verify_cert" in connect_args
