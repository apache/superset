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
import json

import tests.test_app
from superset import app
from superset.jinja_context import ExtraCache, filter_values
from tests.base_tests import SupersetTestCase


class Jinja2ContextTests(SupersetTestCase):
    def test_filter_values_default(self) -> None:
        with app.test_request_context():
            self.assertEquals(filter_values("name", "foo"), ["foo"])

    def test_filter_values_no_default(self) -> None:
        with app.test_request_context():
            self.assertEquals(filter_values("name"), [])

    def test_filter_values_adhoc_filters(self) -> None:
        with app.test_request_context(
            data={
                "form_data": json.dumps(
                    {
                        "adhoc_filters": [
                            {
                                "clause": "WHERE",
                                "comparator": "foo",
                                "expressionType": "SIMPLE",
                                "operator": "in",
                                "subject": "name",
                            }
                        ],
                    }
                )
            }
        ):
            self.assertEquals(filter_values("name"), ["foo"])

        with app.test_request_context(
            data={
                "form_data": json.dumps(
                    {
                        "adhoc_filters": [
                            {
                                "clause": "WHERE",
                                "comparator": ["foo", "bar"],
                                "expressionType": "SIMPLE",
                                "operator": "in",
                                "subject": "name",
                            }
                        ],
                    }
                )
            }
        ):
            self.assertEquals(filter_values("name"), ["foo", "bar"])

    def test_filter_values_extra_filters(self) -> None:
        with app.test_request_context(
            data={
                "form_data": json.dumps(
                    {"extra_filters": [{"col": "name", "op": "in", "val": "foo"}]}
                )
            }
        ):
            self.assertEquals(filter_values("name"), ["foo"])

    def test_url_param_default(self) -> None:
        with app.test_request_context():
            self.assertEquals(ExtraCache().url_param("foo", "bar"), "bar")

    def test_url_param_no_default(self) -> None:
        with app.test_request_context():
            self.assertEquals(ExtraCache().url_param("foo"), None)

    def test_url_param_query(self) -> None:
        with app.test_request_context(query_string={"foo": "bar"}):
            self.assertEquals(ExtraCache().url_param("foo"), "bar")

    def test_url_param_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "bar"}})}
        ):
            self.assertEquals(ExtraCache().url_param("foo"), "bar")
