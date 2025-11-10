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

import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from superset.utils.screenshot_utils import (
    combine_screenshot_tiles,
    SCROLL_SETTLE_TIMEOUT_MS,
    take_tiled_screenshot,
)


class TestCombineScreenshotTiles:
    def _create_test_image(self, width: int, height: int, color: str = "red") -> bytes:
        """Helper to create test PNG image bytes."""
        img = Image.new("RGB", (width, height), color)
        output = io.BytesIO()
        img.save(output, format="PNG")
        return output.getvalue()

    def test_empty_tiles_returns_empty_bytes(self):
        """Test that empty tiles list returns empty bytes."""
        result = combine_screenshot_tiles([])
        assert result == b""

    def test_single_tile_returns_original(self):
        """Test that single tile returns the original image."""
        test_image = self._create_test_image(100, 100)
        result = combine_screenshot_tiles([test_image])
        assert result == test_image

    def test_combine_multiple_tiles_vertically(self):
        """Test combining multiple tiles into a single vertical image."""
        # Create test images with different colors
        tile1 = self._create_test_image(100, 50, "red")
        tile2 = self._create_test_image(100, 75, "green")
        tile3 = self._create_test_image(100, 25, "blue")

        result = combine_screenshot_tiles([tile1, tile2, tile3])

        # Verify result is not empty
        assert result != b""

        # Verify the combined image has correct dimensions
        combined_img = Image.open(io.BytesIO(result))
        assert combined_img.width == 100  # Max width of all tiles
        assert combined_img.height == 150  # Sum of all heights (50 + 75 + 25)

        # Verify the image format is PNG
        assert combined_img.format == "PNG"

    def test_combine_tiles_different_widths(self):
        """Test combining tiles with different widths uses max width."""
        tile1 = self._create_test_image(50, 100, "red")
        tile2 = self._create_test_image(150, 100, "green")
        tile3 = self._create_test_image(100, 100, "blue")

        result = combine_screenshot_tiles([tile1, tile2, tile3])

        combined_img = Image.open(io.BytesIO(result))
        assert combined_img.width == 150  # Max width
        assert combined_img.height == 300  # Sum of heights

    def test_combine_tiles_handles_pil_error(self):
        """Test that PIL errors are handled gracefully."""
        # Create one valid image and one invalid
        valid_tile = self._create_test_image(100, 100)
        invalid_tile = b"invalid_image_data"

        result = combine_screenshot_tiles([valid_tile, invalid_tile])

        # Should return the first (valid) tile as fallback
        assert result == valid_tile

    def test_combine_tiles_logs_exception(self):
        """Test that exceptions are logged properly."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            # Create invalid image data that will cause PIL to raise an exception
            invalid_tile = b"definitely_not_an_image"
            valid_tile = self._create_test_image(100, 100)

            result = combine_screenshot_tiles([valid_tile, invalid_tile])

            # Should have logged the exception
            mock_logger.exception.assert_called_once()
            # Should return first tile as fallback
            assert result == valid_tile


class TestTakeTiledScreenshot:
    @pytest.fixture
    def mock_page(self):
        """Create a mock Playwright page object."""
        page = MagicMock()

        # Mock element locator
        element = MagicMock()
        page.locator.return_value = element

        # Mock element info - simulating a 5000px tall dashboard at position 100
        element_info = {"height": 5000, "top": 100, "left": 50, "width": 800}

        # Only one evaluate call needed for dashboard dimensions
        page.evaluate.return_value = element_info

        # Mock screenshot method
        fake_screenshot = b"fake_screenshot_data"
        page.screenshot.return_value = fake_screenshot

        return page

    def test_successful_tiled_screenshot(self, mock_page):
        """Test successful tiled screenshot generation."""
        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined_screenshot"

            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should return combined screenshot
            assert result == b"combined_screenshot"

            # Should have called screenshot method multiple times
            # (3 tiles for 5000px height)
            assert mock_page.screenshot.call_count == 3

            # Should have called combine function
            mock_combine.assert_called_once()

    def test_element_not_found_returns_none(self):
        """Test that missing element returns None."""
        mock_page = MagicMock()
        element = MagicMock()
        element.wait_for.side_effect = Exception("Element not found")
        mock_page.locator.return_value = element

        result = take_tiled_screenshot(mock_page, "nonexistent", tile_height=2000)

        assert result is None

    def test_tile_calculation_logic(self, mock_page):
        """Test that tiles are calculated correctly."""
        # Mock dashboard height of 3500px with viewport of 2000px
        element_info = {"height": 3500, "top": 100, "left": 50, "width": 800}

        # Override the fixture's evaluate return for this test
        mock_page.evaluate.return_value = element_info

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined"

            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should take 2 screenshots (3500px / 2000px = 1.75, rounded up to 2)
            assert mock_page.screenshot.call_count == 2

    def test_logs_dashboard_info(self, mock_page):
        """Test that dashboard info is logged."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

                # Should log dashboard dimensions
                mock_logger.info.assert_any_call("Dashboard: 800x5000px at (50, 100)")
                # Should log number of tiles
                mock_logger.info.assert_any_call("Taking %s screenshot tiles", 3)

    def test_exception_handling_returns_none(self):
        """Test that exceptions are handled and None is returned."""
        mock_page = MagicMock()
        mock_page.locator.side_effect = Exception("Unexpected error")

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            assert result is None
            mock_logger.exception.assert_called_once_with(
                "Tiled screenshot failed: Unexpected error"
            )

    def test_screenshot_clip_parameters(self, mock_page):
        """Test that screenshot clipping parameters are correct."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Check screenshot calls have correct clip parameters
            screenshot_calls = mock_page.screenshot.call_args_list

            # Should have 3 tiles (5000px / 2000px = 2.5, rounded up to 3)
            assert len(screenshot_calls) == 3

            # All tiles use the same x and width
            for _, call in enumerate(screenshot_calls):
                kwargs = call[1]
                assert kwargs["type"] == "png"
                assert kwargs["clip"]["x"] == 50
                assert kwargs["clip"]["width"] == 800

            # Check y positions and heights for each tile
            # Tile 1: clip_y=0, height=2000 (tile_height < remaining: 5000)
            assert screenshot_calls[0][1]["clip"]["y"] == 0
            assert screenshot_calls[0][1]["clip"]["height"] == 2000

            # Tile 2: clip_y=0, height=2000 (tile_height < remaining: 3000)
            assert screenshot_calls[1][1]["clip"]["y"] == 0
            assert screenshot_calls[1][1]["clip"]["height"] == 2000

            # Tile 3: clip_y=1000 (tile_height - remaining: 2000 - 1000)
            # height=1000 (remaining content)
            assert screenshot_calls[2][1]["clip"]["y"] == 1000
            assert screenshot_calls[2][1]["clip"]["height"] == 1000

    def test_handles_invalid_tile_dimensions(self, mock_page):
        """Test that tiles with invalid dimensions are skipped."""
        # Mock a dashboard where the last tile would have 0 or negative height
        # This simulates edge cases in height calculations
        element_info = {"height": 4000, "top": 100, "left": 50, "width": 800}
        mock_page.evaluate.return_value = element_info

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles"
            ) as mock_combine:
                mock_combine.return_value = b"combined"

                # Use exact viewport height that divides evenly
                result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

                # Should succeed
                assert result == b"combined"

                # Should take 2 screenshots (4000px / 2000px = 2)
                assert mock_page.screenshot.call_count == 2

                # Should not log any warnings about invalid dimensions
                warning_calls = [
                    call
                    for call in mock_logger.warning.call_args_list
                    if "invalid clip dimensions" in str(call)
                ]
                assert len(warning_calls) == 0

    def test_skips_tile_with_zero_height(self, mock_page):
        """Test that a tile with zero or negative height is skipped."""
        # This test verifies the clip_height <= 0 check
        # We'll manually test the logic by creating a scenario where
        # remaining_content becomes <= 0
        element_info = {"height": 2000, "top": 100, "left": 50, "width": 800}
        mock_page.evaluate.return_value = element_info

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined"

            # Use viewport height equal to element height
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should succeed with 1 tile
            assert result == b"combined"
            assert mock_page.screenshot.call_count == 1

    def test_scroll_positions_calculated_correctly(self, mock_page):
        """Test that window scroll positions are calculated correctly."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Check page.evaluate calls for scrolling
            # First call is for dimensions, subsequent are for scrolling
            evaluate_calls = mock_page.evaluate.call_args_list

            # Should have 1 dimension query + 3 scroll calls
            assert len(evaluate_calls) == 4

            # First call is for dimensions (contains querySelector)
            assert "querySelector" in str(evaluate_calls[0])

            # Subsequent calls are scroll positions
            # Tile 1: scroll to y=100 (dashboard_top + 0 * tile_height)
            assert evaluate_calls[1][0][0] == "window.scrollTo(0, 100)"

            # Tile 2: scroll to y=2100 (dashboard_top + 1 * tile_height)
            assert evaluate_calls[2][0][0] == "window.scrollTo(0, 2100)"

            # Tile 3: scroll to y=4100 (dashboard_top + 2 * tile_height)
            assert evaluate_calls[3][0][0] == "window.scrollTo(0, 4100)"

    def test_reset_scroll_position(self, mock_page):
        """Test that scroll position waits are called after each scroll."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should call wait_for_timeout 3 times (once per tile)
            assert mock_page.wait_for_timeout.call_count == 3

            # Each wait should use the scroll settle timeout constant
            for call in mock_page.wait_for_timeout.call_args_list:
                assert call[0][0] == SCROLL_SETTLE_TIMEOUT_MS
