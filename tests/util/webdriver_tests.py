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

from unittest.mock import patch, Mock

from superset.utils.webdriver import WebDriverProxy
from tests.base_tests import SupersetTestCase


class WebdriverTests(SupersetTestCase):
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.utils.webdriver.get_auth_cookies")
    def test_auth_cookies_override(self, get_auth_cookies, driver_class):
        # First, don't override at all
        driver = WebDriverProxy("firefox")
        driver.auth(self.get_user("admin"))
        get_auth_cookies.assert_called_once()

        # Next, pass in an override
        get_auth_cookies.reset_mock()
        get_cookies_func = Mock()
        get_cookies_func.return_value = []
        driver = WebDriverProxy("firefox", get_cookies_func=get_cookies_func)
        driver.auth(self.get_user("admin"))
        get_auth_cookies.assert_not_called()
        get_cookies_func.asset_called_once()

        # Lastly, override config
        get_auth_cookies.reset_mock()
        get_cookies_func = Mock()
        get_cookies_func.return_value = []
        self.app.config["WEBDRIVER_AUTH_COOKIES_FUNC"] = get_cookies_func
        driver = WebDriverProxy("firefox")
        driver.auth(self.get_user("admin"))
        get_auth_cookies.assert_not_called()
        get_cookies_func.asset_called_once()

    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.utils.webdriver.auth_driver")
    def test_driver_auth_override(self, auth_func_orig, driver_class):
        # First, don't override at all
        driver = WebDriverProxy("firefox")
        driver.auth(self.get_user("admin"))
        auth_func_orig.assert_called_once()

        # Next, pass in an override
        auth_func_orig.reset_mock()
        auth_func = Mock()
        driver = WebDriverProxy("firefox", auth_func=auth_func)
        driver.auth(self.get_user("admin"))
        auth_func_orig.assert_not_called()
        auth_func.asset_called_once()

        # Lastly, override config
        auth_func_orig.reset_mock()
        auth_func = Mock()
        self.app.config["WEBDRIVER_AUTH_FUNC"] = auth_func
        driver = WebDriverProxy("firefox")
        driver.auth(self.get_user("admin"))
        auth_func_orig.assert_not_called()
        auth_func.asset_called_once()
