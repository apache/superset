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

import sqlalchemy
from tests.integration_tests.base_tests import SupersetTestCase

from superset.config import cidr_func
from superset.config import port_translation_func
from superset.config import cidr_translate_filter_func
from superset.config import port_translate_filter_func
from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterOperator, FilterStringOperators
from sqlalchemy import Column, Integer

import logging

logger = logging.getLogger(__name__)


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

    def test_port_translation_func_valid_port_number(self):
        # Test to see if the port_translation_func behaves as expected when a valid port number is passed in
        portRequest: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['80']
        }
        portResponse: BusinessTypeResponse = {
            "values": [[80]],
            "error_message": "",
            "display_value": "[80]",
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

    def test_port_translation_func_valid_port_name(self):
        # Test to see if the port_translation_func behaves as expected when a valid port name is passed in
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
        # Test to see if the port_translation_func behaves as expected when an invalid port name is passed in
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

    def test_port_translation_func_invalid_port_number(self):
        # Test to see if the port_translation_func behaves as expected when an invalid port number is passed in
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

    def test_cidr_translate_filter_func_EQUALS(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.EQUALS
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn == inputValues[0])

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_NOT_EQUALS(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the NOT_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_EQUALS
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn != inputValues[0])

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_GREATER_THAN_OR_EQUALS(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the GREATER_THAN_OR_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.GREATER_THAN_OR_EQUALS
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn >= inputValues[0])

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_GREATER_THAN(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the GREATER_THAN operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.GREATER_THAN
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn > inputValues[0])
        
        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_LESS_THAN(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the LESS_THAN operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.LESS_THAN
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn < inputValues[0])
        
        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_LESS_THAN_OR_EQUALS(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the LESS_THAN_OR_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.LESS_THAN_OR_EQUALS
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn <= inputValues[0])
        
        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_IN_single(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the IN operator is used with a single IP
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.IN
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn.in_(inputValues))

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_IN_double(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the IN operator is used with two IP's
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.IN
        inputValues = [{'start': 16843009, 'end': 33686018}]

        inputCondition = inputColumn.in_([])

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputCondition | ((inputColumn <= 33686018) & (inputColumn >= 16843009)))

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_NOT_IN_single(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the NOT_IN operator is used with a single IP
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_IN
        inputValues = [16843009]

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = ~(inputColumn.in_(inputValues))

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_cidr_translate_filter_func_NOT_IN_double(self):
        # Test to see if the cidr_translate_filter_func behaves as expected when the NOT_IN operator is used with two IP's
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_IN
        inputValues = [{'start': 16843009, 'end': 33686018}]

        inputCondition = ~(inputColumn.in_([]))

        cidrTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputCondition & ((inputColumn > 33686018) & (inputColumn < 16843009)))

        self.assertTrue(cidr_translate_filter_func(inputColumn, inputOperation, inputValues).compare(cidrTranslateFilterResponse))

    def test_port_translate_filter_func_EQUALS(self):
        # Test to see if the port_translate_filter_func behaves as expected when the EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.EQUALS
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_NOT_EQUALS(self):
        # Test to see if the port_translate_filter_func behaves as expected when the NOT_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_EQUALS
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = ~(inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_GREATER_THAN_OR_EQUALS(self):
        # Test to see if the port_translate_filter_func behaves as expected when the GREATER_THAN_OR_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.GREATER_THAN_OR_EQUALS
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn >= inputValues[0][0])

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_GREATER_THAN(self):
        # Test to see if the port_translate_filter_func behaves as expected when the GREATER_THAN operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.GREATER_THAN
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn > inputValues[0][0])

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_LESS_THAN_OR_EQUALS(self):
        # Test to see if the port_translate_filter_func behaves as expected when the LESS_THAN_OR_EQUALS operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.LESS_THAN_OR_EQUALS
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn <= inputValues[0][0])

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_LESS_THAN(self):
        # Test to see if the port_translate_filter_func behaves as expected when the LESS_THAN operator is used
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.LESS_THAN
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn < inputValues[0][0])

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_IN_single(self):
        # Test to see if the port_translate_filter_func behaves as expected when the IN operator is used with a single port
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.IN
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_IN_double(self):
        # Test to see if the port_translate_filter_func behaves as expected when the IN operator is used with two ports
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.IN
        inputValues = [[443, 80]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = (inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_NOT_IN_single(self):
        # Test to see if the port_translate_filter_func behaves as expected when the NOT_IN operator is used with a single port
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_IN
        inputValues = [[443]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = ~(inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))

    def test_port_translate_filter_func_NOT_IN_double(self):
        # Test to see if the port_translate_filter_func behaves as expected when the NOT_IN operator is used with two ports
        
        inputColumn = Column('user_ip', Integer)
        inputOperation = FilterOperator.NOT_IN
        inputValues = [[443, 80]]

        portTranslateFilterResponse: sqlalchemy.sql.expression.BinaryExpression = ~(inputColumn.in_(inputValues[0]))

        self.assertTrue(port_translate_filter_func(inputColumn, inputOperation, inputValues).compare(portTranslateFilterResponse))