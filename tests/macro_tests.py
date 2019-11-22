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
from flask import json

from superset import app, jinja_context
from tests.base_tests import SupersetTestCase


class MacroTestCase(SupersetTestCase):
    def test_filter_values_macro(self):
        form_data1 = {
            "extra_filters": [{"col": "my_special_filter", "op": "in", "val": ["foo"]}],
            "filters": [{"col": "my_special_filter2", "op": "in", "val": ["bar"]}],
        }

        form_data2 = {
            "extra_filters": [
                {"col": "my_special_filter", "op": "in", "val": ["foo", "bar"]}
            ]
        }

        form_data3 = {
            "extra_filters": [
                {"col": "my_special_filter", "op": "in", "val": ["foo", "bar"]}
            ],
            "filters": [{"col": "my_special_filter", "op": "in", "val": ["savage"]}],
        }

        form_data4 = {
            "extra_filters": [{"col": "my_special_filter", "op": "in", "val": "foo"}],
            "filters": [{"col": "my_special_filter", "op": "in", "val": "savage"}],
        }

        data1 = {"form_data": json.dumps(form_data1)}
        data2 = {"form_data": json.dumps(form_data2)}
        data3 = {"form_data": json.dumps(form_data3)}
        data4 = {"form_data": json.dumps(form_data4)}

        with app.test_request_context(data=data1):
            filter_values = jinja_context.filter_values("my_special_filter")
            self.assertEqual(filter_values, ["foo"])

            filter_values = jinja_context.filter_values("my_special_filter2")
            self.assertEqual(filter_values, ["bar"])

            filter_values = jinja_context.filter_values("")
            self.assertEqual(filter_values, [])

        with app.test_request_context(data=data2):
            filter_values = jinja_context.filter_values("my_special_filter")
            self.assertEqual(filter_values, ["foo", "bar"])

        with app.test_request_context(data=data3):
            filter_values = jinja_context.filter_values("my_special_filter")
            self.assertEqual(filter_values, ["savage", "foo", "bar"])

        with app.test_request_context():
            filter_values = jinja_context.filter_values("nonexistent_filter", "foo")
            self.assertEqual(filter_values, ["foo"])

        with app.test_request_context(data=data4):
            filter_values = jinja_context.filter_values("my_special_filter")
            self.assertEqual(filter_values, ["savage", "foo"])
