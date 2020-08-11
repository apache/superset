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
