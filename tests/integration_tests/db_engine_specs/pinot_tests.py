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

from superset.db_engine_specs.pinot import PinotEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestPinotDbEngineSpec(TestDbEngineSpec):
    """Tests pertaining to our Pinot database support"""

    def test_pinot_time_expression_sec_one_1d_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "epoch_s", "P1D")
        result = str(expr.compile())
        expected = (
            "CAST(DATE_TRUNC('day', CAST("
            + "DATETIMECONVERT(tstamp, '1:SECONDS:EPOCH', "
            + "'1:SECONDS:EPOCH', '1:SECONDS') AS TIMESTAMP)) AS TIMESTAMP)"
        )
        assert result == expected

    def test_pinot_time_expression_simple_date_format_1d_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "%Y-%m-%d %H:%M:%S", "P1D")
        result = str(expr.compile())
        expected = "CAST(DATE_TRUNC('day', CAST(tstamp AS TIMESTAMP)) AS TIMESTAMP)"
        assert result == expected

    def test_pinot_time_expression_simple_date_format_10m_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "%Y-%m-%d %H:%M:%S", "PT10M")
        result = str(expr.compile())
        expected = (
            "CAST(ROUND(DATE_TRUNC('minute', CAST(tstamp AS "
            + "TIMESTAMP)), 600000) AS TIMESTAMP)"
        )
        assert result == expected

    def test_pinot_time_expression_simple_date_format_1w_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "%Y-%m-%d %H:%M:%S", "P1W")
        result = str(expr.compile())
        expected = "CAST(DATE_TRUNC('week', CAST(tstamp AS TIMESTAMP)) AS TIMESTAMP)"
        assert result == expected

    def test_pinot_time_expression_sec_one_1m_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "epoch_s", "P1M")
        result = str(expr.compile())
        expected = (
            "CAST(DATE_TRUNC('month', CAST("
            + "DATETIMECONVERT(tstamp, '1:SECONDS:EPOCH', "
            + "'1:SECONDS:EPOCH', '1:SECONDS') AS TIMESTAMP)) AS TIMESTAMP)"
        )
        assert result == expected

    def test_pinot_time_expression_millisec_one_1m_grain(self):
        col = column("tstamp")
        expr = PinotEngineSpec.get_timestamp_expr(col, "epoch_ms", "P1M")
        result = str(expr.compile())
        expected = (
            "CAST(DATE_TRUNC('month', CAST("
            + "DATETIMECONVERT(tstamp, '1:MILLISECONDS:EPOCH', "
            + "'1:MILLISECONDS:EPOCH', '1:MILLISECONDS') AS TIMESTAMP)) AS TIMESTAMP)"
        )
        assert result == expected

    def test_invalid_get_time_expression_arguments(self):
        with self.assertRaises(NotImplementedError):
            PinotEngineSpec.get_timestamp_expr(column("tstamp"), None, "P0.25Y")

        with self.assertRaises(NotImplementedError):
            PinotEngineSpec.get_timestamp_expr(
                column("tstamp"), "epoch_s", "invalid_grain"
            )
