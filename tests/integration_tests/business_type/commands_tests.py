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
from sqlalchemy import Column, Integer
from tests.integration_tests.base_tests import SupersetTestCase
from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterOperator, FilterStringOperators

from superset.config import cidr_func
from superset.config import port_translation_func
from superset.config import cidr_translate_filter_func
from superset.config import port_translate_filter_func


class TestBusinessType(SupersetTestCase):
    """This class includes all of the unit tests for the business type functions"""

    def test_cidr_func_valid_ip(self):
        """Test to see if the cidr_func behaves as expected when a valid IP is passed in"""
        cidr_request: BusinessTypeRequest = {
            "business_type": "cidr",
            "values": ['1.1.1.1']
        }
        cidr_response: BusinessTypeResponse = {
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

        self.assertEqual(cidr_func(cidr_request), cidr_response)

    def test_cidr_func_invalid_ip(self):
        """Test to see if the cidr_func behaves as expected when an invalid IP is passed in"""
        cidr_request: BusinessTypeRequest = {
            "business_type": "cidr",
            "values": ['abc']
        }
        cidr_response: BusinessTypeResponse = {
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

        self.assertEqual(cidr_func(cidr_request), cidr_response)

    def test_port_translation_func_valid_port_number(self):
        """Test to see if the port_translation_func behaves as
        expected when a valid port number is passed in"""
        port_request: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['80']
        }
        port_response: BusinessTypeResponse = {
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

        self.assertEqual(port_translation_func(port_request), port_response)

    def test_port_translation_func_valid_port_name(self):
        """Test to see if the port_translation_func behaves as expected
        when a valid port name is passed in"""
        port_request: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['https']
        }
        port_response: BusinessTypeResponse = {
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

        self.assertEqual(port_translation_func(port_request), port_response)

    def test_port_translation_func_invalid_port_name(self):
        """Test to see if the port_translation_func behaves as expected when an
         invalid port name is passed in"""
        port_request: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['abc']
        }
        port_response: BusinessTypeResponse = {
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

        self.assertEqual(port_translation_func(port_request), port_response)

    def test_port_translation_func_invalid_port_number(self):
        """Test to see if the port_translation_func behaves as expected when
        an invalid port number is passed in"""
        port_request: BusinessTypeRequest = {
            "business_type": "port",
            "values": ['123456789']
        }
        port_response: BusinessTypeResponse = {
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

        self.assertEqual(port_translation_func(port_request), port_response)

    def test_cidr_translate_filter_func_equals(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the EQUALS
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.EQUALS
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column == input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_not_equals(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the NOT_EQUALS
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_EQUALS
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column != input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_greater_than_or_equals(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the
        GREATER_THAN_OR_EQUALS operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.GREATER_THAN_OR_EQUALS
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column >= input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_greater_than(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the
        GREATER_THAN operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.GREATER_THAN
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column > input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_less_than(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the LESS_THAN
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.LESS_THAN
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column < input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_less_than_or_equals(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the
        LESS_THAN_OR_EQUALS operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.LESS_THAN_OR_EQUALS
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column <= input_values[0])

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_in_single(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the IN operator
        is used with a single IP"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.IN
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column.in_(input_values))

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_in_double(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the IN operator
        is used with two IP's"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.IN
        input_values = [{'start': 16843009, 'end': 33686018}]

        input_condition = input_column.in_([])

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_condition | ((input_column <= 33686018) & (input_column >= 16843009)))

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_not_in_single(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the NOT_IN
        operator is used with a single IP"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_IN
        input_values = [16843009]

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = ~(
            input_column.in_(input_values))

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_cidr_translate_filter_func_not_in_double(self):
        """Test to see if the cidr_translate_filter_func behaves as expected when the NOT_IN
        operator is used with two IP's"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_IN
        input_values = [{'start': 16843009, 'end': 33686018}]

        input_condition = ~(input_column.in_([]))

        cidr_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_condition & (input_column > 33686018) & (input_column < 16843009))

        self.assertTrue(cidr_translate_filter_func(
            input_column, input_operation, input_values).compare(cidr_translate_filter_response))

    def test_port_translate_filter_func_equals(self):
        """Test to see if the port_translate_filter_func behaves as expected when the EQUALS
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.EQUALS
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_not_equals(self):
        """Test to see if the port_translate_filter_func behaves as expected when the NOT_EQUALS
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_EQUALS
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = ~(
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_greater_than_or_equals(self):
        """Test to see if the port_translate_filter_func behaves as expected when the
        GREATER_THAN_OR_EQUALS operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.GREATER_THAN_OR_EQUALS
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column >= input_values[0][0])

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_greater_than(self):
        """Test to see if the port_translate_filter_func behaves as expected when the
        GREATER_THAN operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.GREATER_THAN
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column > input_values[0][0])

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_less_than_or_equals(self):
        """Test to see if the port_translate_filter_func behaves as expected when the
        LESS_THAN_OR_EQUALS operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.LESS_THAN_OR_EQUALS
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column <= input_values[0][0])

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_less_than(self):
        """Test to see if the port_translate_filter_func behaves as expected when the LESS_THAN
        operator is used"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.LESS_THAN
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column < input_values[0][0])

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_in_single(self):
        """Test to see if the port_translate_filter_func behaves as expected when the IN operator
        is used with a single port"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.IN
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_in_double(self):
        """Test to see if the port_translate_filter_func behaves as expected when the IN operator
        is used with two ports"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.IN
        input_values = [[443, 80]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = (
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_not_in_single(self):
        """Test to see if the port_translate_filter_func behaves as expected when the NOT_IN
        operator is used with a single port"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_IN
        input_values = [[443]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = ~(
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))

    def test_port_translate_filter_func_not_in_double(self):
        """Test to see if the port_translate_filter_func behaves as expected when the NOT_IN
        operator is used with two ports"""

        input_column = Column('user_ip', Integer)
        input_operation = FilterOperator.NOT_IN
        input_values = [[443, 80]]

        port_translate_filter_response: sqlalchemy.sql.expression.BinaryExpression = ~(
            input_column.in_(input_values[0]))

        self.assertTrue(port_translate_filter_func(
            input_column, input_operation, input_values).compare(port_translate_filter_response))
