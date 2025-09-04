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

import logging
from typing import Any, Optional
from urllib.parse import quote, urlparse

from bs4 import BeautifulSoup
from flask import current_app

logger = logging.getLogger(__name__)


def _get_base_host(base_url: Optional[str]) -> Optional[str]:
    """Extract and validate base host from URL."""
    if base_url is None:
        base_url = current_app.config.get(
            "WEBDRIVER_BASEURL_USER_FRIENDLY",
            current_app.config.get("WEBDRIVER_BASEURL", ""),
        )

    if not base_url:
        logger.warning("No base URL configured, skipping link processing")
        return None

    # Parse base URL to get the host
    base_parsed = urlparse(base_url)
    base_host = base_parsed.netloc if base_parsed.netloc else base_parsed.path

    # Validate that the base URL has a proper scheme and host
    if not base_host or not base_parsed.scheme:
        logger.warning("Invalid base URL configured, skipping link processing")
        return None

    return base_host


def _process_link_element(link: Any, base_host: str) -> None:
    """Process a single link element for external URL redirection."""
    original_url = link["href"].strip()

    if not original_url or "/redirect?" in original_url:
        return

    # Parse the URL
    parsed_url = urlparse(original_url)

    # Check if it's an external link
    if parsed_url.scheme in ("http", "https"):
        link_host = parsed_url.netloc

        # If the hosts don't match, it's an external link
        if link_host and link_host != base_host:
            # Create the redirect URL
            redirect_url = f"/redirect?url={quote(original_url, safe='')}"
            link["href"] = redirect_url

            # Optionally add a visual indicator
            if current_app.config.get("ALERT_REPORTS_EXTERNAL_LINK_INDICATOR", True):
                # Add external link icon or class
                existing_class = link.get("class", [])
                if isinstance(existing_class, str):
                    existing_class = existing_class.split()
                existing_class.append("external-link")
                link["class"] = existing_class


def process_html_links(html_content: str, base_url: Optional[str] = None) -> str:
    """
    Process HTML content to replace external links with redirect URLs.

    This function parses HTML content and replaces any external links
    (those not pointing to the Superset instance) with redirect URLs that
    will show a warning before navigating to the external site.

    Args:
        html_content: The HTML content to process
        base_url: The base URL of the Superset instance. If not provided,
                  will attempt to get from app config

    Returns:
        The processed HTML content with external links replaced
    """
    if not html_content or not html_content.strip():
        return html_content

    # Check if link redirection is enabled
    if not current_app.config.get("ALERT_REPORTS_ENABLE_LINK_REDIRECT", True):
        return html_content

    try:
        # Parse the HTML content
        soup = BeautifulSoup(html_content, "html.parser")

        # Get and validate base host
        base_host = _get_base_host(base_url)
        if not base_host:
            return html_content

        # Find all anchor tags with href attribute and process them
        for link in soup.find_all("a", href=True):
            _process_link_element(link, base_host)

        # Return the modified HTML
        return str(soup)

    except Exception as ex:
        logger.warning("Failed to process HTML links: %s", str(ex))
        # On error, return the original HTML unchanged
        return html_content


def is_safe_redirect_url(url: str, base_url: Optional[str] = None) -> bool:
    """
    Check if a URL is safe to redirect to (i.e., it's a Superset URL).

    Args:
        url: The URL to check
        base_url: The base URL of the Superset instance

    Returns:
        True if the URL is safe (internal), False otherwise
    """
    if not url or not url.strip():
        return False

    try:
        # Get the base URL from config if not provided
        if base_url is None:
            base_url = current_app.config.get(
                "WEBDRIVER_BASEURL_USER_FRIENDLY",
                current_app.config.get("WEBDRIVER_BASEURL", ""),
            )

        if not base_url:
            logger.warning("No base URL configured for safety check")
            return False

        # Parse both URLs
        parsed_url = urlparse(url.strip())
        base_parsed = urlparse(base_url)

        # Get the hosts
        url_host = parsed_url.netloc
        base_host = base_parsed.netloc if base_parsed.netloc else base_parsed.path

        if not base_host:
            logger.warning("Invalid base URL configured for safety check")
            return False

        # For relative URLs (no host), consider them safe
        if not url_host:
            return True

        # Check if it's the same host (case-insensitive comparison)
        return url_host.lower() == base_host.lower()

    except Exception as ex:
        logger.warning("Error checking URL safety: %s", str(ex))
        # On error, assume unsafe
        return False
