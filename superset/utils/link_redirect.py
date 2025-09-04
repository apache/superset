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
from typing import Optional
from urllib.parse import quote, urlparse

from bs4 import BeautifulSoup
from flask import current_app

logger = logging.getLogger(__name__)


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
    if not html_content:
        return html_content

    try:
        # Parse the HTML content
        soup = BeautifulSoup(html_content, "html.parser")

        # Get the base URL from config if not provided
        if base_url is None:
            base_url = current_app.config.get(
                "WEBDRIVER_BASEURL_USER_FRIENDLY",
                current_app.config.get("WEBDRIVER_BASEURL", ""),
            )

        # Parse base URL to get the host
        base_parsed = urlparse(base_url)
        base_host = base_parsed.netloc if base_parsed.netloc else base_parsed.path

        # Find all anchor tags with href attribute
        for link in soup.find_all("a", href=True):
            original_url = link["href"]

            # Skip if it's already a redirect URL
            if "/redirect?" in original_url:
                continue

            # Parse the URL
            parsed_url = urlparse(original_url)

            # Check if it's an external link
            # Consider a link external if it has a scheme (http/https) and
            # the host is different from our base host
            if parsed_url.scheme in ("http", "https"):
                link_host = parsed_url.netloc

                # If the hosts don't match, it's an external link
                if link_host and link_host != base_host:
                    # Create the redirect URL
                    redirect_url = f"/redirect?url={quote(original_url, safe='')}"
                    link["href"] = redirect_url

                    # Optionally add a visual indicator
                    if current_app.config.get(
                        "ALERT_REPORTS_EXTERNAL_LINK_INDICATOR", True
                    ):
                        # Add external link icon or class
                        existing_class = link.get("class", [])
                        if isinstance(existing_class, str):
                            existing_class = existing_class.split()
                        existing_class.append("external-link")
                        link["class"] = existing_class

        # Return the modified HTML
        return str(soup)

    except Exception as ex:
        logger.warning(f"Failed to process HTML links: {str(ex)}")
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
    if not url:
        return False

    # Get the base URL from config if not provided
    if base_url is None:
        base_url = current_app.config.get(
            "WEBDRIVER_BASEURL_USER_FRIENDLY",
            current_app.config.get("WEBDRIVER_BASEURL", ""),
        )

    # Parse both URLs
    parsed_url = urlparse(url)
    base_parsed = urlparse(base_url)

    # Get the hosts
    url_host = parsed_url.netloc
    base_host = base_parsed.netloc if base_parsed.netloc else base_parsed.path

    # Check if it's the same host
    return url_host == base_host
