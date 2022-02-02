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

import json

from tests.integration_tests.base_tests import SupersetTestCase
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterStringOperators

class TestBusinessTypeApi(SupersetTestCase):
    """This class includes the unit tests for the business type REST API"""
    # To run the unit tests below, use the following command in the root Superset folder:
    # scripts/tests/run.sh --module tests/integration_tests/business_type/api_tests.py

    def test_get_business_type(self):
        """
        business_type API: Test 'get', expect to get a BusinessTypeResponse
        """

        self.login(username="admin")
        uri = f"/api/v1/business_type/convert?q=(type:cidr,values:!('1.1.1.1'))"
        http_response = self.get_assert_metric(uri, "get")
        response = json.loads(http_response.data.decode("utf-8"))

        expected_response: BusinessTypeResponse = {
            "values": [16843009],
            "error_message": "",
            "display_value": "16843009",
            "valid_filter_operators": [
                FilterStringOperators.EQUALS,
                FilterStringOperators.GREATER_THAN_OR_EQUAL,
                FilterStringOperators.GREATER_THAN,
                FilterStringOperators.IN,
                FilterStringOperators.LESS_THAN,
                FilterStringOperators.LESS_THAN_OR_EQUAL,
            ],
        }

        self.assertEqual(http_response.status_code, 200)
        self.assertEqual(response, expected_response)

    def test_get_types_business_type(self):
        """
        business_type API: Test 'get_types', expect to get a list of the availiable business types
        """

        self.login(username="admin")
        uri = f"/api/v1/business_type/types"
        http_response = self.get_assert_metric(uri, "get_types")
        data = json.loads(http_response.data.decode("utf-8"))

        self.assertEqual(http_response.status_code, 200)
        self.assertEqual(data, ['cidr', 'port'])