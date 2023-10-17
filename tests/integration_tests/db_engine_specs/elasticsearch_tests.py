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
import unittest.mock as mock

import pytest
from pandas import DataFrame
from sqlalchemy import column

from superset.connectors.sqla.models import TableColumn
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.elasticsearch import ElasticSearchEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.sql_parse import Table
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


class TestElasticsearchDbEngineSpec(TestDbEngineSpec):
    def test_timegrain_week_expression(self):
        """
        DB Eng Specs (elasticsearch): Test time grain expressions
        """
        col = column("ts")
        test_cases = {
            "date": "DATE_TRUNC('week', ts)",
            "date_nanos": "DATE_TRUNC('week', ts)",
        }
        for type_, expected in test_cases.items():
            col.type = type_
            actual = ElasticSearchEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="P1W"
            )
            self.assertEqual(str(actual), expected)

    def test_timegrain_hour_expression(self):
        """
        DB Eng Specs (elasticsearch): Test time grain expressions
        """
        col = column("ts")
        test_cases = {
            "date": "HISTOGRAM(ts, INTERVAL 1 HOUR)",
            "date_nanos": "HISTOGRAM(ts, INTERVAL 1 HOUR)",
        }
        for type_, expected in test_cases.items():
            col.type = type_
            actual = ElasticSearchEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="PT1H"
            )
            self.assertEqual(str(actual), expected)
