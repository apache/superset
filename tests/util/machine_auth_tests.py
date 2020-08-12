from unittest.mock import patch, Mock, call

from superset.extensions import machine_auth_provider_factory
from tests.base_tests import SupersetTestCase


class MachineAuthProviderTests(SupersetTestCase):
    def test_get_auth_cookies(self):
        user = self.get_user("admin")
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)
        self.assertIsNotNone(auth_cookies["session"])

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
