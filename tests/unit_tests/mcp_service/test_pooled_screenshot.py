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

import pytest

from superset.mcp_service.screenshot.pooled_screenshot import PooledBaseScreenshot


def test_get_screenshot_raises_when_playwright_unavailable() -> None:
    """get_screenshot raises RuntimeError when Playwright is unavailable."""
    screenshot = PooledBaseScreenshot("http://example.com", "digest")
    user = MagicMock()

    with patch("superset.mcp_service.screenshot.pooled_screenshot.super") as mock_super:
        mock_super_instance = MagicMock()
        mock_super.return_value = mock_super_instance
        mock_super_instance.get_screenshot.side_effect = RuntimeError(
            "Playwright is required"
        )
        with pytest.raises(RuntimeError, match="Playwright is required"):
            screenshot.get_screenshot(user, log_context="cache_key=abc")
