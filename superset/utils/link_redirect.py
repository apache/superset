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
Utilities for processing links in alert/report emails.

External links are rewritten to go through a redirect warning page so that
recipients see a confirmation before navigating to an external site.
"""

import logging
import re
from urllib.parse import quote, urlparse

from flask import current_app

logger = logging.getLogger(__name__)

# Matches href="..." in anchor tags (both single and double quotes)
_HREF_RE = re.compile(
    r"""(<a\s[^>]*?href\s*=\s*)(["'])(.*?)\2""",
    re.IGNORECASE | re.DOTALL,
)


def _get_base_hosts() -> set[str]:
    """Return the set of hosts that are considered internal (lower-cased)."""
    hosts: set[str] = set()
    for key in ("WEBDRIVER_BASEURL_USER_FRIENDLY", "WEBDRIVER_BASEURL"):
        url = current_app.config.get(key, "")
        if url:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                hosts.add(parsed.netloc.lower())
    return hosts


def _get_redirect_base() -> str:
    """Return the base URL used to build redirect links."""
    for key in ("WEBDRIVER_BASEURL_USER_FRIENDLY", "WEBDRIVER_BASEURL"):
        url = current_app.config.get(key, "")
        if url:
            return url.rstrip("/")
    return ""


def _is_external(href: str, base_hosts: set[str]) -> bool:
    """Return True if *href* points to an external host."""
    parsed = urlparse(href)
    # Only rewrite http(s) links with a host that differs from ours
    if parsed.scheme not in ("http", "https"):
        return False
    return bool(parsed.netloc) and parsed.netloc.lower() not in base_hosts


def _replace_href(
    match: re.Match[str],
    base_hosts: set[str],
    redirect_base: str,
) -> str:
    """Regex replacer: rewrite external hrefs to go through the redirect page."""
    prefix, quote_char, href = match.group(1), match.group(2), match.group(3)
    href = href.strip()

    # Don't double-redirect
    if "/redirect/" in href:
        return match.group(0)

    if not _is_external(href, base_hosts):
        return match.group(0)

    redirect_url = f"{redirect_base}/redirect/?url={quote(href, safe='')}"
    return f"{prefix}{quote_char}{redirect_url}{quote_char}"


def process_html_links(html_content: str) -> str:
    """
    Rewrite external links in *html_content* to go through the redirect page.

    Internal links (matching the configured base URL hosts) are left untouched.
    """
    if not html_content or not html_content.strip():
        return html_content

    if not current_app.config.get("ALERT_REPORTS_ENABLE_LINK_REDIRECT", True):
        return html_content

    base_hosts = _get_base_hosts()
    if not base_hosts:
        logger.warning("No base URL configured, skipping link redirect processing")
        return html_content

    redirect_base = _get_redirect_base()
    if not redirect_base:
        return html_content

    try:
        return _HREF_RE.sub(
            lambda m: _replace_href(m, base_hosts, redirect_base),
            html_content,
        )
    except Exception:
        logger.warning("Failed to process HTML links", exc_info=True)
        return html_content


def is_safe_redirect_url(url: str) -> bool:
    """
    Return True if *url* is an internal Superset URL (safe to redirect to
    without showing a warning).
    """
    if not url or not url.strip():
        return False

    stripped = url.strip()

    # Block protocol-relative URLs
    if stripped.startswith("//") or stripped.startswith("\\\\"):
        return False

    parsed = urlparse(stripped)

    # Relative paths are safe
    if not parsed.scheme and not parsed.netloc:
        return True

    # Only allow http(s)
    if parsed.scheme not in ("http", "https"):
        return False

    base_hosts = _get_base_hosts()
    if not base_hosts:
        return False

    return parsed.netloc.lower() in base_hosts
