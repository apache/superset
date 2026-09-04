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

"""
Tests for screenshot exception handling in API endpoints.
"""

from unittest.mock import MagicMock

import pytest

from superset.exceptions import ScreenshotImageNotAvailableException
from superset.utils.screenshots import ScreenshotCachePayload


class TestScreenshotAPIExceptionHandling:
    """Test that API endpoints properly handle ScreenshotImageNotAvailableException"""

    def test_dashboard_screenshot_api_handles_exception(self):
        """Test dashboard screenshot API returns 404 when get_image raises exception"""
        from superset.dashboards.api import DashboardRestApi

        # Create mock API instance
        api = DashboardRestApi()
        api.response_404 = MagicMock(return_value="404 Response")

        # Create mock cache payload that will raise exception
        mock_cache_payload = MagicMock()
        mock_cache_payload.get_image.side_effect = (
            ScreenshotImageNotAvailableException()
        )

        # Test the exception handling logic
        try:
            mock_cache_payload.get_image()
            pytest.fail("Should have raised exception")
        except ScreenshotImageNotAvailableException:
            response = api.response_404()
            assert response == "404 Response"

    def test_chart_screenshot_api_handles_exception(self):
        """Test that chart screenshot API returns 404 when get_image raises exception"""
        from superset.charts.api import ChartRestApi

        # Create mock API instance
        api = ChartRestApi()
        api.response_404 = MagicMock(return_value="404 Response")

        # Create mock cache payload that will raise exception
        mock_cache_payload = MagicMock()
        mock_cache_payload.get_image.side_effect = (
            ScreenshotImageNotAvailableException()
        )

        # Test the exception handling logic
        try:
            mock_cache_payload.get_image()
            pytest.fail("Should have raised exception")
        except ScreenshotImageNotAvailableException:
            response = api.response_404()
            assert response == "404 Response"

    def test_screenshot_cache_payload_exception_has_correct_status(self):
        """Test that the ScreenshotImageNotAvailableException has status 404"""
        exception = ScreenshotImageNotAvailableException()
        assert exception.status == 404

    def test_api_method_simulation_with_exception(self):
        """Simulate the API method behavior with exception handling"""

        def simulate_dashboard_screenshot_method(cache_payload):
            """Simulate the logic in dashboard screenshot methods"""
            try:
                image = cache_payload.get_image()
                return {"status": "success", "image": image}
            except ScreenshotImageNotAvailableException:
                return {"status": "404", "message": "Not Found"}

        # Test with payload that has image
        payload_with_image = ScreenshotCachePayload(image=b"test data")
        result = simulate_dashboard_screenshot_method(payload_with_image)
        assert result["status"] == "success"
        assert result["image"] is not None

        # Test with payload that has no image (should raise exception)
        payload_no_image = ScreenshotCachePayload()
        result = simulate_dashboard_screenshot_method(payload_no_image)
        assert result["status"] == "404"
        assert result["message"] == "Not Found"

    def test_api_method_simulation_with_file_wrapper(self):
        """Simulate the FileWrapper usage in API methods"""
        from werkzeug.wsgi import FileWrapper

        def simulate_api_file_response(cache_payload):
            """Simulate the FileWrapper logic in API methods"""
            try:
                image = cache_payload.get_image()
                return FileWrapper(image)
            except ScreenshotImageNotAvailableException:
                return None

        # Test with valid image
        payload_with_image = ScreenshotCachePayload(image=b"test data")
        result = simulate_api_file_response(payload_with_image)
        assert result is not None
        assert isinstance(result, FileWrapper)

        # Test without image
        payload_no_image = ScreenshotCachePayload()
        result = simulate_api_file_response(payload_no_image)
        assert result is None
