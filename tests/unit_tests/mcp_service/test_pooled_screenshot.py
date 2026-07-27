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

from superset.mcp_service.screenshot.pooled_screenshot import PooledBaseScreenshot


@patch("superset.mcp_service.screenshot.pooled_screenshot.retry_screenshot_operation")
def test_get_screenshot_accepts_base_log_context(
    mock_retry_screenshot_operation: MagicMock,
) -> None:
    screenshot = PooledBaseScreenshot("http://example.com", "digest")
    user = MagicMock()

    screenshot.get_screenshot(user, log_context="cache_key=abc")

    mock_retry_screenshot_operation.assert_called_once_with(
        screenshot._get_screenshot_internal,  # pylint: disable=protected-access
        user,
        None,
    )
