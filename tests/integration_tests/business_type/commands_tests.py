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

from tests.integration_tests.base_tests import SupersetTestCase

from superset.config import cidr_func
from superset.config import port_translation_func
from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterStringOperators


class TestBusinessType(SupersetTestCase):
    resource_name = "business_type"

    def test_cidr_func_valid_IP(self):
        # Test to see if the cidr_func behaves as expected when a valid IP is passed in
        cidrRequest: BusinessTypeRequest = {
            "business_type": "cidr",
            "values": ['1.1.1.1']
        }
        cidrResponse: BusinessTypeResponse = {
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

        self.assertEqual(cidr_func(cidrRequest), cidrResponse)

    def test_cidr_func_invalid_IP(self):
        # Test to see if the cidr_func behaves as expected when an invalid IP is passed in
        cidrRequest: BusinessTypeRequest = {
            "business_type": "cidr",
            "values": ['abc']
        }
        cidrResponse: BusinessTypeResponse = {
            "values": [],
            "error_message": "'abc' does not appear to be an IPv4 or IPv6 network",
            "display_value": "",
            "valid_filter_operators": [
                FilterStringOperators.EQUALS,
                FilterStringOperators.GREATER_THAN_OR_EQUAL,
                FilterStringOperators.GREATER_THAN,
                FilterStringOperators.IN,
                FilterStringOperators.LESS_THAN,
                FilterStringOperators.LESS_THAN_OR_EQUAL,
            ],
        }

        self.assertEqual(cidr_func(cidrRequest), cidrResponse)

    def test_port_translation_func_valid_port(self):
        # Test to see if the port_translation_func behaves as expected when a valid port is passed in
        portRequest: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['https']
        }
        portResponse: BusinessTypeResponse = {
            "values": [[443]],
            "error_message": "",
            "display_value": "[443]",
            "valid_filter_operators": [
                FilterStringOperators.EQUALS,
                FilterStringOperators.GREATER_THAN_OR_EQUAL,
                FilterStringOperators.GREATER_THAN,
                FilterStringOperators.IN,
                FilterStringOperators.LESS_THAN,
                FilterStringOperators.LESS_THAN_OR_EQUAL,
            ],
        }

        self.assertEqual(port_translation_func(portRequest), portResponse)

    def test_port_translation_func_invalid_port_name(self):
        # Test to see if the port_translation_func behaves as expected when an ivalid port name is passed in
        portRequest: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['abc']
        }
        portResponse: BusinessTypeResponse = {
            "values": [],
            "error_message": "'abc' does not appear to be a port name or number",
            "display_value": "",
            "valid_filter_operators": [
                FilterStringOperators.EQUALS,
                FilterStringOperators.GREATER_THAN_OR_EQUAL,
                FilterStringOperators.GREATER_THAN,
                FilterStringOperators.IN,
                FilterStringOperators.LESS_THAN,
                FilterStringOperators.LESS_THAN_OR_EQUAL,
            ],
        }

        self.assertEqual(port_translation_func(portRequest), portResponse)
        #I don't think we can test for the exception being raised as the function does not return the exception
        #Instead, we might only be able to test the response to make sure it behaves as if the 
        #exception was raised (i.e., what we are currently doing)
        #self.assertRaises(KeyError, port_translation_func, portRequest)

    def test_port_translation_func_invalid_port_number(self):
        # Test to see if the port_translation_func behaves as expected when an ivalid port number is passed in
        portRequest: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['123456789']
        }
        portResponse: BusinessTypeResponse = {
            "values": [],
            "error_message": "'123456789' does not appear to be a port name or number",
            "display_value": "",
            "valid_filter_operators": [
                FilterStringOperators.EQUALS,
                FilterStringOperators.GREATER_THAN_OR_EQUAL,
                FilterStringOperators.GREATER_THAN,
                FilterStringOperators.IN,
                FilterStringOperators.LESS_THAN,
                FilterStringOperators.LESS_THAN_OR_EQUAL,
            ],
        }

        self.assertEqual(port_translation_func(portRequest), portResponse)