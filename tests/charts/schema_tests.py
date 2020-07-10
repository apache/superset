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
from typing import Any, Dict, Tuple

from marshmallow import ValidationError
from tests.test_app import app
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.query_context import QueryContext
from tests.base_tests import SupersetTestCase
from tests.fixtures.query_context import get_query_context


def load_query_context(payload: Dict[str, Any]) -> Tuple[QueryContext, Dict[str, Any]]:
    return ChartDataQueryContextSchema().load(payload)


class TestSchema(SupersetTestCase):
    def test_query_context_limit_and_offset(self):
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)

        # Use defaults
        payload["queries"][0].pop("row_limit", None)
        payload["queries"][0].pop("row_offset", None)
        query_context = load_query_context(payload)
        query_object = query_context.queries[0]
        self.assertEqual(query_object.row_limit, app.config["ROW_LIMIT"])
        self.assertEqual(query_object.row_offset, 0)

        # Valid limit and offset
        payload["queries"][0]["row_limit"] = 100
        payload["queries"][0]["row_offset"] = 200
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        self.assertEqual(query_object.row_limit, 100)
        self.assertEqual(query_object.row_offset, 200)

        # too low limit and offset
        payload["queries"][0]["row_limit"] = 0
        payload["queries"][0]["row_offset"] = -1
        with self.assertRaises(ValidationError) as context:
            _ = ChartDataQueryContextSchema().load(payload)
        self.assertIn("row_limit", context.exception.messages["queries"][0])
        self.assertIn("row_offset", context.exception.messages["queries"][0])

    def test_query_context_null_timegrain(self):
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)

        payload["queries"][0]["extras"]["time_grain_sqla"] = None
        _ = ChartDataQueryContextSchema().load(payload)

    def test_query_context_null_post_processing_op(self):
        self.login(username="admin")
        table_name = "birth_names"
        table = self.get_table_by_name(table_name)
        payload = get_query_context(table.name, table.id, table.type)

        payload["queries"][0]["post_processing"] = [None]
        query_context = ChartDataQueryContextSchema().load(payload)
        self.assertEqual(query_context.queries[0].post_processing, [])
