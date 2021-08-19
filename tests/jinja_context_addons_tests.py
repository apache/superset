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
from ipaddress import NetmaskValueError, AddressValueError
from jinja_context_addons import *
# Imports Jinja Context Addons from PYTHONPATH env variable, make sure to point the env var to the dir containing it

from tests.base_tests import SupersetTestCase

class Jinja2ContextAddonsTest(SupersetTestCase):
    maxDiff = None

    # Test for Correctness

    def test_ipv4str_to_number_template(self) -> None:
        rendered = ipv4str_to_number('192.168.0.0')
        self.assertEqual(3232235520, rendered)

    def test_render_ipv4_column_template(self) -> None:
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "==",
                "val": "1.1.1.1"
            },
            {
                "col": "src_ip_num",
                "op": "IN",
                "val": ['3.3.3.3', '2.2.2.2']
            }
        ]
        rendered = render_ipv4_number_column(test_filter, "src_num_ip")
        self.assertEqual(" AND (src_num_ip = 16843009) AND ((src_num_ip = 50529027) OR (src_num_ip = 33686018))", rendered)

    def test_render_ipv4_either_number_columns_template(self) -> None:
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "==",
                "val": ['3.0.0.0/8', '2.2.2.2']
            }
        ]
        rendered = render_ipv4_either_number_columns(test_filter, "src_num_ip", "dst_num_ip")
        self.assertEqual(" AND ((src_num_ip >= 50331648 AND src_num_ip <= 67108863) OR (src_num_ip = 33686018) OR (dst_num_ip >= 50331648 AND dst_num_ip <= 67108863) OR (dst_num_ip = 33686018))", rendered)


    def test_render_ipv4_between_number_colums_template(self) -> None:
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "LIKE",
                "val": ['12.0.0.0/8', '2.0.0.0/16']
            }
        ]
        rendered = render_ipv4_between_number_colums(test_filter, '1.1.1.1', '2.2.2.2' )
        self.assertEqual(
            ''' AND (( (1.1.1.1 <= 201326592 AND 2.2.2.2 >= 201326592)
                    OR (1.1.1.1 <= 218103807 AND 2.2.2.2 >= 218103807)
                    OR (201326592 <= 1.1.1.1 AND 2.2.2.2 <= 218103807) ) OR ( (1.1.1.1 <= 33554432 AND 2.2.2.2 >= 33554432)
                    OR (1.1.1.1 <= 33619967 AND 2.2.2.2 >= 33619967)
                    OR (33554432 <= 1.1.1.1 AND 2.2.2.2 <= 33619967) ))'''
        , rendered)


    def test_render_in_conditions_template(self) -> None:
        test_ip_array=['1.1.1.1','240.0.0.0/4']
        rendered = render_in_conditions(test_ip_array, "src_num_ip")
        self.assertEqual(['(src_num_ip = 16843009)', '(src_num_ip >= 4026531840 AND src_num_ip <= 4294967295)'], rendered)

    def test_dashboard_link_template(self) -> None:
        # TODO Update this test once the dashboard function is fully implemented and complete
        test_link_label = "LABEL"
        test_dashboard_id = 2301
        test_src_column = 'test_col'
        test_target_column = 'target_col'

        rendered = dashboard_link(test_link_label, test_dashboard_id, test_src_column, test_target_column)
        self.assertEqual(" concat('<a href=\"http://10.162.232.22:8088/superset/dashboard/2301/?preselect_filters={%22160%22:{%22target_col%22:[%22', target_col, '%22]}}\">LABEL</a>' ) ", rendered)

    #Test for Exceptions

    def test_ipv4str_to_number_template_invalid_ip(self) -> None:
        # Invalid Ip 1912.168.0.0
        self.assertRaises(OSError, ipv4str_to_number, '1912.168.0.0')

    def test_render_ipv4_column_template_exception(self) -> None:
        # The ValueError in this test case comes from the '3.3.3.3/8' CIDR
        # This is because the correct way to describe that range of ip's is to start from 3.0.0.0/8
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "==",
                "val": "1.1.1.1"
            },
            {
                "col": "src_ip_num",
                "op": "IN",
                "val": ['3.3.3.3/8']
            }
        ]
        self.assertRaises(ValueError, render_ipv4_number_column, test_filter, 'src_ip_num' )

    def test_render_ipv4_either_number_columns_template_invalid_cidr(self) -> None:
        # Invalid error cidr comes from 2.2.2.200/34
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "==",
                "val": ['3.0.0.0/8', '2.2.2.200/34']
            }
        ]
        self.assertRaises(NetmaskValueError, render_ipv4_either_number_columns, test_filter, "src_num_ip", "dst_num_ip")

    def test_render_ipv4_between_number_colums_template_invalid_arguments(self) -> None:
        test_filter = [
            {
                "col": "src_ip_num",
                "op": "2",
                "val": ['255.255.255.255/0', '80.0.0.0/16']
            }
        ]
        self.assertRaises(ValueError, render_ipv4_between_number_colums, test_filter, '1.1.1.1', '2.2.2.2')

    def test_render_in_conditions_template_invalid_cidr(self) -> None:
        test_ip_array=['1.10.0.1.1','240.0.0.0/4.0']
        self.assertRaises(AddressValueError, render_in_conditions, test_ip_array, "src_num_ip")

    def test_dashboard_link_template_invalid_label_type(self) -> None:
        # TODO Update this test once the dashboard function is fully implemented and complete
        test_link_label = 123
        test_dashboard_id = -100
        test_src_column = 'test_col'
        test_target_column = 'target_col'
        self.assertRaises(TypeError, dashboard_link, test_link_label, test_dashboard_id, test_src_column, test_target_column)
