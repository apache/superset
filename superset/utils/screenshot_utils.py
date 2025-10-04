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

from __future__ import annotations

import io
import logging
from typing import TYPE_CHECKING

from PIL import Image

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    try:
        from playwright.sync_api import Page
    except ImportError:
        Page = None


def combine_screenshot_tiles(screenshot_tiles: list[bytes]) -> bytes:
    """
    Combine multiple screenshot tiles into a single vertical image.

    Args:
        screenshot_tiles: List of screenshot bytes in PNG format

    Returns:
        Combined screenshot as bytes
    """
    if not screenshot_tiles:
        return b""

    if len(screenshot_tiles) == 1:
        return screenshot_tiles[0]

    try:
        # Open all images
        images = [Image.open(io.BytesIO(tile)) for tile in screenshot_tiles]

        # Calculate total dimensions
        total_width = max(img.width for img in images)
        total_height = sum(img.height for img in images)

        # Create combined image
        combined = Image.new("RGB", (total_width, total_height), "white")

        # Paste each tile
        y_offset = 0
        for img in images:
            combined.paste(img, (0, y_offset))
            y_offset += img.height

        # Convert back to bytes
        output = io.BytesIO()
        combined.save(output, format="PNG")
        return output.getvalue()

    except Exception as e:
        logger.exception("Failed to combine screenshot tiles: %s", e)
        # Return the first tile as fallback
        return screenshot_tiles[0]


def take_tiled_screenshot(
    page: "Page", element_name: str, viewport_height: int = 2000
) -> bytes | None:
    """
    Take a tiled screenshot of a large dashboard by scrolling and capturing sections.

    Args:
        page: Playwright page object
        element_name: CSS class name of the element to screenshot
        viewport_height: Height of each tile in pixels

    Returns:
        Combined screenshot bytes or None if failed
    """
    try:
        # Get the target element
        element = page.locator(f".{element_name}")
        element.wait_for(timeout=30000)  # 30 second timeout

        # Get dashboard dimensions and position
        element_info = page.evaluate(f"""() => {{
            const el = document.querySelector(".{element_name}");
            const rect = el.getBoundingClientRect();
            return {{
                height: el.scrollHeight,
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: el.scrollWidth
            }};
        }}""")

        dashboard_height = element_info["height"]
        dashboard_top = element_info["top"]
        dashboard_left = element_info["left"]
        dashboard_width = element_info["width"]

        logger.info(
            "Dashboard: %sx%spx at (%s, %s)",
            dashboard_width,
            dashboard_height,
            dashboard_left,
            dashboard_top,
        )

        # Calculate number of tiles needed
        num_tiles = max(1, (dashboard_height + viewport_height - 1) // viewport_height)
        logger.info("Taking %s screenshot tiles", num_tiles)

        screenshot_tiles = []

        for i in range(num_tiles):
            # Calculate scroll position to show this tile's content
            scroll_y = dashboard_top + (i * viewport_height)

            # Scroll the window to the desired position
            page.evaluate(f"window.scrollTo(0, {scroll_y})")
            logger.debug(
                "Scrolled window to %s for tile %s/%s", scroll_y, i + 1, num_tiles
            )

            # Wait for scroll to settle and content to load
            page.wait_for_timeout(2000)  # 2 second wait per tile

            # Get the current element position after scroll
            current_element_box = page.evaluate(f"""() => {{
                const el = document.querySelector(".{element_name}");
                const rect = el.getBoundingClientRect();
                return {{
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                }};
            }}""")

            # Calculate what portion of the element we want to capture for this tile
            tile_start_in_element = i * viewport_height
            remaining_content = dashboard_height - tile_start_in_element
            tile_content_height = min(viewport_height, remaining_content)

            # Clip to capture only the current tile portion of the element
            clip = {
                "x": current_element_box["x"],
                "y": current_element_box["y"],
                "width": current_element_box["width"],
                "height": min(tile_content_height, current_element_box["height"]),
            }

            # Take screenshot with clipping to capture only this tile's content
            tile_screenshot = page.screenshot(type="png", clip=clip)
            screenshot_tiles.append(tile_screenshot)

            logger.debug("Captured tile %s/%s with clip %s", i + 1, num_tiles, clip)

        # Combine all tiles
        logger.info("Combining screenshot tiles...")
        combined_screenshot = combine_screenshot_tiles(screenshot_tiles)

        # Reset window scroll position
        page.evaluate("window.scrollTo(0, 0)")

        return combined_screenshot

    except Exception as e:
        logger.exception("Tiled screenshot failed: %s", e)
        return None
