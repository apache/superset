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

from unittest.mock import call, Mock, patch

from superset.extensions import machine_auth_provider_factory
from tests.integration_tests.base_tests import SupersetTestCase


class MachineAuthProviderTests(SupersetTestCase):
    def test_get_auth_cookies(self):
        user = self.get_user("admin")
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)
        assert auth_cookies["session"] is not None

    @patch("superset.utils.machine_auth.MachineAuthProvider.get_auth_cookies")
    def test_auth_driver_user(self, get_auth_cookies):
        user = self.get_user("admin")
        driver = Mock()
        get_auth_cookies.return_value = {
            "session": "session_val",
            "other_cookie": "other_val",
        }
        machine_auth_provider_factory.instance.authenticate_webdriver(driver, user)
        driver.add_cookie.assert_has_calls(
            [
                call({"name": "session", "value": "session_val"}),
                call({"name": "other_cookie", "value": "other_val"}),
            ]
        )

    @patch("superset.utils.machine_auth.request")
    def test_auth_driver_request(self, request):
        driver = Mock()
        request.cookies = {"session": "session_val", "other_cookie": "other_val"}
        machine_auth_provider_factory.instance.authenticate_webdriver(driver, None)
        driver.add_cookie.assert_has_calls(
            [
                call({"name": "session", "value": "session_val"}),
                call({"name": "other_cookie", "value": "other_val"}),
            ]
        )
