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

        # Mock viewport size
        page.viewport_size = {"width": 1024, "height": 768}

        # Mock element locator
        element = MagicMock()
        page.locator.return_value = element

        # Mock element info - simulating a 5000px tall dashboard
        element_info = {"height": 5000, "top": 100, "left": 50, "width": 800}
        viewport_info = {
            "elementX": 50,
            "elementY": 200,
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 7 tiles (5000px / 768px actual viewport = 6.5, rounded up to 7):
        # 1 initial call + 7 scroll + 7 viewport info + 1 reset scroll = 16 calls
        page.evaluate.side_effect = [
            element_info,  # Initial call for dashboard dimensions
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,
            viewport_info,  # Tile 4
            None,
            viewport_info,  # Tile 5
            None,
            viewport_info,  # Tile 6
            None,
            viewport_info,  # Tile 7
            None,  # Final reset scroll call
        ]

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

            result = take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Should return combined screenshot
            assert result == b"combined_screenshot"

            # Should have called screenshot method multiple times
            # (7 tiles for 5000px height with 768px actual viewport)
            assert mock_page.screenshot.call_count == 7

            # Should have called combine function
            mock_combine.assert_called_once()

    def test_element_not_found_returns_none(self):
        """Test that missing element returns None."""
        mock_page = MagicMock()
        element = MagicMock()
        element.wait_for.side_effect = Exception("Element not found")
        mock_page.locator.return_value = element

        result = take_tiled_screenshot(mock_page, "nonexistent", viewport_height=2000)

        assert result is None

    def test_tile_calculation_logic(self, mock_page):
        """Test that tiles are calculated correctly."""
        # Mock dashboard height of 3500px with viewport of 2000px
        element_info = {"height": 3500, "top": 100, "left": 50, "width": 800}
        viewport_info = {
            "elementX": 50,
            "elementY": 200,
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 2 tiles (3500px / 2000px = 1.75, rounded up to 2):
        # 1 initial call + 2 scroll + 2 viewport info + 1 reset scroll = 6 calls
        mock_page.evaluate.side_effect = [
            element_info,
            None,  # First scroll call
            viewport_info,  # First viewport info call
            None,  # Second scroll call
            viewport_info,  # Second viewport info call
            None,  # Reset scroll call
        ]

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined"

            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Should take 2 screenshots (3500px / 2000px = 1.75, rounded up to 2)
            assert mock_page.screenshot.call_count == 2

    def test_scroll_positions_calculated_correctly(self, mock_page):
        """Test that scroll positions are calculated correctly."""
        # Override the fixture's side_effect for this specific test
        element_info = {"height": 5000, "top": 100, "left": 50, "width": 800}
        viewport_info = {
            "elementX": 50,
            "elementY": 200,
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        mock_page.evaluate.side_effect = [
            element_info,  # Initial call for dashboard dimensions
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,
            viewport_info,  # Tile 4
            None,
            viewport_info,  # Tile 5
            None,
            viewport_info,  # Tile 6
            None,
            viewport_info,  # Tile 7
            None,  # Reset scroll call
        ]

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Check scroll positions (dashboard_top = 100, tile_height = 768)
            scroll_calls = [
                call
                for call in mock_page.evaluate.call_args_list
                if "scrollTo" in str(call)
            ]

            # Should have scrolled to positions: 100, 868, 1636, 2404, 3172, 3940, 4708
            expected_scrolls = [
                "window.scrollTo(0, 100)",
                "window.scrollTo(0, 868)",
                "window.scrollTo(0, 1636)",
                "window.scrollTo(0, 2404)",
                "window.scrollTo(0, 3172)",
                "window.scrollTo(0, 3940)",
                "window.scrollTo(0, 4708)",
            ]
            actual_scrolls = [call[0][0] for call in scroll_calls]

            assert len(actual_scrolls) == 8  # 7 tile scrolls + 1 reset
            for expected in expected_scrolls:
                assert expected in actual_scrolls

    def test_reset_scroll_position(self, mock_page):
        """Test that scroll position is reset after screenshot."""
        # Override the fixture's side_effect for this specific test
        element_info = {"height": 5000, "top": 100, "left": 50, "width": 800}
        viewport_info = {
            "elementX": 50,
            "elementY": 200,
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        mock_page.evaluate.side_effect = [
            element_info,  # Initial call for dashboard dimensions
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,
            viewport_info,  # Tile 4
            None,
            viewport_info,  # Tile 5
            None,
            viewport_info,  # Tile 6
            None,
            viewport_info,  # Tile 7
            None,  # Reset scroll call
        ]

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Check that final call resets scroll to top
            final_call = mock_page.evaluate.call_args_list[-1]
            assert "window.scrollTo(0, 0)" in str(final_call)

    def test_logs_dashboard_info(self, mock_page):
        """Test that dashboard info is logged."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

                # Should log dashboard dimensions with lazy logging format
                mock_logger.info.assert_any_call(
                    "Dashboard: %sx%spx at (%s, %s)", 800, 5000, 50, 100
                )
                # Should log number of tiles with lazy logging format
                mock_logger.info.assert_any_call("Taking %s screenshot tiles", 7)

    def test_exception_handling_returns_none(self):
        """Test that exceptions are handled and None is returned."""
        mock_page = MagicMock()
        mock_page.locator.side_effect = Exception("Unexpected error")

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            result = take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            assert result is None
            # The exception object is passed, not the string
            call_args = mock_logger.exception.call_args
            assert call_args[0][0] == "Tiled screenshot failed: %s"
            assert str(call_args[0][1]) == "Unexpected error"

    def test_wait_timeouts_between_tiles(self, mock_page):
        """Test that there are appropriate waits between tiles."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Should have called wait_for_timeout for each tile (7 tiles)
            assert mock_page.wait_for_timeout.call_count == 7

            # Each wait should be 2000ms (2 seconds)
            for call in mock_page.wait_for_timeout.call_args_list:
                assert call[0][0] == 2000

    def test_screenshot_clip_parameters(self, mock_page):
        """Test that screenshot clipping parameters are correct."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Check screenshot calls have correct clip parameters
            screenshot_calls = mock_page.screenshot.call_args_list

            for call in screenshot_calls:
                kwargs = call[1]
                assert kwargs["type"] == "png"
                assert "clip" in kwargs

                clip = kwargs["clip"]
                assert clip["x"] == 50
                assert clip["y"] == 200
                assert clip["width"] == 800
                # Height should be min of viewport_height and remaining content
                assert clip["height"] <= 600  # Element height from mock

    def test_negative_element_position_clipped_to_zero(self):
        """Test that negative element positions are clipped to viewport bounds."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        # Mock element locator
        element = MagicMock()
        mock_page.locator.return_value = element

        # Simulate element scrolled above viewport (negative Y position)
        element_info = {"height": 3000, "top": 100, "left": 0, "width": 800}
        viewport_info = {
            "elementX": 0,
            "elementY": -200,  # Element is scrolled 200px above viewport
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 4 tiles (3000px / 768px = 3.9, rounded up to 4):
        # 1 initial + 4 * (scroll + viewport info) + 1 reset = 10 calls
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,
            viewport_info,  # Tile 4
            None,  # Reset scroll
        ]

        mock_page.screenshot.return_value = b"screenshot"

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            result = take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            # Should complete successfully
            assert result is not None

            # Check that clip Y was adjusted to 0 (not negative)
            screenshot_calls = mock_page.screenshot.call_args_list
            for call in screenshot_calls:
                clip = call[1]["clip"]
                assert clip["y"] >= 0, "Clip Y should never be negative"
                assert clip["x"] >= 0, "Clip X should never be negative"

    def test_element_extends_beyond_viewport(self):
        """Test clipping when element extends beyond viewport boundaries."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 2000, "top": 0, "left": 0, "width": 1200}

        # Element is wider than viewport
        viewport_info = {
            "elementX": 0,
            "elementY": 100,
            "elementWidth": 1200,  # Wider than viewport
            "elementHeight": 800,
            "viewportWidth": 1024,  # Viewport width
            "viewportHeight": 768,
        }

        # For 3 tiles (2000px / 768px = 2.6, rounded up to 3):
        # 1 initial + 3 * (scroll + viewport info) + 1 reset = 8 calls
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,  # Reset scroll
        ]

        mock_page.screenshot.return_value = b"screenshot"

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            result = take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            assert result is not None

            # Check that clip width was constrained to viewport
            clip = mock_page.screenshot.call_args_list[0][1]["clip"]
            assert clip["width"] <= 1024, "Clip width should not exceed viewport"

    def test_invalid_clip_dimensions_skipped(self):
        """Test that tiles with invalid dimensions are skipped with a warning."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 4000, "top": 0, "left": 0, "width": 800}

        # First tile: valid
        valid_viewport_info = {
            "elementX": 0,
            "elementY": 100,
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # Second tile: invalid (negative height after calculation)
        invalid_viewport_info = {
            "elementX": 0,
            "elementY": -1000,  # Far above viewport
            "elementWidth": 800,
            "elementHeight": 100,  # Not enough visible height
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 6 tiles (4000px / 768px = 5.2, rounded up to 6):
        # 1 initial + 6 * (scroll + viewport info) + 1 reset = 14 calls
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            valid_viewport_info,  # Tile 1 - valid
            None,
            invalid_viewport_info,  # Tile 2 - invalid, should be skipped
            None,
            valid_viewport_info,  # Tile 3 - valid
            None,
            valid_viewport_info,  # Tile 4 - valid
            None,
            valid_viewport_info,  # Tile 5 - valid
            None,
            valid_viewport_info,  # Tile 6 - valid
            None,  # Reset scroll
        ]

        mock_page.screenshot.return_value = b"screenshot"

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                result = take_tiled_screenshot(
                    mock_page, "dashboard", viewport_height=2000
                )

                # Should complete but with warning
                assert result is not None

                # Should have logged a warning about skipping tile
                mock_logger.warning.assert_called_once()
                warning_msg = mock_logger.warning.call_args[0][0]
                assert "Skipping tile" in warning_msg
                assert "invalid clip dimensions" in warning_msg

                # Should have taken 5 screenshots (6 tiles - 1 invalid)
                assert mock_page.screenshot.call_count == 5

    def test_viewport_bounds_with_offset_element(self):
        """Test proper clipping for element with positive offset from viewport edge."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 2000, "top": 500, "left": 200, "width": 600}

        # Element starts 200px from left edge
        viewport_info = {
            "elementX": 200,  # Offset from left
            "elementY": 150,
            "elementWidth": 600,
            "elementHeight": 500,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 3 tiles (2000px / 768px = 2.6, rounded up to 3):
        # 1 initial + 3 * (scroll + viewport info) + 1 reset = 8 calls
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            viewport_info,  # Tile 1
            None,
            viewport_info,  # Tile 2
            None,
            viewport_info,  # Tile 3
            None,  # Reset scroll
        ]

        mock_page.screenshot.return_value = b"screenshot"

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            result = take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

            assert result is not None

            # Check clip respects element position
            clip = mock_page.screenshot.call_args_list[0][1]["clip"]
            assert clip["x"] == 200, "Should preserve element X offset"
            assert clip["y"] == 150, "Should preserve element Y offset"
            assert clip["width"] == 600, "Should use element width"

    def test_zero_width_element_skipped(self):
        """Test that elements with zero or negative width are skipped."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 2000, "top": 0, "left": 0, "width": 0}

        viewport_info = {
            "elementX": 0,
            "elementY": 100,
            "elementWidth": 0,  # Zero width
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 3 tiles (2000px / 768px = 2.6, rounded up to 3):
        # 1 initial + 3 * (scroll + viewport info) + 1 reset = 8 calls
        # All tiles will be skipped due to zero width
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            viewport_info,  # Tile 1 - skipped
            None,
            viewport_info,  # Tile 2 - skipped
            None,
            viewport_info,  # Tile 3 - skipped
            None,  # Reset scroll
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                result = take_tiled_screenshot(
                    mock_page, "dashboard", viewport_height=2000
                )

                # Should handle gracefully
                assert result is not None

                # Should have logged warnings about invalid dimensions
                # (3 times, once per tile)
                assert mock_logger.warning.call_count == 3
                for call in mock_logger.warning.call_args_list:
                    warning_msg = call[0][0]
                    assert "invalid clip dimensions" in warning_msg

                # Should not have taken any screenshots
                assert mock_page.screenshot.call_count == 0

    def test_element_completely_above_viewport(self):
        """Test element that is completely scrolled above the viewport."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1024, "height": 768}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 2000, "top": 0, "left": 0, "width": 800}

        # Element completely above viewport
        viewport_info = {
            "elementX": 0,
            "elementY": -800,  # Completely above viewport
            "elementWidth": 800,
            "elementHeight": 600,
            "viewportWidth": 1024,
            "viewportHeight": 768,
        }

        # For 3 tiles (2000px / 768px = 2.6, rounded up to 3):
        # 1 initial + 3 * (scroll + viewport info) + 1 reset = 8 calls
        # All tiles will be skipped because element is completely above viewport
        mock_page.evaluate.side_effect = [
            element_info,
            None,
            viewport_info,  # Tile 1 - skipped
            None,
            viewport_info,  # Tile 2 - skipped
            None,
            viewport_info,  # Tile 3 - skipped
            None,  # Reset scroll
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                result = take_tiled_screenshot(
                    mock_page, "dashboard", viewport_height=2000
                )

                # Should handle gracefully
                assert result is not None

                # Should have skipped all 3 tiles with warnings
                assert mock_logger.warning.call_count == 3

                # Should not have taken screenshots
                assert mock_page.screenshot.call_count == 0

    def test_scroll_increment_respects_actual_viewport_height(self):
        """When config viewport height > actual viewport, we still cover every tile."""
        mock_page = MagicMock()
        mock_page.viewport_size = {"width": 1600, "height": 1200}

        element = MagicMock()
        mock_page.locator.return_value = element

        element_info = {"height": 3600, "top": 0, "left": 0, "width": 800}
        viewport_info = {
            "elementX": 0,
            "elementY": 0,
            "elementWidth": 800,
            "elementHeight": 1200,
            "viewportWidth": 1600,
            "viewportHeight": 1200,
        }

        mock_page.evaluate.side_effect = [
            element_info,  # Initial call for dashboard dimensions
            None,  # First scroll
            viewport_info,  # First viewport info
            None,  # Second scroll
            viewport_info,  # Second viewport info
            None,  # Third scroll
            viewport_info,  # Third viewport info
            None,  # Reset scroll
        ]

        mock_page.screenshot.return_value = b"screenshot"

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", viewport_height=2000)

        # We expect three tiles (0–1200, 1200–2400, 2400–3600)
        # even though config says 2000.
        assert mock_page.screenshot.call_count == 3

        scroll_calls = [
            call
            for call in mock_page.evaluate.call_args_list
            if "scrollTo" in str(call)
        ]
        actual_scrolls = [call[0][0] for call in scroll_calls]

        # Should have scrolled to positions: 0, 1200, 2400, plus final reset to 0
        assert len(actual_scrolls) == 4  # 3 tile scrolls + 1 reset
        assert actual_scrolls == [
            "window.scrollTo(0, 0)",
            "window.scrollTo(0, 1200)",
            "window.scrollTo(0, 2400)",
            "window.scrollTo(0, 0)",  # Reset scroll
        ]
