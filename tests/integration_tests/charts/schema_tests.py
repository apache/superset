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
# isort:skip_file
"""Unit tests for Superset"""

from unittest import mock

import pytest

from marshmallow import ValidationError
from tests.integration_tests.test_app import app
from superset.charts.schemas import ChartDataQueryContextSchema
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.query_context import get_query_context


class TestSchema(SupersetTestCase):
    @mock.patch(
        "superset.common.query_context_factory.config",
        {**app.config, "ROW_LIMIT": 5000},
    )
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_context_limit_and_offset(self):
        payload = get_query_context("birth_names")

        # too low limit and offset
        payload["queries"][0]["row_limit"] = -1
        payload["queries"][0]["row_offset"] = -1
        with self.assertRaises(ValidationError) as context:
            _ = ChartDataQueryContextSchema().load(payload)
        self.assertIn("row_limit", context.exception.messages["queries"][0])
        self.assertIn("row_offset", context.exception.messages["queries"][0])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_context_null_timegrain(self):
        payload = get_query_context("birth_names")
        payload["queries"][0]["extras"]["time_grain_sqla"] = None
        _ = ChartDataQueryContextSchema().load(payload)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_context_series_limit(self):
        payload = get_query_context("birth_names")

        payload["queries"][0]["timeseries_limit"] = 2
        payload["queries"][0]["timeseries_limit_metric"] = {
            "expressionType": "SIMPLE",
            "column": {
                "id": 334,
                "column_name": "gender",
                "filterable": True,
                "groupby": True,
                "is_dttm": False,
                "type": "VARCHAR(16)",
                "optionName": "_col_gender",
            },
            "aggregate": "COUNT_DISTINCT",
            "label": "COUNT_DISTINCT(gender)",
        }
        _ = ChartDataQueryContextSchema().load(payload)
