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

from unittest.mock import MagicMock, patch

from superset.extensions import machine_auth_provider_factory
from superset.utils.machine_auth import MachineAuthProvider
from tests.integration_tests.base_tests import SupersetTestCase


class MachineAuthProviderTests(SupersetTestCase):
    def test_get_auth_cookies(self):
        user = self.get_user("admin")
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)
        assert auth_cookies["session"] is not None

    def test_authenticate_browser_context_sets_cookies(self):
        """authenticate_browser_context navigates to login and sets auth cookies."""
        user = self.get_user("admin")
        provider = machine_auth_provider_factory.instance

        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_context.new_page.return_value = mock_page

        with patch.object(provider, "get_cookies", return_value={"session": "abc123"}):
            result = provider.authenticate_browser_context(mock_context, user)

        assert result is mock_context
        mock_page.goto.assert_called_once()
        mock_context.clear_cookies.assert_called_once()
        mock_context.add_cookies.assert_called_once()
        cookies_added = mock_context.add_cookies.call_args[0][0]
        assert any(
            c["name"] == "session" and c["value"] == "abc123" for c in cookies_added
        )

    def test_authenticate_browser_context_uses_override(self):
        """authenticate_browser_context calls the override func when configured."""
        user = MagicMock()
        mock_context = MagicMock()
        mock_override = MagicMock(return_value=mock_context)

        provider = MachineAuthProvider(auth_webdriver_func_override=mock_override)
        result = provider.authenticate_browser_context(mock_context, user)

        mock_override.assert_called_once_with(mock_context, user)
        assert result is mock_context
