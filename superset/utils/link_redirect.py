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
import re
from typing import Any, Optional
from urllib.parse import quote, urlparse

from bs4 import BeautifulSoup
from flask import current_app

logger = logging.getLogger(__name__)


def _get_base_url_and_host(
    base_url: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """Extract and validate base URL and host."""
    if base_url is None:
        base_url = current_app.config.get(
            "WEBDRIVER_BASEURL_USER_FRIENDLY",
            current_app.config.get("WEBDRIVER_BASEURL", ""),
        )

    if not base_url:
        logger.warning("No base URL configured, skipping link processing")
        return None, None

    # Parse base URL to get the host
    base_parsed = urlparse(base_url)
    base_host = base_parsed.netloc if base_parsed.netloc else base_parsed.path

    # Validate that the base URL has a proper scheme and host
    if not base_host or not base_parsed.scheme:
        logger.warning("Invalid base URL configured, skipping link processing")
        return None, None

    return base_url, base_host


def _get_configured_base_urls() -> list[str]:
    """
    Return non-empty configured base URLs.

    Superset can be configured with both a user-friendly base URL and an internal one.
    For safety checks we consider both.
    """
    base_urls: list[str] = []
    for candidate in (
        current_app.config.get("WEBDRIVER_BASEURL_USER_FRIENDLY", ""),
        current_app.config.get("WEBDRIVER_BASEURL", ""),
    ):
        if candidate and candidate not in base_urls:
            base_urls.append(candidate)
    return base_urls


def _get_base_hosts(base_url: Optional[str]) -> set[str]:
    """Return the set of configured base hosts (lower-cased)."""
    base_urls = [base_url] if base_url else _get_configured_base_urls()
    hosts: set[str] = set()
    for candidate in base_urls:
        parsed = urlparse(candidate)
        host = parsed.netloc if parsed.netloc else parsed.path
        if parsed.scheme and host:
            hosts.add(host.lower())
    return hosts


def _get_redirect_url(original_url: str, base_url: str) -> str:
    """
    Build the redirect URL for an external link.

    Uses REDIRECT_URL_PAGE config if set, otherwise builds URL from base_url.
    This avoids using url_for which requires a request context.
    """
    if custom_redirect_page := current_app.config.get("REDIRECT_URL_PAGE"):
        return f"{custom_redirect_page}?url={quote(original_url, safe='')}"

    # Build the redirect URL from the base URL
    # Remove trailing slash from base_url if present
    base = base_url.rstrip("/")
    return f"{base}/redirect/?url={quote(original_url, safe='')}"


def _process_link_element(link: Any, base_hosts: set[str], base_url: str) -> bool:
    """Process a single link element for external URL redirection."""
    original_url = link["href"].strip()

    if not original_url or "/redirect?" in original_url:
        return False

    modified = False

    # Handle protocol-relative URLs (e.g., //evil.com/foo)
    if original_url.startswith("//"):
        # Convert to https for processing
        original_url = "https:" + original_url
        link["href"] = original_url
        modified = True

    # Parse the URL
    parsed_url = urlparse(original_url)

    # Check if it's an external link (http, https, or protocol-relative)
    if parsed_url.scheme in ("http", "https"):
        link_host = parsed_url.netloc

        # If the hosts don't match, it's an external link
        if link_host and link_host.lower() not in base_hosts:
            redirect_url = _get_redirect_url(original_url, base_url)
            link["href"] = redirect_url
            modified = True

            # Optionally add a visual indicator
            if current_app.config.get("ALERT_REPORTS_EXTERNAL_LINK_INDICATOR", True):
                # Add external link icon or class
                existing_class = link.get("class", [])
                if isinstance(existing_class, str):
                    existing_class = existing_class.split()
                if "external-link" not in existing_class:
                    existing_class.append("external-link")
                    modified = True
                link["class"] = existing_class
    return modified


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

        # Get and validate base URL and host
        resolved_base_url, base_host = _get_base_url_and_host(base_url)
        if not base_host or not resolved_base_url:
            return html_content

        base_hosts = _get_base_hosts(base_url) | {base_host.lower()}
        if not base_hosts:
            return html_content

        # Find all anchor tags with href attribute and process them
        modified = False
        for link in soup.find_all("a", href=True):
            modified |= _process_link_element(link, base_hosts, resolved_base_url)

        if not modified:
            return html_content

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
        stripped_url = url.strip()
        if stripped_url.startswith("//") or stripped_url.startswith("\\\\"):
            return False

        # Parse both URLs
        parsed_url = urlparse(stripped_url)

        # Relative URLs are safe, but only if they're not protocol-relative.
        if not parsed_url.scheme and not parsed_url.netloc:
            return True

        if parsed_url.scheme not in ("http", "https"):
            return False

        base_hosts = _get_base_hosts(base_url)
        if not base_hosts:
            logger.warning("No base URL configured for safety check")
            return False

        return parsed_url.netloc.lower() in base_hosts

    except Exception as ex:
        logger.warning("Error checking URL safety: %s", str(ex))
        # On error, assume unsafe
        return False


def is_valid_url_encoding(url: str) -> bool:
    """
    Return True if percent-escapes in the URL are syntactically valid.

    The `url` query param is already decoded once by Werkzeug. If the embedded URL
    contains percent-escapes (eg, `%20`) they should be well-formed.
    """
    return re.search(r"%(?![0-9A-Fa-f]{2})", url) is None
